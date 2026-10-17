import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { BadgeCheck, Hourglass, Inbox, Loader2, Search, ShieldX } from 'lucide-react'
import type { AuditEntry, AuditType, LenderAccount, LenderStatus } from '@shared/types'
import { adminAudit, adminLenders, verifyLender } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { GlowingBadge } from '@/components/unlumen-ui/glowing-badge'
import { ErrorNote, Panel, Reading, Stat, fieldCls } from '@/components/kosha/ui'
import { cn } from '@/lib/utils'

const ease = [0.22, 1, 0.36, 1] as const
const TABS = [['lenders', 'Lender verification'], ['audit', 'Audit log']] as const
type Tab = (typeof TABS)[number][0]

const STATUS: Record<LenderStatus, { label: string; variant: 'warning' | 'success' | 'error' }> = {
  pending: { label: 'Waiting', variant: 'warning' },
  verified: { label: 'Verified', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
}

const EVENT: Record<AuditType, [string, string]> = {
  login: ['Sign-in', 'text-ink-2'],
  login_failed: ['Wrong password', 'text-amber-k'],
  login_locked: ['Email locked', 'text-vermilion'],
  logout_all: ['Signed out everywhere', 'text-ink-2'],
  signup: ['New account', 'text-ink-2'],
  passport_issued: ['Passport issued', 'text-gold'],
  lender_view: ['Lender view', 'text-jade'],
  decision: ['Decision', 'text-gold'],
  consent: ['Consent change', 'text-jade'],
  lender_verified: ['Lender verified', 'text-jade'],
  lender_rejected: ['Lender rejected', 'text-vermilion'],
}
const ROLE = { business: 'Shop', lender: 'Lender', admin: 'Kosha staff' } as const

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// ───────────────────────── lender verification

/** Approve or reject one lender. Rejecting needs a reason, which the lender sees. */
function Decide({ l, status, onDone, onCancel }: { l: LenderAccount; status: 'verified' | 'rejected'; onDone: (rows: LenderAccount[]) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reject = status === 'rejected'
  const go = async () => {
    setBusy(true); setError(null)
    try { onDone(await verifyLender(l.id, status, reason)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease }} className="overflow-hidden">
      <div className={cn('mt-3 rounded-2xl border p-3.5', reject ? 'border-vermilion/40 bg-vermilion/5' : 'border-jade/40 bg-jade/5')}>
        <label className="grid gap-1.5 text-sm">
          <span className="text-ink-2">{reject ? `Why is ${l.org} being rejected? The lender sees this.` : `Note for the record (optional)`}</span>
          <input autoFocus className={fieldCls} value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void go()} placeholder={reject ? 'For example: registration number does not match the RBI list.' : 'For example: checked against the RBI list.'} />
        </label>
        {error && <div className="mt-3"><ErrorNote error={error} /></div>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => void go()} disabled={busy || (reject && reason.trim().length < 3)} className={cn('inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-50', reject ? 'bg-vermilion text-white' : 'bg-jade text-night')}>
            {busy && <Loader2 className="size-4 animate-spin" />} {reject ? 'Reject organisation' : 'Verify organisation'}
          </button>
          <button onClick={onCancel} className="glass min-h-10 rounded-full px-4 text-sm">Cancel</button>
        </div>
      </div>
    </motion.div>
  )
}

function Actions({ l, onAct }: { l: LenderAccount; onAct: (s: 'verified' | 'rejected') => void }) {
  if (l.demo) return <span className="text-xs text-ink-3">Demo account</span>
  return (
    <div className="flex flex-wrap gap-2">
      {l.status !== 'verified' && <button onClick={() => onAct('verified')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-jade/50 px-3 text-sm font-medium text-jade transition hover:bg-jade/10"><BadgeCheck className="size-4" /> Approve</button>}
      {l.status !== 'rejected' && <button onClick={() => onAct('rejected')} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-vermilion/50 px-3 text-sm font-medium text-vermilion transition hover:bg-vermilion/10"><ShieldX className="size-4" /> {l.status === 'verified' ? 'Revoke' : 'Reject'}</button>}
    </div>
  )
}

function Lenders({ rows, setRows }: { rows: LenderAccount[]; setRows: (r: LenderAccount[]) => void }) {
  const [acting, setActing] = useState<{ id: string; status: 'verified' | 'rejected' } | null>(null)
  const done = (r: LenderAccount[]) => { setRows(r); setActing(null) }
  if (!rows.length) return <Empty text="No lender has signed up yet." />
  return (
    <Panel className="relative mt-4 overflow-hidden p-0 sm:p-0">
      {/* phones: cards; larger screens: a table */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((l) => (
          <li key={l.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><div className="truncate font-medium">{l.org}</div><div className="truncate text-xs text-ink-3">{l.name} · {l.email}</div></div>
              <GlowingBadge variant={STATUS[l.status!].variant} dot pulse={l.status === 'pending'}>{STATUS[l.status!].label}</GlowingBadge>
            </div>
            <div className="mt-1 font-mono text-[11px] text-ink-3">Signed up {day(l.createdAt)}{l.statusNote ? ` · ${l.statusNote}` : ''}</div>
            <div className="mt-3"><Actions l={l} onAct={(status) => setActing({ id: l.id, status })} /></div>
            <AnimatePresence>{acting?.id === l.id && <Decide key={acting.status} l={l} status={acting.status} onDone={done} onCancel={() => setActing(null)} />}</AnimatePresence>
          </li>
        ))}
      </ul>
      <div className="hidden max-h-[680px] overflow-auto md:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
              <th className="px-5 py-3 font-normal">Organisation</th>
              <th className="py-3 font-normal">Contact</th>
              <th className="py-3 font-normal">Signed up</th>
              <th className="py-3 pl-6 font-normal">Status</th>
              <th className="px-5 py-3 font-normal">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => (
              <motion.tr key={l.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="border-t border-line align-top">
                <td className="px-5 py-3"><div className="font-medium">{l.org}</div><div className="font-mono text-[11px] text-ink-3">{l.orgId}</div></td>
                <td className="py-3"><div>{l.name}</div><div className="text-xs text-ink-3">{l.email}</div></td>
                <td className="py-3 text-ink-2">{day(l.createdAt)}</td>
                <td className="py-3 pl-6">
                  <GlowingBadge variant={STATUS[l.status!].variant} dot pulse={l.status === 'pending'}>{STATUS[l.status!].label}</GlowingBadge>
                  {l.statusNote && <div className="mt-1 max-w-[220px] text-xs text-ink-3">{l.statusNote}</div>}
                </td>
                <td className="w-[340px] px-5 py-3">
                  <Actions l={l} onAct={(status) => setActing({ id: l.id, status })} />
                  <AnimatePresence>{acting?.id === l.id && <Decide key={acting.status} l={l} status={acting.status} onDone={done} onCancel={() => setActing(null)} />}</AnimatePresence>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

// ───────────────────────── audit log

function Audit() {
  const [type, setType] = useState<AuditType | ''>('')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => void adminAudit({ type, q }).then((r) => { setRows(r); setError(null) }).catch((e) => setError((e as Error).message)), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [type, q])

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input className={cn(fieldCls, 'pl-10')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search names, organisations, passports…" aria-label="Search the audit log" />
        </label>
        <select className={cn(fieldCls, 'w-auto min-w-[200px]')} value={type} onChange={(e) => setType(e.target.value as AuditType | '')} aria-label="Filter by event">
          <option value="">All events</option>
          {(Object.keys(EVENT) as AuditType[]).map((t) => <option key={t} value={t}>{EVENT[t][0]}</option>)}
        </select>
      </div>
      {error && <div className="mt-4"><ErrorNote error={error} /></div>}
      {!rows && !error && <Reading className="mt-6" text="Reading the audit log…" />}
      {rows && !rows.length && <Empty text={q || type ? 'Nothing matches that filter.' : 'Nothing has happened yet.'} />}
      {rows && rows.length > 0 && (
        <Panel className="relative mt-4 overflow-hidden p-0 sm:p-0">
          <ul className="divide-y divide-line md:hidden">
            {rows.map((e) => (
              <li key={e.id} className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className={cn('font-medium', EVENT[e.type]?.[1])}>{EVENT[e.type]?.[0] ?? e.type}</span>
                  <span className="font-mono text-ink-3">{stamp(e.at)}</span>
                </div>
                <div className="mt-1 text-sm">{e.detail}</div>
                <div className="mt-1 truncate text-xs text-ink-3">{e.actorName}{e.actorRole ? ` · ${ROLE[e.actorRole]}` : ''}{e.passportId ? ` · ${e.passportId}` : ''}</div>
              </li>
            ))}
          </ul>
          <div className="hidden max-h-[680px] overflow-auto md:block">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                  <th className="px-5 py-3 font-normal">When</th>
                  <th className="py-3 font-normal">Event</th>
                  <th className="py-3 font-normal">Who</th>
                  <th className="py-3 font-normal">Passport</th>
                  <th className="px-5 py-3 font-normal">What happened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-ink-3">{stamp(e.at)}</td>
                    <td className={cn('whitespace-nowrap py-3 font-medium', EVENT[e.type]?.[1])}>{EVENT[e.type]?.[0] ?? e.type}</td>
                    <td className="py-3"><div>{e.actorName}</div><div className="text-xs text-ink-3">{e.actorRole ? ROLE[e.actorRole] : 'Not signed in'}{e.org ? ` · ${e.org}` : ''}</div></td>
                    <td className="py-3 font-mono text-xs">{e.passportId ? <Link to={`/passport/${e.passportId}`} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">{e.passportId}</Link> : <span className="text-ink-3">—</span>}</td>
                    <td className="max-w-[360px] px-5 py-3 text-ink-2">{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  )
}

function Empty({ text }: { text: ReactNode }) {
  return (
    <Panel className="mt-4 flex flex-col items-center gap-3 py-14 text-center">
      <Inbox className="size-8 text-ink-3" />
      <p className="max-w-sm text-sm text-ink-2">{text}</p>
    </Panel>
  )
}

export default function Admin() {
  const user = useAuth((s) => s.user)!
  const [tab, setTab] = useState<Tab>('lenders')
  const [lenders, setLenders] = useState<LenderAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => void adminLenders().then(setLenders).catch((e) => setError((e as Error).message)), [])
  const count = (s: LenderStatus) => (lenders ?? []).filter((l) => l.status === s).length

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="eyebrow">{user.org}</div>
        <h1 className="font-display mt-1.5 text-[clamp(32px,4.4vw,52px)] leading-tight">Trust and safety</h1>
        <p className="mt-1 max-w-[62ch] text-ink-2">Verify lenders before they see any shop data, and review who did what. Staff see passport numbers and results only, never a shop's documents.</p>
      </motion.div>
      {error && <div className="mt-6"><ErrorNote error={error} /></div>}

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Waiting for verification" value={lenders ? count('pending') : '–'} tone={count('pending') ? 'gold' : undefined} />
        <Stat label="Verified lenders" value={lenders ? count('verified') : '–'} tone="jade" />
        <Stat label="Rejected" value={lenders ? count('rejected') : '–'} tone="red" />
        <Stat label="Lender accounts" value={lenders?.length ?? '–'} />
      </div>

      <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Admin sections">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('relative shrink-0 rounded-full px-4 py-2 text-sm transition', tab === t ? 'text-[#1b1203]' : 'glass text-ink-2 hover:text-ink')}>
            {tab === t && <motion.span layoutId="at" className="absolute inset-0 -z-10 rounded-full bg-gold" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative inline-flex items-center gap-1.5">
              {label}
              {t === 'lenders' && lenders && count('pending') > 0 && <span className="inline-flex items-center gap-1 font-mono text-xs opacity-80"><Hourglass className="size-3" />{count('pending')}</span>}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === 'lenders' ? (lenders ? <Lenders rows={lenders} setRows={setLenders} /> : !error && <Reading className="mt-6" text="Loading lender accounts…" />) : <Audit />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
