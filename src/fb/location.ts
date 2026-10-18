// Location intelligence: Gemini grounded on Google Maps (needs billing) with a Google Search fallback.
import type { LocationResult, Place, Profile } from '@shared/types'
import { generate, GeminiError } from './gemini.ts'

interface Raw {
  listing: { found: boolean; name: string; rating: number | null; reviews: number | null; themes: string[] }
  places: { name: string; category: string; kind: 'driver' | 'competitor'; distanceM: number; bearingDeg: number }[]
  areaSummary: string
}

const SYSTEM = `You are Kosha's location analyst. Kosha assesses small neighbourhood shops for working-capital loans.
Use the grounding tool to look up real places. Never invent a place. Distances and bearings are your best estimates from the shop's address.
Reply with ONE JSON object and nothing else, shaped exactly like:
{"listing":{"found":true,"name":"","rating":4.3,"reviews":57,"themes":["fair prices"]},
 "places":[{"name":"","category":"school","kind":"driver","distanceM":250,"bearingDeg":40}],
 "areaSummary":"two sentences"}
Rules: kind "driver" = something that brings daily customers (schools, colleges, offices, bus or rail stops, markets, hospitals, temples, mosques or churches, housing societies). kind "competitor" = a shop selling similar everyday goods.
Give 6-10 drivers and 2-6 competitors within about 800 m. bearingDeg is the compass direction from the shop (0 = north, 90 = east).
listing describes the shop's own Google Maps listing if one exists (found=false and nulls if not). themes = 2-4 short phrases summarising what reviewers say.`

function strength(places: Place[], listing: Raw['listing']): number {
  const drivers = places.filter((p) => p.kind === 'driver')
  const competitors = places.filter((p) => p.kind === 'competitor')
  const near = (p: Place) => (p.distanceM <= 300 ? 1 : p.distanceM <= 600 ? 0.7 : 0.4)
  const demand = Math.min(1, drivers.reduce((a, p) => a + near(p), 0) / 6)
  const competition = Math.min(1, competitors.reduce((a, p) => a + near(p), 0) / 5)
  const reputation = listing.found && listing.rating ? Math.min(1, (listing.rating - 3) / 1.8) * Math.min(1, (listing.reviews ?? 0) / 40) : 0.3
  return Math.round(100 * Math.max(0, Math.min(1, 0.55 * demand + 0.25 * reputation + 0.2 * (1 - competition))))
}

function sourcesFrom(grounding: unknown): { title: string; uri: string }[] {
  const chunks = (grounding as { groundingChunks?: { web?: { uri?: string; title?: string }; maps?: { uri?: string; title?: string } }[] })?.groundingChunks ?? []
  const out: { title: string; uri: string }[] = []
  for (const c of chunks) {
    const s = c.maps ?? c.web
    if (s?.uri && !out.some((o) => o.uri === s.uri)) out.push({ title: s.title ?? s.uri, uri: s.uri })
  }
  return out.slice(0, 12)
}

export async function analyseLocation(profile: Profile): Promise<LocationResult> {
  const ask = `Shop: "${profile.shopName}", a ${profile.shopType}, owner ${profile.ownerName}.
Address: ${profile.address} (${profile.country}).
Find the shop's own listing, the places that bring it customers, and its competitors nearby.`

  // Grounding with Google Maps needs a billed project; turn it on with KOSHA_MAPS_GROUNDING=1.
  const attempts: { source: LocationResult['source']; tools: object[] }[] = [
    ...(/^(1|true)$/i.test(String(import.meta.env.VITE_MAPS_GROUNDING ?? '')) ? [{ source: 'maps' as const, tools: [{ googleMaps: {} }] }] : []),
    { source: 'search', tools: [{ googleSearch: {} }] },
  ]
  let lastErr: unknown
  for (const a of attempts) {
    try {
      const res = await generate<Raw>({
        task: `location.${a.source}.v1`,
        system: SYSTEM,
        parts: [{ text: ask }],
        tools: a.tools as never,
        temperature: 0.2,
        maxOutputTokens: 8192,
      })
      const raw = res.data
      const places: Place[] = (raw.places ?? [])
        .filter((p) => p?.name)
        .map((p) => ({
          name: String(p.name),
          category: String(p.category ?? ''),
          kind: p.kind === 'competitor' ? 'competitor' : 'driver',
          distanceM: Math.max(30, Math.min(1500, Number(p.distanceM) || 400)),
          bearingDeg: ((Number(p.bearingDeg) || 0) % 360 + 360) % 360,
        }))
      const listing = {
        found: !!raw.listing?.found,
        name: raw.listing?.name ?? '',
        rating: raw.listing?.rating ?? null,
        reviews: raw.listing?.reviews ?? null,
        themes: raw.listing?.themes ?? [],
      }
      return {
        source: a.source,
        listing,
        places,
        areaSummary: raw.areaSummary ?? '',
        strength: strength(places, listing),
        sources: sourcesFrom(res.grounding),
        meta: res.meta,
      }
    } catch (e) {
      lastErr = e
      console.warn(`[location] ${a.source} grounding failed: ${(e as Error).message.slice(0, 120)}`)
    }
  }
  throw lastErr instanceof GeminiError ? lastErr : new GeminiError('Location lookup failed.')
}
