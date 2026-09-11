// Core logic to turn raw sales rows + master program rules + program
// confirmations (INPUT_REKAPAN_PROGRAM.xlsx) into a per-customer x
// per-program recap: what they bought, whether they qualify, and what's
// still missing.

// Programs where the reward is UANG TUNAI based on omset (bukan barang
// fisik). Untuk program-program ini kolom "sudah terkirim" / "kekurangan
// kirim" di tabel Pengajuan Paket TIDAK relevan — yang relevan adalah
// kekurangan OMSET terhadap target yang dipilih.
const CASH_REWARD_PROGRAMS = ['BELANJA CERIA', 'DISPLAY HOKI']

// BELANJA CERIA: reward berjenjang sesuai omset akumulasi 1 Jul–30 Sep.
// Toko "mengajukan" salah satu paket (dicatat di kolom TARGET NOMINAL),
// dan harus mencapai omset >= nominal paket tsb untuk dapat reward-nya.
const BELANJA_CERIA_TIERS = [
  { min: 11100000, reward: 1000000 },
  { min: 33300000, reward: 3750000 },
  { min: 55500000, reward: 7500000 },
]

function belanjaCeriaReward(nominalRequired) {
  if (nominalRequired == null) return null
  // cocokkan ke tier terdekat (toleransi pembulatan float dari Excel)
  for (const t of BELANJA_CERIA_TIERS) {
    if (Math.abs(nominalRequired - t.min) < 1000) return t.reward
  }
  // fallback: tier tertinggi yang sudah terlampaui oleh nominal target
  const sorted = [...BELANJA_CERIA_TIERS].sort((a, b) => b.min - a.min)
  for (const t of sorted) {
    if (nominalRequired >= t.min) return t.reward
  }
  return BELANJA_CERIA_TIERS[0].reward
}

const REWARD_LABEL = {
  'BUCKET SEAL': 'Diskon 10%',
  'KUNINGAN': 'Diskon 5%',
  'PVCBV': 'Diskon 7%',
  'DISPLAY HOKI': 'Reward Rp 200.000',
  'SUPERFAN': 'Sesuai ketentuan program',
}

function getRewardLabel(program, nominalRequired) {
  if (program === 'BELANJA CERIA') {
    const r = belanjaCeriaReward(nominalRequired)
    return r != null ? `Reward ${moneyFmt(r)}` : '-'
  }
  return REWARD_LABEL[program] || '-'
}

