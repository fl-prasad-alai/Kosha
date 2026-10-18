import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, BookOpenText, Check, Fingerprint, Loader2, MapPin, Mic, Receipt, ScrollText, Store } from 'lucide-react'
import { QUESTIONS } from '@shared/questions'
import { useKosha } from '@/state/kosha'
import { StepIdentity } from './build/StepIdentity'
import { StepShop } from './build/StepShop'
import { StepLedger } from './build/StepLedger'
import { StepProof } from './build/StepProof'
import { StepPlace } from './build/StepPlace'
import { StepVoice } from './build/StepVoice'
import { StepPassport } from './build/StepPassport'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'you', label: 'You', icon: Fingerprint, View: StepIdentity },
  { id: 'shop', label: 'Shop', icon: Store, View: StepShop },
  { id: 'ledger', label: 'Ledger', icon: BookOpenText, View: StepLedger },
  { id: 'proof', label: 'Proof', icon: Receipt, View: StepProof },
  { id: 'place', label: 'Neighbourhood', icon: MapPin, View: StepPlace },
  { id: 'voice', label: 'Interview', icon: Mic, View: StepVoice },
  { id: 'passport', label: 'Passport', icon: ScrollText, View: StepPassport },
]

export default function Build() {
  const [step, setStep] = useState(0)
  const s = useKosha()
  const profileOk = !!(s.profile.shopName.trim() && s.profile.ownerName.trim() && s.profile.address.trim())

  const state = (i: number): 'done' | 'busy' | 'todo' => {
    const d = s.docs
    switch (STEPS[i].id) {
      case 'you': return d.identity.status === 'reading' || d.business.status === 'reading' || s.qr.status === 'reading' ? 'busy' : s.idInput.aadhaar || d.identity.result || s.idInput.pan ? 'done' : 'todo'
      case 'shop': return profileOk ? 'done' : 'todo'
      case 'ledger': return d.ledger.status === 'done' ? 'done' : d.ledger.status === 'reading' ? 'busy' : 'todo'
      case 'proof': {
        const k = [d.invoice, d.payments, d.electricity]
        return k.some((x) => x.status === 'reading') ? 'busy' : k.some((x) => x.status === 'done') ? 'done' : 'todo'
      }
      case 'place': return s.location.status === 'done' ? 'done' : s.location.status === 'reading' ? 'busy' : 'todo'
      case 'voice': return QUESTIONS.some((q) => s.answers[q.id]?.status === 'done') ? 'done' : 'todo'
      default: return s.assessment ? 'done' : s.assessStatus === 'reading' ? 'busy' : 'todo'
    }
  }

  // Sample shops arrive with the profile filled in, so start on the ledger.
  const SHOP = 1
  // (unless the sample's owner adds his identity by hand: then start at "Who you are")
  useEffect(() => {
    if (s.sampleId && !s.sampleByHand) setStep((x) => (x <= SHOP ? SHOP + 1 : x))
  }, [s.sampleId, s.sampleByHand])

  useEffect(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [step])

  const go = (i: number) => {
    if (i > SHOP && !profileOk) return setStep(SHOP)
    // Start the neighbourhood scan in the background as soon as the address is known.
    if (step === SHOP && i > SHOP && s.location.status !== 'reading' && s.location.forAddress !== s.profile.address) void s.scan()
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)))
  }
  const View = STEPS[step].View

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6">
      {s.sampleId && (
        <div className="glass mb-6 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 text-sm">
          <span className="rounded-full bg-gold/15 px-2 py-0.5 font-mono text-[11px] text-gold">SAMPLE SHOP</span>
          <span className="text-ink-2">Gemini is reading this fictional shop's documents live. Everything you see comes from those photos.</span>
        </div>
      )}
      <nav aria-label="Steps" className="mb-8 overflow-x-auto">
        <ol className="flex min-w-max items-center gap-1.5">
          {STEPS.map((st, i) => {
            const stt = state(i)
            const Icon = st.icon
            return (
              <li key={st.id} className="flex items-center gap-1.5">
                <button
                  onClick={() => go(i)}
                  aria-current={i === step ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition',
                    i === step ? 'bg-gold text-[#1b1203] shadow-[0_6px_24px_-8px_rgb(var(--k-gold-rgb)/0.9)]' : 'glass text-ink-2 hover:text-ink',
                  )}
                >
                  {stt === 'done' && i !== step ? <Check className="size-4 text-jade" /> : stt === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
                  <span className="font-medium">{st.label}</span>
                </button>
                {i < STEPS.length - 1 && <span className={cn('h-px w-5', stt === 'done' ? 'bg-jade/60' : 'bg-line-2')} />}
              </li>
            )
          })}
        </ol>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }} transition={{ duration: 0.35 }}>
          <View />
        </motion.div>
      </AnimatePresence>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-night/70 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={() => go(step - 1)} disabled={step === 0} className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm disabled:opacity-40">
            <ArrowLeft className="size-4" /> Back
          </button>
          <span className="mx-auto hidden text-sm text-ink-3 sm:block">{step === SHOP && !profileOk ? 'Add the shop name, owner and address to continue' : `Step ${step + 1} of ${STEPS.length}`}</span>
          {step < STEPS.length - 1 && (
            <button onClick={() => go(step + 1)} disabled={step === SHOP && !profileOk} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-[#1b1203] disabled:opacity-40 sm:ml-0">
              {step === STEPS.length - 2 ? 'Review & issue' : 'Continue'} <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
