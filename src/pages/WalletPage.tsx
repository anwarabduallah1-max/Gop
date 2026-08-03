import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { PaymentOrder } from '../lib/types'

const PRESET_AMOUNTS = [10, 25, 50, 100]

export default function WalletPage() {
  const { user, profile } = useAuth()
  const { showToast } = useToast()
  const [amount, setAmount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<PaymentOrder[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.from('payment_orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
        if (!cancelled) setOrders((data ?? []) as PaymentOrder[])
      } catch (err) {
        console.error('Fetch orders error:', err)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  const handleBuy = async () => {
    if (!user || amount <= 0) return
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('buy_stars', { amount })
      setLoading(false)
      if (error) { showToast(error.message, 'error'); return }
      if (data) {
        showToast(`Order created for ★ ${amount}. Confirm your payment to receive Stars.`, 'info')
        const { data: updated } = await supabase.from('payment_orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
        if (updated) setOrders(updated as PaymentOrder[])
      }
    } catch (err) {
      console.error('Buy stars error:', err)
      setLoading(false)
      showToast('Failed to create order. Please try again.', 'error')
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container" style={{ maxWidth: 600 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>Wallet</h1>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: 'var(--text-secondary)' }}>Buy Stars to donate to campaigns. 1 Star = 1 USDT.</p>

        <div className="card" style={{ padding: 28, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Your Balance</span>
            <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)' }}>★ {profile?.stars_balance?.toFixed(0) ?? 0}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Choose amount to buy:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {PRESET_AMOUNTS.map(a => (
              <button key={a} className={`chip ${amount === a ? 'active' : ''}`} onClick={() => setAmount(a)} style={{ minWidth: 64 }}>★ {a}</button>
            ))}
          </div>
          <input className="field-input" type="number" value={amount} onChange={e => setAmount(Math.max(0, parseFloat(e.target.value) || 0))} min={1} placeholder="Custom amount" />
          <button className="btn-primary" onClick={handleBuy} disabled={loading || amount <= 0} style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 16 }}>
            {loading ? 'Processing...' : `Buy ★ ${amount} for $${amount}`}
          </button>
        </div>

        {orders.length > 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Recent Orders</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(o => (
                <div key={o.id} className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>★ {o.stars_amount} · ${o.usdt_amount}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                    color: o.status === 'confirmed' ? 'var(--success)' : o.status === 'failed' ? 'var(--error)' : 'var(--text-muted)',
                    background: o.status === 'confirmed' ? 'rgba(62,207,142,0.1)' : o.status === 'failed' ? 'rgba(240,96,96,0.1)' : 'var(--surface-raised)',
                  }}>{o.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
