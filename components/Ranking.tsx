"use client";

import { useMemo, useState } from "react";
import { EloEntry, EloHistoryPoint } from "@/lib/elo";
import { Crest } from "./ui";
import { LineChart, Sparkline } from "./charts";

type SortKey = "rank" | "delta" | "team";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];
const MAX_SELECTED = 6;

export function Ranking({
  table,
  history,
}: {
  table: EloEntry[];
  history: Record<string, EloHistoryPoint[]>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [selected, setSelected] = useState<string[]>(() =>
    table.slice(0, 6).map((e) => e.team)
  );

  const sorted = useMemo(() => {
    const arr = [...table];
    if (sortKey === "delta") arr.sort((a, b) => b.delta - a.delta || a.rank - b.rank);
    else if (sortKey === "team") arr.sort((a, b) => a.team.localeCompare(b.team));
    else arr.sort((a, b) => a.rank - b.rank);
    return arr;
  }, [table, sortKey]);

  const toggle = (team: string) =>
    setSelected((cur) =>
      cur.includes(team)
        ? cur.filter((t) => t !== team)
        : cur.length >= MAX_SELECTED
        ? cur
        : [...cur, team]
    );

  // sumbu-x = urutan titik riwayat; label dari riwayat terpanjang tim terpilih
  const longest = selected
    .map((t) => history[t] ?? [])
    .reduce((a, b) => (b.length > a.length ? b : a), [] as EloHistoryPoint[]);

  const series = selected
    .filter((t) => (history[t]?.length ?? 0) > 0)
    .map((team, i) => ({
      label: team,
      color: CHART_COLORS[i % CHART_COLORS.length],
      points: history[team].map((p, idx) => ({ x: idx, y: p.elo })),
    }));

  const hasMovement = longest.length > 1;

  const header = (key: SortKey, label: string, align = "text-left") => (
    <th className={`px-2 py-2 ${align}`}>
      <button
        onClick={() => setSortKey(key)}
        className={`text-[11px] font-semibold uppercase tracking-wide transition ${
          sortKey === key ? "text-(--color-accent)" : "text-(--color-muted) hover:text-(--color-fg)"
        }`}
      >
        {label}
      </button>
    </th>
  );

  return (
    <div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-(--color-line)">
              {header("rank", "#", "text-center")}
              {header("team", "Tim")}
              <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-(--color-muted)">
                Rating
              </th>
              {header("delta", "Δ Turnamen", "text-right")}
              <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-(--color-muted)">
                Δ Posisi
              </th>
              <th className="hidden px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-(--color-muted) md:table-cell">
                Tren
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.team} className="border-t border-white/5">
                <td className="tnum px-2 py-2 text-center text-(--color-muted)">{e.rank}</td>
                <td className="px-2 py-2">
                  <div className="flex items-center gap-2">
                    <Crest src={e.crest} name={e.team} />
                    <span className="truncate font-medium">{e.team}</span>
                  </div>
                </td>
                <td
                  className={`tnum px-2 py-2 text-right text-base ${
                    e.rank <= 3 ? "text-(--color-accent)" : "text-(--color-fg)"
                  }`}
                >
                  {e.elo}
                </td>
                <td className="tnum px-2 py-2 text-right">
                  <DeltaCell v={e.delta} />
                </td>
                <td className="tnum px-2 py-2 text-right">
                  <DeltaCell v={e.rankChange} />
                </td>
                <td className="hidden px-3 py-2 text-right md:table-cell">
                  {(history[e.team]?.length ?? 0) > 1 ? (
                    <Sparkline
                      points={history[e.team].map((p) => p.elo)}
                      color={e.delta >= 0 ? "var(--color-win)" : "var(--color-live)"}
                    />
                  ) : (
                    <span className="text-xs text-(--color-muted)">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMovement && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">📈 Pergerakan Rating</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {table.slice(0, 16).map((e) => {
              const on = selected.includes(e.team);
              const slot = selected.indexOf(e.team);
              return (
                <button
                  key={e.team}
                  onClick={() => toggle(e.team)}
                  className={`border px-2.5 py-1 text-xs font-medium transition ${
                    on
                      ? "border-(--color-fg) text-(--color-fg)"
                      : "border-(--color-line) text-(--color-muted) hover:text-(--color-fg)"
                  }`}
                >
                  {on && (
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: CHART_COLORS[slot % CHART_COLORS.length] }}
                    />
                  )}
                  {e.team}
                </button>
              );
            })}
          </div>
          <div className="card p-4">
            <LineChart
              series={series}
              xTicks={longest.map((p, i) => ({ x: i, label: p.label }))}
              yFormat={(v) => String(Math.round(v))}
            />
            <p className="mt-2 text-[11px] text-(--color-muted)">
              Maksimal {MAX_SELECTED} tim sekaligus. &ldquo;Awal&rdquo; = rating seed pra-turnamen.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function DeltaCell({ v }: { v: number }) {
  if (v === 0) return <span className="text-(--color-muted)">–</span>;
  return v > 0 ? (
    <span className="text-(--color-win)">▲{v}</span>
  ) : (
    <span className="text-(--color-live)">▼{Math.abs(v)}</span>
  );
}
