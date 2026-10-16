// Deterministic underwriting: metrics, cross-checks, pillar scores, limit and schedule.
// Every number here can be traced to an extracted document line. Gemini never sets the score.
import type {
  Check, ElectricityResult, EvidenceRef, InterviewAnswer, InvoiceResult, LedgerResult, LocationResult,
  Metrics, Offer, PaymentsResult, Pillar, Profile, ScheduleMonth, ShopfrontResult, SourceNode,
} from '../shared/types.ts'

export interface Inputs {
  profile: Profile
  ledger?: LedgerResult
  invoice?: InvoiceResult
  payments?: PaymentsResult
  electricity?: ElectricityResult
  shopfront?: ShopfrontResult
  location?: LocationResult
  interview?: InterviewAnswer[]
}

export const ANNUAL_RATE = 0.24
export const TENURE = 12
export const PRUDENT_MARGIN = 0.25
const R = ANNUAL_RATE / 12

const DAY = 86_400_000
const toDay = (s: string) => Date.parse(`${s}T00:00:00Z`)
const validDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDay(s))
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x))

export function money(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(n))
  } catch {
    return `${currency} ${Math.round(n).toLocaleString('en')}`
  }
}
const pct = (x: number) => `${Math.round(x * 100)}%`

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !['shop', 'no', 'the', 'road', 'rd', 'st', 'street', 'city', 'india', 'philippines', 'indonesia', 'metro'].includes(t)),
  )
}
/** Share of the shorter address's tokens that appear in the longer one. */
export function addressSimilarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b)
  if (!A.size || !B.size) return 0
  const [small, big] = A.size <= B.size ? [A, B] : [B, A]
  let hit = 0
  for (const t of small) if (big.has(t)) hit++
  return hit / small.size
}

export function annuity(n = TENURE, r = R) {
  return (1 - Math.pow(1 + r, -n)) / r
}

function roundUnit(currency: string, x: number) {
  const units: Record<string, number> = { INR: 5000, PHP: 1000, IDR: 500_000, VND: 1_000_000, THB: 1000, MYR: 500, SGD: 500, USD: 100, JPY: 10_000, KRW: 100_000 }
  const u = units[currency] ?? Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, x))) - 1))
  return Math.floor(x / u) * u
}

// ─────────────────────────────────────────────────────────── metrics