// How each program decides "tercapai" (qualified). Every rule receives
// a normalized `ctx` object (see computeRecap) and returns
// { tercapai, kekurangan: string[] }
const RULES = {
  SUPERFAN: (ctx) => {
    const kekurangan = []
    const wajibNeeded = 2
    const wajibHave = ctx.wajibBoughtNames.length
    if (wajibHave < wajibNeeded) {
      const sisaWajib = ctx.wajibItemNames.filter((n) => !ctx.wajibBoughtNames.includes(n))
      kekurangan.push(
        `Item wajib baru ${wajibHave}/${wajibNeeded} varian. Perlu tambah salah satu: ${sisaWajib.join(', ') || '-'}`
      )
    }
    if (ctx.nominalRequired != null && ctx.omset <= ctx.nominalRequired) {
      kekurangan.push(
        `Omset kurang ${moneyDiff(ctx.nominalRequired - ctx.omset)} (syarat > ${moneyFmt(ctx.nominalRequired)})`
      )
    }
    return { tercapai: wajibHave >= wajibNeeded && (ctx.nominalRequired == null || ctx.omset > ctx.nominalRequired), kekurangan }
  },

  'BUCKET SEAL': (ctx) => {
    const missing = ctx.allItemNames.filter((n) => !ctx.boughtItemNames.includes(n))
    const kekurangan = missing.length
      ? [`Belum beli: ${missing.join(', ')}`]
      : []
    return { tercapai: missing.length === 0, kekurangan }
  },

  // Program KONTAINER cuma punya 1 item wajib ("PAKET JUARA KONTAINER"),
  // jadi aturannya sama seperti BUCKET SEAL: harus sudah beli semua item
  // yang terdaftar untuk program ini di MASTER_BARANG.xlsx.
  KONTAINER: (ctx) => {
    const missing = ctx.allItemNames.filter((n) => !ctx.boughtItemNames.includes(n))
    const kekurangan = missing.length
      ? [`Belum beli: ${missing.join(', ')}`]
      : []
    return { tercapai: missing.length === 0, kekurangan }
  },

  KUNINGAN: (ctx) => {
    const need = 2
    const have = ctx.boughtItemNames.length
    const kekurangan = have < need
      ? [`Varian item baru ${have}/${need}. Perlu beli minimal 1 varian berbeda lagi.`]
      : []
    return { tercapai: have >= need, kekurangan }
  },

  PVCBV: (ctx) => {
    const need = 2
    const have = ctx.boughtItemNames.length
    const kekurangan = have < need
      ? [`Varian item baru ${have}/${need}. Perlu beli minimal 1 varian berbeda lagi.`]
      : []
    return { tercapai: have >= need, kekurangan }
  },

  // DISPLAY HOKI: reward Rp 200.000 kalau omset barang program >= Rp 1.665.000
  // (akumulasi periode program, dari toko yang sudah konfirmasi ikut program
  // ini di form INPUT_REKAPAN_PROGRAM).
  'DISPLAY HOKI': (ctx) => {
    const kekurangan = []
    if (ctx.nominalRequired != null && ctx.omset < ctx.nominalRequired) {
      kekurangan.push(
        `Omset kurang ${moneyDiff(ctx.nominalRequired - ctx.omset)} (syarat >= ${moneyFmt(ctx.nominalRequired)})`
      )
    }
    return { tercapai: ctx.nominalRequired == null ? ctx.omset > 0 : ctx.omset >= ctx.nominalRequired, kekurangan }
  },

  // BELANJA CERIA: toko mengajukan salah satu paket (11.1jt / 33.3jt / 55.5jt,
  // tercatat di TARGET NOMINAL) lalu harus mencapai omset barang program
  // >= nominal paket tsb (akumulasi 1 Jul–30 Sep) untuk dapat reward
  // berjenjangnya (lihat BELANJA_CERIA_TIERS).
  'BELANJA CERIA': (ctx) => {
    const kekurangan = []
    if (ctx.nominalRequired != null && ctx.omset < ctx.nominalRequired) {
      kekurangan.push(
        `Omset kurang ${moneyDiff(ctx.nominalRequired - ctx.omset)} (syarat >= ${moneyFmt(ctx.nominalRequired)})`
      )
    }
    return { tercapai: ctx.nominalRequired != null && ctx.omset >= ctx.nominalRequired, kekurangan }
  },
}

function moneyFmt(n) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}
function moneyDiff(n) {
  return moneyFmt(Math.max(0, n))
}

function normName(s) {
  return (s || '').toString().trim().toUpperCase()
}

function normCode(s) {
  return (s || '').toString().trim()
}

function inPeriod(dateIso, period) {
  if (!period || !period.awal || !period.akhir) return true // no period defined -> no restriction
  if (!dateIso) return false
  return dateIso >= period.awal && dateIso <= period.akhir
}

