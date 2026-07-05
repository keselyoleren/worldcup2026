"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegistration() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            setWaiting(installing);
          }
        });
      });

      const onVisible = () => {
        if (document.visibilityState === "visible") registration.update();
      };
      document.addEventListener("visibilitychange", onVisible);
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-(--color-line) bg-(--color-surface-2) px-4 py-3 shadow-lg">
      <span className="text-sm text-(--color-fg)">Versi baru tersedia</span>
      <button
        onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
        className="rounded-full bg-(--color-accent) px-4 py-1.5 text-sm font-semibold text-(--color-ink)"
      >
        Muat Ulang
      </button>
    </div>
  );
}
