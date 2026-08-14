import GlobalLeaderboard from '../components/GlobalLeaderboard'

export default function LeaderboardPage() {
  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container">
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Community</div>
          <h1 style={{ margin: '6px 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>World Leaderboard</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
            See which countries are leading the charge and meet the top supporters from each nation.
          </p>
        </div>
      </div>
      <GlobalLeaderboard />
    </div>
  )
}
