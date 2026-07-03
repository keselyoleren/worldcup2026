import { Match, MatchLiveDetail, GoalEvent, MatchPhase } from "./types";
import { scoreMatrix, expectedGoals, winExpectancy } from "./prediction";
import { computeElo, eloToRating } from "./elo";

// ===========================================================================
//  Probabilitas menang LIVE — model Poisson Dixon-Coles dikondisikan pada
//  skor & menit berjalan.
//  - Poisson bersifat memoryless: sisa gol ~ Poisson(λ × fraksi waktu tersisa),
//    jadi cukup menskalakan λ (scoreMatrix dengan parameter frac) — tanpa
//    Monte Carlo. Di menit 0 skor 0-0 hasilnya identik dengan predict().
//  - Fase gugur: peluang "lolos" memperhitungkan perpanjangan waktu
//    (λ/3 — kalibrasi sama dengan knockoutWinner di lib/simulate.ts) dan adu
//    penalti (formula pPen persis sama, supaya seluruh situs konsisten).
//  - Timeline direkonstruksi analitis dari menit-menit gol — deterministik
//    penuh, tidak butuh penyimpanan snapshot.
// ===========================================================================

export interface LiveState {
  phase: MatchPhase;
  minute: number | null; // menit efektif 0..120 (null = tidak diketahui)
  minuteEstimated: boolean; // true bila diestimasi dari jam kickoff
  homeGoals: number;
  awayGoals: number;
  winner: "HOME" | "AWAY" | "DRAW" | null; // hanya terisi saat FT
  extraTime: boolean; // laga (akan/telah) melewati perpanjangan waktu
}

export interface LiveProbs {
  homeWin: number; // hasil di akhir waktu normal/ET (fase grup: 90')
  draw: number;
  awayWin: number;
  homeAdvance?: number; // peluang lolos — hanya fase gugur
  awayAdvance?: number;
}

export interface TimelinePoint {
  minute: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  homeAdvance?: number;
  awayAdvance?: number;
}

// --- Normalisasi menit & fase dari status + detail API -----------------------
// Prioritas: menit eksplisit dari API -> PAUSED = turun minum (45') ->
// estimasi dari jam kickoff (stoppage time diabaikan; jeda HT 15', jeda ET 5').
export function resolveLiveState(
  match: Match,
  detail: MatchLiveDetail | null,
  nowIso: string
): LiveState {
  const homeGoals = match.score.home ?? 0;
  const awayGoals = match.score.away ?? 0;
  const wentEt =
    detail?.duration === "EXTRA_TIME" ||
    detail?.duration === "PENALTY_SHOOTOUT" ||
    match.livePhase === "ET" ||
    match.livePhase === "PEN";

  if (match.status === "FINISHED") {
    return {
      phase: "FT", minute: null, minuteEstimated: false,
      homeGoals, awayGoals, winner: match.score.winner, extraTime: wentEt,
    };
  }
  if (match.status !== "IN_PLAY" && match.status !== "PAUSED") {
    return {
      phase: "PRE", minute: null, minuteEstimated: false,
      homeGoals: 0, awayGoals: 0, winner: null, extraTime: false,
    };
  }
  if (match.status === "PAUSED") {
    return {
      phase: "HT", minute: 45, minuteEstimated: false,
      homeGoals, awayGoals, winner: null, extraTime: false,
    };
  }

  // adu penalti berlangsung (petunjuk dari API-Football status "P")
  if (detail?.phaseHint === "PEN" || match.livePhase === "PEN") {
    return {
      phase: "PEN", minute: 120, minuteEstimated: false,
      homeGoals, awayGoals, winner: null, extraTime: true,
    };
  }

  const apiMinute = detail?.minute ?? match.minute ?? null;
  if (apiMinute !== null) {
    const et = wentEt || apiMinute > 90;
    const phase: MatchPhase = et ? "ET" : apiMinute > 45 ? "2H" : "1H";
    return {
      phase, minute: Math.min(Math.max(apiMinute, 0), 120), minuteEstimated: false,
      homeGoals, awayGoals, winner: null, extraTime: et,
    };
  }

  // estimasi kasar dari jam kickoff
  const elapsed = (Date.parse(nowIso) - Date.parse(match.utcDate)) / 60000;
  const knockout = match.stage !== "GROUP_STAGE";
  let phase: MatchPhase;
  let minute: number;
  if (elapsed <= 45) {
    phase = "1H"; minute = Math.max(1, Math.floor(elapsed));
  } else if (elapsed <= 60) {
    phase = "HT"; minute = 45;
  } else if (elapsed <= 105) {
    phase = "2H"; minute = Math.min(90, Math.floor(elapsed - 15));
  } else if (knockout && homeGoals === awayGoals && elapsed > 110) {
    phase = "ET"; minute = Math.min(120, Math.floor(elapsed - 20));
  } else {
    phase = "2H"; minute = 90; // injury time babak kedua
  }
  return {
    phase, minute, minuteEstimated: true,
    homeGoals, awayGoals, winner: null, extraTime: phase === "ET",
  };
}

