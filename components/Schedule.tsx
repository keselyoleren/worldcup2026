"use client";

import { useMemo, useState } from "react";
import { Match } from "@/lib/types";
import { MatchCard } from "./ui";

type Filter = "ALL" | "LIVE" | "UPCOMING" | "FINISHED";

export function Schedule({ matches }: { matches: Match[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [group, setGroup] = useState<string>("ALL");

  const groups = useMemo(
    () => ["ALL", ...Array.from(new Set(matches.map((m) => m.group).filter(Boolean) as string[])).sort()],
    [matches]
  );

  const filtered = matches.filter((m) => {
    if (group !== "ALL" && m.group !== group) return false;
    if (filter === "LIVE") return m.status === "IN_PLAY" || m.status === "PAUSED";
    if (filter === "UPCOMING") return m.status === "SCHEDULED" || m.status === "TIMED";
    if (filter === "FINISHED") return m.status === "FINISHED";
    return true;
  });

  // Kelompokkan per tanggal
  const byDate = new Map<string, Match[]>();
  for (const m of filtered) {
    const key = new Date(m.utcDate).toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    (byDate.get(key) ?? byDate.set(key, []).get(key)!).push(m);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "ALL", label: "Semua Laga" },
    { key: "LIVE", label: "🔴 Berlangsung" },
    { key: "UPCOMING", label: "Akan Datang" },
    { key: "FINISHED", label: "Selesai" },
  ];

  return (
    <div>
      <div className="mb-4 inline-flex border border-(--color-line)">
        {filters.map((f, i) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${i > 0 ? "border-l border-(--color-line)" : ""} ${
              filter === f.key ? "bg-(--color-accent) text-(--color-ink)" : "text-(--color-muted) hover:text-(--color-fg)"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {groups.length > 1 && (
        <div className="mb-8 flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`border px-2.5 py-1 text-xs font-medium transition ${
                group === g
                  ? "border-(--color-fg) text-(--color-fg)"
                  : "border-(--color-line) text-(--color-muted) hover:text-(--color-fg)"
              }`}
            >
              {g === "ALL" ? "Semua Grup" : g}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="py-12 text-center text-(--color-muted)">
          Tidak ada pertandingan yang cocok dengan filter ini. Coba pilih filter lain.
        </p>
      )}

      {[...byDate.entries()].map(([date, ms]) => (
        <section key={date} className="mb-9">
          <h3 className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-(--color-muted)">
            <span className="h-px flex-none bg-(--color-fg)" style={{ width: 18 }} />
            {date}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ms.map((m) => (
              <MatchCard key={m.id} match={m} href={`/laga/${m.id}`} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
