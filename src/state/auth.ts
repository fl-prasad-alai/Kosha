import { create } from 'zustand'
import type { Role, User } from '@shared/types'
import * as api from '@/lib/api'
import { useKosha } from './kosha'

interface AuthState {
  user: User | null
  ready: boolean
  load: () => Promise<void>
  login: (email: string, password: string) => Promise<User>
  signup: (b: { role: Role; name: string; email: string; password: string; org: string }) => Promise<User>
  demo: (role: Role) => Promise<User>
  logout: () => Promise<void>
}

export const homeFor = (u: User | null) => (u?.role === 'lender' ? '/lender' : u ? '/app' : '/login')

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  ready: false,
  load: async () => {
    try {
      set({ user: await api.me(), ready: true })
    } catch {
      set({ user: null, ready: true })
    }
  },
  login: async (email, password) => {
    const user = await api.login(email, password)
    set({ user })
    return user
  },
  signup: async (b) => {
    const user = await api.signup(b)
    set({ user })
    return user
  },
  demo: async (role) => {
    const user = await api.demoLogin(role)
    set({ user })
    return user
  },
  logout: async () => {
    await api.logout().catch(() => {})
    useKosha.getState().reset()
    set({ user: null })
    void get
  },
}))
