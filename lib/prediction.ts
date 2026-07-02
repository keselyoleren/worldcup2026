// ===========================================================================
//  Model prediksi skor — Poisson Dixon-Coles bertenaga rating Elo
//  - Kekuatan tim (0-100) di-seed dari peringkat FIFA/ekspektasi pra-turnamen,
//    bisa dioverride rating Elo live (lib/elo.ts).
//  - Expected goals diturunkan dari SELISIH Elo (bukan rasio pangkat) —
//    kalibrasi ±ELO_PER_GOAL poin Elo ≈ 1 gol keunggulan, jauh lebih stabil
//    untuk pasangan tim yang timpang.
//  - Koreksi Dixon-Coles memperbaiki probabilitas skor rendah (0-0, 1-1)
//    yang selalu di-underestimate oleh Poisson independen.
//  - Keunggulan tuan rumah hanya diberikan ke host 2026 (AS, Meksiko,
//    Kanada); laga lain dianggap venue netral.
// ===========================================================================

const TEAM_RATING: Record<string, number> = {
  Argentina: 92, France: 91, Spain: 90, England: 89, Brazil: 88,
  Portugal: 87, Netherlands: 86, Belgium: 84, Germany: 84, Italy: 83,
  Croatia: 82, Uruguay: 82, Colombia: 81, Morocco: 81, Japan: 79,
  "United States": 78, USA: 78, Mexico: 78, Switzerland: 78, Denmark: 78,
  Senegal: 77, "South Korea": 76, "Korea Republic": 76, Ecuador: 76,
  Austria: 76, Ukraine: 75, Serbia: 75, Australia: 74, Canada: 74,
  Poland: 74, Nigeria: 74, Peru: 72, Sweden: 73, Turkey: 74, "Türkiye": 74,
  Iran: 73, Egypt: 73, Norway: 76, "Ivory Coast": 73, Tunisia: 71,
  "Costa Rica": 70, Ghana: 71, Cameroon: 72, Paraguay: 71, Chile: 73,
  Panama: 68, Qatar: 68, "Saudi Arabia": 69, "South Africa": 69,
  Algeria: 74, Jordan: 66, Uzbekistan: 68, "Cape Verde": 66, "Cabo Verde": 66,
  Jamaica: 67, Honduras: 66, "New Zealand": 63, "Curaçao": 63, Curacao: 63,
  "Cape Verde Islands": 66, "Bosnia-Herzegovina": 70, "Bosnia and Herzegovina": 70,
  "Congo DR": 69, "DR Congo": 69, Haiti: 63, Iraq: 66,
  Venezuela: 70, Bolivia: 65, Greece: 74, Scotland: 73, Wales: 72,
  Hungary: 72, Romania: 71, Slovenia: 70, Slovakia: 71, Czechia: 73,
  "Czech Republic": 73, Ireland: 70,
};

const DEFAULT_RATING = 68;

// --- Kalibrasi model ---
const ELO_BASE = 1000;
const ELO_SCALE = 10; // rating 0-100 -> Elo 1000-2000 (konsisten dgn lib/elo.ts)
const TOTAL_GOALS = 2.7; // rata-rata total gol per laga turnamen besar
const ELO_PER_GOAL = 140; // selisih Elo yang setara ~1 gol keunggulan
const HOST_ELO_BONUS = 60; // keunggulan tuan rumah untuk host 2026
const RHO = -0.1; // koefisien Dixon-Coles (korelasi skor rendah)

const HOSTS = new Set(["United States", "USA", "Mexico", "Canada"]);

// ratings: override kekuatan tim (mis. rating Elo live) — tanpa override,
// dipakai tabel statis pra-turnamen.
export function ratingOf(team: string, ratings?: Record<string, number>): number {
  const t = team.trim();
  return ratings?.[t] ?? TEAM_RATING[t] ?? DEFAULT_RATING;
}

function eloOf(team: string, ratings?: Record<string, number>): number {
  return ELO_BASE + ratingOf(team, ratings) * ELO_SCALE;
}

