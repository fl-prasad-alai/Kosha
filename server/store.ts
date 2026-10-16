// Passport storage. Firestore on Cloud Run (KOSHA_STORE=firestore), JSON files locally.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Assessment, PassportSummary } from '../shared/types.ts'

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

export async function list(): Promise<PassportSummary[]> {
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
    flags: a.checks.filter((c) => c.status === 'fail' || c.status === 'watch').map((c) => c.title),
  }))
}
