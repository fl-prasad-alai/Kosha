import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { LedgerType } from '@shared/types'
import { useKosha } from '@/state/kosha'
import { Dropzone } from '@/components/kosha/Dropzone'
import { DocImage } from '@/components/kosha/DocImage'
import { ErrorNote, MetaLine, Panel, Reading, Stat, StepHeader } from '@/components/kosha/ui'
import { money, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const TYPE: Record<LedgerType, { label: string; cls: string; tone: 'jade' | 'gold' | 'red' }> = {
  sale: { label: 'Sale', cls: 'bg-jade/12 text-jade', tone: 'jade' },
  purchase: { label: 'Stock bought', cls: 'bg-gold/15 text-gold', tone: 'gold' },
  credit_given: { label: 'Credit given', cls: 'bg-amber-k/15 text-amber-k', tone: 'gold' },
  credit_received: { label: 'Credit repaid', cls: 'bg-jade/12 text-jade', tone: 'jade' },
  expense: { label: 'Expense', cls: 'bg-vermilion/12 text-vermilion', tone: 'red' },
  other: { label: 'Other', cls: 'bg-glass text-ink-2', tone: 'jade' },
}

function langName(l: string) {
  if (l.length > 3) return l
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(l) ?? l
  } catch {
    return l
  }
}

export function StepLedger() {
  const doc = useKosha((s) => s.docs.ledger)
  const currency = useKosha((s) => s.profile.currency)
  const setFiles = useKosha((s) => s.setFiles)
  const read = useKosha((s) => s.read)
  const [page, setPage] = useState(0)
  const [hover, setHover] = useState<string | null>(null)
  const r = doc.result
  const f = (n: number) => money(n, currency)
  const pageIdx = Math.min(page, Math.max(0, doc.files.length - 1))

  const stats = useMemo(() => {
    if (!r) return null
    const dates = [...new Set(r.entries.map((e) => e.date))].sort()
    const span = dates.length ? Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86_400_000) + 1 : 0
    const total = (t: LedgerType) => r.entries.filter((e) => e.type === t).reduce((a, e) => a + e.amount, 0)
    return { span, from: dates[0], to: dates[dates.length - 1], cash: span ? total('sale') / span : 0, purchases: total('purchase'), credit: total('credit_given') - total('credit_received') }
  }, [r])

  const rows = (r?.entries ?? []).map((e, i) => ({ ...e, key: `e${i}` }))
  const pageRows = rows.filter((e) => e.file === pageIdx)

  return (
    <>
      <StepHeader
        eyebrow="Step 2 · The khata"
        title="Photograph the handwritten ledger"
        sub="Two to four recent pages are enough. Gemini reads every line in the owner's own script, translates it, and sorts it into sales, stock bought and credit."
        right={doc.meta && <MetaLine meta={doc.meta} />}
      />
      {doc.files.length === 0 && !r ? (
        <Panel>
          <Dropzone files={doc.files} urls={doc.urls} label="Add ledger pages" hint="Photos of 2–4 recent pages, flat and in good light" onChange={(fs) => { setFiles('ledger', fs); void read('ledger') }} />
        </Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Panel className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {doc.files.map((_, i) => (
                <button key={i} onClick={() => setPage(i)} className={cn('rounded-full px-3 py-1 text-sm transition', i === pageIdx ? 'bg-gold text-[#1b1203]' : 'bg-glass text-ink-2 hover:text-ink')}>
                  Page {i + 1}
                </button>
              ))}
              <button className="ml-auto text-sm text-ink-3 hover:text-ink" onClick={() => setFiles('ledger', [])}>Replace pages</button>
            </div>
            {doc.urls[pageIdx] ? (
              <DocImage
                url={doc.urls[pageIdx]}
                type={doc.files[pageIdx]?.type ?? 'image/jpeg'}
                marks={pageRows.map((e) => ({ id: e.key, box: e.box, tone: TYPE[e.type].tone, label: `${TYPE[e.type].label} · ${f(e.amount)}` }))}
                active={hover}
                onHover={setHover}
                scanning={doc.status === 'reading'}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-line-2 p-6 text-sm text-ink-3">The page photos are not kept after a refresh, but everything Gemini read from them is still here. Use “Replace pages” to read new ones.</p>
            )}
          </Panel>

          <div className="min-w-0 space-y-4">
            {doc.status === 'reading' && <Panel><Reading text={`Gemini is reading ${doc.files.length} handwritten page${doc.files.length > 1 ? 's' : ''}…`} /><p className="mt-2 text-sm text-ink-3">Handwriting takes 15–40 seconds. You can continue to the next step while it reads.</p></Panel>}
            {doc.status === 'error' && <ErrorNote error={doc.error!} onRetry={() => read('ledger')} />}
            {r && stats && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Days covered" value={`${stats.span} days`} />
                  <Stat label="Cash sales a day" value={f(stats.cash)} tone="jade" />
                  <Stat label="Stock bought" value={f(stats.purchases)} tone="gold" />
                  <Stat label="Owed by customers" value={f(Math.max(0, stats.credit))} />
                </div>
                <Panel className="min-w-0 p-0 sm:p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 text-sm">
                    <span><b>{r.entries.length}</b> lines read · {langName(r.language)} in {r.script}</span>
                    <span className="text-ink-3">{stats.from && `${shortDate(stats.from)} – ${shortDate(stats.to)}`} · legibility {Math.round(r.legibility * 100)}%{r.corrections ? ` · ${r.corrections} corrections` : ''}</span>
                  </div>
                  <div className="max-h-[560px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--k-glass-2)] backdrop-blur">
                        <tr className="text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-3">
                          <th className="px-5 py-2 font-normal">Date</th>
                          <th className="py-2 font-normal">What it says</th>
                          <th className="py-2 font-normal">Type</th>
                          <th className="px-5 py-2 text-right font-normal">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((e, i) => (
                          <motion.tr
                            key={e.key}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(i * 0.03, 1.2) }}
                            onMouseEnter={() => { setHover(e.key); setPage(e.file) }}
                            onMouseLeave={() => setHover(null)}
                            className={cn('border-t border-line transition-colors', hover === e.key && 'bg-gold/10')}
                          >
                            <td className="whitespace-nowrap px-5 py-2 font-mono text-xs text-ink-2">{shortDate(e.date)}</td>
                            <td className="py-2 pr-3">
                              <div>{e.english}</div>
                              <div className="font-local text-xs text-ink-3">{e.original}</div>
                            </td>
                            <td className="py-2"><span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10.5px]', TYPE[e.type].cls)}>{TYPE[e.type].label}</span></td>
                            <td className="whitespace-nowrap px-5 py-2 text-right tabular">{f(e.amount)}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
