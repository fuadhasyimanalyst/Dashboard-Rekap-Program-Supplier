// Cache sederhana berbasis localStorage, dipakai supaya dashboard tidak
// fetch ulang ke Supabase tiap kali halaman dibuka/direfresh (irit kuota).
//
// Cara kerja: data disimpan di localStorage beserta waktu simpannya. Selama
// belum lewat TTL, load berikutnya dianggap HIT (pakai data cache, TIDAK ada
// request ke Supabase sama sekali). Begitu lewat TTL, load berikutnya jadi
// MISS (fetch baru ke Supabase), lalu cache-nya diperbarui dan mulai
// menghitung TTL dari awal lagi.
const NAMESPACE = 'dashboard-supplier-cache-v1'

export function readCache(key, ttlMs) {
  try {
    const raw = localStorage.getItem(`${NAMESPACE}:${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.savedAt !== 'number') return null
    const age = Date.now() - parsed.savedAt
    if (age > ttlMs) return null // sudah kedaluwarsa -> harus MISS
    return { data: parsed.data, savedAt: parsed.savedAt }
  } catch {
    // localStorage tidak tersedia (mis. private/incognito mode) -> anggap tidak ada cache
    return null
  }
}

export function writeCache(key, data) {
  try {
    localStorage.setItem(`${NAMESPACE}:${key}`, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    // localStorage penuh atau tidak tersedia -> abaikan, aplikasi tetap jalan tanpa cache
  }
}

export function clearCache(key) {
  try {
    localStorage.removeItem(`${NAMESPACE}:${key}`)
  } catch {
    // no-op
  }
}
