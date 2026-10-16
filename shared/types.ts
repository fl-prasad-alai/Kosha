// Types shared by the Kosha web app and the API.

export type Role = 'business' | 'lender'

export interface User {
  id: string
  role: Role
  name: string
  email: string
  /** Shop name for a business, bank or lender name for a lender. */
  org: string
  createdAt: string
  demo?: boolean
}

export type DecisionStatus = 'approved' | 'more_info' | 'declined'
export interface Decision {
  lenderId: string
  lenderName: string
  org: string
  status: DecisionStatus
  note: string
  at: string
}

export type DocKind = 'ledger' | 'invoice' | 'payments' | 'electricity' | 'shopfront'

/** Gemini box format: [ymin, xmin, ymax, xmax], each scaled to 0–1000. */
export type Box = [number, number, number, number]

export interface Profile {
  shopName: string
  ownerName: string
  address: string
  shopType: string
  since: number
  country: string // ISO 3166 alpha-2, e.g. IN, ID, PH
  language: string // BCP-47 primary tag, e.g. hi, id, tl, en
  currency: string // ISO 4217, e.g. INR
}

export interface CallMeta {
  model: string
  ms: number
  tokensIn: number
  tokensOut: number
  cached: boolean
}

// ───────────────────────── extraction results

export type LedgerType = 'sale' | 'purchase' | 'credit_given' | 'credit_received' | 'expense' | 'other'

export interface LedgerEntry {
  file: number
  date: string // YYYY-MM-DD
  original: string
  english: string
  type: LedgerType
  counterparty: string
  amount: number
  box?: Box
}

export interface LedgerResult {
  language: string
  script: string
  legibility: number
  corrections: number
  notes: string
  entries: LedgerEntry[]
}

export interface InvoiceDoc {
  file: number
  supplierName: string
  supplierAddress: string
  buyerName: string
  buyerAddress: string
  invoiceNo: string
  date: string
  total: number
  paymentTerms: 'cash' | 'credit' | 'unknown'
  creditDays: number
  items: { name: string; qty: number; amount: number }[]
  totalBox?: Box
  concerns: string[]
}
export interface InvoiceResult { documents: InvoiceDoc[] }

export interface DailyPayment { date: string; count: number; amount: number }
export interface PaymentFlag {
  file: number
  date: string
  amount: number
  description: string
  severity: 'high' | 'medium' | 'low'
  box?: Box
}
export interface PaymentsResult {
  sourceType: 'statement' | 'screenshots' | 'unknown'
  provider: string
  merchantName: string
  merchantId: string
  merchantAddress: string
  periodStart: string
  periodEnd: string
  daily: DailyPayment[]
  uniquePayers: number
  repeatShare: number
  balances: { file: number; balance: number; asOf: string }[]
  flags: PaymentFlag[]
}

export interface ElectricityBill {
  file: number
  provider: string
  consumerName: string
  consumerNo: string
  serviceAddress: string
  tariff: string
  month: string // YYYY-MM
  units: number
  amount: number
  dueDate: string
  paidOnTime: boolean | null
  paymentNote: string
  unitsBox?: Box
}
export interface ElectricityResult { bills: ElectricityBill[] }

export interface ShopfrontResult {
  signboardText: string
  matchesShopName: boolean
  shopTypeGuess: string
  operational: boolean
  stockLevel: 'full' | 'moderate' | 'sparse' | 'unknown'
  observations: string[]
  signBox?: Box
}

export interface ExtractResultMap {
  ledger: LedgerResult
  invoice: InvoiceResult
  payments: PaymentsResult
  electricity: ElectricityResult
  shopfront: ShopfrontResult
}

export interface ExtractResponse<K extends DocKind = DocKind> {
  kind: K
  result: ExtractResultMap[K]
  meta: CallMeta
}

// ───────────────────────── location

export interface Place {
  name: string
  category: string
  kind: 'driver' | 'competitor'
  distanceM: number
  bearingDeg: number
  uri?: string
}
export interface LocationResult {
  source: 'maps' | 'search' | 'model'
  listing: { found: boolean; name: string; rating: number | null; reviews: number | null; themes: string[]; uri?: string }
  places: Place[]
  areaSummary: string
  strength: number // 0–100
  sources: { title: string; uri: string }[]
  meta: CallMeta
}

// ───────────────────────── interview

export type QuestionId = 'years' | 'suppliers' | 'busy' | 'credit' | 'purpose'
export interface InterviewAnswer {
  id: QuestionId
  transcript: string
  english: string
  facts: Record<string, string | number | boolean | null>
  meta?: CallMeta
}

// ───────────────────────── assessment

export type CheckStatus = 'pass' | 'watch' | 'fail' | 'missing'
export type SourceNode = 'ledger' | 'invoice' | 'payments' | 'electricity' | 'location' | 'interview' | 'shopfront'

/** Points at the evidence behind a claim, e.g. {doc:'ledger', file:1, index:4}. */
export interface EvidenceRef {
  doc: SourceNode
  file?: number
  index?: number
  label: string
}

export interface Check {
  id: string
  title: string
  status: CheckStatus
  finding: string
  edge?: [SourceNode, SourceNode]
  refs: EvidenceRef[]
}

export interface Pillar {
  id: 'capacity' | 'character' | 'conditions' | 'stability'
  label: string
  score: number // 0–100
  drivers: string[]
}

export interface Metrics {
  days: number
  cashDaily: number
  digitalDaily: number
  dailySales: number
  monthlySales: number
  purchases30: number
  margin: number
  grossProfit: number
  opex30: number
  surplus: number
  digitalShare: number
  creditOutstanding: number
  creditShare: number
  bookkeeping: number
  salesCv: number
  invoiceMatch: number
  billsOnTime: number
  billMonths: number
  yearsInBusiness: number
}

export interface ScheduleMonth { month: string; multiplier: number; instalment: number; festival?: string }

export interface Offer {
  status: 'offer' | 'hold' | 'decline'
  limit: number
  tenureMonths: number
  annualRate: number
  flatEmi: number
  schedule: ScheduleMonth[]
  emiToSurplus: number
}

export interface Purpose {
  summary: string
  cost: number
  extraMonthlyProfit: number
  paysForItself: boolean
  /** Monthly instalment on just the purpose cost, same rate and tenure. */
  emi: number
  reasoning: string
}

export interface Reason { sign: 'plus' | 'minus' | 'stop'; text: string; refs: EvidenceRef[] }

export interface Assessment {
  id: string
  createdAt: string
  profile: Profile
  metrics: Metrics
  checks: Check[]
  pillars: Pillar[]
  score: number
  band: string
  offer: Offer
  purpose: Purpose | null
  reasons: Reason[]
  explanation: { local: string; english: string; localLang: string }
  sourcesUsed: SourceNode[]
  geminiCalls: number
  thumbnail?: string
  ownerId?: string
  decisions?: Decision[]
}

export interface PassportSummary {
  id: string
  createdAt: string
  shopName: string
  ownerName: string
  address: string
  country: string
  currency: string
  score: number
  band: string
  status: Offer['status']
  limit: number
  monthlySales: number
  flags: string[]
  ownerId: string
  decision: Decision | null
  thumbnail?: string
}
