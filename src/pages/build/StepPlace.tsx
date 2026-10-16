import { useEffect } from 'react'
import { ExternalLink, RotateCw, Star } from 'lucide-react'
import { useKosha } from '@/state/kosha'
import { Radar } from '@/components/kosha/Charts'
import { ErrorNote, MetaLine, Panel, Reading, Stat, StepHeader } from '@/components/kosha/ui'
import { cn } from '@/lib/utils'

export function StepPlace() {
  const profile = useKosha((s) => s.profile)
  const loc = useKosha((s) => s.location)
  const scan = useKosha((s) => s.scan)
  const stale = loc.status !== 'reading' && loc.forAddress !== profile.address

  useEffect(() => {
    if (profile.address.trim() && (loc.status === 'idle' || stale)) void scan()
  }, [profile.address, loc.status, stale, scan])

  const r = loc.result
  const drivers = r?.places.filter((p) => p.kind === 'driver') ?? []
  const comps = r?.places.filter((p) => p.kind === 'competitor') ?? []

  return (
    <>
      <StepHeader
        eyebrow="Step 4 · The neighbourhood"
        title="What brings customers to this shop?"
        sub="Gemini, grounded on live Google data, looks around the address for schools, offices, transport, markets and competing shops."
        right={
          <div className="flex items-center gap-3">
            <MetaLine meta={r?.meta} />
            <button onClick={() => scan()} disabled={loc.status === 'reading'} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm disabled:opacity-50">
              <RotateCw className={cn('size-3.5', loc.status === 'reading' && 'animate-spin')} /> Scan again
            </button>
          </div>
        }
      />
      {!profile.address.trim() && <ErrorNote error="Add the shop address in step 1 first." />}
      {loc.status === 'error' && <ErrorNote error={loc.error!} onRetry={() => scan()} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Panel className="relative">
          <Radar places={r?.places ?? []} scanning={loc.status === 'reading'} shopName={profile.shopName} />
          {loc.status === 'reading' && <Reading className="absolute inset-x-0 top-4 justify-center" text="Searching around the shop…" />}
          {r && (
            <span className="glass absolute left-4 top-4 rounded-full px-2.5 py-1 font-mono text-[10.5px] text-ink-2">
              Grounded with Google {r.source === 'maps' ? 'Maps' : 'Search'}
            </span>
          )}
        </Panel>
        <div className="min-w-0 space-y-4">
          {r && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Location strength" value={`${r.strength}/100`} tone="gold" />
                <Stat label="Bring customers" value={drivers.length} tone="jade" />
                <Stat label="Competitors" value={comps.length} tone="red" />
              </div>
              <Panel>
                <p className="leading-relaxed">{r.areaSummary}</p>
                {r.listing.found ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-ink-2">
                    <Star className="size-4 fill-gold text-gold" /> {r.listing.name}: {r.listing.rating ?? '–'} from {r.listing.reviews ?? 0} reviews{r.listing.themes.length ? ` · “${r.listing.themes.join('”, “')}”` : ''}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-ink-3">No map listing found for this shop. That is common for small shops and does not lower the score much.</p>
                )}
              </Panel>
              <Panel className="p-0 sm:p-0">
                <ul className="max-h-[300px] divide-y divide-line overflow-auto text-sm">
                  {[...r.places].sort((a, b) => a.distanceM - b.distanceM).map((p, i) => (
                    <li key={p.name + i} className="flex items-center gap-3 px-5 py-2.5">
                      <span className={cn('size-2 shrink-0 rounded-full', p.kind === 'driver' ? 'bg-jade' : 'bg-vermilion')} />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-ink-3">{p.category}</span>
                      <span className="w-14 text-right font-mono text-xs tabular text-ink-2">{p.distanceM} m</span>
                    </li>
                  ))}
                </ul>
              </Panel>
              {r.sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {r.sources.slice(0, 6).map((s) => (
                    <a key={s.uri} href={s.uri} target="_blank" rel="noreferrer" className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-full border border-line px-2.5 py-1 text-xs text-ink-2 hover:text-ink">
                      <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{s.title}</span>
                    </a>
                  ))}
                </div>
              )}
              <p className="text-xs text-ink-3">Distances are Gemini's estimates from grounded results. A field officer can confirm them on a visit.</p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