// Urutan bulan untuk sorting dropdown filter (dukung singkatan Inggris &
// Indonesia, jaga-jaga kalau sumber data berubah format).
const MONTH_ORDER = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'MAY', 'JUN', 'JUL', 'AGU', 'AGT', 'AUG', 'SEP', 'OKT', 'OCT', 'NOV', 'DES', 'DEC']
function sortBulan(list) {
  return [...list].sort((a, b) => {
    const ia = MONTH_ORDER.indexOf((a || '').toString().trim().toUpperCase())
    const ib = MONTH_ORDER.indexOf((b || '').toString().trim().toUpperCase())
    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b))
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

// Build lookup structures once per dataset: daftar item per program, dan
// index item -> daftar program yang memuat item tsb (dipakai untuk
// mencocokkan baris penjualan ke program).
export function buildProgramMeta(masterBarang) {
  const programs = new Map() // key `${supp}||${program}` -> meta
  for (const row of masterBarang) {
    const key = `${row.supp}||${row.program}`
    if (!programs.has(key)) {
      programs.set(key, {
        supp: row.supp,
        program: row.program,
        items: [], // {namaBarang, wajib}
      })
    }
    programs.get(key).items.push({ namaBarang: normName(row.namaBarang), wajib: !!row.wajib })
  }

  // item -> list of programs it belongs to, keyed by supp
  const itemIndex = new Map() // `${supp}||${NAMA}` -> [{program, wajib}]
  for (const row of masterBarang) {
    const ikey = `${row.supp}||${normName(row.namaBarang)}`
    if (!itemIndex.has(ikey)) itemIndex.set(ikey, [])
    itemIndex.get(ikey).push({ program: row.program, wajib: !!row.wajib })
  }

  return { programs, itemIndex }
}

// computeRecap membangun tabel "Rekap Program" HANYA dari kombinasi
// toko+program yang SUDAH dikonfirmasi lewat form INPUT_REKAPAN_PROGRAM.xlsx
// (rekapanProgram). Toko yang membeli barang program tapi belum
// tercatat/konfirmasi di excel tsb TIDAK ikut ditampilkan — sesuai
// permintaan: menu ini khusus untuk memantau progres toko yang sudah
// mengajukan/konfirmasi program, bukan menu deteksi otomatis dari histori
// pembelian.
export function computeRecap(sales, masterBarang, rekapanProgram, opts = {}) {
  const ignorePeriod = !!opts.ignorePeriod
  const meta = buildProgramMeta(masterBarang)

  const groups = new Map() // key `${supp}||${kodeToko}||${program}`

  for (const conf of rekapanProgram || []) {
    if (!conf.supp || !conf.kodeToko || !conf.program) continue
    const gkey = `${conf.supp}||${normCode(conf.kodeToko)}||${conf.program}`
    if (groups.has(gkey)) continue // satu toko harusnya cuma sekali per program
    groups.set(gkey, {
      kodeToko: normCode(conf.kodeToko),
      namaPelanggan: conf.namaPelanggan,
      alamatPelanggan: conf.alamatPelanggan,
      depo: conf.depo,
      kota: conf.kotaArea,
      salesFaktur: conf.salesman,
      supp: conf.supp,
      program: conf.program,
      period: (conf.awalProgram || conf.akhirProgram) ? { awal: conf.awalProgram, akhir: conf.akhirProgram } : null,
      nominalRequired: conf.targetNominal,
      omset: 0,
      items: new Map(), // namaBarang -> {qty, nominal, wajib}
      transactions: [],
      bulanSet: new Set(),
    })
  }

  for (const row of sales) {
    if (!row.supp || !row.namaBarang || !row.kodeToko) continue
    const ikey = `${row.supp}||${normName(row.namaBarang)}`
    const progs = meta.itemIndex.get(ikey)
    if (!progs || progs.length === 0) continue

    for (const p of progs) {
      const gkey = `${row.supp}||${normCode(row.kodeToko)}||${p.program}`
      const g = groups.get(gkey)
      if (!g) continue // toko ini belum konfirmasi ikut program ini -> jangan dihitung

      const effectivePeriod = ignorePeriod ? null : g.period
      if (!inPeriod(row.tglFaktur, effectivePeriod)) continue

      // Perbarui identitas toko dari data faktur asli (lebih up-to-date
      // dibanding data master di excel input rekapan program).
      if (row.namaPelanggan) g.namaPelanggan = row.namaPelanggan
      if (row.alamatPelanggan) g.alamatPelanggan = row.alamatPelanggan
      if (row.depo) g.depo = row.depo
      if (row.kota) g.kota = row.kota
      if (row.salesFaktur) g.salesFaktur = row.salesFaktur

      g.omset += Number(row.nominal) || 0
      const nName = normName(row.namaBarang)
      if (!g.items.has(nName)) g.items.set(nName, { namaBarang: row.namaBarang, qty: 0, nominal: 0, wajib: p.wajib })
      const it = g.items.get(nName)
      it.qty += Number(row.qty) || 0
      it.nominal += Number(row.nominal) || 0
      if (row.bulan) g.bulanSet.add(String(row.bulan).trim())
      g.transactions.push({
        noFaktur: row.noFaktur,
        tglFaktur: row.tglFaktur,
        namaBarang: row.namaBarang,
        kodeBarang: row.kodeBarang,
        qty: row.qty,
        nominal: row.nominal,
        wajib: p.wajib,
      })
    }
  }

  const recap = []
  for (const g of groups.values()) {
    const pkey = `${g.supp}||${g.program}`
    const programMeta = meta.programs.get(pkey)
    const allItemNames = (programMeta?.items || []).map((i) => i.namaBarang)
    const wajibItemNames = (programMeta?.items || []).filter((i) => i.wajib).map((i) => i.namaBarang)
    const boughtItemNames = Array.from(g.items.keys())
    const wajibBoughtNames = boughtItemNames.filter((n) => wajibItemNames.includes(n))
    const nominalRequired = g.nominalRequired ?? null

    const ctx = {
      omset: g.omset,
      allItemNames,
      wajibItemNames,
      boughtItemNames,
      wajibBoughtNames,
      nominalRequired,
    }

    const rule = RULES[g.program]
    const result = rule ? rule(ctx) : { tercapai: false, kekurangan: ['Aturan program belum didefinisikan'] }

    recap.push({
      kodeToko: g.kodeToko,
      namaPelanggan: g.namaPelanggan,
      alamatPelanggan: g.alamatPelanggan,
      depo: g.depo,
      kota: g.kota,
      salesFaktur: g.salesFaktur,
      supp: g.supp,
      program: g.program,
      period: g.period,
      periodeDipakai: !ignorePeriod && !!g.period,
      omset: g.omset,
      nominalRequired,
      varianDibeli: boughtItemNames.map((n) => g.items.get(n).namaBarang),
      varianCount: boughtItemNames.length,
      totalVarianProgram: allItemNames.length,
      itemWajibDibeli: wajibBoughtNames,
      itemWajibTotal: wajibItemNames,
      tercapai: result.tercapai,
      kekurangan: result.kekurangan,
      reward: getRewardLabel(g.program, nominalRequired),
      bulanList: sortBulan(Array.from(g.bulanSet)),
      items: Array.from(g.items.values()).sort((a, b) => (b.wajib === a.wajib ? 0 : b.wajib ? 1 : -1)),
      transactions: g.transactions.sort((a, b) => (a.tglFaktur < b.tglFaktur ? -1 : 1)),
    })
  }

  recap.sort((a, b) => {
    if (a.program !== b.program) return a.program.localeCompare(b.program)
    if (a.tercapai !== b.tercapai) return a.tercapai ? 1 : -1
    return b.omset - a.omset
  })

  return recap
}

// Field name -> key on a recap row
const FIELD_KEY = { program: 'program', supp: 'supp', depo: 'depo', kota: 'kota', sales: 'salesFaktur' }

// Whether row `r` passes filter `f`, ignoring the field named `skip`.
// This lets each dropdown's own option list react to every OTHER active
// filter (e.g. picking Depo "JEPARA" narrows the Sales dropdown down to
// only sales reps who actually sold in Jepara).
function passesOtherFilters(r, f, skip) {
  if (f.program && skip !== 'program' && r.program !== f.program) return false
  if (f.supp && skip !== 'supp' && r.supp !== f.supp) return false
  if (f.depo && skip !== 'depo' && r.depo !== f.depo) return false
  if (f.kota && skip !== 'kota' && r.kota !== f.kota) return false
  if (f.sales && skip !== 'sales' && r.salesFaktur !== f.sales) return false
  if (f.bulan && skip !== 'bulan' && !(r.bulanList || []).includes(f.bulan)) return false
  if (f.status === 'Tercapai' && skip !== 'status' && !r.tercapai) return false
  if (f.status === 'Belum Tercapai' && skip !== 'status' && r.tercapai) return false
  return true
}

// Builds the option list for every filter dropdown. When `filters` is
// provided, each field's options are narrowed down by every other
// currently-active filter (cross-filtering / cascading filters) so the
// user can never pick a combination that yields zero rows.
export function getFilterOptions(recap, filters = {}) {
  const sets = { supp: new Set(), program: new Set(), depo: new Set(), kota: new Set(), sales: new Set(), bulan: new Set() }
  for (const r of recap) {
    for (const field of Object.keys(sets)) {
      if (!passesOtherFilters(r, filters, field)) continue
      if (field === 'bulan') {
        for (const b of r.bulanList || []) sets.bulan.add(b)
        continue
      }
      const v = r[FIELD_KEY[field]]
      if (v) sets[field].add(v)
    }
  }
  return {
    supp: Array.from(sets.supp).sort(),
    program: Array.from(sets.program).sort(),
    depo: Array.from(sets.depo).sort(),
    kota: Array.from(sets.kota).sort(),
    sales: Array.from(sets.sales).sort(),
    bulan: sortBulan(Array.from(sets.bulan)),
  }
}

// Apply the shared/global filter set to a recap array.
export function applyGlobalFilters(recap, filters = {}) {
  return recap.filter((r) => {
    if (filters.program && r.program !== filters.program) return false
    if (filters.supp && r.supp !== filters.supp) return false
    if (filters.depo && r.depo !== filters.depo) return false
    if (filters.kota && r.kota !== filters.kota) return false
    if (filters.sales && r.salesFaktur !== filters.sales) return false
    if (filters.bulan && !(r.bulanList || []).includes(filters.bulan)) return false
    if (filters.status === 'Tercapai' && !r.tercapai) return false
    if (filters.status === 'Belum Tercapai' && r.tercapai) return false
    return true
  })
}

// ----------------------------------------------------------------------------
// Rekap "Pengajuan Paket" (dari INPUT_REKAPAN_PROGRAM.xlsx)
//
// Setiap baris rekapanProgram = satu toko mengajukan satu program. Ada dua
// jenis program:
//  - Program BARANG FISIK (BUCKET SEAL, KUNINGAN, PVCBV, SUPERFAN,
//    KONTAINER, dst): "PENGAJUAN PAKET" = jumlah paket/barang fisik yang
//    dipesan. F.QTY di data penjualan untuk barang-barang program tsb =
//    qty yang sudah jadi faktur/terkirim. Selisihnya = kekurangan kirim.
//  - Program REWARD UANG berbasis omset (BELANJA CERIA, DISPLAY HOKI):
//    TIDAK ada barang fisik yang "dikirim", jadi kolom sudah
//    terkirim/kekurangan kirim tidak relevan. Yang relevan adalah
//    KEKURANGAN OMSET terhadap TARGET NOMINAL paket yang diajukan.
//
// Semua baris rekapanProgram ditampilkan (tidak ada yang difilter/disembunyikan)
// karena ini adalah data master sesuai instruksi.
// ----------------------------------------------------------------------------
export function computeKekuranganPaket(rekapanProgram, masterBarang, sales) {
  // supp||program -> Set of normalized item names belonging to that program
  const programItems = new Map()
  for (const m of masterBarang) {
    const key = `${m.supp}||${m.program}`
    if (!programItems.has(key)) programItems.set(key, new Set())
    programItems.get(key).add(normName(m.namaBarang))
  }

  // supp||kodeToko||program -> periode program milik toko itu (dari baris
  // INPUT_REKAPAN_PROGRAM-nya sendiri), dipakai supaya realisasi omset di
  // sini konsisten dengan Rekap Program (hanya hitung transaksi dalam
  // periode program, bukan sepanjang waktu).
  const periodeMap = new Map()
  for (const r of rekapanProgram || []) {
    if (!r.supp || !r.kodeToko || !r.program) continue
    const key = `${r.supp}||${normCode(r.kodeToko)}||${r.program}`
    if (r.awalProgram || r.akhirProgram) periodeMap.set(key, { awal: r.awalProgram, akhir: r.akhirProgram })
  }

  // supp||kodeToko||program -> { qty, nominal, bulanSet }
  const realisasi = new Map()
  for (const row of sales) {
    if (!row.supp || !row.kodeToko || !row.namaBarang) continue
    const nName = normName(row.namaBarang)
    for (const [pkey, items] of programItems) {
      if (!pkey.startsWith(`${row.supp}||`)) continue
      if (!items.has(nName)) continue
      const program = pkey.split('||')[1]
      const gkey = `${row.supp}||${normCode(row.kodeToko)}||${program}`
      const periode = periodeMap.get(gkey)
      if (!inPeriod(row.tglFaktur, periode)) continue
      if (!realisasi.has(gkey)) realisasi.set(gkey, { qty: 0, nominal: 0, bulanSet: new Set() })
      const g = realisasi.get(gkey)
      g.qty += Number(row.qty) || 0
      g.nominal += Number(row.nominal) || 0
      if (row.bulan) g.bulanSet.add(String(row.bulan).trim())
    }
  }

  return (rekapanProgram || []).map((r) => {
    const gkey = `${r.supp}||${normCode(r.kodeToko)}||${r.program}`
    const g = realisasi.get(gkey) || { qty: 0, nominal: 0, bulanSet: new Set() }
    const isCashReward = CASH_REWARD_PROGRAMS.includes(r.program)

    const kekuranganQty = Math.max((r.pengajuanPaket || 0) - g.qty, 0)
    const paketTerpenuhi = (r.pengajuanPaket || 0) > 0 && g.qty >= r.pengajuanPaket
    const nominalTerpenuhi = r.targetNominal != null && g.nominal >= r.targetNominal
    const kekuranganOmset = r.targetNominal != null ? Math.max(r.targetNominal - g.nominal, 0) : null

    return {
      ...r,
      isCashReward,
      qtyTerkirim: g.qty,
      nominalTerkirim: g.nominal,
      kekuranganQty,
      kekuranganOmset,
      paketTerpenuhi,
      nominalTerpenuhi,
      // status tercapai yang dipakai untuk filter: untuk program reward
      // uang dilihat dari omset, untuk program barang fisik dilihat dari qty.
      tercapai: isCashReward ? nominalTerpenuhi : paketTerpenuhi,
      bulanList: sortBulan(Array.from(g.bulanSet)),
    }
  })
}

// Filter dropdown options untuk tabel Pengajuan Paket (field-nya sedikit
// beda dari Rekap Program: pakai `salesman` bukan `salesFaktur`, tidak ada
// `kota`).
const PAKET_FIELD_KEY = { program: 'program', supp: 'supp', depo: 'depo', sales: 'salesman' }

function paketPassesOtherFilters(r, f, skip) {
  if (f.program && skip !== 'program' && r.program !== f.program) return false
  if (f.supp && skip !== 'supp' && r.supp !== f.supp) return false
  if (f.depo && skip !== 'depo' && r.depo !== f.depo) return false
  if (f.sales && skip !== 'sales' && r.salesman !== f.sales) return false
  if (f.bulan && skip !== 'bulan' && !(r.bulanList || []).includes(f.bulan)) return false
  if (f.status === 'Tercapai' && skip !== 'status' && !r.tercapai) return false
  if (f.status === 'Belum Tercapai' && skip !== 'status' && r.tercapai) return false
  return true
}

export function getPaketFilterOptions(rows, filters = {}) {
  const sets = { supp: new Set(), program: new Set(), depo: new Set(), sales: new Set(), bulan: new Set() }
  for (const r of rows) {
    for (const field of Object.keys(sets)) {
      if (!paketPassesOtherFilters(r, filters, field)) continue
      if (field === 'bulan') {
        for (const b of r.bulanList || []) sets.bulan.add(b)
        continue
      }
      const v = r[PAKET_FIELD_KEY[field]]
      if (v) sets[field].add(v)
    }
  }
  return {
    supp: Array.from(sets.supp).sort(),
    program: Array.from(sets.program).sort(),
    depo: Array.from(sets.depo).sort(),
    sales: Array.from(sets.sales).sort(),
    bulan: sortBulan(Array.from(sets.bulan)),
  }
}

export function applyPaketFilters(rows, filters = {}) {
  return rows.filter((r) => {
    if (filters.program && r.program !== filters.program) return false
    if (filters.supp && r.supp !== filters.supp) return false
    if (filters.depo && r.depo !== filters.depo) return false
    if (filters.sales && r.salesman !== filters.sales) return false
    if (filters.bulan && !(r.bulanList || []).includes(filters.bulan)) return false
    if (filters.status === 'Tercapai' && !r.tercapai) return false
    if (filters.status === 'Belum Tercapai' && r.tercapai) return false
    return true
  })
}
