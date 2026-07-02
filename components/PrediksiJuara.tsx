"use client";

import { useState } from "react";
import Link from "next/link";
import { TeamOdds } from "@/lib/simulate";
import { Crest } from "./ui";

export function PrediksiJuara({
  odds,
  iterations,
  pendingGroup,
  teamCount,
}: {
  odds: TeamOdds[];
  iterations: number;
  pendingGroup: number;
  teamCount: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? odds.filter((o) => o.team.toLowerCase().includes(query.toLowerCase()))
    : odds;
  const podium = odds.slice(0, 3);

  return (
    <div>
      {odds.length === 0 ? (
        <div className="card p-10 text-center text-white/60">
          Belum ada data grup yang bisa diproyeksikan saat ini.
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="mb-6 grid grid-cols-3 gap-3">
            {[podium[1], podium[0], podium[2]].map((t, i) => {
              if (!t) return <div key={i} />;
              const place = t === podium[0] ? 1 : t === podium[1] ? 2 : 3;
              const h = place === 1 ? "pt-2" : "pt-6";
              return (
                <div key={t.team} className={`card flex flex-col items-center gap-1 p-4 ${h} ${place === 1 ? "ring-2 ring-(--color-gold)" : ""}`}>
                  <div className="text-2xl">{place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}</div>
                  <Crest src={t.crest} name={t.team} />
                  <div className="text-center text-xs font-semibold">{t.team}</div>
                  <div className="text-xl font-black text-(--color-gold)">{t.champion.toFixed(1)}%</div>
                  <div className="text-[11px] text-white/60">peluang juara</div>
                </div>
              );
            })}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik nama tim untuk mencari…"
            className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-(--color-gold)"
          />

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase text-white/60">
                  <th className="px-3 py-2 text-left font-medium">Tim</th>
                  <th className="px-2 py-2 text-center font-medium">Lolos Fase Grup</th>
                  <th className="px-2 py-2 text-center font-medium">Perempat Final</th>
                  <th className="px-2 py-2 text-center font-medium">Semifinal</th>
                  <th className="px-2 py-2 text-center font-medium">Final</th>
                  <th className="px-3 py-2 text-center font-semibold text-(--color-gold)">Juara</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.team} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <Link
                        href={`/jalur-juara?tim=${encodeURIComponent(o.team)}`}
                        className="flex items-center gap-2 hover:text-(--color-accent)"
                        title={`Lihat jalur juara ${o.team}`}
                      >
                        <span className="w-4 text-xs text-white/50">{odds.indexOf(o) + 1}</span>
                        <Crest src={o.crest} name={o.team} />
                        <span className="truncate">{o.team}</span>
                      </Link>
                    </td>
                    <Cell v={o.advance} />
                    <Cell v={o.quarter} />
                    <Cell v={o.semi} />
                    <Cell v={o.final} />
                    <td className="px-3 py-2 text-center">
                      <div className="relative">
                        <div
                          className="absolute inset-0 rounded bg-(--color-gold)/20"
                          style={{ width: `${o.champion}%` }}
                        />
                        <span className="relative font-black text-(--color-gold)">
                          {o.champion.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ v }: { v: number }) {
  const c = v > 50 ? "text-emerald-300" : v > 15 ? "text-white/80" : "text-white/55";
  return <td className={`px-2 py-2 text-center ${c}`}>{v < 0.1 ? "—" : `${v.toFixed(1)}%`}</td>;
}
