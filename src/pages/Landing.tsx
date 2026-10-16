import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, BookOpenText, Mic, Receipt, ScanLine, ShieldCheck, Smartphone, Store, Zap, MapPin } from 'lucide-react'
import type { Assessment } from '@shared/types'
import { MagneticButton } from '@/components/unlumen-ui/magnetic-button'
import { ShimmeringText } from '@/components/unlumen-ui/shimmering-text'
import { TextReveal } from '@/components/unlumen-ui/text-reveal'
import { Tilt } from '@/components/unlumen-ui/tilt'
import { PassportCard } from '@/components/kosha/PassportCard'
import { loadSamples, type SampleShop } from '@/lib/samples'
import { COUNTRIES } from '@/lib/format'
import { useKosha } from '@/state/kosha'

// Example card for the hero. Clearly labelled as an example on the page.
const EXAMPLE: Assessment = {
  id: 'KSH-IN-EXAMPLE',
  createdAt: '2026-10-16T09:00:00.000Z',
  profile: { shopName: 'Sharma General Store', ownerName: 'Sunita Sharma', address: 'Karve Road, Kothrud, Pune', shopType: 'Kirana (general store)', since: 2015, country: 'IN', language: 'hi', currency: 'INR' },
  metrics: { days: 21, cashDaily: 5750, digitalDaily: 8250, dailySales: 14000, monthlySales: 420000, purchases30: 364000, margin: 0.14, grossProfit: 58800, opex30: 19000, surplus: 39800, digitalShare: 0.59, creditOutstanding: 4500, creditShare: 0.01, bookkeeping: 1, salesCv: 0.1, invoiceMatch: 1, billsOnTime: 1, billMonths: 3, yearsInBusiness: 11 },
  checks: [],
  pillars: [],
  score: 768,
  band: 'A−',
  offer: { status: 'offer', limit: 145000, tenureMonths: 12, annualRate: 0.24, flatEmi: 13711, schedule: [], emiToSurplus: 0.34 },
  purpose: null,
  reasons: [],
  explanation: { local: '', english: '', localLang: 'hi' },
  sourcesUsed: ['ledger', 'invoice', 'payments', 'electricity', 'location', 'interview'],
  geminiCalls: 7,
}

const SOURCES = [
  { icon: BookOpenText, title: 'Handwritten ledger', text: 'Khata, buku catatan or listahan. Gemini reads Devanagari, Bahasa and Taglish handwriting line by line.' },
  { icon: Receipt, title: 'Supplier bills', text: 'Wholesale bills prove real stock buying, and supplier credit terms show who already trusts the shop.' },
  { icon: Smartphone, title: 'Digital payments', text: 'UPI, QRIS or e-wallet history. Edited screenshots are caught before they count.' },
  { icon: Zap, title: 'Electricity bills', text: 'Months of on-time bill payments: the closest thing to a credit history for a shop that has none.' },
  { icon: MapPin, title: 'Neighbourhood', text: 'Gemini grounded on Google Maps and Search finds the schools, stops and competitors around the shop.' },
  { icon: Mic, title: 'A 2-minute voice chat', text: 'Five questions in the owner\'s own language. The answers are checked against the documents.' },
]

const STEPS = [
  { title: 'Read', text: 'Gemini turns photos of paper into structured, translated records, with a box around every line it read.' },
  { title: 'Cross-check', text: 'One document can be faked. Five independent sources agreeing is very hard to fake.' },
  { title: 'Score', text: 'Capacity, character, conditions and stability. Every point is traced back to a document.' },
  { title: 'Explain', text: 'A limit, a repayment plan that follows festival seasons, and reasons in the owner\'s language.' },
]

