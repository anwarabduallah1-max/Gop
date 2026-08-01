import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function LoginPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) showToast(error.message, 'error')
    else { showToast('Welcome back!', 'success'); navigate('/') }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' }}>Sign In</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>Welcome back to StarLift</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">Email</label>
            <input className="field-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="field-input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: 15 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ margin: '20px 0 0', fontSize: 14, textAlign: 'center', color: 'var(--text-muted)' }}>
          No account? <Link to="/signup" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign up</Link>
        </p>
      </div>
    </div>
  )
}
