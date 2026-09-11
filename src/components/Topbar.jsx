import React from 'react'
import { CalendarClock, DatabaseZap, PanelLeftOpen, RefreshCw, Zap, ZapOff } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatDateTime } from '../lib/format'

const TITLES = {
  overview: 'Ringkasan',
  recap: 'Rekap Program per Pelanggan',
  pengajuan: 'Pengajuan Paket & Kekurangan Kirim',
  master: 'Data Master Program',
}

function timeAgo(ts) {
  if (!ts) return null
  const diffMin = Math.round((Date.now() - ts) / 60000)
  if (diffMin < 1) return 'baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.round(diffMin / 60)
  return `${diffHour} jam lalu`
}

function CacheBadge() {
  const { meta, cacheStatus, cachedAt, reload, status } = useData()
  if (!meta.cacheEnabled) return null

  const isHit = cacheStatus === 'HIT'
  const neverExpires = !meta.cacheTtlMinutes || meta.cacheTtlMinutes <= 0
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={
          isHit
            ? `Data dari cache browser (tidak ada request baru ke Supabase). ${neverExpires ? 'Cache berlaku terus sampai kamu klik refresh manual.' : `Cache berlaku ${meta.cacheTtlMinutes} menit.`}`
            : `Data baru saja diambil langsung dari Supabase. ${neverExpires ? 'Akan dipakai terus dari cache sampai kamu klik refresh manual.' : `Akan di-cache selama ${meta.cacheTtlMinutes} menit.`}`
        }
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[12px] font-medium ${
          isHit ? 'bg-pine-500/10 text-pine-600' : 'bg-clay-500/10 text-clay-600'
        }`}
      >
        {isHit ? <Zap size={12} /> : <ZapOff size={12} />}
        Cache {cacheStatus || '-'}{cachedAt ? ` · ${timeAgo(cachedAt)}` : ''}
      </span>
      <button
        onClick={reload}
        disabled={status === 'loading'}
        title="Ambil data terbaru langsung dari Supabase (lewati cache). Klik ini setiap habis npm run import:supabase."
        className="p-1.5 rounded-full border border-sand-200 bg-white text-ink-700 hover:bg-sand-100 disabled:opacity-50 transition-colors"
      >
        <RefreshCw size={13} className={status === 'loading' ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}

export default function Topbar({ active, sidebarHidden, onShowSidebar }) {
  const { ignorePeriod, setIgnorePeriod, meta, lastSyncedAt } = useData()

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
            Sumber data: {meta.source === 'supabase' ? 'Supabase' : 'Excel lokal (public/data/)'}
            {meta.source === 'supabase' && (
              <span className="text-ink-700/50">
                · Sync terakhir: {lastSyncedAt ? formatDateTime(lastSyncedAt) : 'belum pernah (jalankan npm run import:supabase)'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <CacheBadge />
        <div className="flex items-center bg-white border border-sand-200 rounded-full p-1 text-[13px] shadow-sm" title="Periode diambil dari kolom AWAL PROGRAM / AKHIR PROGRAM di INPUT_REKAPAN_PROGRAM.xlsx, per toko & program masing-masing">
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
