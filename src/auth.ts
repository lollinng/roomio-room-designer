import { create } from 'zustand'
import { api, ApiError, backendAvailable } from './api'

export interface User {
  id: string
  email: string
  name?: string
}

export type AuthStatus =
  | 'loading' // checking session on boot
  | 'anon' // backend up, not logged in
  | 'authed' // logged in
  | 'offline' // backend unreachable — guest/local-only mode

interface AuthState {
  status: AuthStatus
  user: User | null
  error: string | null
  busy: boolean
  init: () => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<boolean>
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  continueAsGuest: () => void
  clearError: () => void
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  error: null,
  busy: false,

  init: async () => {
    const up = await backendAvailable()
    if (!up) {
      set({ status: 'offline', user: null })
      return
    }
    try {
      const { user } = await api.get<{ user: User }>('/auth/me')
      set({ status: 'authed', user })
    } catch {
      set({ status: 'anon', user: null })
    }
  },

  signup: async (email, password, name) => {
    set({ busy: true, error: null })
    try {
      const { user } = await api.post<{ user: User }>('/auth/signup', { email, password, name })
      set({ status: 'authed', user, busy: false })
      return true
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Sign up failed'
      set({ error: msg, busy: false })
      return false
    }
  },

  login: async (email, password) => {
    set({ busy: true, error: null })
    try {
      const { user } = await api.post<{ user: User }>('/auth/login', { email, password })
      set({ status: 'authed', user, busy: false })
      return true
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Login failed'
      set({ error: msg, busy: false })
      return false
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    set({ status: 'anon', user: null })
  },

  continueAsGuest: () => set({ status: 'offline' }),
  clearError: () => set({ error: null }),
}))
