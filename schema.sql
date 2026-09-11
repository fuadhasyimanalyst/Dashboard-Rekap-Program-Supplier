-- ============================================================================
-- Dashboard Program Supplier — Supabase schema
-- Jalankan file ini di Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- Bersihkan dulu kalau mau reset total (hati-hati, ini akan hapus semua data)
-- drop view if exists v_rekap_kekurangan;
-- drop table if exists data_penjualan;
-- drop table if exists rekapan_program;
-- drop table if exists master_barang;

-- ----------------------------------------------------------------------------
-- 1) MASTER_BARANG.xlsx  -> tabel master_barang
--    "data barang yang dijadikan program" — daftar item apa saja yang masuk
--    ke tiap program, per supplier.
-- ----------------------------------------------------------------------------
create table if not exists master_barang (
  id             bigint generated always as identity primary key,
  supp           text not null,                 -- DCOTA, INLITE, dst
  kode_barang    text,
  nama_barang    text not null,
  isi_per_kotak  numeric,
  program        text not null,                 -- PVCBV, SUPERFAN, BUCKET SEAL, dst
  item_wajib     boolean not null default false, -- true jika "ITEM WAJIB PROGAM" = WAJIB
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_master_barang_program on master_barang (supp, program);
create index if not exists idx_master_barang_nama on master_barang (upper(nama_barang));

-- ----------------------------------------------------------------------------
-- 2) INPUT_REKAPAN_PROGRAM.xlsx -> tabel rekapan_program
--    Ini "data master" pengajuan per toko: satu baris = satu toko yang
--    mengajukan satu program. Ditampilkan APA ADANYA (semua baris, tanpa
--    difilter) di halaman "Rekap Program".
--
--    form_fisik: 0 = form fisik BELUM sampai ke kantor, 1 = SUDAH sampai.
--    pengajuan_paket: jumlah paket program yang diajukan toko tsb.
--    target_nominal: syarat omset (kalau program berbasis nominal, boleh null).
-- ----------------------------------------------------------------------------
create table if not exists rekapan_program (
  id                bigint generated always as identity primary key,
  supp              text not null,               -- sumber sheet, mis. DCOTA / INLITE
  kode_toko         text not null,
  nama_pelanggan    text,
  alamat_pelanggan  text,
  depo              text,
  kota_area         text,
  salesman          text,
  program           text not null,
  pengajuan_paket   numeric not null default 0,  -- "PENGAJUAN PAKET" / "PAKET PENGAJUAN"
  form_fisik        boolean not null default false, -- 0/1 di excel -> false/true
  target_nominal    numeric,                     -- "TARGET NOMINAL" / "TARGET" (boleh null)
  awal_program      date,
  akhir_program     date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (supp, kode_toko, program, awal_program)
);

create index if not exists idx_rekapan_program_lookup on rekapan_program (supp, program, kode_toko);

