import type {
  Assessment, DocKind, ExtractResponse, ExtractResultMap, InterviewAnswer, LocationResult, PassportSummary, Profile, QuestionId,
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

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

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

export const buildPassport = (body: object) => call<Assessment>('/api/assess', json(body))
export const getPassport = (id: string) => call<Assessment>(`/api/passports/${encodeURIComponent(id)}`)
export const listPassports = () => call<PassportSummary[]>('/api/passports')

export async function tts(text: string): Promise<Blob> {
  const res = await fetch('/api/tts', json({ text }))
  if (!res.ok) throw new ApiError('Voice is unavailable right now.', res.status)
  return res.blob()
}
