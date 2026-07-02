// Komponen chart SVG murni — tanpa hooks, bisa dirender server maupun
// diimpor dari client component. Semua pakai viewBox tetap + w-full h-auto.
// Tooltip memakai <title> native (nol JS).

const MUTED = "var(--color-muted)";
const LINE = "var(--color-line)";
const FG = "var(--color-fg)";

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const err = span / count / step;
  const mult = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
  const s = mult * step;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / s) * s; v <= max + 1e-9; v += s) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

export interface LineSeries {
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export function LineChart({
  series,
  xTicks,
  yDomain,
  yFormat = (v) => String(Math.round(v)),
  height = 260,
  endLabels = true,
}: {
  series: LineSeries[];
  xTicks?: { x: number; label: string }[];
  yDomain?: [number, number];
  yFormat?: (v: number) => string;
  height?: number;
  endLabels?: boolean;
}) {
  const W = 720, H = height;
  const PAD = { l: 46, r: endLabels ? 110 : 16, t: 12, b: 26 };
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return null;

  const xMin = Math.min(...all.map((p) => p.x));
  const xMax = Math.max(...all.map((p) => p.x));
  let yMin = yDomain?.[0] ?? Math.min(...all.map((p) => p.y));
  let yMax = yDomain?.[1] ?? Math.max(...all.map((p) => p.y));
  if (yMax === yMin) { yMax += 1; yMin -= 1; }
  const padY = (yMax - yMin) * 0.08;
  if (!yDomain) { yMin -= padY; yMax += padY; }

  const sx = (x: number) =>
    PAD.l + (xMax === xMin ? 0.5 : (x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);

  const ticks = niceTicks(yMin, yMax);

  // label ujung garis; kalau bertabrakan (<12px), geser sederhana berurutan
  const ends = series
    .filter((s) => s.points.length > 0)
    .map((s) => ({ label: s.label, color: s.color, y: sy(s.points[s.points.length - 1].y) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].y - ends[i - 1].y < 12) ends[i].y = ends[i - 1].y + 12;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke={LINE} strokeWidth={1} />
          <text x={PAD.l - 8} y={sy(t) + 3.5} textAnchor="end" fontSize={11} fill={MUTED} className="tnum">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xTicks?.map((t) => (
        <text key={t.label + t.x} x={sx(t.x)} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
          {t.label}
        </text>
      ))}
      {series.map((s) =>
        s.points.length === 0 ? null : (
          <g key={s.label}>
            <polyline
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {s.points.map((p, i) => (
              <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={i === s.points.length - 1 ? 4 : 2.5} fill={s.color} stroke="var(--color-surface)" strokeWidth={i === s.points.length - 1 ? 2 : 0}>
                <title>{`${s.label} · ${yFormat(p.y)}`}</title>
              </circle>
            ))}
          </g>
        )
      )}
      {endLabels &&
        ends.map((e) => (
          <text key={e.label} x={W - PAD.r + 10} y={e.y + 3.5} fontSize={11} fontWeight={600} fill={e.color}>
            {e.label}
          </text>
        ))}
    </svg>
  );
}

export interface BarSeriesDef {
  key: string;
  label: string;
  color: string;
}

export function BarChart({
  data,
  series,
  yFormat = (v) => String(Math.round(v)),
  height = 240,
  labelEvery = 1,
  showValues = false,
}: {
  data: { label: string; values: { key: string; value: number }[] }[];
  series: BarSeriesDef[]; // 1-2 seri per label
  yFormat?: (v: number) => string;
  height?: number;
  labelEvery?: number;
  showValues?: boolean;
}) {
  const W = 720, H = height;
  const PAD = { l: 40, r: 12, t: 14, b: 26 };
  if (data.length === 0) return null;

  const maxV = Math.max(...data.flatMap((d) => d.values.map((v) => v.value)), 1);
  const ticks = niceTicks(0, maxV);
  const innerW = W - PAD.l - PAD.r;
  const slot = innerW / data.length;
  const barW = Math.min(24, (slot * 0.7) / series.length);
  const groupW = barW * series.length + 2 * (series.length - 1);
  const sy = (v: number) => PAD.t + (1 - v / (ticks[ticks.length - 1] || maxV)) * (H - PAD.t - PAD.b);
  const colorOf = new Map(series.map((s) => [s.key, s.color]));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke={LINE} strokeWidth={1} />
            <text x={PAD.l - 8} y={sy(t) + 3.5} textAnchor="end" fontSize={11} fill={MUTED} className="tnum">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.l + slot * i + slot / 2;
          return (
            <g key={d.label}>
              {d.values.map((v, j) => {
                const x = cx - groupW / 2 + j * (barW + 2);
                const y = sy(v.value);
                const h = Math.max(0, sy(0) - y);
                return (
                  <g key={v.key}>
                    <path
                      d={`M ${x} ${y + Math.min(4, h)} q 0 -${Math.min(4, h)} 4 -${Math.min(4, h)} h ${barW - 8} q 4 0 4 ${Math.min(4, h)} v ${Math.max(0, h - Math.min(4, h))} h -${barW} Z`}
                      fill={colorOf.get(v.key)}
                    >
                      <title>{`${d.label} · ${series.length > 1 ? `${series.find((s) => s.key === v.key)?.label}: ` : ""}${yFormat(v.value)}`}</title>
                    </path>
                    {showValues && h > 0 && (
                      <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fill={FG} className="tnum">
                        {yFormat(v.value)}
                      </text>
                    )}
                  </g>
                );
              })}
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={MUTED}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-(--color-muted)">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Meter({
  value,
  max = 100,
  color = "var(--color-accent)",
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2" title={label ?? `${Math.round(value)}/${max}`}>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function Sparkline({
  points,
  color = "var(--color-accent)",
  width = 96,
  height = 26,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const sx = (i: number) => 2 + (i / (points.length - 1)) * (width - 4);
  const sy = (v: number) => 3 + (1 - (v - min) / span) * (height - 6);
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="inline-block align-middle">
      <polyline
        points={points.map((p, i) => `${sx(i)},${sy(p)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={sx(points.length - 1)} cy={sy(last)} r={2.5} fill={color} />
    </svg>
  );
}
