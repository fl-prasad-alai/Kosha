import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Inbox } from 'lucide-react'
import type { PassportSummary } from '@shared/types'
import { listPassports } from '@/lib/api'
import { GlowingBadge } from '@/components/unlumen-ui/glowing-badge'
import { ProgressiveBlur } from '@/components/unlumen-ui/progressive-blur'
import { ErrorNote, Panel, Reading, Stat, StepHeader } from '@/components/kosha/ui'
import { COUNTRIES, money } from '@/lib/format'

export default function Lender() {
  const nav = useNavigate()
  const [rows, setRows] = useState<PassportSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    listPassports().then(setRows).catch((e) => setError((e as Error).message))
  }, [])

  const offers = rows?.filter((r) => r.status === 'offer').length ?? 0
  const holds = rows?.filter((r) => r.status === 'hold').length ?? 0
  const avg = rows?.length ? Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6">
      <StepHeader
        eyebrow="For lenders"
        title="Passports waiting for a decision"
        sub="Each passport arrives with its evidence and checks. Open one to see the exact ledger lines, bills and payments behind every number. In production, lenders receive these through an API."
      />
      {error && <ErrorNote error={error} />}
      {!rows && !error && <Reading text="Loading passports…" />}
      {rows && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Passports issued" value={rows.length} />
            <Stat label="Ready to offer" value={offers} tone="jade" />
            <Stat label="Held for review" value={holds} tone="red" />
            <Stat label="Average Kosha score" value={avg || '–'} tone="gold" />
          </div>
          {rows.length === 0 ? (
            <Panel className="flex flex-col items-center gap-3 py-14 text-center">
              <Inbox className="size-8 text-ink-3" />
              <p className="font-medium">No passports yet</p>
              <p className="max-w-sm text-sm text-ink-2">Build one from a sample shop and it appears here, ready for review.</p>
              <Link to="/" className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-[#1b1203]">Try a sample shop <ArrowRight className="size-4" /></Link>
            </Panel>
          ) : (
            <Panel className="relative overflow-hidden p-0 sm:p-0">
              <div className="max-h-[640px] overflow-auto">
                <table className="w-full min-w-[820px] text-sm">
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
                    {rows.map((r, i) => (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => nav(`/passport/${r.id}`)}
                        className="cursor-pointer border-t border-line transition hover:bg-glass"
                      >
                        <td className="px-5 py-3">
                          <div className="font-medium">{r.shopName}</div>
                          <div className="font-mono text-[11px] text-ink-3">{r.id} · {r.ownerName}</div>
                        </td>
                        <td className="py-3 text-ink-2">{COUNTRIES[r.country]?.flag} {r.address.split(',').slice(-2).join(',').trim()}</td>
                        <td className="py-3 text-right tabular">{money(r.monthlySales, r.currency)}</td>
                        <td className="py-3 pl-6"><span className="font-display text-lg">{r.status === 'hold' ? '—' : r.band}</span> <span className="font-mono text-xs text-ink-3">{r.score}</span></td>
                        <td className="py-3 text-right tabular">{r.status === 'offer' ? money(r.limit, r.currency) : '—'}</td>
                        <td className="max-w-[260px] py-3 pl-6 text-xs text-ink-2"><span className="line-clamp-2">{r.flags.length ? r.flags.join(' · ') : 'Nothing'}</span></td>
                        <td className="px-5 py-3">
                          {r.status === 'offer' && <GlowingBadge variant="success" dot>Ready to offer</GlowingBadge>}
                          {r.status === 'hold' && <GlowingBadge variant="error" dot pulse>On hold</GlowingBadge>}
                          {r.status === 'decline' && <GlowingBadge variant="warning" dot>Not yet</GlowingBadge>}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 8 && <ProgressiveBlur side="bottom" size={64} strength={6} />}
            </Panel>
          )}
        </>
      )}
    </div>
  )
}
