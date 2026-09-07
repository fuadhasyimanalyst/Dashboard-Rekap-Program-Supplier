import { supabase } from './supabaseClient'

// PostgREST membatasi 1000 baris per request secara default, jadi
// tabel sales (bisa >5000 baris) perlu diambil per halaman lalu digabung.
const PAGE_SIZE = 1000

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

export async function loadAllData() {
  const [salesRows, masterBarangRows, nominalWajibRows, periodeProgramRows] = await Promise.all([
    fetchAllRows(
      'sales',
      'no_faktur, tgl_faktur, kode_toko, nama_pelanggan, alamat_pelanggan, depo, sales_faktur, kode_barang, nama_barang, qty, nominal, supp, kota, bulan, bln_thn, tahun, area, divisi'
    ),
    fetchAllRows('master_barang', 'supp, kode_barang, nama_barang, isi_per_kotak, program, wajib'),
    fetchAllRows('nominal_wajib', 'supp, program, nominal'),
    fetchAllRows('periode_program', 'supp, program, awal, akhir'),
  ])

  return {
    sales: salesRows.map(mapSalesRow),
    masterBarang: masterBarangRows.map(mapMasterBarangRow),
    nominalWajib: nominalWajibRows.map(mapNominalWajibRow),
    periodeProgram: periodeProgramRows.map(mapPeriodeProgramRow),
  }
}
