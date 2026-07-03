// Semua tanggal/jam ditampilkan dalam WIB (Asia/Jakarta), apa pun zona waktu
// mesin yang merender — server (UTC di Vercel) dan browser harus konsisten
// agar jam kickoff benar dan tidak terjadi hydration mismatch.
const TZ = "Asia/Jakarta";

/** "Kam, 11 Jun, 20.00 WIB" — untuk kartu laga */
export function fmtDateTime(iso: string): string {
  const s = new Date(iso).toLocaleString("id-ID", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
  return `${s} WIB`;
}

/** "Kamis, 11 Juni, 20.00 WIB" — untuk halaman detail laga */
export function fmtKickoff(iso: string): string {
  const s = new Date(iso).toLocaleString("id-ID", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
  return `${s} WIB`;
}

/** "11 Jun, 20.00 WIB" — versi ringkas untuk kartu prediksi */
export function fmtDateTimeShort(iso: string): string {
  const s = new Date(iso).toLocaleString("id-ID", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
  return `${s} WIB`;
}

/** "Kamis, 11 Juni 2026" — judul pengelompokan jadwal per tanggal (hari WIB) */
export function fmtDateHeading(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ,
  });
}

/** "11 Jun" — label pendek tanpa jam */
export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", timeZone: TZ,
  });
}
