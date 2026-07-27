import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import type { Request } from '../lib/types'

type Step = 'form' | 'processing' | 'done'

interface Props {
  request: Request
  onClose: () => void
  onWithdrawn: () => void
}

export default function WithdrawModal({ request, onClose, onWithdrawn }: Props) {
  const { showToast } = useToast()

  const [walletAddress, setWalletAddress] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [payoutId, setPayoutId] = useState<string | null>(null)

  const gross = request.current_stars
  const fee = gross * 0.10
  const net = gross - fee

  const handleWithdraw = async () => {
    setError(null)
    if (!walletAddress.trim()) {
      setError('Please enter your USDT wallet address')
      return
    }
    if (walletAddress.trim().length < 20) {
      setError('That wallet address looks too short — please check it')
      return
    }

    setStep('processing')

    // 1. Create the payout request (validated server-side: ownership + funded status).
    const { data: newPayoutId, error: rpcErr } = await supabase.rpc('create_payout_request', {
      p_request_id: request.id,
      p_wallet_address: walletAddress.trim(),
    })

    if (rpcErr || !newPayoutId) {
      setError(rpcErr?.message ?? 'Failed to create payout request')
      setStep('form')
      return
    }

    setPayoutId(newPayoutId)

    // 2. Call the payout-webhook edge function to simulate the automated payout API call.
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payout-webhook`
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ payout_id: newPayoutId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Payout failed (${res.status})`)
      }
      setTxHash(json.tx_hash ?? null)
      setStep('done')
      showToast(`Payout completed: ${net.toFixed(2)} USDT sent to your wallet`, 'success')
      onWithdrawn()
    } catch (e) {
      setError((e as Error).message)
      setStep('form')
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box wide">
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {step === 'form' && 'Withdraw Funds'}
              {step === 'processing' && 'Processing Payout...'}
              {step === 'done' && 'Payout Completed'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              {step === 'form' && 'Receive your raised Stars as USDT'}
              {step === 'processing' && 'Automated payout API call in progress'}
              {step === 'done' && 'Funds have been sent to your wallet'}
            </p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', marginTop: -4 }}>✕</button>
          )}
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Request preview — always visible */}
          <div style={{
            display: 'flex', gap: 14, padding: '14px',
            background: 'var(--surface-raised)', borderRadius: 10,
            border: '1px solid var(--border)',
          }}>
            {request.image_url && (
              <img
                src={request.image_url}
                alt={request.title}
                style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                {request.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Status: <span style={{ color: 'var(--success)', fontWeight: 600 }}>Funded</span> · ★ {gross.toFixed(0)} raised
              </div>
            </div>
          </div>

          {/* Payout breakdown — always visible */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total raised (gross)</span>
              <span className="stars-badge" style={{ fontSize: 13 }}>★ {gross.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Platform fee (10%)</span>
              <span style={{ fontSize: 13, color: 'var(--error)' }}>− ★ {fee.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(62,207,142,0.08)', borderRadius: 8, border: '1px solid rgba(62,207,142,0.25)' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>You receive</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--success)' }}>{net.toFixed(2)} USDT</span>
            </div>
          </div>

          {/* STEP: FORM */}
          {step === 'form' && (
            <>
              <div>
                <label className="field-label">USDT Wallet Address (TRC20)</label>
                <input
                  className="field-input"
                  type="text"
                  placeholder="TYourWalletAddress..."
                  value={walletAddress}
                  onChange={e => setWalletAddress(e.target.value)}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
                />
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Enter the TRC20 address where you'd like to receive your USDT payout.
                </p>
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
                onClick={handleWithdraw}
                style={{ width: '100%', padding: '14px', fontSize: 15 }}
              >
                Withdraw {net.toFixed(2)} USDT
              </button>

              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                This is a demo. No real USDT is transferred — the payout API call is simulated and the request is marked as "Paid Out" automatically.
              </p>
            </>
          )}

          {/* STEP: PROCESSING */}
          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '30px 0 10px' }}>
              <div style={{
                width: 56, height: 56,
                border: '3px solid rgba(62,207,142,0.15)',
                borderTopColor: 'var(--success)',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Calling automated payout API
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Transferring {net.toFixed(2)} USDT to your wallet...
                </div>
              </div>
              {payoutId && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'ui-monospace, monospace' }}>
                  Payout: {payoutId.slice(0, 8)}…
                </div>
              )}
            </div>
          )}

          {/* STEP: DONE */}
          {step === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '24px 0 10px' }}>
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
                  {net.toFixed(2)} USDT sent
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Request marked as "Paid Out"
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
              <button className="btn-primary" onClick={onClose} style={{ width: '100%', padding: '13px', fontSize: 15 }}>
                Done
              </button>
            </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
