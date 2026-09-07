import React from 'react'
import { Search } from 'lucide-react'

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

export default function FilterBar({ filters, setFilters, options }) {
  const update = (key) => (val) => setFilters((f) => ({ ...f, [key]: val }))

  return (
    <div className="bg-white border border-sand-200 rounded-2xl p-4 flex flex-wrap gap-2.5 items-center">
      <div className="relative flex-1 min-w-[220px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
        <input
          value={filters.search}
          onChange={(e) => update('search')(e.target.value)}
          placeholder="Cari kode toko atau nama pelanggan..."
          className="w-full bg-sand-50 border border-sand-200 rounded-lg pl-9 pr-3 py-2 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ink-800/20"
        />
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
    </div>
  )
}
