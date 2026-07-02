import { Match, Scorer } from "./types";
import { expectedGoals, ratingOf, scoreMatrix, winExpectancy } from "./prediction";
import { buildKnockoutBracket, KnockoutBracket } from "./bracket";

// ===========================================================================
//  Mesin prediksi juara (proyeksi turnamen Monte Carlo)
//  - Hasil pertandingan fase grup yang SUDAH selesai dikunci (dipakai apa adanya)
//  - Sisa laga grup + seluruh fase gugur diproyeksikan dari matriks skor
//    Poisson Dixon-Coles (lib/prediction.ts), bukan Poisson independen
//  - Laga gugur yang imbang dilanjutkan perpanjangan waktu, lalu adu penalti
//    (hampir 50-50, sedikit condong ke tim lebih kuat)
//  - RNG deterministik (mulberry32) -> hasil stabil & reprodusibel antar render
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
  // laga fase grup yang belum selesai (perlu diproyeksikan)
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

// --- RNG deterministik (mulberry32) ---
type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Sampler Poisson (Knuth) — dipakai untuk babak perpanjangan waktu ---
function samplePoisson(lambda: number, rng: Rng): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

// Sampler skor dari matriks Dixon-Coles, CDF di-cache per pasangan tim
// (rating tetap selama satu run, jadi matriks cukup dihitung sekali).
type ScoreSampler = (home: string, away: string) => [number, number];
function makeSampler(ratings: Record<string, number> | undefined, rng: Rng): ScoreSampler {
  const cache = new Map<string, { cdf: number[]; side: number }>();
  return (home, away) => {
    const key = `${home}::${away}`;
    let e = cache.get(key);
    if (!e) {
      const { matrix } = scoreMatrix(home, away, ratings);
      const side = matrix.length;
      const cdf: number[] = [];
      let acc = 0;
      for (let h = 0; h < side; h++)
        for (let a = 0; a < side; a++) {
          acc += matrix[h][a];
          cdf.push(acc);
        }
      e = { cdf, side };
      cache.set(key, e);
    }
    const r = rng() * e.cdf[e.cdf.length - 1];
    let lo = 0, hi = e.cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (e.cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    return [Math.floor(lo / e.side), lo % e.side];
  };
}

// Pemenang fase gugur: 90 menit -> perpanjangan waktu -> adu penalti.
function knockoutWinner(
  a: string,
  b: string,
  sample: ScoreSampler,
  rng: Rng,
  ratings?: Record<string, number>
): string {
  const [ga, gb] = sample(a, b);
  if (ga > gb) return a;
  if (gb > ga) return b;
  // perpanjangan waktu 2x15 menit ≈ sepertiga intensitas laga normal
  const [lh, la] = expectedGoals(a, b, ratings);
  const ea = samplePoisson(lh / 3, rng);
  const eb = samplePoisson(la / 3, rng);
  if (ea > eb) return a;
  if (eb > ea) return b;
  // adu penalti: hampir koin, sedikit condong ke tim lebih kuat
  const we = winExpectancy(a, b, ratings);
  return rng() < 0.5 + (we - 0.5) * 0.35 ? a : b;
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

// --- Perekam jalur: siapa-lawan-siapa per ronde di tiap proyeksi ---
// team -> judul ronde -> { berapa kali sampai, berapa kali menang, lawan }
type RoundStat = { reach: number; win: number; opp: Map<string, { meet: number; win: number }> };
type PathTally = Map<string, Map<string, RoundStat>>;

const SIZE_TITLE: Record<number, string> = {
  32: "32 Besar",
  16: "16 Besar",
  8: "Perempat Final",
  4: "Semifinal",
  2: "Final",
};

// --- Perekam jumlah laga TERSISA tiap tim per iterasi (untuk Sepatu Emas) ---
// Uint16Array per tim, indeks = nomor iterasi -> korelasi antar tim terjaga
// (mis. dua tim yang bertemu di final sama-sama tercatat main di iterasi itu).
type GamesRec = { byTeam: Map<string, Uint16Array>; i: number; iterations: number };
function bumpGame(rec: GamesRec, team: string) {
  let arr = rec.byTeam.get(team);
  if (!arr) rec.byTeam.set(team, (arr = new Uint16Array(rec.iterations)));
  arr[rec.i]++;
}

function recordPath(paths: PathTally, title: string, a: string, b: string, winner: string) {
  for (const [me, opp] of [[a, b], [b, a]] as const) {
    let byRound = paths.get(me);
    if (!byRound) paths.set(me, (byRound = new Map()));
    let st = byRound.get(title);
    if (!st) byRound.set(title, (st = { reach: 0, win: 0, opp: new Map() }));
    st.reach++;
    let o = st.opp.get(opp);
    if (!o) st.opp.set(opp, (o = { meet: 0, win: 0 }));
    o.meet++;
    if (winner === me) {
      st.win++;
      o.win++;
    }
  }
}

// --- Satu proyeksi turnamen penuh -> update tally ---
function simulateOnce(
  groups: GroupModel[],
  tally: Map<string, Tally>,
  sample: ScoreSampler,
  rng: Rng,
  ratings?: Record<string, number>,
  paths?: PathTally,
  games?: GamesRec
) {
  const firsts: GroupTeam[] = [];
  const seconds: GroupTeam[] = [];
  const thirds: (GroupTeam & { pts: number; gd: number; gf: number })[] = [];

  for (const g of groups) {
    const s = new Map<string, { t: GroupTeam; pts: number; gd: number; gf: number }>();
    for (const t of g.teams) s.set(t.team, { t, pts: t.basePts, gd: t.baseGd, gf: t.baseGf });
    for (const p of g.pending) {
      if (games) { bumpGame(games, p.home); bumpGame(games, p.away); }
      const [hg, ag] = sample(p.home, p.away);
      const H = s.get(p.home)!, A = s.get(p.away)!;
      H.gf += hg; A.gf += ag; H.gd += hg - ag; A.gd += ag - hg;
      if (hg > ag) H.pts += 3;
      else if (ag > hg) A.pts += 3;
      else { H.pts += 1; A.pts += 1; }
    }
    const ranked = [...s.values()].sort(
      (x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || rng() - 0.5
    );
    if (ranked[0]) firsts.push(ranked[0].t);
    if (ranked[1]) seconds.push(ranked[1].t);
    if (ranked[2]) thirds.push({ ...ranked[2].t, pts: ranked[2].pts, gd: ranked[2].gd, gf: ranked[2].gf });
  }

  // 8 peringkat-3 terbaik ikut lolos (format 48 tim -> 32 besar)
  thirds.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || rng() - 0.5);
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
    const title = SIZE_TITLE[bracket.length];
    const winners: GroupTeam[] = [];
    for (let i = 0; i < bracket.length; i += 2) {
      const a = bracket[i], b = bracket[i + 1];
      if (!b) { winners.push(a); continue; }
      if (games) { bumpGame(games, a.team); bumpGame(games, b.team); }
      const w = knockoutWinner(a.team, b.team, sample, rng, ratings) === a.team ? a : b;
      if (paths && title) recordPath(paths, title, a.team, b.team, w.team);
      winners.push(w);
    }
    const remaining = winners.length; // tim yang lolos ke ronde berikut
    // milestone dicatat sekali per ronde: lolos ke QF saat tersisa 8 tim, dst.
    if (remaining === 8) for (const w of winners) tally.get(w.team)!.quarter++;
    bracket = winners;
    if (remaining === 4) for (const w of winners) tally.get(w.team)!.semi++;
    if (remaining === 2) for (const w of winners) tally.get(w.team)!.final++;
    if (remaining === 1) tally.get(winners[0].team)!.champion++;
  }
}

// --- Satu proyeksi dari bracket fase gugur RESMI -> update tally ---
// Hasil laga gugur yang sudah selesai dikunci; laga dengan pasangan yang
// sudah diketahui (atau terisi dari pemenang proyeksi) disimulasikan.
const ROUND_MILESTONE: Record<string, "quarter" | "semi" | "final"> = {
  "Perempat Final": "quarter",
  Semifinal: "semi",
  Final: "final",
};

function simulateKnockoutOnce(
  ko: KnockoutBracket,
  tally: Map<string, Tally>,
  sample: ScoreSampler,
  rng: Rng,
  ratings?: Record<string, number>,
  paths?: PathTally,
  games?: GamesRec
) {
  const bump = (team: string | null, field: keyof Omit<Tally, "team" | "crest">) => {
    if (!team) return;
    const rec = tally.get(team);
    if (rec) rec[field]++;
  };

  // milestone ronde yang sudah terlewati sebelum ronde pertama data
  const passed: ("quarter" | "semi" | "final")[] = [];
  const allTitles = ["32 Besar", "16 Besar", "Perempat Final", "Semifinal", "Final"];
  for (const t of allTitles.slice(0, allTitles.indexOf(ko.titles[0]))) {
    if (ROUND_MILESTONE[t]) passed.push(ROUND_MILESTONE[t]);
  }

  let carry: (string | null)[] = []; // pemenang ronde sebelumnya, urut slot
  for (let k = 0; k < ko.rounds.length; k++) {
    const round = ko.rounds[k];
    const milestone = ROUND_MILESTONE[ko.titles[k]];
    const winners: (string | null)[] = [];

    for (let i = 0; i < round.length; i++) {
      const m = round[i];
      const home = m.home.name ?? carry[2 * i] ?? null;
      const away = m.away.name ?? carry[2 * i + 1] ?? null;

      // peserta ronde ini mencapai milestone ronde tsb (dan, untuk ronde
      // pertama, semua milestone sebelumnya + lolos fase grup)
      for (const t of [home, away]) {
        if (milestone) bump(t, milestone);
        if (k === 0) {
          bump(t, "advance");
          for (const p of passed) bump(t, p);
        }
      }

      let w: string | null;
      if (m.finished && m.winner) w = m.winner;
      else if (home && away) {
        if (games) { bumpGame(games, home); bumpGame(games, away); }
        w = knockoutWinner(home, away, sample, rng, ratings);
      } else w = home ?? away; // slot lawan belum diketahui -> lolos sementara
      if (paths && home && away && w) recordPath(paths, ko.titles[k], home, away, w);
      winners.push(w);
    }

    if (ko.titles[k] === "Final") bump(winners[0], "champion");
    carry = winners;
  }
}

// --- Inti: jalankan N proyeksi dengan seed tetap -> peluang tiap tim ---
function runCore(
  matches: Match[],
  iterations: number,
  ratings: Record<string, number> | undefined,
  seed: number,
  paths?: PathTally,
  games?: GamesRec
): TeamOdds[] {
  const groups = buildGroups(matches);
  const tally = makeTally(groups);
  const rng = mulberry32(seed);
  const sample = makeSampler(ratings, rng);

  // Begitu undian fase gugur resmi keluar, proyeksi memakai bracket asli
  // (hasil laga gugur yang selesai dikunci). Sebelum itu, fase gugur
  // diproyeksikan dari klasemen grup.
  const ko = buildKnockoutBracket(matches);
  if (ko) {
    for (const m of ko.rounds.flat())
      for (const s of [m.home, m.away])
        if (s.name && !tally.has(s.name))
          tally.set(s.name, { team: s.name, crest: s.crest, advance: 0, quarter: 0, semi: 0, final: 0, champion: 0 });
    for (let i = 0; i < iterations; i++) {
      if (games) games.i = i;
      simulateKnockoutOnce(ko, tally, sample, rng, ratings, paths, games);
    }
  } else {
    for (let i = 0; i < iterations; i++) {
      if (games) games.i = i;
      simulateOnce(groups, tally, sample, rng, ratings, paths, games);
    }
  }
  return toOdds(tally, iterations, ratings);
}

// ===========================================================================
//  Perburuan Sepatu Emas: proyeksi gol akhir tiap pencetak gol.
//  Jumlah laga tersisa tiap tim diambil per-iterasi dari proyeksi turnamen
//  yang sama (korelasi antar tim terjaga), lalu gol tambahan pemain di-sample
//  Poisson dari laju golnya (dengan shrinkage agar sampel kecil tidak liar).
// ===========================================================================
export interface GoldenBootEntry {
  name: string;
  team: string;
  teamCrest?: string;
  goals: number;
  assists: number;
  played: number;
  rate: number; // laju gol per laga terkalibrasi
  expMatches: number; // ekspektasi jumlah laga tersisa timnya
  expFinal: number; // ekspektasi gol di akhir turnamen
  winProb: number; // % memenangi Sepatu Emas
  teamAlive: boolean;
}

export function predictGoldenBoot(
  matches: Match[],
  scorers: Scorer[],
  ratings?: Record<string, number>,
  iterations = 10000
): GoldenBootEntry[] {
  if (!scorers.length) return [];
  const games: GamesRec = { byTeam: new Map(), i: 0, iterations };
  runCore(matches, iterations, ratings, 0x2026_0611, undefined, games);

  // kandidat realistis: 20 pencetak gol teratas
  const candidates = scorers.slice(0, 20);
  const rng = mulberry32(0xb007);

  // shrinkage: laju gol ditarik ke rata-rata penyerang (0.35 gol/laga, bobot
  // setara 3 laga) agar pemain dengan sedikit laga tidak diproyeksikan liar
  const PRIOR_GAMES = 3;
  const PRIOR_RATE = 0.35;
  const rates = candidates.map(
    (s) => (s.goals + PRIOR_RATE * PRIOR_GAMES) / (Math.max(s.played, 1) + PRIOR_GAMES)
  );

  const wins = new Array(candidates.length).fill(0);
  const sumFinal = new Array(candidates.length).fill(0);
  const sumMatches = new Array(candidates.length).fill(0);

  for (let i = 0; i < iterations; i++) {
    let best = -1;
    let bestGoals = -1;
    let bestAssists = -1;
    for (let c = 0; c < candidates.length; c++) {
      const s = candidates[c];
      const n = games.byTeam.get(s.team)?.[i] ?? 0;
      const add = n > 0 ? samplePoisson(rates[c] * n, rng) : 0;
      const total = s.goals + add;
      sumFinal[c] += total;
      sumMatches[c] += n;
      // tie-break Sepatu Emas: gol, lalu assist (posisi teratas menang sisanya)
      if (total > bestGoals || (total === bestGoals && s.assists > bestAssists)) {
        best = c;
        bestGoals = total;
        bestAssists = s.assists;
      }
    }
    if (best >= 0) wins[best]++;
  }

  return candidates
    .map((s, c) => ({
      name: s.name,
      team: s.team,
      teamCrest: s.teamCrest,
      goals: s.goals,
      assists: s.assists,
      played: s.played,
      rate: rates[c],
      expMatches: sumMatches[c] / iterations,
      expFinal: sumFinal[c] / iterations,
      winProb: (wins[c] / iterations) * 100,
      teamAlive: sumMatches[c] / iterations > 0.01,
    }))
    .sort((a, b) => b.winProb - a.winProb || b.goals - a.goals);
}

// ===========================================================================
//  Jalur Juara: rangkuman per tim dari proyeksi yang sama —
//  lawan paling mungkin tiap ronde, peluang lolos per gerbang, dan
//  gerbang tersulit menuju trofi.
// ===========================================================================
export interface PathOpponent {
  team: string;
  crest?: string;
  meetProb: number; // % bertemu lawan ini, dengan syarat sampai ronde tsb
  winProb: number; // % menang bila bertemu lawan ini
}
export interface PathRound {
  title: string;
  reach: number; // % proyeksi di mana tim ini tampil di ronde tsb
  winGivenReach: number; // % menang bila sampai ronde tsb
  opponents: PathOpponent[]; // maks 4, urut paling sering ditemui
}
export interface TeamPath {
  team: string;
  crest?: string;
  rating: number;
  advance: number;
  champion: number;
  eliminatedBy?: string; // terisi bila sudah kalah di laga gugur nyata
  eliminatedRound?: string;
  hardest: string | null; // ronde tersisa dengan peluang menang terkecil
  rounds: PathRound[];
}

const ROUND_SEQ = ["32 Besar", "16 Besar", "Perempat Final", "Semifinal", "Final"];

export function predictPaths(
  matches: Match[],
  ratings?: Record<string, number>,
  iterations = 10000
): TeamPath[] {
  const paths: PathTally = new Map();
  // seed sama dengan predictChampions -> angka konsisten antar halaman
  const odds = runCore(matches, iterations, ratings, 0x2026_0611, paths);
  const ko = buildKnockoutBracket(matches);
  const crestOf = new Map(odds.map((o) => [o.team, o.crest]));

  return odds
    .filter((o) => paths.has(o.team))
    .map((o) => {
      const byRound = paths.get(o.team)!;
      const rounds: PathRound[] = [];
      for (const title of ROUND_SEQ) {
        const st = byRound.get(title);
        if (!st || !st.reach) continue;
        const opponents = [...st.opp.entries()]
          .sort((x, y) => y[1].meet - x[1].meet)
          .slice(0, 4)
          .map(([team, v]) => ({
            team,
            crest: crestOf.get(team),
            meetProb: (v.meet / st.reach) * 100,
            winProb: (v.win / v.meet) * 100,
          }));
        rounds.push({
          title,
          reach: (st.reach / iterations) * 100,
          winGivenReach: (st.win / st.reach) * 100,
          opponents,
        });
      }

      // sudah tersingkir? cari kekalahan di laga gugur yang benar-benar selesai
      let eliminatedBy: string | undefined;
      let eliminatedRound: string | undefined;
      if (ko) {
        outer: for (let k = 0; k < ko.rounds.length; k++)
          for (const m of ko.rounds[k]) {
            if (!m.finished || !m.winner) continue;
            const involved = m.home.name === o.team || m.away.name === o.team;
            if (involved && m.winner !== o.team) {
              eliminatedBy = m.winner;
              eliminatedRound = ko.titles[k];
              break outer;
            }
          }
      }

      const open = rounds.filter((r) => r.winGivenReach > 0 && r.winGivenReach < 100);
      const hardest = open.length
        ? open.reduce((a, b) => (b.winGivenReach < a.winGivenReach ? b : a)).title
        : null;

      return {
        team: o.team,
        crest: o.crest,
        rating: o.rating,
        advance: o.advance,
        champion: o.champion,
        eliminatedBy,
        eliminatedRound,
        hardest,
        rounds,
      };
    });
}

// API utama halaman Prediksi Juara: proyeksi dalam jumlah besar, deterministik.
export function predictChampions(
  matches: Match[],
  ratings?: Record<string, number>,
  iterations = 10000
): TeamOdds[] {
  return runCore(matches, iterations, ratings, 0x2026_0611);
}

// Varian ringan untuk dipakai server-side lain (mis. odds peringkat-3 di
// kalkulator skenario).
export function runSimulationsSync(
  matches: Match[],
  iterations = 2000,
  ratings?: Record<string, number>
): TeamOdds[] {
  return runCore(matches, iterations, ratings, 0x5CE_A210);
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
