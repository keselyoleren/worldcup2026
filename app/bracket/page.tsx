import { getMatches } from "@/lib/football-api";
import { liveRatings } from "@/lib/elo";
import { Bracket } from "@/components/Bracket";
import { SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

export default async function BracketPage() {
  const { matches, source, isLive } = await getMatches();
  const ratings = liveRatings(matches);

  return (
    <div>
      <PageHeader
        kicker="Jalur Menuju Final"
        title="Bracket Juara"
        sub="Bracket fase gugur mengikuti data resmi turnamen — laga yang sudah selesai terkunci dengan skornya. Untuk laga yang belum dimainkan, pilih sendiri pemenangnya dan susun jalur juara versimu; pilihan tersimpan otomatis di browser."
      />

      <SourceBanner source={source} isLive={isLive} />

      <Bracket matches={matches} ratings={ratings} />
    </div>
  );
}
