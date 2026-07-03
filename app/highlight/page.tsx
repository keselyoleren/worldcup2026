import { getTournamentHighlights } from "@/lib/highlights";
import { HighlightCard } from "@/components/Highlights";
import { PageHeader } from "@/components/ui";

export const revalidate = 1800; // hemat kuota Highlightly (100 req/hari)

export default async function HighlightPage() {
  const highlights = await getTournamentHighlights();

  return (
    <div>
      <PageHeader
        kicker="FIFA World Cup 2026 · Canada / USA / Mexico"
        title="Highlight Pertandingan"
        sub="Cuplikan video gol dan highlight terbaru Piala Dunia 2026 dari channel resmi FIFA, diperbarui otomatis setiap 30 menit."
      />

      {highlights.length === 0 ? (
        <div className="card p-6 text-sm text-(--color-muted)">
          <p>
            Belum ada video highlight yang tersedia saat ini. Coba lagi setelah ada
            pertandingan selesai.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((h) => (
            <HighlightCard key={h.id} h={h} />
          ))}
        </div>
      )}
    </div>
  );
}
