import React from 'react'
import { CheckCircle2, CircleDashed } from 'lucide-react'

export default function StatusBadge({ tercapai }) {
  if (tercapai) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium bg-pine-500/10 text-pine-600">
        <CheckCircle2 size={13} /> Tercapai
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium bg-clay-500/10 text-clay-600">
      <CircleDashed size={13} /> Belum tercapai
    </span>
  )
}
