import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Hourglass, Inbox, Mail, ShieldX, ShieldCheck, Building2 } from 'lucide-react'
import type { PassportSummary, User } from '@shared/types'
import { can } from '@shared/policy'
import { listPassports } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { GlowingBadge } from '@/components/unlumen-ui/glowing-badge'
import { AssuranceLine, ProofBadge } from '@/components/kosha/Assurance'
import { ErrorNote, Panel, Reading, Stat } from '@/components/kosha/ui'
import { COUNTRIES, money } from '@/lib/format'
import { cn } from '@/lib/utils'

const TABS = [
  ['all', 'All'],
  ['offer', 'Ready to offer'],
  ['hold', 'On hold'],
  ['decided', 'Decided'],
] as const
type Tab = (typeof TABS)[number][0]

const DECIDED: Record<string, [string, string]> = {
  approved: ['Approved', 'text-jade'],
  more_info: ['Asked for documents', 'text-amber-k'],
  declined: ['Declined', 'text-vermilion'],
}

const STEPS = ['Account created', 'Kosha checks your organisation', 'Shared passports appear here']

/** Lenders see no shop data until Kosha has verified their organisation. */
function Verifying({ user }: { user: User }) {
  const rejected = user.status === 'rejected'
  // The server reads verification fresh on every request; check back now and then so the queue opens by itself.
  useEffect(() => {
    if (rejected) return
    const t = setInterval(() => void useAuth.getState().load(), 30_000)
    return () => clearInterval(t)
  }, [rejected])
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6">
      <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="glass-strong edge-gold relative overflow-hidden rounded-3xl p-6 sm:p-10">
        <div className={cn('pointer-events-none absolute -right-20 -top-20 size-64 rounded-full blur-3xl', rejected ? 'bg-vermilion/15' : 'bg-gold/15')} />
        <div className="relative">
          <div className={cn('grid size-14 place-items-center rounded-2xl ring-1', rejected ? 'bg-vermilion/12 text-vermilion ring-vermilion/30' : 'bg-amber-k/12 text-amber-k ring-amber-k/30')}>
            {rejected ? <ShieldX className="size-7" /> : <motion.span animate={{ rotate: [0, 180, 180, 360] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}><Hourglass className="size-7" /></motion.span>}
          </div>
          <div className="eyebrow mt-6">{user.org}</div>
          <h1 className="font-display mt-1.5 text-[clamp(28px,4vw,44px)] leading-tight">{rejected ? 'We could not verify your organisation' : 'Your organisation is being verified'}</h1>
          {rejected ? (
            <>
              <p className="mt-3 max-w-[58ch] text-ink-2">Kosha only lets regulated banks and lenders open shop passports, and we were not able to confirm {user.org}. Until then, this account cannot see any shop data.</p>
              {user.statusNote && <p className="mt-4 rounded-2xl border border-vermilion/40 bg-vermilion/10 px-4 py-3 text-sm"><b className="font-medium">Reason:</b> {user.statusNote}</p>}
              <p className="mt-4 flex items-center gap-2 text-sm text-ink-2"><Mail className="size-4 shrink-0 text-gold" /> Think this is a mistake? Write to lenders@kosha.app with your organisation's registration details.</p>
            </>
          ) : (
            <>
              <p className="mt-3 max-w-[58ch] text-ink-2">Shops trust Kosha with their records, so every lender is checked before it sees any shop data. This usually takes one working day. You do not need to sign in again: shared passports appear here as soon as you are verified.</p>
              <ol className="mt-7 grid gap-3 sm:grid-cols-3">
                {STEPS.map((s, i) => (
                  <motion.li key={s} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className={cn('rounded-2xl border p-3.5 text-sm', i === 0 ? 'border-jade/40 bg-jade/8' : i === 1 ? 'border-amber-k/40 bg-amber-k/8' : 'border-line')}>
                    <div className={cn('font-mono text-[11px]', i === 0 ? 'text-jade' : i === 1 ? 'text-amber-k' : 'text-ink-3')}>{i === 0 ? 'DONE' : i === 1 ? 'IN PROGRESS' : 'NEXT'}</div>
                    <div className="mt-1 font-medium">{s}</div>
                  </motion.li>
                ))}
              </ol>
            </>
          )}
        </div>
      </motion.section>
    </div>
  )
}

