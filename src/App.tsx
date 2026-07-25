import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Header from './components/Header'
import ExplorePage from './pages/ExplorePage'
import CreateRequestPage from './pages/CreateRequestPage'
import MyRequestsPage from './pages/MyRequestsPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Header />
          <Routes>
            <Route path="/" element={<ExplorePage />} />
            <Route path="/create" element={<CreateRequestPage />} />
            <Route path="/my-requests" element={<MyRequestsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
