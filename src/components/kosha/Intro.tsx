import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { IntroScene } from './intro/scene'

// Opening sequence. Particles of ink form a handwritten ledger, a scan reads it, and the ink flows
// into the Kosha passport. Three short lines of copy carry the story; the wordmark lands last.

const CAPTIONS = [
  { from: 0.15, to: 1.1, text: 'Every shop keeps a ledger.' },
  { from: 1.15, to: 2.05, text: 'Gemini reads every line.' },
  { from: 2.1, to: 3.2, text: 'And turns it into trust.' },
]
const WORDMARK_AT = 3.25
const EXIT = 0.5

const ease = [0.22, 1, 0.36, 1] as const

export function Intro({ onDone }: { onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const [t, setT] = useState(0)
  const [ready, setReady] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const leave = useRef<() => void>(() => {})

  useEffect(() => {
    let scene: IntroScene | null = null
    let raf = 0
    let alive = true
    let exitAt = 0
    let t0 = 0
    let shown = -1

    const finish = () => {
      if (exitAt || !alive) return
      exitAt = performance.now()
      setLeaving(true)
      if (!scene) setTimeout(onDone, EXIT * 1000 + 150)
    }
    leave.current = finish

    // Dev only: ?introAt=2.4 freezes the sequence at that second, for checking frames.
    const frozen = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('introAt') ?? NaN) : NaN
    const loop = (now: number) => {
      if (!alive) return
      const time = Number.isFinite(frozen) ? frozen : (now - t0) / 1000
      const e = exitAt ? Math.min(1, (now - exitAt) / (EXIT * 1000)) : 0
      scene?.setExit(e * e)
      scene?.render(time)
      // only push to React when the caption step changes
      const step = time >= WORDMARK_AT ? 99 : CAPTIONS.findIndex((c) => time >= c.from && time < c.to)
      if (step !== shown) {
        shown = step
        setT(time)
      }
      if (!exitAt && time > 4.6 && !Number.isFinite(frozen)) finish()
      if (e >= 1) return onDone()
      raf = requestAnimationFrame(loop)
    }

    const boot = async () => {
      if (reduced) {
        setReady(true)
        setT(WORDMARK_AT)
        setTimeout(finish, 1100)
        return
      }
      try {
        const { createIntroScene } = await import('./intro/scene')
        if (!alive || !canvas.current) return
        scene = await createIntroScene(canvas.current)
        if (!alive) return scene.dispose()
        setReady(true)
        t0 = performance.now()
        raf = requestAnimationFrame(loop)
      } catch {
        // No WebGL: show the wordmark briefly instead.
        setReady(true)
        setT(WORDMARK_AT)
        setTimeout(finish, 1200)
      }
    }
    void boot()

    const onResize = () => scene?.resize()
    const onMove = (e: PointerEvent) => scene?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1)
    const onKey = (e: KeyboardEvent) => ['Escape', 'Enter', ' '].includes(e.key) && finish()
    addEventListener('resize', onResize)
    addEventListener('pointermove', onMove)
    addEventListener('keydown', onKey)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      removeEventListener('resize', onResize)
      removeEventListener('pointermove', onMove)
      removeEventListener('keydown', onKey)
      scene?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const caption = CAPTIONS.find((c) => t >= c.from && t < c.to)
  const wordmark = t >= WORDMARK_AT

  return (
    <motion.div
      role="status"
      aria-label="Opening Kosha"
      className="fixed inset-0 z-[100] overflow-hidden bg-[#05070d] text-[#f6ead0]"
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: EXIT, ease: [0.4, 0, 1, 1], delay: leaving ? 0.12 : 0 }}
      onClick={() => leave.current()}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
      {/* vignette keeps the edges cinematic */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_40%,transparent_35%,rgb(2_3_7/0.85))]" />

      <div className="pointer-events-none absolute inset-x-0 bottom-[max(11vh,104px)] sm:bottom-[max(9vh,72px)] flex flex-col items-center px-6 text-center">
        <AnimatePresence mode="wait">
          {ready && caption && !wordmark && (
            <motion.p
              key={caption.text}
              initial={{ opacity: 0, y: 14, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(8px)', transition: { duration: 0.22 } }}
              transition={{ duration: 0.5, ease }}
              className="font-display text-balance text-[clamp(26px,4.6vw,52px)] font-medium leading-[1.08] tracking-[-0.025em]"
            >
              {caption.text}
            </motion.p>
          )}
          {ready && wordmark && (
            <motion.div key="mark" className="flex flex-col items-center gap-3" initial="hide" animate="show" variants={{ show: { transition: { staggerChildren: 0.05 } } }}>
              <h1 aria-label="Kosha" className="font-display flex text-[clamp(48px,9vw,104px)] font-medium leading-none tracking-[-0.035em]">
                {'Kosha'.split('').map((c, i) => (
                  <motion.span
                    key={i}
                    className="text-gold-grad inline-block"
                    variants={{ hide: { opacity: 0, y: '0.35em', filter: 'blur(12px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease } } }}
                  >
                    {c}
                  </motion.span>
                ))}
              </h1>
              <motion.p variants={{ hide: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease, delay: 0.25 } } }} className="text-balance text-[clamp(14px,1.8vw,18px)] text-[#f6ead0]/70">
                The AI credit passport for every corner shop
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="pointer-events-none absolute left-[max(20px,env(safe-area-inset-left))] top-[max(20px,env(safe-area-inset-top))] font-mono text-[11px] tracking-[0.18em] text-[#f6ead0]/45">
        KOSHA · कोष
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          leave.current()
        }}
        className="absolute bottom-[max(20px,env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] min-h-11 rounded-full border border-white/15 bg-white/[0.03] px-5 text-sm text-[#f6ead0]/70 backdrop-blur transition hover:border-white/35 hover:text-[#f6ead0] focus-visible:outline-2 focus-visible:outline-[#f2b544]"
        style={{ opacity: leaving ? 0 : 1 }}
      >
        Skip intro
      </button>
    </motion.div>
  )
}
