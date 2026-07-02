import { Match } from "./types";
import { computeElo } from "./elo";
import { ratingOf } from "./prediction";
import { isRealTeam } from "./simulate";

// ===========================================================================
//  Indeks unik berbasis data:
//  - Indeks Kejutan: hasil vs ekspektasi Elo pra-laga
//  - Grup Maut: kuat DAN merata (dari rating undian, bukan form terkini)
//  - Indeks Seru: gol + ketatnya laga + faktor kejutan (hanya skor akhir
//    yang tersedia — tanpa data menit gol)
// ===========================================================================

export interface UpsetEntry {
  matchId: string;
  date: string;
  label: string; // "Maroko 2-0 Belgia"
  score: string;
  favorite: string;
  underdog: string;
  favCrest?: string;
  dogCrest?: string;
  favWinProb: number; // ekspektasi Elo favorit (0..1)
  eloGap: number;
  upsetScore: number; // 0-100+
  kind: "MENANG" | "SERI"; // underdog menang vs menahan favorit besar
}

export interface GroupDeathEntry {
  group: string;
  avgRating: number;
  spread: number; // deviasi standar rating seed
  deathScore: number; // 0-100 dinormalisasi antar grup
  teams: { team: string; rating: number; crest?: string }[];
}

export interface ExcitementEntry {
  matchId: string;
  label: string;
  score: string;
  stage: string;
  group: string | null;
  goals: number;
  margin: number;
  upsetScore: number;
  excitement: number; // 0-100
}

export interface GroupExcitement {
  group: string;
  avgExcitement: number;
  goalsPerMatch: number;
  matchCount: number;
}

export interface FunIndexes {
  upsets: UpsetEntry[]; // top 10
  groupOfDeath: GroupDeathEntry[]; // 12 grup, urut deathScore
  topMatches: ExcitementEntry[]; // top 10
  excitementByGroup: GroupExcitement[];
}

