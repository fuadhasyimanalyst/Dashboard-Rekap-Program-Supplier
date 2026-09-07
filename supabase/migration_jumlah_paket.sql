-- ============================================================
-- MIGRASI TAMBAHAN: fitur "Jumlah Paket"
-- Jalankan ini di Supabase project yang SUDAH ada (sudah pernah
-- menjalankan supabase/migration.sql sebelumnya). Aman dijalankan
-- berkali-kali (pakai IF NOT EXISTS / OR REPLACE).
--
-- Cara pakai: buka Supabase Dashboard -> SQL Editor -> paste isi
-- file ini -> Run.
-- ============================================================

-- ---------- TABEL JUMLAH PAKET (dari MASTER_PROGRAM.xlsx > sheet "JUMLAH PAKET") ----------
create table if not exists public.jumlah_paket (
  id              bigint generated always as identity primary key,
  kode_toko       text,          -- KODE PELANGGAN, boleh kosong kalau dicocokkan lewat nama
  nama_pelanggan  text,
  supp            text not null,
  program         text not null,
  jumlah_paket    integer not null default 1 check (jumlah_paket > 0),
  created_at      timestamptz not null default now(),
  unique (kode_toko, supp, program)
);

comment on table public.jumlah_paket is 'Berapa paket program yang diambil tiap pelanggan (per supp+program). Syarat omset (nominal_wajib) dan syarat jumlah varian wajib di src/lib/compute.js dikalikan angka ini; default 1 kalau pelanggan tidak terdaftar di sini.';

create index if not exists idx_jumlah_paket_kode_toko    on public.jumlah_paket (kode_toko);
create index if not exists idx_jumlah_paket_supp_program on public.jumlah_paket (supp, program);

alter table public.jumlah_paket enable row level security;

drop policy if exists "Allow read access - jumlah_paket" on public.jumlah_paket;
create policy "Allow read access - jumlah_paket"
  on public.jumlah_paket for select
  to authenticated, anon
  using (true);

-- Update penanda sync supaya dashboard langsung refresh cache-nya begitu
-- migration ini selesai dijalankan (kalau tabel sync_meta sudah ada).
update public.sync_meta set last_synced_at = now() where id = 1;
