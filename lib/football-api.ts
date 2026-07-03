import {
  Match,
  MatchStatus,
  MatchesPayload,
  DataSource,
  Scorer,
  LineupPlayer,
  TeamLineup,
  MatchLineups,
  MatchLiveDetail,
  GoalEvent,
} from "./types";
import { flagUrl, isoCode } from "./countries";

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
// fd.org memakai "HOME_TEAM"/"AWAY_TEAM" — samakan dengan tipe internal
function fdWinner(w: any): "HOME" | "AWAY" | "DRAW" | null {
  if (w === "HOME_TEAM") return "HOME";
  if (w === "AWAY_TEAM") return "AWAY";
  if (w === "DRAW") return "DRAW";
  return null;
}

function normalizeFootballData(raw: any): Match[] {
  return (raw.matches ?? []).map((m: any): Match => {
    // kuirk fd.org v4: pada laga adu penalti, fullTime = regularTime +
    // extraTime + PENALTI (mis. 4-5 untuk laga 1-1 pen 3-4). Skor laga yang
    // benar = agregat 120 menit, tanpa tendangan adu penalti.
    let h = m.score?.fullTime?.home ?? null;
    let a = m.score?.fullTime?.away ?? null;
    if (m.score?.duration === "PENALTY_SHOOTOUT" && m.score?.regularTime) {
      h = (m.score.regularTime.home ?? 0) + (m.score.extraTime?.home ?? 0);
      a = (m.score.regularTime.away ?? 0) + (m.score.extraTime?.away ?? 0);
    }
    const pen = m.score?.penalties;
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
      score: {
        home: h,
        away: a,
        winner: fdWinner(m.score?.winner) ?? winnerOf(h, a),
        penalties: pen?.home != null ? { home: pen.home, away: pen.away } : null,
      },
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
    const short = r.fixture?.status?.short;
    // laga gugur yang berakhir imbang diputuskan adu penalti — goals tetap
    // imbang, jadi pemenang harus diambil dari skor penalti (bukan "DRAW")
    const pen = r.score?.penalty;
    const penWinner =
      pen?.home != null && pen?.away != null && pen.home !== pen.away
        ? pen.home > pen.away
          ? ("HOME" as const)
          : ("AWAY" as const)
        : null;
    return {
      id: String(r.fixture?.id),
      utcDate: r.fixture?.date,
      status: AF_STATUS[short] ?? "UNKNOWN",
      stage: isGroup ? "GROUP_STAGE" : round.toUpperCase().replace(/\s+/g, "_"),
      group: isGroup ? round.replace(/\s*-.*/, "").trim() : null,
      matchday: null,
      venue: r.fixture?.venue?.name ?? null,
      home: { name: r.teams?.home?.name, crest: r.teams?.home?.logo },
      away: { name: r.teams?.away?.name, crest: r.teams?.away?.logo },
      score: {
        home: h,
        away: a,
        winner: penWinner ?? winnerOf(h, a),
        penalties: pen?.home != null ? { home: pen.home, away: pen.away } : null,
      },
      minute: r.fixture?.status?.elapsed ?? null,
      // BT = jeda sebelum perpanjangan waktu, P = adu penalti berlangsung
      livePhase: short === "ET" || short === "BT" ? "ET" : short === "P" ? "PEN" : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Fallback: openfootball/worldcup.json (tanpa API key)
// ---------------------------------------------------------------------------
function normalizeOpenFootball(raw: any): Match[] {
  return (raw.matches ?? []).map((m: any, i: number): Match => {
    const ft = m.score?.ft ?? [null, null];
    const et = m.score?.et; // agregat SETELAH perpanjangan waktu (bukan gol ET saja)
    const pen = m.score?.p ?? m.score?.pen; // skor adu penalti
    const h = et?.[0] ?? ft[0] ?? null;
    const a = et?.[1] ?? ft[1] ?? null;
    // laga gugur imbang diputuskan adu penalti — pemenang dari skor penalti
    const penWinner =
      pen && pen[0] !== pen[1] ? (pen[0] > pen[1] ? ("HOME" as const) : ("AWAY" as const)) : null;
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
      score: {
        home: h,
        away: a,
        winner: penWinner ?? winnerOf(h, a),
        penalties: pen ? { home: pen[0], away: pen[1] } : null,
      },
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

// Detail /matches/{id} fd.org dipakai getLineups DAN getMatchDetail — satu
// helper supaya fetch-nya identik (Next.js men-dedup GET yang sama per render,
// jadi kuota API tidak bertambah).
async function fetchFdMatch(matchId: string): Promise<any | null> {
  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!fdKey) return null;
  const res = await fetch(`${FD_BASE}/matches/${matchId}`, {
    headers: { "X-Auth-Token": fdKey },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getLineups(
  matchId: string,
  source: DataSource,
  homeName: string
): Promise<MatchLineups | null> {
  try {
    if (source === "football-data.org") {
      const raw = await fetchFdMatch(matchId);
      if (!raw) return null;
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

// ---------------------------------------------------------------------------
// Public: getMatchDetail() — menit berjalan + event gol satu laga (untuk model
// probabilitas live). football-data.org: dari detail /matches/{id} yang sama
// dengan lineup; API-Football: endpoint /fixtures/events. Fallback openfootball
// tidak punya data ini -> null (bagian live disembunyikan).
// ---------------------------------------------------------------------------

// Rekonsiliasi arah own goal: dokumentasi kedua sumber ambigu soal tim mana
// yang tercatat pada gol bunuh diri. Kalau rekonstruksi skor dari event tidak
// cocok dengan skor resmi, coba balik sisi semua own goal — kalau jadi cocok,
// pakai versi itu. Tetap tak cocok? kembalikan apa adanya (buildTimeline
// selalu memakai skor resmi untuk titik akhir).
function reconcileOwnGoals(
  events: GoalEvent[],
  finalHome: number | null,
  finalAway: number | null
): GoalEvent[] {
  if (finalHome === null || finalAway === null) return events;
  const count = (evs: GoalEvent[]): [number, number] =>
    evs.reduce<[number, number]>(
      (acc, e) => (e.side === "HOME" ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]),
      [0, 0]
    );
  const [h, a] = count(events);
  if (h === finalHome && a === finalAway) return events;
  const flipped = events.map((e): GoalEvent =>
    e.type === "OWN" ? { ...e, side: e.side === "HOME" ? "AWAY" : "HOME" } : e
  );
  const [fh, fa] = count(flipped);
  if (fh === finalHome && fa === finalAway) return flipped;
  return events;
}

function normalizeFdDetail(raw: any, match: Match): MatchLiveDetail {
  const homeId = raw.homeTeam?.id;
  const duration = raw.score?.duration ?? null;
  const events: GoalEvent[] = ((raw.goals ?? []) as any[])
    .filter((g) => g?.minute != null)
    .map((g): GoalEvent => ({
      minute: Math.min(Number(g.minute), 120),
      extra: g.injuryTime ?? null,
      side: g.team?.id != null && g.team.id === homeId ? "HOME" : "AWAY",
      scorer: g.scorer?.name ?? null,
      type: g.type === "OWN" ? "OWN" : g.type === "PENALTY" ? "PENALTY" : "REGULAR",
    }));
  const pen = raw.score?.penalties;
  const minute = raw.minute != null && Number.isFinite(Number(raw.minute)) ? Number(raw.minute) : null;
  return {
    minute,
    phaseHint:
      duration === "PENALTY_SHOOTOUT" && match.status !== "FINISHED"
        ? "PEN"
        : minute != null && minute > 90
          ? "ET"
          : null,
    events: reconcileOwnGoals(events, match.score.home, match.score.away),
    penalties: pen?.home != null ? { home: pen.home, away: pen.away } : null,
    duration,
  };
}

// --- Event gol dari openfootball (fallback universal, gratis tanpa key) -----
// goals1/goals2 memuat menit ("90+4"), penanda owngoal/penalty, plus skor
// ht/ft/et/p. Tier gratis football-data.org TIDAK menyertakan array goals,
// jadi untuk laga selesai event diambil dari sini. Data diperbarui relawan
// (bukan realtime) — untuk laga live, guard rekonsiliasi skor di UI yang
// memutuskan grafik layak tampil atau tidak.
function ofGoalEvents(m: any, flip: boolean): GoalEvent[] {
  const parse = (g: any, side: "HOME" | "AWAY"): GoalEvent | null => {
    const mm = String(g?.minute ?? "").match(/^(\d+)(?:\+(\d+))?$/);
    if (!mm) return null;
    return {
      minute: Math.min(Number(mm[1]), 120),
      extra: mm[2] ? Number(mm[2]) : null,
      side,
      scorer: g?.name ?? null,
      // goals1/goals2 sudah tercatat pada tim yang MENDAPAT gol (own goal ikut)
      type: g?.owngoal ? "OWN" : g?.penalty ? "PENALTY" : "REGULAR",
    };
  };
  const s1 = flip ? "AWAY" : "HOME";
  const s2 = flip ? "HOME" : "AWAY";
  return [
    ...(m?.goals1 ?? []).map((g: any) => parse(g, s1)),
    ...(m?.goals2 ?? []).map((g: any) => parse(g, s2)),
  ].filter((e: GoalEvent | null): e is GoalEvent => e !== null);
}

// samakan nama tim antar sumber lewat kode ISO bendera ("USA" = "United States")
function canonTeam(name: string): string {
  return isoCode(name) ?? name.trim().toLowerCase();
}

async function getOpenFootballDetail(match: Match): Promise<MatchLiveDetail | null> {
  const res = await fetch(OPENFOOTBALL_URL, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const raw = await res.json();

  const t = Date.parse(match.utcDate);
  const h = canonTeam(match.home.name);
  const a = canonTeam(match.away.name);
  let best: { m: any; flip: boolean; dt: number } | null = null;
  for (const m of raw?.matches ?? []) {
    const t1 = canonTeam(m.team1 ?? "");
    const t2 = canonTeam(m.team2 ?? "");
    const straight = t1 === h && t2 === a;
    const flipped = t1 === a && t2 === h;
    if (!straight && !flipped) continue;
    // toleransi 36 jam: tanggal openfootball memakai zona lokal venue
    const dt = Math.abs(Date.parse(toIso(m.date, m.time)) - t);
    if (dt > 36 * 3_600_000) continue;
    if (!best || dt < best.dt) best = { m, flip: flipped, dt };
  }
  if (!best) return null;

  const sc = best.m.score ?? {};
  const pen: [number, number] | null = sc.p ?? sc.pen ?? null;
  return {
    minute: null,
    phaseHint: null,
    events: ofGoalEvents(best.m, best.flip),
    penalties: pen
      ? best.flip
        ? { home: pen[1], away: pen[0] }
        : { home: pen[0], away: pen[1] }
      : null,
    duration: pen ? "PENALTY_SHOOTOUT" : sc.et ? "EXTRA_TIME" : "REGULAR",
  };
}

export async function getMatchDetail(
  match: Match,
  source: DataSource
): Promise<MatchLiveDetail | null> {
  try {
    // detail dari sumber utama (menit live, event bila tier API menyediakan)
    let primary: MatchLiveDetail | null = null;

    if (source === "football-data.org") {
      const raw = await fetchFdMatch(match.id);
      if (raw) primary = normalizeFdDetail(raw, match);
    }

    if (source === "api-football") {
      const afKey = process.env.API_FOOTBALL_KEY;
      if (afKey) {
        const res = await fetch(
          `https://v3.football.api-sports.io/fixtures/events?fixture=${match.id}`,
          {
            headers: { "x-apisports-key": afKey },
            next: { revalidate: REVALIDATE_SECONDS },
          }
        );
        if (res.ok) {
          const rows: any[] = (await res.json()).response ?? [];
          const events: GoalEvent[] = rows
            // hanya gol sungguhan — penalti gagal & tendangan adu penalti dibuang
            .filter(
              (e) =>
                e?.type === "Goal" &&
                e.detail !== "Missed Penalty" &&
                e.comments !== "Penalty Shootout"
            )
            .map((e): GoalEvent => {
              const scoredByHome = e.team?.name === match.home.name;
              const own = e.detail === "Own Goal";
              return {
                minute: Math.min(e.time?.elapsed ?? 0, 120),
                extra: e.time?.extra ?? null,
                // own goal tercatat atas tim pencetak — gol dihitung untuk lawan
                side: (own ? !scoredByHome : scoredByHome) ? "HOME" : "AWAY",
                scorer: e.player?.name ?? null,
                type: own ? "OWN" : e.detail === "Penalty" ? "PENALTY" : "REGULAR",
              };
            });
          // menit & fase live untuk sumber ini sudah menempel di Match
          // (fixture.status.elapsed / livePhase) — tak perlu fetch tambahan
          primary = {
            minute: match.minute ?? null,
            phaseHint: match.livePhase ?? null,
            events: reconcileOwnGoals(events, match.score.home, match.score.away),
            penalties: match.score.penalties ?? null,
            duration: null,
          };
        }
      }
    }

    // sumber utama tak punya event (tier gratis / sumber openfootball):
    // ambil event dari openfootball, pertahankan menit & fase sumber utama
    if (!primary || primary.events.length === 0) {
      const of = await getOpenFootballDetail(match);
      if (of) {
        return {
          minute: primary?.minute ?? null,
          phaseHint: primary?.phaseHint ?? null,
          events: of.events,
          penalties: primary?.penalties ?? of.penalties,
          duration:
            primary?.duration && primary.duration !== "REGULAR"
              ? primary.duration
              : of.duration,
        };
      }
    }
    return primary;
  } catch {
    // detail live bersifat opsional — jangan sampai mematahkan halaman laga
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
