import React, { useMemo, useState, useEffect } from 'react'
import { CheckCircle2, CircleDashed, SlidersHorizontal, X } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatRupiah } from '../lib/format'
import { getPaketFilterOptions, applyPaketFilters } from '../lib/compute'

const PAGE_SIZE = 20
const EMPTY_FILTERS = { depo: '', sales: '', bulan: '', supp: '', program: '', status: '' }

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

function FormFisikBadge({ formFisik }) {
  if (formFisik) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium bg-pine-500/10 text-pine-600">
        <CheckCircle2 size={13} /> Sudah sampai kantor
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium bg-clay-500/10 text-clay-600">
      <CircleDashed size={13} /> Belum sampai kantor
    </span>
  )
}

// Menampilkan seluruh data INPUT_REKAPAN_PROGRAM.xlsx apa adanya (data
// master, tidak difilter/disembunyikan baris apapun). Dua jenis program:
//  - Program barang fisik: dilengkapi qty sudah terkirim & kekurangan kirim.
//  - Program reward uang (BELANJA CERIA, DISPLAY HOKI): tidak ada barang
//    fisik yang dikirim, jadi yang ditampilkan adalah kekurangan OMSET
//    terhadap target nominal paket yang diajukan.
export default function PengajuanPaketTable() {
  const { kekuranganPaket } = useData()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const filterOptions = useMemo(() => getPaketFilterOptions(kekuranganPaket, filters), [kekuranganPaket, filters])

  // Bersihkan pilihan filter yang jadi tidak valid akibat filter lain berubah.
  useEffect(() => {
    setFilters((f) => {
      const next = { ...f }
      let changed = false
      for (const field of ['depo', 'sales', 'bulan', 'supp', 'program']) {
        if (next[field] && !filterOptions[field].includes(next[field])) {
          next[field] = ''
          changed = true
        }
      }
      return changed ? next : f
    })
  }, [filterOptions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const byFilters = applyPaketFilters(kekuranganPaket, filters)
    if (!q) return byFilters
    return byFilters.filter((r) => `${r.kodeToko || ''} ${r.namaPelanggan || ''}`.toLowerCase().includes(q))
  }, [kekuranganPaket, filters, search])

  useEffect(() => { setPage(1) }, [search, filters, kekuranganPaket])

  const activeCount = Object.values(filters).filter(Boolean).length
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page_ = Math.min(page, pageCount)
  const pageRows = filtered.slice((page_ - 1) * PAGE_SIZE, page_ * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="bg-white border border-sand-200 rounded-2xl p-4 flex flex-wrap gap-2.5 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode toko / nama pelanggan..."
          className="bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ink-800/20 min-w-[220px]"
        />
        <div className="flex items-center gap-1.5 text-ink-700/70 text-[13px] font-medium pr-1">
          <SlidersHorizontal size={15} /> Filter
        </div>
        <Select value={filters.depo} onChange={(v) => setFilters((f) => ({ ...f, depo: v }))} options={filterOptions.depo} placeholder="Semua Depo" />
        <Select value={filters.sales} onChange={(v) => setFilters((f) => ({ ...f, sales: v }))} options={filterOptions.sales} placeholder="Semua Sales" />
        <Select value={filters.bulan} onChange={(v) => setFilters((f) => ({ ...f, bulan: v }))} options={filterOptions.bulan} placeholder="Semua Bulan" />
        <Select value={filters.supp} onChange={(v) => setFilters((f) => ({ ...f, supp: v }))} options={filterOptions.supp} placeholder="Semua Supplier" />
        <Select value={filters.program} onChange={(v) => setFilters((f) => ({ ...f, program: v }))} options={filterOptions.program} placeholder="Semua Program" />
        <Select
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={['Tercapai', 'Belum Tercapai']}
          placeholder="Semua Status"
        />
        {activeCount > 0 && (
          <button
            onClick={() => setFilters({ ...EMPTY_FILTERS })}
            className="flex items-center gap-1 text-[12.5px] text-clay-600 hover:text-clay-700 px-2 py-1.5 rounded-lg hover:bg-clay-500/10"
          >
            <X size={13} /> Reset ({activeCount})
          </button>
        )}
        <div className="ml-auto text-[12.5px] text-ink-700/60">{filtered.length} baris</div>
      </div>

      <div className="bg-white border border-sand-200 rounded-2xl overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-sand-200 text-left text-ink-700/60 text-[12px] uppercase tracking-wide">
              <th className="px-4 py-3">Kode Toko</th>
              <th className="px-4 py-3">Nama Pelanggan</th>
              <th className="px-4 py-3">Depo</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3 text-right">Pengajuan Paket</th>
              <th className="px-4 py-3 text-right">Sudah Terkirim</th>
              <th className="px-4 py-3 text-right">Kekurangan Kirim</th>
              <th className="px-4 py-3 text-right">Kekurangan Omset</th>
              <th className="px-4 py-3">Form Fisik</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-b border-sand-100 last:border-0 hover:bg-sand-50/60">
                <td className="px-4 py-3 font-medium text-ink-900">{r.kodeToko}</td>
                <td className="px-4 py-3">{r.namaPelanggan}</td>
                <td className="px-4 py-3 text-ink-700/70">{r.depo}</td>
                <td className="px-4 py-3 text-ink-700/70">{r.supp}</td>
                <td className="px-4 py-3">{r.program}</td>
                <td className="px-4 py-3 text-right">
                  {r.isCashReward ? formatRupiah(r.pengajuanPaket) : r.pengajuanPaket}
                </td>
                {r.isCashReward ? (
                  <>
                    <td className="px-4 py-3 text-right text-ink-700/40">—</td>
                    <td className="px-4 py-3 text-right text-ink-700/40">—</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.kekuranganOmset > 0 ? 'text-clay-600' : 'text-pine-600'}`}>
                      {formatRupiah(r.kekuranganOmset)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-right">{r.qtyTerkirim}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.kekuranganQty > 0 ? 'text-clay-600' : 'text-pine-600'}`}>
                      {r.kekuranganQty}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700/40">—</td>
                  </>
                )}
                <td className="px-4 py-3"><FormFisikBadge formFisik={r.formFisik} /></td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-700/50">Tidak ada data.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-[13px]">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page_ === 1}
            className="px-3 py-1.5 rounded-lg border border-sand-200 disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <span className="text-ink-700/60">Halaman {page_} / {pageCount}</span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page_ === pageCount}
            className="px-3 py-1.5 rounded-lg border border-sand-200 disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  )
}
