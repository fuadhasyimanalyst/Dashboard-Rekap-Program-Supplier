-- ============================================================
-- Migrasi dashboard "Rekap Program Supp" ke Supabase (Postgres)
-- Skema ini mengikuti struktur yang dibaca oleh src/lib/excelLoader.js
-- dari DATA_PENJUALAN.xlsx dan MASTER_PROGRAM.xlsx
-- ============================================================

-- ---------- 1. TABEL SALES (dari DATA_PENJUALAN.xlsx > Sheet1) ----------
create table if not exists public.sales (
  id               bigint generated always as identity primary key,
  no_faktur        text not null,
  tgl_faktur       date,
  kode_toko        text,          -- KODE PELANGGAN / KODE TOKO
  nama_pelanggan   text,
  alamat_pelanggan text,
  depo             text,
  sales_faktur     text,          -- SALES FAKTUR / SALESMAN
  kode_barang      text,
  nama_barang      text not null,
  qty              numeric not null default 0,
  nominal          numeric not null default 0,
  supp             text not null,
  kota             text,
  bulan            text,
  bln_thn          text,
  tahun            text,
  area             text,
  divisi           text,
  created_at       timestamptz not null default now()
);

comment on table public.sales is 'Data transaksi penjualan per baris faktur (1 baris = 1 item dalam 1 faktur)';

-- ---------- 2. TABEL MASTER BARANG (dari MASTER_PROGRAM.xlsx > MASTER BARANG) ----------
create table if not exists public.master_barang (
  id             bigint generated always as identity primary key,
  supp           text not null,
  kode_barang    text,
  nama_barang    text not null,
  isi_per_kotak  numeric,
  program        text not null,
  wajib          boolean not null default false,   -- true jika "ITEM WAJIB PROGAM" = 'WAJIB'
  created_at     timestamptz not null default now()
);

comment on table public.master_barang is 'Daftar barang yang termasuk dalam tiap program per supplier, dan status wajib/tidak';

-- ---------- 3. TABEL NOMINAL WAJIB (dari MASTER_PROGRAM.xlsx > NOMINAL WAJIB) ----------
create table if not exists public.nominal_wajib (
  id       bigint generated always as identity primary key,
  supp     text not null,
  program  text not null,
  nominal  numeric not null default 0,
  unique (supp, program)
);

comment on table public.nominal_wajib is 'Syarat minimal omset per supplier + program';

-- ---------- 4. TABEL PERIODE PROGRAM (dari MASTER_PROGRAM.xlsx > PERIODE PROGRAM) ----------
create table if not exists public.periode_program (
  id       bigint generated always as identity primary key,
  supp     text not null,
  program  text not null,
  awal     date,
  akhir    date,
  unique (supp, program)
);

comment on table public.periode_program is 'Periode berlaku tiap program per supplier';

-- ---------- 5. TABEL SYNC META (penanda versi data untuk cache di frontend) ----------
create table if not exists public.sync_meta (
  id             int primary key default 1,
  last_synced_at timestamptz not null default now(),
  constraint sync_meta_singleton check (id = 1)
);

insert into public.sync_meta (id, last_synced_at)
values (1, now())
on conflict (id) do nothing;

comment on table public.sync_meta is 'Satu baris penanda kapan terakhir data disinkronkan dari Excel. Dipakai dashboard untuk tahu kapan cache lokal harus di-refresh.';

-- ============================================================
-- INDEX
-- Disesuaikan dengan pola join & filter di src/lib/compute.js
-- (join by supp + UPPER(TRIM(nama_barang)), group by kode_toko + supp + program)
-- ============================================================
create index if not exists idx_sales_supp_barang on public.sales (supp, upper(trim(nama_barang)));
create index if not exists idx_sales_kode_toko    on public.sales (kode_toko);
create index if not exists idx_sales_tgl_faktur   on public.sales (tgl_faktur);
create index if not exists idx_sales_depo_kota    on public.sales (depo, kota);

create index if not exists idx_master_barang_supp_program on public.master_barang (supp, program);
create index if not exists idx_master_barang_supp_nama    on public.master_barang (supp, upper(trim(nama_barang)));

-- ============================================================
-- ROW LEVEL SECURITY
-- Dashboard ini membaca data langsung dari browser (client-side),
-- jadi RLS wajib diaktifkan. Contoh di bawah membolehkan SELECT
-- untuk siapa saja yang terautentikasi (anon key). Sesuaikan
-- dengan kebutuhan (mis. hanya role tertentu) sebelum production.
-- ============================================================
alter table public.sales           enable row level security;
alter table public.master_barang   enable row level security;
alter table public.nominal_wajib   enable row level security;
alter table public.periode_program enable row level security;
alter table public.sync_meta       enable row level security;

create policy "Allow read access - sales"
  on public.sales for select
  to authenticated, anon
  using (true);

create policy "Allow read access - master_barang"
  on public.master_barang for select
  to authenticated, anon
  using (true);

create policy "Allow read access - nominal_wajib"
  on public.nominal_wajib for select
  to authenticated, anon
  using (true);

create policy "Allow read access - periode_program"
  on public.periode_program for select
  to authenticated, anon
  using (true);

create policy "Allow read access - sync_meta"
  on public.sync_meta for select
  to authenticated, anon
  using (true);

-- Jika perlu insert/update dari aplikasi (mis. upload data baru),
-- tambahkan policy serupa untuk "insert"/"update"/"delete" dengan
-- role yang sesuai (biasanya "authenticated" saja, bukan "anon").
