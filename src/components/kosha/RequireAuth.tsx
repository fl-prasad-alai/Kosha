import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '@shared/types'
import { can, type Permission } from '@shared/policy'
import { homeFor, useAuth } from '@/state/auth'
import { Reading } from './ui'

/**
 * Sends signed-out visitors to sign in, and anyone the policy does not allow to their own dashboard.
 * `role` picks the account type (a pending lender still reaches /lender to see its status); `need` asks the policy.
 * The server checks the same policy on every request; this only keeps people off pages they cannot use.
 */
export function RequireAuth({ role, need, children }: { role?: Role; need?: Permission; children: ReactNode }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <div className="mx-auto max-w-7xl px-6 py-16"><Reading text="Checking your account…" /></div>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}${role && role !== 'admin' ? `&role=${role}` : ''}`} replace />
  if ((role && user.role !== role) || (need && !can(user, need))) return <Navigate to={homeFor(user)} replace />
  return <>{children}</>
}
