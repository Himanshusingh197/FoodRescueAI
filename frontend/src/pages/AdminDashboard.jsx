import { useEffect, useState } from 'react'
import { analyticsAPI, orgAPI, adminAPI } from '../services/api'
import { getStatusColor, formatDate, extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

const TABS = ['Overview', 'Organizations', 'Users', 'Donations']

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview')
  const [analytics, setAnalytics] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [users, setUsers] = useState([])
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (tab === 'Overview') {
          const res = await analyticsAPI.admin(30)
          setAnalytics(res.data.data)
        } else if (tab === 'Organizations') {
          const res = await orgAPI.list({ page, per_page: 15, verification_status: 'pending' })
          setOrgs(res.data.data)
          setTotalPages(res.data.total_pages)
        } else if (tab === 'Users') {
          const res = await adminAPI.listUsers({ page, per_page: 15 })
          setUsers(res.data.data)
          setTotalPages(res.data.total_pages)
        } else if (tab === 'Donations') {
          const res = await adminAPI.listDonations({ page, per_page: 15 })
          setDonations(res.data.data)
          setTotalPages(res.data.total_pages)
        }
      } catch (err) {
        toast.error(extractError(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tab, page])

  const handleVerify = async (orgId, action) => {
    const reason = action !== 'verify' ? window.prompt(`Reason for ${action}:`) : null
    setVerifying(orgId)
    try {
      await orgAPI.verify(orgId, { action, reason })
      toast.success(`Organization ${action}d successfully`)
      // Refresh
      const res = await orgAPI.list({ page, per_page: 15, verification_status: 'pending' })
      setOrgs(res.data.data)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setVerifying(null)
    }
  }

  const handleSuspendUser = async (userId, isActive) => {
    try {
      if (isActive) {
        await adminAPI.suspendUser(userId)
        toast.success('User suspended')
      } else {
        await adminAPI.activateUser(userId)
        toast.success('User activated')
      }
      const res = await adminAPI.listUsers({ page, per_page: 15 })
      setUsers(res.data.data)
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  const handleCancelDonation = async (donationId) => {
    if (!window.confirm('Cancel this donation?')) return
    try {
      await adminAPI.cancelDonation(donationId)
      toast.success('Donation cancelled')
      const res = await adminAPI.listDonations({ page, per_page: 15 })
      setDonations(res.data.data)
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Platform management and oversight</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1) }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Overview */}
          {tab === 'Overview' && analytics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Users', value: analytics.total_users, icon: '👥' },
                  { label: 'Organizations', value: analytics.total_organizations, icon: '🏢' },
                  { label: 'Pending Verifications', value: analytics.pending_verifications, icon: '⏳' },
                  { label: 'Verified Orgs', value: analytics.verified_organizations, icon: '✓' },
                  { label: 'Donations Listed', value: analytics.total_donations_listed, icon: '📋' },
                  { label: 'Delivered', value: analytics.delivered_donations, icon: '✅' },
                  { label: 'kg Rescued', value: `${analytics.total_rescued_kg} kg`, icon: '⚖️' },
                  { label: 'Meals Enabled', value: analytics.total_meals_enabled?.toLocaleString(), icon: '🍽️' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className="text-xl font-bold text-gray-900">{s.value ?? '—'}</div>
                    <div className="text-xs text-gray-500">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <strong>Period:</strong> Last 30 days &nbsp;·&nbsp;
                <strong>Platform success rate:</strong> {analytics.platform_success_rate_pct}% &nbsp;·&nbsp;
                <strong>Cancelled:</strong> {analytics.cancelled_donations} &nbsp;·&nbsp;
                <strong>Expired:</strong> {analytics.expired_donations}
              </div>
            </div>
          )}

          {/* Organizations — pending verification */}
          {tab === 'Organizations' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Showing organizations pending verification</p>
              {orgs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-400">
                  <div className="text-3xl mb-2">🎉</div>
                  <p>No pending verifications</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                  {orgs.map(o => (
                    <div key={o.id} className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{o.org_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(o.verification_status)}`}>
                            {o.verification_status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {o.org_type.replace(/_/g, ' ')} · {o.city}, {o.state}, {o.country}
                        </div>
                        {o.registration_number && (
                          <div className="text-xs text-gray-400 mt-0.5">Reg: {o.registration_number}</div>
                        )}
                        {o.description && (
                          <div className="text-xs text-gray-500 mt-1 italic">{o.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">Registered: {formatDate(o.created_at)}</div>
                      </div>
                      {o.verification_status === 'pending' && (
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => handleVerify(o.id, 'verify')} disabled={verifying === o.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                            Verify
                          </button>
                          <button onClick={() => handleVerify(o.id, 'reject')} disabled={verifying === o.id}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50">
                            Reject
                          </button>
                          <button onClick={() => handleVerify(o.id, 'suspend')} disabled={verifying === o.id}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                            Suspend
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Pagination page={page} totalPages={totalPages} setPage={setPage} />
            </div>
          )}

          {/* Users */}
          {tab === 'Users' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {users.map(u => (
                  <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{u.full_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'donor' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>{u.role}</span>
                        {!u.is_active && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Suspended</span>}
                      </div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                      <div className="text-xs text-gray-400">Joined: {formatDate(u.created_at)}</div>
                    </div>
                    {u.role !== 'admin' && (
                      <button onClick={() => handleSuspendUser(u.id, u.is_active)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          u.is_active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}>
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} setPage={setPage} />
            </div>
          )}

          {/* Donations */}
          {tab === 'Donations' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
                {donations.map(d => (
                  <div key={d.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{d.food_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(d.status)}`}>
                          {d.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">{d.quantity} {d.unit} · {d.pickup_city}</div>
                      <div className="text-xs text-gray-400">Deadline: {formatDate(d.pickup_deadline)}</div>
                    </div>
                    {!['cancelled', 'delivered', 'expired'].includes(d.status) && (
                      <button onClick={() => handleCancelDonation(d.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100">
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} setPage={setPage} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Pagination({ page, totalPages, setPage }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex justify-center gap-2">
      <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
        className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
      <span className="px-4 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
      <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
        className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
    </div>
  )
}
