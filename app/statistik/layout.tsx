import { getMatches } from "@/lib/football-api";
import { PageHeader, SourceBanner } from "@/components/ui";
import { SubNav } from "@/components/SubNav";

export const revalidate = 60;

export default async function StatistikLayout({ children }: { children: React.ReactNode }) {
  const { source, isLive } = await getMatches();
  return (
    <div>
      <PageHeader
        kicker="Angka & Klasemen"
        title="Statistik Turnamen"
        sub="Semua angka di bawah ini dihitung otomatis dari hasil pertandingan — klasemen, skenario lolos, sampai indeks kejutan."
      />
      <SubNav
        items={[
          { href: "/statistik", label: "Klasemen" },
          { href: "/statistik/skenario", label: "Skenario Lolos" },
          { href: "/statistik/indeks", label: "Indeks" },
        ]}
      />
      <SourceBanner source={source} isLive={isLive} />
      {children}
    </div>
  );
}
