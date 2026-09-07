import * as XLSX from 'xlsx'
import { toISODate } from './format'

const SALES_URL = '/data/DATA_PENJUALAN.xlsx'
const MASTER_URL = '/data/MASTER_PROGRAM.xlsx'

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
    if (i !== undefined) return row[i]
  }
  return null
}

async function fetchWorkbook(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Tidak bisa memuat ${url} (status ${res.status}). Pastikan file ada di folder public/data/.`)
  }
  const buf = await res.arrayBuffer()
  return XLSX.read(buf, { type: 'array', cellDates: true })
}

function parseSalesWorkbook(wb) {
  const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]]
  const rows = sheetToRows(ws)
  const header = rows[0]
  const idx = buildIndex(header)

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
      qty: Number(get(row, idx, 'QTY', ['F. QTY'])) || 0,
      nominal: Number(get(row, idx, 'NOMINAL')) || 0,
      supp: get(row, idx, 'SUPP'),
      kota: get(row, idx, 'KOTA'),
      bulan: get(row, idx, 'BULAN'),
      blnThn: get(row, idx, 'BLN - THN'),
      tahun: get(row, idx, 'TAHUN'),
      area: get(row, idx, 'AREA'),
      divisi: get(row, idx, 'DIVISI'),
    })
  }
  return out
}

function parseMasterWorkbook(wb) {
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
      kodeBarang: get(row, bIdx, 'KODE BARANG'),
      namaBarang: (get(row, bIdx, 'NAMA BARANG') || '').toString().trim(),
      isiPerKotak: get(row, bIdx, 'ISI PER KOTAK'),
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

  // Sheet baru: "JUMLAH PAKET" -> berapa paket program yang diambil tiap
  // pelanggan. Syarat omset & syarat item wajib pada compute.js akan
  // dikalikan dengan angka ini (default 1 kalau pelanggan tidak ada di
  // sheet ini / tidak ikut paket berganda).
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
        kodeToko: get(row, kIdx, 'KODE PELANGGAN', ['KODE TOKO']),
        namaPelanggan: get(row, kIdx, 'NAMA PELANGGAN'),
        supp,
        program: String(program).trim(),
        jumlahPaket: jumlah > 0 ? jumlah : 1,
      })
    }
  }

  return { masterBarang, nominalWajib, periodeProgram, jumlahPaket }
}

export async function loadAllData() {
  const [salesWb, masterWb] = await Promise.all([
    fetchWorkbook(SALES_URL),
    fetchWorkbook(MASTER_URL),
  ])
  const sales = parseSalesWorkbook(salesWb)
  const { masterBarang, nominalWajib, periodeProgram, jumlahPaket } = parseMasterWorkbook(masterWb)
  return { sales, masterBarang, nominalWajib, periodeProgram, jumlahPaket }
}
