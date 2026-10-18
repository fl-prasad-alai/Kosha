import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BadgeCheck, Check, Eye, FileDown, FileQuestion, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import type { AccessEntry, Assessment, Decision, DecisionStatus, PassportResponse } from '@shared/types'
import { can, isPublic } from '@shared/policy'
import { decide, getPassport } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { useKosha } from '@/state/kosha'
import { PassportResult } from '@/components/kosha/PassportResult'
import { PublicPassport } from '@/components/kosha/PublicPassport'
import { ConsentManager } from '@/components/kosha/Consent'
import { ErrorNote, Panel, Reading, fieldCls } from '@/components/kosha/ui'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'

const CHOICES: { s: DecisionStatus; label: string; Icon: typeof BadgeCheck; cls: string }[] = [
  { s: 'approved', label: 'Approve offer', Icon: BadgeCheck, cls: 'border-jade/50 text-jade data-[on=true]:bg-jade/15' },
  { s: 'more_info', label: 'Ask for documents', Icon: FileQuestion, cls: 'border-amber-k/50 text-amber-k data-[on=true]:bg-amber-k/15' },
  { s: 'declined', label: 'Decline', Icon: XCircle, cls: 'border-vermilion/50 text-vermilion data-[on=true]:bg-vermilion/15' },
]
const LABEL: Record<DecisionStatus, string> = { approved: 'Approved', more_info: 'Asked for documents', declined: 'Declined' }

/** What a lender can ask for in one tap; the shop sees exactly this checklist. */
const REQUESTS = [
  'Aadhaar QR or PAN card',
  'GST, Udyam or shop licence',
  'Bank statement shared from the bank app',
  'Payment history shared from the wallet app',
  'Three more months of ledger pages',
  'Latest electricity bill',
  'Supplier bills for the last month',
  'A photo of the owner at the shop',
]
/** Pre-tick what the passport is missing or what failed. */
function suggested(a: Assessment): string[] {
  const st = (id: string) => a.checks.find((c) => c.id === id)?.status
  return [
    ...(['missing', 'fail', undefined].includes(st('id_person')) ? [REQUESTS[0]] : []),
    ...(['missing', 'fail', undefined].includes(st('id_business')) && a.offer.status !== 'offer' ? [REQUESTS[1]] : []),
    ...(st('integrity') === 'fail' ? [REQUESTS[3]] : []),
    ...(st('ontime') === 'missing' ? [REQUESTS[5]] : []),
  ]
}

