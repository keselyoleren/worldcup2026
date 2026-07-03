import {
  Match,
  MatchStatus,
  MatchesPayload,
  DataSource,
  Scorer,
  LineupPlayer,
  TeamLineup,
  MatchLineups,
} from "./types";
import { flagUrl } from "./countries";

const FD_BASE = "https://api.football-data.org/v4";
const OPENFOOTBALL_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const REVALIDATE_SECONDS = 60; // refresh data tiap 60 detik

function winnerOf(h: number | null, a: number | null) {
  if (h === null || a === null) return null;
  if (h > a) return "HOME" as const;
  if (a > h) return "AWAY" as const;
  return "DRAW" as const;
}

// ---------------------------------------------------------------------------
// Normalizer: football-data.org  (realtime, kode kompetisi "WC")
// ---------------------------------------------------------------------------
function normalizeFootballData(raw: any): Match[] {
  return (raw.matches ?? []).map((m: any): Match => {
    const h = m.score?.fullTime?.home ?? null;
    const a = m.score?.fullTime?.away ?? null;
    return {
      id: String(m.id),
      utcDate: m.utcDate,
      status: (m.status as MatchStatus) ?? "UNKNOWN",
      stage: m.stage ?? "GROUP_STAGE",
      // API memakai "GROUP_A" -> samakan dengan format fallback "Group A"
      group: m.group ? String(m.group).replace(/^GROUP_/, "Group ") : null,
      matchday: m.matchday ?? null,
      venue: m.venue ?? null,
      home: {
        name: m.homeTeam?.name ?? "TBD",
        code: m.homeTeam?.tla,
        crest: m.homeTeam?.crest ?? flagUrl(m.homeTeam?.name ?? ""),
      },
      away: {
        name: m.awayTeam?.name ?? "TBD",
        code: m.awayTeam?.tla,
        crest: m.awayTeam?.crest ?? flagUrl(m.awayTeam?.name ?? ""),
      },
      score: { home: h, away: a, winner: m.score?.winner ?? winnerOf(h, a) },
    };
  });
}

// ---------------------------------------------------------------------------
// Normalizer: API-Football (RapidAPI)
// ---------------------------------------------------------------------------
const AF_STATUS: Record<string, MatchStatus> = {
  NS: "SCHEDULED", TBD: "SCHEDULED", "1H": "IN_PLAY", "2H": "IN_PLAY",
  ET: "IN_PLAY", P: "IN_PLAY", LIVE: "IN_PLAY", HT: "PAUSED",
  FT: "FINISHED", AET: "FINISHED", PEN: "FINISHED", PST: "POSTPONED",
  CANC: "CANCELLED",
};

function normalizeApiFootball(raw: any): Match[] {
  return (raw.response ?? []).map((r: any): Match => {
    const h = r.goals?.home ?? null;
    const a = r.goals?.away ?? null;
    const round: string = r.league?.round ?? "";
    const isGroup = /group/i.test(round);
    return {
      id: String(r.fixture?.id),
      utcDate: r.fixture?.date,
      status: AF_STATUS[r.fixture?.status?.short] ?? "UNKNOWN",
      stage: isGroup ? "GROUP_STAGE" : round.toUpperCase().replace(/\s+/g, "_"),
      group: isGroup ? round.replace(/\s*-.*/, "").trim() : null,
      matchday: null,
      venue: r.fixture?.venue?.name ?? null,
      home: { name: r.teams?.home?.name, crest: r.teams?.home?.logo },
      away: { name: r.teams?.away?.name, crest: r.teams?.away?.logo },
      score: { home: h, away: a, winner: winnerOf(h, a) },
    };
  });
}

// ---------------------------------------------------------------------------
// Fallback: openfootball/worldcup.json (tanpa API key)
// ---------------------------------------------------------------------------
function normalizeOpenFootball(raw: any): Match[] {
  return (raw.matches ?? []).map((m: any, i: number): Match => {
    const ft = m.score?.ft ?? [null, null];
    const h = ft[0] ?? null;
    const a = ft[1] ?? null;
    const group: string | null = m.group ?? null;
    return {
      id: `of-${i}`,
      utcDate: toIso(m.date, m.time),
      status: h !== null && a !== null ? "FINISHED" : "SCHEDULED",
      stage: group ? "GROUP_STAGE" : (m.round ?? "KNOCKOUT").toUpperCase().replace(/\s+/g, "_"),
      group,
      matchday: parseMatchday(m.round),
      venue: m.ground ?? null,
      home: { name: m.team1, crest: flagUrl(m.team1 ?? "") },
      away: { name: m.team2, crest: flagUrl(m.team2 ?? "") },
      score: { home: h, away: a, winner: winnerOf(h, a) },
    };
  });
}

