import { getMatches } from "@/lib/football-api";
import { Bracket } from "@/components/Bracket";
import { SourceBanner, PageHeader } from "@/components/ui";

export const revalidate = 60;

export default async function BracketPage() {
  const { matches, source, isLive } = await getMatches();

  return (
    <div>
      <PageHeader
        kicker="Prediksi Fase Gugur"
        title="Bracket Juara"
        sub="Pilih pemenang tiap laga dari 32 Besar sampai Final untuk menyusun jalur juara versimu. Pilihanmu tersimpan otomatis di browser."
      />

      <SourceBanner source={source} isLive={isLive} />

      <Bracket matches={matches} />
    </div>
  );
}
