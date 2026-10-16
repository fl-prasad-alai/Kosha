import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Inbox } from 'lucide-react'
import type { PassportSummary } from '@shared/types'
import { listPassports } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { GlowingBadge } from '@/components/unlumen-ui/glowing-badge'
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

export default function Lender() {
  const nav = useNavigate()
  const user = useAuth((s) => s.user)!
  const [rows, setRows] = useState<PassportSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  useEffect(() => void listPassports().then(setRows).catch((e) => setError((e as Error).message)), [])

  const mine = (r: PassportSummary) => (r.decision && r.decision.lenderId === user.id ? r.decision : null)
  const shown = useMemo(() => (rows ?? []).filter((r) => (tab === 'all' ? true : tab === 'decided' ? !!mine(r) : r.status === tab && !mine(r))), [rows, tab])
  const count = (t: Tab) => (rows ?? []).filter((r) => (t === 'all' ? true : t === 'decided' ? !!mine(r) : r.status === t && !mine(r))).length
  const avg = rows?.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="eyebrow">{user.org}</div>
        <h1 className="font-display mt-1.5 text-[clamp(32px,4.4vw,52px)] leading-tight">Passports waiting for a decision</h1>
        <p className="mt-1 max-w-[62ch] text-ink-2">Every passport arrives with its evidence and checks. Open one to see the exact ledger lines, bills and payments behind each number, then approve, ask for documents or decline.</p>
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
          </div>

          {shown.length === 0 ? (
            <Panel className="mt-4 flex flex-col items-center gap-3 py-14 text-center">
              <Inbox className="size-8 text-ink-3" />
              <p className="font-medium">Nothing here</p>
              <p className="max-w-sm text-sm text-ink-2">{tab === 'decided' ? 'Passports you decide on appear here.' : 'New passports appear here as shops issue them.'}</p>
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
