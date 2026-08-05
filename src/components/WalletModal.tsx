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

type CurrencyCode = 'USDT_BSC' | 'USDT_TRX' | 'LTC'

const CURRENCIES: { code: CurrencyCode; label: string; network: string; badge?: string }[] = [
  { code: 'USDT_BSC', label: 'USDT (BEP-20)', network: 'BSC / BNB Chain', badge: 'Recommended · Low Fees' },
  { code: 'USDT_TRX', label: 'USDT (TRC-20)', network: 'Tron' },
  { code: 'LTC', label: 'Litecoin', network: 'Litecoin' },
]

interface Props {
  onClose: () => void
}

export default function WalletModal({ onClose }: Props) {
  const { profile, refreshProfile } = useAuth()
  const { showToast } = useToast()

  const [selected, setSelected] = useState<number | null>(50)
  const [custom, setCustom] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('USDT_BSC')
  const [step, setStep] = useState<Step>('select')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [invoiceCurrency, setInvoiceCurrency] = useState<CurrencyCode>('USDT_BSC')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [checking, setChecking] = useState(false)
  const [plisioStatus, setPlisioStatus] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const getAmount = (): number => {
    if (custom.trim() !== '') {
      const n = Number(custom)
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
    }
    return selected ?? 0
  }

  const callStatusCheck = useCallback(async (id: string): Promise<boolean> => {
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plisio-check-invoice-status`
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ order_id: id }),
      })
      const json = await res.json()

      if (json.success && json.status === 'confirmed') {
        setTxHash(json.tx_hash ?? null)
        await refreshProfile()
        setStep('done')
        return true
      }

      if (json.plisio_status) {
        setPlisioStatus(json.plisio_status)
      }
      return false
    } catch {
      return false
    }
  }, [refreshProfile])

  // Poll the Plisio API directly via edge function every 5 seconds.
  useEffect(() => {
    if (step !== 'processing' || !orderId) return

    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      const confirmed = await callStatusCheck(orderId)
      if (confirmed && pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    poll()
    pollRef.current = setInterval(poll, 5000)
    return () => {
      cancelled = true
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
        setCreating(false)
        return
      }

      setOrderId(order.id)

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plisio-create-invoice`
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ amount: amt, order_id: order.id, currency }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Failed to create Plisio invoice (${res.status})`)
      }

      setInvoiceUrl(json.invoice_url)
      setInvoiceCurrency(currency)
      setQrCode(json.qr_code)
      setStep('pay')

      if (json.invoice_url) {
        window.open(json.invoice_url, '_blank', 'noopener,noreferrer')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleIHavePaid = () => {
    setPlisioStatus(null)
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
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {step === 'select' && 'Wallet & Stars'}
              {step === 'pay' && 'Pay with USDT'}
              {step === 'processing' && 'Confirming Payment...'}
              {step === 'done' && 'Payment Confirmed'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              {step === 'select' && '1 Star = 1 USDT · Powered by Plisio'}
              {step === 'pay' && 'A Plisio payment page opened in a new tab — complete the crypto transaction there'}
              {step === 'processing' && 'Polling Plisio API for confirmation'}
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
                <div className="field-label">Currency</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {CURRENCIES.map(c => (
                    <button
                      key={c.code}
                      onClick={() => setCurrency(c.code)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: currency === c.code ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        border: currency === c.code ? '1px solid rgba(245,200,66,0.5)' : '1px solid var(--border)',
                        borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                        fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.network}</div>
                      </div>
                      {c.badge && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {c.badge}
                        </span>
                      )}
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

              <button
                className="btn-primary"
                onClick={handleProceedToPay}
                disabled={getAmount() < 1 || creating}
                style={{ width: '100%', padding: '13px', fontSize: 15 }}
              >
                {creating ? 'Creating Invoice...' : `Continue to Payment — $${getAmount()} USDT`}
              </button>
            </>
          )}

          {/* STEP: PAY — Plisio invoice with QR code */}
          {step === 'pay' && (
            <>
              <div style={{
                padding: '20px',
                background: 'var(--surface-raised)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                textAlign: 'center',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, textAlign: 'left' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Amount due</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                    {getAmount()} USDT
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, textAlign: 'left' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Network</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {CURRENCIES.find(c => c.code === invoiceCurrency)?.label ?? invoiceCurrency} · {CURRENCIES.find(c => c.code === invoiceCurrency)?.network ?? ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, textAlign: 'left' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You receive</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                    ★ {getAmount()} Stars
                  </span>
                </div>

                <hr className="divider" style={{ margin: '0 0 16px' }} />

                {qrCode && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      padding: 12, background: '#fff', borderRadius: 10,
                      border: '1px solid var(--border)',
                    }}>
                      <img
                        src={qrCode}
                        alt="Payment QR Code"
                        style={{ width: 180, height: 180, display: 'block' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Scan with any crypto wallet app
                    </div>
                  </div>
                )}

                {invoiceUrl && (
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ display: 'inline-block', padding: '10px 20px', fontSize: 13, textDecoration: 'none', marginBottom: 4 }}
                  >
                    Open Plisio Payment Page ↗
                  </a>
                )}
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
                <button className="btn-secondary" onClick={() => { setStep('select'); setInvoiceUrl(null); setQrCode(null) }} style={{ flex: 1 }}>
                  Back
                </button>
                <button
                  className="btn-primary"
                  onClick={handleIHavePaid}
                  style={{ flex: 2, padding: '13px', fontSize: 15 }}
                >
                  I've Paid — Check Status
                </button>
              </div>

              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                A Plisio payment page opened in a new tab. Complete the crypto transaction there, then click "I've Paid" below. Your Stars are credited automatically once the blockchain confirms.
              </p>
            </>
          )}

          {/* STEP: PROCESSING */}
          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '30px 0 20px' }}>
              <div style={{
                width: 56, height: 56,
                border: '3px solid var(--accent-muted)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Waiting for Plisio confirmation
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {plisioStatus
                    ? `Plisio status: ${plisioStatus} — checking again in 5s...`
                    : 'Polling Plisio API every 5 seconds for blockchain confirmation...'}
                </div>
              </div>
              {invoiceUrl && (
                <a
                  href={invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}
                >
                  View Plisio Invoice ↗
                </a>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>
                Order: {orderId?.slice(0, 8)}…
              </div>

              <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
                <button
                  className="btn-secondary"
                  onClick={handleCheckNow}
                  disabled={checking}
                  style={{ flex: 1, padding: '10px', fontSize: 13 }}
                >
                  {checking ? 'Checking...' : 'Check Status Now'}
                </button>
              </div>
            </div>
          )}

          {/* STEP: DONE */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '30px 0 10px' }}>
              <div style={{
 