export function computeIndexes(matches: Match[]): FunIndexes {
  const { preMatch } = computeElo(matches);
  const finished = matches.filter(
    (m) =>
      m.status === "FINISHED" &&
      m.score.home !== null &&
      m.score.away !== null &&
      isRealTeam(m.home.name) &&
      isRealTeam(m.away.name)
  );

  // --- Indeks Kejutan + skor kejutan per laga (dipakai indeks seru) ---
  const upsetByMatch = new Map<string, number>();
  const upsets: UpsetEntry[] = [];

  for (const m of finished) {
    const pre = preMatch[m.id];
    if (!pre) continue;
    const hg = m.score.home!, ag = m.score.away!;
    const homeIsFav = pre.home >= pre.away;
    const fav = homeIsFav ? m.home : m.away;
    const dog = homeIsFav ? m.away : m.home;
    const favElo = homeIsFav ? pre.home : pre.away;
    const dogElo = homeIsFav ? pre.away : pre.home;
    const favGoals = homeIsFav ? hg : ag;
    const dogGoals = homeIsFav ? ag : hg;

    const we = 1 / (1 + Math.pow(10, (dogElo - favElo) / 400));
    const actual = favGoals > dogGoals ? 1 : favGoals < dogGoals ? 0 : 0.5;
    const surprise = we - actual;
    const margin = Math.abs(hg - ag);

    let score = 0;
    let kind: UpsetEntry["kind"] | null = null;
    if (favGoals < dogGoals) {
      kind = "MENANG";
      score = Math.round(surprise * 100 * (1 + 0.15 * (margin - 1)));
    } else if (favGoals === dogGoals && we >= 0.7) {
      kind = "SERI";
      score = Math.round(surprise * 100);
    }
    upsetByMatch.set(m.id, Math.max(0, kind ? score : 0));

    if (kind && score > 0) {
      upsets.push({
        matchId: m.id,
        date: m.utcDate,
        label: `${m.home.name} ${hg}-${ag} ${m.away.name}`,
        score: `${hg}-${ag}`,
        favorite: fav.name,
        underdog: dog.name,
        favCrest: fav.crest,
        dogCrest: dog.crest,
        favWinProb: we,
        eloGap: Math.round(favElo - dogElo),
        upsetScore: score,
        kind,
      });
    }
  }
  upsets.sort((a, b) => b.upsetScore - a.upsetScore);

  // --- Grup Maut (dari rating seed pra-turnamen: mengukur hasil undian) ---
  const groupTeams = new Map<string, Map<string, string | undefined>>();
  for (const m of matches) {
    if (!m.group || m.stage !== "GROUP_STAGE") continue;
    for (const t of [m.home, m.away]) {
      if (!isRealTeam(t.name)) continue;
      if (!groupTeams.has(m.group)) groupTeams.set(m.group, new Map());
      const g = groupTeams.get(m.group)!;
      if (!g.has(t.name) || (!g.get(t.name) && t.crest)) g.set(t.name, t.crest);
    }
  }

  const rawDeath = [...groupTeams.entries()]
    .filter(([, teams]) => teams.size >= 2)
    .map(([group, teams]) => {
      const list = [...teams.entries()].map(([team, crest]) => ({
        team,
        crest,
        rating: ratingOf(team),
      }));
      const avg = list.reduce((s, t) => s + t.rating, 0) / list.length;
      const spread = Math.sqrt(list.reduce((s, t) => s + (t.rating - avg) ** 2, 0) / list.length);
      return {
        group,
        avgRating: Math.round(avg * 10) / 10,
        spread: Math.round(spread * 10) / 10,
        raw: avg - 0.5 * spread, // kuat DAN merata = maut
        teams: list.sort((a, b) => b.rating - a.rating),
      };
    });

  const rawMin = Math.min(...rawDeath.map((g) => g.raw), Infinity);
  const rawMax = Math.max(...rawDeath.map((g) => g.raw), -Infinity);
  const groupOfDeath: GroupDeathEntry[] = rawDeath
    .map(({ raw, ...g }) => ({
      ...g,
      deathScore:
        rawMax > rawMin ? Math.round(((raw - rawMin) / (rawMax - rawMin)) * 100) : 50,
    }))
    .sort((a, b) => b.deathScore - a.deathScore);

  // --- Indeks Seru ---
  const closenessOf = (margin: number) => (margin === 0 ? 20 : margin === 1 ? 14 : margin === 2 ? 8 : 0);
  const excitements: ExcitementEntry[] = finished.map((m) => {
    const hg = m.score.home!, ag = m.score.away!;
    const goals = hg + ag;
    const margin = Math.abs(hg - ag);
    const upset = upsetByMatch.get(m.id) ?? 0;
    return {
      matchId: m.id,
      label: `${m.home.name} ${hg}-${ag} ${m.away.name}`,
      score: `${hg}-${ag}`,
      stage: m.stage,
      group: m.group,
      goals,
      margin,
      upsetScore: upset,
      excitement: Math.min(100, Math.round(goals * 12 + closenessOf(margin) + 0.4 * upset)),
    };
  });

  const byGroup = new Map<string, ExcitementEntry[]>();
  for (const e of excitements) {
    if (!e.group) continue;
    (byGroup.get(e.group) ?? byGroup.set(e.group, []).get(e.group)!).push(e);
  }
  const excitementByGroup: GroupExcitement[] = [...byGroup.entries()]
    .map(([group, list]) => ({
      group,
      avgExcitement: Math.round(list.reduce((s, e) => s + e.excitement, 0) / list.length),
      goalsPerMatch: Math.round((list.reduce((s, e) => s + e.goals, 0) / list.length) * 100) / 100,
      matchCount: list.length,
    }))
    .sort((a, b) => b.avgExcitement - a.avgExcitement);

  return {
    upsets: upsets.slice(0, 10),
    groupOfDeath,
    topMatches: [...excitements].sort((a, b) => b.excitement - a.excitement).slice(0, 10),
    excitementByGroup,
  };
}
