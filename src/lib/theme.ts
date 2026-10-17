import { useSyncExternalStore } from 'react'

// One place that changes the theme. Everything switches in the same frame: transitions are paused while
// the class flips (so nothing is caught half-way between themes), canvases are told to repaint, and other
// open tabs follow along. Where the browser supports it, the change crossfades as one picture.
export type Theme = 'light' | 'dark'

const listeners = new Set<() => void>()
export const getTheme = (): Theme => (document.documentElement.classList.contains('dark') ? 'dark' : 'light')
export const onTheme = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

function apply(t: Theme) {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.classList.toggle('dark', t === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#05070d' : '#f3f4f8')
  void root.offsetHeight // apply the new colours now, with transitions off
  listeners.forEach((l) => l())
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
}

export function setTheme(t: Theme, persist = true) {
  if (t === getTheme()) return
  if (persist) try { localStorage.setItem('kosha-theme', t) } catch { /* storage blocked */ }
  type VT = Document & { startViewTransition?: (cb: () => void) => unknown }
  const d = document as VT
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.perf === 'low'
  if (d.startViewTransition && !calm) d.startViewTransition(() => apply(t))
  else apply(t)
}

export const useTheme = () => useSyncExternalStore(onTheme, getTheme, () => 'dark' as Theme)

// another tab changed the theme
if (typeof window !== 'undefined') {
  addEventListener('storage', (e) => {
    if (e.key === 'kosha-theme' && (e.newValue === 'light' || e.newValue === 'dark')) setTheme(e.newValue, false)
  })
}
