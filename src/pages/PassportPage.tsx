import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BadgeCheck, FileQuestion, Loader2, XCircle } from 'lucide-react'
import type { Assessment, Decision, DecisionStatus } from '@shared/types'
import { decide, getPassport } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { useKosha } from '@/state/kosha'
import { PassportResult } from '@/components/kosha/PassportResult'
import { ErrorNote, Panel, Reading, fieldCls } from '@/components/kosha/ui'
import { money } from '@/lib/format'
import { cn } from '@/lib/utils'

const CHOICES: { s: DecisionStatus; label: string; Icon: typeof BadgeCheck; cls: string }[] = [
  { s: 'approved', label: 'Approve offer', Icon: BadgeCheck, cls: 'border-jade/50 text-jade data-[on=true]:bg-jade/15' },
  { s: 'more_info', label: 'Ask for documents', Icon: FileQuestion, cls: 'border-amber-k/50 text-amber-k data-[on=true]:bg-amber-k/15' },
  { s: 'declined', label: 'Decline', Icon: XCircle, cls: 'border-vermilion/50 text-vermilion data-[on=true]:bg-vermilion/15' },
]
const LABEL: Record<DecisionStatus, string> = { approved: 'Approved', more_info: 'Asked for documents', declined: 'Declined' }

function DecisionPanel({ a, onSaved }: { a: Assessment; onSaved: (a: Assessment) => void }) {
  const user = useAuth((s) => s.user)!
  const mine = a.decisions?.find((d) => d.lenderId === user.id)
  const [status, setStatus] = useState<DecisionStatus>(mine?.status ?? (a.offer.status === 'offer' ? 'approved' : 'more_info'))
  const [note, setNote] = useState(mine?.note ?? (a.offer.status === 'hold' ? 'Please share the payment statement directly from the wallet app.' : ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const save = async () => {
    setBusy(true); setError(null); setSaved(false)
    try { onSaved(await decide(a.id, status, note)); setSaved(true) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Panel className="edge-gold mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Your decision · {user.org}</div>
          <h2 className="font-display mt-1 text-2xl">{mine ? `You marked this ${LABEL[mine.status].toLowerCase()}` : 'What should happen next?'}</h2>
        </div>
        {a.offer.status === 'offer' && <span className="text-sm text-ink-2">Kosha suggests up to <b className="text-ink">{money(a.offer.limit, a.profile.currency)}</b> over {a.offer.tenureMonths} months</span>}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {CHOICES.map(({ s, label, Icon, cls }) => (
          <button key={s} type="button" data-on={status === s} onClick={() => setStatus(s)} className={cn('flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 font-medium transition', cls, status !== s && 'opacity-60 hover:opacity-100')}>
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <label className="mt-4 grid gap-1.5 text-sm">
        <span className="text-ink-2">Note to the shop {status === 'approved' ? '(optional)' : ''}</span>
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
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export default function PassportPage() {
  const { id = '' } = useParams()
  const user = useAuth((s) => s.user)
  const local = useKosha((s) => (s.assessment?.id === id ? s.assessment : null))
  const [a, setA] = useState<Assessment | null>(local)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    // always fetch, so lender decisions are current; show the local copy meanwhile
    if (local) setA(local)
    getPassport(id).then(setA).catch((e) => !local && setError((e as Error).message))
  }, [id, local, user?.id])

  const isOwner = !!(a && user && a.ownerId === user.id)

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="glass mb-6 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm">
        <BadgeCheck className="size-5 text-jade" />
        <span className="min-w-0 flex-1">
          {a ? <>Passport <b className="font-mono">{a.id}</b> issued {new Date(a.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} by Kosha. This page is the record a lender verifies.</> : 'Looking up the passport…'}
        </span>
        {user?.role === 'lender' && <Link to="/lender" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">Back to the queue</Link>}
        {isOwner && <Link to="/app" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">My passports</Link>}
      </div>
      {error && <ErrorNote error={error} />}
      {!a && !error && <Reading text="Fetching the passport record…" />}
      {a && user?.role === 'lender' && <DecisionPanel a={a} onSaved={setA} />}
      {a && isOwner && a.decisions?.length ? <Received decisions={a.decisions} /> : null}
      {a && <PassportResult a={a} />}
    </div>
  )
}
