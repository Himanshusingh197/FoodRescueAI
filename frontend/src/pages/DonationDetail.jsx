import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { donationAPI, pickupAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { getStatusColor, formatDate, getFoodCategoryLabel, extractError, hoursUntil } from '../utils/helpers'
import toast from 'react-hot-toast'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export default function DonationDetail() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [donation, setDonation] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [respondingId, setRespondingId] = useState(null)

  const isRecipient = user?.role === 'recipient'
  const isDonor = user?.role === 'donor'

  const load = async () => {
    setLoading(true)
    try {
      const res = await donationAPI.getById(id)
      setDonation(res.data.data)
      if (user?.role === 'admin' || (user?.role === 'donor')) {
        try {
          const recRes = await donationAPI.getRecommendations(id)
          setRecommendations(recRes.data.data?.recommendations || [])
        } catch {}
        try {
          const reqRes = await donationAPI.getRequests(id)
          setRequests(reqRes.data.data || [])
        } catch {}
      }
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleRequest = async (e) => {
    e.preventDefault()
    setRequesting(true)
    try {
      await donationAPI.requestDonation(id, { donation_id: id, message })
      toast.success('Request submitted!')
      setShowRequestForm(false)
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setRequesting(false)
    }
  }

  const handleRespond = async (requestId, action) => {
    setRespondingId(requestId)
    try {
      await donationAPI.respondToRequest(requestId, action)
      toast.success(`Request ${action}d`)
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setRespondingId(null)
    }
  }

  const handleSchedulePickup = async (requestId) => {
    const time = window.prompt('Enter agreed pickup time (YYYY-MM-DDTHH:MM):')
    if (!time) return
    try {
      const pickup = await pickupAPI.schedule({
        donation_id: id,
        request_id: requestId,
        agreed_pickup_time: new Date(time).toISOString(),
      })
      toast.success('Pickup scheduled!')
      navigate(`/pickups/${pickup.data.data.id}`)
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
    </div>
  )

  if (!donation) return <div className="text-center py-20 text-gray-400">Donation not found.</div>

  const hours = hoursUntil(donation.pickup_deadline)
  const isUrgent = hours <= 6 && donation.status === 'available'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{donation.food_name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(donation.status)}`}>
              {donation.status.replace(/_/g, ' ')}
            </span>
            {isUrgent && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">⚡ Urgent</span>}
          </div>
          <p className="text-gray-500 text-sm">From: {donation.donor_org_name || 'Food Donor'} · {donation.pickup_city}</p>
        </div>
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Food image */}
          {donation.image_url && (
            <img src={donation.image_url} alt={donation.food_name}
              className="w-full h-56 object-cover rounded-xl border border-gray-200" />
          )}

          {/* Details card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Food Details</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Detail label="Category" value={getFoodCategoryLabel(donation.food_category)} />
              <Detail label="Quantity" value={`${donation.quantity} ${donation.unit}`} />
              {donation.serves_people && <Detail label="Serves" value={`~${donation.serves_people} people`} />}
              <Detail label="Storage" value={donation.storage_condition.replace(/_/g, ' ')} />
              {donation.storage_notes && <Detail label="Storage Notes" value={donation.storage_notes} />}
              {donation.allergens?.length > 0 && (
                <Detail label="Allergens" value={donation.allergens.join(', ')} className="sm:col-span-2" />
              )}
            </div>
            {/* Dietary */}
            <div className="flex flex-wrap gap-2">
              {donation.is_vegetarian && <Tag label="🥦 Vegetarian" />}
              {donation.is_vegan && <Tag label="🌱 Vegan" />}
              {donation.is_halal && <Tag label="☪️ Halal" />}
              {donation.is_kosher && <Tag label="✡️ Kosher" />}
            </div>
            {donation.description && (
              <p className="text-sm text-gray-600 border-t border-gray-50 pt-3">{donation.description}</p>
            )}
          </div>

          {/* Pickup details — shown only to logged-in parties */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Pickup Information</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Detail label="Address" value={donation.pickup_address} />
              <Detail label="City" value={donation.pickup_city} />
              <Detail label="Collection From" value={formatDate(donation.collection_start_time)} />
              <Detail label="Deadline" value={formatDate(donation.pickup_deadline)} valueClass={isUrgent ? 'text-red-600 font-medium' : ''} />
            </div>
            {donation.pickup_instructions && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                <strong>Instructions:</strong> {donation.pickup_instructions}
              </div>
            )}
          </div>

          {/* Map */}
          {donation.pickup_latitude && donation.pickup_longitude && (
            <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: 200 }}>
              <MapContainer
                center={[donation.pickup_latitude, donation.pickup_longitude]}
                zoom={15} style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[donation.pickup_latitude, donation.pickup_longitude]}>
                  <Popup>{donation.food_name}</Popup>
                </Marker>
              </MapContainer>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="space-y-5">
          {/* Recipient: request button */}
          {isRecipient && donation.status === 'available' && (
            <div className="bg-white rounded-xl border border-green-200 p-5">
              {!showRequestForm ? (
                <button onClick={() => setShowRequestForm(true)}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors">
                  Request This Donation
                </button>
              ) : (
                <form onSubmit={handleRequest} className="space-y-3">
                  <h4 className="font-medium text-gray-900">Send Request</h4>
                  <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
                    placeholder="Optional message to the donor…"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={requesting}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                      {requesting ? 'Sending…' : 'Submit Request'}
                    </button>
                    <button type="button" onClick={() => setShowRequestForm(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Donor: incoming requests */}
          {isDonor && requests.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Pickup Requests ({requests.length})</h3>
              {requests.map(r => (
                <div key={r.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-900">{r.recipient_org_name || 'Recipient'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(r.status)}`}>{r.status}</span>
                  </div>
                  {r.message && <p className="text-xs text-gray-500 italic">"{r.message}"</p>}
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleRespond(r.id, 'accept')} disabled={respondingId === r.id}
                        className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                        Accept
                      </button>
                      <button onClick={() => handleRespond(r.id, 'decline')} disabled={respondingId === r.id}
                        className="flex-1 py-1.5 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100 disabled:opacity-50">
                        Decline
                      </button>
                    </div>
                  )}
                  {r.status === 'accepted' && (
                    <button onClick={() => handleSchedulePickup(r.id)}
                      className="w-full py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">
                      Schedule Pickup
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recommendations — donor view */}
          {isDonor && recommendations.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Matched Recipients</h3>
              <p className="text-xs text-gray-400">Scores are weighted composites — not calibrated probabilities.</p>
              {recommendations.slice(0, 5).map(r => (
                <div key={r.org_id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-gray-900">{r.org_name}</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {Math.round(r.match_score * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{r.city} · {r.distance_km} km away</div>
                  <div className="text-xs text-gray-400 mt-1">{r.org_type.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, className = '', valueClass = '' }) {
  return (
    <div className={className}>
      <span className="text-gray-500">{label}: </span>
      <span className={`font-medium text-gray-900 ${valueClass}`}>{value}</span>
    </div>
  )
}
function Tag({ label }) {
  return <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs">{label}</span>
}
