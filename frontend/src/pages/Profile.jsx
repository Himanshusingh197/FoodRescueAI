import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { authAPI, orgAPI } from '../services/api'
import { formatDate, extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function Profile() {
  const { user, fetchMe } = useAuthStore()
  const [org, setOrg] = useState(null)
  const [tab, setTab] = useState('profile')

  // Profile form
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [savingPwd, setSavingPwd] = useState(false)

  useEffect(() => {
    if (user) {
      setProfileForm({ full_name: user.full_name || '', phone: user.phone || '' })
    }
    orgAPI.getMyOrg().then(r => setOrg(r.data.data)).catch(() => {})
  }, [user])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      await authAPI.updateMe(profileForm)
      await fetchMe()
      toast.success('Profile updated')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error('New passwords do not match')
      return
    }
    if (pwdForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSavingPwd(true)
    try {
      await authAPI.changePassword({
        current_password: pwdForm.current_password,
        new_password: pwdForm.new_password,
      })
      toast.success('Password changed successfully')
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Profile & Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['profile', 'Profile'], ['password', 'Security'], ['org', 'Organization']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center text-white text-2xl font-bold">
              {user?.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{user?.full_name}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                user?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                user?.role === 'donor' ? 'bg-blue-100 text-blue-700' :
                'bg-green-100 text-green-700'
              }`}>{user?.role}</span>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs text-gray-400 mb-4">
              Member since {formatDate(user?.created_at)} &nbsp;·&nbsp;
              Last login: {user?.last_login ? formatDate(user.last_login) : 'N/A'}
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input required value={profileForm.full_name}
                onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={profileForm.phone}
                onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+91 9876543210"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={user?.email} disabled
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
            </div>
            <button type="submit" disabled={savingProfile}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {tab === 'password' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input required type="password" value={pwdForm.current_password}
                onChange={e => setPwdForm(p => ({ ...p, current_password: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input required type="password" value={pwdForm.new_password} minLength={8}
                onChange={e => setPwdForm(p => ({ ...p, new_password: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input required type="password" value={pwdForm.confirm_password}
                onChange={e => setPwdForm(p => ({ ...p, confirm_password: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <button type="submit" disabled={savingPwd}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
              {savingPwd ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* Organization Tab */}
      {tab === 'org' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Your Organization</h3>
          {!org ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">🏢</div>
              <p className="text-sm mb-3">No organization registered yet.</p>
              <a href="/onboarding" className="text-green-600 text-sm underline">Register organization →</a>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 text-lg">{org.org_name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  org.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                  org.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>{org.verification_status}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Row label="Type" value={org.org_type.replace(/_/g, ' ')} />
                <Row label="City" value={`${org.city}, ${org.state}`} />
                <Row label="Address" value={org.address} />
                <Row label="Country" value={org.country} />
                {org.website && <Row label="Website" value={<a href={org.website} target="_blank" rel="noreferrer" className="text-green-600 underline">{org.website}</a>} />}
                {org.registration_number && <Row label="Reg. No." value={org.registration_number} />}
                {org.max_capacity_kg && <Row label="Max Capacity" value={`${org.max_capacity_kg} kg`} />}
                {org.avg_daily_surplus_kg && <Row label="Avg Daily Surplus" value={`${org.avg_daily_surplus_kg} kg`} />}
              </div>
              {org.food_types_accepted?.length > 0 && (
                <div>
                  <span className="text-sm text-gray-500">Food Types Accepted: </span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {org.food_types_accepted.map(ft => (
                      <span key={ft} className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">
                        {ft.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {org.verification_status === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  Your organization is awaiting admin verification. This usually takes 1–2 business days.
                </div>
              )}
              <div className="text-xs text-gray-400">Registered: {formatDate(org.created_at)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  )
}
