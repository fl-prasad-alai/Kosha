import { useState } from 'react'
import { motion } from 'motion/react'
import { AlertOctagon, Check, Receipt, Smartphone, Zap } from 'lucide-react'
import type { DocKind, LedgerEntry } from '@shared/types'
import { useKosha } from '@/state/kosha'
import { Dropzone } from '@/components/kosha/Dropzone'
import { DocImage } from '@/components/kosha/DocImage'
import { DailyBars } from '@/components/kosha/Charts'
import { ErrorNote, MetaLine, Panel, Reading, Stat, StatusPill, StepHeader } from '@/components/kosha/ui'
import { money, monthLabel, pct, shortDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const DAY = 86_400_000
function matched(date: string, total: number, entries: LedgerEntry[] = []) {
  const t = Date.parse(date)
  return entries.some((e) => e.type === 'purchase' && Math.abs(Date.parse(e.date) - t) <= 2 * DAY && Math.abs(e.amount - total) <= Math.max(50, total * 0.02))
}

function Thumbs({ kind, marks }: { kind: DocKind; marks?: Marks }) {
  const d = useKosha((s) => s.docs[kind])
  const [open, setOpen] = useState(0)
  if (!d.files.length) return null
  const i = Math.min(open, d.files.length - 1)
  return (
    <div className="space-y-2">
      <DocImage url={d.urls[i]} type={d.files[i].type} name={d.files[i].name} marks={marks?.(i) ?? []} scanning={d.status === 'reading'} className="max-h-[420px] overflow-y-auto" />
      {d.files.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {d.files.map((f, k) => (
            <button key={k} onClick={() => setOpen(k)} className={cn('overflow-hidden rounded-md ring-2 transition', k === i ? 'ring-gold' : 'ring-transparent opacity-70 hover:opacity-100')}>
              {f.type.startsWith('image/') ? <img src={d.urls[k]} alt={`Page ${k + 1}`} className="size-12 object-cover" /> : <span className="grid size-12 place-items-center bg-glass font-mono text-[10px]">PDF</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Marks = (file: number) => { id: string; box?: [number, number, number, number]; tone?: 'jade' | 'gold' | 'red' }[]

function Section({ kind, icon: Icon, title, why, hint, marks, children }: { kind: DocKind; icon: typeof Receipt; title: string; why: string; hint: string; marks?: Marks; children: React.ReactNode }) {
  const d = useKosha((s) => s.docs[kind])
  const setFiles = useKosha((s) => s.setFiles)
  const read = useKosha((s) => s.read)
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold"><Icon className="size-5" /></span>
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-ink-2">{why}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <MetaLine meta={d.meta} />
          {d.files.length > 0 && <button className="text-sm text-ink-3 hover:text-ink" onClick={() => setFiles(kind, [])}>Replace</button>}
        </div>
      </div>
      {d.files.length === 0 && !d.result ? (
        <Dropzone files={d.files} urls={d.urls} label={`Add ${title.toLowerCase()}`} hint={hint} onChange={(fs) => { setFiles(kind, fs); void read(kind) }} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Thumbs kind={kind} marks={marks} />
          <div className="min-w-0 space-y-4">
            {d.status === 'reading' && <Reading text={`Gemini is reading ${d.files.length} file${d.files.length > 1 ? 's' : ''}…`} />}
            {d.status === 'error' && <ErrorNote error={d.error!} onRetry={() => read(kind)} />}
            {d.status === 'done' && children}
          </div>
        </div>
      )}
    </Panel>
  )
}

export function StepProof() {
  const docs = useKosha((s) => s.docs)
  const currency = useKosha((s) => s.profile.currency)
  const f = (n: number) => money(n, currency)
  const inv = docs.invoice.result
  const pay = docs.payments.result
  const el = docs.electricity.result
  const ledgerEntries = docs.ledger.result?.entries

  return (
    <>
      <StepHeader eyebrow="Step 3 · Proof" title="Add the records that back up the ledger" sub="Each one is optional, but every extra source makes the passport stronger and the limit fairer. Kosha checks them against each other." />
      <div className="space-y-5">
        <Section kind="invoice" icon={Receipt} title="Supplier bills" why="Proves the stock buying in the ledger really happened." hint="Photos of recent wholesale bills or receipts" marks={(i) => (inv?.documents ?? []).filter((d) => d.file === i).map((d, k) => ({ id: `t${k}`, box: d.totalBox, tone: 'gold' }))}>
          {inv && (
            <ul className="space-y-2">
              {inv.documents.map((d, i) => {
                const ok = ledgerEntries ? matched(d.date, d.total, ledgerEntries) : null
                return (
                  <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line bg-glass px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{d.supplierName}</div>
                      <div className="text-xs text-ink-3">Bill {d.invoiceNo || '–'} · {shortDate(d.date)} · {d.items.length} items · {d.paymentTerms === 'credit' ? `credit ${d.creditDays} days` : d.paymentTerms}</div>
                    </div>
                    <span className="font-display text-lg tabular">{f(d.total)}</span>
                    {ok === null ? <StatusPill status="missing">Ledger not read yet</StatusPill> : ok ? <StatusPill status="pass"><Check className="size-3" /> In the ledger</StatusPill> : <StatusPill status="watch">Not in the ledger</StatusPill>}
                    {d.concerns.length > 0 && <p className="w-full text-xs text-amber-k">{d.concerns.join(' ')}</p>}
                  </motion.li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section kind="payments" icon={Smartphone} title="Digital payments" why="Shows the money customers pay by UPI, QRIS or e-wallet." hint="A merchant statement (PDF or photo) or 3–5 app screenshots" marks={(i) => (pay?.flags ?? []).filter((x) => x.file === i).map((x, k) => ({ id: `f${k}`, box: x.box, tone: 'red' }))}>
          {pay && (
            <>
              {pay.flags.length > 0 && (
                <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex gap-3 rounded-2xl border border-vermilion/50 bg-vermilion/10 p-4 text-sm">
                  <AlertOctagon className="mt-0.5 size-5 shrink-0 text-vermilion" />
                  <div>
                    <div className="font-semibold text-vermilion">Possible edited record found</div>
                    {pay.flags.map((x, i) => (
                      <p key={i} className="mt-1">{shortDate(x.date)} · {f(x.amount)}: {x.description}</p>
                    ))}
                    <p className="mt-1 text-ink-2">This amount is left out of sales until the owner shares the record directly from the app.</p>
                  </div>
                </motion.div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Source" value={pay.provider || (pay.sourceType === 'statement' ? 'Statement' : 'Screenshots')} />
                <Stat label="Days of records" value={pay.daily.length} />
                <Stat label="Different payers" value={pay.uniquePayers || '–'} />
                <Stat label="Repeat customers" value={pay.repeatShare ? pct(pay.repeatShare) : '–'} tone="jade" />
              </div>
              <div className="rounded-2xl border border-line p-4">
                <div className="mb-3 text-sm text-ink-2">Money received per day{pay.merchantName ? ` · ${pay.merchantName}` : ''}</div>
                <DailyBars daily={pay.daily} flags={pay.flags.filter((x) => x.severity !== 'low')} currency={currency} />
              </div>
            </>
          )}
        </Section>

        <Section kind="electricity" icon={Zap} title="Electricity bills" why="Months of on-time payments at the same address show a steady, real business." hint="The last 3 monthly bills" marks={(i) => (el?.bills ?? []).filter((b) => b.file === i).map((b, k) => ({ id: `u${k}`, box: b.unitsBox, tone: 'gold' }))}>
          {el && (
            <>
              <div className="flex items-end gap-3 rounded-2xl border border-line p-4">
                {[...el.bills].sort((a, b) => a.month.localeCompare(b.month)).map((b, i, all) => {
                  const top = Math.max(...all.map((x) => x.units)) || 1
                  return (
                    <div key={b.month + i} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="font-mono text-xs tabular text-ink-2">{b.units} kWh</span>
                      <div className="flex h-28 w-full items-end">
                        <motion.div className="w-full rounded-t-lg bg-gradient-to-t from-gold/60 to-gold-2" initial={{ height: 0 }} animate={{ height: `${(b.units / top) * 100}%` }} transition={{ delay: i * 0.12, duration: 0.7 }} />
                      </div>
                      <span className="text-sm font-medium">{monthLabel(b.month)}</span>
                      <span className="text-xs tabular text-ink-3">{f(b.amount)}</span>
                      {b.paidOnTime === null ? <StatusPill status="missing">–</StatusPill> : <StatusPill status={b.paidOnTime ? 'pass' : 'watch'}>{b.paidOnTime ? 'Last bill on time' : 'Last bill late'}</StatusPill>}
                    </div>
                  )
                })}
              </div>
              {el.bills[0] && (
                <p className="text-sm text-ink-2">
                  {el.bills[0].provider} · account {el.bills[0].consumerNo} in the name of <b className="text-ink">{el.bills[0].consumerName}</b>, {el.bills[0].serviceAddress}
                </p>
              )}
            </>
          )}
        </Section>
      </div>
    </>
  )
}
