import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { donationAPI } from '../services/api'
import { getFoodCategoryLabel, getStatusColor, formatDate, extractError, hoursUntil } from '../utils/helpers'
import toast from 'react-hot-toast'

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const urgentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

const CATEGORIES = ['', 'cooked_meals', 'bakery', 'dairy', 'fruits_vegetables', 'grains_cereals', 'beverages', 'packaged_food', 'snacks', 'other']

export default function DiscoverDonations() {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'map'
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    food_category: '', city: '', is_vegetarian: '', is_halal: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        page, per_page: 12, status: 'available',
        food_category: filters.food_category || undefined,
        city: filters.city || undefined,
        is_vegetarian: filters.is_vegetarian === 'true' ? true : undefined,
        is_halal: filters.is_halal === 'true' ? true : undefined,
      }
      const res = await donationAPI.list(params)
      setDonations(res.data.data)
      setTotal(res.data.total)
      setTotalPages(res.data.total_pages)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => { load() }, [load])

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1) }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Discover Available Food</h1>
          <p className="text-gray-500 text-sm">{total} donations available</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${view === 'list' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600'}`}>
            ☰ List
          </button>
          <button onClick={() => setView('map')}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${view === 'map' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600'}`}>
            🗺 Map
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <select value={filters.food_category} onChange={e => setFilter('food_category', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
          {CATEGORIES.map(c => <option key={c} value={c}>{c ? getFoodCategoryLabel(c) : 'All Categories'}</option>)}
        </select>
        <input value={filters.city} onChange={e => setFilter('city', e.target.value)}
          placeholder="Filter by city…"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 w-40" />
        <select value={filters.is_vegetarian} onChange={e => setFilter('is_vegetarian', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Any Diet</option>
          <option value="true">Vegetarian</option>
        </select>
        <select value={filters.is_halal} onChange={e => setFilter('is_halal', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Any</option>
          <option value="true">Halal</option>
        </select>
        <button onClick={() => { setFilters({ food_category: '', city: '', is_vegetarian: '', is_halal: '' }); setPage(1) }}
          className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
          Clear
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : view === 'map' ? (
        <MapView donations={donations} />
      ) : (
        <>
          {donations.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <p>No donations found matching your filters.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {donations.map(d => <DonationCard key={d.id} donation={d} />)}
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40">← Prev</button>
              <span className="px-4 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DonationCard({ donation: d }) {
  const hours = hoursUntil(d.pickup_deadline)
  const isUrgent = hours <= 6
  return (
    <Link to={`/donations/${d.id}`}
      className={`bg-white rounded-xl border hover:shadow-md transition-shadow p-4 flex flex-col gap-3 ${isUrgent ? 'border-red-200' : 'border-gray-200'}`}>
      {d.image_url && (
        <img src={d.image_url} alt={d.food_name}
          className="w-full h-36 object-cover rounded-lg" />
      )}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900">{d.food_name}</h3>
        {isUrgent && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex-shrink-0">⚡ Urgent</span>}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{getFoodCategoryLabel(d.food_category)}</span>
        {d.is_vegetarian && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">🥦 Veg</span>}
        {d.is_halal && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">☪️ Halal</span>}
      </div>
      <div className="text-sm text-gray-600">
        <div className="flex justify-between">
          <span>{d.quantity} {d.unit}</span>
          <span className="text-gray-400">{d.pickup_city}</span>
        </div>
        <div className={`mt-1 text-xs font-medium ${isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
          Expires: {formatDate(d.pickup_deadline)}
        </div>
      </div>
      {d.donor_org_name && <div className="text-xs text-gray-400 border-t border-gray-50 pt-2">From: {d.donor_org_name}</div>}
    </Link>
  )
}

function MapView({ donations }) {
  const validDonations = donations.filter(d => d.pickup_latitude && d.pickup_longitude)
  const center = validDonations.length > 0
    ? [validDonations[0].pickup_latitude, validDonations[0].pickup_longitude]
    : [28.6139, 77.2090] // Default: New Delhi

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 500 }}>
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validDonations.map(d => (
          <Marker
            key={d.id}
            position={[d.pickup_latitude, d.pickup_longitude]}
            icon={hoursUntil(d.pickup_deadline) <= 6 ? urgentIcon : new L.Icon.Default()}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{d.food_name}</div>
                <div className="text-gray-500">{d.quantity} {d.unit} · {d.pickup_city}</div>
                <div className="text-xs text-gray-400 mt-1">Deadline: {formatDate(d.pickup_deadline)}</div>
                <Link to={`/donations/${d.id}`} className="text-green-600 text-xs underline mt-1 block">View Details</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