export default function Landing() {
  const nav = useNavigate()
  const [samples, setSamples] = useState<SampleShop[]>([])
  const loadSample = useKosha((s) => s.loadSample)
  const reset = useKosha((s) => s.reset)
  useEffect(() => void loadSamples().then(setSamples), [])

  const open = async (s: SampleShop) => {
    nav('/build')
    await loadSample(s)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-12 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
            <span className="size-1.5 animate-pulse rounded-full bg-jade" />
            <ShimmeringText text="Built on Gemini · Google Cloud · for every shop in JAPAC" className="font-mono text-[11px] tracking-wide" duration={2.6} />
          </div>
          <h1 className="font-display mt-6 text-[clamp(40px,6.4vw,76px)] font-medium leading-[1.02]">
            {['Every', 'corner', 'shop', 'has', 'a'].map((w, i) => (
              <motion.span key={w} className="mr-[0.25em] inline-block" initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.1 + i * 0.07, duration: 0.6 }}>
                {w}
              </motion.span>
            ))}
            <motion.span className="text-gold-grad inline-block italic" initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.5, duration: 0.7 }}>
              treasury of trust.
            </motion.span>
          </h1>
          <TextReveal
            text="Kosha reads the handwritten ledger, supplier bills, payments and electricity bills a shop already keeps, cross-checks them with Gemini, and issues a credit passport any lender can verify in seconds."
            className="mt-6 max-w-[56ch] text-lg text-ink-2"
            staggerDelay={0.018}
          />
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <MagneticButton
              size="lg"
              className="h-12 rounded-full bg-gradient-to-r from-gold-2 to-gold px-7 text-[15px] font-semibold text-[#1b1203] shadow-[0_10px_40px_-10px_rgb(var(--k-gold-rgb)/0.8)] hover:opacity-95"
              onClick={() => (samples[0] ? open(samples[0]) : nav('/build'))}
            >
              Try a sample shop <ArrowRight className="size-4" />
            </MagneticButton>
            <MagneticButton
              size="lg"
              variant="ghost"
              className="glass h-12 rounded-full px-6 text-[15px]"
              onClick={() => {
                reset()
                nav('/build')
              }}
            >
              <Store className="size-4" /> Build your own
            </MagneticButton>
          </div>
          <p className="mt-6 max-w-[52ch] text-sm text-ink-3">In Kautilya's Arthashastra, kosha is the kingdom's treasury. Here it is the hidden wealth in a shop's own records.</p>
        </div>
        <motion.div initial={{ opacity: 0, y: 30, rotate: 2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="relative">
          <div className="absolute -inset-10 -z-10 rounded-full bg-gold/10 blur-3xl" />
          <PassportCard a={EXAMPLE} />
          <p className="mt-3 text-center font-mono text-[11px] text-ink-3">Example passport · open a sample shop to build a real one with Gemini</p>
        </motion.div>
      </section>

      {/* Sources */}
      <section className="py-16">
        <div className="eyebrow">What Kosha reads</div>
        <h2 className="font-display mt-2 max-w-[24ch] text-4xl">No bank statement? The shop already keeps everything a lender needs.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SOURCES.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="glass rounded-2xl p-5">
              <s.icon className="size-6 text-gold" />
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How */}
      <section className="py-16">
        <div className="eyebrow">How Kosha decides</div>
        <h2 className="font-display mt-2 text-4xl">Four steps, every one explainable.</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="glass edge-gold relative rounded-2xl p-5">
              <span className="font-mono text-xs text-gold">0{i + 1}</span>
              <h3 className="font-display mt-2 text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line p-4 text-sm text-ink-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-jade" />
          Gemini reads, translates, checks and explains. The score itself comes from fixed, published rules, so the same evidence always gives the same result, and a lender can audit every number.
        </div>
      </section>

      {/* Samples */}
      <section className="py-16" id="samples">
        <div className="eyebrow">Try it now</div>
        <h2 className="font-display mt-2 text-4xl">Open a sample shop.</h2>
        <p className="mt-2 max-w-[60ch] text-ink-2">Each sample comes with realistic photos of its ledger, bills and payment records. Gemini reads them live, the same way it would read yours.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {samples.map((s) => (
            <Tilt key={s.id} rotationFactor={6} className="rounded-3xl">
              <button onClick={() => open(s)} className="glass-strong edge-gold group block w-full overflow-hidden rounded-3xl text-left">
                <div className="relative aspect-[16/8] overflow-hidden">
                  {s.docs.shopfront?.[0] && <img src={`/samples/${s.docs.shopfront[0]}`} alt="" className="size-full object-cover transition duration-700 group-hover:scale-105" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent" />
                  <span className="glass absolute left-4 top-4 rounded-full px-2.5 py-1 font-mono text-[11px]">{COUNTRIES[s.profile.country]?.flag} {COUNTRIES[s.profile.country]?.name}</span>
                </div>
                <div className="flex items-end justify-between gap-4 p-5">
                  <div>
                    <h3 className="font-display text-2xl">{s.profile.shopName}</h3>
                    <p className="text-sm text-ink-2">{s.profile.ownerName} · {s.profile.shopType} · since {s.profile.since}</p>
                  </div>
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-[#1b1203] transition group-hover:translate-x-1"><ScanLine className="size-5" /></span>
                </div>
              </button>
            </Tilt>
          ))}
          {!samples.length && <p className="text-sm text-ink-3">Sample shops are loading…</p>}
        </div>
      </section>
    </div>
  )
}
