"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SubNavItem {
  href: string;
  label: string;
}

export function SubNav({ items }: { items: SubNavItem[] }) {
  const path = usePathname();
  return (
    <div className="mb-6 inline-flex max-w-full overflow-x-auto border border-(--color-line)">
      {items.map((it, i) => {
        const active = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`whitespace-nowrap px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${
              i > 0 ? "border-l border-(--color-line)" : ""
            } ${
              active
                ? "bg-(--color-accent) text-(--color-ink)"
                : "text-(--color-muted) hover:text-(--color-fg)"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
