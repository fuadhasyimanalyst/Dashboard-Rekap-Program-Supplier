import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react'
import { loadAllData } from '../lib/supabaseLoader'
import { computeRecap, findUnmatchedJumlahPaket } from '../lib/compute'
import { monthLabelFromYearMonth } from '../lib/format'

const DataContext = createContext(null)

const EMPTY = { sales: [], masterBarang: [], nominalWajib: [], periodeProgram: [], jumlahPaket: [] }

export function DataProvider({ children }) {
  const [raw, setRaw] = useState(EMPTY)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  const [fromCache, setFromCache] = useState(false)
  // default false: setiap program punya AWAL/AKHIR PROGRAM sendiri di sheet
  // "PERIODE PROGRAM" pada MASTER_PROGRAM.xlsx (mis. INLITE - DISPLAY HOKI
  // mulai 1 Jul, DCOTA mulai 1 Agu). Supaya rekap selalu sesuai dengan
  // periode yang tertulis di Excel, periode itu dipakai secara default.
  const [ignorePeriod, setIgnorePeriod] = useState(false)
  // '' = semua bulan. Kalau diisi ('YYYY-MM'), transaksi sales difilter
  // dulu ke bulan itu SEBELUM dihitung rekapnya -- jadi omset & varian yang
  // dihitung memang benar-benar cuma dari transaksi bulan itu, bukan cuma
  // menyembunyikan baris hasil rekap gabungan semua bulan.
  const [bulanFilter, setBulanFilter] = useState('')

  const load = useCallback((opts = {}) => {
    setStatus('loading')
    setErrorMsg(null)
    loadAllData(opts)
      .then(({ lastSyncedAt, fromCache, ...rest }) => {
        setRaw(rest)
        setLastSyncedAt(lastSyncedAt)
        setFromCache(!!fromCache)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setErrorMsg(err.message || 'Gagal memuat data dari Supabase')
        setStatus('error')
      })
  }, [])

  useEffect(() => { load() }, [load])

  const meta = {
    salesFileName: 'Supabase: sales',
    masterFileName: 'Supabase: master_barang, nominal_wajib, periode_program, jumlah_paket',
    lastSyncedAt,
    fromCache,
  }

  // Daftar bulan yang tersedia (dari TGL FAKTUR transaksi), diurutkan
  // kronologis, terbaru duluan. Dipakai untuk isi dropdown filter bulan.
  const availableMonths = useMemo(() => {
    const set = new Set()
    for (const s of raw.sales) {
      if (s.tglFaktur) set.add(s.tglFaktur.slice(0, 7))
    }
    return Array.from(set).sort().reverse().map((ym) => ({ value: ym, label: monthLabelFromYearMonth(ym) }))
  }, [raw.sales])

  const salesForRecap = useMemo(() => {
    if (!bulanFilter) return raw.sales
    return raw.sales.filter((s) => s.tglFaktur && s.tglFaktur.slice(0, 7) === bulanFilter)
  }, [raw.sales, bulanFilter])

  const recap = useMemo(
    () => computeRecap(salesForRecap, raw.masterBarang, raw.nominalWajib, raw.periodeProgram, raw.jumlahPaket, { ignorePeriod }),
    [salesForRecap, raw.masterBarang, raw.nominalWajib, raw.periodeProgram, raw.jumlahPaket, ignorePeriod]
  )

  // Baris di tabel jumlah_paket yang tidak nyambung ke transaksi manapun
  // pada tampilan saat ini (typo kode/nama/supp/program, atau memang belum
  // ada transaksi utk program itu dalam periode yang sedang dipakai).
  const paketWarnings = useMemo(
    () => findUnmatchedJumlahPaket(recap, raw.jumlahPaket),
    [recap, raw.jumlahPaket]
  )

  const value = {
    ...raw, meta, status, errorMsg,
    reload: () => load({ forceRefresh: true }),
    ignorePeriod, setIgnorePeriod,
    bulanFilter, setBulanFilter, availableMonths,
    recap,
    paketWarnings,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
