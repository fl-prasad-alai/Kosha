// Append-only audit log: sign-ins, lender views, decisions, consent changes and lender verification.
// Firestore collection `audit` on Cloud Run, .data/audit.json locally. Nothing ever edits or removes an entry.
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { AuditEntry, AuditType, User } from '../shared/types.ts'
import { collection, DATA, readJson, serial, useFirestore, writeJson } from './db.ts'

const FILE = path.join(DATA, 'audit.json')

export async function audit(actor: User | null, type: AuditType, e: { detail: string; org?: string; passportId?: string; targetId?: string }) {
  const entry: AuditEntry = { id: randomUUID(), at: new Date().toISOString(), type, actorId: actor?.id ?? null, actorName: actor?.name ?? 'Unknown', actorRole: actor?.role ?? null, ...e }
  try {
    if (useFirestore) return void (await (await collection('audit')).doc(entry.id).set(JSON.parse(JSON.stringify(entry))))
    await serial(async () => writeJson(FILE, [...(await readJson<AuditEntry[]>(FILE, [])), entry]))
  } catch (err) {
    // The action itself already happened; record the failure loudly rather than failing the request.
    console.error('[audit] could not write', type, (err as Error).message)
  }
}

/** Newest first. Filters: type, passport, or free text over names, organisations and details. */
export async function readAudit(f: { type?: string; passportId?: string; q?: string; limit?: number } = {}): Promise<AuditEntry[]> {
  let all: AuditEntry[]
  if (useFirestore) {
    const snap = await (await collection('audit')).orderBy('at', 'desc').limit(1000).get()
    all = snap.docs.map((d) => d.data() as AuditEntry)
  } else all = (await readJson<AuditEntry[]>(FILE, [])).reverse()
  const q = f.q?.trim().toLowerCase()
  return all
    .filter((e) => (!f.type || e.type === f.type) && (!f.passportId || e.passportId === f.passportId))
    .filter((e) => !q || [e.actorName, e.org, e.detail, e.passportId].some((x) => x?.toLowerCase().includes(q)))
    .slice(0, f.limit ?? 500)
}
