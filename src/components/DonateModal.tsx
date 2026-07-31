import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import type { Request } from '../lib/types'

interface Props {
  request: Request
  onClose: () => void
  onDonated: () => void
}

export default function DonateModal({ request, onClose, onDonated }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)

  const isUnlimited = request.is_unlimited
  const remaining = isUnlimited ? Infinity : Math.max(request.final_target - request.current_stars, 0)
  const maxDonate = Math.min(profile?.stars_balance ?? 0, remaining > 0 ? remaining : (profile?.stars_balance ?? 0))
  const pct = isUnlimited ? 0 : Math.min((request.current_stars / request.final_target) * 100, 100)
  const isFunded = !isUnlimited && request.status === 'funded'

  const handleDonate = async () => {
    if (!profile) return
    if (amount <= 0) return
    if (amount > (profile.stars_balance ?? 0)) {
      showToast('Insufficient Stars balance', 'error')
      return
    }
    setLoading(true)
    const { error } = await supabase.rpc('donate_stars', {
      p_request_id: request.id,
      p_amount: amount,
    })
    setLoading(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(`You donated ★ ${amount} successfully!`, 'success')
      await refreshProfile()
      onDonated()
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box wide">
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              Donate Stars
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              Support this request with your Stars
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', marginTop: -4 }}>
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Request preview */}
          <div style={{
            display: 'flex', gap: 14, padding: '14px',
            background: 'var(--surface-raised)', borderRadius: 10,
            border: '1px solid var(--border)',
          }}>
            {request.image_url && (
              <img
                src={request.image_url}
                alt={request.title}
                style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
                {request.title}
              </div>
              {isUnlimited ? (
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                  ★ {request.current_stars.toFixed(0)} raised · Unlimited goal
                </div>
              ) : (
                <>
                  <div className="progress-track" style={{ marginBottom: 5 }}>
                    <div className={`progress-fill ${isFunded ? 'funded' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    ★ {request.current_stars.toFixed(0)} / ★ {request.final_target.toFixed(0)} ({pct.toFixed(0)}%)
                  </div>
                </>
              )}
            </div>
          </div>

          {isFunded ? (
            <div style={{
              padding: 16, background: 'rgba(62,207,142,0.07)',
              border: '1px solid rgba(62,207,142,0.3)',
              borderRadius: 10, textAlign: 'center',
              color: 'var(--success)', fontSize: 14, fontWeight: 600,
            }}>
              This request has been fully funded!
            </div>
          ) : (
            <>
              {/* Balance indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Your balance</span>
                <span className="stars-badge">★ {profile?.stars_balance?.toFixed(0) ?? 0}</span>
              </div>

              {/* Amount selector */}
              <div>
                <label className="field-label">Donation Amount</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <input
                    type="number"
                    min={1}
                    max={maxDonate}
                    value={amount}
                    onChange={e => setAmount(Math.min(Number(e.target.value), maxDonate))}
                    className="field-input"
                    style={{ width: 100, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Stars (= {amount} USDT)</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={Math.max(maxDonate, 1)}
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>★ 1</span>
                  <span>★ {Math.max(maxDonate, 1)}</span>
                </div>
              </div>

              {/* Quick picks */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[5, 10, 25, 50, 100].filter(v => v <= maxDonate).map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="chip"
                    style={amount === v ? { background: 'var(--accent-muted)', borderColor: 'rgba(245,200,66,0.4)', color: 'var(--accent)' } : {}}
                  >
                    ★ {v}
                  </button>
                ))}
                {maxDonate > 0 && (
                  <button
                    onClick={() => setAmount(Math.floor(maxDonate))}
                    className="chip"
                    style={amount === Math.floor(maxDonate) ? { background: 'var(--accent-muted)', borderColor: 'rgba(245,200,66,0.4)', color: 'var(--accent)' } : {}}
                  >
                    Max
                  </button>
                )}
              </div>

              {(profile?.stars_balance ?? 0) < 1 && (
                <div style={{
                  padding: '12px 14px', background: 'rgba(240,96,96,0.08)',
                  border: '1px solid rgba(240,96,96,0.25)',
                  borderRadius: 10, fontSize: 13, color: 'var(--error)',
                }}>
                  You have no Stars. Buy some from your wallet to donate.
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handleDonate}
                disabled={loading || amount < 1 || (profile?.stars_balance ?? 0) < amount}
                style={{ width: '100%', padding: '13px', fontSize: 15 }}
              >
                {loading ? 'Processing...' : `Donate ★ ${amount} Stars`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
