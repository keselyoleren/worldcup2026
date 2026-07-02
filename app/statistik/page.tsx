import { getMatches } from "@/lib/football-api";
import { computeStandings, computeStats, goalsPerMatchday, goalsPerGroup } from "@/lib/stats";
import { Crest, StatTile } from "@/components/ui";
import { BarChart } from "@/components/charts";

export const revalidate = 60;

export default async function StatistikPage() {
  const { matches } = await getMatches();
  const standings = computeStandings(matches);
  const stats = computeStats(matches);
  const groups = Object.keys(standings);
  const perMatchday = goalsPerMatchday(matches);
  const perGroup = goalsPerGroup(matches);

  return (
    <div>
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Pertandingan Selesai" value={`${stats.played}/${stats.totalMatches}`} />
        <StatTile label="Total Gol" value={stats.totalGoals} />
        <StatTile label="Rata-rata Gol/Laga" value={stats.avgGoals} />
        <StatTile label="Kemenangan Terbesar" value={stats.biggestWin?.label ?? "—"} small />
      </div>

      {(perMatchday.length > 0 || perGroup.length > 0) && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold">📉 Tren Gol</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {perMatchday.length > 0 && (
              <div className="card p-4">
                <div className="overline mb-3">Gol per Matchday (Fase Grup)</div>
                <BarChart
                  data={perMatchday.map((d) => ({
                    label: `MD ${d.matchday}`,
                    values: [{ key: "gol", value: d.goals }],
                  }))}
                  series={[{ key: "gol", label: "Gol", color: "var(--color-chart-1)" }]}
                  showValues
                />
              </div>
            )}
            {perGroup.length > 0 && (
              <div className="card p-4">
                <div className="overline mb-3">Sebaran Gol per Grup</div>
                <BarChart
                  data={perGroup.map((d) => ({
                    label: d.group.replace("Group ", ""),
                    values: [{ key: "gol", value: d.goals }],
                  }))}
                  series={[{ key: "gol", label: "Gol", color: "var(--color-chart-3)" }]}
                  showValues
                />
              </div>
            )}
          </div>
        </section>
      )}

      {stats.topScorers.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold">⚽ Tim dengan Gol Terbanyak</h2>
          <div className="card divide-y divide-white/5">
            {stats.topScorers.map((t, i) => (
              <div key={t.team} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 text-sm text-(--color-muted)">{i + 1}</span>
                <Crest src={t.crest} name={t.team} />
                <span className="flex-1 text-sm">{t.team}</span>
                <span className="font-black text-(--color-accent)">{t.goals}</span>
                <span className="text-xs text-(--color-muted)">gol</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.length === 0 ? (
        <p className="py-8 text-center text-(--color-muted)">
          Klasemen akan muncul setelah pertandingan fase grup dimulai.
        </p>
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-bold">📋 Klasemen Grup</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g} className="card overflow-hidden">
                <div className="border-b border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">{g}</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase text-(--color-muted)">
                      <th className="px-3 py-2 text-left font-medium">Tim</th>
                      <th className="px-1.5 py-2 text-center font-medium" title="Main">M</th>
                      <th className="px-1.5 py-2 text-center font-medium" title="Menang">Mng</th>
                      <th className="px-1.5 py-2 text-center font-medium" title="Seri">S</th>
                      <th className="px-1.5 py-2 text-center font-medium" title="Kalah">K</th>
                      <th className="px-1.5 py-2 text-center font-medium" title="Selisih Gol">SG</th>
                      <th className="px-2 py-2 text-center font-semibold text-white/80">Poin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings[g].map((r, i) => (
                      <tr key={r.team} className={`border-t border-white/5 ${i < 2 ? "bg-emerald-500/5" : ""}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Crest src={r.crest} name={r.team} />
                            <span className="truncate">{r.team}</span>
                          </div>
                        </td>
                        <td className="px-1.5 text-center text-white/75">{r.played}</td>
                        <td className="px-1.5 text-center text-white/75">{r.win}</td>
                        <td className="px-1.5 text-center text-white/75">{r.draw}</td>
                        <td className="px-1.5 text-center text-white/75">{r.loss}</td>
                        <td className="px-1.5 text-center text-white/75">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                        <td className="px-2 text-center font-black text-(--color-accent)">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-(--color-muted)">
            <span className="inline-block h-2 w-3 rounded-sm bg-emerald-500/40 align-middle" /> Baris hijau = posisi 2 besar grup, lolos ke fase gugur.
          </p>
        </section>
      )}
    </div>
  );
}
