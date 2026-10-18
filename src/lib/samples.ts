import type { DocKind, Profile, QuestionId } from '@shared/types'

export interface SampleShop {
  id: string
  profile: Profile
  docs: Partial<Record<DocKind, string[]>>
  interview: Partial<Record<QuestionId, string>>
  /** Identity documents the owner adds by hand in the walkthrough (not loaded automatically). */
  handDocs?: { pan?: string; aadhaar?: string; business?: string; wrong?: string }
}

interface Manifest {
  shops: (Omit<Profile, 'currency'> & {
    id: string
    currency?: string
    docs: Partial<Record<DocKind, string[]>>
    interview: Partial<Record<QuestionId, string>>
    handDocs?: SampleShop['handDocs']
  })[]
}

const CURRENCY: Record<string, string> = { IN: 'INR', PH: 'PHP', ID: 'IDR' }

let cache: Promise<SampleShop[]> | null = null

export function loadSamples(): Promise<SampleShop[]> {
  cache ??= fetch('/samples/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : { shops: [] }))
    .then((m) =>
      m.shops.map((s) => ({
        id: s.id,
        docs: s.docs,
        interview: s.interview,
        handDocs: s.handDocs,
        profile: {
          shopName: s.shopName,
          ownerName: s.ownerName,
          address: s.address,
          shopType: s.shopType,
          since: s.since,
          country: s.country,
          language: s.language,
          currency: s.currency ?? CURRENCY[s.country] ?? 'USD',
        },
      })),
    )
    .catch(() => [])
  return cache
}

export async function sampleFiles(paths: string[] = []): Promise<File[]> {
  return Promise.all(
    paths.map(async (p) => {
      const r = await fetch(`/samples/${p}`)
      const b = await r.blob()
      return new File([b], p.split('/').pop() ?? p, { type: b.type || (p.endsWith('.png') ? 'image/png' : 'image/jpeg') })
    }),
  )
}
