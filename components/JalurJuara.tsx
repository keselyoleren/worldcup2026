"use client";

import { useEffect, useState } from "react";
import { TeamPath, PathRound } from "@/lib/simulate";
import { Crest } from "./ui";

// paths sudah terurut peluang juara tertinggi -> terendah
export function JalurJuara({ paths }: { paths: TeamPath[] }) {
  const [team, setTeam] = useState(paths[0]?.team ?? "");

  // tim awal dari ?tim= di URL (halaman tetap statis/ISR)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tim");
    if (q && paths.some((p) => p.team === q)) setTeam(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (t: string) => {
    setTeam(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tim", t);
    window.history.replaceState(null, "", url);
  };

  const p = paths.find((x) => x.team === team) ?? paths[0];
  if (!p)
    return (
      <div className="card p-10 text-center text-(--color-muted)">
        Jalur juara akan tersedia setelah data turnamen termuat.
      </div>
    );

  const alphabetical = [...paths].sort((a, b) => a.team.localeCompare(b.team));

  return (
    <div>
      {/* Pemilih tim: unggulan teratas + dropdown semua tim */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {paths.slice(0, 8).map((t) => (
          <button
            key={t.team}
            onClick={() => select(t.team)}
            className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition ${
              t.team === p.team
                ? "border-(--color-accent) bg-(--color-accent)/15 text-(--color-fg)"
                : "border-(--color-line) text-(--color-muted) hover:text-(--color-fg)"
            }`}
          >
            <Crest src={t.crest} name={t.team} size={16} />
            {t.team}
          </button>
        ))}
        <select
          value={p.team}
          onChange={(e) => select(e.target.value)}
          className="border border-(--color-line) bg-(--color-bg) px-3 py-1.5 text-xs font-semibold text-(--color-muted) outline-none focus:border-(--color-accent)"
        >
          {alphabetical.map((t) => (
            <option key={t.team} value={t.team}>
              {t.team}
            </option>
          ))}
        </select>
      </div>

      {/* Header tim */}
      <div className="card mb-6 flex flex-wrap items-center gap-4 border-l-[3px] border-l-(--color-accent) p-4">
        <Crest src={p.crest} name={p.team} size={44} />
        <div className="min-w-0 flex-1">
          <div className="display text-3xl">{p.team}</div>
          <div className="text-xs text-(--color-muted)">
            {Math.round(p.rating * 10 + 1000)}
            {p.eliminatedBy ? (
              <span className="ml-2 text-red-400">
                Tersingkir di {p.eliminatedRound} — kalah dari {p.eliminatedBy}
              </span>
            ) : p.hardest ? (
              <span className="ml-2">
                Rintangan terberat: <b className="text-(--color-fg)">{p.hardest}</b>
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <div className="display text-3xl text-(--color-gold)">{fmtPct(p.champion)}</div>
          <div className="text-[11px] uppercase tracking-wide text-(--color-muted)">peluang juara</div>
        </div>
      </div>

      {/* Stepper ronde */}
      <div className="space-y-3">
        {p.rounds.map((r) => (
          <RoundCard key={r.title} r={r} path={p} />
        ))}
        {!p.eliminatedBy && (
          <div className="card flex items-center gap-3 p-4">
            <span className="text-2xl">🏆</span>
            <div className="flex-1 text-sm">
              Keluar sebagai juara di <b className="text-(--color-gold)">{fmtPct(p.champion)}</b>{" "}
              dari seluruh simulasi kami.
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-(--color-muted)">
        Catatan: angka "ketemu" dan "menang" dihitung hanya dari simulasi di mana {p.team}{" "}
        benar-benar tampil di babak itu — bukan peluang dari awal turnamen.
      </p>
    </div>
  );
}

function RoundCard({ r, path }: { r: PathRound; path: TeamPath }) {
  // ronde yang sudah benar-benar dimainkan
  const lostHere = r.title === path.eliminatedRound;
  const wonHere =
    r.reach === 100 && r.winGivenReach === 100 && r.opponents.length === 1 && r.opponents[0].meetProb === 100;

  if (lostHere) {
    const opp = path.eliminatedBy!;
    return (
      <div className="card flex items-center gap-3 border-l-[3px] border-l-red-500/70 p-4">
        <span className="text-lg">✗</span>
        <div className="text-sm">
          <b>{r.title}</b> — kalah dari <b>{opp}</b>. Langkah terhenti di sini.
        </div>
      </div>
    );
  }

  if (wonHere) {
    const opp = r.opponents[0];
    return (
      <div className="card flex items-center gap-3 border-l-[3px] border-l-emerald-500/70 p-4">
        <span className="text-lg text-emerald-300">✓</span>
        <div className="flex items-center gap-2 text-sm">
          <b>{r.title}</b> — menang lawan
          <Crest src={opp.crest} name={opp.team} size={16} />
          <b>{opp.team}</b>
        </div>
      </div>
    );
  }

  const hardest = r.title === path.hardest;
  return (
    <div className={`card p-4 ${hardest ? "ring-1 ring-(--color-accent)" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-wide">{r.title}</span>
        {hardest && (
          <span className="bg-(--color-accent) px-2 py-0.5 text-[10px] font-bold uppercase text-(--color-ink)">
            Rintangan terberat
          </span>
        )}
        <span className="ml-auto text-xs text-(--color-muted)">
          peluang sampai babak ini <b className="text-(--color-fg)">{fmtPct(r.reach)}</b>
          <span className="mx-1.5">·</span>
          menang jika sampai <b className="text-(--color-fg)">{fmtPct(r.winGivenReach)}</b>
        </span>
      </div>

      <div className="space-y-1.5">
        {r.opponents.map((o) => (
          <div key={o.team} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:flex-nowrap">
            <span className="flex min-w-0 flex-1 items-center gap-1.5 sm:w-40 sm:flex-none">
              <Crest src={o.crest} name={o.team} size={16} />
              <span className="truncate font-medium">{o.team}</span>
            </span>
            <span className="flex-none whitespace-nowrap text-right text-(--color-muted) sm:order-last sm:w-44">
              ketemu {fmtPct(o.meetProb)} · menang {fmtPct(o.winProb)}
            </span>
            <span className="relative h-2 w-full overflow-hidden rounded-full bg-white/10 sm:w-auto sm:flex-1">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-(--color-accent)/70"
                style={{ width: `${o.meetProb}%` }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtPct(v: number) {
  if (v > 0 && v < 0.1) return "<0.1%";
  return `${v >= 99.95 && v < 100 ? "99.9" : v.toFixed(1)}%`;
}
