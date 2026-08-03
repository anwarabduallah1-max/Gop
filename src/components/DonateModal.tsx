import { useState } from 'react'
import type { Request } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

interface Props {
  request: Request
  onClose: () => void
  onDonated: () => void
}

const PRESET_AMOUNTS = [5, 10, 25, 50]

export default function DonateModal({ request, onClose, onDonated }: Props) {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const [amount, setAmount] = useState(5)
  const [loading, setLoading] = useState(false)

  const balance = profile?.stars_balance ?? 0
  const insufficient = amount > balance

  const handleDonate = async () => {
    if (!user) return
    if (amount <= 0) { showToast('Enter a valid amount', 'error'); return }
    if (insufficient) { showToast('Insufficient Stars balance. Top up your wallet first.', 'error'); return }

    setLoading(true)
    try {
      const { error } = await supabase.rpc('donate_stars', {
        p_request_id: request.id,
        p_amount: amount,
      })
      setLoading(false)

      if (error) {
        showToast(error.message, 'error')
      } else {
        showToast(`Donated ★ ${amount} to ${request.title}!`, 'success')
        onDonated()
        onClose()
      }
    } catch (err) {
      console.error('Donate error:', err)
      setLoading(false)
      showToast('Donation failed. Please try again.', 'error')
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Donate Stars</h2>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>{request.title}</p>
            </div>
            <button className="btn-ghost" onClick={onClose} style={{ padding: '4px 10px', fontSize: 18 }}>✕</button>
          </div>

          {request.image_url && (
            <img
              src={request.image_url}
              alt={request.title}
              style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}

          {request.is_platform_post && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'var(--accent-muted)', border: '1px solid rgba(245,200,66,0.3)',
              borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800,
              color: '#0d0f14', marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              ★ Official Campaign
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Your balance: ★ {balance.toFixed(0)}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {PRESET_AMOUNTS.map(a => (
                <button
                  key={a}
                  className={`chip ${amount === a ? 'active' : ''}`}
                  onClick={() => setAmount(a)}
                  style={{ minWidth: 56 }}
                >
                  ★ {a}
                </button>
              ))}
            </div>
            <input
              className="field-input"
              type="number"
              value={amount}
              onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              min={1}
              placeholder="Custom amount"
            />
          </div>

          {insufficient && (
            <div style={{ padding: '10px 14px', background: 'rgba(240,96,96,0.08)', border: '1px solid rgba(240,96,96,0.3)', borderRadius: 8, marginBottom: 14, fontSize: 13, color: 'var(--error)' }}>
              You need ★ {amount} but have ★ {balance.toFixed(0)}. Top up your wallet first.
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleDonate}
            disabled={loading || insufficient || amount <= 0}
            style={{ width: '100%', padding: '14px', fontSize: 15 }}
          >
            {loading ? 'Processing...' : `Donate ★ ${amount}`}
          </button>
        </div>
      </div>
    </div>
  )
}
