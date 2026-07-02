import { getMatches } from "@/lib/football-api";
import { PageHeader, SourceBanner } from "@/components/ui";
import { SubNav } from "@/components/SubNav";

export const revalidate = 60;

export default async function PrediksiLayout({ children }: { children: React.ReactNode }) {
  const { source, isLive } = await getMatches();
  return (
    <div>
      <PageHeader
        kicker="Prediksi Otomatis Berbasis Statistik"
        title="Prediksi"
        sub="Perkiraan skor dari model Poisson bertenaga rating Elo live — plus laporan transparan seberapa akurat model ini sejauh turnamen berjalan."
      />
      <SubNav
        items={[
          { href: "/prediksi", label: "Prediksi Skor" },
          { href: "/prediksi/akurasi", label: "Akurasi Model" },
        ]}
      />
      <SourceBanner source={source} isLive={isLive} />
      {children}
    </div>
  );
}
