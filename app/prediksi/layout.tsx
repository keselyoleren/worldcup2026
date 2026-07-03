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
        sub="Perkiraan skor tiap laga dihitung otomatis dari kekuatan terkini kedua tim — bukan tebakan pengamat. Ada juga laporan terbuka soal seberapa akurat prediksi kami sejauh turnamen berjalan."
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
