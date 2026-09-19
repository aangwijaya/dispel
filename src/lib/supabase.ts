import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publicKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (typeof url !== 'string' || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
  throw new Error('VITE_SUPABASE_URL is missing or malformed')
}

if (typeof publicKey !== 'string' || publicKey.trim().length < 20) {
  throw new Error('VITE_SUPABASE_ANON_KEY is missing')
}

export const supabase = createClient(url, publicKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
