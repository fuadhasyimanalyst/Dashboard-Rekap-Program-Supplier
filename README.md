# Dashboard Rekap Program Supplier

Dashboard untuk memantau realisasi program supplier (SUPERFAN, BUCKET SEAL, KUNINGAN, PVCBV, DISPLAY HOKI) per pelanggan, dibangun dengan React + Vite + Tailwind.

**Data tetap dalam bentuk Excel** — file `DATA_PENJUALAN.xlsx` dan `MASTER_PROGRAM.xlsx` ada di folder `public/data/`, dan dibaca langsung oleh aplikasi setiap kali halaman dibuka (tidak dikonversi ke JSON). Jadi kalau mau update data, tinggal timpa file Excel-nya, tidak perlu jalankan script apapun.

## Menjalankan di komputer lokal

Butuh **Node.js** (versi 18 ke atas). Cek dulu dengan `node -v`, kalau belum ada install dari https://nodejs.org.

```bash
# 1. Masuk ke folder project
cd dashboard-program-supplier

# 2. Install dependency (sekali saja / setiap ada perubahan package.json)
npm install

# 3. Jalankan dashboard
npm run dev
```

Buka browser ke alamat yang muncul di terminal (biasanya `http://localhost:5173`).

Untuk build versi produksi (misalnya untuk di-hosting):
```bash
npm run build
npm run preview   # coba hasil build-nya
```

## Update data baru (Agustus, September, dst)

1. Buka folder `public/data/`.
2. Timpa (replace) `DATA_PENJUALAN.xlsx` dan/atau `MASTER_PROGRAM.xlsx` dengan file terbaru — **nama file dan nama sheet harus sama persis**:
   - `DATA_PENJUALAN.xlsx` → sheet `Sheet1`, dengan kolom header yang sama seperti sebelumnya (`NO FAKTUR`, `TGL FAKTUR`, `KODE PELANGGAN`, `NAMA BARANG`, `NOMINAL`, `SUPP`, dst).
   - `MASTER_PROGRAM.xlsx` → sheet `MASTER BARANG`, `NOMINAL WAJIB`, `PERIODE PROGRAM`, `JUMLAH PAKET`.
3. Refresh halaman dashboard (kalau `npm run dev` sedang berjalan, cukup reload browser — tidak perlu restart server). Kalau pakai Supabase, jalankan `npm run sync` setelah update Excel-nya.

## Fitur "Jumlah Paket" (pelanggan ikut lebih dari 1 paket program)

Sheet baru `JUMLAH PAKET` di `MASTER_PROGRAM.xlsx` dipakai untuk menandai pelanggan yang ikut program lebih dari 1 paket. Kalau jumlah paketnya > 1, **syarat omset** dan **syarat jumlah varian wajib** program itu otomatis dikalikan sesuai jumlah paketnya.

Kolom sheet `JUMLAH PAKET`:

| KODE PELANGGAN | NAMA PELANGGAN | SUPP  | PROGRAM   | JUMLAH PAKET |
|---|---|---|---|---|
| TB001 | TB. PUJO | DCOTA | SUPERFAN | 2 |

Contoh: SUPERFAN syarat dasarnya (1 paket) adalah omset > Rp 2.000.000 dan minimal 2 dari 3 item wajib. Kalau TB. PUJO didaftarkan dengan `JUMLAH PAKET = 2`, syaratnya otomatis jadi:
- Omset harus **> Rp 4.000.000** (2.000.000 × 2)
- Item wajib minimal **4 varian** (2 × 2) — catatan: kalau daftar item wajib program itu di sheet `MASTER BARANG` cuma ada 3 item, syarat "4 varian" ini otomatis mustahil tercapai, jadi pastikan daftar item wajib di `MASTER BARANG` cukup banyak untuk program yang dipakai bersama fitur paket ini.

Kalau pelanggan tidak terdaftar di sheet `JUMLAH PAKET` (atau file/sheetnya belum ada sama sekali), semua pelanggan dianggap **1 paket** (perilaku lama, tidak berubah) — jadi fitur ini aman ditambahkan kapan saja tanpa mengganggu data yang sudah ada.

Kalau pakai Supabase, tambahkan tabel `jumlah_paket` dulu dengan menjalankan `supabase/migration_jumlah_paket.sql` di SQL Editor (project yang sudah ada), baru jalankan `npm run sync` untuk mengisi datanya dari Excel. Kalau bikin project Supabase baru, cukup jalankan `supabase/migration.sql` (sudah termasuk tabel ini).

Boleh juga edit langsung isi Excel-nya (misalnya nambah baris di sheet `PERIODE PROGRAM` atau `MASTER BARANG`) tanpa perlu tools tambahan, tinggal save filenya di folder `public/data/`.

## Catatan penting soal data & aturan

- Data penjualan contoh yang diupload hanya mencakup **Juli 2026**. Periode **DISPLAY HOKI** (1 Juli – 30 Sept 2026) sudah mencakup bulan ini, jadi realisasinya langsung kelihatan. Tapi periode **SUPERFAN, BUCKET SEAL, KUNINGAN, PVCBV** baru mulai **1 Agustus 2026**, jadi realisasinya masih kosong sampai data Agustus/September di-upload. Gunakan toggle **"Semua transaksi"** di kanan atas untuk simulasi berdasarkan data yang ada sekarang; setelah data Agustus/September masuk, pindah ke **"Sesuai periode resmi"** supaya semua program dihitung sesuai periode resminya masing-masing.
- Reward program **SUPERFAN** belum disebutkan nilainya secara spesifik, jadi kolom reward untuk program ini ditulis "Sesuai ketentuan program" — bisa diubah di `src/lib/compute.js` (cari `REWARD_LABEL`) begitu sudah ditentukan.

## Ringkasan aturan program yang sudah diterapkan

| Program | Supplier | Syarat | Reward |
|---|---|---|---|
| SUPERFAN | DCOTA | Beli min. 2 dari 3 item wajib (DABS-C 201, DABS-C 204, DT CRES 1/2") **dan** omset item program > Rp 2.000.000 dalam periode | — |
| BUCKET SEAL | DCOTA | Beli SEAL TAPE 1/2" **dan** SEALTAPE BUCKET (48 PCS) | Diskon 10% |
| KUNINGAN | DCOTA | Beli minimal 2 varian berbeda dari daftar item Kuningan | Diskon 5% |
| PVCBV | DCOTA | Beli minimal 2 varian berbeda dari daftar item PVCBV | Diskon 7% |
| DISPLAY HOKI | INLITE | Omset item program mencapai >= Rp 1.500.000 dalam periode | Rp 200.000 |

Logika lengkap ada di `src/lib/compute.js` dan `src/lib/excelLoader.js` (pembaca file Excel), terpisah rapi dari tampilan supaya mudah disesuaikan kalau ada perubahan aturan.
