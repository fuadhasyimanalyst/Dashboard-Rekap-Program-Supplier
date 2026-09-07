import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = !!(url && anonKey)

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diset. Buat file .env (lihat .env.example), ' +
    'atau kalau ini deployment Vercel/Netlify, set di Environment Variables project lalu redeploy.'
  )
}

// PENTING: createClient() akan THROW (bikin seluruh app crash / blank putih)
// kalau url kosong. Jadi kalau env belum diset, pakai placeholder supaya
// createClient tidak error saat modul ini di-load — request-nya nanti yang
// akan gagal dengan pesan jelas, ditangkap oleh DataContext (lihat status
// "error" di layar), bukan bikin halaman blank tanpa penjelasan.
export const supabase = createClient(
  url || 'https://placeholder-not-configured.supabase.co',
  anonKey || 'placeholder-not-configured'
)
