import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Request } from '../lib/types'
import RequestCard from '../components/RequestCard'
import DonateModal from '../components/DonateModal'
import Leaderboard from '../components/Leaderboard'

type Filter = 'all' | 'active' | 'funded'

export default function ExplorePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Request | null>(null)
  const [search, setSearch] = useState('')

  const fetchRequests = async () => {
    try {
      let query = supabase.from('requests').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') query = query.eq('status', filter)
      const { data, error } = await query
      if (error || !data) { setLoading(false); return }

      const userIds = [...new Set(data.map((r: Request) => r.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', userIds)
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
      const mapped = data.map((r: Request) => ({ ...r, profile: profileMap[r.user_id] ?? null })) as Request[]
      mapped.sort((a, b) => {
        if (a.is_platform_post && !b.is_platform_post) return -1
        if (!a.is_platform_post && b.is_platform_post) return 1
        return 0
      })
      setRequests(mapped)
    } catch (err) {
      console.error('Fetch requests error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setLoading(true); fetchRequests() }, [filter])

  useEffect(() => {
    const referralCode = searchParams.get('ref')
    if (referralCode) localStorage.setItem('starlift_referral_code', referralCode.toUpperCase())
    const focusId = searchParams.get('focus')
    if (!focusId || requests.length === 0) return
    const target = requests.find(r => r.id === focusId)
    if (target) setSelected(target)
  }, [searchParams, requests])

  const filtered = requests.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleCardClick = (r: Request) => {
    if (!user) { navigate('/login'); return }
    setSelected(r)
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80 }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(245,200,66,0.05) 0%, transparent 100%)',
        borderBottom: '1px solid var(--border)', padding: '48px 0 40px',
      }}>
        <div className="page-container">
          <div style={{ maxWidth: 560 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--accent-muted)', border: '1px solid rgba(245,200,66,0.2)',
              borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 700,
              color: 'var(--accent)', marginBottom: 20, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}><span>★</span> Stars-powered crowdfunding</div>
            <h1 style={{
              margin: '0 0 14px', fontSize: 'clamp(28px,5vw,46px)', fontWeight: 900,
              lineHeight: 1.1, letterSpacing: '-0.025em', color: 'var(--text-primary)',
            }}>Help people get<br /><span style={{ color: 'var(--accent)' }}>what they need</span></h1>
            <p style={{ margin: '0 0 28px', fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              Post a request, share your goal, and let the community fund it with Stars. 1 Star = 1 USDT.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn-primary" onClick={() => user ? navigate('/create') : navigate('/signup')} style={{ fontSize: 15, padding: '12px 28px' }}>
                Create a Request
              </button>
              <button className="btn-secondary" onClick={() => document.getElementById('requests-grid')?.scrollIntoView({ behavior: 'smooth' })}>
                Browse Requests ↓
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'Active Requests', value: requests.filter(r => r.status === 'active').length },
              { label: 'Fully Funded', value: requests.filter(r => r.status === 'funded').length },
              { label: 'Total Stars Raised', value: `★ ${requests.reduce((s, r) => s + r.current_stars, 0).toFixed(0)}` },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="requests-grid" style={{ padding: '28px 0 0' }}>
        <div className="page-container">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all', 'active', 'funded'] as Filter[]).map(f => (
                <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Funded'}
                </button>
              ))}
            </div>
            <input type="text" placeholder="Search requests..." value={search} onChange={e => setSearch(e.target.value)}
              className="field-input" style={{ maxWidth: 260, padding: '8px 14px', fontSize: 13 }} />
          </div>

          {loading ? (
            <div className="grid-cards">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 340, borderRadius: 16 }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>★</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No requests found</div>
              <div style={{ fontSize: 14 }}>{search ? 'Try a different search term.' : 'Be the first to create a request!'}</div>
              <button className="btn-primary" onClick={() => user ? navigate('/create') : navigate('/signup')} style={{ marginTop: 24 }}>
                Create a Request
              </button>
            </div>
          ) : (
            <div className="grid-cards">
              {filtered.map(r => <RequestCard key={r.id} request={r} onClick={() => handleCardClick(r)} />)}
            </div>
          )}
        </div>
      </div>

      {selected && <DonateModal request={selected} onClose={() => setSelected(null)} onDonated={fetchRequests} />}
      <Leaderboard />
    </div>
  )
}
