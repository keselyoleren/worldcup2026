import { getMatches, getScorers } from "@/lib/football-api";
import { liveRatings } from "@/lib/elo";
import { predictGoldenBoot } from "@/lib/simulate";
import { SepatuEmas } from "@/components/SepatuEmas";
import { SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

const ITERATIONS = 10000;

export default async function SepatuEmasPage() {
  const [{ matches, source, isLive }, scorers] = await Promise.all([getMatches(), getScorers()]);
  const ratings = liveRatings(matches);
  const entries = predictGoldenBoot(matches, scorers, ratings, ITERATIONS);

  return (
    <div>
      <PageHeader
        kicker="Perburuan Top Skor"
        title="Sepatu Emas"
        sub="Siapa yang pulang membawa Sepatu Emas? Bukan cuma soal siapa yang unggul hari ini — pemain yang timnya melaju jauh punya lebih banyak laga untuk mengejar. Kami memproyeksikan sisa turnamen ribuan kali untuk menghitung peluang tiap pemburu gol."
      />

      <SourceBanner source={source} isLive={isLive} />

      <SepatuEmas entries={entries} iterations={ITERATIONS} />
    </div>
  );
}
