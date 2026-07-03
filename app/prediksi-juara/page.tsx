import { getMatches } from "@/lib/football-api";
import { liveRatings } from "@/lib/elo";
import { predictChampions, buildGroups } from "@/lib/simulate";
import { PrediksiJuara } from "@/components/PrediksiJuara";
import { SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

const ITERATIONS = 10000;

export default async function PrediksiJuaraPage() {
  const { matches, source, isLive } = await getMatches();
  const ratings = liveRatings(matches);
  const odds = predictChampions(matches, ratings, ITERATIONS);

  const groups = buildGroups(matches);
  const pendingGroup = groups.reduce((n, g) => n + g.pending.length, 0);
  const teamCount = groups.reduce((n, g) => n + g.teams.length, 0);

  return (
    <div>
      <PageHeader
        kicker="Siapa yang Bakal Angkat Trofi?"
        title="Prediksi Juara"
        sub="Kami memainkan sisa turnamen 10.000 kali lewat simulasi untuk menghitung peluang tiap tim — dari lolos fase grup sampai jadi juara. Angka diperbarui otomatis setiap ada hasil baru."
      />

      <SourceBanner source={source} isLive={isLive} />

      <PrediksiJuara
        odds={odds}
        iterations={ITERATIONS}
        pendingGroup={pendingGroup}
        teamCount={teamCount}
      />
    </div>
  );
}
