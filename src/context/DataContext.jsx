import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react'
import { loadAllData } from '../lib/supabaseLoader'
import { computeRecap } from '../lib/compute'

const DataContext = createContext(null)

const EMPTY = { sales: [], masterBarang: [], nominalWajib: [], periodeProgram: [] }

export function DataProvider({ children }) {
  const [raw, setRaw] = useState(EMPTY)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMsg, setErrorMsg] = useState(null)
  // default false: setiap program punya AWAL/AKHIR PROGRAM sendiri di sheet
  // "PERIODE PROGRAM" pada MASTER_PROGRAM.xlsx (mis. INLITE - DISPLAY HOKI
  // mulai 1 Jul, DCOTA mulai 1 Agu). Supaya rekap selalu sesuai dengan
  // periode yang tertulis di Excel, periode itu dipakai secara default.
  const [ignorePeriod, setIgnorePeriod] = useState(false)

  const load = useCallback(() => {
    setStatus('loading')
    setErrorMsg(null)
    loadAllData()
      .then((data) => {
        setRaw(data)
        setStatus('ready')
      })
      .catch((err) => {
        console.error(err)
        setErrorMsg(err.message || 'Gagal memuat data Excel')
        setStatus('error')
      })
  }, [])

  useEffect(() => { load() }, [load])

  const meta = {
    salesFileName: 'Supabase: sales',
    masterFileName: 'Supabase: master_barang, nominal_wajib, periode_program',
  }

  const recap = useMemo(
    () => computeRecap(raw.sales, raw.masterBarang, raw.nominalWajib, raw.periodeProgram, { ignorePeriod }),
    [raw, ignorePeriod]
  )

  const value = {
    ...raw, meta, status, errorMsg, reload: load,
    ignorePeriod, setIgnorePeriod,
    recap,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
