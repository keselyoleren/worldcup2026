"use client";

import { useEffect, useMemo, useState } from "react";
import { Match } from "@/lib/types";
import { predict } from "@/lib/prediction";
import { useAuth } from "./AuthProvider";
import {
  GuessDoc,
  GuessMap,
  fetchMatchGuesses,
  removeGuess,
  saveGuess,
  subscribeMyGuesses,
} from "@/lib/guesses";
import { Crest, StatusBadge } from "./ui";

// Kunci localStorage versi lama — dipakai sekali untuk migrasi ke Firestore.
const LEGACY_KEY = "wc26-guesses";

function outcome(h: number, a: number) {
  return h > a ? "H" : h < a ? "A" : "D";
}

// Poin: skor tepat = 3, hasil benar (menang/seri) = 1, salah = 0.
function scoreGuess(g: { home: number; away: number }, actualH: number, actualA: number): number {
  if (g.home === actualH && g.away === actualA) return 3;
  if (outcome(g.home, g.away) === outcome(actualH, actualA)) return 1;
  return 0;
}

function isRealTeam(m: Match) {
  return m.home.name !== "TBD" && m.away.name !== "TBD" &&
    !/^[WL]\d/.test(m.home.name) && !/^[WL]\d/.test(m.away.name);
}

export function TebakSkor({ matches }: { matches: Match[] }) {
  const { user, loading, ready, signIn } = useAuth();
  const [store, setStore] = useState<GuessMap>({});
  const [tab, setTab] = useState<"open" | "mine">("open");

  // Berlangganan tebakan milik user dari Firestore (realtime)
  useEffect(() => {
    if (!user) {
      setStore({});
      return;
    }
    return subscribeMyGuesses(user.uid, setStore);
  }, [user]);

  // Migrasi sekali jalan: tebakan lama di localStorage diunggah ke Firestore
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const legacy: Record<string, { home: number; away: number }> = JSON.parse(raw);
      const jobs = Object.entries(legacy).map(([matchId, g]) =>
        saveGuess(user, matchId, g.home, g.away)
      );
      Promise.all(jobs)
        .then(() => localStorage.removeItem(LEGACY_KEY))
        .catch(() => {}); // gagal migrasi → biarkan, dicoba lagi kunjungan berikutnya
    } catch {
      localStorage.removeItem(LEGACY_KEY);
    }
  }, [user]);

  if (!ready) return <SetupNotice />;
  if (loading) {
    return <p className="py-16 text-center text-white/60">Memeriksa status login…</p>;
  }
  if (!user) return <LoginGate onLogin={signIn} />;

  const save = (id: string, g: { home: number; away: number }) => {
    // Optimistic update; snapshot Firestore akan menyusul mengonfirmasi
    setStore((s) => ({
      ...s,
      [id]: { matchId: id, uid: user.uid, name: user.displayName ?? "Anonim", photo: user.photoURL ?? null, ...g },
    }));
    saveGuess(user, id, g.home, g.away).catch((e) => {
      console.error("Gagal menyimpan tebakan:", e);
      alert("Gagal menyimpan tebakan. Cek koneksi lalu coba lagi.");
    });
  };
  const remove = (id: string) => {
    setStore((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
    removeGuess(user.uid, id).catch((e) => console.error("Gagal menghapus tebakan:", e));
  };

  const open = matches.filter(
    (m) => isRealTeam(m) && (m.status === "SCHEDULED" || m.status === "TIMED")
  );
  const mine = matches.filter((m) => store[m.id]);

  // Total poin dari laga yang sudah selesai
  let points = 0, evaluated = 0;
  for (const m of mine) {
    if (m.status === "FINISHED" && m.score.home !== null && m.score.away !== null) {
      points += scoreGuess(store[m.id], m.score.home, m.score.away);
      evaluated++;
    }
  }

  return (
    <div>
      <div className="card mb-6 flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {user.photoURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
          )}
          <div>
            <div className="text-xs text-white/60">Total Poin {user.displayName ?? "Kamu"}</div>
            <div className="text-3xl font-black text-(--color-gold)">{points}</div>
          </div>
        </div>
        <div className="text-right text-xs text-white/60">
          <div>{Object.keys(store).length} tebakan dibuat</div>
          <div>{evaluated} tebakan sudah dinilai</div>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <TabBtn active={tab === "open"} onClick={() => setTab("open")}>
          Buat Tebakan ({open.length})
        </TabBtn>
        <TabBtn active={tab === "mine"} onClick={() => setTab("mine")}>
          Tebakan Saya ({mine.length})
        </TabBtn>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(tab === "open" ? open : mine).map((m) => (
          <GuessCard
            key={m.id}
            match={m}
            myUid={user.uid}
            guess={store[m.id]}
            onSave={save}
            onRemove={remove}
          />
        ))}
      </div>

      {tab === "open" && open.length === 0 && (
        <p className="py-12 text-center text-white/60">Belum ada laga yang bisa ditebak saat ini.</p>
      )}
      {tab === "mine" && mine.length === 0 && (
        <p className="py-12 text-center text-white/60">
          Kamu belum punya tebakan. Buka tab "Buat Tebakan" untuk mulai.
        </p>
      )}
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <div className="mb-2 text-3xl">⚙️</div>
      <h2 className="mb-2 text-lg font-bold">Firebase belum dikonfigurasi</h2>
      <p className="text-sm text-white/60">
        Fitur Tebak Skor butuh Firebase (login Google + database). Isi variabel{" "}
        <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_FIREBASE_*</code> di{" "}
        <code className="rounded bg-white/10 px-1">.env.local</code> — panduan lengkap ada di{" "}
        <code className="rounded bg-white/10 px-1">FIREBASE_SETUP.md</code>.
      </p>
    </div>
  );
}

