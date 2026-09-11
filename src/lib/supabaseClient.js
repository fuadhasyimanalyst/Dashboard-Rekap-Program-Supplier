import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Sengaja tidak throw di sini supaya error ditangani rapi oleh DataContext
  // (ditampilkan sebagai pesan "Gagal memuat data" di layar, bukan layar putih).
  console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset di .env')
}

export const supabase = createClient(url || '', anonKey || '')
