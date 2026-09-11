import React, { useRef, useState } from 'react'
import { X, CheckCircle2, Circle, MapPin, Store, Truck, FileSpreadsheet, ImageDown, Loader2 } from 'lucide-react'
import StatusBadge from './StatusBadge'
import { formatRupiah, formatDate, formatDateRange } from '../lib/format'
import { downloadExcel, downloadElementAsImage } from '../lib/exportUtils'

const TX_COLUMNS = [
  { label: 'No Faktur', key: 'noFaktur', width: 18 },
  { label: 'Tanggal', value: (t) => formatDate(t.tglFaktur), width: 16 },
  { label: 'Nama Barang', key: 'namaBarang', width: 34 },
  { label: 'Qty', key: 'qty', width: 10, numFmt: '#,##0', align: 'right' },
  { label: 'Nominal', key: 'nominal', width: 18, numFmt: '#,##0', align: 'right' },
  { label: 'Wajib', value: (t) => (t.wajib ? 'WAJIB' : ''), width: 10, align: 'center' },
]

export default function DetailModal({ row, onClose }) {
  const [exporting, setExporting] = useState(null) // 'excel' | 'image' | null
  const modalCardRef = useRef(null)
  const txScrollRef = useRef(null)

  if (!row) return null

  const filename = `transaksi-${row.kodeToko}-${row.program}`.replace(/\s+/g, '_')
  const grandTotalQty = row.transactions.reduce((s, t) => s + (Number(t.qty) || 0), 0)
  const grandTotalNominal = row.transactions.reduce((s, t) => s + (Number(t.nominal) || 0), 0)

  const handleDownloadExcel = async () => {
    setExporting('excel')
    try {
      await downloadExcel(filename, 'Riwayat Transaksi', row.transactions, TX_COLUMNS)
    } finally {
      setExporting(null)
    }
  }

  const handleDownloadImage = async () => {
    setExporting('image')
    const scrollEl = txScrollRef.current
    // Temporarily un-clip the scrollable transaction list so the image
    // captures every row, not just what's currently visible on screen.
    const prevMaxHeight = scrollEl?.style.maxHeight
    const prevOverflow = scrollEl?.style.overflow
    if (scrollEl) {
      scrollEl.style.maxHeight = 'none'
      scrollEl.style.overflow = 'visible'
    }
    try {
      // Let the browser finish reflowing and painting the now-unclipped
      // layout before we snapshot it. Without this, html2canvas can start
      // reading element positions while the layout above (the item grid)
      // is still settling from the height change below it, producing an
      // image with overlapping/misplaced text.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await downloadElementAsImage(filename, modalCardRef.current)
    } finally {
      if (scrollEl) {
        scrollEl.style.maxHeight = prevMaxHeight || ''
        scrollEl.style.overflow = prevOverflow || ''
      }
      setExporting(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-ink-950/50 p-3 md:p-6 overflow-y-auto" onClick={onClose}>
      <div
        ref={modalCardRef}
        className="bg-sand-50 rounded-2xl w-full max-w-3xl my-6 shadow-xl rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-sand-200">
          <div>
            <div className="text-[12.5px] uppercase tracking-wide text-brass-600 font-semibold mb-1">{row.supp} · {row.program}</div>
            <h2 className="text-lg font-bold text-ink-900">{row.namaPelanggan}</h2>
            <div className="text-[13px] text-ink-700/70 flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              <span className="flex items-center gap-1"><Store size={13} /> {row.kodeToko}</span>
              <span className="flex items-center gap-1"><MapPin size={13} /> {row.kota}</span>
              <span className="flex items-center gap-1"><Truck size={13} /> {row.depo}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-700/50 hover:text-ink-900 p-1">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-sand-200">
          <div>
            <div className="text-[12px] text-ink-700/60">Omset program</div>
            <div className="font-bold text-ink-900">{formatRupiah(row.omset)}</div>
          </div>
          <div>
            <div className="text-[12px] text-ink-700/60">Syarat omset</div>
            <div className="font-bold text-ink-900">{row.nominalRequired ? formatRupiah(row.nominalRequired) : '—'}</div>
          </div>
          <div>
            <div className="text-[12px] text-ink-700/60">Varian dibeli</div>
            <div className="font-bold text-ink-900">{row.varianCount} dari {row.totalVarianProgram}</div>
          </div>
          <div>
            <div className="text-[12px] text-ink-700/60">Status</div>
            <StatusBadge tercapai={row.tercapai} />
          </div>
        </div>

        <div className="px-6 py-4 border-b border-sand-200">
          <div className="text-[12.5px] text-ink-700/60 mb-2">Periode program: {formatDateRange(row.period?.awal, row.period?.akhir)}</div>
          {row.kekurangan.length > 0 ? (
            <div className="bg-clay-500/10 text-clay-600 rounded-lg px-3 py-2 text-[13px] space-y-1">
              {row.kekurangan.map((k, i) => <div key={i}>• {k}</div>)}
            </div>
          ) : (
            <div className="bg-pine-500/10 text-pine-600 rounded-lg px-3 py-2 text-[13px]">
              Semua syarat program sudah terpenuhi. Reward: <b>{row.reward}</b>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-b border-sand-200">
          <div className="font-semibold text-ink-900 mb-2 text-[14px]">Cek varian item</div>
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '3px' }}>
            <tbody>
              {Array.from({ length: Math.ceil(row.items.length / 2) }).map((_, rowIdx) => {
                const left = row.items[rowIdx * 2]
                const right = row.items[rowIdx * 2 + 1]
                return (
                  <tr key={rowIdx}>
                    {[left, right].map((it, colIdx) =>
                      it ? (
                        <td key={it.namaBarang} className="align-top" style={{ width: '50%' }}>
                          <div
                            className="flex items-center gap-2 text-[13px] px-2.5 rounded-lg bg-white border border-sand-200"
                            style={{ height: '34px', lineHeight: '15px' }}
                          >
                            <CheckCircle2 size={15} className="text-pine-500 shrink-0" />
                            <span className="truncate">{it.namaBarang}</span>
                            {it.wajib && <span className="ml-auto text-[11px] text-brass-600 font-semibold shrink-0">WAJIB</span>}
                            <span className="text-ink-700/50 text-[12px] shrink-0">×{it.qty}</span>
                          </div>
                        </td>
                      ) : (
                        <td key={`empty-${colIdx}`} style={{ width: '50%' }} />
                      )
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-ink-900 text-[14px]">Riwayat transaksi ({row.transactions.length})</div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadExcel}
                disabled={row.transactions.length === 0 || exporting !== null}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-ink-900 text-white text-[12px] font-medium hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                Download Excel
              </button>
              <button
                onClick={handleDownloadImage}
                disabled={row.transactions.length === 0 || exporting !== null}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sand-200 bg-white text-ink-800 text-[12px] font-medium hover:bg-sand-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {exporting === 'image' ? <Loader2 size={13} className="animate-spin" /> : <ImageDown size={13} />}
                Download JPG
              </button>
            </div>
          </div>
          <div className="bg-sand-50 rounded-lg">
            <div ref={txScrollRef} className="max-h-64 overflow-y-auto rounded-t-lg border border-sand-200">
              <table className="w-full text-[12.5px]">
                <thead className="bg-sand-100 text-ink-700/70 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">No Faktur</th>
                    <th className="text-left px-3 py-2 font-medium">Tanggal</th>
                    <th className="text-left px-3 py-2 font-medium">Nama Barang</th>
                    <th className="text-right px-3 py-2 font-medium">Qty</th>
                    <th className="text-right px-3 py-2 font-medium">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {row.transactions.map((t, i) => (
                    <tr key={i} className="border-t border-sand-200 bg-white">
                      <td className="px-3 py-1.5 font-mono text-[11.5px]">{t.noFaktur}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(t.tglFaktur)}</td>
                      <td className="px-3 py-1.5">{t.namaBarang}</td>
                      <td className="px-3 py-1.5 text-right">{t.qty}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatRupiah(t.nominal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-b-lg border border-t-0 border-sand-200 bg-sand-100">
              <span className="text-[12.5px] font-semibold text-ink-900 uppercase tracking-wide">Grand Total</span>
              <div className="flex items-center gap-5">
                <span className="text-[12.5px] text-ink-700/70">
                  Qty: <b className="text-ink-900">{grandTotalQty.toLocaleString('id-ID')}</b>
                </span>
                <span className="text-[13px] text-ink-700/70">
                  Nominal: <b className="text-ink-900">{formatRupiah(grandTotalNominal)}</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
