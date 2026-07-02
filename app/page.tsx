import { getMatches } from "@/lib/football-api";
import { Schedule } from "@/components/Schedule";
import { MatchCard, SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

export default async function HomePage() {
  const { matches, source, isLive } = await getMatches();
  const live = matches.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");

  return (
    <div>
      <PageHeader
        kicker="FIFA World Cup 2026 · Canada / USA / Mexico"
        title="Jadwal Pertandingan"
        sub={`Semua ${matches.length} pertandingan Piala Dunia 2026. Gunakan tombol filter untuk melihat laga yang sedang berlangsung, yang akan datang, atau yang sudah selesai.`}
      />

      <SourceBanner source={source} isLive={isLive} />

      {live.length > 0 && (
        <section className="mb-9">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-(--color-live)">
            <span className="live-dot blink" /> Sedang Berlangsung
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      <Schedule matches={matches} />
    </div>
  );
}
