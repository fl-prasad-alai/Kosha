import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '@shared/types'
import { homeFor, useAuth } from '@/state/auth'
import { Reading } from './ui'

/** Sends signed-out visitors to sign in, and the wrong role to their own dashboard. */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <div className="mx-auto max-w-7xl px-6 py-16"><Reading text="Checking your account…" /></div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}${role ? `&role=${role}` : ''}`} replace />
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <>{children}</>
}
