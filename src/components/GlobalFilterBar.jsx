import React from 'react'
import { SlidersHorizontal, X } from 'lucide-react'

function Select({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white border border-sand-200 rounded-lg text-[13.5px] px-3 py-2 text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-800/20"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

export const EMPTY_GLOBAL_FILTERS = { program: '', supp: '', depo: '', kota: '', sales: '', status: '' }

export default function GlobalFilterBar({ filters, setFilters, options }) {
  const update = (key) => (val) => setFilters((f) => ({ ...f, [key]: val }))
  const activeCount = Object.values(filters).filter(Boolean).length

  return (
    <div className="bg-white border border-sand-200 rounded-2xl p-4 flex flex-wrap gap-2.5 items-center">
      <div className="flex items-center gap-1.5 text-ink-700/70 text-[13px] font-medium pr-1">
        <SlidersHorizontal size={15} />
        Filter utama
      </div>
      <Select value={filters.program} onChange={update('program')} options={options.program} placeholder="Semua Program" />
      <Select value={filters.supp} onChange={update('supp')} options={options.supp} placeholder="Semua Supplier" />
      <Select value={filters.depo} onChange={update('depo')} options={options.depo} placeholder="Semua Depo" />
      <Select value={filters.kota} onChange={update('kota')} options={options.kota} placeholder="Semua Kota" />
      <Select value={filters.sales} onChange={update('sales')} options={options.sales} placeholder="Semua Sales" />
      <Select
        value={filters.status}
        onChange={update('status')}
        options={['Tercapai', 'Belum Tercapai']}
        placeholder="Semua Status"
      />
      {activeCount > 0 && (
        <button
          onClick={() => setFilters(() => ({ program: '', supp: '', depo: '', kota: '', sales: '', status: '' }))}
          className="flex items-center gap-1 text-[12.5px] text-clay-600 hover:text-clay-700 px-2 py-1.5 rounded-lg hover:bg-clay-500/10 ml-auto"
        >
          <X size={13} /> Reset filter ({activeCount})
        </button>
      )}
    </div>
  )
}
