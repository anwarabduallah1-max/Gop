import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
    }}>
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, flexWrap: 'nowrap' }}>
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)' }}>★</span>
          <span className="nav-brand-text" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>StarLift</span>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="stars-badge" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                ★ {profile?.stars_balance?.toFixed(0) ?? 0}
              </span>
              <button className="btn-ghost" onClick={() => navigate('/wallet')} style={{ fontSize: 14, padding: '6px 12px', whiteSpace: 'nowrap' }}>
                Wallet
              </button>
              <button className="btn-ghost" onClick={() => navigate('/my-requests')} style={{ fontSize: 14, padding: '6px 12px', whiteSpace: 'nowrap' }}>
                My Requests
              </button>
              <button className="btn-secondary" onClick={signOut} style={{ fontSize: 14, padding: '6px 14px', whiteSpace: 'nowrap' }}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate('/login')} style={{ fontSize: 14, whiteSpace: 'nowrap' }}>Sign In</button>
              <button className="btn-primary" onClick={() => navigate('/signup')} style={{ fontSize: 14, padding: '8px 18px', whiteSpace: 'nowrap' }}>
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
