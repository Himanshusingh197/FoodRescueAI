import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { notificationAPI } from '../services/api'

const navByRole = {
  donor: [
    { label: 'Dashboard', path: '/donor' },
    { label: 'Create Donation', path: '/donor/create-donation' },
    { label: 'My Donations', path: '/donor/donations' },
    { label: 'Surplus Prediction', path: '/donor/predictions' },
    { label: 'Impact Analytics', path: '/donor/analytics' },
  ],
  recipient: [
    { label: 'Dashboard', path: '/recipient' },
    { label: 'Discover Food', path: '/recipient/discover' },
    { label: 'My Pickups', path: '/pickups' },
    { label: 'Impact Analytics', path: '/recipient/analytics' },
  ],
  admin: [
    { label: 'Admin Dashboard', path: '/admin' },
  ],
}

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (user) {
      notificationAPI.list({ unread_only: true, per_page: 1 })
        .then(r => setUnread(r.data.unread_count || 0))
        .catch(() => {})
    }
  }, [user, location.pathname])

  const links = user ? (navByRole[user.role] || []) : []

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl">🌿</span>
              <span className="font-bold text-green-700 text-lg">Food Rescue AI</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {links.map(l => (
                <Link
                  key={l.path}
                  to={l.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === l.path
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {l.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications bell */}
              <Link to="/notifications" className="relative p-2 text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unread > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-semibold">
                    {user?.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {user?.full_name?.split(' ')[0]}
                  </span>
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    <Link to="/profile" className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl"
                      onClick={() => setMenuOpen(false)}>
                      Profile & Settings
                    </Link>
                    <button onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-b-xl">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile hamburger */}
              <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {menuOpen && (
            <div className="md:hidden pb-3 border-t border-gray-100 pt-2">
              {links.map(l => (
                <Link key={l.path} to={l.path}
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md"
                  onClick={() => setMenuOpen(false)}>
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm text-gray-500">
        © 2026 Food Rescue AI — Reducing Food Waste, One Meal at a Time
      </footer>
    </div>
  )
}
