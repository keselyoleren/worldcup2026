// Grafik evolusi probabilitas menang sepanjang laga — SVG murni tanpa hooks,
// gaya sama dengan components/charts.tsx (viewBox tetap, warna CSS var,
// tooltip <title> native). Fase grup: 3 garis (menang/seri/menang); fase
// gugur: 2 garis peluang lolos. Penanda ⚽ di menit gol, band 90-120 untuk
// perpanjangan waktu, kursor di menit berjalan saat laga live.
import { GoalEvent } from "@/lib/types";
import { TimelinePoint } from "@/lib/live-probability";

const MUTED = "var(--color-muted)";
const LINE = "var(--color-line)";
const HOME = "var(--color-win)";
const AWAY = "var(--color-away)";

export function WinProbChart({
  points,
  events,
  homeName,
  awayName,
  knockout,
  liveMinute,
}: {
  points: TimelinePoint[];
  events: GoalEvent[];
  homeName: string;
  awayName: string;
  knockout: boolean;
  liveMinute: number | null;
}) {
  if (points.length < 2) return null;

  const W = 720, H = 240;
  const PAD = { l: 42, r: 16, t: 14, b: 26 };
  const maxX = Math.max(90, points[points.length - 1].minute);
  const sx = (m: number) => PAD.l + (Math.min(m, maxX) / maxX) * (W - PAD.l - PAD.r);
  const sy = (p: number) => PAD.t + (1 - p) * (H - PAD.t - PAD.b);

  const series: { label: string; color: string; get: (p: TimelinePoint) => number }[] =
    knockout
      ? [
          { label: `${homeName} lolos`, color: HOME, get: (p) => p.homeAdvance ?? 0 },
          { label: `${awayName} lolos`, color: AWAY, get: (p) => p.awayAdvance ?? 0 },
        ]
      : [
          { label: `${homeName} menang`, color: HOME, get: (p) => p.homeWin },
          { label: "Seri", color: MUTED, get: (p) => p.draw },
          { label: `${awayName} menang`, color: AWAY, get: (p) => p.awayWin },
        ];

  const xTicks = maxX > 90 ? [0, 45, 90, 105, 120] : [0, 45, 90];
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  // skor berjalan untuk tooltip penanda gol
  const sorted = [...events].sort(
    (x, y) => x.minute - y.minute || (x.extra ?? 0) - (y.extra ?? 0)
  );
  let gh = 0, ga = 0;
  const markers = sorted.map((e) => {
    if (e.side === "HOME") gh++;
    else ga++;
    const label = e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`;
    const who = e.scorer ?? (e.side === "HOME" ? homeName : awayName);
    const suffix = e.type === "OWN" ? " (bunuh diri)" : e.type === "PENALTY" ? " (penalti)" : "";
    return {
      x: sx(e.minute),
      color: e.side === "HOME" ? HOME : AWAY,
      title: `${label} — ${who}${suffix} (${gh}–${ga})`,
    };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {/* band perpanjangan waktu */}
        {maxX > 90 && (
          <>
            <rect
              x={sx(90)} y={PAD.t} width={sx(120) - sx(90)} height={H - PAD.t - PAD.b}
              fill={MUTED} opacity={0.08}
            />
            <text x={(sx(90) + sx(120)) / 2} y={PAD.t + 12} textAnchor="middle" fontSize={10} fill={MUTED}>
              Perpanjangan waktu
            </text>
          </>
        )}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke={LINE} strokeWidth={1} />
            <text x={PAD.l - 8} y={sy(t) + 3.5} textAnchor="end" fontSize={11} fill={MUTED} className="tnum">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {/* garis referensi HT & akhir waktu normal */}
        {[45, 90].map((m) => (
          <line
            key={m} x1={sx(m)} x2={sx(m)} y1={PAD.t} y2={H - PAD.b}
            stroke={LINE} strokeWidth={1} strokeDasharray="3 3"
          />
        ))}
        {xTicks.map((m) => (
          <text key={m} x={sx(m)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED} className="tnum">
            {m}&apos;
          </text>
        ))}
        {/* kursor menit berjalan */}
        {liveMinute !== null && (
          <line
            x1={sx(liveMinute)} x2={sx(liveMinute)} y1={PAD.t} y2={H - PAD.b}
            stroke="var(--color-live)" strokeWidth={1.5} opacity={0.7}
          />
        )}
        {/* garis probabilitas */}
        {series.map((s) => {
          const last = points[points.length - 1];
          return (
            <g key={s.label}>
              <polyline
                points={points.map((p) => `${sx(p.minute)},${sy(s.get(p))}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={sx(last.minute)} cy={sy(s.get(last))} r={4}
                fill={s.color} stroke="var(--color-surface)" strokeWidth={2}
              >
                <title>{`${s.label} · ${Math.round(s.get(last) * 100)}%`}</title>
              </circle>
            </g>
          );
        })}
        {/* penanda gol */}
        {markers.map((m, i) => (
          <g key={i}>
            <line x1={m.x} x2={m.x} y1={sy(1)} y2={sy(0)} stroke={m.color} strokeWidth={1} opacity={0.35} />
            <circle cx={m.x} cy={PAD.t + 6} r={7} fill={m.color}>
              <title>{m.title}</title>
            </circle>
            <text x={m.x} y={PAD.t + 9.5} textAnchor="middle" fontSize={9} pointerEvents="none">
              ⚽
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-(--color-muted)">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
