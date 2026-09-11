// ============================================================================
// Import Excel -> Supabase
//
// Membaca 3 file Excel dan memindahkan isinya ke tabel Supabase:
//   INPUT_REKAPAN_PROGRAM.xlsx  -> rekapan_program   (semua sheet = semua SUPP)
//   MASTER_BARANG.xlsx          -> master_barang
//   DATA_PENJUALAN.xlsx         -> data_penjualan
//
// Cara pakai:
//   1. npm install
//   2. Salin .env.example -> .env, isi SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY
//      (pakai SERVICE ROLE key, bukan anon key, karena script ini menulis data
//      dan tabel diproteksi RLS untuk anon).
//   3. Jalankan: node scripts/import-to-supabase.mjs
//      Opsional: --dir=./path/ke/folder/excel (default: folder ini/../data-in)
//
// Script ini aman dijalankan berulang kali: data lama di tiap tabel akan
// dikosongkan dulu (delete) baru diisi ulang (full refresh), supaya angka
// selalu sinkron dengan file Excel yang terbaru.
// ============================================================================

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

const SRC_DIR = args.dir || path.resolve(process.cwd(), 'data-in')
const FILES = {
  rekapan: path.join(SRC_DIR, 'INPUT_REKAPAN_PROGRAM.xlsx'),
  masterBarang: path.join(SRC_DIR, 'MASTER_BARANG.xlsx'),
  penjualan: path.join(SRC_DIR, 'DATA_PENJUALAN.xlsx'),
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset. Isi file .env dulu (lihat .env.example).')
  process.exit(1)
}

