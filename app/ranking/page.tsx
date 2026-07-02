import { getMatches } from "@/lib/football-api";
import { computeElo } from "@/lib/elo";
import { PageHeader, SourceBanner } from "@/components/ui";
import { Ranking } from "@/components/Ranking";

export const revalidate = 60;

export default async function RankingPage() {
  const { matches, source, isLive } = await getMatches();
  const elo = computeElo(matches);

  return (
    <div>
      <PageHeader
        kicker="Kekuatan Tim Terkini"
        title="Peringkat Elo"
        sub="Rating Elo tiap tim ter-update otomatis dari setiap hasil laga turnamen — menang lawan tim kuat menaikkan rating lebih banyak. Rating inilah yang dipakai mesin prediksi dan simulasi."
      />
      <SourceBanner source={source} isLive={isLive} />

      {elo.updatedMatches === 0 && (
        <p className="mb-6 border-l-2 border-(--color-accent) pl-3 text-sm text-(--color-muted)">
          Rating akan bergerak setelah laga pertama selesai — saat ini masih rating awal pra-turnamen.
        </p>
      )}

      <Ranking table={elo.table} history={elo.history} />
    </div>
  );
}
