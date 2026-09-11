import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react'
import { loadAllData as loadFromSupabase } from '../lib/supabaseLoader'
import { loadAllData as loadFromLocal } from '../lib/localLoader'
import { computeRecap, computeKekuranganPaket } from '../lib/compute'
import { readCache, writeCache, clearCache } from '../lib/cache'

// VITE_DATA_SOURCE=supabase -> baca dari Supabase (production).
// Default 'local' -> baca langsung dari 3 file Excel di public/data/
// (gampang buat coba-coba tanpa perlu setup Supabase dulu).
const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === 'supabase' ? 'supabase' : 'local'
const loadAllData = DATA_SOURCE === 'supabase' ? loadFromSupabase : loadFromLocal

// Caching cuma dinyalakan untuk mode Supabase (yang makan kuota/bandwidth).
// Mode lokal baca file statis di public/data/, jadi tidak perlu di-cache.
const CACHE_KEY = 'all-data'
const CACHE_ENABLED = DATA_SOURCE === 'supabase'
// VITE_CACHE_TTL_MINUTES=0 (default) -> cache TIDAK PERNAH kedaluwarsa
// otomatis, selalu HIT. Cocok kalau sinkronisasi data ke Supabase cuma
// dilakukan manual beberapa kali sehari: tidak ada gunanya fetch ulang
// otomatis di antara jadwal sync itu. Data baru cuma diambil kalau user
// klik tombol refresh manual di Topbar (biasanya setelah npm run
// import:supabase). Isi VITE_CACHE_TTL_MINUTES dengan angka > 0 kalau mau
// tetap ada auto-refresh berkala.
const CACHE_TTL_MINUTES = Number(import.meta.env.VITE_CACHE_TTL_MINUTES) || 0
const CACHE_TTL_MS = CACHE_TTL_MINUTES > 0 ? CACHE_TTL_MINUTES * 60 * 1000 : Infinity

const DataContext = createContext(null)

const EMPTY = { sales: [], masterBarang: [], rekapanProgram: [], nominalWajib: [], periodeProgram: [] }

export function DataProvider({ children }) {
  const [raw, setRaw] = useState(EMPTY)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null)
  // cacheStatus: 'HIT' (pakai data cache, tidak ada request ke Supabase),
  // 'MISS' (baru saja fetch fresh dari Supabase), atau null (mode lokal,
  // caching tidak dipakai).
  const [cacheStatus, setCacheStatus] = useState(null)
  const [cachedAt, setCachedAt] = useState(null)
  // Kapan terakhir `npm run import:supabase` benar-benar dijalankan
  // (server-side, dari tabel sync_meta) -- beda dari cachedAt yang cuma
  // "kapan browser ini terakhir fetch". null di mode lokal (tidak relevan).
  const [lastSyncedAt, setLastSyncedAt] = useState(null)
  // default false: setiap baris di INPUT_REKAPAN_PROGRAM sudah membawa
  // AWAL PROGRAM / AKHIR PROGRAM sendiri, jadi periode itu dipakai secara
  // default supaya rekap selalu sesuai dengan yang tertulis di Excel.
  const [ignorePeriod, setIgnorePeriod] = useState(false)

  // force=true -> lewati cache, selalu fetch fresh dari Supabase (dipakai
  // tombol "Refresh Data" di Topbar, misalnya tepat setelah menjalankan
  // npm run import:supabase supaya tidak perlu nunggu TTL habis).
  const load = useCallback((opts = {}) => {
    const { force = false } = opts
    setStatus('loading')
    setErrorMsg(null)

    if (CACHE_ENABLED && !force) {
      const cached = readCache(CACHE_KEY, CACHE_TTL_MS)
      if (cached) {
        const { lastSyncedAt: cachedSyncedAt, ...rest } = cached.data
        setRaw(rest)
        setLastSyncedAt(cachedSyncedAt ?? null)
        setCacheStatus('HIT')
        setCachedAt(cached.savedAt)
        setStatus('ready')
        return
      }
    }

    if (CACHE_ENABLED && force) clearCache(CACHE_KEY)

    loadAllData()
      .then((data) => {
        const { lastSyncedAt: freshSyncedAt, ...rest } = data
        setRaw(rest)
        setLastSyncedAt(freshSyncedAt ?? null)
        setStatus('ready')
        if (CACHE_ENABLED) {
          writeCache(CACHE_KEY, data)
          setCacheStatus('MISS')
          setCachedAt(Date.now())
        }
      })
      .catch((err) => {
        console.error(err)
        setErrorMsg(err.message || 'Gagal memuat data')
        setStatus('error')
      })
  }, [])

  useEffect(() => { load() }, [load])

  const meta = {
    source: DATA_SOURCE,
    cacheEnabled: CACHE_ENABLED,
    cacheTtlMinutes: CACHE_ENABLED ? CACHE_TTL_MINUTES : null, // 0 = tidak pernah kedaluwarsa otomatis
    tables: {
      sales: 'data_penjualan',
      masterBarang: 'master_barang',
      rekapanProgram: 'rekapan_program',
    },
  }

  const recap = useMemo(
    () => computeRecap(raw.sales, raw.masterBarang, raw.rekapanProgram, { ignorePeriod }),
    [raw, ignorePeriod]
  )

  // Rekap "Pengajuan Paket": semua baris INPUT_REKAPAN_PROGRAM ditampilkan
  // apa adanya, dilengkapi qty yang sudah terkirim (dari data penjualan) dan
  // kekurangan qty yang masih perlu dikirim ke pelanggan.
  const kekuranganPaket = useMemo(
    () => computeKekuranganPaket(raw.rekapanProgram, raw.masterBarang, raw.sales),
    [raw]
  )

  const value = {
    ...raw, meta, status, errorMsg,
    reload: () => load({ force: true }),
    cacheStatus, cachedAt, lastSyncedAt,
    ignorePeriod, setIgnorePeriod,
    recap,
    kekuranganPaket,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
