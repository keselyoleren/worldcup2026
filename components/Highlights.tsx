import { Highlight } from "@/lib/types";
import { fmtDateTime } from "@/lib/datetime";

// Sengaja TIDAK memakai <iframe> embed: FIFA memblokir embed videonya di
// domain luar ("Video unavailable ... blocked it from display on this
// website"), jadi player-nya hanya tampil hitam. Kartu thumbnail + link ke
// YouTube selalu jalan.
function VideoThumb({ h }: { h: Highlight }) {
  return (
    <a
      href={h.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block aspect-video w-full overflow-hidden rounded-sm bg-black"
    >
      {h.imgUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={h.imgUrl}
          alt={h.title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/10">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--color-accent) pl-1 text-xl text-(--color-ink) shadow-lg transition group-hover:scale-110">
          ▶
        </span>
      </span>
    </a>
  );
}

export function HighlightCard({ h }: { h: Highlight }) {
  return (
    <div className="card overflow-hidden p-0">
      <VideoThumb h={h} />
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-bold">{h.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-(--color-muted)">
          {h.channel && <span>📺 {h.channel}</span>}
          <span className="uppercase">{h.source}</span>
          {h.date && <span>{fmtDateTime(h.date)}</span>}
        </p>
      </div>
    </div>
  );
}

// Section untuk halaman detail laga — tidak muncul kalau belum ada video
export function HighlightsSection({ highlights }: { highlights: Highlight[] }) {
  if (highlights.length === 0) return null;
  const shown = highlights.slice(0, 4);
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold">🎬 Cuplikan Pertandingan</h2>
      <div className={`grid gap-4 ${shown.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {shown.map((h) => (
          <HighlightCard key={h.id} h={h} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-(--color-muted)">
        Video diputar di YouTube (dibuka di tab baru) — FIFA tidak mengizinkan pemutaran
        langsung di situs lain.
      </p>
    </section>
  );
}
