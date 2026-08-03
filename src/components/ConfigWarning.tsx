import { isSupabaseReady } from '../lib/supabase'

export default function ConfigWarning() {
  if (isSupabaseReady) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
      background: 'rgba(240,96,96,0.95)',
      color: '#fff',
      padding: '12px 20px',
      fontSize: 14,
      fontWeight: 600,
      textAlign: 'center',
      boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    }}>
      Configuration missing: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are not set.
      The app cannot connect to the database. Please add them in your deployment settings.
    </div>
  )
}
