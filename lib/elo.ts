import { Match } from "./types";
import { ratingOf } from "./prediction";
import { isRealTeam } from "./simulate";

// ===========================================================================
//  Rating Elo live
//  - Seed dari rating statis pra-turnamen (skala 0-100 -> skala Elo)
//  - Ter-update kronologis dari setiap laga yang sudah selesai
//  - Snapshot Elo PRA-laga disimpan per match (dipakai modul akurasi & upset)
// ===========================================================================

const BASE = 1000;
const SCALE = 10; // rating 0-100 -> Elo 1000-2000
const K = 60; // bobot Piala Dunia (World Football Elo)

export interface EloEntry {
  team: string;
  crest?: string;
  elo: number;
  seedElo: number;
  delta: number; // elo - seedElo
  played: number;
  rank: number;
  seedRank: number;
  rankChange: number; // positif = naik dibanding peringkat seed
}

export interface EloHistoryPoint {
  label: string; // "Awal" | "MD 1" | "16 Besar" | tanggal
  date: string; // ISO
  elo: number;
}

export interface EloResult {
  table: EloEntry[]; // urut elo tertinggi
  history: Record<string, EloHistoryPoint[]>; // per tim, titik pertama = seed
  preMatch: Record<string, { home: number; away: number }>; // Elo SEBELUM laga, key = match.id
  updatedMatches: number;
}

export function eloToRating(elo: number): number {
  return (elo - BASE) / SCALE;
}

function seedElo(team: string): number {
  return BASE + ratingOf(team) * SCALE;
}

const STAGE_LABEL: Record<string, string> = {
  ROUND_OF_32: "32 Besar",
  LAST_32: "32 Besar",
  ROUND_OF_16: "16 Besar",
  LAST_16: "16 Besar",
  QUARTER_FINALS: "Perempat Final",
  SEMI_FINALS: "Semifinal",
  THIRD_PLACE: "Peringkat 3",
  FINAL: "Final",
};

function pointLabel(m: Match): string {
  if (m.stage === "GROUP_STAGE" && m.matchday) return `MD ${m.matchday}`;
  if (STAGE_LABEL[m.stage]) return STAGE_LABEL[m.stage];
  return new Date(m.utcDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function computeElo(matches: Match[]): EloResult {
  const real = matches.filter((m) => isRealTeam(m.home.name) && isRealTeam(m.away.name));
  const finished = real
    .filter((m) => m.status === "FINISHED" && m.score.home !== null && m.score.away !== null)
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  const elo = new Map<string, number>();
  const crest = new Map<string, string | undefined>();
  const played = new Map<string, number>();
  const history: Record<string, EloHistoryPoint[]> = {};
  const firstDate = matches[0]?.utcDate ?? new Date(0).toISOString();

  const ensure = (team: string, teamCrest?: string) => {
    if (!elo.has(team)) {
      const seed = seedElo(team);
      elo.set(team, seed);
      played.set(team, 0);
      history[team] = [{ label: "Awal", date: firstDate, elo: seed }];
    }
    if (teamCrest && !crest.get(team)) crest.set(team, teamCrest);
    return elo.get(team)!;
  };

  // daftarkan semua tim nyata (termasuk yang belum main) agar tabel lengkap
  for (const m of real) {
    ensure(m.home.name, m.home.crest);
    ensure(m.away.name, m.away.crest);
  }

  const preMatch: EloResult["preMatch"] = {};

  for (const m of finished) {
    const home = m.home.name, away = m.away.name;
    const ra = ensure(home, m.home.crest);
    const rb = ensure(away, m.away.crest);
    preMatch[m.id] = { home: ra, away: rb };

    const hg = m.score.home!, ag = m.score.away!;
    // hasil dari sisi tuan rumah; seri di fase gugur (menang penalti) = 0.5
    const w = hg > ag ? 1 : hg < ag ? 0 : 0.5;
    const we = 1 / (1 + Math.pow(10, (rb - ra) / 400));
    const margin = Math.abs(hg - ag);
    const g = margin <= 1 ? 1 : margin === 2 ? 1.5 : (11 + margin) / 8;
    const change = K * g * (w - we);

    elo.set(home, ra + change);
    elo.set(away, rb - change);
    played.set(home, played.get(home)! + 1);
    played.set(away, played.get(away)! + 1);
    const label = pointLabel(m);
    history[home].push({ label, date: m.utcDate, elo: ra + change });
    history[away].push({ label, date: m.utcDate, elo: rb - change });
  }

  const teams = [...elo.keys()];
  const seedSorted = [...teams].sort((a, b) => seedElo(b) - seedElo(a));
  const seedRank = new Map(seedSorted.map((t, i) => [t, i + 1]));

  const table: EloEntry[] = teams
    .map((team) => ({
      team,
      crest: crest.get(team),
      elo: Math.round(elo.get(team)!),
      seedElo: Math.round(seedElo(team)),
      delta: Math.round(elo.get(team)! - seedElo(team)),
      played: played.get(team)!,
      rank: 0,
      seedRank: seedRank.get(team)!,
      rankChange: 0,
    }))
    .sort((a, b) => b.elo - a.elo || a.team.localeCompare(b.team));
  table.forEach((e, i) => {
    e.rank = i + 1;
    e.rankChange = e.seedRank - e.rank;
  });

  return { table, history, preMatch, updatedMatches: finished.length };
}

// Rating skala 0-100 terkini (untuk di-inject ke predict()/runSimulations()).
// Tanpa laga selesai, hasilnya identik dengan rating statis pra-turnamen.
export function liveRatings(matches: Match[]): Record<string, number> {
  const { table } = computeElo(matches);
  const out: Record<string, number> = {};
  for (const e of table) out[e.team] = eloToRating(e.elo);
  return out;
}
