import { Threat } from "@/lib/players";
import { Crest } from "./ui";

// Kartu perbandingan bintang kedua tim untuk satu laga (server component).
export function DuelBintang({
  home,
  away,
  finished,
}: {
  home: Threat | null;
  away: Threat | null;
  finished: boolean;
}) {
  if (!home && !away) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold">⭐ Duel Bintang</h2>
      <div className="card p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <StarSide t={home} finished={finished} />
          <div className="self-center px-1 text-center text-xs font-bold uppercase tracking-widest text-(--color-muted)">
            vs
          </div>
          <StarSide t={away} finished={finished} right />
        </div>
        <p className="mt-4 border-t border-(--color-line) pt-3 text-[11px] text-(--color-muted)">
          Pencetak gol terbanyak tiap tim di turnamen ini. Peluang mencetak gol dihitung dari
          perkiraan gol timnya (model Poisson) dikali porsi gol yang biasa ia sumbang
          {finished ? " — angka prediksi sebelum laga." : "."}
        </p>
      </div>
    </section>
  );
}

function StarSide({ t, finished, right }: { t: Threat | null; finished: boolean; right?: boolean }) {
  if (!t)
    return (
      <div className={`text-xs italic text-(--color-muted) ${right ? "text-right" : ""}`}>
        Belum ada pencetak gol menonjol.
      </div>
    );
  const s = t.scorer;
  const perGame = s.played ? (s.goals / s.played).toFixed(2) : "0";
  return (
    <div className={`min-w-0 ${right ? "text-right" : ""}`}>
      <div className={`flex items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <Crest src={s.teamCrest} name={s.team} size={20} />
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{s.name}</div>
          <div className="text-[11px] text-(--color-muted)">{s.team}</div>
        </div>
      </div>
      <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--color-muted) ${right ? "justify-end" : ""}`}>
        <span>
          <b className="text-(--color-fg)">{s.goals}</b> gol
        </span>
        <span>
          <b className="text-(--color-fg)">{s.assists}</b> assist
        </span>
        <span>
          <b className="text-(--color-fg)">{perGame}</b> gol/laga
        </span>
        <span>
          <b className="text-(--color-fg)">{Math.round(t.share * 100)}%</b> gol timnya
        </span>
      </div>
      <div className={`mt-2 ${right ? "text-right" : ""}`}>
        <span className="inline-block rounded-sm bg-(--color-accent)/15 px-2 py-1 text-xs font-bold text-(--color-accent)">
          {Math.round(t.prob * 100)}% {finished ? "diprediksi" : "peluang"} cetak gol
        </span>
      </div>
    </div>
  );
}
