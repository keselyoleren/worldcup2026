"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

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

function isActive(path: string, href: string) {
  return path === href || (href !== "/" && path.startsWith(href + "/"));
}

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

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

        <nav className="-mb-[2px] hidden items-stretch gap-0 overflow-x-auto md:flex">
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
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

        <div className="flex items-center gap-3">
          <AuthButton />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            className="my-auto flex h-9 w-9 items-center justify-center text-(--color-fg) md:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="h-6 w-6"
            >
              {open ? (
                <>
                  <path d="M6 6l12 12" />
                  <path d="M18 6L6 18" />
                </>
              ) : (
                <>
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-(--color-line) bg-(--color-bg) md:hidden">
          {LINKS.map((l) => {
            const active = isActive(path, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center border-l-4 px-4 py-3 text-sm font-semibold uppercase tracking-wide transition ${
                  active
                    ? "border-(--color-accent) bg-(--color-accent)/10 text-(--color-fg)"
                    : "border-transparent text-(--color-muted) hover:text-(--color-fg)"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}

function AuthButton() {
  const { user, loading, ready, signIn, signOut } = useAuth();
  if (!ready || loading) return null;

  if (!user) {
    return (
      <button
        onClick={signIn}
        className="my-auto whitespace-nowrap rounded-full bg-(--color-accent) px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-(--color-ink) transition hover:brightness-110"
      >
        Masuk
      </button>
    );
  }

  return (
    <div className="my-auto flex items-center gap-2">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoURL}
          alt={user.displayName ?? "Avatar"}
          title={user.displayName ?? undefined}
          referrerPolicy="no-referrer"
          className="h-7 w-7 rounded-full border border-(--color-line)"
        />
      ) : (
        <span className="hidden text-xs text-(--color-muted) sm:inline">{user.displayName}</span>
      )}
      <button
        onClick={signOut}
        className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-(--color-muted) transition hover:text-(--color-fg)"
      >
        Keluar
      </button>
    </div>
  );
}
