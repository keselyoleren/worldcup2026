import { MatchLineups, TeamLineup, LineupPlayer, Team, MatchStatus } from "@/lib/types";
import { Crest } from "@/components/ui";

// Baris taktis di lapangan. API-Football punya grid "baris:kolom" (1 = kiper);
// football-data.org hanya string posisi, jadi diklasifikasi jadi 4 garis.
function lineOf(p: LineupPlayer): number {
  const g = p.grid?.match(/^(\d+):\d+$/);
  if (g) return Number(g[1]);
  const pos = (p.position ?? "").toLowerCase();
  if (pos === "g" || pos.includes("keeper") || pos.includes("goal")) return 1;
  if (pos === "d" || pos.includes("back") || pos.includes("defen")) return 2;
  if (pos === "m" || pos.includes("midfield")) return 3;
  return 4; // winger / forward / striker / offence
}

function colOf(p: LineupPlayer): number {
  const g = p.grid?.match(/^\d+:(\d+)$/);
  return g ? Number(g[1]) : 0;
}

function tacticalRows(startXI: LineupPlayer[]): LineupPlayer[][] {
  const byLine = new Map<number, LineupPlayer[]>();
  for (const p of startXI) {
    const line = lineOf(p);
    byLine.set(line, [...(byLine.get(line) ?? []), p]);
  }
  return [...byLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, players]) => players.sort((a, b) => colOf(a) - colOf(b)));
}

// Nama singkat agar muat di chip lapangan ("Lionel Messi" -> "Messi")
function shortName(name: string) {
  if (name.length <= 10) return name;
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

function PlayerChip({ p }: { p: LineupPlayer }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1 text-center" title={p.name}>
      <span className="tnum flex h-8 w-8 items-center justify-center rounded-full bg-(--color-surface) text-sm text-(--color-fg) ring-1 ring-(--color-line)">
        {p.shirtNumber ?? "–"}
      </span>
      <span className="w-full truncate text-[10px] leading-tight text-(--color-fg)/85">
        {shortName(p.name)}
      </span>
    </div>
  );
}

function Pitch({ startXI }: { startXI: LineupPlayer[] }) {
  const rows = tacticalRows(startXI);
  return (
    <div className="relative overflow-hidden rounded-sm border border-(--color-win)/25 bg-(--color-win)/[0.06]">
      {/* garis lapangan: kotak penalti (atas, sisi kiper), lingkaran & garis tengah */}
      <div className="pointer-events-none absolute inset-x-[22%] top-0 h-12 rounded-b-sm border border-t-0 border-(--color-win)/20" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[6%] border-t border-(--color-win)/20" />
      <div className="pointer-events-none absolute -bottom-[6%] left-1/2 h-20 w-20 -translate-x-1/2 rounded-full border border-(--color-win)/20" />
      <div className="relative flex min-h-[340px] flex-col justify-between gap-3 px-1 py-4">
        {rows.map((row, i) => (
          <div key={i} className="flex items-start justify-evenly">
            {row.map((p, j) => (
              <PlayerChip key={p.id ?? `${i}-${j}`} p={p} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamLineupCard({ team, lineup }: { team: Team; lineup: TeamLineup | null }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Crest src={team.crest} name={team.name} />
          <span className="truncate text-sm font-bold">{team.name}</span>
        </div>
        {lineup?.formation && (
          <span className="tnum flex-none text-lg text-(--color-accent)">{lineup.formation}</span>
        )}
      </div>

      {!lineup ? (
        <p className="py-8 text-center text-xs text-(--color-muted)">
          Susunan pemain tim ini belum diumumkan.
        </p>
      ) : (
        <>
          <Pitch startXI={lineup.startXI} />

          {lineup.coach && (
            <p className="mt-3 text-xs text-(--color-muted)">
              Pelatih: <b className="text-(--color-fg)">{lineup.coach}</b>
            </p>
          )}

          {lineup.bench.length > 0 && (
            <div className="mt-3 border-t border-(--color-line) pt-3">
              <div className="overline mb-2">Cadangan</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {lineup.bench.map((p, i) => (
                  <span key={p.id ?? i} className="text-xs text-(--color-fg)/80">
                    <span className="tnum text-(--color-muted)">{p.shirtNumber ?? "–"}</span>{" "}
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function emptyMessage(isLive: boolean, status: MatchStatus) {
  if (!isLive) return "Sumber data fallback tidak menyediakan susunan pemain.";
  if (status === "SCHEDULED" || status === "TIMED")
    return "Susunan pemain biasanya diumumkan sekitar satu jam sebelum kick-off.";
  return "Susunan pemain laga ini tidak tersedia dari sumber data.";
}

export function LineupSection({
  lineups,
  home,
  away,
  isLive,
  status,
}: {
  lineups: MatchLineups | null;
  home: Team;
  away: Team;
  isLive: boolean;
  status: MatchStatus;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold">📋 Susunan Pemain</h2>
      {!lineups ? (
        <p className="text-sm text-(--color-muted)">{emptyMessage(isLive, status)}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TeamLineupCard team={home} lineup={lineups.home} />
          <TeamLineupCard team={away} lineup={lineups.away} />
        </div>
      )}
    </section>
  );
}
