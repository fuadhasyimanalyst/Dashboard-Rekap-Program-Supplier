import { supabase } from './supabaseClient'

// Supabase membatasi tiap request ke maksimum ~1000 baris, jadi tabel besar
// (data_penjualan bisa ribuan baris) harus diambil per-halaman.
async function fetchAll(table, { select = '*', pageSize = 1000, order } = {}) {
  const out = []
  let from = 0
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1)
    if (order) q = q.order(order, { ascending: true })
    const { data, error } = await q
    if (error) throw new Error(`Gagal memuat tabel "${table}": ${error.message}`)
    out.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return out
}

function normalizeSales(rows) {
  return rows.map((r) => ({
    noFaktur: r.no_faktur,
    tglFaktur: r.tgl_faktur,
    kodeToko: r.kode_pelanggan,
    namaPelanggan: r.nama_pelanggan,
    alamatPelanggan: r.alamat_pelanggan,
    depo: r.depo,
    salesFaktur: r.sales_faktur || r.salesman,
    kodeBarang: r.kode_barang,
    namaBarang: (r.nama_barang || '').toString().trim(),
    qty: Number(r.f_qty ?? r.qty) || 0,
    nominal: Number(r.nominal) || 0,
    supp: r.supp,
    kota: r.kota,
    bulan: r.bulan,
    blnThn: r.bln_thn,
    tahun: r.tahun,
    area: r.area,
    divisi: r.divisi,
  }))
}

function normalizeMasterBarang(rows) {
  return rows.map((r) => ({
    supp: r.supp,
    kodeBarang: r.kode_barang,
    namaBarang: (r.nama_barang || '').toString().trim(),
    isiPerKotak: r.isi_per_kotak,
    program: r.program,
    wajib: !!r.item_wajib,
  }))
}

// rekapan_program (INPUT_REKAPAN_PROGRAM.xlsx) menggantikan sheet lama
// "NOMINAL WAJIB" / "PERIODE PROGRAM": tiap baris sudah membawa target
// nominal & periode program-nya sendiri per toko. Untuk kompatibilitas
// dengan compute.js yang lama, kita turunkan nominalWajib & periodeProgram
// (level supp+program, ambil target pertama yang ditemukan) SEKALIGUS
// mengembalikan rekapanProgram mentah (dipakai untuk tabel "Rekap Program"
// & perhitungan kekurangan paket).
function deriveMasterAggregates(rekapanProgram) {
  const nominalMap = new Map()
  const periodeMap = new Map()
  for (const r of rekapanProgram) {
    const key = `${r.supp}||${r.program}`
    if (r.target_nominal != null && !nominalMap.has(key)) {
      nominalMap.set(key, { supp: r.supp, program: r.program, nominal: Number(r.target_nominal) || 0 })
    }
    if ((r.awal_program || r.akhir_program) && !periodeMap.has(key)) {
      periodeMap.set(key, { supp: r.supp, program: r.program, awal: r.awal_program, akhir: r.akhir_program })
    }
  }
  return {
    nominalWajib: Array.from(nominalMap.values()),
    periodeProgram: Array.from(periodeMap.values()),
  }
}

function normalizeRekapanProgram(rows) {
  return rows.map((r) => ({
    id: r.id,
    supp: r.supp,
    kodeToko: r.kode_toko,
    namaPelanggan: r.nama_pelanggan,
    alamatPelanggan: r.alamat_pelanggan,
    depo: r.depo,
    kotaArea: r.kota_area,
    salesman: r.salesman,
    program: r.program,
    pengajuanPaket: Number(r.pengajuan_paket) || 0,
    // 0 di Excel -> false -> "Belum sampai ke kantor"
    formFisik: !!r.form_fisik,
    targetNominal: r.target_nominal == null ? null : Number(r.target_nominal),
    awalProgram: r.awal_program,
    akhirProgram: r.akhir_program,
  }))
}

export async function loadAllData() {
  const [salesRows, masterRows, rekapanRows] = await Promise.all([
    fetchAll('data_penjualan'),
    fetchAll('master_barang'),
    fetchAll('rekapan_program'),
  ])

  const sales = normalizeSales(salesRows)
  const masterBarang = normalizeMasterBarang(masterRows)
  const rekapanProgram = normalizeRekapanProgram(rekapanRows)
  const { nominalWajib, periodeProgram } = deriveMasterAggregates(rekapanRows)

  return { sales, masterBarang, rekapanProgram, nominalWajib, periodeProgram }
}
