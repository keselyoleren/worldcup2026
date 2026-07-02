"use client";

import { useEffect, useMemo, useState } from "react";
import { Match } from "@/lib/types";
import { predict } from "@/lib/prediction";
import { Crest, StatusBadge } from "./ui";

type Guess = { home: number; away: number };
type Store = Record<string, Guess>;
const KEY = "wc26-guesses";

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function outcome(h: number, a: number) {
  return h > a ? "H" : h < a ? "A" : "D";
}

// Poin: skor tepat = 3, hasil benar (menang/seri) = 1, salah = 0.
function scoreGuess(g: Guess, actualH: number, actualA: number): number {
  if (g.home === actualH && g.away === actualA) return 3;
  if (outcome(g.home, g.away) === outcome(actualH, actualA)) return 1;
  return 0;
}

function isRealTeam(m: Match) {
  return m.home.name !== "TBD" && m.away.name !== "TBD" &&
    !/^[WL]\d/.test(m.home.name) && !/^[WL]\d/.test(m.away.name);
}

export function TebakSkor({ matches }: { matches: Match[] }) {
  const [store, setStore] = useState<Store>({});
  const [tab, setTab] = useState<"open" | "mine">("open");

  useEffect(() => setStore(loadStore()), []);

  const save = (id: string, g: Guess) => {
    const next = { ...store, [id]: g };
    setStore(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };
  const remove = (id: string) => {
    const next = { ...store };
    delete next[id];
    setStore(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const open = matches.filter(
    (m) => isRealTeam(m) && (m.status === "SCHEDULED" || m.status === "TIMED")
  );
  const mine = matches.filter((m) => store[m.id]);

  // Total poin dari laga yang sudah selesai
  const { points, evaluated } = useMemo(() => {
    let pts = 0, ev = 0;
    for (const m of mine) {
      if (m.status === "FINISHED" && m.score.home !== null && m.score.away !== null) {
        pts += scoreGuess(store[m.id], m.score.home, m.score.away);
        ev++;
      }
    }
    return { points: pts, evaluated: ev };
  }, [mine, store]);

  return (
    <div>
      <div className="card mb-6 flex items-center justify-between p-4">
        <div>
          <div className="text-xs text-white/60">Total Poin Kamu</div>
          <div className="text-3xl font-black text-(--color-gold)">{points}</div>
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
        {tab === "open" &&
          open.map((m) => (
            <GuessCard key={m.id} match={m} guess={store[m.id]} onSave={save} onRemove={remove} />
          ))}
        {tab === "mine" &&
          mine.map((m) => (
            <GuessCard key={m.id} match={m} guess={store[m.id]} onSave={save} onRemove={remove} />
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
  match, guess, onSave, onRemove,
}: {
  match: Match; guess?: Guess; onSave: (id: string, g: Guess) => void; onRemove: (id: string) => void;
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
