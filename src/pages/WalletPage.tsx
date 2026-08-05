import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { PaymentOrder } from '../lib/types'
import WalletModal from '../components/WalletModal'

export default function WalletPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { showToast } = useToast()
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setOrders(data as PaymentOrder[])
    } catch (err) {
      console.error('Fetch orders error:', err)
    }
  }, [user])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Realtime: listen for changes to payment_orders so pending orders
  // update automatically when the webhook credits stars.
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('payment-orders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_orders', filter: `user_id=eq.${user.id}` },
        () => {
          fetchOrders()
          refreshProfile()
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, fetchOrders, refreshProfile])

  const handleWalletModalClose = async () => {
    setWalletModalOpen(false)
    await fetchOrders()
    await refreshProfile()
  }

  const pendingCount = orders.filter(o => o.status === 'pending').length

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container" style={{ maxWidth: 600 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>Wallet</h1>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: 'var(--text-secondary)' }}>
          Buy Stars to donate to campaigns. 1 Star = 1 USDT. Payments are processed securely via Plisio crypto gateway.
        </p>

        <div className="card" style={{ padding: 28, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Your Balance</span>
            <span style={{ fontSize: 32, fontWeight: 900, color: 'var(--accent)' }}>★ {profile?.stars_balance?.toFixed(0) ?? 0}</span>
          </div>

          <button
            className="btn-primary"
            onClick={() => setWalletModalOpen(true)}
            style={{ width: '100%', padding: '14px', fontSize: 15 }}
          >
            Buy Stars
          </button>

          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            You'll be redirected to a Plisio crypto invoice to complete your purchase.
            Stars are credited automatically once payment is confirmed on the blockchain.
          </p>
        </div>

        {orders.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Recent Orders</h2>
              {pendingCount > 0 && (
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  color: 'var(--accent)', background: 'var(--accent-muted)',
                }}>
                  {pendingCount} pending
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orders.map(o => (
                <div key={o.id} className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>★ {o.stars_amount} · ${o.usdt_amount}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(o.created_at).toLocaleDateString()}
                      {o.plisio_currency && ` · ${o.plisio_currency}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {o.status === 'pending' && o.plisio_invoice_url && (
                      <a
                        href={o.plisio_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                          textDecoration: 'none', whiteSpace: 'nowrap',
                        }}
                      >
                        Pay ↗
                      </a>
                    )}
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                      color: o.status === 'confirmed' ? 'var(--success)' : o.status === 'failed' ? 'var(--error)' : 'var(--accent)',
                      background: o.status === 'confirmed' ? 'rgba(62,207,142,0.1)' : o.status === 'failed' ? 'rgba(240,96,96,0.1)' : 'var(--accent-muted)',
                    }}>
                      {o.status === 'pending' ? 'Pending Payment' : o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {walletModalOpen && <WalletModal onClose={handleWalletModalClose} />}
    </div>
  )
}
