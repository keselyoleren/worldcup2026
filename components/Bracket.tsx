"use client";

import { useEffect, useMemo, useState } from "react";
import { Match } from "@/lib/types";
import { projectedSeeds, SeedTeam } from "@/lib/simulate";
import { buildKnockoutBracket, KnockoutBracket, KoSide } from "@/lib/bracket";
import { ratingOf } from "@/lib/prediction";
import { Crest } from "./ui";

type Picks = Record<string, string>; // "round-matchIndex" -> nama tim

export function Bracket({ matches, ratings }: { matches: Match[]; ratings?: Record<string, number> }) {
  const ko = useMemo(() => buildKnockoutBracket(matches), [matches]);
  if (ko) return <KnockoutView ko={ko} ratings={ratings} />;
  return <ProjectedView matches={matches} />;
}

// ===========================================================================
//  Mode fase gugur RESMI: pasangan laga & hasil dari data pertandingan.
//  Laga selesai dikunci (skor tampil); laga mendatang bisa dipilih pemenangnya.
// ===========================================================================
const KO_KEY = "wc26-bracket-ko";

function KnockoutView({ ko, ratings }: { ko: KnockoutBracket; ratings?: Record<string, number> }) {
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setPicks(JSON.parse(localStorage.getItem(KO_KEY) || "{}"));
    } catch {}
    setLoaded(true);
  }, []);

  const persist = (p: Picks) => {
    setPicks(p);
    localStorage.setItem(KO_KEY, JSON.stringify(p));
  };

  const { rounds, titles } = ko;

  // nama pemenang laga (r,i): hasil nyata > pilihan pengguna
  const winnerName = (r: number, i: number, p: Picks): string | null => {
    const m = rounds[r][i];
    if (m.finished && m.winner) return m.winner;
    return p[`${r}-${i}`] ?? null;
  };

  // Slot tiap laga: tim dari API bila sudah resmi, kalau belum diisi
  // pemenang (nyata/pilihan) laga feeder di ronde sebelumnya.
  const resolveRounds = (p: Picks): { home: KoSide | null; away: KoSide | null }[][] => {
    const resolved: { home: KoSide | null; away: KoSide | null }[][] = [];
    const fromPrev = (pr: number, pi: number): KoSide | null => {
      if (pi >= rounds[pr].length) return null;
      const w = winnerName(pr, pi, p);
      if (!w) return null;
      const pm = resolved[pr][pi];
      if (pm.home?.name === w) return pm.home;
      if (pm.away?.name === w) return pm.away;
      return { name: w };
    };
    for (let r = 0; r < rounds.length; r++) {
      resolved[r] = rounds[r].map((m, i) => {
        let home: KoSide | null = m.home.name ? m.home : null;
        let away: KoSide | null = m.away.name ? m.away : null;
        if (r > 0) {
          if (!home) home = fromPrev(r - 1, 2 * i);
          if (!away) away = fromPrev(r - 1, 2 * i + 1);
        }
        return { home, away };
      });
    }
    return resolved;
  };

  const resolved = resolveRounds(picks);

  const pick = (r: number, matchIdx: number, team: string) => {
    if (rounds[r][matchIdx].finished) return;
    const next: Picks = {};
    // pertahankan pilihan ronde <= r kecuali yang diubah; buang ronde setelahnya
    for (const [k, v] of Object.entries(picks)) {
      const rr = Number(k.split("-")[0]);
      if (rr < r) next[k] = v;
      else if (rr === r && k !== `${r}-${matchIdx}`) next[k] = v;
    }
    next[`${r}-${matchIdx}`] = team;
    persist(next);
  };

  // isi otomatis laga yang belum selesai dengan tim ber-rating lebih tinggi
  const autofill = () => {
    const next: Picks = {};
    for (let r = 0; r < rounds.length; r++) {
      const parts = resolveRounds(next)[r];
      for (let i = 0; i < rounds[r].length; i++) {
        const m = rounds[r][i];
        if (m.finished && m.winner) continue;
        const a = parts[i].home, b = parts[i].away;
        const w = !b ? a : !a ? b : ratingOf(a.name!, ratings) >= ratingOf(b.name!, ratings) ? a : b;
        if (w?.name) next[`${r}-${i}`] = w.name;
      }
    }
    persist(next);
  };

  const last = rounds.length - 1;
  const championName = winnerName(last, 0, picks);
  const champion = championName
    ? resolved[last][0].home?.name === championName
      ? resolved[last][0].home
      : resolved[last][0].away
    : null;
  const championReal = rounds[last][0].finished && !!rounds[last][0].winner;

  const finishedCount = rounds.flat().filter((m) => m.finished).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={autofill}
          className="bg-(--color-accent) px-4 py-2 text-xs font-bold uppercase tracking-wide text-(--color-ink) transition hover:brightness-95"
        >
          Isi Otomatis
        </button>
        <button
          onClick={() => persist({})}
          className="border border-(--color-line) px-4 py-2 text-xs font-bold uppercase tracking-wide text-(--color-muted) transition hover:text-(--color-fg)"
        >
          Hapus Semua Pilihan
        </button>
        {loaded && (
          <span className="text-xs text-(--color-muted)">
            Hasil {finishedCount} laga sudah terkunci dari lapangan — klik nama tim di laga lain
            untuk memilih pemenangnya.
          </span>
        )}
      </div>

      {champion?.name && (
        <div className="card mb-6 flex items-center gap-4 border-l-[3px] border-l-(--color-accent) p-4">
          <span className="display text-3xl text-(--color-accent)">🏆</span>
          <div>
            <div className="overline">{championReal ? "Juara Dunia 2026" : "Juara Pilihanmu"}</div>
            <div className="display text-3xl">{champion.name}</div>
          </div>
          <Crest src={champion.crest} name={champion.name} size={40} />
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex min-h-[640px] gap-4" style={{ minWidth: rounds.length * 210 }}>
          {rounds.map((round, r) => (
            <div key={r} className="flex flex-1 flex-col" style={{ minWidth: 195 }}>
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-(--color-muted)">
                <span className="h-px flex-none bg-(--color-fg)" style={{ width: 14 }} />
                {titles[r]}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {round.map((m, i) => {
                  const { home, away } = resolved[r][i];
                  const decided = m.finished && m.winner ? m.winner : picks[`${r}-${i}`];
                  return (
                    <div key={m.id} className="card overflow-hidden">
                      <KoRow team={home} score={m.scoreHome} locked={m.finished} chosen={decided} onPick={(t) => pick(r, i, t)} />
                      <div className="h-px bg-(--color-line)" />
                      <KoRow team={away} score={m.scoreAway} locked={m.finished} chosen={decided} onPick={(t) => pick(r, i, t)} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {ko.thirdPlace && (
        <div className="card mt-2 flex items-center gap-4 p-4">
          <div className="overline flex-none">Perebutan Peringkat 3</div>
          <div className="flex items-center gap-2 text-sm">
            <ThirdSide side={ko.thirdPlace.home} />
            <span className="text-(--color-muted)">
              {ko.thirdPlace.scoreHome !== null && ko.thirdPlace.scoreAway !== null
                ? `${ko.thirdPlace.scoreHome} – ${ko.thirdPlace.scoreAway}`
                : "vs"}
            </span>
            <ThirdSide side={ko.thirdPlace.away} />
          </div>
        </div>
      )}

      <p className="mt-2 text-xs text-(--color-muted)">
        Pasangan laga dan hasil diambil dari data resmi turnamen; laga tanpa jangkar hasil disusun
        sesuai jadwal dan terkoreksi otomatis begitu babak sebelumnya selesai.
      </p>
    </div>
  );
}

function ThirdSide({ side }: { side: KoSide }) {
  if (!side.name) return <span className="italic text-(--color-muted)">Kalah semifinal</span>;
  return (
    <span className="flex items-center gap-1.5">
      <Crest src={side.crest} name={side.name} size={18} />
      <span className="text-[13px] font-medium">{side.name}</span>
    </span>
  );
}

function KoRow({
  team, score, locked, chosen, onPick,
}: {
  team: KoSide | null;
  score: number | null;
  locked: boolean;
  chosen?: string | null;
  onPick: (t: string) => void;
}) {
  if (!team?.name)
    return (
      <div className="flex h-[42px] items-center px-3 text-xs italic text-(--color-muted)/70">
        Menunggu pemenang babak sebelumnya
      </div>
    );
  const selected = chosen === team.name;
  const dimmed = !!chosen && !selected;
  return (
    <button
      onClick={() => !locked && onPick(team.name!)}
      disabled={locked}
      className={`flex h-[42px] w-full items-center gap-2 px-3 text-left transition ${
        selected
          ? "bg-(--color-accent)/15 text-(--color-fg)"
          : dimmed
          ? "text-(--color-muted)"
          : "text-(--color-fg)"
      } ${locked ? "cursor-default" : "hover:bg-(--color-surface-2)"}`}
    >
      <span className={`w-[3px] self-stretch ${selected ? "bg-(--color-accent)" : "bg-transparent"}`} />
      <Crest src={team.crest} name={team.name} size={18} />
      <span className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${selected ? "font-semibold" : "font-medium"}`}>
        {team.name}
      </span>
      {score !== null && locked && (
        <span className={`text-[13px] font-bold ${selected ? "text-(--color-accent)" : "text-(--color-muted)"}`}>
          {score}
        </span>
      )}
      {selected && (
        <span className="text-[10px] font-bold uppercase text-(--color-accent)">
          {locked ? "menang" : "lolos"}
        </span>
      )}
    </button>
  );
}

// ===========================================================================
//  Mode proyeksi (fase grup masih berjalan / undian gugur belum keluar):
//  susunan diproyeksikan dari klasemen grup saat ini, semua pilihan bebas.
// ===========================================================================
const KEY = "wc26-bracket";
const ROUND_TITLES = ["32 Besar", "16 Besar", "Perempat Final", "Semifinal", "Final"];

function ProjectedView({ matches }: { matches: Match[] }) {
  const seeds = useMemo(() => projectedSeeds(matches), [matches]);
  const rounds = seeds.length ? Math.log2(nearestPow2(seeds.length)) : 0;
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setPicks(JSON.parse(localStorage.getItem(KEY) || "{}"));
    } catch {}
    setLoaded(true);
  }, []);

  const persist = (p: Picks) => {
    setPicks(p);
    localStorage.setItem(KEY, JSON.stringify(p));
  };

  // Peserta tiap ronde: ronde 0 = seeds; berikutnya = pemenang ronde sebelumnya
  const participants: (SeedTeam | null)[][] = [];
  participants[0] = seeds;
  for (let r = 1; r < rounds; r++) {
    const prev = participants[r - 1];
    const arr: (SeedTeam | null)[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const winner = picks[`${r - 1}-${i / 2}`];
      arr.push(seeds.find((s) => s.team === winner) ?? null);
    }
    participants[r] = arr;
  }

  const pick = (r: number, matchIdx: number, team: string) => {
    const next: Picks = {};
    // pertahankan pilihan ronde <= r kecuali yang diubah; buang ronde setelahnya
    for (const [k, v] of Object.entries(picks)) {
      const rr = Number(k.split("-")[0]);
      if (rr < r) next[k] = v;
      else if (rr === r && k !== `${r}-${matchIdx}`) next[k] = v;
    }
    next[`${r}-${matchIdx}`] = team;
    persist(next);
  };

  const autofill = () => {
    const next: Picks = {};
    const cur: (SeedTeam | null)[][] = [seeds];
    for (let r = 0; r < rounds; r++) {
      const parts = cur[r];
      const winners: (SeedTeam | null)[] = [];
      for (let i = 0; i < parts.length; i += 2) {
        const a = parts[i], b = parts[i + 1];
        const w = !b ? a : !a ? b : a.rating >= b.rating ? a : b;
        if (w) next[`${r}-${i / 2}`] = w.team;
        winners.push(w ?? null);
      }
      cur[r + 1] = winners;
    }
    persist(next);
  };

  const champion = rounds ? seeds.find((s) => s.team === picks[`${rounds - 1}-0`]) : undefined;

  if (!seeds.length)
    return (
      <div className="card p-10 text-center text-(--color-muted)">
        Bracket akan tersedia setelah data fase grup termuat.
      </div>
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={autofill}
          className="bg-(--color-accent) px-4 py-2 text-xs font-bold uppercase tracking-wide text-(--color-ink) transition hover:brightness-95"
        >
          Isi Otomatis
        </button>
        <button
          onClick={() => persist({})}
          className="border border-(--color-line) px-4 py-2 text-xs font-bold uppercase tracking-wide text-(--color-muted) transition hover:text-(--color-fg)"
        >
          Hapus Semua Pilihan
        </button>
        {loaded && (
          <span className="text-xs text-(--color-muted)">
            Klik nama tim untuk memilihnya sebagai pemenang. Pilihan tersimpan otomatis.
          </span>
        )}
      </div>

      {champion && (
        <div className="card mb-6 flex items-center gap-4 border-l-[3px] border-l-(--color-accent) p-4">
          <span className="display text-3xl text-(--color-accent)">🏆</span>
          <div>
            <div className="overline">Juara Pilihanmu</div>
            <div className="display text-3xl">{champion.team}</div>
          </div>
          <Crest src={champion.crest} name={champion.team} size={40} />
        </div>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="flex min-h-[640px] gap-4" style={{ minWidth: rounds * 210 }}>
          {Array.from({ length: rounds }).map((_, r) => {
            const parts = participants[r] ?? [];
            const matchCount = Math.floor(parts.length / 2);
            return (
              <div key={r} className="flex flex-1 flex-col" style={{ minWidth: 195 }}>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-(--color-muted)">
                  <span className="h-px flex-none bg-(--color-fg)" style={{ width: 14 }} />
                  {ROUND_TITLES[r] ?? `Ronde ${r + 1}`}
                </div>
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {Array.from({ length: matchCount }).map((_, i) => {
                    const a = parts[2 * i], b = parts[2 * i + 1];
                    const chosen = picks[`${r}-${i}`];
                    return (
                      <div key={i} className="card overflow-hidden">
                        <SeedRow team={a} chosen={chosen} showLabel={r === 0} onPick={(t) => pick(r, i, t)} />
                        <div className="h-px bg-(--color-line)" />
                        <SeedRow team={b} chosen={chosen} showLabel={r === 0} onPick={(t) => pick(r, i, t)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-xs text-(--color-muted)">
        Susunan tim di bracket ini diproyeksikan dari klasemen grup saat ini — bukan undian resmi FIFA.
      </p>
    </div>
  );
}

function SeedRow({
  team, chosen, showLabel, onPick,
}: {
  team: SeedTeam | null; chosen?: string; showLabel: boolean; onPick: (t: string) => void;
}) {
  if (!team)
    return (
      <div className="flex h-[42px] items-center px-3 text-xs italic text-(--color-muted)/70">
        Menunggu pemenang babak sebelumnya
      </div>
    );
  const selected = chosen === team.team;
  const dimmed = chosen && !selected;
  return (
    <button
      onClick={() => onPick(team.team)}
      className={`flex h-[42px] w-full items-center gap-2 px-3 text-left transition ${
        selected
          ? "bg-(--color-accent)/15 text-(--color-fg)"
          : dimmed
          ? "text-(--color-muted) hover:bg-(--color-surface-2)"
          : "text-(--color-fg) hover:bg-(--color-surface-2)"
      }`}
    >
      <span className={`w-[3px] self-stretch ${selected ? "bg-(--color-accent)" : "bg-transparent"}`} />
      <Crest src={team.crest} name={team.team} size={18} />
      <span className="min-w-0 flex-1 truncate">
        <span className="block truncate text-[13px] font-medium leading-tight">{team.team}</span>
        {showLabel && <span className="block text-[11px] text-(--color-muted)">{team.label}</span>}
      </span>
      {selected && <span className="text-[10px] font-bold uppercase text-(--color-accent)">lolos</span>}
    </button>
  );
}

function nearestPow2(n: number) {
  let s = 1;
  while (s * 2 <= n) s *= 2;
  return s;
}