export default function Lender() {
  const user = useAuth((s) => s.user)!
  return can(user, 'passport:read:shared') ? <Queue user={user} /> : <Verifying user={user} />
}

function Queue({ user }: { user: User }) {
  const nav = useNavigate()
  const [rows, setRows] = useState<PassportSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  // Identity filters: only govt-signed IDs, only registered businesses
  const [onlySigned, setOnlySigned] = useState(false)
  const [onlyRegistered, setOnlyRegistered] = useState(false)
  useEffect(() => void listPassports().then(setRows).catch((e) => setError((e as Error).message)), [])

  // The server sends only this organisation's decision.
  const mine = (r: PassportSummary) => r.decision
  const shown = useMemo(
    () => (rows ?? [])
      .filter((r) => (tab === 'all' ? true : tab === 'decided' ? !!mine(r) : r.status === tab && !mine(r)))
      .filter((r) => (!onlySigned || r.idLevel === 'signed') && (!onlyRegistered || (r.bizLevel ?? 'none') !== 'none')),
    [rows, tab, onlySigned, onlyRegistered],
  )
  const count = (t: Tab) => (rows ?? []).filter((r) => (t === 'all' ? true : t === 'decided' ? !!mine(r) : r.status === t && !mine(r))).length
  const avg = rows?.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="eyebrow">{user.org}</div>
        <h1 className="font-display mt-1.5 text-[clamp(32px,4.4vw,52px)] leading-tight">Passports waiting for a decision</h1>
        <p className="mt-1 max-w-[62ch] text-ink-2">Shops that chose to share with {user.org} appear here, each with its evidence and checks. Open one to see the exact ledger lines, bills and payments behind each number, then approve, ask for documents or decline.</p>
      </motion.div>
      {error && <div className="mt-6"><ErrorNote error={error} /></div>}
      {!rows && !error && <Reading className="mt-8" text="Loading passports…" />}
      {rows && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="In the queue" value={rows.length} />
            <Stat label="Ready to offer" value={count('offer')} tone="jade" />
            <Stat label="Held for review" value={count('hold')} tone="red" />
            <Stat label="Average Kosha score" value={avg || '–'} tone="gold" />
          </div>

          <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Filter passports">
            {TABS.map(([t, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('relative shrink-0 rounded-full px-4 py-2 text-sm transition', tab === t ? 'text-[#1b1203]' : 'glass text-ink-2 hover:text-ink')}>
                {tab === t && <motion.span layoutId="lt" className="absolute inset-0 -z-10 rounded-full bg-gold" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{label} <span className="font-mono text-xs opacity-70">{count(t)}</span></span>
              </button>
            ))}
            <span className="mx-1 w-px shrink-0 bg-line" />
            <button onClick={() => setOnlySigned((x) => !x)} aria-pressed={onlySigned} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition', onlySigned ? 'border-jade/60 bg-jade/15 text-jade' : 'glass text-ink-2 hover:text-ink')}><ShieldCheck className="size-4" /> Govt-signed ID</button>
            <button onClick={() => setOnlyRegistered((x) => !x)} aria-pressed={onlyRegistered} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition', onlyRegistered ? 'border-jade/60 bg-jade/15 text-jade' : 'glass text-ink-2 hover:text-ink')}><Building2 className="size-4" /> Registered business</button>
          </div>

          {shown.length === 0 ? (
            <Panel className="mt-4 flex flex-col items-center gap-3 py-14 text-center">
              <Inbox className="size-8 text-ink-3" />
              <p className="font-medium">Nothing here</p>
              <p className="max-w-sm text-sm text-ink-2">{tab === 'decided' ? 'Passports you decide on appear here.' : 'Passports appear here when shops share them with your organisation.'}</p>
              {tab !== 'all' && <button onClick={() => setTab('all')} className="mt-1 inline-flex items-center gap-1.5 text-sm text-gold">See all passports <ArrowRight className="size-4" /></button>}
            </Panel>
          ) : (
            <Panel className="relative mt-4 overflow-hidden p-0 sm:p-0">
              {/* phones: cards; larger screens: a table */}
              <ul className="divide-y divide-line md:hidden">
                {shown.map((r) => (
                  <li key={r.id}>
                    <Link to={`/passport/${r.id}`} className="block px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><div className="truncate font-medium">{r.shopName}</div><div className="truncate text-xs text-ink-3">{r.ownerName} · {COUNTRIES[r.country]?.flag} {r.address.split(',').slice(-2).join(',').trim()}</div></div>
                        <div className="text-right"><div className="font-display text-lg">{r.status === 'hold' ? '—' : r.band}</div><div className="font-mono text-xs text-ink-3">{r.score}</div></div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {r.status === 'offer' && <GlowingBadge variant="success" dot>Up to {money(r.limit, r.currency)}</GlowingBadge>}
                        {r.status === 'hold' && <GlowingBadge variant="error" dot>On hold</GlowingBadge>}
                        {mine(r) && <span className={DECIDED[mine(r)!.status][1]}>You: {DECIDED[mine(r)!.status][0]}</span>}
                        {r.flags[0] && <span className="text-ink-3">{r.flags.slice(0, 2).join(' · ')}</span>}
                      </div>
                      {r.idLevel && <AssuranceLine className="mt-2" idLevel={r.idLevel} bizLevel={r.bizLevel} />}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden max-h-[680px] overflow-auto md:block">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                      <th className="px-5 py-3 font-normal">Shop</th>
                      <th className="py-3 font-normal">Where</th>
                      <th className="py-3 text-right font-normal">Monthly sales</th>
                      <th className="py-3 pl-6 font-normal">Score</th>
                      <th className="py-3 pl-6 font-normal">Identity</th>
                      <th className="py-3 text-right font-normal">Limit</th>
                      <th className="py-3 pl-6 font-normal">Needs a look</th>
                      <th className="px-5 py-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => (
                      <motion.tr key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} onClick={() => nav(`/passport/${r.id}`)} className="cursor-pointer border-t border-line transition hover:bg-glass">
                        <td className="px-5 py-3"><div className="font-medium">{r.shopName}</div><div className="font-mono text-[11px] text-ink-3">{r.id} · {r.ownerName}</div></td>
                        <td className="py-3 text-ink-2">{COUNTRIES[r.country]?.flag} {r.address.split(',').slice(-2).join(',').trim()}</td>
                        <td className="py-3 text-right tabular">{money(r.monthlySales, r.currency)}</td>
                        <td className="py-3 pl-6"><span className="font-display text-lg">{r.status === 'hold' ? '—' : r.band}</span> <span className="font-mono text-xs text-ink-3">{r.score}</span></td>
                        <td className="py-3 pl-6">{r.idLevel ? <span className="grid gap-1"><ProofBadge level={r.idLevel} />{r.bizLevel && r.bizLevel !== 'none' && <span className="text-[11px] text-ink-3">+ business registered</span>}</span> : <span className="text-xs text-ink-3">—</span>}</td>
                        <td className="py-3 text-right tabular">{r.status === 'offer' ? money(r.limit, r.currency) : '—'}</td>
                        <td className="max-w-[240px] py-3 pl-6 text-xs text-ink-2"><span className="line-clamp-2">{r.flags.length ? r.flags.join(' · ') : 'Nothing'}</span></td>
                        <td className="px-5 py-3">
                          {mine(r) ? <span className={cn('text-sm font-medium', DECIDED[mine(r)!.status][1])}>{DECIDED[mine(r)!.status][0]}</span>
                            : r.status === 'offer' ? <GlowingBadge variant="success" dot>Ready to offer</GlowingBadge>
                            : r.status === 'hold' ? <GlowingBadge variant="error" dot pulse>On hold</GlowingBadge>
                            : <GlowingBadge variant="warning" dot>Not yet</GlowingBadge>}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
