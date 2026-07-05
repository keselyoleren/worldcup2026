import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "World Cup 2026 — Jadwal, Statistik & Prediksi",
    short_name: "WC 2026",
    description:
      "Portal FIFA World Cup 2026: jadwal pertandingan terbaru, klasemen grup, statistik, prediksi skor, prediksi juara, dan permainan tebak skor.",
    lang: "id",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1210",
    theme_color: "#0d1210",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
