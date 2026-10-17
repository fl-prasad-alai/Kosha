import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Eye, EyeOff, Globe2, Landmark, Loader2, LockKeyhole, ShieldCheck, ShieldOff, Users } from 'lucide-react'
import type { Assessment, Consent, ConsentInput, LenderOrg } from '@shared/types'
import { listLenders, setConsent } from '@/lib/api'
import { ErrorNote } from './ui'
import { cn } from '@/lib/utils'

const ease = [0.22, 1, 0.36, 1] as const

/** "Shared with all verified lenders" and friends, for summaries. */
function consentLabel(c: Pick<Consent, 'scope' | 'lenderIds'> | undefined) {
  if (!c || c.scope === 'none') return 'Not shared with any lender'
  if (c.scope === 'all') return 'Shared with all verified lenders'
  return `Shared with ${c.lenderIds.length} chosen lender${c.lenderIds.length === 1 ? '' : 's'}`
}

function useLenders() {
  const [orgs, setOrgs] = useState<LenderOrg[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => void listLenders().then(setOrgs).catch((e) => setError((e as Error).message)), [])
  return { orgs, error }
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-7 w-12 shrink-0 rounded-full ring-1 transition-colors', on ? 'bg-gold ring-gold' : 'bg-glass ring-line-2')}>
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 34 }} className={cn('absolute top-1 size-5 rounded-full shadow', on ? 'right-1 bg-[#1b1203]' : 'left-1 bg-ink-3')} />
    </button>
  )
}

