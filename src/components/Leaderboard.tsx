import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Supporter } from '../lib/types'

const badgeNames = ['Gold', 'Silver', 'Bronze']
const badgeColors = ['#f5c842', '#c7d0dc', '#c78b5b']

export default function Leaderboard() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('get_top_supporters')
      if (!cancelled && !error) setSupporters((data ?? []) as Supporter[])
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <section style={{ padding: '36px 0 0' }}>
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Community spotlight</div>
            <h2 style={{ margin: '5px 0 4px', fontSize: 24, fontWeight: 900 }}>Top 10 Supporters</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>The people moving the StarLift community forward.</p>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Donations + referral rewards</span>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? <div style={{ padding: 22, color: 'var(--text-muted)' }}>Loading the leaderboard...</div> : supporters.length === 0 ? <div style={{ padding: 22, color: 'var(--text-muted)' }}>Be the first supporter to appear here.</div> : supporters.map((supporter, index) => (
            <div key={`${supporter.username}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: index === supporters.length - 1 ? 'none' : '1px solid var(--border)' }}>
              <div style={{ width: 28, color: index < 3 ? badgeColors[index] : 'var(--text-muted)', fontSize: 13, fontWeight: 900, textAlign: 'center' }}>#{index + 1}</div>
              <div className="avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{(supporter.username?.[0] ?? 'U').toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{supporter.username || 'Anonymous'}</div><div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>★ {supporter.donated_stars.toFixed(0)} donated · ★ {supporter.referral_stars.toFixed(0)} earned</div></div>
              {index < 3 && <span style={{ color: badgeColors[index], border: `1px solid ${badgeColors[index]}66`, background: `${badgeColors[index]}12`, borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 800 }}>{badgeNames[index]}</span>}
              <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>★ {supporter.total_stars.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