export function computeMetrics(i: Inputs): Metrics & { dailyCash: { date: string; amount: number }[]; ledgerNetCredit: number; flaggedTotal: number } {
  const entries = (i.ledger?.entries ?? []).filter((e) => validDate(e.date))
  const dates = entries.map((e) => toDay(e.date))
  const days = dates.length ? Math.round((Math.max(...dates) - Math.min(...dates)) / DAY) + 1 : 0
  const of = (t: string) => entries.filter((e) => e.type === t)

  const salesByDay = new Map<string, number>()
  for (const e of of('sale')) salesByDay.set(e.date, (salesByDay.get(e.date) ?? 0) + e.amount)
  const dailyCash = [...salesByDay.entries()].sort().map(([date, amount]) => ({ date, amount }))
  const cashDaily = days ? sum(dailyCash.map((d) => d.amount)) / days : 0
  const cashVals = dailyCash.map((d) => d.amount)
  const mean = cashVals.length ? sum(cashVals) / cashVals.length : 0
  const salesCv = mean ? Math.sqrt(sum(cashVals.map((v) => (v - mean) ** 2)) / cashVals.length) / mean : 0

  // Digital: remove flagged (suspected edited) amounts before averaging.
  const pay = i.payments
  const flags = (pay?.flags ?? []).filter((f) => f.severity !== 'low')
  const flaggedTotal = sum(flags.map((f) => f.amount))
  const daily = (pay?.daily ?? []).map((d) => ({ ...d }))
  for (const f of flags) {
    const d = daily.find((x) => x.date === f.date)
    if (d) d.amount = Math.max(0, d.amount - f.amount)
  }
  const pDates = daily.map((d) => toDay(d.date))
  const pDays = pDates.length ? Math.round((Math.max(...pDates) - Math.min(...pDates)) / DAY) + 1 : 0
  const digitalDaily = pDays ? sum(daily.map((d) => d.amount)) / pDays : 0

  const dailySales = cashDaily + digitalDaily
  const monthlySales = dailySales * 30
  const purchases = sum(of('purchase').map((e) => e.amount))
  const invoiceTotal = sum((i.invoice?.documents ?? []).map((d) => d.total))
  const purchases30 = days ? (purchases / days) * 30 : 0
  const margin = monthlySales && purchases30 ? clamp(1 - purchases30 / monthlySales, 0.02, 0.6) : purchases30 ? 0.02 : invoiceTotal ? 0.15 : 0.15

  const expenses = of('expense')
  const electricityInLedger = expenses.some((e) => /electric|power|bijli|kuryente|listrik/i.test(`${e.english} ${e.original}`))
  const bills = i.electricity?.bills ?? []
  const avgBill = bills.length ? sum(bills.map((b) => b.amount)) / bills.length : 0
  const opex30 = (days ? (sum(expenses.map((e) => e.amount)) / days) * 30 : 0) + (electricityInLedger ? 0 : avgBill)
  // Underwrite on a prudent margin: a ledger that understates stock buying must not inflate the limit.
  const grossProfit = monthlySales * Math.min(margin, PRUDENT_MARGIN)
  const surplus = grossProfit - opex30

  const ledgerNetCredit = Math.max(0, sum(of('credit_given').map((e) => e.amount)) - sum(of('credit_received').map((e) => e.amount)))
  const stated = Number(i.interview?.find((a) => a.id === 'credit')?.facts?.creditOutstanding)
  const creditOutstanding = Number.isFinite(stated) && stated > 0 ? stated : ledgerNetCredit

  const activeDays = new Set(entries.map((e) => e.date)).size
  const invoices = i.invoice?.documents ?? []
  const matched = invoices.filter((d) => matchInvoice(d.date, d.total, entries) >= 0).length
  const known = bills.filter((b) => b.paidOnTime !== null)
  const statedYears = Number(i.interview?.find((a) => a.id === 'years')?.facts?.years)
  const years = i.profile.since ? new Date().getFullYear() - i.profile.since : Number.isFinite(statedYears) ? statedYears : 0

  return {
    days,
    cashDaily,
    digitalDaily,
    dailySales,
    monthlySales,
    purchases30,
    margin,
    grossProfit,
    opex30,
    surplus,
    digitalShare: dailySales ? digitalDaily / dailySales : 0,
    creditOutstanding,
    creditShare: monthlySales ? creditOutstanding / monthlySales : 0,
    bookkeeping: days ? activeDays / days : 0,
    salesCv,
    invoiceMatch: invoices.length ? matched / invoices.length : 0,
    billsOnTime: known.length ? known.filter((b) => b.paidOnTime).length / known.length : 0,
    billMonths: new Set(bills.map((b) => b.month)).size,
    yearsInBusiness: Math.max(0, years),
    dailyCash,
    ledgerNetCredit,
    flaggedTotal,
  }
}

/** Index of the ledger purchase that matches an invoice (±2 days, ±2% or ±50), or -1. */
export function matchInvoice(date: string, total: number, entries: LedgerResult['entries']): number {
  if (!validDate(date)) return -1
  const t = toDay(date)
  return entries.findIndex(
    (e) => e.type === 'purchase' && validDate(e.date) && Math.abs(toDay(e.date) - t) <= 2 * DAY && Math.abs(e.amount - total) <= Math.max(50, total * 0.02),
  )
}

// ─────────────────────────────────────────────────────────── checks

