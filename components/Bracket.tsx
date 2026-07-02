"use client";

import { useEffect, useMemo, useState } from "react";
import { Match } from "@/lib/types";
import { projectedSeeds, SeedTeam } from "@/lib/simulate";
import { Crest } from "./ui";

const KEY = "wc26-bracket";
const ROUND_TITLES = ["32 Besar", "16 Besar", "Perempat Final", "Semifinal", "Final"];

type Picks = Record<string, string>; // "round-matchIndex" -> nama tim

export function Bracket({ matches }: { matches: Match[] }) {
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
