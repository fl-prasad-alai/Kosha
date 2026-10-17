// Passport storage. Firestore on Cloud Run (KOSHA_STORE=firestore), JSON files locally.
// Also decides which version of a passport each viewer gets: the server never sends a field
// the viewer is not allowed to see.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AccessEntry, Assessment, Consent, Decision, PassportResponse, PassportSummary, PublicPassport, User } from '../shared/types.ts'
import { areaOf, can, NO_CONSENT, orgOf, type PassportResource } from '../shared/policy.ts'
import { serial } from './db.ts'
import { sealOf } from './auth.ts'

// How a failed or flagged check reads in the lender queue: the problem, not the check's name.
const PROBLEM: Record<string, string> = {
  integrity: 'Edited payment record', ontime: 'Late bill payment', address: 'Address mismatch', invoice_ledger: 'Bills missing from ledger',
  margin: 'Unusual margin', mix: 'Unusual cash / digital mix', power: 'Power use does not fit sales', place: 'Weak location',
  located: 'Location not confirmed', discipline: 'Gaps in the ledger', credit: 'High customer credit', interview: 'Answers differ from documents',
  shopfront: 'Signboard does not match',
}

const DIR = process.env.KOSHA_DATA_DIR ?? path.resolve('.data/passports')
const useFirestore = process.env.KOSHA_STORE === 'firestore'

type Col = {
  doc(id: string): { set(d: object): Promise<unknown>; get(): Promise<{ exists: boolean; data(): unknown }> }
  orderBy(f: string, d: string): { limit(n: number): { get(): Promise<{ docs: { data(): unknown }[] }> } }
}
let col: Col | null = null
async function firestore(): Promise<Col> {
  if (!col) {
    const mod = (await import('@google-cloud/firestore' as string)) as { Firestore: new () => { collection(n: string): Col } }
    col = new mod.Firestore().collection('passports')
  }
  return col
}

export async function save(a: Assessment) {
  if (useFirestore) return void (await (await firestore()).doc(a.id).set(JSON.parse(JSON.stringify(a))))
  await mkdir(DIR, { recursive: true })
  await writeFile(path.join(DIR, `${a.id}.json`), JSON.stringify(a))
}

export async function get(id: string): Promise<Assessment | null> {
  if (!/^[A-Z0-9-]{6,40}$/.test(id)) return null
  if (useFirestore) {
    const d = await (await firestore()).doc(id).get()
    return d.exists ? (d.data() as Assessment) : null
  }
  for (const dir of [DIR, path.resolve('cache/passports')]) {
    try { return JSON.parse(await readFile(path.join(dir, `${id}.json`), 'utf8')) } catch { /* next */ }
  }
  return null
}

/** Passports made before accounts existed belong to the demo shop. */
export const ownerOf = (a: Assessment) => a.ownerId ?? 'demo-shop'
/** Passports issued before consent existed are shared with no one. */
export const consentOf = (a: Assessment): Consent => a.consent ?? NO_CONSENT
export const resourceOf = (a: Assessment): PassportResource => ({ ownerId: ownerOf(a), consent: consentOf(a) })

/** Read, change and save one passport without another request writing in between. */
const mutate = (id: string, fn: (a: Assessment) => void) => serial(async () => {
  const a = await get(id)
  if (!a) return null
  fn(a)
  await save(a)
  return a
})

/** One decision per lender organisation; a newer one from the same organisation replaces it. */
export const decide = (id: string, d: Decision) =>
  mutate(id, (a) => void (a.decisions = [...(a.decisions ?? []).filter((x) => (x.orgId ?? x.lenderId) !== (d.orgId ?? d.lenderId)), d]))

export const setConsent = (id: string, c: Consent) => mutate(id, (a) => void (a.consent = c))

