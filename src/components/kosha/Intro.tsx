import { useEffect, useRef } from 'react'
import { getTier } from '@/lib/perf'

// Opening sequence: a kirana street at sunset. The shop's khata and bills fly out towards the
// viewer, the street racks out of focus, and they fold into the credit passport (about 4 seconds).
// The engine and GSAP load only when the intro plays, so the rest of the app stays light.

export function Intro({ onDone }: { onDone: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    const el = host.current
    if (!el) return
    let stop: (() => void) | undefined
    let alive = true
    const prev = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.dataset.intro = 'on'
    Promise.all([import('./intro/engine.js'), import('./intro/engine.css')])
      .then(([engine]) => {
        if (alive) stop = engine.startIntro(el, { tier: getTier(), onDone: () => done.current() })
      })
      .catch(() => alive && done.current())
    return () => {
      alive = false
      stop?.()
      document.documentElement.style.overflow = prev
      delete document.documentElement.dataset.intro
    }
  }, [])

  return <div ref={host} className="fixed inset-0 z-[100]" aria-label="Kosha opening: a corner shop at sunset" role="img" />
}
