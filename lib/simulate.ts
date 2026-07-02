import { Match } from "./types";
import { expectedGoals, ratingOf } from "./prediction";

// ===========================================================================
//  Monte Carlo tournament simulator
//  - Hasil pertandingan fase grup yang SUDAH selesai dikunci (dipakai apa adanya)
//  - Sisa laga grup + seluruh fase gugur disimulasikan dari model Poisson
//  - Dijalankan ribuan kali untuk mengestimasi peluang tiap tim
// ===========================================================================

interface GroupTeam {
  team: string;
  crest?: string;
  // poin awal dari laga yang sudah selesai
  basePts: number;
  baseGd: number;
  baseGf: number;
}
interface GroupModel {
  name: string;
  teams: GroupTeam[];
  // laga fase grup yang belum selesai (perlu disimulasikan)
  pending: { home: string; away: string }[];
}

export interface TeamOdds {
  team: string;
  crest?: string;
  rating: number;
  advance: number; // % lolos dari grup (masuk 32 besar)
  quarter: number; // % capai perempat final
  semi: number; // % capai semifinal
  final: number; // % capai final
  champion: number; // % juara
}

export function isRealTeam(name: string) {
  return !!name && name !== "TBD" && !/^[WL]\d/.test(name);
}

// --- Bangun model grup dari data pertandingan ---
export function buildGroups(matches: Match[]): GroupModel[] {
  const groups = new Map<string, GroupModel>();
  const acc = new Map<string, GroupTeam>(); // key: group::team

  const ensureGroup = (name: string) => {
    if (!groups.has(name)) groups.set(name, { name, teams: [], pending: [] });
    return groups.get(name)!;
  };
  const ensureTeam = (group: string, team: string, crest?: string) => {
    const k = `${group}::${team}`;
    if (!acc.has(k)) {
      const gt: GroupTeam = { team, crest, basePts: 0, baseGd: 0, baseGf: 0 };
      acc.set(k, gt);
      ensureGroup(group).teams.push(gt);
    }
    return acc.get(k)!;
  };

  for (const m of matches) {
    if (!m.group || !isRealTeam(m.home.name) || !isRealTeam(m.away.name)) continue;
    const g = ensureGroup(m.group);
    const h = ensureTeam(m.group, m.home.name, m.home.crest);
    const a = ensureTeam(m.group, m.away.name, m.away.crest);
    if (m.status === "FINISHED" && m.score.home !== null && m.score.away !== null) {
      const hg = m.score.home, ag = m.score.away;
      h.baseGf += hg; a.baseGf += ag;
      h.baseGd += hg - ag; a.baseGd += ag - hg;
      if (hg > ag) h.basePts += 3;
      else if (ag > hg) a.basePts += 3;
      else { h.basePts += 1; a.basePts += 1; }
    } else {
      g.pending.push({ home: m.home.name, away: m.away.name });
    }
  }
  return [...groups.values()].filter((g) => g.teams.length >= 2).sort((x, y) => x.name.localeCompare(y.name));
}

// --- Sampler Poisson (Knuth) ---
function samplePoisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function simMatchGoals(home: string, away: string, ratings?: Record<string, number>): [number, number] {
  const [lh, la] = expectedGoals(home, away, true, ratings);
  return [samplePoisson(lh), samplePoisson(la)];
}

// pemenang fase gugur (tidak boleh seri -> adu penalti berdasar kekuatan)
function knockoutWinner(a: string, b: string, ratings?: Record<string, number>): string {
  const [ga, gb] = simMatchGoals(a, b, ratings);
  if (ga > gb) return a;
  if (gb > ga) return b;
  const ra = ratingOf(a, ratings), rb = ratingOf(b, ratings);
  return Math.random() < ra / (ra + rb) ? a : b;
}

// urutan seed bracket standar (1 & 2 bertemu paling akhir)
function seedOrder(n: number): number[] {
  let arr = [1, 2];
  const rounds = Math.log2(n);
  for (let r = 1; r < rounds; r++) {
    const sum = arr.length * 2 + 1;
    const next: number[] = [];
    for (const s of arr) {
      next.push(s);
      next.push(sum - s);
    }
    arr = next;
  }
  return arr;
}

