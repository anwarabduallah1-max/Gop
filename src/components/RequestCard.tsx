import type { Request } from '../lib/types'

interface Props {
  request: Request
  onClick: () => void
}

export default function RequestCard({ request, onClick }: Props) {
  const pct = request.is_unlimited ? 0 : Math.min((request.current_stars / request.final_target) * 100, 100)
  const isFunded = request.status === 'funded'
  const isPaidOut = request.status === 'paid_out'
  const isPlatform = request.is_platform_post
  const remaining = Math.max(request.final_target - request.current_stars, 0)

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        ...(isPlatform ? {
          borderColor: 'rgba(245,200,66,0.35)',
          boxShadow: '0 0 0 1px rgba(245,200,66,0.2), 0 4px 24px rgba(245,200,66,0.08)',
        } : {}),
      }}
    >
      {isPlatform && (
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, var(--accent), var(--accent-hover), var(--accent))',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2.5s linear infinite',
        }} />
      )}

      <div style={{
        width: '100%', paddingTop: '58%', position: 'relative',
        background: 'var(--surface-raised)', overflow: 'hidden',
        borderRadius: isPlatform ? '0' : '14px 14px 0 0',
      }}>
        {request.image_url ? (
          <img
            src={request.image_url}
            alt={request.title}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.35s ease',
            }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = 'scale(1.04)' }}
            onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = 'scale(1)' }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 32,
          }}>★</div>
        )}

        {isPlatform && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'linear-gradient(135deg, #f5c842, #f7d265)',
            color: '#0d0f14',
            fontSize: 10, fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 999,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: '0 2px 12px rgba(245,200,66,0.4)',
          }}>
            <span style={{ fontSize: 11 }}>★</span> Official Campaign
          </div>
        )}

        {(isFunded || isPaidOut) && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(62,207,142,0.15)',
            border: '1px solid rgba(62,207,142,0.4)',
            color: 'var(--success)',
            fontSize: 11, fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 999,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {isPaidOut ? 'Paid Out' : 'Funded'}
          </div>
        )}
      </div>

      <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          {isPlatform && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10, fontWeight: 700,
              color: 'var(--accent)',
              background: 'var(--accent-muted)',
              border: '1px solid rgba(245,200,66,0.2)',
              borderRadius: 999,
              padding: '2px 8px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Platform Post · Support Required
            </div>
          )}
          <h3 style={{
            margin: 0, fontSize: 15, fontWeight: 700,
            color: isPlatform ? 'var(--accent)' : 'var(--text-primary)',
            lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {request.title}
          </h3>
          {request.description && (
            <p style={{
              margin: '5px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {request.description}
            </p>
          )}
        </div>

        {request.is_unlimited ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
              ★ {request.current_stars.toFixed(0)} raised
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              background: 'var(--accent-muted)', border: '1px solid rgba(245,200,66,0.3)',
              padding: '2px 8px', borderRadius: 999, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>Unlimited</span>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: isFunded ? 'var(--success)' : 'var(--accent)' }}>
                ★ {request.current_stars.toFixed(0)} raised
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pct.toFixed(0)}%</span>
            </div>
            <div className="progress-track">
              <div className={`progress-fill ${isFunded ? 'funded' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Goal: ★ {request.final_target.toFixed(0)}</span>
              {!isFunded && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>★ {remaining.toFixed(0)} to go</span>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isPlatform ? (
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: '#0d0f14', fontWeight: 900,
              }}>★</div>
            ) : (
              <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
                {(request.profile?.username?.[0] ?? 'U').toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 12, color: isPlatform ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isPlatform ? 700 : 400 }}>
              {isPlatform ? 'StarLift Platform' : (request.profile?.username ?? 'Anonymous')}
            </span>
          </div>
          {!isPaidOut && (
            <span className="btn-primary" style={{ padding: '6px 14px', fontSize: 12, pointerEvents: 'none' }}>
              {isPlatform ? '★ Support' : 'Donate ★'}
            </span>
          )}
        </div>
      </div>

      <style>{`@keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }`}</style>
    </div>
  )
}
