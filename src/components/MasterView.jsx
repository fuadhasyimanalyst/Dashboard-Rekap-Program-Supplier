import React, { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { formatRupiah, formatDateRange } from '../lib/format'

export default function MasterView() {
  const { masterBarang, nominalWajib, periodeProgram } = useData()

  const programs = useMemo(() => {
    const map = new Map()
    for (const row of masterBarang) {
      const key = `${row.supp}||${row.program}`
      if (!map.has(key)) map.set(key, { supp: row.supp, program: row.program, items: [] })
      map.get(key).items.push(row)
    }
    return Array.from(map.values())
  }, [masterBarang])

  const nominalMap = useMemo(() => {
    const m = new Map()
    for (const n of nominalWajib) m.set(`${n.supp}||${n.program}`, n.nominal)
    return m
  }, [nominalWajib])

  const periodeMap = useMemo(() => {
    const m = new Map()
    for (const p of periodeProgram) m.set(`${p.supp}||${p.program}`, p)
    return m
  }, [periodeProgram])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {programs.map((p) => {
        const key = `${p.supp}||${p.program}`
        const nominal = nominalMap.get(key)
        const periode = periodeMap.get(key)
        const wajibItems = p.items.filter((i) => i.wajib)
        return (
          <div key={key} className="bg-white border border-sand-200 rounded-2xl p-5">
            <div className="flex items-start justify-between mb-1">
              <div>
                <span className="text-[11.5px] uppercase tracking-wide text-brass-600 font-semibold">{p.supp}</span>
                <h3 className="font-bold text-ink-900 text-[16px]">{p.program}</h3>
              </div>
              <span className="text-[12px] text-ink-700/60 text-right">
                {periode ? formatDateRange(periode.awal, periode.akhir) : 'Periode belum diatur'}
              </span>
            </div>
            {nominal != null && (
              <div className="text-[13px] text-ink-700/70 mb-3">Syarat omset: <b className="text-ink-900">{formatRupiah(nominal)}</b></div>
            )}
            {wajibItems.length > 0 && (
              <div className="mb-3">
                <div className="text-[12px] text-ink-700/60 mb-1">Item wajib (pilih min. 2)</div>
                <div className="flex flex-wrap gap-1.5">
                  {wajibItems.map((i) => (
                    <span key={i.namaBarang} className="px-2 py-0.5 rounded-md bg-brass-400/15 text-brass-600 text-[12px] font-medium">
                      {i.namaBarang}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="text-[12px] text-ink-700/60 mb-1">Seluruh item program ({p.items.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {p.items.map((i) => (
                <span key={i.namaBarang} className="px-2 py-0.5 rounded-md bg-sand-100 text-ink-700 text-[12px]">
                  {i.namaBarang}
                </span>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
