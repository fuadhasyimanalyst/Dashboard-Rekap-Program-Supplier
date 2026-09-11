# Dashboard Rekap Program Supplier

Dashboard untuk memantau realisasi program supplier (SUPERFAN, BUCKET SEAL, KUNINGAN, PVCBV, DISPLAY HOKI, KONTAINER, dll) per pelanggan, dibangun dengan React + Vite + Tailwind.

Ada **2 mode sumber data**, tinggal pilih lewat `.env`:

| Mode | `VITE_DATA_SOURCE` | Cara kerja |
|---|---|---|
| **Lokal** (default, buat coba-coba cepat) | `local` | Baca langsung 3 file Excel di `public/data/`, tidak perlu setup apapun |
| **Supabase** (production) | `supabase` | Baca dari database Supabase, datanya dipindahkan lewat `scripts/import-to-supabase.mjs` |

Ada 3 sumber data di kedua mode:
- `MASTER_BARANG.xlsx` — daftar barang per program per supplier.
- `INPUT_REKAPAN_PROGRAM.xlsx` — data master pengajuan tiap toko (Pengajuan Paket, Form Fisik, Target, Periode). **Semua baris ditampilkan apa adanya**, tidak difilter.
- `DATA_PENJUALAN.xlsx` — transaksi faktur yang dipakai untuk mencocokkan apakah nominal & barang yang terjual sudah memenuhi program.

## Cara cepat coba dulu (mode lokal, tanpa Supabase)

File Excel-nya sudah ada di `public/data/`. Tinggal:

```bash
npm install
npm run dev
```

Buka browser ke alamat yang muncul di terminal (biasanya `http://localhost:5173`). Kalau mau ganti data, timpa (replace) file di `public/data/` dengan yang baru (nama file & nama sheet harus sama persis), lalu reload browser — tidak perlu restart server atau setup apapun.

Untuk build versi produksi (masih mode lokal):
```bash
npm run build
npm run preview
```

## Pindah ke Supabase (production)

Kalau datanya sudah mulai besar / mau dibuka banyak orang sekaligus / mau diupdate dari tempat lain, pindah ke mode Supabase:

### 1. Setup Supabase (sekali saja)

