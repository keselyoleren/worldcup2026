import type { Metadata } from "next";
import { Anton, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { AutoRefresh } from "@/components/AutoRefresh";
import { AuthProvider } from "@/components/AuthProvider";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "World Cup 2026 — Jadwal, Statistik & Prediksi",
  description:
    "Portal FIFA World Cup 2026: jadwal pertandingan terbaru, klasemen grup, statistik, prediksi skor, prediksi juara, dan permainan tebak skor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${anton.variable} ${inter.variable}`}>
      <body>
        <AuthProvider>
          <AutoRefresh />
          <Nav />
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
        </AuthProvider>
        <footer className="border-t border-(--color-line)">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-(--color-muted) sm:flex-row">
            <span className="display text-sm tracking-wide text-(--color-fg)">
              WORLD CUP 2026 · CANADA / USA / MEXICO
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
