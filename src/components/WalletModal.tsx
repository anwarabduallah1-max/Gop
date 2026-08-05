import { useState, useEffect, useRef, useCallback } from 'react'
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

export default function WalletModal({ onClose }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()

  const [selected, setSelected] = useState<number | null>(50)
  const [custom, setCustom] = useState('')
  const [step, setStep] = useState<Step>('select')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [checking, setChecking] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const getAmount = (): number => {
    if (custom.trim() !== '') {
      const n = Number(custom)
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
    }
    return selected ?? 0
  }

  const callStatusCheck = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('payment_orders')
        .select('status')
        .eq('id', id)
        .maybeSingle()

      if (data && data.status === 'completed') {
        await refreshProfile()
        setStep('done')
        return true
      }
      return false
    } catch {
      return false
    }
  }, [refreshProfile])

  useEffect(() => {
    if (step !== 'processing' || !orderId) return

    const poll = async () => {
      const confirmed = await callStatusCheck(orderId)
      if (confirmed && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    poll()
    pollRef.current = setInterval(poll, 5000)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [step, orderId, callStatusCheck])

  const handleProceedToPay = async () => {
    const amt = getAmount()
    if (!Number.isFinite(amt) || amt < 1) {
      setError('Please enter a valid amount')
      return
    }
    setError(null)
    setCreating(true)

    try {
      const apiKey = import.meta.env.VITE_PLISIO_API_KEY || import.meta.env.PLISIO_API_KEY

      if (!apiKey) {
        throw new Error('Plisio API Key is missing in Vercel Environment Variables!')
      }

      const generatedOrderId = crypto.randomUUID()

      await supabase.from('payment_orders').insert({
        id: generatedOrderId,
        usdt_amount: amt,
        stars_amount: amt,
        status: 'pending',
      })

      setOrderId(generatedOrderId)

      const plisioUrl = `https://plisio.net/api/v1/invoices/new?api_key=${apiKey}&currency=USDT_BSC&source_currency=USD&source_amount=${amt}&order_number=${generatedOrderId}&order_name=Stars_Purchase`

      const res = await fetch(plisioUrl)
      const json = await res.json()

      if (json.status !== 'success' || !json.data?.invoice_url) {
        throw new Error(json.data?.message ?? 'Failed to create payment invoice')
      }

      setInvoiceUrl(json.data.invoice_url)
      setStep('pay')

      if (json.data.invoice_url) {
        window.open(json.data.invoice_url, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleIHavePaid = () => {
    setStep('processing')
  }

  const handleCheckNow = async () => {
    if (!orderId || checking) return
    setChecking(true)
    await callStatusCheck(orderId)
    setChecking(false)
  }

  const handleClose = () => {
    if (step === 'done') showToast(`★ ${getAmount()} Stars added to your wallet!`, 'success')
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal-box">
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {step === 'select' && 'Wallet & Stars'}
              {step === 'pay' && 'Pay with Crypto'}
              {step === 'processing' && 'Confirming Payment...'}
              {step === 'done' && 'Payment Confirmed'}
            </h2>
          </div>
          {step !== 'processing' && (
            <button onClick={handleClose} className="btn-ghost" style={{ padding: '6px', marginTop: -4 }}>✕</button>
          )}
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', background: 'var(--accent-muted)',
            border: '1px solid rgba(245,200,66,0.2)', borderRadius: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>CURRENT BALANCE</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>
                ★ {profile?.stars_balance?.toFixed(0) ?? 0}
              </div>
            </div>
            <div style={{ fontSize: 30, opacity: 0.3 }}>★</div>
          </div>

          {step === 'select' && (
            <>
              <div>
                <div className="field-label" style={{ marginBottom: 8 }}>Buy Stars</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {PACKAGES.map(pkg => (
                    <button
                      key={pkg.stars}
                      onClick={() => { setSelected(pkg.stars); setCustom('') }}
                      style={{
                        background: selected === pkg.stars && custom === '' ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        border: selected === pkg.stars && custom === '' ? '1px solid rgba(245,200,66,0.5)' : '1px solid var(--border)',
                        borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>★ {pkg.stars}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>${pkg.price} USDT</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: '#ef4444' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleProceedToPay}
                disabled={creating || getAmount() < 1}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 800 }}
              >
                {creating ? 'Creating Payment...' : `Continue to Payment — $${getAmount()} USDT`}
              </button>
            </>
          )}

          {step === 'pay' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Complete payment on the Plisio page, then click below.
              </p>
              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '12px', borderRadius: 8, textDecoration: 'none' }}>
                  Open Payment Page ↗
                </a>
              )}
              <button onClick={handleIHavePaid} className="btn-primary" style={{ width: '100%', padding: '14px' }}>
                I Have Completed Payment
              </button>
            </div>
          )}

          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <h3>Checking Status...</h3>
              <button onClick={handleCheckNow} disabled={checking} className="btn-secondary" style={{ width: '100%', padding: '12px', marginTop: 16 }}>
                {checking ? 'Checking...' : 'Check Status Now'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
              <h3>Success!</h3>
              <button onClick={handleClose} className="btn-primary" style={{ width: '100%', padding: '14px', marginTop: 16 }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
