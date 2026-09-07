import { supabase } from './supabaseClient'

// PostgREST membatasi 1000 baris per request secara default, jadi
// tabel sales (bisa >5000 baris) perlu diambil per halaman lalu digabung.
const PAGE_SIZE = 1000

// Cache di localStorage browser, supaya tidak perlu fetch ulang ribuan
// baris tiap kali dashboard dibuka. Cache dianggap basi (dan di-refresh
// otomatis) begitu "last_synced_at" di tabel sync_meta berubah — yaitu
// begitu ada `npm run sync` baru dari Excel.
const CACHE_VERSION_KEY = 'rekap_program_cache_version'
const CACHE_DATA_KEY = 'rekap_program_cache_data'

async function fetchAllRows(table, columns) {
  let from = 0
  let all = []
  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase.from(table).select(columns).range(from, to)
    if (error) {
      throw new Error(`Gagal memuat tabel "${table}": ${error.message}`)
    }
    all = all.concat(data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

function mapSalesRow(row) {
  return {
    noFaktur: String(row.no_faktur),
    tglFaktur: row.tgl_faktur, // sudah format date (YYYY-MM-DD) dari Postgres
    kodeToko: row.kode_toko,
    namaPelanggan: row.nama_pelanggan,
    alamatPelanggan: row.alamat_pelanggan,
    depo: row.depo,
    salesFaktur: row.sales_faktur,
    kodeBarang: row.kode_barang,
    namaBarang: (row.nama_barang || '').toString().trim(),
    qty: Number(row.qty) || 0,
    nominal: Number(row.nominal) || 0,
    supp: row.supp,
    kota: row.kota,
    bulan: row.bulan,
    blnThn: row.bln_thn,
    tahun: row.tahun,
    area: row.area,
    divisi: row.divisi,
  }
}

function mapMasterBarangRow(row) {
  return {
    supp: row.supp,
    kodeBarang: row.kode_barang,
    namaBarang: (row.nama_barang || '').toString().trim(),
    isiPerKotak: row.isi_per_kotak,
    program: String(row.program).trim(),
    wajib: !!row.wajib,
  }
}

function mapNominalWajibRow(row) {
  return {
    supp: row.supp,
    program: String(row.program).trim(),
    nominal: Number(row.nominal) || 0,
  }
}

function mapPeriodeProgramRow(row) {
  return {
    supp: row.supp,
    program: String(row.program).trim(),
    awal: row.awal,
    akhir: row.akhir,
  }
}

// Ambil penanda versi data terbaru dari tabel sync_meta. Kalau tabelnya
// belum ada (migration belum dijalankan) atau kosong, return null -> cache
// tidak dipakai sama sekali, selalu fetch langsung (aman, tidak pernah error).
async function getSyncVersion() {
  const { data, error } = await supabase
    .from('sync_meta')
    .select('last_synced_at')
    .eq('id', 1)
    .maybeSingle()
  if (error || !data) return null
  return data.last_synced_at
}

function readCache(version) {
  try {
    const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY)
    if (!cachedVersion || cachedVersion !== version) return null
    const raw = localStorage.getItem(CACHE_DATA_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null // localStorage disabled/corrupt -> abaikan, fallback ke fetch biasa
  }
}

function writeCache(version, data) {
  try {
    localStorage.setItem(CACHE_VERSION_KEY, version)
    localStorage.setItem(CACHE_DATA_KEY, JSON.stringify(data))
  } catch {
    // localStorage penuh/disabled -> aplikasi tetap jalan, hanya tanpa cache
  }
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_VERSION_KEY)
    localStorage.removeItem(CACHE_DATA_KEY)
  } catch {
    // no-op
  }
}

// opts.forceRefresh: lewati cache sekalipun versinya cocok (dipakai tombol
// "Muat ulang" manual di UI, untuk jaga-jaga kalau cache dicurigai basi).
export async function loadAllData(opts = {}) {
  const { forceRefresh = false } = opts
  const version = await getSyncVersion()

  if (!forceRefresh && version) {
    const cached = readCache(version)
    if (cached) {
      return { ...cached, lastSyncedAt: version, fromCache: true }
    }
  }

  const [salesRows, masterBarangRows, nominalWajibRows, periodeProgramRows] = await Promise.all([
    fetchAllRows(
      'sales',
      'no_faktur, tgl_faktur, kode_toko, nama_pelanggan, alamat_pelanggan, depo, sales_faktur, kode_barang, nama_barang, qty, nominal, supp, kota, bulan, bln_thn, tahun, area, divisi'
    ),
    fetchAllRows('master_barang', 'supp, kode_barang, nama_barang, isi_per_kotak, program, wajib'),
    fetchAllRows('nominal_wajib', 'supp, program, nominal'),
    fetchAllRows('periode_program', 'supp, program, awal, akhir'),
  ])

  const result = {
    sales: salesRows.map(mapSalesRow),
    masterBarang: masterBarangRows.map(mapMasterBarangRow),
    nominalWajib: nominalWajibRows.map(mapNominalWajibRow),
    periodeProgram: periodeProgramRows.map(mapPeriodeProgramRow),
  }

  if (version) {
    writeCache(version, result)
  }

  return { ...result, lastSyncedAt: version, fromCache: false }
}
