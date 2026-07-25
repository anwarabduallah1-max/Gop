import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import WalletModal from './WalletModal'

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [walletOpen, setWalletOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    showToast('Signed out', 'info')
    navigate('/')
  }

  return (
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(13,15,20,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>★</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Star<span style={{ color: 'var(--accent)' }}>Give</span>
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {user ? (
              <>
                <button
                  className="stars-badge"
                  onClick={() => setWalletOpen(true)}
                  style={{ cursor: 'pointer', border: '1px solid rgba(245,200,66,0.25)', background: 'var(--accent-muted)' }}
                >
                  <span>★</span>
                  <span>{profile?.stars_balance?.toFixed(0) ?? '0'}</span>
                </button>

                <Link to="/create" style={{ textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                    + New Request
                  </button>
                </Link>

                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuOpen(o => !o)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--accent-muted)',
                      border: '1px solid rgba(245,200,66,0.25)',
                      color: 'var(--accent)',
                      fontSize: 14, fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {(profile?.username?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                  </button>
                  {menuOpen && (
                    <div
                      style={{
                        position: 'absolute', right: 0, top: 44,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        boxShadow: 'var(--shadow-elevated)',
                        minWidth: 180,
                        overflow: 'hidden',
                        zIndex: 99,
                      }}
                      onMouseLeave={() => setMenuOpen(false)}
                    >
                      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {profile?.username ?? 'User'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user.email}</div>
                      </div>
                      <Link
                        to="/my-requests"
                        onClick={() => setMenuOpen(false)}
                        style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        My Requests
                      </Link>
                      <button
                        onClick={() => { setWalletOpen(true); setMenuOpen(false) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 16px', fontSize: 14, color: 'var(--text-secondary)',
                          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Wallet & Stars
                      </button>
                      <hr className="divider" />
                      <button
                        onClick={handleSignOut}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 16px', fontSize: 14, color: 'var(--error)',
                          background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-raised)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" style={{ textDecoration: 'none' }}>
                  <button className="btn-ghost">Sign In</button>
                </Link>
                <Link to="/signup" style={{ textDecoration: 'none' }}>
                  <button className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
                    Get Started
                  </button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </>
  )
}