interface Tally {
  team: string;
  crest?: string;
  advance: number;
  quarter: number;
  semi: number;
  final: number;
  champion: number;
}

export interface SimProgress {
  done: number;
  total: number;
  odds: TeamOdds[];
}

// --- Satu simulasi turnamen penuh -> update tally ---
function simulateOnce(groups: GroupModel[], tally: Map<string, Tally>, ratings?: Record<string, number>) {
  const firsts: GroupTeam[] = [];
  const seconds: GroupTeam[] = [];
  const thirds: (GroupTeam & { pts: number; gd: number; gf: number })[] = [];

  for (const g of groups) {
    const s = new Map<string, { t: GroupTeam; pts: number; gd: number; gf: number }>();
    for (const t of g.teams) s.set(t.team, { t, pts: t.basePts, gd: t.baseGd, gf: t.baseGf });
    for (const p of g.pending) {
      const [hg, ag] = simMatchGoals(p.home, p.away, ratings);
      const H = s.get(p.home)!, A = s.get(p.away)!;
      H.gf += hg; A.gf += ag; H.gd += hg - ag; A.gd += ag - hg;
      if (hg > ag) H.pts += 3;
      else if (ag > hg) A.pts += 3;
      else { H.pts += 1; A.pts += 1; }
    }
    const ranked = [...s.values()].sort(
      (x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || Math.random() - 0.5
    );
    if (ranked[0]) firsts.push(ranked[0].t);
    if (ranked[1]) seconds.push(ranked[1].t);
    if (ranked[2]) thirds.push({ ...ranked[2].t, pts: ranked[2].pts, gd: ranked[2].gd, gf: ranked[2].gf });
  }

  // 8 peringkat-3 terbaik ikut lolos (format 48 tim -> 32 besar)
  thirds.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || Math.random() - 0.5);
  const bestThirds = thirds.slice(0, 8);

  // daftar seed: juara grup > runner-up > peringkat-3, tiap tingkat diurut kekuatan
  const byRating = (a: GroupTeam, b: GroupTeam) => ratingOf(b.team, ratings) - ratingOf(a.team, ratings);
  const seeded = [
    ...firsts.sort(byRating),
    ...seconds.sort(byRating),
    ...bestThirds.sort(byRating),
  ].slice(0, 32);

  if (seeded.length < 2) return;

  // catat semua yang lolos grup
  for (const t of seeded) tally.get(t.team)!.advance++;

  // pakai kelipatan 2 terdekat (umumnya 32)
  let size = 1;
  while (size * 2 <= seeded.length) size *= 2;
  const order = seedOrder(size);
  let bracket = order.map((seed) => seeded[seed - 1]).filter(Boolean);

  // milestone berdasar jumlah tim tersisa
  while (bracket.length > 1) {
    const winners: GroupTeam[] = [];
    for (let i = 0; i < bracket.length; i += 2) {
      const a = bracket[i], b = bracket[i + 1];
      if (!b) { winners.push(a); continue; }
      const w = knockoutWinner(a.team, b.team, ratings) === a.team ? a : b;
      winners.push(w);
    }
    const remaining = winners.length; // tim yang lolos ke ronde berikut
    for (const w of winners) {
      const rec = tally.get(w.team)!;
      if (remaining <= 8) rec.quarter++; // lolos ke QF (8 besar) atau lebih jauh
    }
    bracket = winners;
    // milestone tambahan
    if (remaining === 4) for (const w of winners) tally.get(w.team)!.semi++;
    if (remaining === 2) for (const w of winners) tally.get(w.team)!.final++;
    if (remaining === 1) tally.get(winners[0].team)!.champion++;
  }
}