/** The choices themselves: who sees the full passport, and whether the public link shows the offer. */
export function ConsentForm({ value, onChange, compact = false }: { value: ConsentInput; onChange: (v: ConsentInput) => void; compact?: boolean }) {
  const { orgs, error } = useLenders()
  const toggle = (id: string) => onChange({ ...value, lenderIds: value.lenderIds.includes(id) ? value.lenderIds.filter((x) => x !== id) : [...value.lenderIds, id] })
  const OPTIONS = [
    ['all', Users, 'All verified lenders on Kosha', 'Every bank and lender Kosha has checked. More lenders can make you an offer.'],
    ['selected', Landmark, 'Only lenders I choose', 'Pick from the verified lenders below. Nobody else sees the full passport.'],
  ] as const

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm text-ink-2">Who can see your full passport?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map(([s, Icon, title, sub]) => {
            const on = value.scope === s
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...value, scope: s })}
                className={cn('relative flex min-h-[92px] flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition', on ? 'border-gold bg-gold/10 shadow-[0_0_0_4px_rgb(var(--k-gold-rgb)/0.12)]' : 'border-line hover:border-line-2')}
              >
                <Icon className={cn('size-5', on ? 'text-gold' : 'text-ink-3')} />
                <span className="font-medium">{title}</span>
                <span className="text-xs text-ink-3">{sub}</span>
                {on && <motion.span layoutId={compact ? undefined : 'consent-dot'} className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-gold text-[#1b1203]"><Check className="size-3.5" /></motion.span>}
              </button>
            )
          })}
        </div>
      </fieldset>

      <AnimatePresence initial={false}>
        {value.scope === 'selected' && (
          <motion.div key="orgs" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="overflow-hidden">
            <div className="rounded-2xl border border-line p-3.5">
              <div className="mb-2.5 flex items-center justify-between gap-2 text-sm">
                <span className="text-ink-2">Verified lenders</span>
                <span className="font-mono text-[11px] text-ink-3">{value.lenderIds.length} chosen</span>
              </div>
              {error && <ErrorNote error={error} />}
              {!orgs && !error && <div className="flex items-center gap-2 text-sm text-ink-3"><Loader2 className="size-4 animate-spin" /> Loading lenders…</div>}
              {orgs?.length === 0 && <p className="text-sm text-ink-3">No lender has been verified yet. Share with all verified lenders, and new ones will see it once Kosha checks them.</p>}
              <div className="flex flex-wrap gap-2">
                {orgs?.map((o) => {
                  const on = value.lenderIds.includes(o.id)
                  return (
                    <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(o.id)} className={cn('inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 text-sm ring-1 transition', on ? 'bg-jade/12 text-jade ring-jade/40' : 'bg-glass text-ink-2 ring-line hover:text-ink')}>
                      {on ? <Check className="size-4" /> : <Landmark className="size-4 text-ink-3" />} {o.org}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 rounded-2xl border border-line p-3.5">
        {value.publicShowsOffer ? <Eye className="size-5 shrink-0 text-gold" /> : <EyeOff className="size-5 shrink-0 text-ink-3" />}
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-medium">Show my offer amount on the public link</div>
          <div className="text-xs text-ink-3">{value.publicShowsOffer ? 'The link shows how much Kosha would lend you.' : 'The link shows only whether there is an offer, not how much.'}</div>
        </div>
        <Switch on={value.publicShowsOffer} onChange={(v) => onChange({ ...value, publicShowsOffer: v })} label="Show my offer amount on the public link" />
      </div>

      {!compact && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-jade/8 p-4 ring-1 ring-jade/25">
            <div className="flex items-center gap-2 text-sm font-semibold text-jade"><LockKeyhole className="size-4" /> Lenders you allow will see</div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              <li>Your documents as Kosha read them: ledger lines, bills, payments, electricity bills and the shop photo</li>
              <li>Your score and the reasons behind it</li>
              <li>Every check between your documents, and what your interview answers confirmed</li>
              <li>The offer, the repayment plan and your shop address</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-glass p-4 ring-1 ring-line">
            <div className="flex items-center gap-2 text-sm font-semibold"><Globe2 className="size-4 text-gold" /> Anyone with the link sees</div>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-2">
              <li>Your score, band and whether there is an offer{value.publicShowsOffer ? ' (with the amount)' : ''}</li>
              <li>Shop name, your first name, shop type and area or city only</li>
              <li className="text-ink-3">Never your documents, street address, interview or lender notes</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

/** The consent panel in the build flow. The passport cannot be issued until the box is ticked. */
export function ConsentStep({ value, agreed, onChange, onAgree, prefilled }: { value: ConsentInput; agreed: boolean; onChange: (v: ConsentInput) => void; onAgree: (v: boolean) => void; prefilled?: boolean }) {
  return (
    <section className="glass edge-gold rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Your consent</div>
          <h3 className="font-display mt-1 text-2xl">Who sees your passport</h3>
          <p className="mt-1 max-w-[60ch] text-sm text-ink-2">Your passport is yours. Choose who can open it in full. You can change this or withdraw it any time, and you will see every time a lender opens it.</p>
        </div>
        {prefilled && <span className="rounded-full bg-gold/15 px-2.5 py-1 font-mono text-[11px] text-gold">PRE-FILLED FOR THE SAMPLE SHOP</span>}
      </div>
      <div className="mt-5"><ConsentForm value={value} onChange={onChange} /></div>
      <label className={cn('mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition', agreed ? 'border-jade/50 bg-jade/8' : 'border-line-2 hover:border-gold/50')}>
        <input type="checkbox" checked={agreed} onChange={(e) => onAgree(e.target.checked)} className="sr-only" />
        <span aria-hidden className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md ring-1 transition', agreed ? 'bg-jade text-night ring-jade' : 'ring-line-2')}>
          <AnimatePresence>{agreed && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="size-3.5" strokeWidth={3} /></motion.span>}</AnimatePresence>
        </span>
        <span className="text-sm">
          <span className="font-medium">I agree that Kosha shares my passport as chosen above.</span>
          <span className="block text-ink-3">I can change or withdraw this any time from My passports.</span>
        </span>
      </label>
    </section>
  )
}

/** For the owner after issue: shows who the passport is shared with, and lets them change or withdraw it. */
export function ConsentManager({ id, consent, views, onSaved, className }: { id: string; consent?: Consent; views?: number; onSaved: (a: Assessment) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ConsentInput>(() => ({ scope: consent?.scope === 'none' || !consent ? 'all' : consent.scope, lenderIds: consent?.lenderIds ?? [], publicShowsOffer: consent?.publicShowsOffer ?? false }))
  const [busy, setBusy] = useState<'save' | 'withdraw' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const shared = !!consent && consent.scope !== 'none'

  const save = async (c: ConsentInput, kind: 'save' | 'withdraw') => {
    setBusy(kind); setError(null); setDone(null)
    try {
      onSaved(await setConsent(id, c))
      setDone(kind === 'withdraw' ? 'Withdrawn. Lenders can no longer open this passport.' : 'Saved. It applies straight away.')
      setOpen(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {shared ? <ShieldCheck className="size-4 shrink-0 text-jade" /> : <ShieldOff className="size-4 shrink-0 text-ink-3" />}
        <span className={cn('min-w-0 flex-1', shared ? 'text-ink' : 'text-ink-2')}>
          {consentLabel(consent)}
          {views != null && <span className="text-ink-3"> · {views ? `opened ${views} time${views === 1 ? '' : 's'}` : 'not opened yet'}</span>}
        </span>
        <button type="button" onClick={() => { setOpen(!open); setDone(null) }} aria-expanded={open} className="glass rounded-full px-3 py-1 text-xs font-medium text-ink-2 transition hover:text-ink">
          {open ? 'Close' : 'Manage sharing'}
        </button>
      </div>
      <AnimatePresence>{done && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 text-xs text-jade">{done}</motion.p>}</AnimatePresence>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.32, ease }} className="overflow-hidden">
            <div className="pt-4">
              <ConsentForm value={draft} onChange={setDraft} compact />
              {error && <div className="mt-3"><ErrorNote error={error} /></div>}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" disabled={!!busy || (draft.scope === 'selected' && !draft.lenderIds.length)} onClick={() => void save(draft, 'save')} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-[#1b1203] disabled:opacity-50">
                  {busy === 'save' && <Loader2 className="size-4 animate-spin" />} Save sharing
                </button>
                {shared && (
                  <button type="button" disabled={!!busy} onClick={() => void save({ scope: 'none', lenderIds: [], publicShowsOffer: draft.publicShowsOffer }, 'withdraw')} className="inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-vermilion ring-1 ring-vermilion/40 transition hover:bg-vermilion/10 disabled:opacity-50">
                    {busy === 'withdraw' ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />} Withdraw consent
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