function LoginGate({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <div className="mb-3 text-4xl">🔐</div>
      <h2 className="mb-2 text-xl font-bold">Masuk untuk Menebak Skor</h2>
      <p className="mb-6 text-sm text-white/60">
        Tebakanmu disimpan di database, bisa diakses dari perangkat mana pun, dan kamu bisa
        melihat tebakan user lain di tiap laga.
      </p>
      <button
        onClick={onLogin}
        className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-2.5 font-semibold text-black transition hover:brightness-90"
      >
        <GoogleIcon />
        Masuk dengan Google
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm transition ${
        active ? "bg-(--color-gold) font-semibold text-black" : "bg-white/10 text-white/70 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

function GuessCard({
  match, myUid, guess, onSave, onRemove,
}: {
  match: Match;
  myUid: string;
  guess?: GuessDoc;
  onSave: (id: string, g: { home: number; away: number }) => void;
  onRemove: (id: string) => void;
}) {
  const [h, setH] = useState(guess?.home ?? 0);
  const [a, setA] = useState(guess?.away ?? 0);
  useEffect(() => {
    setH(guess?.home ?? 0);
    setA(guess?.away ?? 0);
  }, [guess]);

  const finished = match.status === "FINISHED" && match.score.home !== null && match.score.away !== null;
  const earned = finished && guess ? scoreGuess(guess, match.score.home!, match.score.away!) : null;
  const model = predict(match.home.name, match.away.name);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between text-xs text-white/60">
        <span>{match.group ?? match.stage.replace(/_/g, " ")}</span>
        <StatusBadge status={match.status} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 flex-col items-center gap-1">
          <Crest src={match.home.crest} name={match.home.name} />
          <span className="text-center text-xs">{match.home.name}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Stepper value={h} onChange={setH} disabled={finished} />
          <span className="text-white/40">–</span>
          <Stepper value={a} onChange={setA} disabled={finished} />
        </div>

        <div className="flex flex-1 flex-col items-center gap-1">
          <Crest src={match.away.crest} name={match.away.name} />
          <span className="text-center text-xs">{match.away.name}</span>
        </div>
      </div>

      {finished && (
        <div className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-center text-sm">
          Hasil akhir: <b className="text-white">{match.score.home}–{match.score.away}</b>
          {guess && (
            <span className={`ml-2 font-bold ${earned! >= 3 ? "text-(--color-gold)" : earned! >= 1 ? "text-emerald-400" : "text-red-400"}`}>
              +{earned} poin
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-white/60">
        <span>🔮 Prediksi komputer: {model.likelyScore.home}–{model.likelyScore.away}</span>
        {!finished && (
          <div className="flex gap-2">
            {guess && (
              <button onClick={() => onRemove(match.id)} className="text-red-400 hover:underline">
                Hapus
              </button>
            )}
            <button
              onClick={() => onSave(match.id, { home: h, away: a })}
              className="rounded-md bg-(--color-gold) px-3 py-1 font-semibold text-black hover:brightness-95"
            >
              {guess ? "Perbarui" : "Simpan"}
            </button>
          </div>
        )}
      </div>

      <OtherGuesses match={match} myUid={myUid} finished={finished} />
    </div>
  );
}

// Panel tebakan user lain untuk satu laga — dimuat saat pertama kali dibuka.
function OtherGuesses({ match, myUid, finished }: { match: Match; myUid: string; finished: boolean }) {
  const [openPanel, setOpenPanel] = useState(false);
  const [list, setList] = useState<GuessDoc[] | null>(null);

  const toggle = () => {
    const next = !openPanel;
    setOpenPanel(next);
    if (next && list === null) {
      fetchMatchGuesses(match.id).then(setList).catch(() => setList([]));
    }
  };

  const others = useMemo(() => (list ?? []).filter((g) => g.uid !== myUid), [list, myUid]);

  return (
    <div className="mt-3 border-t border-white/10 pt-2">
      <button onClick={toggle} className="text-xs text-white/50 transition hover:text-white">
        👥 {openPanel ? "Sembunyikan" : "Lihat"} tebakan user lain
      </button>

      {openPanel && (
        <div className="mt-2 space-y-1.5">
          {list === null && <p className="text-xs text-white/40">Memuat…</p>}
          {list !== null && others.length === 0 && (
            <p className="text-xs text-white/40">Belum ada user lain yang menebak laga ini.</p>
          )}
          {others.map((g) => {
            const pts =
              finished && match.score.home !== null && match.score.away !== null
                ? scoreGuess(g, match.score.home, match.score.away)
                : null;
            return (
              <div key={g.uid} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs">
                {g.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.photo} alt="" className="h-5 w-5 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">👤</span>
                )}
                <span className="flex-1 truncate text-white/80">{g.name}</span>
                <b className="text-white">{g.home}–{g.away}</b>
                {pts !== null && (
                  <span className={`font-bold ${pts >= 3 ? "text-(--color-gold)" : pts >= 1 ? "text-emerald-400" : "text-red-400"}`}>
                    +{pts}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <button
        disabled={disabled}
        onClick={() => onChange(Math.min(value + 1, 20))}
        className="text-xs text-white/40 hover:text-white disabled:opacity-30"
      >
        ▲
      </button>
      <span className="w-8 text-center text-2xl font-black">{value}</span>
      <button
        disabled={disabled}
        onClick={() => onChange(Math.max(value - 1, 0))}
        className="text-xs text-white/40 hover:text-white disabled:opacity-30"
      >
        ▼
      </button>
    </div>
  );
}
