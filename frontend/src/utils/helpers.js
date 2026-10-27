import { format, formatDistanceToNow, isPast } from 'date-fns'

export const formatDate = (date) => {
  if (!date) return 'N/A'
  return format(new Date(date), 'dd MMM yyyy, hh:mm a')
}

export const formatDateShort = (date) => {
  if (!date) return 'N/A'
  return format(new Date(date), 'dd MMM yyyy')
}

export const timeAgo = (date) => {
  if (!date) return ''
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export const isExpired = (date) => {
  if (!date) return false
  return isPast(new Date(date))
}

export const hoursUntil = (date) => {
  if (!date) return 0
  const diff = new Date(date) - new Date()
  return Math.max(0, diff / 3600000)
}

export const getUrgencyColor = (deadline) => {
  const hours = hoursUntil(deadline)
  if (hours <= 2) return 'text-red-600 bg-red-50'
  if (hours <= 6) return 'text-orange-600 bg-orange-50'
  if (hours <= 24) return 'text-yellow-600 bg-yellow-50'
  return 'text-green-600 bg-green-50'
}

export const getStatusColor = (status) => {
  const map = {
    available: 'bg-green-100 text-green-800',
    requested: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-blue-100 text-blue-800',
    ready_for_pickup: 'bg-purple-100 text-purple-800',
    collected: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-200 text-green-900',
    cancelled: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-800',
    verified: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    suspended: 'bg-gray-100 text-gray-600',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

export const getFoodCategoryLabel = (category) => {
  const map = {
    cooked_meals: 'Cooked Meals',
    bakery: 'Bakery',
    dairy: 'Dairy',
    fruits_vegetables: 'Fruits & Vegetables',
    grains_cereals: 'Grains & Cereals',
    beverages: 'Beverages',
    packaged_food: 'Packaged Food',
    snacks: 'Snacks',
    other: 'Other',
  }
  return map[category] || category
}

export const extractError = (err) => {
  if (err?.response?.data?.detail) {
    const detail = err.response.data.detail
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg || d.message).join(', ')
    }
    return detail
  }
  return err?.message || 'An unexpected error occurred'
}
