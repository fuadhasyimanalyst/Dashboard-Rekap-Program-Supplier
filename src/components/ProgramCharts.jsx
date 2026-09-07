import React, { useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend, LabelList,
} from 'recharts'
import { ImageDown, Loader2 } from 'lucide-react'
import { formatRupiah } from '../lib/format'
import { downloadElementAsImage } from '../lib/exportUtils'

const PIE_COLORS = ['#2F8F6B', '#C1543C']

function ChartDownloadButton({ targetRef, filename }) {
  const [busy, setBusy] = useState(false)
  const handleClick = async () => {
    setBusy(true)
    try {
      await downloadElementAsImage(filename, targetRef.current)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sand-200 bg-white text-ink-800 text-[12px] font-medium hover:bg-sand-100 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <ImageDown size={13} />}
      Download JPG
    </button>
  )
}

function ChartCard({ chartRef, title, subtitle, filename, controls, children }) {
  return (
    <div ref={chartRef} className="bg-white border border-sand-200 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <div className="font-semibold text-ink-900">{title}</div>
          {subtitle && <div className="text-[13px] text-ink-700/60">{subtitle}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <ChartDownloadButton targetRef={chartRef} filename={filename} />
        </div>
      </div>
      {children}
    </div>
  )
}

function StatusByProgram({ recap }) {
  const chartRef = useRef(null)
  const data = useMemo(() => {
    const map = new Map()
    for (const r of recap) {
      if (!map.has(r.program)) map.set(r.program, { program: r.program, Tercapai: 0, Belum: 0 })
      const row = map.get(r.program)
      if (r.tercapai) row.Tercapai += 1
      else row.Belum += 1
    }
    return Array.from(map.values())
  }, [recap])

  return (
    <ChartCard
      chartRef={chartRef}
      title="Status pencapaian per program"
      subtitle="Jumlah pelanggan tercapai vs belum, per jenis program"
      filename="status-pencapaian-per-program"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: -10, top: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D2" vertical={false} />
          <XAxis dataKey="program" tick={{ fontSize: 12, fill: '#4A5D66' }} interval={0} angle={-12} textAnchor="end" height={55} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#4A5D66' }} />
          <Tooltip cursor={{ fill: '#F1EDE4' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Tercapai" stackId="a" fill="#2F8F6B" radius={[0, 0, 0, 0]}>
            <LabelList dataKey="Tercapai" position="inside" fill="#fff" fontSize={11} formatter={(v) => (v ? v : '')} />
          </Bar>
          <Bar dataKey="Belum" stackId="a" fill="#C1543C" radius={[4, 4, 0, 0]}>
            <LabelList dataKey="Belum" position="inside" fill="#fff" fontSize={11} formatter={(v) => (v ? v : '')} />
            <LabelList
              dataKey={(d) => d.Tercapai + d.Belum}
              position="top"
              fill="#12232C"
              fontSize={12}
              fontWeight={600}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function OmsetBySupplier({ recap }) {
  const chartRef = useRef(null)
  const data = useMemo(() => {
    const map = new Map()
    for (const r of recap) {
      map.set(r.supp, (map.get(r.supp) || 0) + r.omset)
    }
    return Array.from(map.entries()).map(([supp, omset]) => ({ supp, omset })).sort((a, b) => b.omset - a.omset)
  }, [recap])

  return (
    <ChartCard
      chartRef={chartRef}
      title="Omset item program per supplier"
      subtitle="Total nominal penjualan barang yang masuk program"
      filename="omset-per-supplier"
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 50 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D2" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v)} tick={{ fontSize: 12, fill: '#4A5D66' }} />
          <YAxis type="category" dataKey="supp" tick={{ fontSize: 12, fill: '#4A5D66' }} width={80} />
          <Tooltip formatter={(v) => formatRupiah(v)} cursor={{ fill: '#F1EDE4' }} />
          <Bar dataKey="omset" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#D9A441" />
            ))}
            <LabelList dataKey="omset" position="right" fill="#12232C" fontSize={11} formatter={(v) => formatRupiah(v)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

function ChartSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-sand-50 border border-sand-200 rounded-lg text-[12.5px] px-2.5 py-1.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-800/20"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

function DepoChart({ recap }) {
  const chartRef = useRef(null)
  const [program, setProgram] = useState('')
  const [status, setStatus] = useState('')

  const programOptions = useMemo(
    () => Array.from(new Set(recap.map((r) => r.program))).sort(),
    [recap]
  )

  const filtered = useMemo(() => {
    return recap.filter((r) => {
      if (program && r.program !== program) return false
      if (status === 'Tercapai' && !r.tercapai) return false
      if (status === 'Belum Tercapai' && r.tercapai) return false
      return true
    })
  }, [recap, program, status])

  const data = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      const depo = r.depo || 'Tanpa Depo'
      map.set(depo, (map.get(depo) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([depo, jumlah]) => ({ depo, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah)
  }, [filtered])

  return (
    <ChartCard
      chartRef={chartRef}
      title="Jumlah pelanggan per depo"
      subtitle="Bisa disaring per program & status pencapaian"
      filename="jumlah-pelanggan-per-depo"
      controls={
        <>
          <ChartSelect value={program} onChange={setProgram} options={programOptions} placeholder="Semua Program" />
          <ChartSelect value={status} onChange={setStatus} options={['Tercapai', 'Belum Tercapai']} placeholder="Semua Status" />
        </>
      }
    >
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ left: -10, top: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E0D2" vertical={false} />
          <XAxis dataKey="depo" tick={{ fontSize: 12, fill: '#4A5D66' }} interval={0} angle={-12} textAnchor="end" height={55} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#4A5D66' }} />
          <Tooltip cursor={{ fill: '#F1EDE4' }} />
          <Bar dataKey="jumlah" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill="#D9A441" />
            ))}
            <LabelList dataKey="jumlah" position="top" fill="#12232C" fontSize={12} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export default function ProgramCharts({ recap }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <StatusByProgram recap={recap} />
      <OmsetBySupplier recap={recap} />
      <DepoChart recap={recap} />
    </div>
  )
}
