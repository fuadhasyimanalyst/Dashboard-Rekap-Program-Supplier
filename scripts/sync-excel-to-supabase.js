// Sinkronisasi data Excel lokal -> Supabase.
// Dipakai tiap kali kamu punya export baru dari sistem (file diganti total).
// Strategi: hapus semua baris lama di tiap tabel, lalu insert ulang dari Excel.
//
// Cara pakai:
//   npm run sync
//   (default baca dari public/data/DATA_PENJUALAN.xlsx & public/data/MASTER_PROGRAM.xlsx)
//
// Atau tunjuk file lain:
//   npm run sync -- "C:\path\ke\DATA_PENJUALAN.xlsx" "C:\path\ke\MASTER_PROGRAM.xlsx"

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import * as XLSX_NS from 'xlsx'
// Di Node murni (bukan Vite), method seperti readFile hanya ada di
// default export paket xlsx, bukan di namespace import.
const XLSX = XLSX_NS.default ?? XLSX_NS
import path from 'path'
import { toISODate } from '../src/lib/format.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset di .env.\n' +
    'Ini BEDA dari VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY yang dipakai dashboard.\n' +
    'Lihat .env.example untuk contoh, dan JANGAN pernah commit key ini ke git.'
  )
  process.exit(1)
}

// Service role key bypass RLS -> hanya boleh dipakai di script/server, tidak pernah di frontend.
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const salesPath = process.argv[2] || 'public/data/DATA_PENJUALAN.xlsx'
const masterPath = process.argv[3] || 'public/data/MASTER_PROGRAM.xlsx'

function sheetToRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
}
function buildIndex(header) {
  const idx = {}
  header.forEach((h, i) => { if (h != null) idx[String(h).trim().toUpperCase()] = i })
  return idx
}
function get(row, idx, name, fallbackNames = []) {
  for (const n of [name, ...fallbackNames]) {
    const i = idx[n.toUpperCase()]
    if (i !== undefined) return row[i]
  }
  return null
}

function parseSales(filePath) {
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
      kode_toko: get(row, idx, 'KODE PELANGGAN', ['KODE TOKO']),
      nama_pelanggan: get(row, idx, 'NAMA PELANGGAN'),
      alamat_pelanggan: get(row, idx, 'ALAMAT PELANGGAN'),
      depo: get(row, idx, 'DEPO'),
      sales_faktur: get(row, idx, 'SALES FAKTUR', ['SALESMAN']),
      kode_barang: get(row, idx, 'KODE BARANG'),
      nama_barang: (get(row, idx, 'NAMA BARANG') || '').toString().trim(),
      qty: Number(get(row, idx, 'QTY', ['F. QTY'])) || 0,
      nominal: Number(get(row, idx, 'NOMINAL')) || 0,
      supp: get(row, idx, 'SUPP'),
      kota: get(row, idx, 'KOTA'),
      bulan: get(row, idx, 'BULAN'),
      bln_thn: get(row, idx, 'BLN - THN'),
      tahun: get(row, idx, 'TAHUN'),
      area: get(row, idx, 'AREA'),
      divisi: get(row, idx, 'DIVISI'),
    })
  }
  return out
}

