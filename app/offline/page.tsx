import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Offline — World Cup 2026",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="display text-6xl text-(--color-accent)">26</span>
      <h1 className="display text-2xl tracking-wide text-(--color-fg)">
        KAMU SEDANG OFFLINE
      </h1>
      <p className="max-w-sm text-sm text-(--color-muted)">
        Koneksi internet terputus, jadi skor dan jadwal terbaru belum bisa
        dimuat. Coba lagi begitu kamu kembali online.
      </p>
      <a
        href="/"
        className="mt-2 rounded-full border border-(--color-line) bg-(--color-surface) px-5 py-2 text-sm text-(--color-fg) transition hover:border-(--color-accent)"
      >
        Coba Lagi
      </a>
    </div>
  );
}
