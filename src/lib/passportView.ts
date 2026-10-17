import type { Assessment, Offer, PublicPassport } from '@shared/types'
import { areaOf } from '@shared/policy'
import { COUNTRIES } from './format'

/** Everything the passport document can show. Private fields are simply absent on the public record. */
export interface PassportView {
  id: string
  createdAt: string
  shopName: string
  holder: string
  shopType: string
  area: string
  country: string
  score: number
  band: string
  status: Offer['status']
  /** Only when the viewer may see it. */
  limit?: number
  currency: string
  sources: number
  seal?: string
  thumbnail?: string
  /** Private details: only the shop and the lenders it chose. */
  since?: number
  years?: number
  monthlySales?: number
  margin?: number
  digitalShare?: number
  public: boolean
}

export const SOURCES_TOTAL = 7

export function fromAssessment(a: Assessment): PassportView {
  return {
    id: a.id,
    createdAt: a.createdAt,
    shopName: a.profile.shopName,
    holder: a.profile.ownerName,
    shopType: a.profile.shopType,
    area: areaOf(a.profile.address) || a.profile.address,
    country: a.profile.country,
    score: a.score,
    band: a.band,
    status: a.offer.status,
    limit: a.offer.limit,
    currency: a.profile.currency,
    sources: a.sourcesUsed.length,
    seal: a.seal,
    thumbnail: a.thumbnail,
    since: a.profile.since,
    years: a.metrics.yearsInBusiness,
    monthlySales: a.metrics.monthlySales,
    margin: a.metrics.margin,
    digitalShare: a.metrics.digitalShare,
    public: false,
  }
}

export function fromPublic(p: PublicPassport): PassportView {
  return {
    id: p.id,
    createdAt: p.createdAt,
    shopName: p.shopName,
    holder: p.ownerFirstName,
    shopType: p.shopType,
    area: p.area || COUNTRIES[p.country]?.name || '',
    country: p.country,
    score: p.score,
    band: p.band,
    status: p.status,
    limit: p.limit,
    currency: p.currency,
    sources: p.sourcesCount,
    seal: p.seal,
    public: true,
  }
}

/**
 * What the public link and the share image show for a full passport: the same fields the server's public
 * record has. The offer amount appears only when the shop chose to show it (unknown counts as hidden).
 */
export function publicOf(a: Assessment): PassportView {
  const v = fromAssessment(a)
  return {
    ...v,
    holder: a.profile.ownerName.split(/\s+/)[0] ?? '',
    limit: a.consent?.publicShowsOffer && a.offer.status === 'offer' ? a.offer.limit : undefined,
    thumbnail: undefined, since: undefined, years: undefined, monthlySales: undefined, margin: undefined, digitalShare: undefined,
    public: true,
  }
}

export const verifyUrl = (v: Pick<PassportView, 'id' | 'seal'>) => `${location.origin}/passport/${v.id}${v.seal ? `?v=${v.seal}` : ''}`
