import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

type Step = 'form' | 'processing' | 'done'

interface Props {
  balance: number
  onClose: () => void
  onWithdrawn: () => void
}

export default function WithdrawBalanceModal({ balance, onClose, onWithdrawn }: Props) {
  const { showToast } = useToast()

  const [amount, setAmount] = useState<string>(balance > 0 ? String(balance) : '')
  const [walletAddress, setWalletAddress] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [plisioTxnId, setPlisioTxnId] = useState<string | null>(null)

  const parsedAmount = Number(amount)
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0
  const fee = validAmount ? parsedAmount * 0.10 : 0
  const net = validAmount ? parsedAmount - fee : 0
  const exceedsBalance = validAmount && parsedAmount > balance

  const handleWithdraw = async () => {
    setError(null)

    if (!validAmount) {
      setError('Please enter a valid amount of Stars to withdraw')
      return
    }
    if (exceedsBalance) {
      setError(`You only have ${balance} Stars available`)
      return
    }
    if (!walletAddress.trim()) {
      setError('Please enter your USDT wallet address')
      return
    }
    if (walletAddress.trim().length < 20) {
      setError('That wallet address looks too short — please check it')
      return
    }

    setStep('processing')

    // 1. Create the withdrawal (validates balance + deducts Stars server-side).
    const { data: withdrawalId, error: rpcErr } = await supabase.rpc('create_withdrawal', {
      p_stars_amount: parsedAmount,
      p_wallet_address: walletAddress.trim(),
    })

    if (rpcErr || !withdrawalId) {
      setError(rpcErr?.message ?? 'Failed to create withdrawal')
      setStep('form')
      return
    }

    // 2. Call the plisio-withdraw edge function to execute the real Plisio API call.
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plisio-withdraw`
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ withdrawal_id: withdrawalId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Withdrawal failed (${res.status})`)
      }
      setPlisioTxnId(json.plisio_txn_id ?? null)
      setStep('done')
      showToast(`Instant payout completed: ${net.toFixed(2)} USDT sent to your wallet`, 'success')
      onWithdrawn()
    } catch (e) {
      setError((e as Error).message)
      setStep('form')
    }
  }

  const quickAmounts = [balance, Math.floor(balance / 2), Math.floor(balance / 4)].filter(
    (n, i, arr) => n > 0 && arr.indexOf(n) === i,
  )

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box wide">
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
              {step === 'form' && 'Instant Payout'}
              {step === 'processing' && 'Processing Payout...'}
              {step === 'done' && 'Payout Completed'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-muted)' }}>
              {step === 'form' && 'Withdraw your Stars balance as USDT — anytime'}
              {step === 'processing' && 'Automated payout API call in progress'}
              {step === 'done' && 'Funds have been sent to your wallet'}
            </p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="btn-ghost" style={{ padding: '6px', marginTop: -4 }}>✕</button>
          )}
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Balance display */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px', background: 'var(--surface-raised)',
            borderRadius: 10, border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Available Balance</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent)' }}>★ {balance.toFixed(0)}</span>
          </div>

          {/* Payout breakdown */}
          {validAmount && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Stars to withdraw</span>
                <span className="stars-badge" style={{ fontSize: 13 }}>★ {parsedAmount.toFixed(2)}</span>
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
          )}

          {/* STEP: FORM */}
          {step === 'form' && (
            <>
              {/* Amount input */}
              <div>
                <label className="field-label">Stars Amount</label>
                <input
                  className="field-input"
                  type="number"
                  min="1"
                  max={balance}
                  placeholder="Enter Stars to withdraw"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{ fontSize: 15 }}
                />
                {quickAmounts.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {quickAmounts.map(qa => (
                      <button
                        key={qa}
                        onClick={() => setAmount(String(qa))}
                        style={{
                          padding: '6px 14px', fontSize: 12, fontWeight: 600,
                          background: 'var(--surface-raised)', border: '1px solid var(--border)',
                          borderRadius: 999, color: 'var(--text-secondary)', cursor: 'pointer',
                        }}
                      >
                        ★ {qa}
                      </button>
                    ))}
                    <button
                      onClick={() => setAmount('')}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        background: 'var(--surface-raised)', border: '1px solid var(--border)',
                        borderRadius: 999, color: 'var(--text-secondary)', cursor: 'pointer',
                      }}
                    >
                      Custom
                    </button>
                  </div>
                )}
              </div>

              {/* Wallet input */}
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
                disabled={!validAmount || exceedsBalance}
                style={{
                  width: '100%', padding: '14px', fontSize: 15,
                  opacity: (!validAmount || exceedsBalance) ? 0.5 : 1,
                  cursor: (!validAmount || exceedsBalance) ? 'not-allowed' : 'pointer',
                }}
              >
                {validAmount ? `Withdraw ${net.toFixed(2)} USDT` : 'Enter an amount'}
              </button>

              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                Powered by Plisio. Your USDT is sent instantly via the Plisio Cashout API to your TRC20 wallet address.
                You can withdraw any amount, at any time — no need to wait for a campaign to finish.
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
                  Calling Plisio payout API
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Transferring {net.toFixed(2)} USDT to your wallet via Plisio...
                </div>
              </div>
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
                  Instant payout completed successfully
                </div>
              </div>
              {plisioTxnId && (
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
                  Plisio Tx: {plisioTxnId.slice(0, 42)}…
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
