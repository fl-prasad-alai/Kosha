import type {
  Assessment, AuditEntry, AuditType, ConsentInput, DecisionStatus, DocKind, Role, User, ExtractResponse, ExtractResultMap, InterviewAnswer, LenderAccount, LenderOrg,
  LocationResult, PassportResponse, PassportSummary, Profile, QuestionId,
} from '@shared/types'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('Kosha could not reach the server. Check your connection and try again.', 0)
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status}).`
    try {
      msg = (await res.json()).error ?? msg
    } catch { /* not JSON */ }
    throw new ApiError(msg, res.status)
  }
  return res.json() as Promise<T>
}

const json = (body: unknown, method = 'POST'): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export function extractDocs<K extends DocKind>(kind: K, files: File[], profile: Profile, signal?: AbortSignal) {
  const fd = new FormData()
  for (const f of files) fd.append('files', f, f.name)
  fd.append('profile', JSON.stringify(profile))
  return call<ExtractResponse<K> & { result: ExtractResultMap[K] }>(`/api/extract/${kind}`, { method: 'POST', body: fd, signal })
}

export const scanLocation = (profile: Profile) => call<LocationResult>('/api/location', json({ profile }))

export function answer(id: QuestionId, profile: Profile, input: { audio?: Blob; text?: string }) {
  const fd = new FormData()
  fd.append('profile', JSON.stringify(profile))
  if (input.audio) fd.append('audio', input.audio, `answer.${input.audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
  if (input.text) fd.append('text', input.text)
  return call<InterviewAnswer>(`/api/interview/${id}`, { method: 'POST', body: fd })
}

export const buildPassport = (body: { consent: ConsentInput; [k: string]: unknown }) => call<Assessment>('/api/assess', json(body))
/** The full passport when the viewer may see it, otherwise the redacted public record. */
export const getPassport = (id: string) => call<PassportResponse>(`/api/passports/${encodeURIComponent(id)}`)
export const listPassports = () => call<PassportSummary[]>('/api/passports')
export const setConsent = (id: string, c: ConsentInput) => call<Assessment>(`/api/passports/${encodeURIComponent(id)}/consent`, json(c, 'PUT'))
export const passportAudit = (id: string) => call<AuditEntry[]>(`/api/passports/${encodeURIComponent(id)}/audit`)

let orgs: Promise<LenderOrg[]> | null = null
/** Verified lender organisations a shop can share with. Fetched once per page load. */
export const listLenders = () => (orgs ??= call<LenderOrg[]>('/api/lenders').catch((e) => { orgs = null; throw e }))

export async function tts(text: string): Promise<Blob> {
  const res = await fetch('/api/tts', json({ text }))
  if (!res.ok) throw new ApiError('Voice is unavailable right now.', res.status)
  return res.blob()
}

// ── accounts
export const me = () => call<User | null>('/api/auth/me')
export const login = (email: string, password: string) => call<User>('/api/auth/login', json({ email, password }))
export const signup = (body: { role: Role; name: string; email: string; password: string; org: string }) => call<User>('/api/auth/signup', json(body))
export const demoLogin = (role: Role) => call<User>('/api/auth/demo', json({ role }))
export const logout = () => call<{ ok: true }>('/api/auth/logout', { method: 'POST' })
export const logoutAll = () => call<{ ok: true; ended: number }>('/api/auth/logout-all', { method: 'POST' })
export const decide = (id: string, status: DecisionStatus, note: string) => call<Assessment>(`/api/passports/${encodeURIComponent(id)}/decision`, json({ status, note }))

// ── Kosha staff
export const adminLenders = () => call<LenderAccount[]>('/api/admin/lenders')
export const verifyLender = (id: string, status: 'verified' | 'rejected', reason: string) => call<LenderAccount[]>(`/api/admin/lenders/${encodeURIComponent(id)}`, json({ status, reason }))
export const adminAudit = (f: { type?: AuditType | ''; q?: string } = {}) => {
  const p = new URLSearchParams()
  if (f.type) p.set('type', f.type)
  if (f.q?.trim()) p.set('q', f.q.trim())
  return call<AuditEntry[]>(`/api/admin/audit${p.size ? `?${p}` : ''}`)
}
