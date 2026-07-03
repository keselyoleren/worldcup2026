export type MatchStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "UNKNOWN";

export interface Team {
  name: string;
  code?: string; // 3-letter (untuk bendera)
  crest?: string; // URL logo
}

export interface Match {
  id: string;
  utcDate: string; // ISO
  status: MatchStatus;
  stage: string; // "GROUP_STAGE" | "ROUND_OF_16" | ...
  group: string | null; // "Group A" | null
  matchday: number | null;
  venue: string | null;
  home: Team;
  away: Team;
  score: {
    home: number | null;
    away: number | null;
    winner: "HOME" | "AWAY" | "DRAW" | null;
    penalties?: { home: number; away: number } | null; // skor adu penalti (fase gugur)
  };
  minute?: number | null; // menit berjalan dari sumber live (API-Football)
  livePhase?: "ET" | "PEN" | null; // penanda perpanjangan waktu / adu penalti
}

// Fase laga — dipakai model probabilitas live (lib/live-probability.ts)
export type MatchPhase = "PRE" | "1H" | "HT" | "2H" | "ET" | "PEN" | "FT";

// Event gol dalam laga (tendangan adu penalti TIDAK termasuk)
export interface GoalEvent {
  minute: number; // menit reguler; gol injury time memakai batas babak (45/90/120)
  extra: number | null; // menit tambahan, mis. 45+2 -> minute 45, extra 2
  side: "HOME" | "AWAY"; // tim yang MENDAPAT gol (own goal sudah dibalik)
  scorer: string | null;
  type: "REGULAR" | "OWN" | "PENALTY";
}

// Detail live satu laga (menit + event gol) — hanya dari sumber realtime;
// fallback openfootball tidak punya data ini (null)
export interface MatchLiveDetail {
  minute: number | null; // menit berjalan dari API (null jika tidak tersedia)
  phaseHint: MatchPhase | null; // petunjuk fase dari status detail (ET/PEN)
  events: GoalEvent[];
  penalties: { home: number; away: number } | null;
  duration: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | null;
}

// Pencetak gol turnamen (dari endpoint /scorers football-data.org)
export interface Scorer {
  id: number;
  name: string;
  team: string;
  teamCrest?: string;
  goals: number;
  assists: number;
  penalties: number;
  played: number;
  dateOfBirth?: string;
}

// Susunan pemain (lineup) — dari football-data.org /matches/{id}
// atau API-Football /fixtures/lineups; sumber fallback tidak punya data ini
export interface LineupPlayer {
  id: number | null;
  name: string;
  shirtNumber: number | null;
  position: string | null; // "Goalkeeper" (fd.org) atau "G"/"D"/"M"/"F" (api-football)
  grid: string | null; // "baris:kolom" dari api-football, untuk plot posisi di lapangan
}

export interface TeamLineup {
  formation: string | null; // mis. "4-3-3"
  coach: string | null;
  startXI: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MatchLineups {
  home: TeamLineup | null;
  away: TeamLineup | null;
}

// Video highlight/cuplikan pertandingan (dari Highlightly API)
export interface Highlight {
  id: string;
  title: string;
  embedUrl: string | null; // bisa dipasang di <iframe>; null jika hanya link keluar
  url: string; // link ke sumber video (YouTube dll)
  imgUrl?: string; // thumbnail
  source: string; // platform asal, mis. "youtube"
  channel?: string;
  verified: boolean; // type === "VERIFIED" dari API
  matchTitle?: string; // "Home vs Away" dari metadata match
  date?: string; // tanggal laga (ISO)
}

export type DataSource = "football-data.org" | "api-football" | "openfootball (fallback)";

export interface MatchesPayload {
  source: DataSource;
  isLive: boolean; // true jika dari API realtime
  fetchedAt: string;
  matches: Match[];
}
