import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { orgAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

const DONOR_TYPES = ['restaurant', 'canteen', 'bakery', 'hotel', 'event_organizer', 'other']
const RECIPIENT_TYPES = ['ngo', 'shelter', 'community_kitchen', 'other']
const FOOD_TYPES = ['cooked_meals', 'bakery', 'dairy', 'fruits_vegetables', 'grains_cereals', 'snacks', 'packaged_food', 'other']

export default function OrgOnboarding() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const isDonor = user?.role === 'donor'
  const typeOptions = isDonor ? DONOR_TYPES : RECIPIENT_TYPES

  const [form, setForm] = useState({
    org_name: '', org_type: typeOptions[0], description: '',
    address: '', city: '', state: '', country: 'India', postal_code: '',
    latitude: '', longitude: '', website: '', registration_number: '',
    max_capacity_kg: '', avg_daily_surplus_kg: '',
    food_types_accepted: [],
  })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const toggleFoodType = (ft) => {
    setForm(prev => ({
      ...prev,
      food_types_accepted: prev.food_types_accepted.includes(ft)
        ? prev.food_types_accepted.filter(x => x !== ft)
        : [...prev.food_types_accepted, ft],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.latitude || !form.longitude) {
      toast.error('Please enter your location coordinates')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        max_capacity_kg: form.max_capacity_kg ? parseFloat(form.max_capacity_kg) : null,
        avg_daily_surplus_kg: form.avg_daily_surplus_kg ? parseFloat(form.avg_daily_surplus_kg) : null,
      }
      await orgAPI.create(payload)
      toast.success('Organization registered! Waiting for admin verification.')
      navigate(isDonor ? '/donor' : '/recipient')
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Set Up Your Organization</h1>
          <p className="text-gray-600 mt-1">This will be reviewed by our admin team before approval.</p>
        </div>

        <div className="bg-white rounded-2xl shadow p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                <input required value={form.org_name} onChange={e => set('org_name', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Type *</label>
                <select required value={form.org_type} onChange={e => set('org_type', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm">
                  {typeOptions.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input value={form.registration_number} onChange={e => set('registration_number', e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Brief description of your organization"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm resize-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
              <input required value={form.address} onChange={e => set('address', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input required value={form.city} onChange={e => set('city', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <input required value={form.state} onChange={e => set('state', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                <input value={form.postal_code} onChange={e => set('postal_code', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude *</label>
                <input required type="number" step="any" value={form.latitude}
                  onChange={e => set('latitude', e.target.value)}
                  placeholder="e.g. 30.7333"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude *</label>
                <input required type="number" step="any" value={form.longitude}
                  onChange={e => set('longitude', e.target.value)}
                  placeholder="e.g. 76.7794"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
              <p className="sm:col-span-2 text-xs text-gray-400">
                Tip: Find your coordinates at <a href="https://www.latlong.net" target="_blank" rel="noreferrer" className="text-green-600">latlong.net</a>
              </p>
            </div>

            {/* Recipient-specific */}
            {!isDonor && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Food Types Accepted</label>
                  <div className="flex flex-wrap gap-2">
                    {FOOD_TYPES.map(ft => (
                      <button key={ft} type="button" onClick={() => toggleFoodType(ft)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          form.food_types_accepted.includes(ft)
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {ft.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity (kg)</label>
                  <input type="number" min="0" value={form.max_capacity_kg}
                    onChange={e => set('max_capacity_kg', e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
                </div>
              </>
            )}

            {/* Donor-specific */}
            {isDonor && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Avg Daily Surplus (kg)</label>
                <input type="number" min="0" value={form.avg_daily_surplus_kg}
                  onChange={e => set('avg_daily_surplus_kg', e.target.value)}
                  placeholder="Approximate daily surplus"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
              {loading ? 'Submitting…' : 'Submit for Verification'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
