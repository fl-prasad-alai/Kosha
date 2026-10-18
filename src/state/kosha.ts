import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Assessment, CallMeta, ConsentInput, DocKind, ExtractResultMap, IdentityInput, InterviewAnswer, LocationResult, Profile, QuestionId } from '@shared/types'
import { readAadhaarQr } from '@/lib/aadhaarQr'
import * as api from '@/lib/api'
import { loadSamples, sampleFiles, type SampleShop } from '@/lib/samples'

export type Status = 'idle' | 'reading' | 'done' | 'error'

export interface DocState<K extends DocKind = DocKind> {
  files: File[]
  urls: string[]
  status: Status
  error?: string
  result?: ExtractResultMap[K]
  meta?: CallMeta
}

export interface AnswerState {
  status: Status
  answer?: InterviewAnswer
  error?: string
}

export const DOC_KINDS: DocKind[] = ['identity', 'business', 'ledger', 'invoice', 'payments', 'electricity', 'shopfront']

const emptyDoc = (): DocState => ({ files: [], urls: [], status: 'idle' })
const emptyDocs = () => Object.fromEntries(DOC_KINDS.map((k) => [k, emptyDoc()])) as { [K in DocKind]: DocState<K> }

export const DEFAULT_CONSENT: ConsentInput = { scope: 'all', lenderIds: [], publicShowsOffer: false }

export const EMPTY_PROFILE: Profile = { shopName: '', ownerName: '', address: '', shopType: 'Kirana (general store)', since: 2020, country: 'IN', language: 'hi', currency: 'INR' }

interface KoshaState {
  sampleId: string | null
  sampleAnswers: Partial<Record<QuestionId, string>>
  profile: Profile
  docs: { [K in DocKind]: DocState<K> }
  location: { status: Status; result?: LocationResult; error?: string; forAddress?: string }
  answers: Partial<Record<QuestionId, AnswerState>>
  assessment: Assessment | null
  assessStatus: Status
  assessError?: string
  /** Who the shop shares the passport with. `agreed` is the ticked consent box; nothing is issued without it. */
  consent: ConsentInput
  agreed: boolean
  /** Who the owner is: typed numbers and the Aadhaar QR, if scanned. */
  idInput: IdentityInput
  qr: { status: Status; error?: string }
  /** A document the user just picked, while Gemini reads it, or why it was not accepted. Nothing shows on the
   *  page until it is read and is the right kind of document. */
  pending: Partial<Record<DocKind, { status: 'reading' | 'rejected'; message?: string; what?: string }>>

  setConsent: (c: ConsentInput) => void
  setAgreed: (v: boolean) => void
  setProfile: (p: Partial<Profile>) => void
  setIdInput: (p: Partial<IdentityInput>) => void
  /** Reads an Aadhaar Secure QR (the decoded digits) and checks UIDAI's signature, all in the browser. */
  scanQr: (text: string) => Promise<void>
  /** A photo of the Aadhaar card with no readable QR: Gemini reads the card instead (last 4 digits only). */
  addAadhaarPhoto: (file: File) => void
  /**
   * Reads newly picked files (with `keep`, files already accepted for the same kind) and accepts them only if
   * `check` passes; otherwise the page keeps what it had and shows why.
   */
  upload: <K extends DocKind>(kind: K, files: File[], o: { keep?: File[]; what: string; check: (r: ExtractResultMap[K], fromFile: number) => string | null }) => Promise<boolean>
  clearPending: (kind: DocKind) => void
  setFiles: (kind: DocKind, files: File[]) => void
  removeFile: (kind: DocKind, index: number) => void
  read: (kind: DocKind) => Promise<void>
  scan: () => Promise<void>
  answer: (id: QuestionId, input: { audio?: Blob; text?: string }) => Promise<void>
  build: () => Promise<Assessment | null>
  loadSample: (s: SampleShop) => Promise<void>
  reset: () => void
  /** After a page refresh: put sample photos back without re-reading them. */
  restoreFiles: () => Promise<void>
}

const controllers = new Map<DocKind, AbortController>()

async function thumbnailOf(file?: File): Promise<string | undefined> {
  if (!file || !file.type.startsWith('image/')) return undefined
  try {
    const bmp = await createImageBitmap(file)
    const w = 360
    const h = Math.round((bmp.height / bmp.width) * w)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')?.drawImage(bmp, 0, 0, w, h)
    return c.toDataURL('image/jpeg', 0.78)
  } catch {
    return undefined
  }
}