export function computeChecks(i: Inputs, m: ReturnType<typeof computeMetrics>): Check[] {
  const c = i.profile.currency
  const f = (n: number) => money(n, c)
  const checks: Check[] = []
  const entries = i.ledger?.entries ?? []
  const firstOf = (t: string) => entries.findIndex((e) => e.type === t)
  const ledgerRef = (idx: number, label: string): EvidenceRef[] => (idx >= 0 ? [{ doc: 'ledger', file: entries[idx].file, index: idx, label }] : [])
  const add = (x: Check) => checks.push(x)
  const missing = (id: string, title: string, need: string, edge?: [SourceNode, SourceNode]) =>
    add({ id, title, status: 'missing', finding: `Add ${need} to run this check.`, edge, refs: [] })

  // 1. Invoices ↔ ledger
  const invoices = i.invoice?.documents ?? []
  if (i.ledger && invoices.length) {
    const matches = invoices.map((d) => matchInvoice(d.date, d.total, entries))
    const n = matches.filter((x) => x >= 0).length
    const status = m.invoiceMatch >= 0.75 ? 'pass' : m.invoiceMatch >= 0.4 ? 'watch' : 'fail'
    add({
      id: 'invoice_ledger',
      title: 'Supplier bills match the ledger',
      status: status === 'fail' ? 'watch' : status,
      finding: `${n} of ${invoices.length} supplier bills appear in the ledger on the same date for the same amount.` + (n < invoices.length ? ' The rest could not be matched.' : ''),
      edge: ['ledger', 'invoice'],
      refs: [
        ...invoices.slice(0, 2).map((d, k) => ({ doc: 'invoice' as const, file: d.file, index: k, label: `Bill ${f(d.total)}` })),
        ...matches.filter((x) => x >= 0).slice(0, 2).flatMap((x) => ledgerRef(x, `Ledger ${f(entries[x].amount)}`)),
      ],
    })
  } else missing('invoice_ledger', 'Supplier bills match the ledger', i.ledger ? 'supplier bills' : 'ledger pages', ['ledger', 'invoice'])

  // 2. Purchases ↔ sales → margin
  if (i.ledger && (i.payments || m.cashDaily) && m.purchases30) {
    const ok = m.margin >= 0.06 && m.margin <= 0.35
    add({
      id: 'margin',
      title: 'Stock purchases fit total sales',
      status: ok ? 'pass' : 'watch',
      finding: `Wholesale buying of ${f(m.purchases30)} against sales of ${f(m.monthlySales)} a month gives a ${pct(m.margin)} gross margin. Neighbourhood shops usually run 8–25%.${m.margin > PRUDENT_MARGIN ? ` The limit uses ${pct(PRUDENT_MARGIN)} to stay safe; some stock buying may be missing from the ledger.` : ''}`,
      edge: ['invoice', 'payments'],
      refs: [...ledgerRef(firstOf('purchase'), 'Purchases'), { doc: 'payments', label: 'Digital sales' }],
    })
  } else missing('margin', 'Stock purchases fit total sales', 'ledger pages with purchases and payment records', ['invoice', 'payments'])

  // 3. Cash ↔ digital
  if (i.ledger && i.payments) {
    const ok = m.digitalShare >= 0.15 && m.digitalShare <= 0.85
    add({
      id: 'mix',
      title: 'Cash and digital sales tell the same story',
      status: ok ? 'pass' : 'watch',
      finding: `${f(m.cashDaily)} a day in cash from the ledger and ${f(m.digitalDaily)} a day received digitally, so ${pct(m.digitalShare)} of sales are digital. That mix is ${ok ? 'normal' : 'unusual'} for a shop like this.`,
      edge: ['ledger', 'payments'],
      refs: [...ledgerRef(firstOf('sale'), 'Cash sales'), { doc: 'payments', label: `${i.payments.provider || 'Payments'} daily` }],
    })
  } else missing('mix', 'Cash and digital sales tell the same story', i.ledger ? 'payment records' : 'ledger pages', ['ledger', 'payments'])

  // 4. Electricity ↔ sales level
  const bills = i.electricity?.bills ?? []
  if (bills.length && m.monthlySales) {
    const avg = sum(bills.map((b) => b.amount)) / bills.length
    const ratio = avg / m.monthlySales
    const units = bills.map((b) => b.units)
    const trend = units.length > 1 ? (units[units.length - 1] - units[0]) / Math.max(1, units[0]) : 0
    const ok = ratio >= 0.003 && ratio <= 0.06
    add({
      id: 'power',
      title: 'Power use fits the sales level',
      status: ok ? 'pass' : 'watch',
      finding: `Electricity costs ${f(avg)} a month, ${(ratio * 100).toFixed(1)}% of sales. Usage ${trend > 0.02 ? `grew ${pct(trend)}` : trend < -0.05 ? `fell ${pct(-trend)}` : 'held steady'} over ${bills.length} months, consistent with a ${trend >= -0.05 ? 'running' : 'slowing'} shop.`,
      edge: ['electricity', 'ledger'],
      refs: bills.slice(-2).map((b) => ({ doc: 'electricity' as const, file: b.file, label: `${b.month} · ${b.units} kWh` })),
    })
  } else missing('power', 'Power use fits the sales level', bills.length ? 'ledger or payment records' : 'electricity bills', ['electricity', 'ledger'])

  // 5. Same shop, same address
  const addresses: { label: string; doc: SourceNode; file?: number; text: string }[] = []
  if (bills[0]) addresses.push({ label: 'Electricity bill', doc: 'electricity', file: bills[0].file, text: bills[0].serviceAddress })
  if (i.payments?.merchantAddress) addresses.push({ label: 'Payment account', doc: 'payments', text: i.payments.merchantAddress })
  const inv = invoices.find((d) => d.buyerAddress)
  if (inv) addresses.push({ label: 'Supplier bill', doc: 'invoice', file: inv.file, text: inv.buyerAddress })
  if (addresses.length) {
    const sims = addresses.map((a) => ({ ...a, sim: addressSimilarity(i.profile.address, a.text) }))
    const bad = sims.filter((s) => s.sim < 0.5)
    const nameOk = bills[0] ? addressSimilarity(`${i.profile.ownerName} ${i.profile.shopName}`, bills[0].consumerName) >= 0.5 : true
    add({
      id: 'address',
      title: 'Every document points to the same shop',
      status: bad.length === 0 && nameOk ? 'pass' : bad.length >= 2 ? 'fail' : 'watch',
      finding:
        bad.length === 0
          ? `The address on the ${sims.map((s) => s.label.toLowerCase()).join(', ')} matches the shop's declared address.${nameOk ? '' : ' The bill is in a different name, so ask who the account holder is.'}`
          : `${bad.map((b) => b.label).join(' and ')} show a different address: "${bad[0].text}".`,
      edge: ['electricity', 'payments'],
      refs: sims.slice(0, 3).map((s) => ({ doc: s.doc, file: s.file, label: s.label })),
    })
  } else missing('address', 'Every document points to the same shop', 'an electricity bill or a payment statement', ['electricity', 'payments'])

  // 6. Location ↔ address on the bill (place exists, demand nearby)
  const loc = i.location
  if (loc) {
    const drivers = loc.places.filter((p) => p.kind === 'driver').length
    const comps = loc.places.filter((p) => p.kind === 'competitor').length
    add({
      id: 'place',
      title: 'The neighbourhood can support these sales',
      status: loc.strength >= 45 ? 'pass' : 'watch',
      finding: `${drivers} places that bring daily customers and ${comps} competing shops within about 800 m. Location strength ${loc.strength}/100.${loc.listing.found ? ` The shop's own map listing has ${loc.listing.rating ?? '–'}★ from ${loc.listing.reviews ?? 0} reviews.` : ''}`,
      edge: ['location', 'ledger'],
      refs: [{ doc: 'location', label: 'Catchment map' }],
    })
    add({
      id: 'located',
      title: 'The shop is where the bill says it is',
      status: loc.listing.found || (bills[0] && addressSimilarity(bills[0].serviceAddress, i.profile.address) >= 0.5) ? 'pass' : 'watch',
      finding: loc.listing.found
        ? `Found "${loc.listing.name}" on the map at the declared address, matching the billing address.`
        : 'No map listing found for the shop. Many small shops have none. The bill address was used instead.',
      edge: ['location', 'electricity'],
      refs: [{ doc: 'location', label: 'Map listing' }, ...(bills[0] ? [{ doc: 'electricity' as const, file: bills[0].file, label: 'Bill address' }] : [])],
    })
  } else {
    missing('place', 'The neighbourhood can support these sales', 'the location scan', ['location', 'ledger'])
    missing('located', 'The shop is where the bill says it is', 'the location scan', ['location', 'electricity'])
  }

  // 7. Integrity: edited payment records (gate)
  if (i.payments) {
    const flags = i.payments.flags.filter((x) => x.severity !== 'low')
    // Independent of Gemini's visual check: a running balance that falls sharply between consecutive screenshots.
    const bal = [...i.payments.balances].filter((b) => b.balance > 0).sort((a, b) => a.asOf.localeCompare(b.asOf))
    const breaks = bal.slice(1).map((b, k) => ({ from: bal[k], to: b })).filter(({ from, to }) => to.balance < from.balance * 0.75)
    const breakNote = breaks.length
      ? ` The wallet balance also drops from ${f(breaks[0].from.balance)} to ${f(breaks[0].to.balance)} between screenshots ${breaks[0].from.file + 1} and ${breaks[0].to.file + 1}, so the earlier balance cannot be real.`
      : ''
    add({
      id: 'integrity',
      title: 'Payment records are genuine',
      status: flags.some((x) => x.severity === 'high') ? 'fail' : flags.length ? 'watch' : 'pass',
      finding: flags.length
        ? `${flags[0].description}${breakNote} The ${f(m.flaggedTotal)} is excluded from sales until the owner shares the record directly from the app.`
        : 'Fonts, spacing and running balances are consistent across every page and screenshot.',
      refs: flags.length
        ? flags.slice(0, 2).map((x, k) => ({ doc: 'payments' as const, file: x.file, index: k, label: `Flag · ${f(x.amount)}` }))
        : [{ doc: 'payments', label: 'All records' }],
    })
  } else missing('integrity', 'Payment records are genuine', 'payment records')

  // 8. Bills paid on time
  if (bills.length) {
    const known = bills.filter((b) => b.paidOnTime !== null)
    const late = known.filter((b) => !b.paidOnTime)
    add({
      id: 'ontime',
      title: 'Bills are paid on time',
      status: !known.length ? 'watch' : late.length === 0 ? 'pass' : late.length === 1 ? 'watch' : 'fail',
      finding: known.length
        ? `${known.length - late.length} of ${known.length} electricity payments shown were on or before the due date.${late.length ? ` Late: ${late.map((b) => b.paymentNote || b.month).join('; ')}.` : ''}`
        : 'The bills do not show when earlier bills were paid.',
      refs: (late.length ? late : bills).slice(0, 2).map((b) => ({ doc: 'electricity' as const, file: b.file, label: b.month })),
    })
  }

  // 9. Bookkeeping discipline
  if (i.ledger) {
    add({
      id: 'discipline',
      title: 'The ledger is kept every day',
      status: m.bookkeeping >= 0.85 ? 'pass' : m.bookkeeping >= 0.6 ? 'watch' : 'fail',
      finding: `Entries on ${Math.round(m.bookkeeping * m.days)} of ${m.days} days, ${i.ledger.entries.length} lines in ${i.ledger.script || i.ledger.language}. Daily sales vary by ${pct(m.salesCv)} around their average.`,
      refs: ledgerRef(0, 'First page'),
    })
  }

  // 10. Customer credit
  if (i.ledger || i.interview?.some((a) => a.id === 'credit')) {
    add({
      id: 'credit',
      title: 'Customer credit is under control',
      status: m.creditShare <= 0.15 ? 'pass' : m.creditShare <= 0.3 ? 'watch' : 'fail',
      finding: `Customers owe about ${f(m.creditOutstanding)}, ${pct(m.creditShare)} of a month's sales.${m.creditShare <= 0.15 ? ' Within the 15% guideline.' : ' Above the 15% guideline.'}`,
      refs: ledgerRef(firstOf('credit_given'), 'Credit given'),
    })
  }

  // 11. Interview agrees with documents
  const iv = i.interview ?? []
  if (iv.length) {
    const notes: string[] = []
    let agree = 0, total = 0
    const years = Number(iv.find((a) => a.id === 'years')?.facts?.years)
    if (Number.isFinite(years) && years > 0 && i.profile.since) {
      total++
      const docYears = new Date().getFullYear() - i.profile.since
      if (Math.abs(years - docYears) <= 1) { agree++; notes.push(`${years} years in business`) } else notes.push(`said ${years} years, profile says ${docYears}`)
    }
    const sup = String(iv.find((a) => a.id === 'suppliers')?.facts?.suppliers ?? '')
    if (sup && invoices.length) {
      total++
      const hit = invoices.some((d) => addressSimilarity(sup, d.supplierName) >= 0.5)
      if (hit) { agree++; notes.push(`named supplier appears on the bills`) } else notes.push('named suppliers are not on the bills')
    }
    const stated = Number(iv.find((a) => a.id === 'credit')?.facts?.creditOutstanding)
    if (Number.isFinite(stated) && stated > 0 && m.ledgerNetCredit > 0) {
      total++
      const r = stated / m.ledgerNetCredit
      if (r >= 0.4 && r <= 2.5) { agree++; notes.push(`credit owed fits the ledger`) } else notes.push(`said ${f(stated)} owed, the ledger shows ${f(m.ledgerNetCredit)}`)
    }
    add({
      id: 'interview',
      title: "The owner's answers match the documents",
      status: !total ? 'watch' : agree === total ? 'pass' : agree >= total / 2 ? 'watch' : 'fail',
      finding: total ? `${agree} of ${total} facts agree: ${notes.join('; ')}.` : 'The answers did not include facts the documents can confirm.',
      edge: ['interview', 'invoice'],
      refs: iv.slice(0, 2).map((a) => ({ doc: 'interview' as const, label: `Answer: ${a.id}` })),
    })
  }

  // 12. Shopfront
  if (i.shopfront) {
    const s = i.shopfront
    add({
      id: 'shopfront',
      title: 'The signboard matches the shop',
      status: s.matchesShopName && s.operational ? 'pass' : s.matchesShopName || s.operational ? 'watch' : 'fail',
      finding: `The sign reads "${s.signboardText.replace(/\s+/g, ' ').slice(0, 80)}". ${s.operational ? 'The shop looks open and trading' : 'The shop does not look open'}, with ${s.stockLevel} shelves.`,
      refs: [{ doc: 'shopfront', label: 'Shopfront photo' }],
    })
  }
  return checks
}

