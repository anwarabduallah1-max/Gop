import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { COUNTRIES, COUNTRY_MAP } from '../lib/countries'
import type { CountryLeaderboardEntry, Supporter } from '../lib/types'
import { getAvatarSignedUrl } from './AvatarUpload'

interface CountryRow extends CountryLeaderboardEntry {
  country_name: string
  rank: number
  top_donor_avatar_signed: string | null
}

function formatUsd(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-US')
}

function FlagIcon({ code, size = 32 }: { code: string; size?: number }) {
  return (
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt=""
      width={size}
      height={Math.round(size * 0.75)}
      style={{ borderRadius: 4, objectFit: 'cover', display: 'block', flexShrink: 0 }}
      loading="lazy"
    />
  )
}

function AvatarWithSignedUrl({ avatarPath, username, size = 36 }: { avatarPath: string | null; username: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getAvatarSignedUrl(avatarPath).then(u => { if (active) setUrl(u) })
    return () => { active = false }
  }, [avatarPath])
  if (url) {
    return <img src={url} alt={username} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} />
  }
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {(username?.[0] ?? 'U').toUpperCase()}
    </div>
  )
}

function VipBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      background: 'linear-gradient(135deg, #f5c842, #f7d265)',
      color: '#0d0f14', borderRadius: 999, padding: '2px 8px',
      fontSize: 10, fontWeight: 900, letterSpacing: '0.05em',
      boxShadow: '0 0 8px rgba(245,200,66,0.4)', whiteSpace: 'nowrap',
    }}>
      ♛ VIP
    </span>
  )
}

function StatCard({ children, label, accent }: { children: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div className="card" style={{
      padding: 22, flex: '1 1 280px', position: 'relative', overflow: 'hidden',
      borderColor: accent ? 'rgba(245,200,66,0.25)' : undefined,
    }}>
      {accent && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(245,200,66,0.06), transparent 70%)', pointerEvents: 'none' }} />}
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14, position: 'relative' }}>{label}</div>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

