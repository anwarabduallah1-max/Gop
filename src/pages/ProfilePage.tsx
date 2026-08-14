import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AvatarUpload from '../components/AvatarUpload'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { COUNTRIES } from '../lib/countries'

export default function ProfilePage() {
  const { user, profile, profileLoading, profileError, refreshProfile, signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [country, setCountry] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) navigate('/login')
  }, [user, navigate])

  useEffect(() => {
    if (profile) {
      setUsername(profile.username)
      setCountry(profile.country ?? '')
    }
  }, [profile])

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = username.trim()
    if (!user || !trimmed) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ username: trimmed, country: country || null, updated_at: new Date().toISOString() }).eq('id', user.id)
    setSaving(false)
    if (error) showToast('Could not save your profile.', 'error')
    else { await refreshProfile(); showToast('Profile saved.', 'success') }
  }

  if (!user) return null

  if (profileLoading && !profile) {
    return (
      <div className="page-container" style={{ paddingTop: 60, color: 'var(--text-muted)' }}>
        <div className="skeleton" style={{ width: 112, height: 112, borderRadius: '50%', marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 12, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 16, width: 300, borderRadius: 8 }} />
      </div>
    )
  }

  if (!profile && profileError) {
    return (
      <div className="page-container" style={{ maxWidth: 480, paddingTop: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>★</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 10 }}>Could not load your profile</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>{profileError}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn-primary" onClick={() => refreshProfile()}>Try again</button>
          <button className="btn-secondary" onClick={async () => { await signOut(); navigate('/login') }}>Sign out</button>
        </div>
      </div>
    )
  }

  if (!profile) return null

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', padding: '40px 0 80px' }}>
      <div className="page-container" style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 26 }}><div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Account</div><h1 style={{ margin: '6px 0 8px', fontSize: 32, fontWeight: 900 }}>Profile settings</h1><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>Make your StarLift profile feel like yours.</p></div>
        <div className="card" style={{ padding: 24, marginBottom: 16 }}><AvatarUpload userId={user.id} avatarPath={profile.avatar_url} username={profile.username} onUploaded={async () => { await refreshProfile() }} /></div>
        <form className="card" onSubmit={saveProfile} style={{ padding: 24 }}>
          <label className="field-label" htmlFor="username">Display name</label>
          <input id="username" className="field-input" value={username} onChange={event => setUsername(event.target.value)} maxLength={40} required style={{ marginTop: 8 }} />
          <label className="field-label" htmlFor="country" style={{ marginTop: 20 }}>Country</label>
          <select id="country" className="field-input" value={country} onChange={event => setCountry(event.target.value)} style={{ marginTop: 8, cursor: 'pointer' }}>
            <option value="">Select your country</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>Your country determines your ranking on the World Leaderboard.</div>
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}><button className="btn-primary" disabled={saving || !username.trim()} type="submit">{saving ? 'Saving...' : 'Save changes'}</button></div>
        </form>
      </div>
    </div>
  )
}