// Probabilitas menang klasik Elo (tanpa bonus tuan rumah) — dipakai a.l.
// untuk memodelkan adu penalti.
export function winExpectancy(home: string, away: string, ratings?: Record<string, number>): number {
  const diff = eloOf(home, ratings) - eloOf(away, ratings);
  return 1 / (1 + Math.pow(10, -diff / 400));
}

// Expected goals kedua tim. Selisih Elo dipetakan linier ke selisih gol,
// total gol dijaga di sekitar rata-rata turnamen. Bonus tuan rumah otomatis
// diberikan bila tim "home" adalah negara host.
export function expectedGoals(
  home: string,
  away: string,
  ratings?: Record<string, number>
): [number, number] {
  const bonus = HOSTS.has(home.trim()) ? HOST_ELO_BONUS : 0;
  const diff = eloOf(home, ratings) + bonus - eloOf(away, ratings);
  const supremacy = diff / ELO_PER_GOAL; // perkiraan selisih gol home - away
  return [clamp(TOTAL_GOALS / 2 + supremacy / 2), clamp(TOTAL_GOALS / 2 - supremacy / 2)];
}

function poisson(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// Koreksi Dixon-Coles: menaikkan peluang 0-0 & 1-1, menurunkan 1-0 & 0-1
// (RHO negatif) — sesuai pola hasil sepak bola nyata.
function tau(h: number, a: number, lh: number, la: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * RHO;
  if (h === 0 && a === 1) return 1 + lh * RHO;
  if (h === 1 && a === 0) return 1 + la * RHO;
  if (h === 1 && a === 1) return 1 - RHO;
  return 1;
}

const MAX = 8; // grid skor 0..8 gol

// Matriks probabilitas skor ternormalisasi: matrix[golHome][golAway].
export function scoreMatrix(
  home: string,
  away: string,
  ratings?: Record<string, number>
): { matrix: number[][]; homeXg: number; awayXg: number } {
  const [lh, la] = expectedGoals(home, away, ratings);
  const matrix: number[][] = [];
  let sum = 0;
  for (let i = 0; i <= MAX; i++) {
    matrix.push([]);
    for (let j = 0; j <= MAX; j++) {
      const p = poisson(i, lh) * poisson(j, la) * tau(i, j, lh, la);
      matrix[i].push(p);
      sum += p;
    }
  }
  for (let i = 0; i <= MAX; i++) for (let j = 0; j <= MAX; j++) matrix[i][j] /= sum;
  return { matrix, homeXg: lh, awayXg: la };
}

export interface Prediction {
  homeXg: number;
  awayXg: number;
  homeWin: number; // probabilitas (0-1)
  draw: number;
  awayWin: number;
  likelyScore: { home: number; away: number };
  topScores: { score: string; prob: number }[];
  matrix: number[][]; // grid Poisson 9x9: matrix[golHome][golAway] = probabilitas
  homeRating: number;
  awayRating: number;
}

export function predict(
  homeTeam: string,
  awayTeam: string,
  ratings?: Record<string, number>
): Prediction {
  const { matrix, homeXg, awayXg } = scoreMatrix(homeTeam, awayTeam, ratings);

  let homeWin = 0, draw = 0, awayWin = 0;
  const grid: { score: string; prob: number }[] = [];
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = matrix[i][j];
      if (i > j) homeWin += p;
      else if (i === j) draw += p;
      else awayWin += p;
      grid.push({ score: `${i}-${j}`, prob: p });
    }
  }

  grid.sort((a, b) => b.prob - a.prob);
  const likely = grid[0].score.split("-").map(Number);

  return {
    homeXg: round1(homeXg),
    awayXg: round1(awayXg),
    homeWin,
    draw,
    awayWin,
    likelyScore: { home: likely[0], away: likely[1] },
    topScores: grid.slice(0, 5),
    matrix,
    homeRating: ratingOf(homeTeam, ratings),
    awayRating: ratingOf(awayTeam, ratings),
  };
}

function clamp(v: number) {
  return Math.max(0.2, Math.min(v, 4.2));
}
function round1(v: number) {
  return Math.round(v * 10) / 10;
}
export function pct(p: number) {
  return `${Math.round(p * 100)}%`;
}
