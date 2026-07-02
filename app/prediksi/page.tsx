import Link from "next/link";
import { getMatches, getScorers } from "@/lib/football-api";
import { predict, pct } from "@/lib/prediction";
import { liveRatings } from "@/lib/elo";
import { teamGoalsMap, matchThreats, Threat } from "@/lib/players";
import { Crest, ProbBar } from "@/components/ui";
import { Match } from "@/lib/types";

export const revalidate = 60;

function isPredictable(m: Match) {
  const upcoming = m.status === "SCHEDULED" || m.status === "TIMED" || m.status === "IN_PLAY";
  const realTeams = m.home.name !== "TBD" && m.away.name !== "TBD" && !/^[WL]\d/.test(m.home.name) && !/^[WL]\d/.test(m.away.name);
  return upcoming && realTeams;
}

export default async function PrediksiPage() {
  const [{ matches }, scorers] = await Promise.all([getMatches(), getScorers()]);
  const upcoming = matches.filter(isPredictable).slice(0, 30);
  const ratings = liveRatings(matches);
  const goals = teamGoalsMap(matches);

  return (
    <div>
      {upcoming.length === 0 ? (
        <p className="py-12 text-center text-(--color-muted)">Belum ada laga yang bisa diprediksi saat ini.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {upcoming.map((m) => (
            <PredictionCard
              key={m.id}
              match={m}
              ratings={ratings}
              threats={matchThreats(m.home.name, m.away.name, scorers, goals, ratings)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionCard({
  match,
  ratings,
  threats,
}: {
  match: Match;
  ratings: Record<string, number>;
  threats: { home: Threat | null; away: Threat | null };
}) {
  const p = predict(match.home.name, match.away.name, ratings);
  const date = new Date(match.utcDate).toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="card p-4 transition hover:border-(--color-fg)">
      <Link href={`/laga/${match.id}`} className="mb-3 flex items-center justify-between text-xs text-(--color-muted)">
        <span>{match.group ?? match.stage.replace(/_/g, " ")}</span>
        <span className="text-(--color-accent)">Analisis lengkap →</span>
      </Link>

      {/* Tim & skor prediksi */}
      <div className="flex items-center justify-between">
        <TeamMini name={match.home.name} crest={match.home.crest} rating={p.homeRating} />
        <div className="px-3 text-center">
          <div className="text-3xl font-black text-(--color-accent)">
            {p.likelyScore.home}–{p.likelyScore.away}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-(--color-muted)">perkiraan skor</div>
        </div>
        <TeamMini name={match.away.name} crest={match.away.crest} rating={p.awayRating} />
      </div>

      {/* Bar probabilitas */}
      <div className="mt-4">
        <ProbBar
          homeLabel={match.home.name}
          awayLabel={match.away.name}
          homeWin={p.homeWin}
          draw={p.draw}
          awayWin={p.awayWin}
        />
      </div>

      {/* Ancaman utama kedua tim */}
      {(threats.home || threats.away) && (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-(--color-muted)">
          <ThreatChip t={threats.home} />
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/40">ancaman</span>
          <ThreatChip t={threats.away} right />
        </div>
      )}

      {/* Perkiraan gol + skor alternatif */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs text-(--color-muted)">
        <span>🕑 {date}</span>
        <span className="flex items-center gap-1.5">
          <span>Skor lain:</span>
          {p.topScores.slice(0, 3).map((s) => (
            <span key={s.score} className="rounded bg-white/5 px-1.5 py-0.5">
              {s.score} <span className="opacity-70">{pct(s.prob)}</span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

function ThreatChip({ t, right }: { t: Threat | null; right?: boolean }) {
  if (!t) return <span className="flex-1" />;
  return (
    <span className={`flex flex-1 items-center gap-1.5 ${right ? "justify-end text-right" : ""}`}>
      <span className="truncate">
        ⚡ <b className="text-(--color-fg)">{t.scorer.name}</b>{" "}
        <span className="whitespace-nowrap">
          {Math.round(t.prob * 100)}% cetak gol
        </span>
      </span>
    </span>
  );
}

function TeamMini({ name, crest, rating }: { name: string; crest?: string; rating: number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <Crest src={crest} name={name} />
      <span className="text-center text-xs font-medium leading-tight">{name}</span>
      <span className="text-[11px] text-(--color-muted)">Elo {Math.round(rating * 10 + 1000)}</span>
    </div>
  );
}
