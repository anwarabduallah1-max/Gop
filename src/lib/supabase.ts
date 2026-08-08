import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://wqbvcyvaydnqjbrxnhiw.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'Sb_publishable_lbST5gYdD0OYROI1z2IQQA_Vmq1Kpmu'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY

export const supabaseApiUrl = supabaseUrl
export const supabaseApiKey = supabaseAnonKey
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

let client: SupabaseClient | null = null

if (isSupabaseConfigured) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err)
    client = null
  }
}

export const isSupabaseReady = client !== null

export const supabase: SupabaseClient = client ?? (null as unknown as SupabaseClient)
