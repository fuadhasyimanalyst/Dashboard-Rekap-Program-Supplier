// Core logic to turn raw sales rows + master program rules into a
// per-customer x per-program recap: what they bought, whether they
// qualify, and what's still missing.

const REWARD_LABEL = {
  'BUCKET SEAL': 'Diskon 10%',
  'KUNINGAN': 'Diskon 5%',
  'PVCBV': 'Diskon 7%',
  'DISPLAY HOKI': 'Reward Rp 200.000',
  'SUPERFAN': 'Sesuai ketentuan program',
}

// How each program decides "tercapai" (qualified). Every rule receives
// a normalized `ctx` object (see buildContext) and returns
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

  'DISPLAY HOKI': (ctx) => {
    const kekurangan = []
    if (ctx.nominalRequired != null && ctx.omset < ctx.nominalRequired) {
      kekurangan.push(
        `Omset kurang ${moneyDiff(ctx.nominalRequired - ctx.omset)} (syarat >= ${moneyFmt(ctx.nominalRequired)})`
      )
    }
    return { tercapai: ctx.nominalRequired == null ? ctx.omset > 0 : ctx.omset >= ctx.nominalRequired, kekurangan }
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

function inPeriod(dateIso, period) {
  if (!period || !period.awal || !period.akhir) return true // no period defined -> no restriction
  if (!dateIso) return false
  return dateIso >= period.awal && dateIso <= period.akhir
}

// Build lookup structures once per dataset
export function buildProgramMeta(masterBarang, nominalWajib, periodeProgram) {
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

  const nominalMap = new Map()
  for (const n of nominalWajib) nominalMap.set(`${n.supp}||${n.program}`, n.nominal)

  const periodeMap = new Map()
  for (const p of periodeProgram) periodeMap.set(`${p.supp}||${p.program}`, { awal: p.awal, akhir: p.akhir })

  // item -> list of programs it belongs to, keyed by supp
  const itemIndex = new Map() // `${supp}||${NAMA}` -> [{program, wajib}]
  for (const row of masterBarang) {
    const ikey = `${row.supp}||${normName(row.namaBarang)}`
    if (!itemIndex.has(ikey)) itemIndex.set(ikey, [])
    itemIndex.get(ikey).push({ program: row.program, wajib: !!row.wajib })
  }

  return { programs, nominalMap, periodeMap, itemIndex }
}

export function computeRecap(sales, masterBarang, nominalWajib, periodeProgram, opts = {}) {
  const ignorePeriod = !!opts.ignorePeriod
  const meta = buildProgramMeta(masterBarang, nominalWajib, periodeProgram)

  const groups = new Map() // key kodeToko||supp||program

  for (const row of sales) {
    if (!row.supp || !row.namaBarang) continue
    const ikey = `${row.supp}||${normName(row.namaBarang)}`
    const progs = meta.itemIndex.get(ikey)
    if (!progs || progs.length === 0) continue

    for (const p of progs) {
      const pkey = `${row.supp}||${p.program}`
      const period = meta.periodeMap.get(pkey)
      const effectivePeriod = ignorePeriod ? null : period
      if (!inPeriod(row.tglFaktur, effectivePeriod)) continue

      const gkey = `${row.kodeToko}||${pkey}`
      if (!groups.has(gkey)) {
        groups.set(gkey, {
          kodeToko: row.kodeToko,
          namaPelanggan: row.namaPelanggan,
          alamatPelanggan: row.alamatPelanggan,
          depo: row.depo,
          kota: row.kota,
          salesFaktur: row.salesFaktur,
          supp: row.supp,
          program: p.program,
          period: period || null,
          omset: 0,
          items: new Map(), // namaBarang -> {qty, nominal, wajib}
          transactions: [],
        })
      }
      const g = groups.get(gkey)
      g.omset += Number(row.nominal) || 0
      const nName = normName(row.namaBarang)
      if (!g.items.has(nName)) g.items.set(nName, { namaBarang: row.namaBarang, qty: 0, nominal: 0, wajib: p.wajib })
      const it = g.items.get(nName)
      it.qty += Number(row.qty) || 0
      it.nominal += Number(row.nominal) || 0
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
    const nominalRequired = meta.nominalMap.get(pkey) ?? null

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
      reward: REWARD_LABEL[g.program] || '-',
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
  if (f.status === 'Tercapai' && skip !== 'status' && !r.tercapai) return false
  if (f.status === 'Belum Tercapai' && skip !== 'status' && r.tercapai) return false
  return true
}

// Builds the option list for every filter dropdown. When `filters` is
// provided, each field's options are narrowed down by every other
// currently-active filter (cross-filtering / cascading filters) so the
// user can never pick a combination that yields zero rows.
export function getFilterOptions(recap, filters = {}) {
  const sets = { supp: new Set(), program: new Set(), depo: new Set(), kota: new Set(), sales: new Set() }
  for (const r of recap) {
    for (const field of Object.keys(sets)) {
      if (!passesOtherFilters(r, filters, field)) continue
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
    if (filters.status === 'Tercapai' && !r.tercapai) return false
    if (filters.status === 'Belum Tercapai' && r.tercapai) return false
    return true
  })
}
