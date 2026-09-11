// Loader lokal — baca 3 file Excel langsung dari public/data/ di browser,
// tanpa Supabase. Dipakai untuk coba-coba/testing cepat (VITE_DATA_SOURCE=local,
// default). Bentuk data yang dikembalikan SAMA PERSIS dengan supabaseLoader.js
// supaya DataContext & compute.js tidak perlu tahu bedanya.
import * as XLSX from 'xlsx'
import { toISODate } from './format'

const FILES = {
  rekapan: '/data/INPUT_REKAPAN_PROGRAM.xlsx',
  masterBarang: '/data/MASTER_BARANG.xlsx',
  penjualan: '/data/DATA_PENJUALAN.xlsx',
}

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

async function fetchWorkbook(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Tidak bisa memuat ${url} (status ${res.status}). Pastikan file ada di folder public/data/.`)
  }
  const buf = await res.arrayBuffer()
  return XLSX.read(buf, { type: 'array', cellDates: true })
}

// ---------------------------------------------------------------------------
// DATA_PENJUALAN.xlsx
// ---------------------------------------------------------------------------
function parseSalesWorkbook(wb) {
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
      noFaktur: String(noFaktur),
      tglFaktur: toISODate(get(row, idx, 'TGL FAKTUR')),
      kodeToko: get(row, idx, 'KODE PELANGGAN', ['KODE TOKO']),
      namaPelanggan: get(row, idx, 'NAMA PELANGGAN'),
      alamatPelanggan: get(row, idx, 'ALAMAT PELANGGAN'),
      depo: get(row, idx, 'DEPO'),
      salesFaktur: get(row, idx, 'SALES FAKTUR', ['SALESMAN']),
      kodeBarang: get(row, idx, 'KODE BARANG'),
      namaBarang: (get(row, idx, 'NAMA BARANG') || '').toString().trim(),
      qty: Number(get(row, idx, 'F. QTY', ['QTY'])) || 0,
      nominal: Number(get(row, idx, 'NOMINAL')) || 0,
      supp: get(row, idx, 'SUPP'),
      kota: get(row, idx, 'KOTA'),
      bulan: get(row, idx, 'BULAN'),
      blnThn: get(row, idx, 'BLN - THN', ['BLN-THN']),
      tahun: get(row, idx, 'TAHUN'),
      area: get(row, idx, 'AREA'),
      divisi: get(row, idx, 'DIVISI'),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// MASTER_BARANG.xlsx
// ---------------------------------------------------------------------------
function parseMasterBarangWorkbook(wb) {
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
      kodeBarang: get(row, idx, 'KODE BARANG'),
      namaBarang: String(namaBarang).trim(),
      isiPerKotak: get(row, idx, 'ISI PER KOTAK'),
      program: String(program).trim(),
      wajib: !!(wajibRaw && String(wajibRaw).trim().toUpperCase() === 'WAJIB'),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// INPUT_REKAPAN_PROGRAM.xlsx — satu sheet per SUPP (DCOTA, INLITE, dst),
// kolom sedikit beda antar sheet, jadi dibaca per-sheet lalu digabung.
// Semua baris ikut ditampilkan (data master, tidak ada yang difilter).
// ---------------------------------------------------------------------------
function parseRekapanWorkbook(wb) {
  const out = []
  let autoId = 1

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

      out.push({
        id: autoId++,
        supp,
        kodeToko: String(kodeToko).trim(),
        namaPelanggan: get(row, idx, 'NAMA PELANGGAN', ['NAMA TOKO']),
        alamatPelanggan: get(row, idx, 'ALAMAT PELANGGAN', ['ALAMAT TOKO']),
        depo: get(row, idx, 'DEPO'),
        kotaArea: get(row, idx, 'KOTA/AREA', ['KOTA', 'AREA']),
        salesman: get(row, idx, 'SALESMAN'),
        program: String(program).trim(),
        pengajuanPaket: num(get(row, idx, 'PENGAJUAN PAKET', ['PAKET PENGAJUAN'])),
        // FORM FISIK: 0 = belum sampai ke kantor, 1 = sudah sampai.
        formFisik: truthy01(get(row, idx, 'FORM FISIK')),
        targetNominal: (() => {
          const v = get(row, idx, 'TARGET NOMINAL', ['TARGET'])
          return v == null || v === '' ? null : num(v)
        })(),
        awalProgram: toISODate(get(row, idx, 'AWAL PROGRAM')),
        akhirProgram: toISODate(get(row, idx, 'AKHIR PROGRAM')),
      })
    }
  }
  return out
}

// supp+program -> target nominal / periode pertama yang ditemukan, dipakai
// oleh computeRecap (tab "Rekap Program") yang butuh 1 aturan per program,
// bukan per toko.
function deriveMasterAggregates(rekapanProgram) {
  const nominalMap = new Map()
  const periodeMap = new Map()
  for (const r of rekapanProgram) {
    const key = `${r.supp}||${r.program}`
    if (r.targetNominal != null && !nominalMap.has(key)) {
      nominalMap.set(key, { supp: r.supp, program: r.program, nominal: r.targetNominal })
    }
    if ((r.awalProgram || r.akhirProgram) && !periodeMap.has(key)) {
      periodeMap.set(key, { supp: r.supp, program: r.program, awal: r.awalProgram, akhir: r.akhirProgram })
    }
  }
  return {
    nominalWajib: Array.from(nominalMap.values()),
    periodeProgram: Array.from(periodeMap.values()),
  }
}

export async function loadAllData() {
  const [salesWb, masterWb, rekapanWb] = await Promise.all([
    fetchWorkbook(FILES.penjualan),
    fetchWorkbook(FILES.masterBarang),
    fetchWorkbook(FILES.rekapan),
  ])

  const sales = parseSalesWorkbook(salesWb)
  const masterBarang = parseMasterBarangWorkbook(masterWb)
  const rekapanProgram = parseRekapanWorkbook(rekapanWb)
  const { nominalWajib, periodeProgram } = deriveMasterAggregates(rekapanProgram)

  return { sales, masterBarang, rekapanProgram, nominalWajib, periodeProgram }
}
