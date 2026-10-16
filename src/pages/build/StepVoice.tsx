import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue } from 'motion/react'
import { Check, ChevronLeft, ChevronRight, Keyboard, Mic, Square, Volume2 } from 'lucide-react'
import SiriOrb from '@/components/smoothui/siri-orb'
import type { AIState } from '@/components/smoothui/ai-core'
import { QUESTIONS, LANGUAGES } from '@shared/questions'
import { useKosha } from '@/state/kosha'
import { Recorder, say, stopSpeaking } from '@/lib/audio'
import { ErrorNote, Panel, Reading, StepHeader, fieldCls } from '@/components/kosha/ui'
import { cn } from '@/lib/utils'

const FACT_LABELS: Record<string, string> = {
  years: 'Years running', suppliers: 'Suppliers', purchasesPerWeek: 'Buying trips a week', busyDays: 'Busy days', peakSeasons: 'Peak seasons',
  creditOutstanding: 'Owed by customers', purpose: 'Loan for', purposeCost: 'Cost', extraMonthlyProfit: 'Extra profit a month',
}

export function StepVoice() {
  const profile = useKosha((s) => s.profile)
  const answers = useKosha((s) => s.answers)
  const sampleAnswers = useKosha((s) => s.sampleAnswers)
  const answer = useKosha((s) => s.answer)
  const [qi, setQi] = useState(0)
  const [mode, setMode] = useState<'voice' | 'type'>('voice')
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const rec = useRef<Recorder | null>(null)
  const amp = useMotionValue(0)
  const raf = useRef(0)

  const q = QUESTIONS[qi]
  const a = answers[q.id]
  const local = q.local[profile.language]
  const lang = LANGUAGES[profile.language]?.speech ?? 'en-US'
  const done = QUESTIONS.filter((x) => answers[x.id]?.status === 'done').length

  useEffect(() => {
    setText(sampleAnswers[q.id] ?? '')
    setMicError(null)
  }, [q.id, sampleAnswers])
  useEffect(() => () => { rec.current?.cancel(); stopSpeaking(); cancelAnimationFrame(raf.current) }, [])

  const meter = (stream: MediaStream) => {
    const ctx = new AudioContext()
    const an = ctx.createAnalyser()
    an.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(an)
    const data = new Float32Array(an.fftSize)
    const tick = () => {
      an.getFloatTimeDomainData(data)
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
      amp.set(Math.min(1, amp.get() * 0.6 + rms * 3.2 * 0.4))
      raf.current = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf.current); void ctx.close(); amp.set(0) }
  }
  const stopMeter = useRef<() => void>(() => {})

  const toggleRecord = async () => {
    setMicError(null)
    if (recording) {
      setRecording(false)
      stopMeter.current()
      try {
        const wav = await rec.current!.stop()
        if (wav.size < 8000) return setMicError('That was too short. Hold the button and speak for a few seconds.')
        await answer(q.id, { audio: wav })
      } catch {
        setMicError('Could not process the recording. Try again or type the answer.')
      }
      return
    }
    try {
      stopSpeaking()
      rec.current = new Recorder()
      await rec.current.start()
      stopMeter.current = meter(rec.current.stream!)
      setRecording(true)
    } catch {
      setMicError('Microphone access was blocked. Allow the microphone in your browser, or type the answer instead.')
      setMode('type')
    }
  }

  const playQuestion = async () => {
    setSpeaking(true)
    try {
      await say(local ?? q.english, local ? lang : 'en-US')
    } catch (e) {
      setMicError((e as Error).message)
    } finally {
      setSpeaking(false)
    }
  }

  const state: AIState = recording ? 'listening' : a?.status === 'reading' ? 'thinking' : speaking ? 'streaming' : a?.status === 'done' ? 'done' : 'idle'

  return (
    <>
      <StepHeader
        eyebrow="Step 5 · Voice interview"
        title="Five questions, in the owner's own words"
        sub="Speak in any language. Gemini listens, translates, and checks the answers against the documents. It never judges accent or tone."
        right={<span className="font-mono text-sm text-ink-2">{done} of {QUESTIONS.length} answered</span>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Panel className="flex flex-col items-center gap-6 py-10">
          <div className="flex gap-1.5">
            {QUESTIONS.map((x, i) => (
              <button key={x.id} onClick={() => setQi(i)} aria-label={`Question ${i + 1}`} className={cn('h-1.5 rounded-full transition-all', i === qi ? 'w-8 bg-gold' : answers[x.id]?.status === 'done' ? 'w-4 bg-jade' : 'w-4 bg-line-2')} />
            ))}
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-gold/10 blur-3xl" />
            <SiriOrb size="200px" state={state} amplitude={amp} colors={{ bg: 'oklch(0.14 0.02 260)', c1: 'oklch(0.82 0.15 80)', c2: 'oklch(0.74 0.14 175)', c3: 'oklch(0.7 0.18 45)', c4: 'oklch(0.85 0.1 95)' }} />
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={q.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="max-w-md text-center">
              {local && <p className="font-local text-2xl leading-snug">{local}</p>}
              <p className={cn('text-ink-2', local ? 'mt-2 text-sm' : 'font-display text-2xl text-ink')}>{q.english}</p>
            </motion.div>
          </AnimatePresence>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={playQuestion} disabled={speaking} className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm disabled:opacity-60">
              <Volume2 className="size-4" /> {speaking ? 'Speaking…' : 'Hear the question'}
            </button>
            <button onClick={() => setMode(mode === 'voice' ? 'type' : 'voice')} className="glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm">
              {mode === 'voice' ? <><Keyboard className="size-4" /> Type instead</> : <><Mic className="size-4" /> Speak instead</>}
            </button>
          </div>
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel>
            {mode === 'voice' ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={toggleRecord}
                  disabled={a?.status === 'reading'}
                  className={cn('grid size-20 place-items-center rounded-full text-[#1b1203] shadow-lg transition disabled:opacity-50', recording ? 'bg-vermilion text-white shadow-[0_0_0_10px_rgb(255_106_85/0.18)]' : 'bg-gradient-to-br from-gold-2 to-gold shadow-[0_10px_40px_-10px_rgb(var(--k-gold-rgb)/0.9)]')}
                  aria-label={recording ? 'Stop recording' : 'Start recording'}
                >
                  {recording ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}
                </motion.button>
                <p className="text-sm text-ink-2">{recording ? 'Listening… tap to finish' : 'Tap and answer out loud'}</p>
                {sampleAnswers[q.id] && !recording && (
                  <button onClick={() => setMode('type')} className="text-sm text-gold underline-offset-4 hover:underline">Use the sample shop's answer</button>
                )}
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (text.trim()) void answer(q.id, { text })
                }}
              >
                <textarea id={`answer-${q.id}`} rows={4} className={cn(fieldCls, 'font-local')} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type the answer in any language" />
                <button disabled={!text.trim() || a?.status === 'reading'} className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-[#1b1203] disabled:opacity-50">Send answer</button>
              </form>
            )}
            {micError && <div className="mt-3"><ErrorNote error={micError} /></div>}
            {a?.status === 'reading' && <Reading className="mt-4" text="Gemini is listening to the answer…" />}
            {a?.status === 'error' && <div className="mt-3"><ErrorNote error={a.error!} /></div>}
          </Panel>

          {a?.answer && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Panel>
                <div className="flex items-center gap-2 text-sm text-jade"><Check className="size-4" /> Understood</div>
                <p className="font-local mt-3 text-lg leading-relaxed">“{a.answer.transcript}”</p>
                <p className="mt-1.5 text-ink-2">{a.answer.english}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(a.answer.facts).filter(([, v]) => v !== null && v !== '' && v !== 0).map(([k, v]) => (
                    <span key={k} className="rounded-full border border-line bg-glass px-3 py-1 text-xs">
                      <span className="text-ink-3">{FACT_LABELS[k] ?? k}:</span> {typeof v === 'number' && /cost|profit|credit/i.test(k) ? v.toLocaleString() : String(v)}
                    </span>
                  ))}
                </div>
              </Panel>
            </motion.div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setQi(Math.max(0, qi - 1))} disabled={qi === 0} className="glass inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm disabled:opacity-40"><ChevronLeft className="size-4" /> Previous</button>
            <button onClick={() => setQi(Math.min(QUESTIONS.length - 1, qi + 1))} disabled={qi === QUESTIONS.length - 1} className="glass inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm disabled:opacity-40">Next question <ChevronRight className="size-4" /></button>
          </div>
        </div>
      </div>
    </>
  )
}