export const useKosha = create<KoshaState>()(persist((set, get) => ({
  sampleId: null,
  sampleAnswers: {},
  profile: EMPTY_PROFILE,
  docs: emptyDocs(),
  location: { status: 'idle' },
  answers: {},
  assessment: null,
  assessStatus: 'idle',
  consent: DEFAULT_CONSENT,
  agreed: false,
  idInput: {},
  qr: { status: 'idle' },
  pending: {},

  clearPending: (kind) => set((s) => ({ pending: { ...s.pending, [kind]: undefined } })),
  upload: async (kind, files, o) => {
    const keep = o.keep ?? []
    const all = [...keep, ...files]
    set((s) => ({ pending: { ...s.pending, [kind]: { status: 'reading', what: o.what } } }))
    try {
      const out = await api.extractDocs(kind, all, get().profile)
      const problem = o.check(out.result as never, keep.length)
      if (problem) {
        set((s) => ({ pending: { ...s.pending, [kind]: { status: 'rejected', message: problem, what: o.what } } }))
        return false
      }
      get().docs[kind].urls.forEach((u) => URL.revokeObjectURL(u))
      set((s) => ({
        docs: { ...s.docs, [kind]: { files: all, urls: all.map((f) => URL.createObjectURL(f)), status: 'done', result: out.result, meta: out.meta } },
        pending: { ...s.pending, [kind]: undefined },
        assessment: null,
      }))
      return true
    } catch (e) {
      set((s) => ({ pending: { ...s.pending, [kind]: { status: 'rejected', message: (e as Error).message, what: o.what } } }))
      return false
    }
  },

  setIdInput: (p) => set((s) => ({ idInput: { ...s.idInput, ...p }, assessment: null })),
  scanQr: async (text) => {
    set({ qr: { status: 'reading' } })
    try {
      const aadhaar = await readAadhaarQr(text)
      set((s) => ({ qr: { status: 'done' }, idInput: { ...s.idInput, aadhaar, dob: s.idInput.dob || aadhaar.dob }, assessment: null }))
    } catch (e) {
      set({ qr: { status: 'error', error: (e as Error).message } })
    }
  },

  addAadhaarPhoto: (file) => {
    const named = new File([file], `aadhaar-${file.name}`, { type: file.type })
    set({ qr: { status: 'idle' } })
    const keep = get().docs.identity.files.filter((f) => !f.name.startsWith('aadhaar-'))
    void get().upload('identity', [named], {
      keep,
      what: 'aadhaar',
      check: (r, from) => (r.documents.some((d) => d.kind === 'aadhaar' && d.file >= from) ? null : "This doesn't look like an Aadhaar card. Upload a clear photo of the front of the card, or scan its QR."),
    })
  },

  setConsent: (consent) => set({ consent }),
  setAgreed: (agreed) => set({ agreed }),
  setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),

  setFiles: (kind, files) => {
    controllers.get(kind)?.abort()
    const old = get().docs[kind]
    old.urls.forEach((u) => URL.revokeObjectURL(u))
    set((s) => ({ docs: { ...s.docs, [kind]: { files, urls: files.map((f) => URL.createObjectURL(f)), status: 'idle' } }, assessment: null }))
  },

  removeFile: (kind, index) => {
    const d = get().docs[kind]
    get().setFiles(kind, d.files.filter((_, i) => i !== index))
  },

  read: async (kind) => {
    const d = get().docs[kind]
    if (!d.files.length) return
    controllers.get(kind)?.abort()
    const ctl = new AbortController()
    controllers.set(kind, ctl)
    const files = d.files
    set((s) => ({ docs: { ...s.docs, [kind]: { ...s.docs[kind], status: 'reading', error: undefined } } }))
    try {
      const out = await api.extractDocs(kind, files, get().profile, ctl.signal)
      if (get().docs[kind].files !== files) return // files changed meanwhile
      set((s) => ({ docs: { ...s.docs, [kind]: { ...s.docs[kind], status: 'done', result: out.result, meta: out.meta } } }))
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      set((s) => ({ docs: { ...s.docs, [kind]: { ...s.docs[kind], status: 'error', error: (e as Error).message } } }))
    }
  },

  scan: async () => {
    const p = get().profile
    if (!p.address.trim()) return
    set({ location: { status: 'reading', forAddress: p.address } })
    try {
      const result = await api.scanLocation(p)
      if (get().profile.address !== p.address) return
      set({ location: { status: 'done', result, forAddress: p.address } })
    } catch (e) {
      set({ location: { status: 'error', error: (e as Error).message, forAddress: p.address } })
    }
  },

  answer: async (id, input) => {
    set((s) => ({ answers: { ...s.answers, [id]: { ...s.answers[id], status: 'reading', error: undefined } } }))
    try {
      const a = await api.answer(id, get().profile, input)
      set((s) => ({ answers: { ...s.answers, [id]: { status: 'done', answer: a } }, assessment: null }))
    } catch (e) {
      set((s) => ({ answers: { ...s.answers, [id]: { ...s.answers[id], status: 'error', error: (e as Error).message } } }))
    }
  },

  build: async () => {
    const s = get()
    if (!s.agreed) {
      set({ assessStatus: 'error', assessError: 'Tick the consent box to choose who can see your passport.' })
      return null
    }
    set({ assessStatus: 'reading', assessError: undefined })
    try {
      const docs = Object.fromEntries(DOC_KINDS.filter((k) => s.docs[k].result).map((k) => [k, s.docs[k].result]))
      const interview = Object.values(s.answers).map((a) => a?.answer).filter(Boolean)
      const thumbnail = await thumbnailOf(s.docs.shopfront.files[0])
      const a = await api.buildPassport({ profile: s.profile, docs, location: s.location.result, interview, thumbnail, consent: s.consent, identity: { ...s.idInput, sample: !!s.sampleId } })
      set({ assessment: a, assessStatus: 'done' })
      return a
    } catch (e) {
      set({ assessStatus: 'error', assessError: (e as Error).message })
      return null
    }
  },

  loadSample: async (sample) => {
    get().reset()
    // Sample shops are fictional, so consent is pre-filled to keep the walkthrough quick; it stays visible and editable.
    set({ sampleId: sample.id, profile: sample.profile, sampleAnswers: sample.interview, consent: DEFAULT_CONSENT, agreed: true })
    const entries = await Promise.all(DOC_KINDS.map(async (k) => [k, await sampleFiles(sample.docs[k])] as const))
    for (const [k, files] of entries) get().setFiles(k, files)
    // Start reading everything at once; each step reveals its own result.
    void get().scan()
    for (const k of DOC_KINDS) void get().read(k)
  },

  reset: () => {
    controllers.forEach((c) => c.abort())
    controllers.clear()
    Object.values(get().docs).forEach((d) => d.urls.forEach((u) => URL.revokeObjectURL(u)))
    set({ sampleId: null, sampleAnswers: {}, profile: EMPTY_PROFILE, docs: emptyDocs(), location: { status: 'idle' }, answers: {}, assessment: null, assessStatus: 'idle', assessError: undefined, consent: DEFAULT_CONSENT, agreed: false, idInput: {}, qr: { status: 'idle' }, pending: {} })
  },

  restoreFiles: async () => {
    const id = get().sampleId
    if (!id) return
    const sample = (await loadSamples()).find((x) => x.id === id)
    if (!sample) return
    for (const k of DOC_KINDS) {
      const files = await sampleFiles(sample.docs[k])
      set((s) => ({ docs: { ...s.docs, [k]: { ...s.docs[k], files, urls: files.map((f) => URL.createObjectURL(f)) } } }))
    }
    // Anything that was mid-read when the page reloaded starts again.
    for (const k of DOC_KINDS) if (get().docs[k].status === 'idle' && !get().docs[k].result && get().docs[k].files.length) void get().read(k)
    if (get().location.status === 'idle' && get().profile.address) void get().scan()
  },
}), {
  name: 'kosha-session',
  version: 1,
  storage: createJSONStorage(() => sessionStorage),
  partialize: (s) => ({
    sampleId: s.sampleId,
    sampleAnswers: s.sampleAnswers,
    profile: s.profile,
    docs: Object.fromEntries(DOC_KINDS.map((k) => [k, { files: [], urls: [], status: s.docs[k].status === 'done' ? 'done' : 'idle', result: s.docs[k].result, meta: s.docs[k].meta }])),
    location: s.location.status === 'done' ? s.location : { status: 'idle' },
    answers: Object.fromEntries(Object.entries(s.answers).filter(([, a]) => a?.status === 'done')),
    assessment: s.assessment,
    assessStatus: s.assessment ? 'done' : 'idle',
    consent: s.consent,
    agreed: s.agreed,
    idInput: s.idInput,
  }) as unknown as KoshaState,
  onRehydrateStorage: () => (state) => void state?.restoreFiles(),
}))

// Development only: lets the end-to-end tests read and drive the same store the app uses.
if (import.meta.env.DEV) (globalThis as { __kosha?: typeof useKosha }).__kosha = useKosha
