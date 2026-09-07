import React from 'react'
import { CalendarClock, DatabaseZap, PanelLeftOpen } from 'lucide-react'
import { useData } from '../context/DataContext'

const TITLES = {
  overview: 'Ringkasan',
  recap: 'Rekap Program per Pelanggan',
  master: 'Data Master Program',
}

export default function Topbar({ active, sidebarHidden, onShowSidebar }) {
  const { ignorePeriod, setIgnorePeriod, meta } = useData()

  return (
    <header className="sticky top-0 z-20 bg-sand-50/90 backdrop-blur border-b border-sand-200 px-5 md:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        {sidebarHidden && (
          <button
            onClick={onShowSidebar}
            title="Tampilkan sidebar"
            className="hidden md:flex mt-0.5 shrink-0 p-2 rounded-lg border border-sand-200 bg-white text-ink-700 hover:bg-sand-100 transition-colors"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-ink-900">{TITLES[active] || ''}</h1>
          <div className="text-[13px] text-ink-700/70 flex items-center gap-1.5 mt-0.5">
            <DatabaseZap size={13} />
            Sumber data: {meta.salesFileName} &amp; {meta.masterFileName}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-white border border-sand-200 rounded-full p-1 text-[13px] shadow-sm" title="Periode diambil dari sheet PERIODE PROGRAM di MASTER_PROGRAM.xlsx, per program masing-masing">
          <button
            onClick={() => setIgnorePeriod(false)}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
              !ignorePeriod ? 'bg-ink-900 text-white' : 'text-ink-700/70 hover:text-ink-900'
            }`}
          >
            <CalendarClock size={13} /> Sesuai periode Excel
          </button>
          <button
            onClick={() => setIgnorePeriod(true)}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors ${
              ignorePeriod ? 'bg-ink-900 text-white' : 'text-ink-700/70 hover:text-ink-900'
            }`}
          >
            <CalendarClock size={13} /> Semua transaksi
          </button>
        </div>
      </div>
    </header>
  )
}
