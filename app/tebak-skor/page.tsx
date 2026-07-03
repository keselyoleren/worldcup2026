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
        sub="Masuk dengan Google, tebak skor akhir tiap laga sebelum kick-off, dan lihat tebakan user lain. Poin dihitung otomatis setelah laga selesai — tebakanmu tersimpan di database dan bisa diakses dari perangkat mana pun."
      />

      <SourceBanner source={source} isLive={isLive} />

      <TebakSkor matches={matches} />
    </div>
  );
}
