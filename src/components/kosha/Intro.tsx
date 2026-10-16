import { useEffect, useRef, useState } from 'react'
import { stagger, useAnimate, useReducedMotion } from 'motion/react'

// Opening sequence: a bahi-khata ledger rises, opens, its lines are read, then the book turns
// over in one 3D flip and becomes the Kosha passport. Plays once per session on the home page.

const LINES = [
  { d: '22/9', t: 'बिक्री नकद', a: '5,480' },
  { d: '24/9', t: 'माल अग्रवाल', a: '33,206' },
  { d: '9/24', t: 'Benta cash', a: '4,620' },
  { d: '9/25', t: 'Bili stock', a: '20,397' },
  { d: '18/9', t: 'Jualan', a: '1.720.000' },
]

const SPRING = { type: 'spring', stiffness: 120, damping: 18, mass: 0.9 } as const
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Intro({ onDone }: { onDone: () => void }) {
  const [scope, animate] = useAnimate()
  const reduced = useReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const finished = useRef(false)

  const finish = async () => {
    if (finished.current) return
    finished.current = true
    setLeaving(true)
    try {
      await Promise.all([
        animate('.k-obj', { z: 260, opacity: 0, rotateX: 0 }, { duration: 0.42, ease: [0.4, 0, 1, 1] }),
        animate(scope.current, { opacity: 0 }, { duration: 0.45, ease: 'easeIn', delay: 0.08 }),
      ])
    } catch { /* unmounted */ }
    onDone()
  }

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (reduced) {
        await animate('.k-obj', { opacity: 1 }, { duration: 0.3 })
        await animate('.k-obj', { rotateY: 180 }, { duration: 0 })
        await animate('.k-word span, .k-tag, .k-stamp', { opacity: 1 }, { duration: 0.3 })
        await sleep(700)
        return finish()
      }
      // 1. The ledger rises out of the dark.
      await animate('.k-obj', { opacity: [0, 1], z: [-520, 0], rotateX: [38, 14], rotateY: [-24, -8], y: [60, 0] }, SPRING)
      if (!alive) return
      // 2. Cover swings open; the spine moves to the centre.
      const half = ((scope.current as HTMLElement).querySelector('.k-obj') as HTMLElement).offsetWidth / 2
      await Promise.all([
        animate('.k-cover', { rotateY: -168 }, { duration: 0.85, ease: [0.65, 0, 0.35, 1] }),
        animate('.k-obj', { x: half, rotateY: 0, rotateX: 18 }, { duration: 0.85, ease: [0.65, 0, 0.35, 1] }),
      ])
      if (!alive) return
      // 3. Lines write themselves, then the beam reads the page.
      animate('.k-line', { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 0.32, delay: stagger(0.11), ease: 'easeOut' })
      await sleep(380)
      animate('.k-beam', { top: ['-12%', '104%'], opacity: [0, 1, 1, 0] }, { duration: 0.9, ease: [0.45, 0, 0.55, 1] })
      animate('.k-tick', { opacity: [0, 1], scale: [0.4, 1] }, { delay: stagger(0.12, { startDelay: 0.25 }), duration: 0.25 })
      await sleep(1000)
      if (!alive) return
      // 4. Close, then one full turn reveals the passport on the other side.
      await Promise.all([
        animate('.k-cover', { rotateY: 0 }, { duration: 0.5, ease: [0.65, 0, 0.35, 1] }),
        animate('.k-obj', { x: 0 }, { duration: 0.5, ease: [0.65, 0, 0.35, 1] }),
      ])
      if (!alive) return
      animate('.k-obj', { rotateY: 180, rotateX: 6, scale: 1.06 }, { type: 'spring', stiffness: 70, damping: 14 })
      await sleep(450)
      animate('.k-seal path', { pathLength: [0, 1] }, { duration: 0.7, ease: 'easeInOut' })
      animate('.k-stamp', { opacity: [0, 1], scale: [1.8, 1], rotate: [-18, -10] }, { delay: 0.55, type: 'spring', stiffness: 420, damping: 16 })
      animate('.k-word span', { opacity: [0, 1], y: [18, 0], filter: ['blur(8px)', 'blur(0px)'] }, { delay: stagger(0.06, { startDelay: 0.2 }), duration: 0.5 })
      animate('.k-tag', { opacity: [0, 1], y: [10, 0] }, { delay: 0.65, duration: 0.5 })
      await sleep(1500)
      if (alive) await finish()
    }
    void run()
    const key = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && finish()
    addEventListener('keydown', key)
    return () => {
      alive = false
      removeEventListener('keydown', key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={scope}
      role="status"
      aria-label="Opening Kosha"
      onClick={finish}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#05070d] text-[#f6ead0]"
      style={{ ['--w' as string]: 'clamp(150px, 38vw, 300px)', ['--h' as string]: 'calc(var(--w) * 1.36)' }}
    >
      {/* soft gold glow and a faint ruled floor */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[44%] size-[min(120vw,900px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(242_181_68/0.16),transparent_60%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          transform: 'perspective(600px) rotateX(62deg)',
          transformOrigin: 'bottom',
          maskImage: 'linear-gradient(to top, #000, transparent)',
          WebkitMaskImage: 'linear-gradient(to top, #000, transparent)',
        }}
      />

      <div aria-hidden className="relative" style={{ perspective: '1400px', width: 'calc(var(--w) * 2.2)', height: 'calc(var(--h) * 1.25)' }}>
        <div
          className="k-obj absolute left-1/2 top-1/2 opacity-0"
          style={{ width: 'var(--w)', height: 'var(--h)', marginLeft: 'calc(var(--w) / -2)', marginTop: 'calc(var(--h) / -2)', transformStyle: 'preserve-3d' }}
        >
          {/* Page block (right page, facing the viewer) */}
          <div className="absolute inset-0 overflow-hidden rounded-r-[6px] rounded-l-[2px] [backface-visibility:hidden]" style={{ transform: 'translateZ(0px)', background: '#f3ead2', boxShadow: 'inset 6px 0 14px -6px rgb(0 0 0 / 0.35)' }}>
            <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 calc(var(--h) / 11 - 1px), rgb(70 110 160 / 0.3) calc(var(--h) / 11 - 1px) calc(var(--h) / 11))', backgroundPosition: '0 calc(var(--h) * 0.2)' }} />
            <div className="absolute inset-y-0 left-[17%] w-px bg-[#d77a7a]/70" />
            <div className="absolute inset-x-[6%] top-[6%] flex items-baseline justify-between whitespace-nowrap font-['Kalam',cursive] text-[#22325a]">
              <span className="text-[calc(var(--w)/13)] font-bold">खाता</span>
              <span className="text-[calc(var(--w)/20)] opacity-70">सितंबर 2026</span>
            </div>
            <div className="absolute inset-x-0 flex flex-col" style={{ top: 'calc(var(--h) * 0.2)' }}>
              {LINES.map((l) => (
                <div key={l.d + l.t} className="k-line relative flex items-end pr-[5%] font-['Kalam',cursive] text-[#22325a]" style={{ clipPath: 'inset(0 100% 0 0)', fontSize: 'calc(var(--w) / 16)', height: 'calc(var(--h) / 11)', paddingBottom: 'calc(var(--h) / 90)' }}>
                  <span className="w-[17%] shrink-0 text-center text-[0.82em] opacity-75">{l.d}</span>
                  <span className="min-w-0 flex-1 truncate pl-[4%]">{l.t}</span>
                  <span className="tabular-nums">{l.a}/-</span>
                  <span className="k-tick ml-[3%] grid size-[calc(var(--w)/14)] shrink-0 place-items-center rounded-full bg-[#0f9f8a] text-[calc(var(--w)/22)] text-white opacity-0">✓</span>
                </div>
              ))}
            </div>
            <div className="k-beam absolute inset-x-0 h-[12%] opacity-0" style={{ background: 'linear-gradient(to bottom, transparent, rgb(62 224 196 / 0.38))', borderBottom: '2px solid #3ee0c4', boxShadow: '0 8px 26px -4px rgb(62 224 196 / 0.8)' }} />
          </div>
          {/* page edges for thickness */}
          <div className="absolute right-0 top-[1%] h-[98%] w-[10px] [backface-visibility:hidden]" style={{ transform: 'rotateY(90deg) translateZ(0px)', transformOrigin: 'right', background: 'repeating-linear-gradient(90deg, #e8dcbc 0 1px, #cfc29f 1px 2px)' }} />

          {/* Passport face, on the back of the book */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[10px] [backface-visibility:hidden]"
            style={{ transform: 'rotateY(180deg) translateZ(10px)', background: 'radial-gradient(130% 90% at 100% 0%, #1d3456, #09101e 62%)', border: '1px solid rgb(242 181 68 / 0.35)', boxShadow: '0 30px 80px -20px rgb(242 181 68 / 0.35)' }}
          >
            <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'repeating-radial-gradient(circle at 80% 15%, rgb(217 164 65 / 0.35) 0 1px, transparent 1px 9px)' }} />
            <div className="absolute left-[9%] top-[8%] font-mono text-[calc(var(--w)/24)] tracking-[0.2em] text-[#d9a441]">CREDIT PASSPORT</div>
            <svg viewBox="0 0 64 64" className="k-seal absolute left-1/2 top-[44%] w-[46%] -translate-x-1/2 -translate-y-1/2">
              <path d="M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z" fill="none" stroke="#f2b544" strokeWidth="2.6" strokeLinejoin="round" />
              <circle cx="32" cy="31" r="8.5" fill="none" stroke="#f2b544" strokeWidth="2.4" />
              <path d="M32 22.5v17M23.5 31h17" stroke="#ffd27a" strokeWidth="1.8" />
            </svg>
            <div className="absolute inset-x-0 bottom-[16%] text-center font-['Fraunces',serif] text-[calc(var(--w)/7)] font-semibold tracking-[0.18em]">KOSHA</div>
            <div className="absolute inset-x-[9%] bottom-[7%] overflow-hidden whitespace-nowrap font-mono text-[calc(var(--w)/30)] tracking-[0.12em] text-[#f6ead0]/55">KP&lt;JAPAC&lt;&lt;EVERY&lt;CORNER&lt;SHOP&lt;&lt;&lt;</div>
            <div className="k-stamp absolute right-[7%] top-[16%] rounded-md border-2 border-[#3ee0c4] px-[6%] py-[2%] text-center font-['Fraunces',serif] text-[calc(var(--w)/17)] font-bold uppercase leading-tight text-[#3ee0c4] opacity-0">
              Verified
            </div>
          </div>

          {/* Cover: red cloth outside, ruled left page inside */}
          <div className="k-cover absolute inset-0" style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', transform: 'translateZ(10px)' }}>
            <div
              className="absolute inset-0 rounded-r-[8px] rounded-l-[3px] [backface-visibility:hidden]"
              style={{ background: 'linear-gradient(135deg, #a3241c, #6e130f 70%)', boxShadow: 'inset 10px 0 18px -8px rgb(0 0 0 / 0.55), inset 0 0 0 1px rgb(255 210 122 / 0.15)' }}
            >
              <div className="absolute inset-[8%] rounded-[6px] border border-[#ffd27a]/45" />
              <div className="absolute inset-x-0 top-[30%] text-center font-['Tiro_Devanagari_Hindi',serif] text-[calc(var(--w)/5.6)] text-[#ffd27a]">कोष</div>
              <div className="absolute inset-x-0 top-[52%] text-center font-mono text-[calc(var(--w)/20)] tracking-[0.3em] text-[#ffd27a]/80">BAHI · KHATA</div>
              <svg viewBox="0 0 64 64" className="absolute bottom-[12%] left-1/2 w-[20%] -translate-x-1/2 opacity-80">
                <circle cx="32" cy="32" r="22" fill="none" stroke="#ffd27a" strokeWidth="2" />
                <path d="M32 14v36M14 32h36" stroke="#ffd27a" strokeWidth="1.5" />
              </svg>
            </div>
            <div className="absolute inset-0 rounded-l-[6px] [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)', background: '#efe5ca', boxShadow: 'inset -6px 0 14px -6px rgb(0 0 0 / 0.35)' }}>
              <div className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 calc(var(--h) / 11 - 1px), rgb(70 110 160 / 0.24) calc(var(--h) / 11 - 1px) calc(var(--h) / 11))', backgroundPosition: '0 calc(var(--h) * 0.2)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="relative -mt-[calc(var(--h)*0.05)] flex flex-col items-center gap-2 px-6 text-center">
        <div className="k-word font-['Fraunces',serif] text-[clamp(34px,7vw,56px)] font-medium leading-none tracking-tight" aria-hidden>
          {'Kosha'.split('').map((c, i) => (
            <span key={i} className="inline-block opacity-0">{c}</span>
          ))}
        </div>
        <p className="k-tag max-w-[30ch] text-balance text-[clamp(13px,2.6vw,16px)] text-[#f6ead0]/65 opacity-0">The AI credit passport for every corner shop</p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          void finish()
        }}
        className="absolute bottom-[max(20px,env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] min-h-11 rounded-full border border-white/15 px-5 text-sm text-[#f6ead0]/70 transition hover:border-white/35 hover:text-[#f6ead0] focus-visible:outline-2 focus-visible:outline-[#f2b544]"
        style={{ opacity: leaving ? 0 : 1 }}
      >
        Skip
      </button>
    </div>
  )
}