function parseMatchday(round?: string): number | null {
  const match = round?.match(/matchday\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function toIso(date?: string, time?: string): string {
  if (!date) return new Date(0).toISOString();
  // openfootball time seperti "13:00 UTC-6" -> ambil jam & offset
  const t = time?.match(/(\d{1,2}):(\d{2})/);
  const off = time?.match(/UTC([+-]\d{1,2})/);
  const hh = t ? t[1].padStart(2, "0") : "12";
  const mm = t ? t[2] : "00";
  const offset = off ? `${Number(off[1]) >= 0 ? "+" : "-"}${String(Math.abs(Number(off[1]))).padStart(2, "0")}:00` : "+00:00";
  return `${date}T${hh}:${mm}:00${offset}`;
}

// ---------------------------------------------------------------------------
// Public: getMatches() — pilih sumber otomatis
// ---------------------------------------------------------------------------
export async function getMatches(): Promise<MatchesPayload> {
  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  const afKey = process.env.API_FOOTBALL_KEY;
  const season = process.env.API_FOOTBALL_SEASON ?? "2026";
  let matches: Match[] = [];
  let source: DataSource = "openfootball (fallback)";
  let isLive = false;

  try {
    if (fdKey) {
      const res = await fetch(`${FD_BASE}/competitions/WC/matches`, {
        headers: { "X-Auth-Token": fdKey },
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (res.ok) {
        matches = normalizeFootballData(await res.json());
        source = "football-data.org";
        isLive = true;
      }
    } else if (afKey) {
      const res = await fetch(
        `https://v3.football.api-sports.io/fixtures?league=1&season=${season}`,
        {
          headers: { "x-apisports-key": afKey },
          next: { revalidate: REVALIDATE_SECONDS },
        }
      );
      if (res.ok) {
        matches = normalizeApiFootball(await res.json());
        source = "api-football";
        isLive = true;
      }
    }
  } catch {
    // jatuh ke fallback di bawah
  }

  if (matches.length === 0) {
    const res = await fetch(OPENFOOTBALL_URL, { next: { revalidate: 3600 } });
    matches = normalizeOpenFootball(await res.json());
    source = "openfootball (fallback)";
    isLive = false;
  }

  matches.sort((x, y) => x.utcDate.localeCompare(y.utcDate));
  return { source, isLive, fetchedAt: new Date().toISOString(), matches };
}

// ---------------------------------------------------------------------------
// Public: getScorers() — daftar pencetak gol turnamen (hanya football-data.org;
// sumber fallback tidak punya data pemain, jadi kembalikan kosong)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Public: getLineups() — susunan pemain satu laga
// football-data.org: detail /matches/{id} sudah memuat lineup + bench + coach;
// API-Football: endpoint terpisah /fixtures/lineups. Sumber fallback openfootball
// tidak punya data pemain, jadi kembalikan null (bagian lineup disembunyikan).
// ---------------------------------------------------------------------------
function fdLineupPlayer(p: any): LineupPlayer {
  return {
    id: p?.id ?? null,
    name: p?.name ?? "?",
    shirtNumber: p?.shirtNumber ?? null,
    position: p?.position ?? null,
    grid: null,
  };
}

function normalizeFdLineup(t: any): TeamLineup | null {
  const startXI = (t?.lineup ?? []).map(fdLineupPlayer);
  if (startXI.length === 0) return null;
  return {
    formation: t?.formation ?? null,
    coach: t?.coach?.name ?? null,
    startXI,
    bench: (t?.bench ?? []).map(fdLineupPlayer),
  };
}

function afLineupPlayer(x: any): LineupPlayer {
  const p = x?.player ?? {};
  return {
    id: p.id ?? null,
    name: p.name ?? "?",
    shirtNumber: p.number ?? null,
    position: p.pos ?? null,
    grid: p.grid ?? null,
  };
}

function normalizeAfLineup(r: any): TeamLineup | null {
  const startXI = (r?.startXI ?? []).map(afLineupPlayer);
  if (startXI.length === 0) return null;
  return {
    formation: r?.formation ?? null,
    coach: r?.coach?.name ?? null,
    startXI,
    bench: (r?.substitutes ?? []).map(afLineupPlayer),
  };
}

export async function getLineups(
  matchId: string,
  source: DataSource,
  homeName: string
): Promise<MatchLineups | null> {
  try {
    if (source === "football-data.org") {
      const fdKey = process.env.FOOTBALL_DATA_API_KEY;
      if (!fdKey) return null;
      const res = await fetch(`${FD_BASE}/matches/${matchId}`, {
        headers: { "X-Auth-Token": fdKey },
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (!res.ok) return null;
      const raw = await res.json();
      const home = normalizeFdLineup(raw.homeTeam);
      const away = normalizeFdLineup(raw.awayTeam);
      return home || away ? { home, away } : null;
    }

    if (source === "api-football") {
      const afKey = process.env.API_FOOTBALL_KEY;
      if (!afKey) return null;
      const res = await fetch(
        `https://v3.football.api-sports.io/fixtures/lineups?fixture=${matchId}`,
        {
          headers: { "x-apisports-key": afKey },
          next: { revalidate: REVALIDATE_SECONDS },
        }
      );
      if (!res.ok) return null;
      const rows: any[] = (await res.json()).response ?? [];
      if (rows.length === 0) return null;
      // urutan response tidak dijamin home dulu — cocokkan lewat nama tim
      const homeRow = rows.find((r) => r.team?.name === homeName) ?? rows[0];
      const awayRow = rows.find((r) => r !== homeRow) ?? null;
      return {
        home: normalizeAfLineup(homeRow),
        away: awayRow ? normalizeAfLineup(awayRow) : null,
      };
    }
  } catch {
    // lineup bersifat opsional — jangan sampai mematahkan halaman laga
  }
  return null;
}

export async function getScorers(limit = 100): Promise<Scorer[]> {
  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!fdKey) return [];
  try {
    const res = await fetch(`${FD_BASE}/competitions/WC/scorers?limit=${limit}`, {
      headers: { "X-Auth-Token": fdKey },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return [];
    const raw = await res.json();
    return ((raw.scorers ?? []) as any[])
      .map(
        (s): Scorer => ({
          id: s.player?.id ?? 0,
          name: s.player?.name ?? "?",
          team: s.team?.name ?? "?",
          teamCrest: s.team?.crest,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          penalties: s.penalties ?? 0,
          played: s.playedMatches ?? 0,
          dateOfBirth: s.player?.dateOfBirth,
        })
      )
      .filter((s) => s.goals > 0)
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists);
  } catch {
    return [];
  }
}
