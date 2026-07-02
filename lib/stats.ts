import { Match } from "./types";

export interface TableRow {
  team: string;
  crest?: string;
  group: string;
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number; // gol memasukkan
  ga: number; // gol kemasukan
  gd: number;
  points: number;
}

export interface TournamentStats {
  totalMatches: number;
  played: number;
  totalGoals: number;
  avgGoals: number;
  biggestWin: { label: string; margin: number } | null;
  topScorers: { team: string; goals: number; crest?: string }[];
}

// Klasemen grup dihitung dari hasil pertandingan yang sudah selesai.
export function computeStandings(matches: Match[]): Record<string, TableRow[]> {
  const rows = new Map<string, TableRow>();
  const key = (group: string, team: string) => `${group}::${team}`;

  const ensure = (group: string, team: string, crest?: string) => {
    const k = key(group, team);
    if (!rows.has(k))
      rows.set(k, {
        team, crest, group, played: 0, win: 0, draw: 0, loss: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      });
    return rows.get(k)!;
  };

  for (const m of matches) {
    if (!m.group) continue;
    if (m.status !== "FINISHED" || m.score.home === null || m.score.away === null)
      continue;
    const h = ensure(m.group, m.home.name, m.home.crest);
    const a = ensure(m.group, m.away.name, m.away.crest);
    h.played++; a.played++;
    h.gf += m.score.home; h.ga += m.score.away;
    a.gf += m.score.away; a.ga += m.score.home;
    if (m.score.home > m.score.away) { h.win++; a.loss++; h.points += 3; }
    else if (m.score.home < m.score.away) { a.win++; h.loss++; a.points += 3; }
    else { h.draw++; a.draw++; h.points++; a.points++; }
  }

  const byGroup: Record<string, TableRow[]> = {};
  for (const r of rows.values()) {
    r.gd = r.gf - r.ga;
    (byGroup[r.group] ??= []).push(r);
  }
  for (const g of Object.keys(byGroup)) {
    byGroup[g].sort(
      (x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team)
    );
  }
  return Object.fromEntries(Object.entries(byGroup).sort());
}

export function computeStats(matches: Match[]): TournamentStats {
  const finished = matches.filter(
    (m) => m.status === "FINISHED" && m.score.home !== null && m.score.away !== null
  );
  let totalGoals = 0;
  let biggest: TournamentStats["biggestWin"] = null;
  const goalsByTeam = new Map<string, { goals: number; crest?: string }>();

  for (const m of finished) {
    const h = m.score.home!, a = m.score.away!;
    totalGoals += h + a;
    const add = (team: string, g: number, crest?: string) => {
      const cur = goalsByTeam.get(team) ?? { goals: 0, crest };
      cur.goals += g;
      goalsByTeam.set(team, cur);
    };
    add(m.home.name, h, m.home.crest);
    add(m.away.name, a, m.away.crest);
    const margin = Math.abs(h - a);
    if (!biggest || margin > biggest.margin) {
      const winner = h > a ? m.home.name : m.away.name;
      const loser = h > a ? m.away.name : m.home.name;
      biggest = { label: `${winner} ${Math.max(h, a)}-${Math.min(h, a)} ${loser}`, margin };
    }
  }

  const topScorers = [...goalsByTeam.entries()]
    .map(([team, v]) => ({ team, goals: v.goals, crest: v.crest }))
    .sort((x, y) => y.goals - x.goals)
    .slice(0, 8);

  return {
    totalMatches: matches.length,
    played: finished.length,
    totalGoals,
    avgGoals: finished.length ? Math.round((totalGoals / finished.length) * 100) / 100 : 0,
    biggestWin: biggest,
    topScorers,
  };
}

const isFinished = (m: Match) =>
  m.status === "FINISHED" && m.score.home !== null && m.score.away !== null;

export interface FormEntry {
  result: "W" | "D" | "L";
  opponent: string;
  score: string; // dari sudut pandang tim, mis. "2-1"
  matchId: string;
}

// 5 laga selesai terakhir sebuah tim, paling baru dulu.
export function teamForm(matches: Match[], team: string, limit = 5): FormEntry[] {
  return matches
    .filter((m) => isFinished(m) && (m.home.name === team || m.away.name === team))
    .sort((a, b) => b.utcDate.localeCompare(a.utcDate))
    .slice(0, limit)
    .map((m) => {
      const home = m.home.name === team;
      const gf = home ? m.score.home! : m.score.away!;
      const ga = home ? m.score.away! : m.score.home!;
      return {
        result: gf > ga ? "W" : gf < ga ? "L" : "D",
        opponent: home ? m.away.name : m.home.name,
        score: `${gf}-${ga}`,
        matchId: m.id,
      } as FormEntry;
    });
}

// Pertemuan kedua tim dalam turnamen ini (semua fase), urut waktu.
export function headToHead(matches: Match[], a: string, b: string): Match[] {
  return matches
    .filter(
      (m) =>
        (m.home.name === a && m.away.name === b) || (m.home.name === b && m.away.name === a)
    )
    .sort((x, y) => x.utcDate.localeCompare(y.utcDate));
}

export function goalsPerMatchday(
  matches: Match[]
): { matchday: number; goals: number; played: number }[] {
  const acc = new Map<number, { goals: number; played: number }>();
  for (const m of matches) {
    if (!isFinished(m) || m.stage !== "GROUP_STAGE" || !m.matchday) continue;
    const cur = acc.get(m.matchday) ?? { goals: 0, played: 0 };
    cur.goals += m.score.home! + m.score.away!;
    cur.played++;
    acc.set(m.matchday, cur);
  }
  return [...acc.entries()]
    .map(([matchday, v]) => ({ matchday, ...v }))
    .sort((a, b) => a.matchday - b.matchday);
}

export function goalsPerGroup(matches: Match[]): { group: string; goals: number }[] {
  const acc = new Map<string, number>();
  for (const m of matches) {
    if (!isFinished(m) || !m.group) continue;
    acc.set(m.group, (acc.get(m.group) ?? 0) + m.score.home! + m.score.away!);
  }
  return [...acc.entries()]
    .map(([group, goals]) => ({ group, goals }))
    .sort((a, b) => a.group.localeCompare(b.group));
}
