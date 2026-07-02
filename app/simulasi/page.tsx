import { redirect } from "next/navigation";

// Halaman Simulasi Juara digantikan Prediksi Juara (dihitung otomatis).
export default function SimulasiPage() {
  redirect("/prediksi-juara");
}
