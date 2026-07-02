import { getMatches } from "@/lib/football-api";
import { computeIndexes } from "@/lib/indexes";
import { Crest } from "@/components/ui";
import { Meter } from "@/components/charts";
import { pct } from "@/lib/prediction";

export const revalidate = 60;

export default async function IndeksPage() {
  const { matches } = await getMatches();
  const { upsets, groupOfDeath, topMatches, excitementByGroup } = computeIndexes(matches);

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-(--color-muted)">
        Tiga indeks khas berbasis data: seberapa mengejutkan sebuah hasil (dibanding ekspektasi Elo
        pra-laga), grup mana yang paling &ldquo;maut&rdquo; sejak undian, dan laga mana yang paling seru.
      </p>

      {/* Indeks Kejutan */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold">⚡ Indeks Kejutan</h2>
        {upsets.length === 0 ? (
          <p className="text-sm text-(--color-muted)">
            Belum ada kejutan — hasil sejauh ini sesuai ekspektasi model.
          </p>
        ) : (
          <div className="card divide-y divide-white/5">
            {upsets.map((u, i) => (
              <div key={u.matchId} className="flex items-center gap-3 px-4 py-3">
                <span className="display w-8 text-2xl text-(--color-muted)">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Crest src={u.dogCrest} name={u.underdog} />
                    <span className="truncate">{u.label}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-(--color-muted)">
                    {u.kind === "MENANG"
                      ? `${u.underdog} menang padahal peluang ${u.favorite} menang ${pct(u.favWinProb)}`
                      : `${u.underdog} menahan ${u.favorite} yang diunggulkan ${pct(u.favWinProb)}`}
                  </p>
                </div>
                <span className="flex-none rounded-sm bg-(--color-accent)/15 px-2 py-1 text-xs font-bold text-(--color-accent)">
                  +{u.eloGap} Elo
                </span>
                <span className="tnum flex-none text-xl text-(--color-accent)">{u.upsetScore}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Grup Maut */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold">💀 Grup Maut</h2>
        {groupOfDeath.length === 0 ? (
          <p className="text-sm text-(--color-muted)">Menunggu undian grup.</p>
        ) : (
          <div className="card divide-y divide-white/5">
            {groupOfDeath.map((g, i) => (
              <div key={g.group} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-20 flex-none text-sm font-bold">
                    {i === 0 && "💀 "}
                    {g.group.replace("Group", "Grup")}
                  </span>
                  <div className="flex-1">
                    <Meter value={g.deathScore} label={`Indeks maut ${g.deathScore}/100`} />
                  </div>
                  <span className="tnum w-8 flex-none text-right text-sm text-(--color-accent)">
                    {g.deathScore}
                  </span>
                </div>
                <p className="mt-1 pl-20 text-[11px] text-(--color-muted)">
                  Rata-rata kekuatan {g.avgRating} · sebaran ±{g.spread} —{" "}
                  {g.teams.map((t) => t.team).join(", ")}
                </p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-(--color-muted)">
          Skor tinggi = grup kuat DAN merata (dihitung dari rating pra-turnamen, mengukur hasil undian).
        </p>
      </section>

      {/* Indeks Seru */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold">🎇 Indeks Seru — Laga Terbaik</h2>
        {topMatches.length === 0 ? (
          <p className="text-sm text-(--color-muted)">Belum ada laga selesai.</p>
        ) : (
          <div className="card divide-y divide-white/5">
            {topMatches.map((e) => (
              <div key={e.matchId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">{e.label}</span>
                <div className="w-28 flex-none sm:w-40">
                  <Meter value={e.excitement} color="var(--color-chart-3)" label={`${e.excitement}/100`} />
                </div>
                <span className="tnum w-8 flex-none text-right text-sm text-(--color-win)">
                  {e.excitement}
                </span>
              </div>
            ))}
          </div>
        )}
        {excitementByGroup.length > 0 && (
          <p className="mt-2 text-[11px] text-(--color-muted)">
            Grup paling seru: <b className="text-(--color-fg)">{excitementByGroup[0].group}</b> (rata-rata{" "}
            {excitementByGroup[0].avgExcitement}/100, {excitementByGroup[0].goalsPerMatch} gol/laga).
            Dihitung dari jumlah gol, ketatnya skor, dan faktor kejutan.
          </p>
        )}
      </section>
    </div>
  );
}
