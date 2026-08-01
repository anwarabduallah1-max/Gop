import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Navbar from './components/Navbar'
import ExplorePage from './pages/ExplorePage'
import CreateRequestPage from './pages/CreateRequestPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import WalletPage from './pages/WalletPage'
import MyRequestsPage from './pages/MyRequestsPage'

export default function App() {
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
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
