"use client";

import { useMemo, useState } from "react";
import { Match } from "@/lib/types";
import { runSimulations, TeamOdds, buildGroups } from "@/lib/simulate";
import { Crest } from "./ui";

const PRESETS = [1000, 5000, 20000];

export function Simulasi({
  matches,
  ratings,
}: {
  matches: Match[];
  ratings?: Record<string, number>; // rating Elo live dari server
}) {
  const [odds, setOdds] = useState<TeamOdds[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => buildGroups(matches), [matches]);
  const pendingGroup = groups.reduce((n, g) => n + g.pending.length, 0);
  const playedGroup = groups.reduce((n, g) => n + g.teams.length, 0);

  const run = (n: number) => {
    setRunning(true);
    setTotal(n);
    setProgress(0);
    runSimulations(
      matches,
      n,
      (p) => {
        setProgress(p.done);
        setOdds(p.odds);
        if (p.done >= p.total) setRunning(false);
      },
      400,
      ratings
    );
  };

  const filtered = query
    ? odds.filter((o) => o.team.toLowerCase().includes(query.toLowerCase()))
    : odds;
  const podium = odds.slice(0, 3);

  return (
    <div>
      <div className="card mb-6 p-4">
        <div className="mb-3 text-sm text-white/70">
          Hasil laga yang sudah selesai dipakai apa adanya. Komputer lalu memainkan{" "}
          <b className="text-white">{pendingGroup}</b> laga grup yang tersisa beserta seluruh fase
          gugur ({playedGroup} tim). Pilih jumlah simulasi di bawah — semakin banyak, semakin
          akurat hasilnya.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((n) => (
            <button
              key={n}
              disabled={running}
              onClick={() => run(n)}
              className="rounded-full bg-(--color-gold) px-4 py-1.5 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-40"
            >
              🎲 Jalankan {n.toLocaleString("id-ID")} Simulasi
            </button>
          ))}
          {running && <span className="text-xs text-white/60">Sedang menghitung…</span>}
        </div>

        {total > 0 && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-(--color-gold) transition-all"
                style={{ width: `${(progress / total) * 100}%` }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-white/60">
              {progress.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")} simulasi selesai
            </div>
          </div>
        )}
      </div>

      {odds.length === 0 ? (
        <div className="card p-10 text-center text-white/60">
          Klik salah satu tombol di atas untuk mulai menghitung peluang juara tiap tim 🏆
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
                {filtered.map((o, i) => (
                  <tr key={o.team} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-4 text-xs text-white/50">{i + 1}</span>
                        <Crest src={o.crest} name={o.team} />
                        <span className="truncate">{o.team}</span>
                      </div>
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
