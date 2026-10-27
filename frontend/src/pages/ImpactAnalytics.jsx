import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { analyticsAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

const COLORS = ['#16a34a', '#22c55e', '#86efac', '#bbf7d0', '#4ade80', '#15803d']

function StatCard({ label, value, icon, note }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {note && <div className="text-xs text-gray-400 mt-1">{note}</div>}
    </div>
  )
}

export default function ImpactAnalytics() {
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const isDonor = user?.role === 'donor'
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        let res
        if (isAdmin) res = await analyticsAPI.admin(days)
        else if (isDonor) res = await analyticsAPI.donor(days)
        else res = await analyticsAPI.recipient(days)
        setData(res.data.data)
      } catch (err) {
        toast.error(extractError(err))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [days])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impact Analytics</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Note: 1 kg ≈ 2 meals (industry estimate). Only confirmed deliveries are counted as rescued.
          </p>
        </div>
        <select value={days} onChange={e => setDays(parseInt(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
          {[7, 30, 90, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : !data ? (
        <div className="text-center py-16 text-gray-400">No data available.</div>
      ) : (
        <>
          {/* Donor stats */}
          {isDonor && <DonorStats data={data} />}
          {/* Recipient stats */}
          {!isDonor && !isAdmin && <RecipientStats data={data} />}
          {/* Admin stats */}
          {isAdmin && <AdminStats data={data} />}

          {/* Monthly trend chart */}
          <MonthlyChart data={data} isDonor={isDonor} isAdmin={isAdmin} />

          {/* Category breakdown — donor */}
          {isDonor && data.category_breakdown?.length > 0 && (
            <CategoryChart categories={data.category_breakdown} />
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800">
              <strong>Methodology note:</strong> Meals rescued are estimated at 2 meals per kg of food — a widely-used approximation.
              Only food with a confirmed DELIVERED status is counted. Listings, requests, or accepted-but-not-collected donations
              are excluded from rescue totals.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function DonorStats({ data }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Food Listed" value={data.total_listed} icon="📋" />
      <StatCard label="Delivered" value={data.total_collected} icon="✅" />
      <StatCard label="kg Rescued" value={`${data.total_rescued_kg} kg`} icon="⚖️" note="Confirmed only" />
      <StatCard label="Meals Enabled" value={data.total_meals_enabled?.toLocaleString()} icon="🍽️" note="~2 meals/kg" />
      <StatCard label="Success Rate" value={`${data.success_rate_pct}%`} icon="📈" />
      <StatCard label="Cancelled" value={data.total_cancelled} icon="❌" />
      <StatCard label="Expired" value={data.total_expired} icon="⏰" />
    </div>
  )
}

function RecipientStats({ data }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Requests Made" value={data.total_requested} icon="📤" />
      <StatCard label="Pickups Completed" value={data.completed_pickups} icon="✅" />
      <StatCard label="kg Received" value={`${data.total_received_kg} kg`} icon="⚖️" note="Confirmed only" />
      <StatCard label="Meals Enabled" value={data.total_meals_enabled?.toLocaleString()} icon="🍽️" note="~2 meals/kg" />
    </div>
  )
}

function AdminStats({ data }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Users" value={data.total_users} icon="👥" />
      <StatCard label="Organizations" value={data.total_organizations} icon="🏢" />
      <StatCard label="Pending Verifications" value={data.pending_verifications} icon="⏳" />
      <StatCard label="Verified Orgs" value={data.verified_organizations} icon="✓" />
      <StatCard label="Donations Listed" value={data.total_donations_listed} icon="📋" />
      <StatCard label="Delivered" value={data.delivered_donations} icon="✅" />
      <StatCard label="kg Rescued" value={`${data.total_rescued_kg} kg`} icon="⚖️" note="Confirmed only" />
      <StatCard label="Meals Enabled" value={data.total_meals_enabled?.toLocaleString()} icon="🍽️" />
      <StatCard label="Platform Success Rate" value={`${data.platform_success_rate_pct}%`} icon="📈" />
      <StatCard label="Cancelled" value={data.cancelled_donations} icon="❌" />
      <StatCard label="Expired" value={data.expired_donations} icon="⏰" />
    </div>
  )
}

function MonthlyChart({ data, isDonor, isAdmin }) {
  const chartData = (isDonor ? data.monthly_trend : isAdmin ? data.monthly_impact : data.monthly_trend) || []
  if (chartData.length === 0) return null

  const kgKey = isDonor || !isAdmin ? 'kg' : 'kg_rescued'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Monthly Rescue Trend (kg)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => [`${v} kg`, 'Food Rescued']} />
          <Bar dataKey={kgKey} fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CategoryChart({ categories }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Donations by Food Category</h3>
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={categories} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) =>
              `${category.replace(/_/g, ' ')} ${(percent * 100).toFixed(0)}%`
            }>
              {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, n) => [v, n.replace(/_/g, ' ')]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
