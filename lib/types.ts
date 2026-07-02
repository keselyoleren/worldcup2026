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

export type DataSource = "football-data.org" | "api-football" | "openfootball (fallback)";

export interface MatchesPayload {
  source: DataSource;
  isLive: boolean; // true jika dari API realtime
  fetchedAt: string;
  matches: Match[];
}
