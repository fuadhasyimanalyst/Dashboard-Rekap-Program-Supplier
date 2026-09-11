import React, { useMemo, useState, useEffect } from 'react'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { useData } from '../context/DataContext'
import { formatRupiah } from '../lib/format'

const PAGE_SIZE = 20

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
// master, tidak difilter/disembunyikan baris apapun), dilengkapi qty yang
// sudah terkirim (dicocokkan dari DATA_PENJUALAN via MASTER_BARANG) dan
// kekurangan jumlah barang yang masih perlu dikirim ke pelanggan.
export default function PengajuanPaketTable() {
  const { kekuranganPaket } = useData()
  const [kodeToko, setKodeToko] = useState('')
  const [program, setProgram] = useState('')
  const [page, setPage] = useState(1)

  const programOptions = useMemo(
    () => Array.from(new Set(kekuranganPaket.map((r) => r.program))).sort(),
    [kekuranganPaket]
  )

  const filtered = useMemo(() => {
    const q = kodeToko.trim().toLowerCase()
    return kekuranganPaket.filter((r) => {
      if (q && !`${r.kodeToko || ''} ${r.namaPelanggan || ''}`.toLowerCase().includes(q)) return false
      if (program && r.program !== program) return false
      return true
    })
  }, [kekuranganPaket, kodeToko, program])

  useEffect(() => { setPage(1) }, [kodeToko, program, kekuranganPaket])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page_ = Math.min(page, pageCount)
  const pageRows = filtered.slice((page_ - 1) * PAGE_SIZE, page_ * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="bg-white border border-sand-200 rounded-2xl p-4 flex flex-wrap gap-2.5 items-center">
        <input
          value={kodeToko}
          onChange={(e) => setKodeToko(e.target.value)}
          placeholder="Cari kode toko / nama pelanggan..."
          className="bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ink-800/20 min-w-[220px]"
        />
        <select
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          className="bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ink-800/20"
        >
          <option value="">Semua Program</option>
          {programOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
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
                <td className="px-4 py-3 text-right">{r.pengajuanPaket}</td>
                <td className="px-4 py-3 text-right">{r.qtyTerkirim}</td>
                <td className={`px-4 py-3 text-right font-semibold ${r.kekuranganQty > 0 ? 'text-clay-600' : 'text-pine-600'}`}>
                  {r.kekuranganQty}
                </td>
                <td className="px-4 py-3"><FormFisikBadge formFisik={r.formFisik} /></td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-ink-700/50">Tidak ada data.</td></tr>
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
