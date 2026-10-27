import { create } from 'zustand'
import { authAPI } from '../services/api'

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('fra_token') || null,
  isLoading: false,
  isAuthenticated: !!localStorage.getItem('fra_token'),

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const res = await authAPI.login({ email, password })
      const { access_token, user } = res.data
      localStorage.setItem('fra_token', access_token)
      set({ token: access_token, user, isAuthenticated: true, isLoading: false })
      return { success: true, user }
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('fra_token')
    set({ user: null, token: null, isAuthenticated: false })
  },

  fetchMe: async () => {
    try {
      const res = await authAPI.me()
      set({ user: res.data.data, isAuthenticated: true })
    } catch {
      get().logout()
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      const res = await authAPI.register(data)
      set({ isLoading: false })
      return res.data
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },
}))