// Re-opening the same passport within a few minutes (a refresh, a second tab) counts as one view.
const VIEW_GAP = 5 * 60 * 1000
/** Adds a lender's full view to the passport's access log. Returns false when it was a repeat. */
export async function recordView(id: string, lender: User): Promise<boolean> {
  let added = false
  await mutate(id, (a) => {
    const last = [...(a.access ?? [])].reverse().find((x) => x.lenderId === lender.id)
    if (last && Date.now() - Date.parse(last.at) < VIEW_GAP) return
    const e: AccessEntry = { lenderId: lender.id, org: lender.org, at: new Date().toISOString() }
    a.access = [...(a.access ?? []), e]
    added = true
  })
  return added
}

/** Only the organisation's own decisions; never another lender's notes. */
const decisionsFor = (a: Assessment, u: User) => (a.decisions ?? []).filter((d) => (d.orgId ? d.orgId === orgOf(u) : d.lenderId === u.id))

const seal = (a: Assessment) => sealOf({ id: a.id, score: a.score, band: a.band, status: a.offer.status, createdAt: a.createdAt })

/** What anyone with the link may see. Built field by field, so nothing else can slip through. */
export function toPublic(a: Assessment): PublicPassport {
  const c = consentOf(a)
  return {
    redacted: true,
    id: a.id,
    createdAt: a.createdAt,
    shopName: a.profile.shopName,
    ownerFirstName: a.profile.ownerName.split(/\s+/)[0] ?? '',
    area: areaOf(a.profile.address),
    country: a.profile.country,
    shopType: a.profile.shopType,
    score: a.score,
    band: a.band,
    status: a.offer.status,
    ...(c.publicShowsOffer && a.offer.status === 'offer' ? { limit: a.offer.limit } : {}),
    currency: a.profile.currency,
    sourcesCount: a.sourcesUsed.length,
    seal: seal(a),
  }
}

/** The owner sees everything; a lender the shop shared with sees the passport and its own decision; everyone else the public record. */
export function viewFor(a: Assessment, user?: User): PassportResponse {
  const r = resourceOf(a)
  if (can(user, 'passport:read:own', r)) return { ...a, ownerId: r.ownerId, consent: r.consent!, access: a.access ?? [], decisions: a.decisions ?? [], seal: seal(a) }
  if (can(user, 'passport:read:shared', r)) return { ...a, ownerId: r.ownerId, consent: undefined, access: undefined, decisions: decisionsFor(a, user!), seal: seal(a) }
  return toPublic(a)
}

export async function list(user?: User): Promise<PassportSummary[]> {
  let all: Assessment[] = []
  if (useFirestore) {
    const snap = await (await firestore()).orderBy('createdAt', 'desc').limit(50).get()
    all = snap.docs.map((d) => d.data() as Assessment)
  } else {
    for (const dir of [DIR, path.resolve('cache/passports')]) {
      try {
        for (const f of await readdir(dir)) {
          if (!f.endsWith('.json')) continue
          const a = JSON.parse(await readFile(path.join(dir, f), 'utf8')) as Assessment
          if (!all.some((x) => x.id === a.id)) all.push(a)
        }
      } catch { /* empty */ }
    }
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  // Shops see their own passports; verified lenders only what shops shared with their organisation.
  const owner = user?.role === 'business'
  all = all.filter((a) => can(user, owner ? 'passport:read:own' : 'passport:read:shared', resourceOf(a)))
  return all.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    shopName: a.profile.shopName,
    ownerName: a.profile.ownerName,
    address: a.profile.address,
    country: a.profile.country,
    currency: a.profile.currency,
    score: a.score,
    band: a.band,
    status: a.offer.status,
    limit: a.offer.limit,
    monthlySales: a.metrics.monthlySales,
    flags: a.checks
      .filter((c) => c.status === 'fail' || c.status === 'watch')
      .sort((x, y) => (x.status === 'fail' ? 0 : 1) - (y.status === 'fail' ? 0 : 1))
      .map((c) => PROBLEM[c.id] ?? c.title),
    ownerId: ownerOf(a),
    decision: [...(owner ? a.decisions ?? [] : decisionsFor(a, user!))].sort((x, y) => y.at.localeCompare(x.at))[0] ?? null,
    thumbnail: owner ? a.thumbnail : undefined,
    ...(owner ? { consent: consentOf(a), views: a.access?.length ?? 0 } : {}),
  }))
}
