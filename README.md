# ⚽ World Cup 2026 — Prediksi, Jadwal & Statistik

Aplikasi web (Next.js 15 App Router) untuk **FIFA World Cup 2026** 🇨🇦🇺🇸🇲🇽 dengan:

| Halaman | Fitur |
|---|---|
| 📅 **Jadwal** | Semua pertandingan, filter Live/Akan Datang/Selesai + per grup, skor realtime |
| 📊 **Statistik** | Klasemen grup otomatis, total gol, rata-rata gol, tim paling produktif |
| 🔮 **Prediksi** | Prediksi skor otomatis (model **distribusi Poisson** + rating tim / xG) |
| 🏆 **Prediksi Juara** | **Fitur unik** — mesin **Monte Carlo** mensimulasikan sisa turnamen ribuan kali (di browser) → peluang tiap tim jadi juara / tembus final / lolos grup. Hasil laga yang sudah selesai **dikunci** |
| 🗂️ **Bracket Predictor** | **Fitur unik** — susun jalur juaramu sendiri dari 32 Besar → Final, klik tim untuk meloloskannya. Tombol "Isi Prediksi Model", tersimpan di browser. Kualifikasi diproyeksikan dari klasemen grup terkini |
| 🎯 **Tebak Skor** | Tebak skor interaktif, sistem poin (skor tepat 3 / hasil benar 1), tersimpan di browser |

## 🎨 Desain

Tema **editorial "floodlit pitch"** — tipografi kondensari tebal ([Anton](https://fonts.google.com/specimen/Anton) untuk judul & skor, [Inter](https://fonts.google.com/specimen/Inter) untuk teks), panel rata bergaris, palet gelap hangat dengan aksen kuning-trophy. Sengaja menghindari gaya glassmorphism/gradient generik.

## 🔌 Sumber Data (Realtime)

Aplikasi memilih sumber data secara otomatis:

1. **[football-data.org](https://www.football-data.org/client/register)** — *direkomendasikan, GRATIS*. Kompetisi World Cup = kode `WC`. Set `FOOTBALL_DATA_API_KEY`.
2. **[API-Football](https://www.api-football.com/)** — alternatif. Set `API_FOOTBALL_KEY`.
3. **[openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)** — *fallback tanpa API key*. Aplikasi tetap jalan walau tidak ada key (data jadwal & hasil, tanpa skor live).

Data di-*cache* & refresh otomatis tiap **60 detik**.

## 🚀 Menjalankan

```bash
npm install

# (opsional) untuk skor realtime — tanpa ini pakai fallback
cp .env.example .env.local
# lalu isi FOOTBALL_DATA_API_KEY dengan key gratis dari football-data.org

npm run dev      # http://localhost:3000
```

Build produksi:

```bash
npm run build && npm start
```

## 🧠 Model Prediksi

`lib/prediction.ts` memakai **distribusi Poisson**:

1. Tiap tim punya *rating* kekuatan (0–100), dari peringkat FIFA/ekspektasi pra-turnamen.
2. Hitung *expected goals* (xG) tiap tim dari rasio kekuatan + keunggulan tuan rumah.
3. Bangun matriks probabilitas semua skor (0-0 s/d 8-8) → peluang menang/seri/kalah + skor paling mungkin.

Ubah tabel `TEAM_RATING` untuk menyesuaikan kekuatan tim.

## ☁️ Deploy ke Vercel

```bash
vercel
```

Tambahkan `FOOTBALL_DATA_API_KEY` di **Project → Settings → Environment Variables**.


