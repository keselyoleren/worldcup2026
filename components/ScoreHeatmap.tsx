// Heatmap matriks skor 9x9 dari grid Poisson predict().
// Sekuensial satu hue (kuning accent, opasitas berskala) — server component.

import type { ReactNode } from "react";

const ACCENT_RGB = "245, 197, 24";

export function ScoreHeatmap({
  matrix,
  homeName,
  awayName,
  highlight,
  maxGoals = 5,
}: {
  matrix: number[][];
  homeName: string;
  awayName: string;
  highlight?: { home: number; away: number };
  maxGoals?: number; // tampilkan 0..maxGoals (ekor >5 gol nyaris nol)
}) {
  const n = Math.min(maxGoals, matrix.length - 1);
  let pMax = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) if (matrix[i][j] > pMax) pMax = matrix[i][j];
  if (pMax === 0) return null;

  const cells: ReactNode[] = [];
  // pojok kiri atas + header kolom (gol tim tandang)
  cells.push(
    <div key="corner" className="flex items-center justify-center text-[10px] text-(--color-muted)" />
  );
  for (let j = 0; j <= n; j++) {
    cells.push(
      <div key={`c${j}`} className="tnum flex items-center justify-center text-[11px] text-(--color-muted)">
        {j}
      </div>
    );
  }
  for (let i = 0; i <= n; i++) {
    cells.push(
      <div key={`r${i}`} className="tnum flex items-center justify-center text-[11px] text-(--color-muted)">
        {i}
      </div>
    );
    for (let j = 0; j <= n; j++) {
      const p = matrix[i][j];
      const alpha = Math.max(0.04, Math.pow(p / pMax, 0.7));
      const bright = alpha > 0.55;
      const isActual = highlight && highlight.home === i && highlight.away === j;
      cells.push(
        <div
          key={`${i}-${j}`}
          title={`${i}-${j} · ${(p * 100).toFixed(1)}%`}
          className={`tnum flex aspect-square items-center justify-center rounded-[2px] text-[10px] ${
            isActual ? "ring-2 ring-(--color-fg)" : ""
          } ${bright ? "text-(--color-ink)" : "text-(--color-muted)"}`}
          style={{ background: `rgba(${ACCENT_RGB}, ${alpha.toFixed(3)})` }}
        >
          <span className={p >= 0.02 ? "hidden sm:block" : "hidden"}>{Math.round(p * 100)}%</span>
        </div>
      );
    }
  }

  return (
    <div className="max-w-[420px]">
      <div className="mb-1.5 text-right text-[11px] text-(--color-muted)">Gol {awayName} →</div>
      <div className="flex gap-1.5">
        <div
          className="flex items-center text-[11px] text-(--color-muted)"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Gol {homeName} →
        </div>
        <div
          className="grid flex-1 gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${n + 2}, minmax(0, 1fr))` }}
        >
          {cells}
        </div>
      </div>
      {highlight && (
        <p className="mt-2 text-[11px] text-(--color-muted)">
          Kotak dengan bingkai putih = skor akhir sebenarnya.
        </p>
      )}
    </div>
  );
}
