import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { donationAPI } from '../services/api'
import { getStatusColor, formatDate, getFoodCategoryLabel, extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

const STATUSES = ['', 'available', 'requested', 'accepted', 'ready_for_pickup', 'collected', 'delivered', 'cancelled', 'expired']

export default function ManageDonations() {
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [cancelling, setCancelling] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await donationAPI.myDonations({ page, per_page: 10, status: statusFilter || undefined })
      setDonations(res.data.data)
      setTotal(res.data.total)
      setTotalPages(res.data.total_pages)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, statusFilter])

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this donation?')) return
    setCancelling(id)
    try {
      await donationAPI.cancel(id)
      toast.success('Donation cancelled')
      load()
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Donations</h1>
          <p className="text-gray-500 text-sm">{total} total listings</p>
        </div>
        <Link to="/donor/create-donation"
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
          + New Donation
        </Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === s ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 text-gray-600 hover:border-green-300'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : donations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🍱</div>
          <p>No donations found. <Link to="/donor/create-donation" className="text-green-600 underline">Create one</Link></p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {donations.map(d => (
            <div key={d.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/donations/${d.id}`} className="font-semibold text-gray-900 hover:text-green-700">
                    {d.food_name}
                  </Link>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(d.status)}`}>
                    {d.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-3">
                  <span>{getFoodCategoryLabel(d.food_category)}</span>
                  <span>·</span>
                  <span>{d.quantity} {d.unit}</span>
                  <span>·</span>
                  <span>Deadline: {formatDate(d.pickup_deadline)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link to={`/donations/${d.id}`}
                  className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  View
                </Link>
                {d.status === 'available' && (
                  <button onClick={() => handleCancel(d.id)} disabled={cancelling === d.id}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
