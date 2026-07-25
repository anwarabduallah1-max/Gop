import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

const PACKAGES = [
  { stars: 10,  price: 10,  label: 'Starter' },
  { stars: 50,  price: 50,  label: 'Supporter', popular: true },
  { stars: 100, price: 100, label: 'Champion' },
  { stars: 250, price: 250, label: 'Patron' },
  { stars: 500, price: 500, label: 'Legend' },
]

interface Props {
  onClose: () => void
}

export default function WalletModal({ onClose }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [selected, setSelected] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
  const [loading, setLoading] = useState(false)

  const getAmount = () => {
    if (custom !== '') return Math.max(Number(custom), 1)
    return selected ?? 0
  }

  const handleBuy = async () => {
    const amt = getAmount()
    if (amt < 1) return
    setLoading(true)
    const { error } = await supabase.rpc('buy_stars', { amount: amt })
    setLoading(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast(`★ ${amt} Stars added to your wallet!`, 'success')
      await refreshProfile()
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              Wallet &amp; Stars
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              1 Star = 1 USDT
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', marginTop: -4 }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Current balance */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 18px',
            background: 'var(--accent-muted)',
            border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 12,
          }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Current Balance
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                ★ {profile?.stars_balance?.toFixed(0) ?? 0}
              </div>
            </div>
            <div style={{ fontSize: 36, opacity: 0.3 }}>★</div>
          </div>

          {/* Packages */}
          <div>
            <div className="field-label">Buy Stars</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {PACKAGES.map(pkg => (
                <button
                  key={pkg.stars}
                  onClick={() => { setSelected(pkg.stars); setCustom('') }}
                  style={{
                    position: 'relative',
                    background: selected === pkg.stars && custom === '' ? 'var(--accent-muted)' : 'var(--surface-raised)',
                    border: selected === pkg.stars && custom === '' ? '1px solid rgba(245,200,66,0.5)' : '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {pkg.popular && (
                    <div style={{
                      position: 'absolute', top: -8, right: 10,
                      background: 'var(--accent)', color: '#0d0f14',
                      fontSize: 9, fontWeight: 800,
                      padding: '2px 8px', borderRadius: 999,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>
                      Popular
                    </div>
                  )}
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>
                    ★ {pkg.stars}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>${pkg.price} USDT</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pkg.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div>
            <label className="field-label">Custom Amount</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="number"
                placeholder="Enter Stars amount"
                value={custom}
                onChange={e => { setCustom(e.target.value); setSelected(null) }}
                className="field-input"
                min={1}
              />
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                = ${custom || 0} USDT
              </span>
            </div>
          </div>

          <button
            className="btn-primary"
            onClick={handleBuy}
            disabled={loading || getAmount() < 1}
            style={{ width: '100%', padding: '13px', fontSize: 15 }}
          >
            {loading ? 'Processing...' : `Buy ★ ${getAmount()} Stars — $${getAmount()} USDT`}
          </button>

          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            This is a demo platform. No real payment is processed.
            Stars are added instantly for demonstration purposes.
          </p>
        </div>
      </div>
    </div>
  )
}
