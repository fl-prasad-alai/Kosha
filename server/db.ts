// A tiny document store shared by accounts, sessions and the audit log: Firestore on Cloud Run
// (KOSHA_STORE=firestore), JSON files locally.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const useFirestore = process.env.KOSHA_STORE === 'firestore'
export const DATA = path.resolve(process.env.KOSHA_DATA_ROOT ?? '.data')

type Snap = { docs: { data(): unknown; ref: { delete(): Promise<unknown> } }[] }
type Query = { get(): Promise<Snap>; limit(n: number): { get(): Promise<Snap> } }
type Doc = { set(d: object): Promise<unknown>; get(): Promise<{ exists: boolean; data(): unknown }>; delete(): Promise<unknown> }
export type Col = { doc(id: string): Doc; where(f: string, op: string, v: string): Query; orderBy(f: string, d: string): { limit(n: number): { get(): Promise<Snap> } } }

const cols = new Map<string, Col>()
export async function collection(name: string): Promise<Col> {
  if (!cols.has(name)) {
    const mod = (await import('@google-cloud/firestore' as string)) as { Firestore: new () => { collection(n: string): Col } }
    cols.set(name, new mod.Firestore().collection(name))
  }
  return cols.get(name)!
}

/** File writes go one at a time so two requests never overwrite each other. */
let chain: Promise<unknown> = Promise.resolve()
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn)
  chain = run.catch(() => {})
  return run
}
export async function readJson<T>(file: string, empty: T): Promise<T> {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return empty }
}
export async function writeJson(file: string, data: unknown) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2))
}
