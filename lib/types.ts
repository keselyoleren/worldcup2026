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
  };
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
