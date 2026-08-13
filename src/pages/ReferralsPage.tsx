import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

interface ReferralStats { referral_code: string; invited_count: number; earned_stars: number }

export default function ReferralsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const referralLink = useMemo(() => stats ? `${window.location.origin}/signup?ref=${stats.referral_code}` : '', [stats])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data, error } = await supabase.rpc('get_referral_stats')
      if (!error && data?.[0]) setStats(data[0] as ReferralStats)
      setLoading(false)
    })()
  }, [user])

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(referralLink); showToast('Referral link copied!', 'success') } catch (error) { console.error('Referral copy error:', error); showToast('Could not copy the referral link.', 'error') }
  }

  if (!user) return <div className="page-container" style={{ paddingTop: 60 }}>Sign in to access your referral dashboard.</div>
  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 80px' }}>
      <div className="page-container" style={{ maxWidth: 820 }}>
        <div style={{ marginBottom: 28 }}><div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Grow together</div><h1 style={{ margin: '6px 0 8px', fontSize: 32, fontWeight: 900 }}>Your referral dashboard</h1><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>Invite friends, help campaigns get funded, and earn half of every eligible platform fee they generate.</p></div>
        {loading ? <div className="card" style={{ padding: 24 }}>Preparing your referral link...</div> : stats && <>
          <div className="card" style={{ padding: 24, marginBottom: 18, borderColor: 'rgba(245,200,66,0.28)', background: 'linear-gradient(145deg, rgba(245,200,66,0.1), var(--surface) 55%)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Your personal invite link</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><input className="field-input" readOnly value={referralLink} style={{ flex: 1, minWidth: 220 }} /><button className="btn-primary" onClick={copyLink}>Copy Link</button></div>
            <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>Code: <strong style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>{stats.referral_code}</strong></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Friends invited</div><div style={{ marginTop: 8, color: 'var(--text-primary)', fontSize: 30, fontWeight: 900 }}>{stats.invited_count}</div></div>
            <div className="card" style={{ padding: 20 }}><div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Stars earned</div><div style={{ marginTop: 8, color: 'var(--accent)', fontSize: 30, fontWeight: 900 }}>★ {Number(stats.earned_stars).toFixed(2)}</div></div>
          </div>
        </>}
        <div style={{ marginTop: 22, padding: 18, borderRadius: 12, background: 'rgba(62,207,142,0.07)', border: '1px solid rgba(62,207,142,0.18)', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>Referral rewards are credited automatically by the platform after an eligible fee is completed. You never need to enter a friend’s user ID.</div>
      </div>
    </div>
  )
}
