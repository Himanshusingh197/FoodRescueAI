import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/authStore'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import OrgOnboarding from './pages/OrgOnboarding'
import DonorDashboard from './pages/DonorDashboard'
import CreateDonation from './pages/CreateDonation'
import ManageDonations from './pages/ManageDonations'
import RecipientDashboard from './pages/RecipientDashboard'
import DiscoverDonations from './pages/DiscoverDonations'
import DonationDetail from './pages/DonationDetail'
import PickupCoordination from './pages/PickupCoordination'
import Notifications from './pages/Notifications'
import ImpactAnalytics from './pages/ImpactAnalytics'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import SurplusPrediction from './pages/SurplusPrediction'

// Layout
import DashboardLayout from './layouts/DashboardLayout'

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { fetchMe, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) fetchMe()
  }, [])

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected — all roles */}
        <Route path="/onboarding" element={
          <ProtectedRoute><OrgOnboarding /></ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute>
            <DashboardLayout><Notifications /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <DashboardLayout><Profile /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Donor routes */}
        <Route path="/donor" element={
          <ProtectedRoute roles={['donor']}>
            <DashboardLayout><DonorDashboard /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/donor/create-donation" element={
          <ProtectedRoute roles={['donor']}>
            <DashboardLayout><CreateDonation /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/donor/donations" element={
          <ProtectedRoute roles={['donor']}>
            <DashboardLayout><ManageDonations /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/donor/predictions" element={
          <ProtectedRoute roles={['donor']}>
            <DashboardLayout><SurplusPrediction /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/donor/analytics" element={
          <ProtectedRoute roles={['donor']}>
            <DashboardLayout><ImpactAnalytics /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Recipient routes */}
        <Route path="/recipient" element={
          <ProtectedRoute roles={['recipient']}>
            <DashboardLayout><RecipientDashboard /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/recipient/discover" element={
          <ProtectedRoute roles={['recipient']}>
            <DashboardLayout><DiscoverDonations /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/recipient/analytics" element={
          <ProtectedRoute roles={['recipient']}>
            <DashboardLayout><ImpactAnalytics /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Shared donation detail */}
        <Route path="/donations/:id" element={
          <ProtectedRoute>
            <DashboardLayout><DonationDetail /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Pickup */}
        <Route path="/pickups/:id" element={
          <ProtectedRoute>
            <DashboardLayout><PickupCoordination /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/pickups" element={
          <ProtectedRoute>
            <DashboardLayout><PickupCoordination /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout><AdminDashboard /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