function parseMaster(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const findSheet = (name) => wb.SheetNames.find((s) => s.trim().toUpperCase() === name)

  const barangSheetName = findSheet('MASTER BARANG') || wb.SheetNames[0]
  const barangRows = sheetToRows(wb.Sheets[barangSheetName])
  const bIdx = buildIndex(barangRows[0])
  const masterBarang = []
  for (let r = 1; r < barangRows.length; r++) {
    const row = barangRows[r]
    if (!row || row.every((c) => c == null)) continue
    const program = get(row, bIdx, 'PROGRAM')
    if (!program) continue
    const wajibRaw = get(row, bIdx, 'ITEM WAJIB PROGAM', ['ITEM WAJIB PROGRAM'])
    masterBarang.push({
      supp: get(row, bIdx, 'SUPP'),
      kode_barang: get(row, bIdx, 'KODE BARANG'),
      nama_barang: (get(row, bIdx, 'NAMA BARANG') || '').toString().trim(),
      isi_per_kotak: get(row, bIdx, 'ISI PER KOTAK'),
      program: String(program).trim(),
      wajib: !!(wajibRaw && String(wajibRaw).trim().toUpperCase() === 'WAJIB'),
    })
  }

  const nominalWajib = []
  const nominalSheetName = findSheet('NOMINAL WAJIB')
  if (nominalSheetName) {
    const nRows = sheetToRows(wb.Sheets[nominalSheetName])
    const nIdx = buildIndex(nRows[0])
    for (let r = 1; r < nRows.length; r++) {
      const row = nRows[r]
      if (!row || row.every((c) => c == null)) continue
      const supp = get(row, nIdx, 'SUPP')
      if (!supp) continue
      nominalWajib.push({
        supp,
        program: String(get(row, nIdx, 'PROGRAM')).trim(),
        nominal: Number(get(row, nIdx, 'NOMINAL')) || 0,
      })
    }
  }

  const periodeProgram = []
  const periodeSheetName = findSheet('PERIODE PROGRAM')
  if (periodeSheetName) {
    const pRows = sheetToRows(wb.Sheets[periodeSheetName])
    const pIdx = buildIndex(pRows[0])
    for (let r = 1; r < pRows.length; r++) {
      const row = pRows[r]
      if (!row || row.every((c) => c == null)) continue
      const supp = get(row, pIdx, 'SUPP')
      if (!supp) continue
      periodeProgram.push({
        supp,
        program: String(get(row, pIdx, 'PROGRAM')).trim(),
        awal: toISODate(get(row, pIdx, 'AWAL PROGRAM')),
        akhir: toISODate(get(row, pIdx, 'AKHIR PROGRAM')),
      })
    }
  }

  // Sheet baru: "JUMLAH PAKET" -> KODE PELANGGAN | NAMA PELANGGAN | SUPP |
  // PROGRAM | JUMLAH PAKET. Syarat omset & syarat varian wajib di
  // src/lib/compute.js dikalikan angka ini per pelanggan+supp+program.
  const jumlahPaket = []
  const paketSheetName = findSheet('JUMLAH PAKET')
  if (paketSheetName) {
    const kRows = sheetToRows(wb.Sheets[paketSheetName])
    const kIdx = buildIndex(kRows[0])
    for (let r = 1; r < kRows.length; r++) {
      const row = kRows[r]
      if (!row || row.every((c) => c == null)) continue
      const supp = get(row, kIdx, 'SUPP')
      const program = get(row, kIdx, 'PROGRAM')
      if (!supp || !program) continue
      const jumlah = Number(get(row, kIdx, 'JUMLAH PAKET', ['PAKET', 'JML PAKET']))
      jumlahPaket.push({
        kode_toko: get(row, kIdx, 'KODE PELANGGAN', ['KODE TOKO']),
        nama_pelanggan: get(row, kIdx, 'NAMA PELANGGAN'),
        supp,
        program: String(program).trim(),
        jumlah_paket: jumlah > 0 ? jumlah : 1,
      })
    }
  }

  return { masterBarang, nominalWajib, periodeProgram, jumlahPaket }
}

async function replaceTable(table, rows) {
  console.log(`-> Menghapus data lama di "${table}"...`)
  const { error: delErr } = await supabase.from(table).delete().not('id', 'is', null)
  if (delErr) throw new Error(`Gagal hapus data lama "${table}": ${delErr.message}`)

  if (rows.length === 0) {
    console.log(`   Tidak ada baris baru untuk "${table}".`)
    return
  }

  console.log(`-> Menulis ${rows.length} baris baru ke "${table}"...`)
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw new Error(`Gagal insert ke "${table}" (baris ${i}-${i + chunk.length}): ${error.message}`)
    process.stdout.write(`   ${Math.min(i + CHUNK, rows.length)}/${rows.length}\r`)
  }
  console.log(`   Selesai (${rows.length} baris).`)
}

async function main() {
  console.log(`Membaca ${salesPath} & ${masterPath} ...`)
  const sales = parseSales(path.resolve(salesPath))
  const { masterBarang, nominalWajib, periodeProgram, jumlahPaket } = parseMaster(path.resolve(masterPath))

  console.log(
    `Ditemukan: ${sales.length} baris sales, ${masterBarang.length} master barang, ` +
    `${nominalWajib.length} nominal wajib, ${periodeProgram.length} periode program, ` +
    `${jumlahPaket.length} baris jumlah paket.\n`
  )

  await replaceTable('sales', sales)
  await replaceTable('master_barang', masterBarang)
  await replaceTable('nominal_wajib', nominalWajib)
  await replaceTable('periode_program', periodeProgram)
  await replaceTable('jumlah_paket', jumlahPaket)

  console.log('-> Update penanda waktu sync (sync_meta)...')
  const { error: metaErr } = await supabase
    .from('sync_meta')
    .upsert({ id: 1, last_synced_at: new Date().toISOString() })
  if (metaErr) throw new Error(`Gagal update sync_meta: ${metaErr.message}`)

  console.log('\nSync selesai. Dashboard akan otomatis refresh cache-nya begitu dibuka/reload.')
}

main().catch((err) => {
  console.error('\nSync gagal:', err.message)
  process.exit(1)
})
