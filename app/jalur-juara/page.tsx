import { getMatches } from "@/lib/football-api";
import { liveRatings } from "@/lib/elo";
import { predictPaths } from "@/lib/simulate";
import { JalurJuara } from "@/components/JalurJuara";
import { SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

const ITERATIONS = 10000;

export default async function JalurJuaraPage() {
  const { matches, source, isLive } = await getMatches();
  const ratings = liveRatings(matches);
  const paths = predictPaths(matches, ratings, ITERATIONS);

  return (
    <div>
      <PageHeader
        kicker="Peta Jalan Tiap Tim"
        title="Jalur Juara"
        sub="Pilih tim favoritmu dan lihat jalan yang harus mereka lalui menuju trofi: siapa lawan yang paling mungkin di tiap ronde, seberapa besar peluang lolosnya, dan di gerbang mana langkah mereka paling rawan terhenti."
      />

      <SourceBanner source={source} isLive={isLive} />

      <JalurJuara paths={paths} />
    </div>
  );
}