// --- Poisson lokal (poisson() di lib/prediction.ts sengaja tetap privat) ----
function poissonP(k: number, lambda: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / f;
}

// Distribusi hasil (sisi home) dari grid Poisson independen bila home saat ini
// unggul `lead` gol — dipakai untuk perpanjangan waktu (koreksi Dixon-Coles
// adalah fenomena laga penuh, jadi dilewati di sini).
function poissonGrid(mh: number, ma: number, lead: number) {
  let home = 0, draw = 0, away = 0, sum = 0;
  for (let i = 0; i <= 6; i++)
    for (let j = 0; j <= 6; j++) {
      const p = poissonP(i, mh) * poissonP(j, ma);
      sum += p;
      const d = lead + i - j;
      if (d > 0) home += p;
      else if (d === 0) draw += p;
      else away += p;
    }
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

// --- Hasil laga di akhir waktu normal (atau agregat 120' saat fase ET) ------
export function liveOutcome(
  home: string,
  away: string,
  state: LiveState,
  ratings?: Record<string, number>
): { homeWin: number; draw: number; awayWin: number } {
  const { phase, homeGoals: h, awayGoals: a } = state;

  // laga usai / adu penalti: hasil waktu normal+ET sudah final
  if (phase === "FT" || phase === "PEN") {
    return { homeWin: h > a ? 1 : 0, draw: h === a ? 1 : 0, awayWin: a > h ? 1 : 0 };
  }

  if (phase === "ET") {
    // yang dikondisikan = agregat setelah 120'; λ ET ≈ λ/3 (2x15 menit)
    const minute = Math.min(Math.max(state.minute ?? 90, 90), 120);
    const fracEt = (120 - minute) / 30;
    const [lh, la] = expectedGoals(home, away, ratings);
    const g = poissonGrid((lh / 3) * fracEt, (la / 3) * fracEt, h - a);
    return { homeWin: g.home, draw: g.draw, awayWin: g.away };
  }

  // waktu normal: matriks SISA gol dengan λ × fraksi waktu tersisa
  const minute = phase === "PRE" ? 0 : phase === "HT" ? 45 : Math.min(state.minute ?? 0, 90);
  const frac = Math.max(0, (90 - minute) / 90);
  const { matrix } = scoreMatrix(home, away, ratings, frac);
  let homeWin = 0, draw = 0, awayWin = 0;
  for (let i = 0; i < matrix.length; i++)
    for (let j = 0; j < matrix.length; j++) {
      const p = matrix[i][j];
      const d = h + i - (a + j);
      if (d > 0) homeWin += p;
      else if (d === 0) draw += p;
      else awayWin += p;
    }
  return { homeWin, draw, awayWin };
}

// --- Fase gugur: peluang LOLOS (90' -> perpanjangan waktu -> adu penalti) ---
export function liveAdvance(
  home: string,
  away: string,
  state: LiveState,
  ratings?: Record<string, number>
): LiveProbs {
  const outcome = liveOutcome(home, away, state, ratings);
  // formula adu penalti yang sama dengan lib/simulate.ts (knockoutWinner)
  const pPen = 0.5 + (winExpectancy(home, away, ratings) - 0.5) * 0.35;
  const { phase, homeGoals: h, awayGoals: a } = state;

  if (phase === "FT") {
    if (h !== a) return { ...outcome, homeAdvance: h > a ? 1 : 0, awayAdvance: h > a ? 0 : 1 };
    // imbang -> diputuskan adu penalti; pakai pemenang riil bila tersedia
    if (state.winner === "HOME") return { ...outcome, homeAdvance: 1, awayAdvance: 0 };
    if (state.winner === "AWAY") return { ...outcome, homeAdvance: 0, awayAdvance: 1 };
    return { ...outcome, homeAdvance: pPen, awayAdvance: 1 - pPen };
  }
  if (phase === "PEN") {
    return { ...outcome, homeAdvance: pPen, awayAdvance: 1 - pPen };
  }
  if (phase === "ET") {
    // outcome sudah = distribusi agregat setelah 120'
    const homeAdvance = outcome.homeWin + outcome.draw * pPen;
    return { ...outcome, homeAdvance, awayAdvance: 1 - homeAdvance };
  }

  // waktu normal: P(lolos) = P(menang 90') + P(seri) × [P(menang ET) + P(seri ET) × pPen]
  // (memoryless: distribusi gol ET tak bergantung skor imbangnya berapa)
  const [lh, la] = expectedGoals(home, away, ratings);
  const et = poissonGrid(lh / 3, la / 3, 0);
  const homeAdvance = outcome.homeWin + outcome.draw * (et.home + et.draw * pPen);
  return { ...outcome, homeAdvance, awayAdvance: 1 - homeAdvance };
}

// --- Timeline: evolusi probabilitas per menit dari event gol -----------------
export function buildTimeline(
  home: string,
  away: string,
  events: GoalEvent[],
  state: LiveState,
  isKnockout: boolean,
  ratings?: Record<string, number>
): TimelinePoint[] {
  const endMinute =
    state.phase === "FT"
      ? state.extraTime || events.some((e) => e.minute > 90) ? 120 : 90
      : state.phase === "PEN"
        ? 120
        : Math.min(state.minute ?? 0, 120);
  if (endMinute <= 0) return [];

  // gol injury time dihitung mulai batas babaknya (45+2 -> menit 45)
  const sorted = [...events].sort(
    (x, y) => x.minute - y.minute || (x.extra ?? 0) - (y.extra ?? 0)
  );

  const points: TimelinePoint[] = [];
  let h = 0, a = 0, idx = 0;
  for (let t = 0; t <= endMinute; t++) {
    while (idx < sorted.length && sorted[idx].minute <= t) {
      if (sorted[idx].side === "HOME") h++;
      else a++;
      idx++;
    }
    // t=90 tetap dihitung sebagai akhir waktu normal (frac 0 -> degenerate)
    const phase: MatchPhase = t < 45 ? "1H" : t <= 90 ? "2H" : "ET";
    const st: LiveState = { ...state, phase, minute: t, homeGoals: h, awayGoals: a };
    if (isKnockout) {
      const adv = liveAdvance(home, away, st, ratings);
      points.push({ minute: t, ...adv });
    } else {
      points.push({ minute: t, ...liveOutcome(home, away, st, ratings) });
    }
  }

  // titik terakhir selalu dari keadaan resmi: menangkap pemenang adu penalti
  // dan melindungi dari feed event yang tak lengkap (skor resmi yang menang)
  if (state.phase === "FT" || h !== state.homeGoals || a !== state.awayGoals) {
    const finalPoint = isKnockout
      ? liveAdvance(home, away, state, ratings)
      : liveOutcome(home, away, state, ratings);
    points[points.length - 1] = { minute: endMinute, ...finalPoint };
  }
  return points;
}

// --- Rating tepat SEBELUM laga ini -------------------------------------------
// Untuk laga FINISHED, liveRatings() sudah memuat update Elo dari laga itu
// sendiri (kebocoran) — pakai snapshot preMatch dari computeElo. Laga yang
// belum selesai tidak punya snapshot, hasilnya identik dengan liveRatings.
export function ratingsAsOfMatch(matches: Match[], match: Match): Record<string, number> {
  const { table, preMatch } = computeElo(matches);
  const out: Record<string, number> = {};
  for (const e of table) out[e.team] = eloToRating(e.elo);
  const pre = preMatch[match.id];
  if (pre) {
    out[match.home.name] = eloToRating(pre.home);
    out[match.away.name] = eloToRating(pre.away);
  }
  return out;
}
