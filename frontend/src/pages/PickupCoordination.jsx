import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { pickupAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { getStatusColor, formatDate, extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

const STATUS_STEPS = ['scheduled', 'donor_confirmed', 'completed']

export default function PickupCoordination() {
  const { id } = useParams()
  const { user } = useAuthStore()

  // If no id, show list
  if (!id) return <PickupList />

  return <PickupDetail pickupId={id} user={user} />
}

function PickupList() {
  const { user } = useAuthStore()
  const [pickups, setPickups] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    pickupAPI.list({ page, per_page: 10 })
      .then(r => {
        setPickups(r.data.data)
        setTotalPages(r.data.total_pages)
      })
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false))
  }, [page])

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">My Pickups</h1>
      {pickups.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🚚</div>
          <p>No pickups yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {pickups.map(p => (
            <Link key={p.id} to={`/pickups/${p.id}`}
              className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
              <div>
                <div className="font-semibold text-gray-900 text-sm">{p.reference_code}</div>
                <div className="text-xs text-gray-500 mt-0.5">Pickup: {formatDate(p.agreed_pickup_time)}</div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(p.status)}`}>
                {p.status.replace(/_/g, ' ')}
              </span>
            </Link>
          ))}
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
    </div>
  )
}

function PickupDetail({ pickupId, user }) {
  const [pickup, setPickup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [handoverQty, setHandoverQty] = useState('')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [collectionQty, setCollectionQty] = useState('')
  const [collectionNotes, setCollectionNotes] = useState('')
  const [rating, setRating] = useState(5)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancel, setShowCancel] = useState(false)

  const load = () => {
    setLoading(true)
    pickupAPI.getById(pickupId)
      .then(r => setPickup(r.data.data))
      .catch(err => toast.error(extractError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [pickupId])

  const handleDonorHandover = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await pickupAPI.confirmHandover(pickupId, {
        actual_quantity_handed: parseFloat(handoverQty),
        handover_notes: handoverNotes || null,
      })
      toast.success('Handover confirmed!')
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecipientConfirm = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await pickupAPI.confirmCollection(pickupId, {
        actual_quantity_received: parseFloat(collectionQty),
        collection_notes: collectionNotes || null,
        quality_rating: rating,
      })
      toast.success('Collection confirmed! Impact recorded.')
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (e) => {
    e.preventDefault()
    if (!cancelReason.trim()) { toast.error('Please enter a cancellation reason'); return }
    setSubmitting(true)
    try {
      await pickupAPI.cancel(pickupId, { cancelled_by: user?.role, reason: cancelReason })
      toast.success('Pickup cancelled')
      setShowCancel(false)
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner />
  if (!pickup) return <div className="text-center py-20 text-gray-400">Pickup not found.</div>

  const stepIndex = STATUS_STEPS.indexOf(pickup.status)
  const isDonor = user?.role === 'donor'
  const isRecipient = user?.role === 'recipient'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pickup Coordination</h1>
          <p className="text-gray-500 text-sm">Ref: {pickup.reference_code}</p>
        </div>
        <Link to="/pickups" className="text-sm text-gray-500 hover:text-gray-700">← All Pickups</Link>
      </div>

      {/* Progress stepper */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-0">
          {['Scheduled', 'Donor Confirmed', 'Completed'].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex flex-col items-center flex-1 ${i < 2 ? '' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                  i <= stepIndex ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-gray-400'
                }`}>
                  {i <= stepIndex ? '✓' : i + 1}
                </div>
                <div className={`text-xs mt-1 text-center ${i <= stepIndex ? 'text-green-700 font-medium' : 'text-gray-400'}`}>{s}</div>
              </div>
              {i < 2 && <div className={`flex-1 h-0.5 mb-4 ${i < stepIndex ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Pickup info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="font-semibold text-gray-900">Pickup Details</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Row label="Status" value={<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(pickup.status)}`}>{pickup.status.replace(/_/g, ' ')}</span>} />
          <Row label="Agreed Time" value={formatDate(pickup.agreed_pickup_time)} />
          {pickup.pickup_instructions && <Row label="Instructions" value={pickup.pickup_instructions} />}
          {pickup.actual_quantity_handed && <Row label="Handed Over" value={`${pickup.actual_quantity_handed} kg`} />}
          {pickup.actual_quantity_received && <Row label="Received" value={`${pickup.actual_quantity_received} kg`} />}
          {pickup.quantity_discrepancy !== null && pickup.quantity_discrepancy !== undefined && (
            <Row label="Discrepancy" value={`${pickup.quantity_discrepancy > 0 ? '+' : ''}${pickup.quantity_discrepancy} kg`}
              valueClass={pickup.quantity_discrepancy !== 0 ? 'text-orange-600 font-semibold' : 'text-green-600'} />
          )}
          {pickup.quality_rating && <Row label="Quality Rating" value={`${'⭐'.repeat(pickup.quality_rating)} (${pickup.quality_rating}/5)`} />}
        </div>
        {pickup.collection_notes && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">{pickup.collection_notes}</div>
        )}
        {pickup.cancellation_reason && (
          <div className="bg-red-50 rounded-lg p-3 text-sm text-red-700">
            <strong>Cancelled:</strong> {pickup.cancellation_reason}
          </div>
        )}
      </div>

      {/* Donor: confirm handover */}
      {isDonor && pickup.status === 'scheduled' && (
        <div className="bg-white rounded-xl border border-green-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Confirm Handover</h3>
          <form onSubmit={handleDonorHandover} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Quantity Handed (kg) *</label>
              <input required type="number" min="0.1" step="0.1" value={handoverQty}
                onChange={e => setHandoverQty(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Handover Notes</label>
              <textarea rows={2} value={handoverNotes} onChange={e => setHandoverNotes(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              {submitting ? 'Confirming…' : 'Confirm Handover'}
            </button>
          </form>
        </div>
      )}

      {/* Recipient: confirm collection */}
      {isRecipient && pickup.status === 'donor_confirmed' && (
        <div className="bg-white rounded-xl border border-blue-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Confirm Collection</h3>
          <form onSubmit={handleRecipientConfirm} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Actual Quantity Received (kg) *</label>
              <input required type="number" min="0.1" step="0.1" value={collectionQty}
                onChange={e => setCollectionQty(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quality Rating</label>
              <select value={rating} onChange={e => setRating(parseInt(e.target.value))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collection Notes</label>
              <textarea rows={2} value={collectionNotes} onChange={e => setCollectionNotes(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <button type="submit" disabled={submitting}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Confirming…' : 'Confirm Collection'}
            </button>
          </form>
        </div>
      )}

      {/* Cancel */}
      {!['completed', 'cancelled'].includes(pickup.status) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          {!showCancel ? (
            <button onClick={() => setShowCancel(true)}
              className="w-full py-2.5 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
              Cancel Pickup
            </button>
          ) : (
            <form onSubmit={handleCancel} className="space-y-3">
              <h4 className="font-medium text-gray-900 text-sm">Reason for Cancellation *</h4>
              <textarea required rows={2} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none" />
              <div className="flex gap-2">
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                  {submitting ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
                <button type="button" onClick={() => setShowCancel(false)}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                  Keep Pickup
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {pickup.status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <div className="text-3xl mb-2">🎉</div>
          <p className="font-semibold text-green-800">Pickup Complete!</p>
          <p className="text-sm text-green-700 mt-1">
            {pickup.actual_quantity_received} kg of food rescued — impact recorded.
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div>
      <span className="text-gray-500 text-sm">{label}: </span>
      <span className={`text-sm font-medium text-gray-900 ${valueClass}`}>{value}</span>
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
    </div>
  )
}
