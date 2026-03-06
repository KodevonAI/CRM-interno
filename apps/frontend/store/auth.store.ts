import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../lib/api'

interface AuthState {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    {
      name: 'kodevon-auth',
      partialize: (s) => ({ user: s.user }),
    },
  ),
)
