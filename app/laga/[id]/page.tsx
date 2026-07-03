import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatches, getScorers } from "@/lib/football-api";
import { predict, pct } from "@/lib/prediction";
import { liveRatings } from "@/lib/elo";
import { teamForm, headToHead } from "@/lib/stats";
import { isRealTeam } from "@/lib/simulate";
import { teamGoalsMap, matchThreats } from "@/lib/players";
import { Crest, StatusBadge, ProbBar, FormBadges, MatchCard, SourceBanner } from "@/components/ui";
import { ScoreHeatmap } from "@/components/ScoreHeatmap";
import { DuelBintang } from "@/components/DuelBintang";

export const revalidate = 60;
// id match berbeda antar sumber data (numeric vs "of-*") — jangan pre-render

export default async function LagaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ matches, source, isLive }, scorers] = await Promise.all([getMatches(), getScorers()]);
  const match = matches.find((m) => m.id === id);
  if (!match) notFound();

  const { home, away, score, status } = match;
  const predictable = isRealTeam(home.name) && isRealTeam(away.name);
  const showScore = status === "FINISHED" || status === "IN_PLAY" || status === "PAUSED";
  const finished = status === "FINISHED" && score.home !== null && score.away !== null;

  const ratings = liveRatings(matches);
  const p = predictable ? predict(home.name, away.name, ratings) : null;
  const threats = predictable
    ? matchThreats(home.name, away.name, scorers, teamGoalsMap(matches), ratings)
    : { home: null, away: null };
  const formHome = predictable ? teamForm(matches, home.name) : [];
  const formAway = predictable ? teamForm(matches, away.name) : [];
  const h2h = predictable
    ? headToHead(matches, home.name, away.name).filter((m) => m.id !== match.id)
    : [];

  const kickoff = new Date(match.utcDate).toLocaleString("id-ID", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div>
      <Link href="/" className="mb-5 inline-block text-xs font-bold uppercase tracking-wide text-(--color-muted) transition hover:text-(--color-fg)">
        ← Kembali ke Jadwal
      </Link>

      <SourceBanner source={source} isLive={isLive} />

      {/* Hero */}
      <div className="card mb-6 p-5 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <span className="overline">{match.group ?? match.stage.replace(/_/g, " ")}</span>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <HeroTeam name={home.name} crest={home.crest} win={score.winner === "HOME"} />
          <div className="px-2 text-center">
            {showScore && score.home !== null ? (
              <div className="tnum text-5xl text-(--color-accent) sm:text-6xl">
                {score.home}–{score.away}
              </div>
            ) : (
              <div className="display text-2xl text-(--color-muted) sm:text-3xl">VS</div>
            )}
          </div>
          <HeroTeam name={away.name} crest={away.crest} win={score.winner === "AWAY"} right />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-(--color-line) pt-4 text-xs text-(--color-muted)">
          <span>🗓 {kickoff}</span>
          {match.venue && <span>📍 {match.venue}</span>}
        </div>
      </div>

      {!predictable || !p ? (
        <p className="py-10 text-center text-(--color-muted)">
          Analisis dan prediksi tersedia setelah kedua tim dipastikan.
        </p>
      ) : (
        <>
          {/* Peluang hasil */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">📊 Peluang Hasil</h2>
            <div className="card p-4">
              <ProbBar
                homeLabel={home.name}
                awayLabel={away.name}
                homeWin={p.homeWin}
                draw={p.draw}
                awayWin={p.awayWin}
              />
              <p className="mt-3 text-[11px] text-(--color-muted)">
                {finished
                  ? "Prediksi model sebelum laga — bandingkan dengan hasil sebenarnya di peta skor."
                  : "Dihitung dari kekuatan Elo terkini kedua tim (model Poisson)."}
              </p>
            </div>
          </section>

          {/* Heatmap + skor paling mungkin */}
          <section className="mb-8 grid gap-5 md:grid-cols-2">
            <div className="card p-4">
              <h2 className="mb-3 text-lg font-bold">🎯 Peta Skor</h2>
              <ScoreHeatmap
                matrix={p.matrix}
                homeName={home.name}
                awayName={away.name}
                highlight={finished ? { home: score.home!, away: score.away! } : undefined}
              />
              <p className="mt-2 text-[11px] text-(--color-muted)">
                Makin terang kotaknya, makin besar peluang skor tersebut.
              </p>
            </div>
            <div className="card p-4">
              <h2 className="mb-3 text-lg font-bold">🔢 Skor Paling Mungkin</h2>
              <div className="flex flex-wrap gap-2">
                {p.topScores.map((s, i) => (
                  <span
                    key={s.score}
                    className={`tnum rounded-sm px-3 py-1.5 text-lg ${
                      i === 0
                        ? "bg-(--color-accent) text-(--color-ink)"
                        : "bg-(--color-surface-2) text-(--color-fg)"
                    }`}
                  >
                    {s.score} <span className="text-sm opacity-70">{pct(s.prob)}</span>
                  </span>
                ))}
              </div>
              <p className="mt-4 border-t border-(--color-line) pt-3 text-xs text-(--color-muted)">
                Perkiraan gol: <b className="text-(--color-fg)">{p.homeXg}</b> –{" "}
                <b className="text-(--color-fg)">{p.awayXg}</b>
              </p>
              <p className="mt-1.5 text-xs text-(--color-muted)">
                Kekuatan: {home.name} <b className="text-(--color-fg)">{Math.round(p.homeRating)}</b> ·{" "}
                {away.name} <b className="text-(--color-fg)">{Math.round(p.awayRating)}</b>
              </p>
            </div>
          </section>

          {/* Duel bintang kedua tim */}
          <DuelBintang home={threats.home} away={threats.away} finished={finished} />

          {/* Form 5 laga terakhir */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">📈 Performa 5 Laga Terakhir</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { team: home, form: formHome },
                { team: away, form: formAway },
              ].map(({ team, form }) => (
                <div key={team.name} className="card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Crest src={team.crest} name={team.name} />
                    <span className="text-sm font-bold">{team.name}</span>
                  </div>
                  <FormBadges
                    results={form.map((f) => ({
                      result: f.result,
                      label: `${f.score} vs ${f.opponent}`,
                    }))}
                  />
                  <p className="mt-2 text-[11px] text-(--color-muted)">Paling kiri = laga terbaru.</p>
                </div>
              ))}
            </div>
          </section>

          {/* Head to head */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-bold">🤝 Pertemuan di Turnamen Ini</h2>
            {h2h.length === 0 ? (
              <p className="text-sm text-(--color-muted)">
                Ini pertemuan pertama kedua tim di turnamen ini.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {h2h.map((m) => (
                  <MatchCard key={m.id} match={m} href={`/laga/${m.id}`} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function HeroTeam({ name, crest, win, right }: { name: string; crest?: string; win: boolean; right?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-2 ${right ? "" : ""}`}>
      <Crest src={crest} name={name} size={44} />
      <span className={`display text-center text-xl sm:text-2xl ${win ? "text-(--color-fg)" : "text-(--color-fg)/80"}`}>
        {name}
      </span>
    </div>
  );
}