for (const [label, p] of Object.entries(FILES)) {
  if (!fs.existsSync(p)) {
    console.error(`File tidak ditemukan (${label}): ${p}\nLetakkan ketiga file Excel di folder "${SRC_DIR}" atau pakai --dir=path/ke/folder.`)
    process.exit(1)
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function sheetToRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
}

function buildIndex(header) {
  const idx = {}
  header.forEach((h, i) => {
    if (h == null) return
    idx[String(h).trim().toUpperCase()] = i
  })
  return idx
}

function get(row, idx, name, fallbackNames = []) {
  for (const n of [name, ...fallbackNames]) {
    const i = idx[n.toUpperCase()]
    if (i !== undefined && row[i] !== undefined) return row[i]
  }
  return null
}

function toISODate(v) {
  if (v == null || v === '') return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) return null
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const d = new Date(v)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

function num(v) {
  if (v == null || v === '') return 0
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function truthy01(v) {
  if (v == null || v === '') return false
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toUpperCase()
  return s === '1' || s === 'TRUE' || s === 'YA' || s === 'SUDAH'
}

async function upsertBatched(table, rows, { chunk = 500, onConflict } = {}) {
  if (rows.length === 0) return
  for (let i = 0; i < rows.length; i += chunk) {
    const batch = rows.slice(i, i + chunk)
    const q = onConflict
      ? supabase.from(table).upsert(batch, { onConflict })
      : supabase.from(table).insert(batch)
    const { error } = await q
    if (error) {
      console.error(`Gagal insert ke ${table} (baris ${i}-${i + batch.length}):`, error.message)
      process.exit(1)
    }
    process.stdout.write(`\r  ${table}: ${Math.min(i + chunk, rows.length)}/${rows.length}`)
  }
  console.log('')
}

// ---------------------------------------------------------------------------
// 1) MASTER_BARANG.xlsx
// ---------------------------------------------------------------------------
function readMasterBarang(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const sheetName = wb.SheetNames.find((s) => s.trim().toUpperCase() === 'MASTER BARANG') || wb.SheetNames[0]
  const rows = sheetToRows(wb.Sheets[sheetName])
  const idx = buildIndex(rows[0])

  const out = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every((c) => c == null)) continue
    const program = get(row, idx, 'PROGRAM')
    const namaBarang = get(row, idx, 'NAMA BARANG')
    if (!program || !namaBarang) continue
    const wajibRaw = get(row, idx, 'ITEM WAJIB PROGAM', ['ITEM WAJIB PROGRAM'])
    out.push({
      supp: String(get(row, idx, 'SUPP') || '').trim(),
      kode_barang: get(row, idx, 'KODE BARANG'),
      nama_barang: String(namaBarang).trim(),
      isi_per_kotak: num(get(row, idx, 'ISI PER KOTAK')) || null,
      program: String(program).trim(),
      item_wajib: !!(wajibRaw && String(wajibRaw).trim().toUpperCase() === 'WAJIB'),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// 2) INPUT_REKAPAN_PROGRAM.xlsx — satu sheet per SUPP, kolom sedikit beda
//    antar sheet (mis. "PENGAJUAN PAKET" vs "PAKET PENGAJUAN"), jadi dibaca
//    per-sheet lalu digabung. Nama sheet dipakai sebagai SUPP.
// ---------------------------------------------------------------------------
function readRekapanProgram(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const out = []
  const seenKeys = new Map() // `${supp}||${kodeToko}||${program}||${awalProgram}` -> index di out
  const dupes = []

  for (const sheetName of wb.SheetNames) {
    const rows = sheetToRows(wb.Sheets[sheetName])
    if (rows.length < 2) continue
    const idx = buildIndex(rows[0])
    const supp = sheetName.trim().toUpperCase()

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]
      if (!row || row.every((c) => c == null)) continue
      const kodeToko = get(row, idx, 'KODE TOKO', ['KD TOKO'])
      const program = get(row, idx, 'PROGRAM')
      if (!kodeToko || !program) continue

      const entry = {
        supp,
        kode_toko: String(kodeToko).trim(),
        nama_pelanggan: get(row, idx, 'NAMA PELANGGAN', ['NAMA TOKO']),
        alamat_pelanggan: get(row, idx, 'ALAMAT PELANGGAN', ['ALAMAT TOKO']),
        depo: get(row, idx, 'DEPO'),
        kota_area: get(row, idx, 'KOTA/AREA', ['KOTA', 'AREA']),
        salesman: get(row, idx, 'SALESMAN'),
        program: String(program).trim(),
        // "master data harus ditampilkan semua" -> semua baris ikut masuk,
        // tidak ada baris yang di-skip berdasarkan nilai kolom ini.
        pengajuan_paket: num(get(row, idx, 'PENGAJUAN PAKET', ['PAKET PENGAJUAN'])),
        // FORM FISIK: 0 = belum sampai ke kantor, 1 = sudah sampai.
        form_fisik: truthy01(get(row, idx, 'FORM FISIK')),
        target_nominal: (() => {
          const v = get(row, idx, 'TARGET NOMINAL', ['TARGET'])
          return v == null || v === '' ? null : num(v)
        })(),
        awal_program: toISODate(get(row, idx, 'AWAL PROGRAM')),
        akhir_program: toISODate(get(row, idx, 'AKHIR PROGRAM')),
      }

      // Tabel rekapan_program punya unique constraint di kombinasi
      // (supp, kode_toko, program, awal_program). Excel-nya kadang ada
      // baris kepencet dobel utk kombinasi yg sama -> digabung di sini
      // (baris pertama yg dipakai) supaya insert tidak crash. Kalau
      // isinya ternyata beda (bukan cuma dobel-ketik), dilaporkan sbg
      // warning supaya bisa dicek manual mana yang benar.
      const dedupeKey = `${supp}||${entry.kode_toko.toUpperCase()}||${entry.program.toUpperCase()}||${entry.awal_program ?? ''}`
      if (seenKeys.has(dedupeKey)) {
        const prevIdx = seenKeys.get(dedupeKey)
        const prev = out[prevIdx]
        const sameData = prev.pengajuan_paket === entry.pengajuan_paket
          && prev.form_fisik === entry.form_fisik
          && prev.target_nominal === entry.target_nominal
          && prev.akhir_program === entry.akhir_program
        if (!sameData) {
          dupes.push({ sheetName, kodeToko: entry.kode_toko, program: entry.program, prev, entry })
        }
        continue
      }
      seenKeys.set(dedupeKey, out.length)
      out.push(entry)
    }
  }
  return { rows: out, dupes }
}

// ---------------------------------------------------------------------------
// 3) DATA_PENJUALAN.xlsx
// ---------------------------------------------------------------------------
function readDataPenjualan(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]]
  const rows = sheetToRows(ws)
  const idx = buildIndex(rows[0])

  const out = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every((c) => c == null)) continue
    const noFaktur = get(row, idx, 'NO FAKTUR')
    if (noFaktur == null) continue
    out.push({
      no_faktur: String(noFaktur),
      tgl_faktur: toISODate(get(row, idx, 'TGL FAKTUR')),
      kode_pelanggan: get(row, idx, 'KODE PELANGGAN', ['KODE TOKO']),
      nama_pelanggan: get(row, idx, 'NAMA PELANGGAN'),
      alamat_pelanggan: get(row, idx, 'ALAMAT PELANGGAN'),
      gdng_pemasok: get(row, idx, 'GDNG PEMASOK'),
      salesman: get(row, idx, 'SALESMAN'),
      pajak_persen: num(get(row, idx, 'PAJAK %')) || null,
      kode_barang: get(row, idx, 'KODE BARANG'),
      nama_barang: (get(row, idx, 'NAMA BARANG') || '').toString().trim(),
      f_qty: num(get(row, idx, 'F. QTY', ['QTY'])),
      satuan: get(row, idx, 'SATUAN'),
      harga: num(get(row, idx, 'HARGA @')) || null,
      pajak_rp: num(get(row, idx, 'PAJAK Rp.')) || null,
      cinvspecial: get(row, idx, 'CINVSPECIAL'),
      supplier: get(row, idx, 'SUPPLIER'),
      kota: get(row, idx, 'KOTA'),
      nominal: num(get(row, idx, 'NOMINAL')),
      qty: num(get(row, idx, 'QTY')) || null,
      supp: get(row, idx, 'SUPP'),
      divisi: get(row, idx, 'DIVISI'),
      depo: get(row, idx, 'DEPO'),
      bulan: get(row, idx, 'BULAN'),
      tahun: get(row, idx, 'TAHUN') != null ? String(get(row, idx, 'TAHUN')) : null,
      bln_thn: get(row, idx, 'BLN - THN', ['BLN-THN']),
      kd_grup: get(row, idx, 'KD GRUP'),
      kd_supp: get(row, idx, 'KD_SUPP'),
      area: get(row, idx, 'AREA'),
      sales_faktur: get(row, idx, 'SALES FAKTUR', ['SALESMAN']),
      kategori: get(row, idx, 'KATEGORI'),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Membaca file dari: ${SRC_DIR}`)

  const masterBarang = readMasterBarang(FILES.masterBarang)
  const { rows: rekapanProgram, dupes: rekapanDupes } = readRekapanProgram(FILES.rekapan)
  const dataPenjualan = readDataPenjualan(FILES.penjualan)

  console.log(`  MASTER_BARANG.xlsx          -> ${masterBarang.length} baris`)
  console.log(`  INPUT_REKAPAN_PROGRAM.xlsx  -> ${rekapanProgram.length} baris`)
  console.log(`  DATA_PENJUALAN.xlsx         -> ${dataPenjualan.length} baris`)

  if (rekapanDupes.length > 0) {
    console.log(`\nPERINGATAN: ${rekapanDupes.length} baris di INPUT_REKAPAN_PROGRAM.xlsx punya SUPP+KODE TOKO+PROGRAM+AWAL PROGRAM yang sama tapi isinya beda (cuma baris pertama yang dipakai, cek manual mana yang benar):`)
    for (const d of rekapanDupes.slice(0, 20)) {
      console.log(`   - [sheet ${d.sheetName}] ${d.kodeToko} / ${d.program}: pengajuan_paket ${d.prev.pengajuan_paket} vs ${d.entry.pengajuan_paket}`)
    }
    if (rekapanDupes.length > 20) console.log(`   ...dan ${rekapanDupes.length - 20} baris lainnya`)
  }

  console.log('\nMengosongkan tabel lama (full refresh)...')
  for (const table of ['data_penjualan', 'rekapan_program', 'master_barang']) {
    const { error } = await supabase.from(table).delete().neq('id', -1)
    if (error) {
      console.error(`Gagal mengosongkan ${table}:`, error.message)
      process.exit(1)
    }
  }

  console.log('\nMengunggah data baru...')
  await upsertBatched('master_barang', masterBarang)
  await upsertBatched('rekapan_program', rekapanProgram)
  await upsertBatched('data_penjualan', dataPenjualan)

  console.log('\nUpdate waktu sync (sync_meta)...')
  const { error: metaErr } = await supabase.from('sync_meta').upsert({ id: 1, last_synced_at: new Date().toISOString() })
  if (metaErr) {
    // Tidak fatal -- data utama sudah berhasil ke-upload. Kemungkinan besar
    // tabel sync_meta belum dibuat (jalankan ulang supabase/schema.sql).
    console.warn('Peringatan: gagal update sync_meta:', metaErr.message)
  }

  console.log('\nSelesai. Data sudah dipindahkan ke Supabase.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
