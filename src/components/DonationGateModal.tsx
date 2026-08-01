import { useNavigate } from 'react-router-dom'
import type { Request } from '../lib/types'
import { MANDATORY_MIN_DONATION } from '../lib/config'

interface Props {
  mandatoryRequest: Request
  onClose: () => void
}

export default function DonationGateModal({ mandatoryRequest, onClose }: Props) {
  const navigate = useNavigate()

  const goDonate = () => {
    onClose()
    navigate(`/?focus=${mandatoryRequest.id}`)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--accent-muted)',
            border: '1px solid rgba(245,200,66,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', fontSize: 26,
          }}>
            ★
          </div>

          <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            Support Required First
          </h2>

          <p style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            You must support the Featured Platform Campaign with a minimum of{' '}
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>${MANDATORY_MIN_DONATION}</span>{' '}
            before publishing your own campaign.
          </p>
          <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            This keeps StarLift a giving community — everyone who asks for help has helped someone first.
          </p>

          {mandatoryRequest.image_url && (
            <img
              src={mandatoryRequest.image_url}
              alt={mandatoryRequest.title}
              style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginBottom: 18, border: '1px solid var(--border)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}

          <div style={{
            padding: '14px', background: 'var(--surface-raised)',
            borderRadius: 10, border: '1px solid var(--border)', marginBottom: 22, textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#0d0f14',
                background: 'linear-gradient(135deg, #f5c842, #f7d265)',
                padding: '2px 8px', borderRadius: 999,
                letterSpacing: '0.07em', textTransform: 'uppercase',
              }}>
                ★ Official Campaign
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
              {mandatoryRequest.title}
            </div>
            {mandatoryRequest.is_unlimited ? (
              <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>
                ★ {mandatoryRequest.current_stars.toFixed(0)} raised · Unlimited goal
              </div>
            ) : (
              <>
                <div className="progress-track" style={{ marginBottom: 5 }}>
                  <div className="progress-fill" style={{ width: `${Math.min((mandatoryRequest.current_stars / mandatoryRequest.final_target) * 100, 100)}%` }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  ★ {mandatoryRequest.current_stars.toFixed(0)} / ★ {mandatoryRequest.final_target.toFixed(0)}
                </div>
              </>
            )}
            {mandatoryRequest.product_url && (
              <a
                href={mandatoryRequest.product_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: 10, fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}
              >
                View post ↗
              </a>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={onClose} style={{ flex: 1, padding: '12px', fontSize: 14 }}>
              Maybe Later
            </button>
            <button className="btn-primary" onClick={goDonate} style={{ flex: 1, padding: '12px', fontSize: 14 }}>
              Donate Now →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
