import Link from "next/link";
import { getMatches } from "@/lib/football-api";
import { computeAccuracy, MatchPrediction } from "@/lib/accuracy";
import { pct } from "@/lib/prediction";
import { StatTile } from "@/components/ui";
import { BarChart } from "@/components/charts";

export const revalidate = 60;

const MIN_SAMPLE = 5;

export default async function AkurasiPage() {
  const { matches } = await getMatches();
  const report = computeAccuracy(matches);

  if (report.sample < MIN_SAMPLE) {
    return (
      <p className="py-12 text-center text-(--color-muted)">
        Belum cukup laga selesai untuk mengukur akurasi model (minimal {MIN_SAMPLE} laga).
      </p>
    );
  }

  return (
    <div>
      <p className="mb-6 max-w-3xl text-sm text-(--color-muted)">
        Kami mengukur model kami sendiri: setiap laga selesai di-prediksi-ulang memakai rating Elo{" "}
        <b className="text-(--color-fg)">sebelum</b> laga itu dimainkan (tanpa membocorkan hasil), lalu
        dibandingkan dengan kenyataan. Tidak banyak portal yang berani menampilkan ini.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Laga Dievaluasi" value={report.sample} />
        <StatTile
          label="Tepat Hasil (M/S/K)"
          value={pct(report.outcomeHitRate)}
          caption={`Model rating statis: ${pct(report.staticOutcomeHitRate)}`}
        />
        <StatTile label="Tepat Skor Persis" value={pct(report.scoreHitRate)} />
        <StatTile
          label="Skor Brier"
          value={report.meanBrier.toFixed(3)}
          caption={`Makin kecil makin baik — tebak asal ≈ ${report.baselineBrier.toFixed(3)}`}
        />
      </div>

      {report.calibration.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-bold">🎚 Kalibrasi Prediksi</h2>
          <div className="card p-4">
            <BarChart
              data={report.calibration.map((b) => ({
                label: b.rangeLabel,
                values: [
                  { key: "prediksi", value: Math.round(b.predictedAvg * 100) },
                  { key: "aktual", value: Math.round(b.actualFreq * 100) },
                ],
              }))}
              series={[
                { key: "prediksi", label: "Peluang menurut model", color: "var(--color-chart-1)" },
                { key: "aktual", label: "Frekuensi kejadian nyata", color: "var(--color-chart-3)" },
              ]}
              yFormat={(v) => `${v}%`}
            />
            <p className="mt-3 text-[11px] text-(--color-muted)">
              Batang kuning = peluang yang diprediksi model; hijau = seberapa sering hasil itu
              benar-benar terjadi. Model terkalibrasi baik jika tiap pasangan batang sama tinggi.
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-5 md:grid-cols-2">
        <PredList title="✅ Prediksi Terbaik" subtitle="Tebakan percaya diri yang benar" items={report.best} good />
        <PredList title="❌ Prediksi Terburuk" subtitle="Tebakan percaya diri yang meleset" items={report.worst} />
      </section>
    </div>
  );
}

function PredList({
  title,
  subtitle,
  items,
  good,
}: {
  title: string;
  subtitle: string;
  items: MatchPrediction[];
  good?: boolean;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold">{title}</h2>
      <p className="mb-3 text-xs text-(--color-muted)">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-sm text-(--color-muted)">Belum ada.</p>
      ) : (
        <div className="card divide-y divide-white/5">
          {items.map((e) => (
            <Link key={e.matchId} href={`/laga/${e.matchId}`} className="block px-4 py-3 transition hover:bg-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">{e.label}</span>
                <span
                  className={`tnum flex-none text-sm ${good ? "text-(--color-win)" : "text-(--color-live)"}`}
                >
                  {pct(e.confidence)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-(--color-muted)">
                Prediksi {e.predictedScore} · hasil {e.actualScore}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
