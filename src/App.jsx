import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import KpiCards from './components/KpiCards'
import ProgramCharts from './components/ProgramCharts'
import RecapTable from './components/RecapTable'
import PengajuanPaketTable from './components/PengajuanPaketTable'
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
  const { recap, status, errorMsg, reload } = useData()

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
      for (const field of ['program', 'supp', 'depo', 'kota', 'sales', 'bulan']) {
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
          <div className="text-[14px]">Membaca data Excel dari public/data/...</div>
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
          {(active === 'overview' || active === 'recap') && (
            <GlobalFilterBar filters={filters} setFilters={setFilters} options={filterOptions} />
          )}
          {active === 'overview' && (
            <>
              <KpiCards recap={filteredRecap} />
              <ProgramCharts recap={filteredRecap} />
              <RecapTable recap={filteredRecap} />
            </>
          )}
          {active === 'recap' && <RecapTable recap={filteredRecap} />}
          {active === 'pengajuan' && <PengajuanPaketTable />}
          {active === 'master' && <MasterView />}
        </main>
      </div>
    </div>
  )
}