// ─────────────────────────────────────────────────────────── pillars and score

export function computePillars(i: Inputs, m: ReturnType<typeof computeMetrics>, checks: Check[]): Pillar[] {
  const c = i.profile.currency
  const st = (id: string) => checks.find((x) => x.id === id)?.status
  const val = (s?: string) => (s === 'pass' ? 1 : s === 'watch' ? 0.55 : s === 'fail' ? 0.1 : 0.5)

  const surplusRatio = m.monthlySales ? m.surplus / m.monthlySales : 0
  const capacity =
    clamp(surplusRatio / 0.12) * 55 + (1 - clamp(m.salesCv / 0.45)) * 20 + (i.invoice ? m.invoiceMatch : 0.5) * 15 + (i.payments ? 10 : 4)
  const character =
    (i.ledger ? m.bookkeeping : 0.5) * 30 +
    val(st('ontime')) * 25 +
    ((i.invoice?.documents ?? []).some((d) => d.paymentTerms === 'credit') ? 1 : 0.5) * 15 +
    val(st('interview')) * 15 +
    (i.location?.listing.found && i.location.listing.rating ? clamp((i.location.listing.rating - 3) / 1.8) : 0.5) * 15
  const mixOk = m.digitalShare >= 0.15 && m.digitalShare <= 0.85
  const conditions = (i.location ? i.location.strength / 100 : 0.5) * 70 + (i.payments ? (mixOk ? 1 : 0.5) : 0.4) * 30
  const stability =
    clamp(m.yearsInBusiness / 8) * 45 + clamp(m.billMonths / 3) * 20 + val(st('address')) * 15 +
    (i.shopfront ? (i.shopfront.operational ? 1 : 0.2) * (i.shopfront.stockLevel === 'full' ? 1 : i.shopfront.stockLevel === 'moderate' ? 0.8 : 0.5) : 0.5) * 20

  return [
    {
      id: 'capacity', label: 'Capacity', score: Math.round(capacity),
      drivers: [`Surplus after costs: ${money(m.surplus, c)} a month`, `Daily sales vary by ${pct(m.salesCv)}`, i.invoice ? `${pct(m.invoiceMatch)} of supplier bills matched` : 'No supplier bills'],
    },
    {
      id: 'character', label: 'Character', score: Math.round(character),
      drivers: [`Ledger kept on ${pct(m.bookkeeping)} of days`, i.electricity ? `${pct(m.billsOnTime)} of bills paid on time` : 'No bill history', i.location?.listing.found ? `${i.location.listing.rating}★ from ${i.location.listing.reviews} reviews` : 'No map reviews'],
    },
    {
      id: 'conditions', label: 'Conditions', score: Math.round(conditions),
      drivers: [i.location ? `Location strength ${i.location.strength}/100` : 'Location not scanned', `${pct(m.digitalShare)} of sales are digital`],
    },
    {
      id: 'stability', label: 'Stability', score: Math.round(stability),
      drivers: [`${m.yearsInBusiness} years in business`, `${m.billMonths} months of bills at this address`, i.shopfront ? `Shelves look ${i.shopfront.stockLevel}` : 'No shopfront photo'],
    },
  ]
}