function DecisionPanel({ a, onSaved }: { a: Assessment; onSaved: (a: Assessment) => void }) {
  const user = useAuth((s) => s.user)!
  const mine = a.decisions?.find((d) => d.lenderId === user.id)
  const [status, setStatus] = useState<DecisionStatus>(mine?.status ?? (a.offer.status === 'offer' ? 'approved' : 'more_info'))
  const [note, setNote] = useState(mine?.note ?? (a.offer.status === 'hold' ? 'Please share the payment statement directly from the wallet app.' : ''))
  const [asks, setAsks] = useState<string[]>(mine?.requests ?? suggested(a))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const save = async () => {
    setBusy(true); setError(null); setSaved(false)
    try { onSaved(await decide(a.id, status, note, status === 'more_info' ? asks : [])); setSaved(true) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Panel className="edge-gold mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Your decision · {user.org}</div>
          <h2 className="font-display mt-1 text-2xl">{mine ? `You marked this ${LABEL[mine.status].toLowerCase()}` : 'What should happen next?'}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {a.offer.status === 'offer' && <span className="text-sm text-ink-2">Kosha suggests up to <b className="text-ink">{money(a.offer.limit, a.profile.currency)}</b> over {a.offer.tenureMonths} months</span>}
          <Link to={`/passport/${a.id}/kyc`} target="_blank" className="glass inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm"><FileDown className="size-4" /> KYC summary</Link>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {CHOICES.map(({ s, label, Icon, cls }) => (
          <button key={s} type="button" data-on={status === s} onClick={() => setStatus(s)} className={cn('flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 font-medium transition', cls, status !== s && 'opacity-60 hover:opacity-100')}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      {status === 'more_info' && (
        <div className="mt-4">
          <div className="text-sm text-ink-2">What should the shop add? <span className="text-ink-3">They see this as a checklist.</span></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {REQUESTS.map((r) => {
              const on = asks.includes(r)
              return (
                <button key={r} type="button" aria-pressed={on} onClick={() => setAsks((x) => (on ? x.filter((y) => y !== r) : [...x, r]))} className={cn('inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition', on ? 'border-amber-k/60 bg-amber-k/15 text-ink' : 'border-line text-ink-2 hover:text-ink')}>
                  {on && <Check className="size-3.5 text-amber-k" />} {r}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <label className="mt-4 grid gap-1.5 text-sm">
        <span className="text-ink-2">Note to the shop {status === 'approved' || (status === 'more_info' && asks.length) ? '(optional)' : ''}</span>
        <textarea id="decision-note" rows={2} className={fieldCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === 'approved' ? 'For example: offer of ₹80,000 over 12 months, our officer will call you.' : 'Tell the shop what you need.'} />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold px-5 text-sm font-semibold text-[#1b1203] disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} {mine ? 'Update decision' : 'Send decision'}
        </button>
        <AnimatePresence>{saved && <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm text-jade">Sent. The shop sees it on their dashboard.</motion.span>}</AnimatePresence>
      </div>
      {error && <div className="mt-3"><ErrorNote error={error} /></div>}
    </Panel>
  )
}

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** The owner's view of who the passport is shared with, and every lender that opened it. */
function Sharing({ a, onSaved }: { a: Assessment; onSaved: (a: Assessment) => void }) {
  const log: AccessEntry[] = [...(a.access ?? [])].reverse()
  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      <Panel>
        <div className="eyebrow">Who can see it</div>
        <p className="mb-4 mt-1 text-sm text-ink-2">Lenders you allow see the full passport. Everyone else sees only the public record: score, band, status and area.</p>
        <ConsentManager id={a.id} consent={a.consent} views={a.access?.length ?? 0} onSaved={onSaved} />
      </Panel>
      <Panel>
        <div className="eyebrow">Who opened it</div>
        {log.length ? (
          <ul className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
            {log.map((x, i) => (
              <motion.li key={`${x.lenderId}-${x.at}`} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-2.5 text-sm">
                <Eye className="size-4 shrink-0 text-gold" />
                <span className="min-w-0 flex-1 truncate">Viewed by <b className="font-medium">{x.org}</b></span>
                <span className="shrink-0 font-mono text-[11px] text-ink-3">{when(x.at)}</span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-3">No lender has opened it yet. Every time one does, it shows up here.</p>
        )}
      </Panel>
    </div>
  )
}

function Received({ decisions }: { decisions: Decision[] }) {
  return (
    <Panel className="mb-6">
      <div className="eyebrow">What lenders said</div>
      <ul className="mt-3 space-y-3">
        {[...decisions].sort((x, y) => y.at.localeCompare(x.at)).map((d) => (
          <li key={d.lenderId} className="flex flex-wrap items-start gap-3 rounded-2xl border border-line p-3.5">
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs ring-1', d.status === 'approved' ? 'bg-jade/12 text-jade ring-jade/30' : d.status === 'more_info' ? 'bg-amber-k/12 text-amber-k ring-amber-k/30' : 'bg-vermilion/12 text-vermilion ring-vermilion/30')}>{LABEL[d.status]}</span>
            <div className="min-w-0 flex-1 text-sm">
              <div><b className="font-medium">{d.org}</b> <span className="text-ink-3">· {d.lenderName} · {new Date(d.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>
              {d.note && <p className="mt-0.5 text-ink-2">{d.note}</p>}
              {d.requests?.length ? (
                <div className="mt-2 rounded-xl border border-amber-k/30 bg-amber-k/8 p-3">
                  <div className="text-xs font-medium text-amber-k">To add</div>
                  <ul className="mt-1.5 space-y-1">{d.requests.map((r) => <li key={r} className="flex items-center gap-2"><span className="size-3.5 rounded border border-amber-k/60" />{r}</li>)}</ul>
                  <Link to="/build" className="mt-2.5 inline-flex min-h-9 items-center rounded-full bg-gold px-4 text-xs font-semibold text-[#1b1203]">Update my passport</Link>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export default function PassportPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const scanned = params.get('v')?.toUpperCase()
  const user = useAuth((s) => s.user)
  const local = useKosha((s) => (s.assessment?.id === id ? s.assessment : null))
  const [a, setA] = useState<PassportResponse | null>(local)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    // always fetch, so lender decisions are current; show the local copy meanwhile
    if (local) setA(local)
    getPassport(id).then(setA).catch((e) => !local && setError((e as Error).message))
  }, [id, local, user?.id])

  // The server decides what this viewer gets; the page shows whichever version arrived.
  const full = a && !isPublic(a) ? a : null
  const res = full ? { ownerId: full.ownerId ?? '', consent: full.consent } : undefined
  const isOwner = !!(full && can(user, 'passport:read:own', res))
  const isLender = !!(full && user?.role === 'lender')

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="glass mb-6 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm">
        <BadgeCheck className="size-5 text-jade" />
        <span className="min-w-0 flex-1">
          {a ? <>Passport <b className="font-mono">{a.id}</b> issued {new Date(a.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} by Kosha. {full ? 'This page is the record a lender verifies.' : 'Anyone with this link can check it is genuine.'}</> : 'Looking up the passport…'}
        </span>
        {user?.role === 'lender' && <Link to="/lender" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">Back to the queue</Link>}
        {isOwner && <Link to="/app" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">My passports</Link>}
      </div>
      {a && scanned && a.seal && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className={cn('mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm', scanned === a.seal ? 'border-jade/40 bg-jade/10' : 'border-vermilion/50 bg-vermilion/10')}>
          {scanned === a.seal ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-jade" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-vermilion" />}
          <span>
            {scanned === a.seal
              ? <><b className="font-medium text-jade">Seal matches.</b> The QR code you scanned belongs to this passport, and the score and status below are Kosha's own record.</>
              : <><b className="font-medium text-vermilion">Seal does not match.</b> The printout you scanned may have been changed. Trust only what this page shows, and ask the shop for a fresh passport.</>}
          </span>
        </motion.div>
      )}
      {error && <ErrorNote error={error} />}
      {!a && !error && <Reading text="Fetching the passport record…" />}
      {a && isPublic(a) && <PublicPassport p={a} user={user} />}
      {full && isLender && <DecisionPanel a={full} onSaved={setA} />}
      {full && isOwner && <Sharing a={full} onSaved={setA} />}
      {full && isOwner && full.decisions?.length ? <Received decisions={full.decisions} /> : null}
      {full && <PassportResult a={full} onSaved={setA} />}
    </div>
  )
}
