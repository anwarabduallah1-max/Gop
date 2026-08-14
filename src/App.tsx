import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { isSupabaseReady } from './lib/supabase'
import Navbar from './components/Navbar'
import ConfigWarning from './components/ConfigWarning'
import ExplorePage from './pages/ExplorePage'
import CreateRequestPage from './pages/CreateRequestPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import WalletPage from './pages/WalletPage'
import MyRequestsPage from './pages/MyRequestsPage'
import ReferralsPage from './pages/ReferralsPage'
import ProfilePage from './pages/ProfilePage'
import LeaderboardPage from './pages/LeaderboardPage'

export default function App() {
  if (!isSupabaseReady) {
    return (
      <>
        <ConfigWarning />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.3 }}>★</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>StarLift is not configured</h1>
          <p style={{ fontSize: 16, color: '#c4c9d4', maxWidth: 480, lineHeight: 1.6 }}>
            The app needs Supabase environment variables to function. Set
            <code style={{ background: '#1a1e26', padding: '2px 6px', borderRadius: 4, margin: '0 4px', fontSize: 14 }}>VITE_SUPABASE_URL</code>
            and
            <code style={{ background: '#1a1e26', padding: '2px 6px', borderRadius: 4, margin: '0 4px', fontSize: 14 }}>VITE_SUPABASE_ANON_KEY</code>
            in your environment, then redeploy.
          </p>
        </div>
      </>
    )
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Navbar />
          <Routes>
            <Route path="/" element={<ExplorePage />} />
            <Route path="/create" element={<CreateRequestPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/my-requests" element={<MyRequestsPage />} />
            <Route path="/referrals" element={<ReferralsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
