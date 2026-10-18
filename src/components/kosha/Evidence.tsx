import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { create } from 'zustand'
import { X } from 'lucide-react'
import type { Box, EvidenceRef } from '@shared/types'
import { useKosha } from '@/state/kosha'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DocImage } from './DocImage'

export const useEvidence = create<{ ref: EvidenceRef | null; open: (r: EvidenceRef) => void; close: () => void }>((set) => ({
  ref: null,
  open: (ref) => set({ ref }),
  close: () => set({ ref: null }),
}))

const TITLES: Record<string, string> = {
  ledger: 'Handwritten ledger',
  invoice: 'Supplier bill',
  payments: 'Payment records',
  electricity: 'Electricity bill',
  shopfront: 'Shopfront',
  location: 'Neighbourhood',
  interview: 'Voice interview',
  identity: 'Identity document',
  business: 'Business registration',
}

/** A small clickable chip that opens the evidence behind a claim. */
export function EvidenceChip({ r, className }: { r: EvidenceRef; className?: string }) {
  const open = useEvidence((s) => s.open)
  return (
    <button
      type="button"
      onClick={() => open(r)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line bg-glass px-2.5 py-0.5 font-mono text-[11px] text-jade transition hover:border-jade/60 hover:bg-jade/10 focus-visible:outline-2 focus-visible:outline-jade',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-jade" />
      {r.label}
    </button>
  )
}

function useResolved(r: EvidenceRef | null) {
  const docs = useKosha((s) => s.docs)
  const location = useKosha((s) => s.location.result)
  const answers = useKosha((s) => s.answers)
  const profile = useKosha((s) => s.profile)
  if (!r) return null
  const f = (n: number) => money(n, profile.currency)
  let file = r.file ?? 0
  let box: Box | undefined
  let caption = ''
  if (r.doc === 'ledger') {
    const e = docs.ledger.result?.entries[r.index ?? -1]
    if (e) {
      file = e.file
      box = e.box
      caption = `${e.original}  →  ${e.english} · ${f(e.amount)}`
    }
  } else if (r.doc === 'invoice') {
    const d = docs.invoice.result?.documents[r.index ?? -1] ?? docs.invoice.result?.documents.find((x) => x.file === r.file)
    if (d) {
      file = d.file
      box = d.totalBox
      caption = `${d.supplierName} · bill ${d.invoiceNo} · ${d.date} · total ${f(d.total)} · ${d.paymentTerms === 'credit' ? `credit ${d.creditDays} days` : d.paymentTerms}`
    }
  } else if (r.doc === 'payments') {
    const fl = r.index != null ? docs.payments.result?.flags[r.index] : undefined
    if (fl) {
      file = fl.file
      box = fl.box
      caption = `${fl.date} · ${f(fl.amount)} · ${fl.description}`
    } else caption = `${docs.payments.result?.provider ?? 'Payments'} · ${docs.payments.result?.daily.length ?? 0} days of records`
  } else if (r.doc === 'electricity') {
    const b = docs.electricity.result?.bills.find((x) => x.file === r.file)
    if (b) {
      box = b.unitsBox
      caption = `${b.month} · ${b.units} kWh · ${f(b.amount)} · ${b.paymentNote}`
    }
  } else if (r.doc === 'identity') {
    const d = docs.identity.result?.documents[r.index ?? -1]
    if (d) {
      file = d.file
      box = d.nameBox ?? d.numberBox
      caption = `${d.nameLatin || d.name}${d.dob ? ` · born ${d.dob}` : ''}${d.tamperSigns.length ? ` · ${d.tamperSigns[0]}` : ''}`
    }
  } else if (r.doc === 'business') {
    const d = docs.business.result?.documents[r.index ?? -1]
    if (d) {
      file = d.file
      box = d.numberBox
      caption = `${d.number} · ${d.tradeName || d.legalName}${d.registeredOn ? ` · since ${d.registeredOn}` : ''}${d.statusPrinted ? ` · ${d.statusPrinted}` : ''}`
    }
  } else if (r.doc === 'shopfront') {
    box = docs.shopfront.result?.signBox
    caption = docs.shopfront.result?.signboardText ?? ''
  }
  const kind = r.doc as keyof typeof docs
  const d = r.doc in docs ? docs[kind] : undefined
  return {
    title: TITLES[r.doc],
    url: d?.urls[file],
    type: d?.files[file]?.type ?? 'image/jpeg',
    name: d?.files[file]?.name,
    box,
    caption,
    location: r.doc === 'location' ? location : undefined,
    answers: r.doc === 'interview' ? Object.values(answers).map((a) => a?.answer).filter(Boolean) : undefined,
  }
}

export function EvidenceModal() {
  const { ref, close } = useEvidence()
  const res = useResolved(ref)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [close])

  return (
    <AnimatePresence>
      {ref && res && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={res.title}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong edge-gold flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div>
                <div className="eyebrow">Evidence</div>
                <div className="font-display text-lg">{res.title} · {ref.label}</div>
              </div>
              <button onClick={close} className="grid size-9 place-items-center rounded-full hover:bg-glass" aria-label="Close evidence">
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-auto p-5">
              {res.url ? (
                <DocImage url={res.url} type={res.type} name={res.name} marks={res.box ? [{ id: 'x', box: res.box, tone: 'gold', label: ref.label }] : []} active={res.box ? 'x' : null} className="mx-auto max-w-xl" />
              ) : res.location ? (
                <div className="space-y-3 text-sm">
                  <p className="text-ink-2">{res.location.areaSummary}</p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {res.location.places.map((p) => (
                      <li key={p.name} className="flex justify-between gap-3 rounded-lg border border-line px-3 py-1.5">
                        <span className="truncate">{p.name}</span>
                        <span className={cn('shrink-0 font-mono text-xs', p.kind === 'driver' ? 'text-jade' : 'text-vermilion')}>{p.distanceM} m</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : res.answers ? (
                <ul className="space-y-3">
                  {res.answers.map((a) => (
                    <li key={a!.id} className="rounded-xl border border-line p-3">
                      <p className="font-local">{a!.transcript}</p>
                      <p className="mt-1 text-sm text-ink-2">{a!.english}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-2">This evidence was part of the original application. The documents themselves stay with the shop owner.</p>
              )}
              {res.caption && <p className="font-local mt-4 rounded-xl bg-glass px-4 py-3 text-sm">{res.caption}</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
