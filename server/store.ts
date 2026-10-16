// Passport storage. Firestore on Cloud Run (KOSHA_STORE=firestore), JSON files locally.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Assessment, Decision, PassportSummary, User } from '../shared/types.ts'

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

export async function decide(id: string, d: Decision): Promise<Assessment | null> {
  const a = await get(id)
  if (!a) return null
  a.decisions = [...(a.decisions ?? []).filter((x) => x.lenderId !== d.lenderId), d]
  await save(a)
  return a
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
  if (user?.role === 'business') all = all.filter((a) => ownerOf(a) === user.id)
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
    decision: [...(a.decisions ?? [])].sort((x, y) => y.at.localeCompare(x.at))[0] ?? null,
    thumbnail: user?.role === 'business' ? a.thumbnail : undefined,
  }))
}
