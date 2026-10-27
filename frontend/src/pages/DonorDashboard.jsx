import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyticsAPI, orgAPI, donationAPI } from '../services/api'
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

export default function DonorDashboard() {
  const { user } = useAuthStore()
  const [org, setOrg] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [recentDonations, setRecentDonations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const orgRes = await orgAPI.getMyOrg()
        setOrg(orgRes.data.data)

        if (orgRes.data.data?.verification_status === 'verified') {
          const [analyticsRes, donationsRes] = await Promise.all([
            analyticsAPI.donor(30),
            donationAPI.myDonations({ per_page: 5 }),
          ])
          setAnalytics(analyticsRes.data.data)
          setRecentDonations(donationsRes.data.data)
        }
      } catch (err) {
        toast.error(extractError(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>

  if (!org) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Set Up Your Organization</h2>
        <p className="text-gray-600 mb-6">Register your organization to start listing surplus food donations.</p>
        <Link to="/onboarding" className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
          Register Organization
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.full_name?.split(' ')[0]}</h1>
          <p className="text-gray-500">{org.org_name} · {org.city}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          org.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
          org.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {org.verification_status === 'verified' ? '✓ Verified' :
           org.verification_status === 'pending' ? '⏳ Pending Verification' : '✗ Not Verified'}
        </div>
      </div>

      {org.verification_status === 'pending' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">
            <strong>Verification Pending:</strong> Your organization is under review. 
            You'll be able to create donations once verified by our admin team.
          </p>
        </div>
      )}

      {org.verification_status === 'verified' && (
        <>
          {/* Quick actions */}
          <div className="flex flex-wrap gap-3">
            <Link to="/donor/create-donation"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors text-sm">
              + List Surplus Food
            </Link>
            <Link to="/donor/donations"
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              Manage Donations
            </Link>
            <Link to="/donor/predictions"
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
              🔮 Predict Surplus
            </Link>
          </div>

          {/* Stats */}
          {analytics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Food Listed" value={analytics.total_listed} icon="📋" sub="Last 30 days" />
              <StatCard label="Successfully Delivered" value={analytics.total_collected} icon="✅" sub="Confirmed" />
              <StatCard label="kg Rescued" value={`${analytics.total_rescued_kg} kg`} icon="⚖️" sub="Verified" />
              <StatCard label="Meals Enabled" value={analytics.total_meals_enabled?.toLocaleString()} icon="🍽️" sub="~2 meals/kg" />
            </div>
          )}

          {/* Recent donations */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Recent Donations</h2>
              <Link to="/donor/donations" className="text-sm text-green-600 hover:underline">View all</Link>
            </div>
            {recentDonations.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <div className="text-3xl mb-2">🍱</div>
                <p className="text-sm">No donations yet. Create your first listing!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentDonations.map(d => (
                  <Link key={d.id} to={`/donations/${d.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{d.food_name}</div>
                      <div className="text-xs text-gray-500">{d.quantity} {d.unit} · {formatDate(d.pickup_deadline)}</div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(d.status)}`}>
                      {d.status.replace(/_/g, ' ')}
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
