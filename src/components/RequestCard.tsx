import type { Request } from '../lib/types'

interface Props {
  request: Request
  onClick: () => void
}

export default function RequestCard({ request, onClick }: Props) {
  const pct = Math.min((request.current_stars / request.final_target) * 100, 100)
  const isFunded = request.status === 'funded'
  const remaining = Math.max(request.final_target - request.current_stars, 0)

  return (
    <div
      className="card"
      onClick={onClick}
      style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Image */}
      <div style={{
        width: '100%', paddingTop: '58%', position: 'relative',
        background: 'var(--surface-raised)', overflow: 'hidden',
        borderRadius: '14px 14px 0 0',
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
          }}>
            ★
          </div>
        )}
        {isFunded && (
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
            Funded
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 18px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: 15, fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {request.title}
          </h3>
          {request.description && (
            <p style={{
              margin: '5px 0 0', fontSize: 13, color: 'var(--text-muted)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {request.description}
            </p>
          )}
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: isFunded ? 'var(--success)' : 'var(--accent)' }}>
              ★ {request.current_stars.toFixed(0)} raised
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="progress-track">
            <div
              className={`progress-fill ${isFunded ? 'funded' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Goal: ★ {request.final_target.toFixed(0)}
            </span>
            {!isFunded && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                ★ {remaining.toFixed(0)} to go
              </span>
            )}
          </div>
        </div>

        {/* Creator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
              {(request.profile?.username?.[0] ?? 'U').toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {request.profile?.username ?? 'Anonymous'}
            </span>
          </div>
          <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }}>
            Donate ★
          </button>
        </div>
      </div>
    </div>
  )
}
