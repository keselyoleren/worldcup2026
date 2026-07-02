"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Ambil data terbaru dari server tiap `intervalMs` selama tab terlihat,
// supaya skor live diperbarui tanpa reload manual.
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
