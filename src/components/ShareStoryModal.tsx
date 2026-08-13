import { useMemo } from 'react'
import { useToast } from '../context/ToastContext'
import type { Request } from '../lib/types'

interface Props {
  request: Request
  referralCode?: string | null
  onClose: () => void
}

export default function ShareStoryModal({ request, referralCode, onClose }: Props) {
  const { showToast } = useToast()
  const link = useMemo(() => {
    const params = new URLSearchParams({ post: request.id })
    if (referralCode) params.set('ref', referralCode)
    return `${window.location.origin}/?${params.toString()}`
  }, [request.id, referralCode])
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      showToast('Story link copied!', 'success')
    } catch (error) {
      console.error('Share link copy error:', error)
      showToast('Could not copy the link.', 'error')
    }
  }

  return (
    <div className="modal-backdrop" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Ready to share</div>
              <h2 style={{ margin: '5px 0 4px', fontSize: 22, fontWeight: 900 }}>Put this campaign in your story</h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>Invite your friends and help {request.title} reach its goal.</p>
            </div>
            <button className="btn-ghost" onClick={onClose} style={{ padding: '4px 10px', fontSize: 18 }}>✕</button>
          </div>

          <div style={{ background: 'linear-gradient(145deg, #282817, #161922 55%, #0d0f14)', border: '1px solid rgba(245,200,66,0.35)', borderRadius: 18, padding: 20, minHeight: 290, display: 'flex', gap: 18, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>StarLift campaign</div>
              <h3 style={{ margin: '0 0 10px', fontSize: 24, lineHeight: 1.1, fontWeight: 900 }}>{request.title}</h3>
              <p style={{ margin: '0 0 18px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{request.description || 'Support this campaign with Stars.'}</p>
              <div style={{ display: 'inline-flex', padding: '8px 12px', borderRadius: 9, background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 800, fontSize: 13 }}>★ {request.current_stars.toFixed(0)} raised · Goal ★ {request.final_target.toFixed(0)}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: 8, flexShrink: 0 }}>
              <img src={qrUrl} alt="QR code for this campaign" width={150} height={150} style={{ display: 'block' }} />
            </div>
          </div>

          <div style={{ marginTop: 18, padding: '11px 13px', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</div>
          <button className="btn-primary" onClick={copyLink} style={{ width: '100%', marginTop: 12, padding: 13 }}>Copy Story Link</button>
        </div>
      </div>
    </div>
  )
}
