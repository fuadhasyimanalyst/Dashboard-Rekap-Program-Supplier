import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import KpiCards from './components/KpiCards'
import ProgramCharts from './components/ProgramCharts'
import RecapTable from './components/RecapTable'
import MasterView from './components/MasterView'
import GlobalFilterBar, { EMPTY_GLOBAL_FILTERS } from './components/GlobalFilterBar'
import { useData } from './context/DataContext'
import { applyGlobalFilters, getFilterOptions } from './lib/compute'

function CenterState({ children }) {
  return <div className="min-h-screen flex items-center justify-center bg-sand-50">{children}</div>
}

export default function App() {
  const [active, setActive] = useState('overview')
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [filters, setFilters] = useState(EMPTY_GLOBAL_FILTERS)
  const { recap, status, errorMsg, reload, paketWarnings, bulanFilter, setBulanFilter, availableMonths } = useData()

  // Options for each dropdown react to every OTHER currently-active filter
  // (e.g. choosing Depo "JEPARA" narrows the Sales dropdown to sales that
  // actually belong to Jepara).
  const filterOptions = useMemo(() => getFilterOptions(recap, filters), [recap, filters])

  // If a previously-picked value becomes invalid because of another filter
  // (e.g. picking a Depo that has no data for the currently-selected Sales),
  // clear it instead of silently showing zero rows.
  useEffect(() => {
    setFilters((f) => {
      const next = { ...f }
      let changed = false
      for (const field of ['program', 'supp', 'depo', 'kota', 'sales']) {
        if (next[field] && !filterOptions[field].includes(next[field])) {
          next[field] = ''
          changed = true
        }
      }
      return changed ? next : f
    })
  }, [filterOptions])

  const filteredRecap = useMemo(() => applyGlobalFilters(recap, filters), [recap, filters])

  if (status === 'loading') {
    return (
      <CenterState>
        <div className="flex flex-col items-center gap-3 text-ink-700">
          <Loader2 size={28} className="animate-spin text-ink-900" />
          <div className="text-[14px]">Membaca DATA_PENJUALAN.xlsx &amp; MASTER_PROGRAM.xlsx...</div>
        </div>
      </CenterState>
    )
  }

  if (status === 'error') {
    return (
      <CenterState>
        <div className="flex flex-col items-center gap-3 text-center max-w-md px-4">
          <AlertTriangle size={28} className="text-clay-600" />
          <div className="font-semibold text-ink-900">Gagal memuat data</div>
          <div className="text-[13.5px] text-ink-700/70">{errorMsg}</div>
          <button
            onClick={reload}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-ink-900 text-white text-[13.5px] font-medium hover:bg-ink-800"
          >
            <RotateCcw size={14} /> Coba lagi
          </button>
        </div>
      </CenterState>
    )
  }

  return (
    <div className="min-h-screen flex bg-sand-50 text-ink-900">
      <Sidebar
        active={active}
        onChange={setActive}
        hidden={sidebarHidden}
        onHide={() => setSidebarHidden(true)}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar active={active} sidebarHidden={sidebarHidden} onShowSidebar={() => setSidebarHidden(false)} />
        <main className="flex-1 px-5 md:px-8 py-6 space-y-5">
          {paketWarnings?.length > 0 && (active === 'overview' || active === 'recap') && (
            <div className="bg-brass-500/10 border border-brass-500/30 text-brass-700 rounded-xl px-4 py-3 text-[13px] flex items-start gap-2.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">
                  {paketWarnings.length} baris di "JUMLAH PAKET" tidak nyambung ke transaksi manapun
                </div>
                <div className="text-brass-700/80">
                  Cek lagi KODE PELANGGAN / NAMA PELANGGAN, SUPP, dan PROGRAM-nya — harus persis sama dengan yang ada di data penjualan &amp; master program. Bisa juga karena pelanggan itu belum ada transaksi utk program tsb pada periode yang sedang ditampilkan.
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {paketWarnings.slice(0, 5).map((p, i) => (
                      <li key={i}>
                        {p.kodeToko || p.namaPelanggan || '(kode/nama kosong)'} · {p.supp} · {p.program} · {p.jumlahPaket}x paket
                      </li>
                    ))}
                    {paketWarnings.length > 5 && <li>...dan {paketWarnings.length - 5} baris lainnya</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}
          {(active === 'overview' || active === 'recap') && (
            <GlobalFilterBar
              filters={filters}
              setFilters={setFilters}
              options={filterOptions}
              bulan={bulanFilter}
              setBulan={setBulanFilter}
              bulanOptions={availableMonths}
            />
          )}
          {active === 'overview' && (
            <>
              <KpiCards recap={filteredRecap} />
              <ProgramCharts recap={filteredRecap} />
              <RecapTable recap={filteredRecap} />
            </>
          )}
          {active === 'recap' && <RecapTable recap={filteredRecap} />}
          {active === 'master' && <MasterView />}
        </main>
      </div>
    </div>
  )
}
