// Builds the passport: deterministic scoring first, then one Gemini call to explain it to the owner.
import { randomBytes } from 'node:crypto'
import type { Assessment, Check, Purpose, Reason, SourceNode } from '../shared/types.ts'
import { callCount, generate } from './gemini.ts'
import { annuity, computeChecks, computeMetrics, computeOffer, computePillars, money, scoreFrom, type Inputs } from './score.ts'

const LANG_NAMES: Record<string, string> = { hi: 'Hindi (Devanagari)', mr: 'Marathi (Devanagari)', tl: 'Tagalog (Taglish is fine)', id: 'Bahasa Indonesia', en: 'English' }

interface Narrative {
  seasonality: { month: string; multiplier: number; festival: string }[]
  purpose: { summary: string; cost: number; extraMonthlyProfit: number; reasoning: string } | null
  reasons: { sign: 'plus' | 'minus' | 'stop'; text: string; checkIds: string[] }[]
  explanationLocal: string
  explanationEnglish: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    seasonality: {
      type: 'array',
      description: 'One entry per month listed in "months". multiplier = expected sales that month relative to an average month (0.7-1.4). festival = the main festival or season driving it, or "".',
      items: { type: 'object', properties: { month: { type: 'string' }, multiplier: { type: 'number' }, festival: { type: 'string' } }, required: ['month', 'multiplier', 'festival'] },
    },
    purpose: {
      type: ['object', 'null'],
      properties: {
        summary: { type: 'string', description: 'What the loan will buy, one short English phrase' },
        cost: { type: 'number' },
        extraMonthlyProfit: { type: 'number', description: 'YOUR realistic estimate of the extra monthly profit, which may differ from what the owner said' },
        reasoning: { type: 'string', description: 'One or two sentences on how you estimated it' },
      },
      required: ['summary', 'cost', 'extraMonthlyProfit', 'reasoning'],
    },
    reasons: {
      type: 'array',
      description: '4-6 reasons behind the result for the loan officer, written in ENGLISH, most important first. Quote the exact formatted numbers given. checkIds = ids of the checks that support the reason. sign: plus = helps, minus = hurts, stop = blocks the offer.',
      items: {
        type: 'object',
        properties: { sign: { type: 'string', enum: ['plus', 'minus', 'stop'] }, text: { type: 'string' }, checkIds: { type: 'array', items: { type: 'string' } } },
        required: ['sign', 'text', 'checkIds'],
      },
    },
    explanationLocal: { type: 'string', description: 'What to tell the owner, 3-4 warm, plain sentences in the requested language, addressed to them respectfully' },
    explanationEnglish: { type: 'string', description: 'The same message in English' },
  },
  required: ['seasonality', 'purpose', 'reasons', 'explanationLocal', 'explanationEnglish'],
}

const SYSTEM = `You are Kosha, explaining a small-shop credit assessment to the shop owner and to a loan officer.
The numbers, checks and offer are already decided by Kosha's rules. Do not change, recompute or invent numbers: quote the formatted values you are given.
Write simply, like a respectful local bank officer. No jargon. Never promise approval; say the shop "qualifies for an offer of up to" when there is an offer.
If the status is "hold", explain kindly what is missing and the one thing the owner can do next.
Language: reasons and explanationEnglish are in English. Only explanationLocal is in the owner's language.`

