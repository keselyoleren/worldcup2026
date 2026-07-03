// Bagian "Peluang Menang Live" di halaman laga — headline probabilitas saat
// ini (ProbBar) + grafik evolusi sepanjang laga (WinProbChart). Laga selesai
// menampilkan rekonstruksi penuh sebagai cerita pasca-laga; laga live ikut
// segar via AutoRefresh 60 detik (tanpa websocket).
import { GoalEvent } from "@/lib/types";
import { LiveProbs, LiveState, TimelinePoint } from "@/lib/live-probability";
import { pct } from "@/lib/prediction";
import { ProbBar } from "@/components/ui";
import { WinProbChart } from "@/components/WinProbChart";

export function LiveWinProb({
  homeName,
  awayName,
  probs,
  points,
  events,
  state,
  knockout,
}: {
  homeName: string;
  awayName: string;
  probs: LiveProbs;
  points: TimelinePoint[];
  events: GoalEvent[];
  state: LiveState;
  knockout: boolean;
}) {
  if (state.phase === "PRE") return null;
  const finished = state.phase === "FT";

  // grafik hanya kalau rekonstruksi event cocok dengan skor resmi — feed event
  // yang bolong menghasilkan garis menyesatkan, lebih baik headline saja
  const evHome = events.filter((e) => e.side === "HOME").length;
  const evAway = events.length - evHome;
  const chartOk = evHome === state.homeGoals && evAway === state.awayGoals;
  if (finished && !chartOk) return null; // laga usai tanpa event lengkap: tak ada nilai tambah

  const minuteLabel =
    state.minute !== null && !finished && state.phase !== "PEN"
      ? `Menit ke-${state.minute}${state.minuteEstimated ? " (perkiraan dari jam kickoff — injury time tak dihitung)" : ""}`
      : null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold">
        {finished ? "⏱ Alur Peluang Sepanjang Laga" : "⚡ Peluang Menang Live"}
      </h2>
      <div className="card p-4">
        {/* hasil waktu normal — saat adu penalti sudah tak relevan */}
        {state.phase !== "PEN" && !finished && (
          <ProbBar
            homeLabel={homeName}
            awayLabel={awayName}
            homeWin={probs.homeWin}
            draw={probs.draw}
            awayWin={probs.awayWin}
          />
        )}
        {/* fase gugur: bar kedua — peluang lolos ke babak berikutnya */}
        {knockout && probs.homeAdvance !== undefined && !finished && (
          <div className={state.phase !== "PEN" ? "mt-4" : ""}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-(--color-muted)">
              Lolos ke babak berikutnya
            </p>
            <ProbBar
              homeLabel={homeName}
              awayLabel={awayName}
              homeWin={probs.homeAdvance}
              draw={0}
              awayWin={probs.awayAdvance ?? 1 - probs.homeAdvance}
              verb="lolos"
              hideDraw
            />
          </div>
        )}
        {chartOk && (
          <div className={finished ? "" : "mt-5"}>
            <WinProbChart
              points={points}
              events={events}
              homeName={homeName}
              awayName={awayName}
              knockout={knockout}
              liveMinute={!finished && state.phase !== "PEN" ? state.minute : null}
            />
          </div>
        )}
        <p className="mt-3 text-[11px] text-(--color-muted)">
          {state.phase === "PEN"
            ? `Adu penalti berlangsung — model menganggap hampir imbang, sedikit condong ke tim ber-Elo lebih tinggi (${homeName} ${pct(probs.homeAdvance ?? 0.5)}).`
            : finished
              ? "Rekonstruksi analitis dari menit-menit gol memakai Elo pra-laga — bukan data odds."
              : `${minuteLabel ? `${minuteLabel}. ` : ""}Model Poisson dikondisikan pada skor & sisa waktu — diperbarui otomatis tiap menit.`}
        </p>
      </div>
    </section>
  );
}