1. Buat project baru di https://supabase.com (gratis).
2. Buka **SQL Editor** di dashboard Supabase project-mu, tempel isi file [`supabase/schema.sql`](./supabase/schema.sql), lalu **Run**. Ini akan membuat 3 tabel + 1 view + izin baca publik (RLS).
3. Ambil kredensialnya di **Project Settings → API**:
   - `Project URL` → dipakai sebagai `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `service_role` key (rahasia, jangan disebar) → dipakai sebagai `SUPABASE_SERVICE_ROLE_KEY`, hanya untuk script import
   - `anon` `public` key → dipakai sebagai `VITE_SUPABASE_ANON_KEY`, dipakai aplikasi di browser

### 2. Konfigurasi environment

```bash
cp .env.example .env
```

Isi `.env`: set `VITE_DATA_SOURCE=supabase`, lalu isi 4 nilai kredensial Supabase-nya.

### 3. Pindahkan data Excel ke Supabase

1. Buat folder `data-in/` di root project, taruh 3 file Excel di dalamnya dengan nama **persis**:
   - `data-in/INPUT_REKAPAN_PROGRAM.xlsx`
   - `data-in/MASTER_BARANG.xlsx`
   - `data-in/DATA_PENJUALAN.xlsx`
   (boleh salin dari `public/data/` kalau isinya sama)
2. Jalankan:
   ```bash
   npm run import:supabase
   ```
   Script ini akan mengosongkan tabel lama lalu mengisi ulang dengan isi file Excel terbaru (full refresh), jadi aman dijalankan berulang kali tiap ada data baru.

### 4. Jalankan dashboard

```bash
npm run dev
```

Update data baru: timpa file di `data-in/`, jalankan lagi `npm run import:supabase`, lalu klik tombol **refresh** di pojok kanan atas dashboard (bukan cuma reload browser — lihat bagian caching di bawah).

## Caching (biar kuota Supabase tidak boros)

Mode Supabase otomatis pakai **cache di browser** (localStorage), supaya tidak setiap reload halaman fetch ulang ribuan baris dari Supabase:

- Fetch pertama = **Cache MISS** — ambil data fresh dari Supabase, lalu disimpan di cache browser.
- **Default: cache tidak pernah kedaluwarsa otomatis.** Reload halaman berapa kali pun = selalu **Cache HIT** — pakai data dari cache, **tidak ada request ke Supabase sama sekali** — sampai kamu klik tombol refresh manual. Cocok kalau sinkronisasi Excel → Supabase memang cuma dilakukan manual beberapa kali sehari (misal 2x sehari), jadi tidak ada gunanya dashboard fetch ulang sendiri di sela-sela jadwal itu.
- Kalau mau tetap ada auto-refresh berkala (misal tiap 30 menit), isi `VITE_CACHE_TTL_MINUTES=30` di `.env`.

Status cache-nya (HIT/MISS + kapan terakhir diambil) muncul sebagai badge di pojok kanan atas dashboard. Di sebelahnya ada tombol refresh (ikon 🔄) untuk **paksa ambil data terbaru langsung dari Supabase**, melewati cache — **klik ini setiap habis menjalankan `npm run import:supabase`**, supaya user langsung lihat data baru.

Cache tersimpan per-browser (bukan per-device/per-user), jadi kalau ganti browser atau buka mode incognito, otomatis MISS lagi di awal. Mode lokal (`VITE_DATA_SOURCE=local`) tidak pakai caching sama sekali karena baca file statis, bukan API.

## Cara membaca data & aturan bisnis

- **`INPUT_REKAPAN_PROGRAM.xlsx` → tabel `rekapan_program`**: ini data master, satu baris = satu toko mengajukan satu program. Ditampilkan **seluruhnya** di tab "Pengajuan Paket", tidak ada baris yang disembunyikan.
  - Kolom **FORM FISIK**: `0` = form fisik **belum sampai ke kantor**, `1` = **sudah sampai**.
  - Kolom **PENGAJUAN PAKET** (atau **PAKET PENGAJUAN** di sheet INLITE): jumlah paket program yang diajukan toko tsb.
- **`MASTER_BARANG.xlsx` → tabel `master_barang`**: daftar barang apa saja yang termasuk tiap program, per supplier.
- **`DATA_PENJUALAN.xlsx` → tabel `data_penjualan`**: dipakai untuk mencocokkan apakah nominal & nama barang yang sudah terjual (jadi faktur) memenuhi syarat program. Kolom **F. QTY** = qty barang program yang sudah jadi faktur / sudah dikirim.
- **Kekurangan kirim**: untuk tiap pengajuan (toko x program), barang program dicari di `data_penjualan` lewat nama barang yang cocok dengan `master_barang` program tsb, lalu di-jumlah F.QTY-nya. Kekurangan = `PENGAJUAN PAKET - total F.QTY yang sudah jadi faktur` (minimal 0). Ini yang dipakai untuk kolom **"Kekurangan Kirim"** di tab "Pengajuan Paket" — jumlah barang yang masih perlu dikirim ke pelanggan supaya pengajuan paketnya terpenuhi.

Logika lengkap ada di `src/lib/compute.js` (`computeKekuranganPaket`) dan di view SQL `v_rekap_kekurangan` (di `supabase/schema.sql`) untuk yang ingin query langsung dari database / bikin laporan lain.

## Ringkasan aturan program (tab "Rekap Program")

| Program | Supplier | Syarat | Reward |
|---|---|---|---|
| SUPERFAN | DCOTA | Beli min. 2 dari item wajib **dan** omset item program melebihi target nominal dalam periode | — |
| BUCKET SEAL | DCOTA | Beli semua item program | Diskon 10% |
| KUNINGAN | DCOTA | Beli minimal 2 varian berbeda dari daftar item Kuningan | Diskon 5% |
| PVCBV | DCOTA | Beli minimal 2 varian berbeda dari daftar item PVCBV | Diskon 7% |
| DISPLAY HOKI | INLITE | Omset item program mencapai target nominal dalam periode | Rp 200.000 |

Target nominal & periode tiap program sekarang diambil per-toko dari `rekapan_program` (kolom `TARGET NOMINAL`/`TARGET`, `AWAL PROGRAM`, `AKHIR PROGRAM`), bukan dari sheet terpisah lagi.

## Struktur file yang relevan

```
supabase/schema.sql            # DDL: 3 tabel + view v_rekap_kekurangan + RLS (mode Supabase)
scripts/import-to-supabase.mjs # Script Node: baca 3 Excel -> upload ke Supabase (mode Supabase)
src/lib/localLoader.js         # Baca 3 Excel langsung dari public/data/ di browser (mode lokal, default)
src/lib/supabaseClient.js      # Klien Supabase untuk browser (pakai anon key, mode Supabase)
src/lib/supabaseLoader.js      # Ambil & normalisasi data dari Supabase (mode Supabase)
src/lib/compute.js             # Semua logika rekap, termasuk computeKekuranganPaket (dipakai kedua mode)
src/components/PengajuanPaketTable.jsx  # Tab "Pengajuan Paket" (form fisik + kekurangan kirim)
```
