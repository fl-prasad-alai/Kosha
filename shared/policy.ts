// Who may do what. One list, used by the API middleware and by the web app to hide routes and buttons.
// The server is the one that enforces it; the web app only mirrors it.
import type { Consent, PassportResponse, PublicPassport, User } from './types.ts'

export const PERMISSIONS = [
  'passport:create', // a shop builds a passport
  'passport:read:own', // a shop reads its own passports in full
  'passport:share', // a shop changes who its passport is shared with (own only)
  'passport:read:shared', // a verified lender reads a passport the shop shared with its organisation
  'passport:decide', // the same lender approves, asks for documents or declines
  'passport:read:public', // anyone reads the redacted verification page
  'lender:verify', // Kosha staff approve or reject lender organisations
  'audit:read', // Kosha staff read the audit log; a shop reads the access log of its own passports
] as const
export type Permission = (typeof PERMISSIONS)[number]

/** The parts of a passport a decision depends on. */
export interface PassportResource { ownerId: string; consent?: Consent | null }

/** Passports issued before consent existed are not shared with anyone. */
export const NO_CONSENT: Consent = { scope: 'none', lenderIds: [], publicShowsOffer: false, at: '1970-01-01T00:00:00.000Z', version: 1 }

export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
export const orgOf = (u: User) => u.orgId ?? slug(u.org)
export const isVerifiedLender = (u: User | null | undefined) => u?.role === 'lender' && u.status === 'verified'

/** Does this consent cover the lender organisation? */
export function covers(c: Consent | null | undefined, orgId: string) {
  if (!c) return false
  return c.scope === 'all' || (c.scope === 'selected' && c.lenderIds.includes(orgId))
}

export function can(user: User | null | undefined, p: Permission, r?: PassportResource): boolean {
  if (p === 'passport:read:public') return true
  if (!user) return false
  switch (p) {
    case 'passport:create':
      return user.role === 'business'
    case 'passport:read:own':
    case 'passport:share':
      return user.role === 'business' && (!r || r.ownerId === user.id)
    case 'passport:read:shared':
    case 'passport:decide':
      return isVerifiedLender(user) && (!r || covers(r.consent, orgOf(user)))
    case 'lender:verify':
      return user.role === 'admin'
    case 'audit:read':
      return user.role === 'admin' || (user.role === 'business' && (!r || r.ownerId === user.id))
  }
}

export const isPublic = (p: PassportResponse): p is PublicPassport => 'redacted' in p && p.redacted === true

/** "Shop 4, Karve Road, Kothrud, Pune, Maharashtra 411038" → "Kothrud, Pune". No street, number or postcode. */
export function areaOf(address: string) {
  const STREET = /\d|\b(road|rd|street|st|lane|ln|marg|avenue|ave|shop|no|plot|block|jalan|jl|gali|floor|bldg|building)\b\.?/i
  const parts = address.split(',').map((x) => x.replace(/\b\d{4,6}\b/g, '').trim()).filter(Boolean)
  let i = 0
  while (i < parts.length - 1 && STREET.test(parts[i])) i++
  return parts.slice(i, i + 2).join(', ')
}
