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

type Step = 'select' | 'pay' | 'processing' | 'done'

interface Props {
  onClose: () => void
}

function generateDepositAddress(): string {
  const chars = '0123456789abcdef'
  let addr = 'T'
  for (let i = 0; i < 33; i++) addr += chars[Math.floor(Math.random() * 16)]
  return addr
}

export default function WalletModal({ onClose }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()

  const [selected, setSelected] = useState<number | null>(50)
  const [custom, setCustom] = useState('')
  const [step, setStep] = useState<Step>('select')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [depositAddress] = useState(generateDepositAddress)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getAmount = () => {
    if (custom !== '') return Math.max(Number(custom), 1)
    return selected ?? 0
  }

  const handleProceedToPay = () => {
    const amt = getAmount()
    if (amt < 1) return
    setError(null)
    setStep('pay')
  }

  const handleConfirmPayment = async () => {
    const amt = getAmount()
    if (amt < 1) return
    setError(null)
    setStep('processing')

    // 1. Create a pending payment_order row.
    const { data: order, error: insertErr } = await supabase
      .from('payment_orders')
      .insert({
        usdt_amount: amt,
        stars_amount: amt,
        status: 'pending',
      })
      .select('id')
      .maybeSingle()

    if (insertErr || !order) {
      setError(insertErr?.message ?? 'Failed to create payment order')
      setStep('pay')
      return
    }

    setOrderId(order.id)

    // 2. Call the deposit-webhook edge function to simulate blockchain confirmation.
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/deposit-webhook`
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ order_id: order.id }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Payment failed (${res.status})`)
      }
      setTxHash(json.tx_hash ?? null)
      await refreshProfile()
      setStep('done')
    } catch (e) {
      setError((e as Error).message)
      setStep('pay')
    }
  }

  const handleClose = () => {
    if (step === 'done') showToast(`★ ${getAmount()} Stars added to your wallet!`, 'success')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal-box">
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {step === 'select' && 'Wallet & Stars'}
              {step === 'pay' && 'USDT Payment'}
              {step === 'processing' && 'Confirming Payment...'}
              {step === 'done' && 'Payment Confirmed'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              {step === 'select' && '1 Star = 1 USDT'}
              {step === 'pay' && 'Send USDT to the deposit address below'}
              {step === 'processing' && 'Waiting for blockchain confirmation'}
              {step === 'done' && 'Your Stars have been credited'}
            </p>
          </div>
          {step !== 'processing' && (
            <button onClick={handleClose} className="btn-ghost" style={{ padding: '6px', marginTop: -4 }}>✕</button>
          )}
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Current balance — always visible */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'var(--accent-muted)',
            border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Current Balance
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>
                ★ {profile?.stars_balance?.toFixed(0) ?? 0}
              </div>
            </div>
            <div style={{ fontSize: 30, opacity: 0.3 }}>★</div>
          </div>

          {/* STEP: SELECT */}
          {step === 'select' && (
            <>
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
                onClick={handleProceedToPay}
                disabled={getAmount() < 1}
                style={{ width: '100%', padding: '13px', fontSize: 15 }}
              >
                Continue to Payment — ${getAmount()} USDT
              </button>
            </>
          )}

          {/* STEP: PAY */}
          {step === 'pay' && (
            <>
              <div style={{
                padding: '16px 18px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Amount due</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                    {getAmount()} USDT
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Network</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Tron (TRC20)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You receive</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                    ★ {getAmount()} Stars
                  </span>
                </div>

                <hr className="divider" style={{ margin: '0 0 14px' }} />

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Deposit Address (USDT-TRC20)
                </div>
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                }}>
                  {depositAddress}
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(240,96,96,0.08)',
                  border: '1px solid rgba(240,96,96,0.25)',
                  borderRadius: 8,
                  fontSize: 13, color: 'var(--error)',
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-secondary" onClick={() => setStep('select')} style={{ flex: 1 }}>
                  Back
                </button>
                <button
                  className="btn-primary"
                  onClick={handleConfirmPayment}
                  style={{ flex: 2, padding: '13px', fontSize: 15 }}
                >
                  I've Sent the Payment
                </button>
              </div>

              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                This is a demo. No real USDT is transferred — clicking "I've Sent" simulates a blockchain confirmation webhook that credits your Stars balance.
              </p>
            </>
          )}

          {/* STEP: PROCESSING */}
          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '40px 0 20px' }}>
              <div style={{
                width: 56, height: 56,
                border: '3px solid var(--accent-muted)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Awaiting blockchain confirmation
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Listening for USDT deposit on TRC20...
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>
                Order: {orderId?.slice(0, 8)}…
              </div>
            </div>
          )}

          {/* STEP: DONE */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '30px 0 10px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'rgba(62,207,142,0.12)',
                border: '2px solid var(--success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, color: 'var(--success)',
              }}>
                ✓
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                  ★ {getAmount()} Stars added
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Your new balance: ★ {profile?.stars_balance?.toFixed(0) ?? 0}
                </div>
              </div>
              {txHash && (
                <div style={{
                  padding: '8px 12px',
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: 'ui-monospace, monospace',
                  wordBreak: 'break-all',
                  maxWidth: '100%',
                }}>
                  Tx: {txHash.slice(0, 42)}…
                </div>
              )}
              <button className="btn-primary" onClick={handleClose} style={{ width: '100%', padding: '13px', fontSize: 15 }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }
