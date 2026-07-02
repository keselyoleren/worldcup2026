import { Match, Scorer } from "./types";
import { expectedGoals } from "./prediction";

// ===========================================================================
//  Analitik pemain di atas data top skor + model prediksi tim
// ===========================================================================

// total gol turnamen tiap tim (dari laga yang sudah selesai)
export function teamGoalsMap(matches: Match[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== "FINISHED" || m.score.home === null || m.score.away === null) continue;
    map.set(m.home.name, (map.get(m.home.name) ?? 0) + m.score.home);
    map.set(m.away.name, (map.get(m.away.name) ?? 0) + m.score.away);
  }
  return map;
}

export interface Threat {
  scorer: Scorer;
  share: number; // porsi gol tim yang ia cetak (0-1)
  prob: number; // peluang mencetak gol di laga ini (0-1)
}

// Ancaman utama kedua tim untuk satu laga: pencetak gol terbanyak tiap tim,
// plus peluangnya mencetak gol = 1 - e^(-xG tim x porsi golnya).
// `scorers` diasumsikan sudah urut gol terbanyak (hasil getScorers()).
export function matchThreats(
  home: string,
  away: string,
  scorers: Scorer[],
  goals: Map<string, number>,
  ratings?: Record<string, number>
): { home: Threat | null; away: Threat | null } {
  const [hXg, aXg] = expectedGoals(home, away, ratings);
  const mk = (team: string, xg: number): Threat | null => {
    const s = scorers.find((x) => x.team === team);
    if (!s) return null;
    const total = Math.max(goals.get(team) ?? s.goals, s.goals, 1);
    // dibatasi 0.75: satu pemain tak mungkin diprediksi mencetak semua gol tim
    const share = Math.min(s.goals / total, 0.75);
    return { scorer: s, share, prob: 1 - Math.exp(-xg * share) };
  };
  return { home: mk(home, hXg), away: mk(away, aXg) };
}
