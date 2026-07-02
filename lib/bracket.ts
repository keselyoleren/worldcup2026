import { Match } from "./types";

// ===========================================================================
//  Bracket fase gugur dari data pertandingan RESMI
//  - Tiap ronde disusun ulang agar feeder sejajar: pemenang rounds[k][2i] dan
//    rounds[k][2i+1] bertemu di rounds[k+1][i]
//  - Penjajaran memakai jangkar tim yang sudah diketahui di ronde berikutnya
//    (mis. "Canada vs Morocco" di 16 Besar -> laga 32 Besar yang dimenangkan
//    Canada ditaruh di slot feeder home). Laga yang belum ada jangkarnya
//    diisi berurutan sesuai jadwal — otomatis terkoreksi begitu ada hasil.
// ===========================================================================

export interface KoSide {
  name: string | null;
  crest?: string;
}

export interface KoMatch {
  id: string;
  utcDate: string;
  home: KoSide;
  away: KoSide;
  scoreHome: number | null;
  scoreAway: number | null;
  finished: boolean;
  winner: string | null; // nama tim pemenang (hanya laga selesai)
}

export interface KnockoutBracket {
  rounds: KoMatch[][]; // urut ronde awal -> final
  titles: string[]; // judul tiap ronde, paralel dengan rounds
  thirdPlace: KoMatch | null;
}

const STAGES: { keys: string[]; title: string }[] = [
  { keys: ["LAST_32", "ROUND_OF_32"], title: "32 Besar" },
  { keys: ["LAST_16", "ROUND_OF_16"], title: "16 Besar" },
  { keys: ["QUARTER_FINALS"], title: "Perempat Final" },
  { keys: ["SEMI_FINALS"], title: "Semifinal" },
  { keys: ["FINAL"], title: "Final" },
];

// duplikat kecil dari lib/simulate agar tidak impor melingkar
function isReal(name: string) {
  return !!name && name !== "TBD" && !/^[WL]\d/.test(name);
}

function toKo(m: Match): KoMatch {
  const home: KoSide = isReal(m.home.name) ? { name: m.home.name, crest: m.home.crest } : { name: null };
  const away: KoSide = isReal(m.away.name) ? { name: m.away.name, crest: m.away.crest } : { name: null };
  let winner: string | null = null;
  let finished = m.status === "FINISHED";
  if (finished) {
    if (m.score.winner === "HOME") winner = home.name;
    else if (m.score.winner === "AWAY") winner = away.name;
    else if (m.score.home !== null && m.score.away !== null && m.score.home !== m.score.away)
      winner = m.score.home > m.score.away ? home.name : away.name;
    // seri tanpa info pemenang penalti -> anggap belum terputuskan
    if (!winner) finished = false;
  }
  return {
    id: m.id,
    utcDate: m.utcDate,
    home,
    away,
    scoreHome: m.score.home,
    scoreAway: m.score.away,
    finished,
    winner,
  };
}

const byDate = (a: KoMatch, b: KoMatch) => a.utcDate.localeCompare(b.utcDate) || a.id.localeCompare(b.id);

// Susun ulang `pool` (ronde k) agar sejajar dengan `next` (ronde k+1):
// feeder home laga next[i] -> slot 2i, feeder away -> slot 2i+1.
function arrangeFeeders(pool: KoMatch[], next: KoMatch[]): KoMatch[] {
  const placed: (KoMatch | null)[] = new Array(pool.length).fill(null);
  const used = new Set<string>();
  next.forEach((nm, i) => {
    const anchors: [string | null, number][] = [
      [nm.home.name, 2 * i],
      [nm.away.name, 2 * i + 1],
    ];
    for (const [name, slot] of anchors) {
      if (!name || slot >= placed.length || placed[slot]) continue;
      const feeder = pool.find((p) => !used.has(p.id) && p.winner === name);
      if (feeder) {
        placed[slot] = feeder;
        used.add(feeder.id);
      }
    }
  });
  const rest = pool.filter((p) => !used.has(p.id));
  let j = 0;
  for (let s = 0; s < placed.length && j < rest.length; s++) if (!placed[s]) placed[s] = rest[j++];
  return placed.filter(Boolean) as KoMatch[];
}

// null bila undian fase gugur belum keluar (semua slot masih TBD)
export function buildKnockoutBracket(matches: Match[]): KnockoutBracket | null {
  const byStage = STAGES.map((s) =>
    matches.filter((m) => s.keys.includes(m.stage)).map(toKo).sort(byDate)
  );

  let start = 0;
  while (start < byStage.length && byStage[start].length === 0) start++;
  const rounds = byStage.slice(start);
  const titles = STAGES.slice(start).map((s) => s.title);
  if (!rounds.length || rounds[0].length < 2) return null;
  if (!rounds[0].some((m) => m.home.name || m.away.name)) return null;

  for (let k = rounds.length - 1; k > 0; k--) {
    rounds[k - 1] = arrangeFeeders(rounds[k - 1], rounds[k]);
  }

  const thirdPlace = matches
    .filter((m) => m.stage === "THIRD_PLACE")
    .map(toKo)
    .sort(byDate)[0] ?? null;

  return { rounds, titles, thirdPlace };
}
