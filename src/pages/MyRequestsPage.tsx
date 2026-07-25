import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { Request } from '../lib/types'
import DonateModal from '../components/DonateModal'

export default function MyRequestsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'created' | 'donated'>('created')
  const [selected, setSelected] = useState<Request | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchMyRequests = async () => {
    if (!user) return
    let data: Request[] = []
    if (tab === 'created') {
      const { data: d } = await supabase
        .from('requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      data = (d ?? []) as Request[]
    } else {
      const { data: txns } = await supabase
        .from('transactions')
        .select('request_id')
        .eq('donor_id', user.id)
      const ids = [...new Set((txns ?? []).map(t => t.request_id))]
      if (ids.length > 0) {
        const { data: d } = await supabase
          .from('requests')
          .select('*')
          .in('id', ids)
          .order('created_at', { ascending: false })
        data = (d ?? []) as Request[]
      }
    }

    if (data.length > 0) {
      const userIds = [...new Set(data.map(r => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds)
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
      data = data.map(r => ({ ...r, profile: profileMap[r.user_id] ?? null }))
    }

    setRequests(data)
    setLoading(false)
  }

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    setLoading(true)
    fetchMyRequests()
  }, [user, tab])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this request? This cannot be undone.')) return
    setDeleting(id)
    const { error } = await supabase.from('requests').delete().eq('id', id)
    setDeleting(null)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Request deleted', 'info')
      setRequests(prev => prev.filter(r => r.id !== id))
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container" style={{ maxWidth: 800 }}>
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em' }}>My Activity</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
              Requests you created and campaigns you supported
            </p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/create')} style={{ fontSize: 13, padding: '9px 18px' }}>
            + New Request
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          <button className={`chip ${tab === 'created' ? 'active' : ''}`} onClick={() => setTab('created')}>
            Created
          </button>
          <button className={`chip ${tab === 'donated' ? 'active' : ''}`} onClick={() => setTab('donated')}>
            Donated To
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 110, borderRadius: 12 }} />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.25 }}>★</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
              {tab === 'created' ? 'No requests yet' : 'No donations yet'}
            </div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>
              {tab === 'created' ? 'Create your first funding request.' : 'Explore requests and donate Stars to support others.'}
            </div>
            <button className="btn-primary" onClick={() => navigate(tab === 'created' ? '/create' : '/')}>
              {tab === 'created' ? 'Create a Request' : 'Browse Requests'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {requests.map(r => {
              const pct = Math.min((r.current_stars / r.final_target) * 100, 100)
              const isFunded = r.status === 'funded'
              return (
                <div key={r.id} className="card" style={{ padding: '18px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  {r.image_url && (
                    <img
                      src={r.image_url}
                      alt={r.title}
                      style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 3 }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Created {new Date(r.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '3px 10px', borderRadius: 999,
                          background: isFunded ? 'rgba(62,207,142,0.1)' : 'var(--accent-muted)',
                          color: isFunded ? 'var(--success)' : 'var(--accent)',
                          border: isFunded ? '1px solid rgba(62,207,142,0.3)' : '1px solid rgba(245,200,66,0.25)',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {r.status}
                        </span>
                      </div>
                    </div>

                    <div className="progress-track" style={{ marginBottom: 6 }}>
                      <div className={`progress-fill ${isFunded ? 'funded' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>★ {r.current_stars.toFixed(0)} raised of ★ {r.final_target.toFixed(0)}</span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      {tab === 'created' && r.status === 'active' && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                          style={{
                            fontSize: 12, padding: '5px 12px',
                            background: 'transparent',
                            border: '1px solid rgba(240,96,96,0.3)',
                            color: 'var(--error)',
                            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {deleting === r.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                      {tab === 'donated' && r.status === 'active' && (
                        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => setSelected(r)}>
                          Donate More ★
                        </button>
                      )}
                      {r.product_url && (
                        <a
                          href={r.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', padding: '5px 0', alignSelf: 'center' }}
                        >
                          View Product ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <DonateModal
          request={selected}
          onClose={() => setSelected(null)}
          onDonated={fetchMyRequests}
        />
      )}
    </div>
  )
}
