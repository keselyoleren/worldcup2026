import { getMatches } from "@/lib/football-api";
import { computeScenarios, QualStatus } from "@/lib/scenarios";
import { runSimulationsSync } from "@/lib/simulate";
import { liveRatings } from "@/lib/elo";
import { Crest } from "@/components/ui";

export const revalidate = 60;

const PILL: Record<QualStatus, { text: string; cls: string }> = {
  LOLOS_PASTI: { text: "Pasti Lolos", cls: "bg-(--color-win)/15 text-(--color-win)" },
  LOLOS_BERSYARAT: { text: "Masih Berpeluang", cls: "bg-(--color-accent)/15 text-(--color-accent)" },
  HANYA_PERINGKAT_3: { text: "Jalur Peringkat 3", cls: "bg-(--color-away)/15 text-(--color-away)" },
  TERSINGKIR: { text: "Tersingkir", cls: "bg-(--color-live)/15 text-(--color-live)" },
};

export default async function SkenarioPage() {
  const { matches } = await getMatches();

  // odds peringkat-3 dari Monte Carlo ringan (dipakai hanya jika ada grup
  // yang belum selesai — grup tuntas dihitung eksak oleh engine)
  const ratings = liveRatings(matches);
  const odds = runSimulationsSync(matches, 1500, ratings);
  const thirdPlaceOdds = new Map(odds.map((o) => [o.team, o.advance]));

  const groups = computeScenarios(matches, { thirdPlaceOdds });

  if (groups.length === 0) {
    return (
      <p className="py-12 text-center text-(--color-muted)">
        Skenario lolos akan muncul setelah jadwal fase grup tersedia.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-(--color-muted)">
        Dihitung dengan mengenumerasi <b className="text-(--color-fg)">semua kemungkinan hasil</b> sisa
        laga tiap grup — bukan perkiraan. Status &ldquo;pasti&rdquo; benar-benar berarti pasti, apa pun
        hasil laga lain. Jalur peringkat 3 terbaik (lintas grup) dihitung eksak saat semua grup tuntas,
        atau lewat simulasi Monte Carlo selama grup masih berjalan.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.group} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
              <span className="text-sm font-bold">{g.group}</span>
              <span className="text-[11px] text-(--color-muted)">
                {g.decided ? "Grup tuntas" : `${g.remainingMatches} laga tersisa`}
              </span>
            </div>
            <div className="divide-y divide-white/5">
              {g.teams.map((t) => {
                const pill = PILL[t.status];
                return (
                  <div key={t.team} className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="tnum w-4 text-sm text-(--color-muted)">{t.currentRank}</span>
                      <Crest src={t.crest} name={t.team} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.team}</span>
                      <span className="tnum text-sm text-(--color-muted)">{t.currentPoints} poin</span>
                      <span className={`flex-none rounded-sm px-2 py-0.5 text-[11px] font-bold ${pill.cls}`}>
                        {pill.text}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-[26px] text-xs text-(--color-fg)/85">{t.headline}</p>
                    {t.conditions.map((c, i) => (
                      <p key={i} className="mt-1 pl-[26px] text-[11px] text-(--color-muted)">
                        {c.certainty === "TERGANTUNG_SELISIH_GOL" ? "⚖️ " : "• "}
                        {c.text}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