// --- API utama: jalankan N simulasi, panggil onProgress tiap batch ---
export function runSimulations(
  matches: Match[],
  iterations: number,
  onProgress: (p: SimProgress) => void,
  batch = 400,
  ratings?: Record<string, number>
) {
  const groups = buildGroups(matches);
  const tally = makeTally(groups);

  let done = 0;
  const step = () => {
    const end = Math.min(done + batch, iterations);
    for (; done < end; done++) simulateOnce(groups, tally, ratings);
    onProgress({ done, total: iterations, odds: toOdds(tally, done, ratings) });
    if (done < iterations) setTimeout(step, 0);
  };
  step();
}

// Varian sinkron untuk dipakai server-side (mis. odds peringkat-3 di
// kalkulator skenario) — tanpa batching setTimeout.
export function runSimulationsSync(
  matches: Match[],
  iterations = 2000,
  ratings?: Record<string, number>
): TeamOdds[] {
  const groups = buildGroups(matches);
  const tally = makeTally(groups);
  for (let i = 0; i < iterations; i++) simulateOnce(groups, tally, ratings);
  return toOdds(tally, iterations, ratings);
}

function makeTally(groups: GroupModel[]): Map<string, Tally> {
  const tally = new Map<string, Tally>();
  for (const g of groups)
    for (const t of g.teams)
      tally.set(t.team, { team: t.team, crest: t.crest, advance: 0, quarter: 0, semi: 0, final: 0, champion: 0 });
  return tally;
}

// ===========================================================================
//  Proyeksi bracket fase gugur (untuk Bracket Predictor interaktif)
//  Kualifikasi diproyeksikan dari klasemen saat ini (poin laga selesai),
//  sisanya diperingkat berdasar rating tim. Dikembalikan dalam urutan bracket
//  sehingga pasangan bersebelahan (0-1, 2-3, ...) adalah satu matchup.
// ===========================================================================
export interface SeedTeam {
  team: string;
  crest?: string;
  rating: number;
  label: string; // mis. "Grup A · 1"
}

export function projectedSeeds(matches: Match[], ratings?: Record<string, number>): SeedTeam[] {
  const groups = buildGroups(matches);
  const rankTie = (a: GroupTeam, b: GroupTeam) =>
    b.basePts - a.basePts || b.baseGd - a.baseGd || b.baseGf - a.baseGf ||
    ratingOf(b.team, ratings) - ratingOf(a.team, ratings);

  type Q = { t: GroupTeam; group: string; pos: number };
  const firsts: Q[] = [], seconds: Q[] = [], thirds: Q[] = [];
  for (const g of groups) {
    const r = [...g.teams].sort(rankTie);
    if (r[0]) firsts.push({ t: r[0], group: g.name, pos: 1 });
    if (r[1]) seconds.push({ t: r[1], group: g.name, pos: 2 });
    if (r[2]) thirds.push({ t: r[2], group: g.name, pos: 3 });
  }
  thirds.sort((x, y) => rankTie(x.t, y.t));
  const byRating = (a: Q, b: Q) => ratingOf(b.t.team, ratings) - ratingOf(a.t.team, ratings);

  const seeded = [
    ...firsts.sort(byRating),
    ...seconds.sort(byRating),
    ...thirds.slice(0, 8).sort(byRating),
  ];
  if (seeded.length < 2) return [];

  let size = 1;
  while (size * 2 <= seeded.length) size *= 2;
  const order = seedOrder(size);
  return order
    .map((seed) => seeded[seed - 1])
    .filter(Boolean)
    .map((q) => ({
      team: q.t.team,
      crest: q.t.crest,
      rating: ratingOf(q.t.team, ratings),
      label: `${q.group} · ${q.pos}`,
    }));
}

function toOdds(tally: Map<string, Tally>, n: number, ratings?: Record<string, number>): TeamOdds[] {
  const p = (v: number) => (n ? (v / n) * 100 : 0);
  return [...tally.values()]
    .map((t) => ({
      team: t.team,
      crest: t.crest,
      rating: ratingOf(t.team, ratings),
      advance: p(t.advance),
      quarter: p(t.quarter),
      semi: p(t.semi),
      final: p(t.final),
      champion: p(t.champion),
    }))
    .sort((a, b) => b.champion - a.champion || b.final - a.final || b.advance - a.advance);
}
