import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Request } from '../lib/types'
import RequestCard from '../components/RequestCard'
import DonateModal from '../components/DonateModal'

export default function MyRequestsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Request | null>(null)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.from('requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        if (!cancelled) { setRequests((data ?? []) as Request[]); setLoading(false) }
      } catch (err) {
        console.error('Fetch my requests error:', err)
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>My Requests</h1>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>Manage your funding campaigns</p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/create')} style={{ padding: '12px 24px', fontSize: 14 }}>+ New Request</button>
        </div>

        {loading ? (
          <div className="grid-cards">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 340, borderRadius: 16 }} />)}
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>★</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No requests yet</div>
            <div style={{ fontSize: 14, marginBottom: 24 }}>Create your first funding request!</div>
            <button className="btn-primary" onClick={() => navigate('/create')}>Create a Request</button>
          </div>
        ) : (
          <div className="grid-cards">
            {requests.map(r => <RequestCard key={r.id} request={r} onClick={() => setSelected(r)} />)}
          </div>
        )}
      </div>
      {selected && <DonateModal request={selected} onClose={() => setSelected(null)} onDonated={() => {}} />}
    </div>
  )
}
