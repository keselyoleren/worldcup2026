"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

        <AuthButton />
      </div>
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
