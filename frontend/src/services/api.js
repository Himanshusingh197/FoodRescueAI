import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fra_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('fra_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
  changePassword: (data) => api.post('/auth/change-password', data),
}

// Organizations
export const orgAPI = {
  create: (data) => api.post('/organizations', data),
  getMyOrg: () => api.get('/organizations/my'),
  getById: (id) => api.get(`/organizations/${id}`),
  update: (id, data) => api.put(`/organizations/${id}`, data),
  list: (params) => api.get('/organizations', { params }),
  verify: (id, data) => api.post(`/organizations/${id}/verify`, data),
}

// Donations
export const donationAPI = {
  create: (data) => api.post('/donations', data),
  list: (params) => api.get('/donations', { params }),
  myDonations: (params) => api.get('/donations/my', { params }),
  getById: (id) => api.get(`/donations/${id}`),
  update: (id, data) => api.put(`/donations/${id}`, data),
  cancel: (id) => api.delete(`/donations/${id}`),
  uploadImage: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/donations/${id}/upload-image`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getRecommendations: (id) => api.get(`/donations/${id}/recommendations`),
  requestDonation: (donationId, data) => api.post(`/donations/${donationId}/request`, data),
  getRequests: (donationId) => api.get(`/donations/${donationId}/requests`),
  respondToRequest: (requestId, action, reason) =>
    api.post(`/donations/requests/${requestId}/respond`, null, { params: { action, reason } }),
}

// Pickups
export const pickupAPI = {
  schedule: (data) => api.post('/pickups', data),
  list: (params) => api.get('/pickups', { params }),
  getById: (id) => api.get(`/pickups/${id}`),
  confirmHandover: (id, data) => api.post(`/pickups/${id}/confirm-handover`, data),
  confirmCollection: (id, data) => api.post(`/pickups/${id}/confirm-collection`, data),
  cancel: (id, data) => api.post(`/pickups/${id}/cancel`, data),
}

// Notifications
export const notificationAPI = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (ids) => api.post('/notifications/mark-read', { notification_ids: ids }),
  markAllRead: () => api.post('/notifications/mark-all-read'),
}

// Predictions
export const predictionAPI = {
  predict: (data) => api.post('/predictions', data),
  myPredictions: () => api.get('/predictions/my'),
  modelInfo: () => api.get('/predictions/model-info'),
  retrain: () => api.post('/predictions/retrain'),
}

// Analytics
export const analyticsAPI = {
  donor: (days) => api.get('/analytics/donor', { params: { days } }),
  recipient: (days) => api.get('/analytics/recipient', { params: { days } }),
  admin: (days) => api.get('/analytics/admin', { params: { days } }),
}

// Admin
export const adminAPI = {
  listUsers: (params) => api.get('/admin/users', { params }),
  suspendUser: (id) => api.post(`/admin/users/${id}/suspend`),
  activateUser: (id) => api.post(`/admin/users/${id}/activate`),
  listDonations: (params) => api.get('/admin/donations', { params }),
  cancelDonation: (id) => api.delete(`/admin/donations/${id}`),
}
