// Performance tier: decides how much motion and GPU work Kosha uses, so it stays smooth on old
// phones and PCs. Starts from what the device reports, then steps down if frames run slow.
export type Tier = 'high' | 'low'

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }

function detect(): Tier {
  try {
    const forced = sessionStorage.getItem('kosha-perf')
    if (forced === 'high' || forced === 'low') return forced
  } catch { /* storage blocked */ }
  const n = navigator as Nav
  const cores = n.hardwareConcurrency ?? 4
  const mem = n.deviceMemory ?? 4
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low'
  if (n.connection?.saveData) return 'low'
  if (cores <= 2 || mem <= 2 || (cores <= 4 && mem <= 4)) return 'low'
  return 'high'
}

let tier: Tier = typeof window === 'undefined' ? 'high' : detect()
const listeners = new Set<(t: Tier) => void>()
if (typeof document !== 'undefined') document.documentElement.dataset.perf = tier

export const getTier = () => tier
export function setTier(t: Tier) {
  if (t === tier) return
  tier = t
  document.documentElement.dataset.perf = t
  try { sessionStorage.setItem('kosha-perf', t) } catch { /* storage blocked */ }
  listeners.forEach((l) => l(t))
}
export function onTier(fn: (t: Tier) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Watches frame times; calls onSlow once when the average stays under ~28 fps for about two seconds. */
export class FrameGuard {
  private samples: number[] = []
  private fired = false
  private since = performance.now()
  constructor(private onSlow: () => void, private budgetMs = 36, private window = 60, private warmupMs = 2000) {}
  tick(dtMs: number) {
    if (this.fired || dtMs > 500) return // ignore tab switches and long pauses
    if (performance.now() - this.since < this.warmupMs) return // page load and shader compile are not a verdict
    this.samples.push(dtMs)
    if (this.samples.length > this.window) this.samples.shift()
    if (this.samples.length === this.window) {
      const avg = this.samples.reduce((a, b) => a + b, 0) / this.window
      if (avg > this.budgetMs) {
        this.fired = true
        this.onSlow()
      }
    }
  }
  reset() { this.samples = []; this.fired = false; this.since = performance.now() }
}