export default function GlobalLeaderboard() {
  const [countryData, setCountryData] = useState<CountryLeaderboardEntry[]>([])
  const [topSupporters, setTopSupporters] = useState<Supporter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active'>('all')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [countryRes, supportersRes] = await Promise.all([
          supabase.rpc('get_country_leaderboard'),
          supabase.rpc('get_top_supporters'),
        ])
        if (countryRes.error) throw countryRes.error
        if (supportersRes.error) throw supportersRes.error
        if (!cancelled) {
          setCountryData((countryRes.data ?? []) as CountryLeaderboardEntry[])
          setTopSupporters((supportersRes.data ?? []) as Supporter[])
          setError(null)
        }
      } catch (err) {
        console.error('Leaderboard fetch error:', err)
        if (!cancelled) setError('Could not load the leaderboard. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const mergedRows: CountryRow[] = useMemo(() => {
    const dataMap = Object.fromEntries(countryData.map(d => [d.country_code, d]))
    return COUNTRIES.map(c => {
      const d = dataMap[c.code]
      return {
        country_code: c.code,
        country_name: c.name,
        total_donated: d?.total_donated ?? 0,
        donor_count: d?.donor_count ?? 0,
        top_donor_username: d?.top_donor_username ?? null,
        top_donor_avatar_url: d?.top_donor_avatar_url ?? null,
        top_donor_amount: d?.top_donor_amount ?? null,
        top_donor_avatar_signed: null,
        rank: 0,
      }
    }).sort((a, b) => b.total_donated - a.total_donated)
  }, [countryData])

  mergedRows.forEach((row, i) => { row.rank = i + 1 })

  const topCountry = mergedRows.find(r => r.total_donated > 0)
  const topDonor = topSupporters[0] ?? null

  const filtered = useMemo(() => {
    let rows = mergedRows
    if (filter === 'active') rows = rows.filter(r => r.total_donated > 0)
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.country_name.toLowerCase().includes(q) || r.country_code.toLowerCase().includes(q))
    }
    return rows
  }, [mergedRows, filter, search])

  if (loading) {
    return (
      <section style={{ padding: '36px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div className="skeleton" style={{ height: 130, flex: '1 1 280px', borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 130, flex: '1 1 280px', borderRadius: 16 }} />
          </div>
          <div className="grid-cards">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />)}
          </div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section style={{ padding: '36px 0' }}>
        <div className="page-container" style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>★</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Leaderboard unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24 }}>{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </section>
    )
  }

  return (
    <section style={{ padding: '36px 0 0' }}>
      <div className="page-container">
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Global rankings</div>
          <h2 style={{ margin: '5px 0 4px', fontSize: 26, fontWeight: 900 }}>World Leaderboard</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>Top donating countries and their champion supporters.</p>
        </div>

        {/* Stats summary cards */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <StatCard label="Top Donating Country" accent={!!topCountry}>
            {topCountry ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <FlagIcon code={topCountry.country_code} size={48} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{topCountry.country_name}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', marginTop: 2 }}>{formatUsd(topCountry.total_donated)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{topCountry.donor_count} donor{topCountry.donor_count !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No donations yet.</div>
            )}
          </StatCard>

          <StatCard label="Top Global Donor" accent={!!topDonor}>
            {topDonor ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <AvatarWithSignedUrl avatarPath={topDonor.avatar_url} username={topDonor.username} size={48} />
                  <div style={{ position: 'absolute', top: -6, right: -6, background: 'linear-gradient(135deg, #f5c842, #f7d265)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, boxShadow: '0 0 8px rgba(245,200,66,0.5)' }}>♛</div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{topDonor.username || 'Anonymous'}</span>
                    <VipBadge />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', marginTop: 2 }}>{formatUsd(topDonor.total_stars)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>★ {topDonor.donated_stars.toFixed(0)} donated · ★ {topDonor.referral_stars.toFixed(0)} referrals</div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No donors yet.</div>
            )}
          </StatCard>
        </div>

        {/* Search & filter bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'active'] as const).map(f => (
              <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All Countries' : 'Has Donations'}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search countries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="field-input"
            style={{ maxWidth: 280, padding: '8px 14px', fontSize: 13 }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {filtered.filter(r => r.total_donated > 0).length} active · {filtered.length} total
          </span>
        </div>

        {/* Country grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.3 }}>★</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No countries found</div>
            <div style={{ fontSize: 14 }}>Try a different search term.</div>
          </div>
        ) : (
          <div className="grid-cards">
            {filtered.map(row => {
              const hasDonations = row.total_donated > 0
              const isTopCountry = topCountry?.country_code === row.country_code
              return (
                <div
                  key={row.country_code}
                  className="card"
                  style={{
                    padding: 18, position: 'relative', overflow: 'hidden',
                    borderColor: isTopCountry ? 'rgba(245,200,66,0.3)' : undefined,
                    boxShadow: isTopCountry ? '0 0 16px rgba(245,200,66,0.1)' : undefined,
                    opacity: hasDonations ? 1 : 0.55,
                    transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
                  }}
                >
                  {isTopCountry && (
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(245,200,66,0.06), transparent 70%)', pointerEvents: 'none' }} />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative' }}>
                    <FlagIcon code={row.country_code} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.country_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                        {hasDonations ? `#${row.rank} · ${row.donor_count} donor${row.donor_count !== 1 ? 's' : ''}` : 'No donations yet'}
                      </div>
                    </div>
                    {isTopCountry && <span style={{ fontSize: 16 }}>♛</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, position: 'relative' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total donated</span>
                    <span style={{ fontSize: 17, fontWeight: 900, color: hasDonations ? 'var(--accent)' : 'var(--text-muted)' }}>{formatUsd(row.total_donated)}</span>
                  </div>

                  {hasDonations && row.top_donor_username && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10, position: 'relative',
                      background: 'linear-gradient(135deg, rgba(245,200,66,0.08), rgba(245,200,66,0.02))',
                      border: '1px solid rgba(245,200,66,0.2)',
                    }}>
                      <div style={{ position: 'relative' }}>
                        <AvatarWithSignedUrl avatarPath={row.top_donor_avatar_url} username={row.top_donor_username} size={32} />
                        <div style={{ position: 'absolute', top: -4, right: -4, background: 'linear-gradient(135deg, #f5c842, #f7d265)', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#0d0f14', fontWeight: 900, boxShadow: '0 0 6px rgba(245,200,66,0.5)' }}>♛</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.top_donor_username}</span>
                          <VipBadge />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginTop: 1 }}>
                          ★ {row.top_donor_amount?.toFixed(0) ?? 0} donated
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