-- ----------------------------------------------------------------------------
-- 3) DATA_PENJUALAN.xlsx -> tabel data_penjualan
--    Dipakai untuk mencocokkan apakah nominal & nama barang yang terjual
--    sudah memenuhi syarat program. F. QTY = qty barang program yang sudah
--    jadi faktur (sudah terkirim/terjual ke toko).
-- ----------------------------------------------------------------------------
create table if not exists data_penjualan (
  id                bigint generated always as identity primary key,
  no_faktur         text not null,
  tgl_faktur        date,
  kode_pelanggan    text,
  nama_pelanggan    text,
  alamat_pelanggan  text,
  gdng_pemasok      text,
  salesman          text,
  pajak_persen      numeric,
  kode_barang       text,
  nama_barang       text,
  f_qty             numeric not null default 0,  -- "F. QTY" — qty yang sudah jadi faktur
  satuan            text,
  harga             numeric,
  pajak_rp          numeric,
  cinvspecial       text,
  supplier          text,
  kota              text,
  nominal           numeric not null default 0,
  qty               numeric,
  supp              text,                        -- kode supplier singkat, dipakai untuk join ke master_barang
  divisi            text,
  depo              text,
  bulan             text,
  tahun             text,
  bln_thn           text,
  kd_grup           text,
  kd_supp           text,
  area              text,
  sales_faktur      text,
  kategori          text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_data_penjualan_toko on data_penjualan (kode_pelanggan, supp);
create index if not exists idx_data_penjualan_barang on data_penjualan (supp, upper(nama_barang));
create index if not exists idx_data_penjualan_faktur on data_penjualan (no_faktur);
create index if not exists idx_data_penjualan_tgl on data_penjualan (tgl_faktur);

-- ----------------------------------------------------------------------------
-- 4) View: v_rekap_kekurangan
--    Menggabungkan ketiga tabel di atas menjadi rekap per (toko x program):
--      - pengajuan_paket   : jumlah paket yang diajukan (dari rekapan_program)
--      - qty_terkirim      : total F.QTY barang program yang sudah jadi
--                            faktur untuk toko tsb, dalam periode program
--      - kekurangan_qty    : GREATEST(pengajuan_paket - qty_terkirim, 0)
--                            -> jumlah barang yang MASIH PERLU dikirim
--      - form_fisik_status : 'Sudah sampai kantor' / 'Belum sampai kantor'
-- ----------------------------------------------------------------------------
create or replace view v_rekap_kekurangan as
with realisasi as (
  select
    dp.supp,
    dp.kode_pelanggan as kode_toko,
    mb.program,
    sum(dp.f_qty)      as qty_terkirim,
    sum(dp.nominal)    as nominal_terkirim
  from data_penjualan dp
  join master_barang mb
    on mb.supp = dp.supp
   and upper(trim(mb.nama_barang)) = upper(trim(dp.nama_barang))
  group by dp.supp, dp.kode_pelanggan, mb.program
)
select
  rp.id,
  rp.supp,
  rp.kode_toko,
  rp.nama_pelanggan,
  rp.alamat_pelanggan,
  rp.depo,
  rp.kota_area,
  rp.salesman,
  rp.program,
  rp.pengajuan_paket,
  rp.form_fisik,
  case when rp.form_fisik then 'Sudah sampai kantor' else 'Belum sampai kantor' end as form_fisik_status,
  rp.target_nominal,
  rp.awal_program,
  rp.akhir_program,
  coalesce(r.qty_terkirim, 0)     as qty_terkirim,
  coalesce(r.nominal_terkirim, 0) as nominal_terkirim,
  greatest(rp.pengajuan_paket - coalesce(r.qty_terkirim, 0), 0) as kekurangan_qty,
  (rp.pengajuan_paket > 0 and coalesce(r.qty_terkirim, 0) >= rp.pengajuan_paket) as paket_terpenuhi,
  (rp.target_nominal is not null and coalesce(r.nominal_terkirim, 0) >= rp.target_nominal) as nominal_terpenuhi
from rekapan_program rp
left join realisasi r
  on r.supp = rp.supp
 and r.kode_toko = rp.kode_toko
 and r.program = rp.program;

-- ----------------------------------------------------------------------------
-- Row Level Security — dashboard internal, dibaca lewat anon key.
-- Buka akses baca untuk semua (anon + authenticated). Tulis/insert tetap
-- lewat service role key saja (dipakai oleh scripts/import-to-supabase.mjs),
-- jadi tidak perlu policy insert/update untuk anon.
-- ----------------------------------------------------------------------------
alter table master_barang enable row level security;
alter table rekapan_program enable row level security;
alter table data_penjualan enable row level security;

drop policy if exists "public read master_barang" on master_barang;
create policy "public read master_barang" on master_barang for select using (true);

drop policy if exists "public read rekapan_program" on rekapan_program;
create policy "public read rekapan_program" on rekapan_program for select using (true);

drop policy if exists "public read data_penjualan" on data_penjualan;
create policy "public read data_penjualan" on data_penjualan for select using (true);
