import { getMatches } from "@/lib/football-api";
import { TebakSkor } from "@/components/TebakSkor";
import { SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

export default async function TebakSkorPage() {
  const { matches, source, isLive } = await getMatches();

  return (
    <div>
      <PageHeader
        kicker="Skor tepat = 3 poin · Pemenang benar = 1 poin"
        title="Tebak Skor"
        sub="Tebak skor akhir tiap laga sebelum kick-off. Poin dihitung otomatis setelah laga selesai, dan tebakanmu tersimpan di browser."
      />

      <SourceBanner source={source} isLive={isLive} />

      <TebakSkor matches={matches} />
    </div>
  );
}
