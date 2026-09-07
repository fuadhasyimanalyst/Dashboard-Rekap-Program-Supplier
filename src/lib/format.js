export function formatRupiah(n) {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}

const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

// '2026-07' -> 'Juli 2026'. Dipakai untuk label dropdown filter bulan.
export function monthLabelFromYearMonth(yearMonth) {
  if (!yearMonth) return '-'
  const [y, m] = yearMonth.split('-')
  const idx = parseInt(m, 10) - 1
  return `${BULAN_ID[idx] ?? m} ${y}`
}

export function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function formatDateRange(awal, akhir) {
  if (!awal || !akhir) return 'Sepanjang data'
  return `${formatDate(awal)} – ${formatDate(akhir)}`
}

export function toISODate(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  // handle excel serial numbers
  if (typeof v === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(epoch.getTime() + v * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return s
}
