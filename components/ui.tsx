import Link from "next/link";
import { Match, MatchStatus, DataSource } from "@/lib/types";
import { pct } from "@/lib/prediction";

const STATUS_LABEL: Record<MatchStatus, { text: string; cls: string; live?: boolean }> = {
  SCHEDULED: { text: "Belum Mulai", cls: "text-(--color-muted)" },
  TIMED: { text: "Belum Mulai", cls: "text-(--color-muted)" },
  IN_PLAY: { text: "Sedang Main", cls: "text-(--color-live)", live: true },
  PAUSED: { text: "Istirahat", cls: "text-(--color-accent)", live: true },
  FINISHED: { text: "Selesai", cls: "text-(--color-win)" },
  POSTPONED: { text: "Ditunda", cls: "text-(--color-muted)" },
  CANCELLED: { text: "Dibatalkan", cls: "text-(--color-muted)" },
  UNKNOWN: { text: "—", cls: "text-(--color-muted)" },
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${s.cls}`}>
      {s.live && <span className="live-dot blink" />}
      {s.text}
    </span>
  );
}

export function Crest({ src, name, size = 22 }: { src?: string; name: string; size?: number }) {
  if (!src)
    return (
      <span
        className="flex items-center justify-center rounded-sm bg-(--color-surface-2) text-[9px] font-bold text-(--color-muted)"
        style={{ width: size + 6, height: size }}
      >
        {name.slice(0, 3).toUpperCase()}
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={name}
      className="rounded-[3px] object-cover ring-1 ring-black/40"
      style={{ width: size + 6, height: size }}
    />
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function stageLabel(m: Match) {
  if (m.group) return m.group;
  return m.stage.replace(/_/g, " ");
}

export function MatchCard({ match, href }: { match: Match; href?: string }) {
  const { home, away, score, status } = match;
  const show = status === "FINISHED" || status === "IN_PLAY" || status === "PAUSED";
  const card = (
    <div className="card group relative overflow-hidden transition hover:border-(--color-fg)">
      <span
        className={`absolute inset-y-0 left-0 w-[3px] ${
          status === "IN_PLAY" || status === "PAUSED"
            ? "bg-(--color-live)"
            : status === "FINISHED"
            ? "bg-(--color-win)"
            : "bg-transparent"
        }`}
      />
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="overline">{stageLabel(match)}</span>
        <StatusBadge status={status} />
      </div>
      <div className="px-4 py-3">
        <ScoreRow team={home.name} crest={home.crest} goals={score.home} show={show} win={score.winner === "HOME"} />
        <ScoreRow team={away.name} crest={away.crest} goals={score.away} show={show} win={score.winner === "AWAY"} />
      </div>
      <div className="flex items-center justify-between border-t border-(--color-line) px-4 py-2 text-xs text-(--color-muted)">
        <span>{fmtDate(match.utcDate)}</span>
        {match.venue && <span className="truncate pl-3">{match.venue}</span>}
      </div>
    </div>
  );
  if (!href) return card;
  return (
    <Link href={href} className="block">
      {card}
    </Link>
  );
}

function ScoreRow({
  team, crest, goals, show, win,
}: {
  team: string; crest?: string; goals: number | null; show: boolean; win: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex min-w-0 items-center gap-2.5">
        <Crest src={crest} name={team} />
        <span className={`truncate text-sm ${win ? "font-bold text-(--color-fg)" : "text-(--color-fg)/85"}`}>
          {team}
        </span>
      </div>
      <span className={`tnum text-2xl ${win ? "text-(--color-accent)" : "text-(--color-fg)/60"}`}>
        {show && goals !== null ? goals : "–"}
      </span>
    </div>
  );
}

export function PageHeader({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <header className="mb-6">
      <div className="overline mb-2">{kicker}</div>
      <h1 className="display text-4xl sm:text-5xl">{title}</h1>
      <div className="rule mt-3" />
      {sub && <p className="mt-3 max-w-2xl text-sm text-(--color-muted)">{sub}</p>}
    </header>
  );
}

export function StatTile({
  label,
  value,
  small,
  caption,
  delta,
}: {
  label: string;
  value: string | number;
  small?: boolean;
  caption?: string;
  delta?: number; // perubahan bertanda, diwarnai sesuai arah
}) {
  return (
    <div className="card p-4">
      <div className="text-xs text-(--color-muted)">{label}</div>
      <div className={`mt-1 font-black text-(--color-fg) ${small ? "text-sm" : "text-2xl"}`}>
        {value}
        {delta !== undefined && delta !== 0 && (
          <span
            className={`tnum ml-2 text-sm ${delta > 0 ? "text-(--color-win)" : "text-(--color-live)"}`}
          >
            {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
          </span>
        )}
      </div>
      {caption && <div className="mt-1 text-[11px] text-(--color-muted)">{caption}</div>}
    </div>
  );
}

export function ProbBar({
  homeLabel,
  awayLabel,
  homeWin,
  draw,
  awayWin,
}: {
  homeLabel: string;
  awayLabel: string;
  homeWin: number;
  draw: number;
  awayWin: number;
}) {
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-(--color-win)" style={{ width: pct(homeWin) }} />
        <div className="bg-(--color-muted)/40" style={{ width: pct(draw) }} />
        <div className="bg-(--color-away)" style={{ width: pct(awayWin) }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-xs">
        <span className="min-w-0 truncate text-(--color-win)">
          {homeLabel} menang {pct(homeWin)}
        </span>
        <span className="flex-none text-(--color-muted)">Seri {pct(draw)}</span>
        <span className="min-w-0 truncate text-right text-(--color-away)">
          {awayLabel} menang {pct(awayWin)}
        </span>
      </div>
    </div>
  );
}

const FORM_STYLE = {
  W: { letter: "M", cls: "bg-(--color-win)/15 text-(--color-win)" },
  D: { letter: "S", cls: "bg-(--color-muted)/15 text-(--color-muted)" },
  L: { letter: "K", cls: "bg-(--color-live)/15 text-(--color-live)" },
} as const;

export function FormBadges({
  results,
}: {
  results: { result: "W" | "D" | "L"; label?: string }[];
}) {
  if (results.length === 0)
    return <span className="text-xs text-(--color-muted)">Belum ada laga selesai.</span>;
  return (
    <div className="flex gap-1.5">
      {results.map((r, i) => {
        const s = FORM_STYLE[r.result];
        return (
          <span
            key={i}
            title={r.label}
            className={`flex h-7 w-7 items-center justify-center rounded-sm text-xs font-bold ${s.cls}`}
          >
            {s.letter}
          </span>
        );
      })}
    </div>
  );
}

export function SourceBanner({ source, isLive }: { source: DataSource; isLive: boolean }) {
  return (
    <div className="mb-6 flex items-center gap-2.5 border-b border-(--color-line) pb-3 text-xs text-(--color-muted)">
      {isLive ? <span className="live-dot blink" /> : <span className="h-[7px] w-[7px] rounded-full bg-(--color-muted)" />}
      <span>
        Sumber data: <span className="font-bold text-(--color-fg)">{source}</span>
        {isLive
          ? " — skor diperbarui otomatis setiap menit"
          : " — data contoh, skor live belum aktif"}
      </span>
    </div>
  );
}
