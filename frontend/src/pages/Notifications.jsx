import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { notificationAPI } from '../services/api'
import { timeAgo, extractError } from '../utils/helpers'
import toast from 'react-hot-toast'

const TYPE_ICONS = {
  donation_available: '🍱',
  donation_requested: '📬',
  donation_accepted: '✅',
  donation_declined: '❌',
  pickup_scheduled: '🚚',
  pickup_confirmed: '🎉',
  donation_urgent: '⚡',
  donation_expiring: '⚠️',
  org_verified: '✓',
  org_rejected: '✗',
  system: 'ℹ️',
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const res = await notificationAPI.list({ page, per_page: 15, unread_only: unreadOnly })
      setNotifications(res.data.data)
      setTotalPages(res.data.total_pages)
      setUnreadCount(res.data.unread_count || 0)
    } catch (err) {
      toast.error(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, unreadOnly])

  const markRead = async (ids) => {
    try {
      await notificationAPI.markRead(ids)
      load()
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead()
      toast.success('All notifications marked as read')
      load()
    } catch (err) {
      toast.error(extractError(err))
    }
  }

  const getLinkForNotification = (n) => {
    if (!n.reference_id) return null
    if (n.reference_type === 'donation') return `/donations/${n.reference_id}`
    if (n.reference_type === 'pickup') return `/pickups/${n.reference_id}`
    return null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={unreadOnly} onChange={e => { setUnreadOnly(e.target.checked); setPage(1) }}
              className="accent-green-600" />
            Unread only
          </label>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
              Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">🔔</div>
          <p>{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
          {notifications.map(n => {
            const link = getLinkForNotification(n)
            const content = (
              <div className={`flex gap-4 px-5 py-4 transition-colors ${!n.is_read ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                onClick={() => !n.is_read && markRead([n.id])}>
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                  {TYPE_ICONS[n.notification_type] || 'ℹ️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium text-gray-900 ${!n.is_read ? 'font-semibold' : ''}`}>{n.title}</p>
                    {!n.is_read && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </div>
            )
            return link ? (
              <Link key={n.id} to={link} className="block">{content}</Link>
            ) : (
              <div key={n.id} className="cursor-pointer">{content}</div>
            )
          })}
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
