"use client";

import { GoldenBootEntry } from "@/lib/simulate";
import { Crest } from "./ui";

export function SepatuEmas({ entries, iterations }: { entries: GoldenBootEntry[]; iterations: number }) {
  if (!entries.length)
    return (
      <div className="card p-10 text-center text-(--color-muted)">
        Data pencetak gol belum tersedia dari sumber data saat ini.
      </div>
    );

  const podium = entries.slice(0, 3);

  return (
    <div>
      {/* Podium proyeksi */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[podium[1], podium[0], podium[2]].map((e, i) => {
          if (!e) return <div key={i} />;
          const place = e === podium[0] ? 1 : e === podium[1] ? 2 : 3;
          const h = place === 1 ? "pt-2" : "pt-6";
          return (
            <div
              key={e.name}
              className={`card flex flex-col items-center gap-1 p-4 ${h} ${place === 1 ? "ring-2 ring-(--color-gold)" : ""}`}
            >
              <div className="text-2xl">👟</div>
              <div className="flex items-center gap-1.5">
                <Crest src={e.teamCrest} name={e.team} size={18} />
                <span className="text-center text-xs font-semibold">{e.name}</span>
              </div>
              <div className="text-xl font-black text-(--color-gold)">{e.winProb.toFixed(1)}%</div>
              <div className="text-[11px] text-white/60">peluang Sepatu Emas</div>
              <div className="text-[11px] text-white/60">
                {e.goals} gol → proyeksi {e.expFinal.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase text-white/60">
              <th className="px-3 py-2 text-left font-medium">Pemain</th>
              <th className="px-2 py-2 text-center font-medium">Gol</th>
              <th className="px-2 py-2 text-center font-medium">Assist</th>
              <th className="px-2 py-2 text-center font-medium">Main</th>
              <th className="px-2 py-2 text-center font-medium">± Laga Tersisa</th>
              <th className="px-2 py-2 text-center font-medium">Proyeksi Gol</th>
              <th className="px-3 py-2 text-center font-semibold text-(--color-gold)">Sepatu Emas</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.name} className={`border-t border-white/5 ${e.teamAlive ? "" : "opacity-60"}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-xs text-white/50">{i + 1}</span>
                    <Crest src={e.teamCrest} name={e.team} size={18} />
                    <span className="truncate font-medium">{e.name}</span>
                    <span className="truncate text-xs text-white/50">{e.team}</span>
                    {!e.teamAlive && (
                      <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                        tim tersingkir
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-bold">{e.goals}</td>
                <td className="px-2 py-2 text-center text-white/70">{e.assists}</td>
                <td className="px-2 py-2 text-center text-white/70">{e.played}</td>
                <td className="px-2 py-2 text-center text-white/70">
                  {e.expMatches < 0.05 ? "—" : `+${e.expMatches.toFixed(1)}`}
                </td>
                <td className="px-2 py-2 text-center text-white/80">{e.expFinal.toFixed(1)}</td>
                <td className="px-3 py-2 text-center">
                  <div className="relative">
                    <div
                      className="absolute inset-0 rounded bg-(--color-gold)/20"
                      style={{ width: `${Math.min(e.winProb, 100)}%` }}
                    />
                    <span className="relative font-black text-(--color-gold)">
                      {e.winProb < 0.1 ? "—" : `${e.winProb.toFixed(1)}%`}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-(--color-muted)">
        Kolom "± Laga Tersisa" = perkiraan jumlah laga yang masih akan dimainkan timnya,
        dirata-rata dari seluruh simulasi. Proyeksi gol pemain yang baru tampil di sedikit laga
        sengaja dibuat lebih konservatif supaya tidak melambung berlebihan.
      </p>
    </div>
  );
}
