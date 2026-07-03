"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Jadwal" },
  { href: "/highlight", label: "Highlight" },
  { href: "/statistik", label: "Statistik" },
  { href: "/prediksi", label: "Prediksi" },
  { href: "/ranking", label: "Ranking" },
  { href: "/prediksi-juara", label: "Prediksi Juara" },
  { href: "/jalur-juara", label: "Jalur Juara" },
  { href: "/sepatu-emas", label: "Sepatu Emas" },
  { href: "/bracket", label: "Bracket" },
  { href: "/tebak-skor", label: "Tebak Skor" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b-2 border-(--color-fg) bg-(--color-bg)/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-stretch justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 py-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-(--color-accent) text-(--color-ink)">
            <span className="display text-lg leading-none">26</span>
          </span>
          <span className="display text-xl leading-none">
            WORLD<span className="text-(--color-accent)">CUP</span>
          </span>
        </Link>

        <nav className="-mb-[2px] flex items-stretch gap-0 overflow-x-auto">
          {LINKS.map((l) => {
            const active = path === l.href || (l.href !== "/" && path.startsWith(l.href + "/"));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center whitespace-nowrap border-b-2 px-3 text-[13px] font-semibold uppercase tracking-wide transition sm:px-4 ${
                  active
                    ? "border-(--color-accent) text-(--color-fg)"
                    : "border-transparent text-(--color-muted) hover:text-(--color-fg)"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