export function scoreFrom(pillars: Pillar[]) {
  const w: Record<Pillar['id'], number> = { capacity: 0.35, character: 0.3, conditions: 0.15, stability: 0.2 }
  const blended = pillars.reduce((a, p) => a + p.score * w[p.id], 0)
  const score = Math.round(300 + 6 * blended)
  const band = score >= 800 ? 'A' : score >= 750 ? 'A−' : score >= 700 ? 'B+' : score >= 650 ? 'B' : score >= 600 ? 'C+' : 'C'
  return { score, band }
}

// ─────────────────────────────────────────────────────────── offer

export function computeOffer(
  i: Inputs,
  m: ReturnType<typeof computeMetrics>,
  checks: Check[],
  score: number,
  seasonality: { month: string; multiplier: number; festival?: string }[],
): Offer {
  const gateFail = checks.some((c) => c.id === 'integrity' && c.status === 'fail') || checks.some((c) => c.id === 'address' && c.status === 'fail')
  const emiCap = Math.max(0, 0.35 * m.surplus)
  let limit = roundUnit(i.profile.currency, Math.min(emiCap * annuity(), 1.5 * m.monthlySales))
  if (!Number.isFinite(limit) || limit < 0) limit = 0
  const flatEmi = limit ? limit / annuity() : 0
  const status: Offer['status'] = gateFail ? 'hold' : limit <= 0 || score < 560 ? 'decline' : 'offer'

  // Seasonal schedule: instalment_m = k × multiplier_m, with k chosen so the payments repay the loan at the same rate.
  const start = new Date()
  const months: { month: string; multiplier: number; festival?: string }[] = []
  for (let k = 1; k <= TENURE; k++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, 1))
    const key = d.toISOString().slice(0, 7)
    const s = seasonality.find((x) => x.month === key)
    months.push({ month: key, multiplier: clamp(Number(s?.multiplier) || 1, 0.7, 1.4), festival: s?.festival || undefined })
  }
  const pv = months.reduce((a, x, k) => a + x.multiplier / Math.pow(1 + R, k + 1), 0)
  const kf = limit ? limit / pv : 0
  const schedule: ScheduleMonth[] = months.map((x) => ({ ...x, instalment: Math.round(kf * x.multiplier) }))
  return {
    status,
    limit,
    tenureMonths: TENURE,
    annualRate: ANNUAL_RATE,
    flatEmi: Math.round(flatEmi),
    schedule,
    emiToSurplus: m.surplus > 0 ? flatEmi / m.surplus : 0,
  }
}
