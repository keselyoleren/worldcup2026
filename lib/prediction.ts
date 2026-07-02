// Model prediksi skor berbasis distribusi Poisson.
// Kekuatan tim (0-100) diturunkan dari peringkat FIFA/ekspektasi pra-turnamen.
// Semakin tinggi rating -> semakin tinggi expected goals (xG) tim tsb.

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
const HOME_ADVANTAGE = 1.15; // faktor tuan rumah / momentum
const BASE_GOALS = 1.35; // rata-rata gol per tim per laga

// ratings: override kekuatan tim (mis. rating Elo live) — tanpa override,
// dipakai tabel statis pra-turnamen.
export function ratingOf(team: string, ratings?: Record<string, number>): number {
  const t = team.trim();
  return ratings?.[t] ?? TEAM_RATING[t] ?? DEFAULT_RATING;
}

// Expected goals kedua tim. neutral=true -> tanpa keunggulan tuan rumah
// (dipakai untuk simulasi turnamen di venue netral).
export function expectedGoals(
  home: string,
  away: string,
  neutral = true,
  ratings?: Record<string, number>
): [number, number] {
  const rh = ratingOf(home, ratings);
  const ra = ratingOf(away, ratings);
  const adv = neutral ? 1 : HOME_ADVANTAGE;
  return [
    clamp(BASE_GOALS * Math.pow(rh / ra, 1.35) * adv),
    clamp(BASE_GOALS * Math.pow(ra / rh, 1.35)),
  ];
}

function poisson(k: number, lambda: number): number {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
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
  const rh = ratingOf(homeTeam, ratings);
  const ra = ratingOf(awayTeam, ratings);

  // Expected goals: skala kekuatan relatif + keunggulan tuan rumah.
  const homeXg = clamp(BASE_GOALS * Math.pow(rh / ra, 1.35) * HOME_ADVANTAGE);
  const awayXg = clamp(BASE_GOALS * Math.pow(ra / rh, 1.35));

  const MAX = 8;
  let homeWin = 0, draw = 0, awayWin = 0;
  const grid: { score: string; prob: number }[] = [];
  const matrix: number[][] = [];

  for (let i = 0; i <= MAX; i++) {
    matrix.push([]);
    for (let j = 0; j <= MAX; j++) {
      const p = poisson(i, homeXg) * poisson(j, awayXg);
      if (i > j) homeWin += p;
      else if (i === j) draw += p;
      else awayWin += p;
      grid.push({ score: `${i}-${j}`, prob: p });
      matrix[i].push(p);
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
    homeRating: rh,
    awayRating: ra,
  };
}

function clamp(v: number) {
  return Math.max(0.15, Math.min(v, 4.5));
}
function round1(v: number) {
  return Math.round(v * 10) / 10;
}
export function pct(p: number) {
  return `${Math.round(p * 100)}%`;
}
