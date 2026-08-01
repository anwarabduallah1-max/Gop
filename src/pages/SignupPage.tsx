import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

export default function SignupPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username } },
    })
    if (error) { setLoading(false); showToast(error.message, 'error'); return }
    if (data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, username })
      showToast('Account created! Welcome to StarLift.', 'success')
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', padding: 32 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' }}>Get Started</h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>Create your StarLift account</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">Username</label>
            <input className="field-input" type="text" placeholder="Your name" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input className="field-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Password</label>
            <input className="field-input" type="password" placeholder="At least 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', padding: '14px', fontSize: 15 }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p style={{ margin: '20px 0 0', fontSize: 14, textAlign: 'center', color: 'var(--text-muted)' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