export async function assess(i: Inputs, thumbnail?: string): Promise<Assessment> {
  const before = callCount
  const m = computeMetrics(i)
  const checks = computeChecks(i, m)
  const pillars = computePillars(i, m, checks)
  const { score, band } = scoreFrom(pillars)
  const c = i.profile.currency
  const f = (n: number) => money(n, c)

  const draft = computeOffer(i, m, checks, score, [])
  const months = draft.schedule.map((s) => s.month)
  const purposeAns = i.interview?.find((a) => a.id === 'purpose')

  let narrative: Narrative | null = null
  try {
    const res = await generate<Narrative>({
      task: 'narrate.v3',
      system: SYSTEM,
      schema: SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 8192,
      parts: [
        {
          text: JSON.stringify({
            shop: { ...i.profile, yearsInBusiness: m.yearsInBusiness },
            language: LANG_NAMES[i.profile.language] ?? i.profile.language,
            status: draft.status,
            score: `${score} / 900 (band ${band})`,
            offer: draft.status === 'offer' ? { limit: f(draft.limit), tenure: '12 months', monthlyInstalment: f(draft.flatEmi), rate: '24% a year' } : null,
            metrics: {
              cashSalesPerDay: f(m.cashDaily),
              digitalSalesPerDay: f(m.digitalDaily),
              monthlySales: f(m.monthlySales),
              grossMargin: `${Math.round(m.margin * 100)}%`,
              monthlySurplusAfterCosts: f(m.surplus),
              customerCreditOutstanding: f(m.creditOutstanding),
              excludedSuspectAmount: m.flaggedTotal ? f(m.flaggedTotal) : null,
            },
            pillars: pillars.map((p) => ({ name: p.label, score: p.score, drivers: p.drivers })),
            checks: checks.filter((x) => x.status !== 'missing').map((x) => ({ id: x.id, title: x.title, status: x.status, finding: x.finding })),
            missingEvidence: checks.filter((x) => x.status === 'missing').map((x) => x.title),
            loanPurposeAnswer: purposeAns ? { said: purposeAns.english, facts: purposeAns.facts } : null,
            busySeasonsAnswer: i.interview?.find((a) => a.id === 'busy')?.english ?? null,
            months,
          }),
        },
      ],
    })
    narrative = res.data
  } catch (e) {
    console.warn('[assess] narrative failed, using rule-based text:', (e as Error).message.slice(0, 120))
  }

  const offer = computeOffer(i, m, checks, score, narrative?.seasonality ?? [])
  const purpose: Purpose | null = narrative?.purpose
    ? (() => {
        const cost = Math.min(Number(narrative.purpose.cost) || 0, offer.limit || Infinity)
        const emi = Math.round(cost / annuity())
        return { ...narrative.purpose, cost, emi, paysForItself: emi > 0 && narrative.purpose.extraMonthlyProfit >= emi }
      })()
    : null

  const byId = new Map(checks.map((x) => [x.id, x]))
  const reasons: Reason[] = narrative?.reasons?.length
    ? narrative.reasons.map((r) => ({
        sign: r.sign,
        text: r.text,
        refs: (r.checkIds ?? []).flatMap((id) => byId.get(id)?.refs ?? []).slice(0, 3),
      }))
    : fallbackReasons(checks)

  const explanation = narrative
    ? { local: narrative.explanationLocal, english: narrative.explanationEnglish, localLang: i.profile.language }
    : { local: fallbackText(offer.status, f(offer.limit), f(offer.flatEmi)), english: fallbackText(offer.status, f(offer.limit), f(offer.flatEmi)), localLang: 'en' }

  const sourcesUsed = (['ledger', 'invoice', 'payments', 'electricity', 'location', 'interview', 'shopfront'] as SourceNode[]).filter((k) =>
    k === 'interview' ? !!i.interview?.length : !!i[k as keyof Inputs],
  )

  const { dailyCash: _d, ledgerNetCredit: _l, flaggedTotal: _f, ...metrics } = m
  return {
    id: `KSH-${i.profile.country || 'XX'}-${randomBytes(3).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    profile: i.profile,
    metrics,
    checks,
    pillars,
    score,
    band,
    offer,
    purpose,
    reasons,
    explanation,
    sourcesUsed,
    geminiCalls: callCount - before,
    thumbnail,
  }
}

function fallbackReasons(checks: Check[]): Reason[] {
  return checks
    .filter((c) => c.status !== 'missing')
    .sort((a, b) => order(a.status) - order(b.status))
    .slice(0, 6)
    .map((c) => ({ sign: c.status === 'fail' ? (c.id === 'integrity' ? 'stop' : 'minus') : c.status === 'watch' ? 'minus' : 'plus', text: c.finding, refs: c.refs }))
}
const order = (s: string) => (s === 'fail' ? 0 : s === 'watch' ? 1 : 2)

function fallbackText(status: string, limit: string, emi: string) {
  if (status === 'offer') return `Your shop qualifies for an offer of up to ${limit} over 12 months, about ${emi} a month. This is based on your ledger, bills and payment records.`
  if (status === 'hold') return 'We could not finish your assessment yet because one record needs checking. Please share it directly from the app and we will complete your passport.'
  return 'We cannot make an offer yet. Keeping your ledger daily and adding more months of records will help next time.'
}
