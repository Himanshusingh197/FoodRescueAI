import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsAPI, orgAPI, pickupAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { getStatusColor, formatDate, extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

function StatCard({ label, value, icon, sub }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs text-gray-400">{sub}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  )
}

export default function RecipientDashboard() {
  const { user } = useAuthStore()
  const [org, setOrg] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [recentPickups, setRecentPickups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const orgRes = await orgAPI.getMyOrg()
        setOrg(orgRes.data.data)
        if (orgRes.data.data?.verification_status === 'verified') {
          const [analyticsRes, pickupsRes] = await Promise.all([
            analyticsAPI.recipient(30),
            pickupAPI.list({ per_page: 5 }),
          ])
          setAnalytics(analyticsRes.data.data)
          setRecentPickups(pickupsRes.data.data)
        }
      } catch (err) {
        toast.error(extractError(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
    </div>
  )

  if (!org) return (
    <div className="max-w-lg mx-auto mt-12 text-center">
      <div className="text-5xl mb-4">🤝</div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Set Up Your Organization</h2>
      <p className="text-gray-600 mb-6">Register your NGO or shelter to start receiving food donations.</p>
      <Link to="/onboarding" className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
        Register Organization
      </Link>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0]}</h1>
          <p className="text-gray-500">{org.org_name} · {org.city}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          org.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
          org.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {org.verification_status === 'verified' ? '✓ Verified' :
           org.verification_status === 'pending' ? '⏳ Pending' : '✗ Not Verified'}
        </span>
      </div>

      {org.verification_status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">
            <strong>Verification Pending:</strong> Your organization is under review.
            You'll be able to claim donations once verified.
          </p>
        </div>
      )}

      {org.verification_status === 'verified' && (
        <>
          <div className="flex flex-wrap gap-3">
            <Link to="/recipient/discover"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm">
              🔍 Discover Available Food
            </Link>
            <Link to="/pickups"
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              My Pickups
            </Link>
            <Link to="/recipient/analytics"
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              📊 Impact
            </Link>
          </div>

          {analytics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Requests Made" value={analytics.total_requested} icon="📤" sub="Last 30 days" />
              <StatCard label="Completed Pickups" value={analytics.completed_pickups} icon="✅" sub="Confirmed" />
              <StatCard label="kg Received" value={`${analytics.total_received_kg} kg`} icon="⚖️" sub="Verified" />
              <StatCard label="Meals Enabled" value={analytics.total_meals_enabled?.toLocaleString()} icon="🍽️" sub="~2 meals/kg" />
            </div>
          )}

          {/* Capacity info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Organization Info</h3>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Max Capacity:</span>
                <span className="ml-2 font-medium">{org.max_capacity_kg ? `${org.max_capacity_kg} kg` : 'Not set'}</span>
              </div>
              <div>
                <span className="text-gray-500">Food Types:</span>
                <span className="ml-2 font-medium">{org.food_types_accepted?.join(', ') || 'All types'}</span>
              </div>
              <div>
                <span className="text-gray-500">Location:</span>
                <span className="ml-2 font-medium">{org.city}, {org.state}</span>
              </div>
            </div>
          </div>

          {/* Recent pickups */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Pickups</h2>
              <Link to="/pickups" className="text-sm text-green-600 hover:underline">View all</Link>
            </div>
            {recentPickups.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl mb-2">🚚</div>
                <p className="text-sm">No pickups yet. Discover available donations!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentPickups.map(p => (
                  <Link key={p.id} to={`/pickups/${p.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">Ref: {p.reference_code}</div>
                      <div className="text-xs text-gray-500">{formatDate(p.agreed_pickup_time)}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(p.status)}`}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
