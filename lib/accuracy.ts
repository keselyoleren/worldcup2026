import { Match } from "./types";
import { computeElo, eloToRating } from "./elo";
import { predict } from "./prediction";
import { isRealTeam } from "./simulate";

// ===========================================================================
//  Akurasi model prediksi
//  Setiap laga selesai di-retro-prediksi memakai Elo PRA-laga (snapshot dari
//  computeElo — tidak pernah membocorkan hasil laga itu sendiri), memakai
//  predict() apa adanya karena itulah model yang dilihat pengguna.
//  Varian rating statis dihitung sekalian sebagai pembanding.
// ===========================================================================

type Outcome = "HOME" | "DRAW" | "AWAY";

export interface MatchPrediction {
  matchId: string;
  date: string;
  stage: string;
  label: string; // "Argentina vs Meksiko"
  homeCrest?: string;
  awayCrest?: string;
  probs: { home: number; draw: number; away: number };
  predictedOutcome: Outcome;
  predictedScore: string;
  actualOutcome: Outcome;
  actualScore: string;
  outcomeHit: boolean;
  scoreHit: boolean;
  brier: number; // 0..2, makin kecil makin baik
  confidence: number; // probabilitas yang diberikan ke hasil prediksi
}

export interface CalibrationBucket {
  rangeLabel: string; // "60–70%"
  lo: number;
  hi: number;
  predictedAvg: number; // rata-rata probabilitas prediksi di bucket
  actualFreq: number; // frekuensi kejadian sebenarnya
  count: number;
}

export interface AccuracyReport {
  sample: number;
  outcomeHitRate: number; // 0..1
  scoreHitRate: number;
  meanBrier: number;
  baselineBrier: number; // prediktor uniform (1/3,1/3,1/3) ≈ 0.667
  staticOutcomeHitRate: number; // pembanding: model rating statis
  staticMeanBrier: number;
  calibration: CalibrationBucket[];
  best: MatchPrediction[]; // 5 tebakan percaya diri yang benar
  worst: MatchPrediction[]; // 5 tebakan percaya diri yang meleset
  matches: MatchPrediction[];
}

export function computeAccuracy(matches: Match[]): AccuracyReport {
  const { preMatch } = computeElo(matches);
  const finished = matches
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        m.score.home !== null &&
        m.score.away !== null &&
        isRealTeam(m.home.name) &&
        isRealTeam(m.away.name)
    )
    .sort((a, b) => a.utcDate.localeCompare(b.utcDate));

  const evaluated: MatchPrediction[] = [];
  let brierSum = 0;
  let staticHits = 0;
  let staticBrierSum = 0;
  // sampel kalibrasi: ketiga probabilitas per laga (home/draw/away)
  const samples: { prob: number; happened: boolean }[] = [];

  for (const m of finished) {
    const home = m.home.name, away = m.away.name;
    const pre = preMatch[m.id];
    const ratings = pre
      ? { [home]: eloToRating(pre.home), [away]: eloToRating(pre.away) }
      : undefined;

    const p = predict(home, away, ratings);
    const pStatic = predict(home, away);

    const hg = m.score.home!, ag = m.score.away!;
    const actualOutcome: Outcome = hg > ag ? "HOME" : hg < ag ? "AWAY" : "DRAW";
    const predictedOutcome: Outcome =
      p.homeWin >= p.draw && p.homeWin >= p.awayWin
        ? "HOME"
        : p.awayWin >= p.draw
        ? "AWAY"
        : "DRAW";

    const oh = actualOutcome === "HOME" ? 1 : 0;
    const od = actualOutcome === "DRAW" ? 1 : 0;
    const oa = actualOutcome === "AWAY" ? 1 : 0;
    const brier = (p.homeWin - oh) ** 2 + (p.draw - od) ** 2 + (p.awayWin - oa) ** 2;
    brierSum += brier;

    const staticOutcome: Outcome =
      pStatic.homeWin >= pStatic.draw && pStatic.homeWin >= pStatic.awayWin
        ? "HOME"
        : pStatic.awayWin >= pStatic.draw
        ? "AWAY"
        : "DRAW";
    if (staticOutcome === actualOutcome) staticHits++;
    staticBrierSum +=
      (pStatic.homeWin - oh) ** 2 + (pStatic.draw - od) ** 2 + (pStatic.awayWin - oa) ** 2;

    samples.push(
      { prob: p.homeWin, happened: oh === 1 },
      { prob: p.draw, happened: od === 1 },
      { prob: p.awayWin, happened: oa === 1 }
    );

    const confidence =
      predictedOutcome === "HOME" ? p.homeWin : predictedOutcome === "DRAW" ? p.draw : p.awayWin;

    evaluated.push({
      matchId: m.id,
      date: m.utcDate,
      stage: m.stage,
      label: `${home} vs ${away}`,
      homeCrest: m.home.crest,
      awayCrest: m.away.crest,
      probs: { home: p.homeWin, draw: p.draw, away: p.awayWin },
      predictedOutcome,
      predictedScore: `${p.likelyScore.home}-${p.likelyScore.away}`,
      actualOutcome,
      actualScore: `${hg}-${ag}`,
      outcomeHit: predictedOutcome === actualOutcome,
      scoreHit: p.likelyScore.home === hg && p.likelyScore.away === ag,
      brier,
      confidence,
    });
  }

  const n = evaluated.length;
  const hits = evaluated.filter((e) => e.outcomeHit);
  const misses = evaluated.filter((e) => !e.outcomeHit);
  const byConfidence = (a: MatchPrediction, b: MatchPrediction) => b.confidence - a.confidence;

  // bucket kalibrasi selebar 10%, bucket kosong dibuang
  const calibration: CalibrationBucket[] = [];
  for (let b = 0; b < 10; b++) {
    const lo = b / 10, hi = (b + 1) / 10;
    const inB = samples.filter((s) => s.prob >= lo && (b === 9 ? s.prob <= hi : s.prob < hi));
    if (inB.length === 0) continue;
    calibration.push({
      rangeLabel: `${b * 10}–${(b + 1) * 10}%`,
      lo,
      hi,
      predictedAvg: inB.reduce((s, x) => s + x.prob, 0) / inB.length,
      actualFreq: inB.filter((x) => x.happened).length / inB.length,
      count: inB.length,
    });
  }

  return {
    sample: n,
    outcomeHitRate: n ? hits.length / n : 0,
    scoreHitRate: n ? evaluated.filter((e) => e.scoreHit).length / n : 0,
    meanBrier: n ? brierSum / n : 0,
    baselineBrier: 2 / 3,
    staticOutcomeHitRate: n ? staticHits / n : 0,
    staticMeanBrier: n ? staticBrierSum / n : 0,
    calibration,
    best: [...hits].sort(byConfidence).slice(0, 5),
    worst: [...misses].sort(byConfidence).slice(0, 5),
    matches: evaluated,
  };
}
