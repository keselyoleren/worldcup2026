import { getMatches } from "@/lib/football-api";
import { liveRatings } from "@/lib/elo";
import { Simulasi } from "@/components/Simulasi";
import { SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

export default async function SimulasiPage() {
  const { matches, source, isLive } = await getMatches();
  const ratings = liveRatings(matches);

  return (
    <div>
      <PageHeader
        kicker="Simulasi Sisa Turnamen"
        title="Simulasi Juara"
        sub="Komputer memainkan sisa turnamen ribuan kali untuk memperkirakan peluang juara tiap tim. Hasil pertandingan yang sudah selesai tetap dipakai apa adanya."
      />

      <SourceBanner source={source} isLive={isLive} />

      <Simulasi matches={matches} ratings={ratings} />
    </div>
  );
}
