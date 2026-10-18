// Document reading: one Gemini vision call per document type, with a strict JSON schema.
import type { Part } from '@google/genai'
import type { DocKind, ExtractResultMap, Profile } from '@shared/types'
import { generate, inline, type CallResult } from './gemini.ts'

export interface UploadedFile {
  /** base64 */
  data: string
  mimetype: string
  originalname: string
}

const BOX = { type: 'array', items: { type: 'integer' }, description: 'Bounding box [ymin, xmin, ymax, xmax] scaled 0-1000 on that file' }
const str = { type: 'string' }
const num = { type: 'number' }
const int = { type: 'integer' }

const SCHEMAS: Record<DocKind, object> = {
  ledger: {
    type: 'object',
    properties: {
      language: { ...str, description: 'Language of the handwriting, e.g. Hindi' },
      script: { ...str, description: 'Writing script, e.g. Devanagari' },
      legibility: { ...num, description: '0-1, how legible the handwriting is overall' },
      corrections: { ...int, description: 'How many struck-out or overwritten entries you saw' },
      notes: str,
      entries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: int,
            date: { ...str, description: 'YYYY-MM-DD' },
            original: { ...str, description: 'The line exactly as written, in its own script' },
            english: { ...str, description: 'Short plain-English meaning' },
            type: { type: 'string', enum: ['sale', 'purchase', 'credit_given', 'credit_received', 'expense', 'other'] },
            counterparty: { ...str, description: 'Supplier or customer name in Latin letters, or empty' },
            amount: num,
            box: BOX,
          },
          required: ['file', 'date', 'original', 'english', 'type', 'counterparty', 'amount', 'box'],
        },
      },
    },
    required: ['language', 'script', 'legibility', 'corrections', 'notes', 'entries'],
  },
  invoice: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: int,
            supplierName: str,
            supplierAddress: str,
            buyerName: str,
            buyerAddress: str,
            invoiceNo: str,
            date: { ...str, description: 'YYYY-MM-DD' },
            total: num,
            paymentTerms: { type: 'string', enum: ['cash', 'credit', 'unknown'] },
            creditDays: int,
            items: {
              type: 'array',
              items: { type: 'object', properties: { name: str, qty: num, amount: num }, required: ['name', 'qty', 'amount'] },
            },
            totalBox: BOX,
            concerns: { type: 'array', items: str, description: 'ONLY visible physical signs of tampering: overwritten digits, different ink or font, erasures, pasted-in text. Do not report arithmetic. Empty if none, which is the normal case.' },
          },
          required: ['file', 'supplierName', 'supplierAddress', 'buyerName', 'buyerAddress', 'invoiceNo', 'date', 'total', 'paymentTerms', 'creditDays', 'items', 'totalBox', 'concerns'],
        },
      },
    },
    required: ['documents'],
  },
  payments: {
    type: 'object',
    properties: {
      sourceType: { type: 'string', enum: ['statement', 'screenshots', 'unknown'] },
      provider: str,
      merchantName: str,
      merchantId: { ...str, description: 'UPI ID, merchant ID or wallet number as printed' },
      merchantAddress: { ...str, description: 'Address printed on the statement, or empty' },
      periodStart: { ...str, description: 'YYYY-MM-DD' },
      periodEnd: { ...str, description: 'YYYY-MM-DD' },
      daily: {
        type: 'array',
        description: 'Money RECEIVED per calendar day. For screenshots, add up incoming rows per day. Include flagged rows here too.',
        items: { type: 'object', properties: { date: str, count: int, amount: num }, required: ['date', 'count', 'amount'] },
      },
      uniquePayers: { ...int, description: 'As printed, else your count of distinct senders, else 0' },
      repeatShare: { ...num, description: '0-1 share of repeat payers as printed, else your estimate, else 0' },
      balances: {
        type: 'array',
        items: { type: 'object', properties: { file: int, balance: num, asOf: str }, required: ['file', 'balance', 'asOf'] },
      },
      flags: {
        type: 'array',
        description: 'Signs of editing or fraud: digits in a different font/weight/alignment, balances that do not carry over between screenshots, totals that do not add up, impossible dates. Empty if genuine.',
        items: {
          type: 'object',
          properties: {
            file: int,
            date: str,
            amount: num,
            description: str,
            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            box: BOX,
          },
          required: ['file', 'date', 'amount', 'description', 'severity', 'box'],
        },
      },
    },
    required: ['sourceType', 'provider', 'merchantName', 'merchantId', 'merchantAddress', 'periodStart', 'periodEnd', 'daily', 'uniquePayers', 'repeatShare', 'balances', 'flags'],
  },
  electricity: {
    type: 'object',
    properties: {
      bills: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: int,
            provider: str,
            consumerName: str,
            consumerNo: str,
            serviceAddress: str,
            tariff: str,
            month: { ...str, description: 'Billing month YYYY-MM' },
            units: { ...num, description: 'kWh consumed' },
            amount: num,
            dueDate: { ...str, description: 'YYYY-MM-DD' },
            paidOnTime: { type: ['boolean', 'null'], description: 'Was the PREVIOUS bill (shown as last payment received) paid on or before its due date? null if not shown' },
            paymentNote: { ...str, description: 'The payment line as printed, e.g. "Last payment received 12 Aug 2026"' },
            unitsBox: BOX,
          },
          required: ['file', 'provider', 'consumerName', 'consumerNo', 'serviceAddress', 'tariff', 'month', 'units', 'amount', 'dueDate', 'paidOnTime', 'paymentNote', 'unitsBox'],
        },
      },
    },
    required: ['bills'],
  },
  identity: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: int,
            kind: { type: 'string', enum: ['pan', 'aadhaar', 'voter_id', 'driving_licence', 'passport', 'philsys', 'umid', 'ktp', 'other'] },
            number: { ...str, description: 'The ID number exactly as printed, without spaces. For an Aadhaar card give ONLY its last 4 digits, never the full 12-digit number (the law forbids storing it).' },
            name: { ...str, description: 'Holder name as printed, in its own script' },
            nameLatin: { ...str, description: 'Holder name in Latin letters (transliterate if needed)' },
            fatherName: { ...str, description: "Father's or spouse's name if printed, else ''" },
            dob: { ...str, description: 'Date of birth YYYY-MM-DD, or YYYY if only the year is printed, else ""' },
            gender: str,
            address: { ...str, description: 'Address if printed, else ""' },
            specimen: { type: 'boolean', description: 'true if the card itself is marked SPECIMEN, SAMPLE or similar' },
            tamperSigns: { type: 'array', items: str, description: 'Signs of editing: mismatched fonts, misaligned or pasted text, photo pasted over, impossible dates. Empty if it looks genuine.' },
            numberBox: BOX,
            nameBox: BOX,
          },
          required: ['file', 'kind', 'number', 'name', 'nameLatin', 'fatherName', 'dob', 'gender', 'address', 'specimen', 'tamperSigns', 'numberBox', 'nameBox'],
        },
      },
    },
    required: ['documents'],
  },
  business: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: int,
            kind: { type: 'string', enum: ['gst', 'udyam', 'udyam_assist', 'fssai', 'shop_establishment', 'trade_licence', 'dti', 'mayors_permit', 'bir', 'nib', 'other'] },
            number: { ...str, description: 'Registration number exactly as printed (GSTIN, Udyam number, FSSAI licence, DTI BN number…), without spaces' },
            legalName: { ...str, description: 'Legal name of the business or proprietor' },
            tradeName: { ...str, description: 'Trade or shop name, if different, else ""' },
            ownerName: { ...str, description: 'Proprietor / owner name in Latin letters, if printed' },
            address: { ...str, description: 'Principal place of business' },
            registeredOn: { ...str, description: 'Date of registration or incorporation YYYY-MM-DD, else ""' },
            validTill: { ...str, description: 'Expiry date YYYY-MM-DD, else ""' },
            statusPrinted: { ...str, description: 'Registration status if printed, e.g. Active, Cancelled' },
            activity: { ...str, description: 'Business activity or NIC description, short' },
            specimen: { type: 'boolean', description: 'true if marked SPECIMEN, SAMPLE or similar' },
            tamperSigns: { type: 'array', items: str, description: 'Signs of editing. Empty if it looks genuine.' },
            numberBox: BOX,
          },
          required: ['file', 'kind', 'number', 'legalName', 'tradeName', 'ownerName', 'address', 'registeredOn', 'validTill', 'statusPrinted', 'activity', 'specimen', 'tamperSigns', 'numberBox'],
        },
      },
    },
    required: ['documents'],
  },
  shopfront: {
    type: 'object',
    properties: {
      signboardText: { ...str, description: 'All text on the signboard, as written' },
      matchesShopName: { type: 'boolean', description: 'Does the signboard match the declared shop name (any language or script)?' },
      shopTypeGuess: str,
      operational: { type: 'boolean', description: 'Does it look like a working shop (stock, open shutter, customers)?' },
      stockLevel: { type: 'string', enum: ['full', 'moderate', 'sparse', 'unknown'] },
      observations: { type: 'array', items: str, description: '3-5 short factual observations a loan officer would care about' },
      signBox: BOX,
    },
    required: ['signboardText', 'matchesShopName', 'shopTypeGuess', 'operational', 'stockLevel', 'observations', 'signBox'],
  },
}

const SYSTEM = `You are Kosha's document reader. Kosha helps small shops in Asia that have no formal credit history get fair loans, by reading the documents they already keep.
Read every file carefully, like an experienced loan officer who knows local scripts, currencies and bookkeeping habits.
Rules:
- Report only what is written. Never invent rows, amounts or names. If a value is missing, use "" or 0.
- Amounts are plain numbers in the shop's currency, without symbols or separators ("5,920/-" -> 5920).
- Dates are YYYY-MM-DD. Day/month dates without a year belong to the most recent past occurrence before today.
- "file" is the 0-based index of the file the item came from, in the order the files were given.
- Bounding boxes use [ymin, xmin, ymax, xmax] scaled to 0-1000 on that file.`

const TASK: Record<DocKind, string> = {
  ledger: `These are photos of a handwritten shop ledger (khata / buku catatan / listahan). Transcribe EVERY line into entries, in page order.
Classify each line: daily sales takings = sale; stock bought from a wholesaler or distributor = purchase; goods given to a customer on credit (udhaar, utang, bon) = credit_given; a customer paying back credit = credit_received; rent, electricity, wages, tea and other costs = expense.
Give each entry a tight box around its whole row. Count struck-out corrections.`,
  invoice: `These are photos of supplier invoices or wholesale bills bought by the shop. Return one document per invoice with every line item. Read the printed total exactly as printed.`,
  payments: `These are digital payment records for the shop: either a merchant collection statement (bank, UPI, QRIS) or app screenshots of an e-wallet history. Work out money received per day.
Look hard for tampering: digits in a heavier or different font, misaligned rows, a running balance that does not carry over between consecutive screenshots, totals that do not add up. A flagged row's box must tightly enclose that row.`,
  electricity: `These are electricity bills for the shop's premises. Return one entry per bill. paidOnTime refers to the previous bill, shown as "last payment received" (or a PAID stamp), compared with that previous bill's due date when both are visible.`,
  identity: `These are photos of the shop owner's identity documents (PAN card, Aadhaar, voter ID, driving licence, PhilSys, KTP…). Return one document per card; the front and back of the same Aadhaar card are one document. Read the number, name and date of birth exactly; give the name in Latin letters too. Note any sign of editing.`,
  business: `These are photos of the shop's business registration documents (GST certificate, Udyam or Udyam Assist certificate, FSSAI licence, shop & establishment or trade licence, DTI or mayor's permit, NIB…). Return one document per certificate with the registration number, names, address and dates exactly as printed.`,
  shopfront: `This is a photo of the shop from outside. Read the signboard, compare it with the declared shop name, and describe what a loan officer would notice.`,
}

export async function extract<K extends DocKind>(
  kind: K,
  files: UploadedFile[],
  profile: Partial<Profile>,
): Promise<CallResult<ExtractResultMap[K]>> {
  const today = new Date().toISOString().slice(0, 10)
  const parts: Part[] = [
    {
      text: `Today is ${today}. Declared shop: ${JSON.stringify({
        shopName: profile.shopName,
        owner: profile.ownerName,
        address: profile.address,
        country: profile.country,
        language: profile.language,
        currency: profile.currency,
      })}.\n\n${TASK[kind]}`,
    },
  ]
  files.forEach((f, i) => {
    parts.push({ text: `File ${i}: ${f.originalname}` })
    parts.push(inline(f.data, f.mimetype))
  })
  const res = await generate<ExtractResultMap[K]>({
    task: `extract.${kind}.v3`,
    system: SYSTEM,
    parts,
    schema: SCHEMAS[kind],
    maxOutputTokens: kind === 'ledger' || kind === 'payments' ? 24576 : 8192,
  })
  return { ...res, data: normalise(kind, res.data, files.length) }
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(String(v ?? '').replace(/[^\d.-]/g, '')) || 0)
const clampFile = (f: unknown, count: number) => Math.min(Math.max(0, Math.round(n(f))), Math.max(0, count - 1))
const box = (b: unknown) =>
  Array.isArray(b) && b.length === 4 && b.every((x) => typeof x === 'number') ? (b.map((x) => Math.max(0, Math.min(1000, x))) as [number, number, number, number]) : undefined

/** Defensive clean-up so the scoring code never sees NaN, strings or out-of-range file indexes. */
function normalise<K extends DocKind>(kind: K, d: ExtractResultMap[K], count: number): ExtractResultMap[K] {
  const any = d as unknown as Record<string, unknown>
  if (kind === 'ledger') {
    const r = any as unknown as ExtractResultMap['ledger']
    r.entries = (r.entries ?? []).map((e) => ({ ...e, file: clampFile(e.file, count), amount: Math.abs(n(e.amount)), box: box(e.box) }))
    r.legibility = Math.min(1, Math.max(0, n(r.legibility)))
  } else if (kind === 'invoice') {
    const r = any as unknown as ExtractResultMap['invoice']
    r.documents = (r.documents ?? []).map((x) => ({
      ...x,
      file: clampFile(x.file, count),
      total: n(x.total),
      creditDays: n(x.creditDays),
      items: x.items ?? [],
      concerns: [
        ...(x.concerns ?? []).filter((c) => !/match|sum|total|calculat|\d\s*[x*×]\s*\d/i.test(c)),
        ...(() => {
          const items = (x.items ?? []).reduce((a, it) => a + n(it.amount), 0)
          const total = n(x.total)
          return items && total && Math.abs(items - total) > Math.max(20, total * 0.03) ? [`Line items add up to ${Math.round(items)}, but the bill total is ${Math.round(total)}.`] : []
        })(),
      ],
      totalBox: box(x.totalBox),
    }))
  } else if (kind === 'payments') {
    const r = any as unknown as ExtractResultMap['payments']
    r.daily = (r.daily ?? []).map((x) => ({ date: x.date, count: Math.round(n(x.count)), amount: n(x.amount) })).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date))
    r.flags = (r.flags ?? []).map((x) => ({ ...x, file: clampFile(x.file, count), amount: n(x.amount), box: box(x.box) }))
    r.balances = (r.balances ?? []).map((x) => ({ ...x, file: clampFile(x.file, count), balance: n(x.balance) }))
    r.uniquePayers = Math.round(n(r.uniquePayers))
    r.repeatShare = Math.min(1, Math.max(0, n(r.repeatShare)))
  } else if (kind === 'electricity') {
    const r = any as unknown as ExtractResultMap['electricity']
    r.bills = (r.bills ?? []).map((x) => ({ ...x, file: clampFile(x.file, count), units: n(x.units), amount: n(x.amount), unitsBox: box(x.unitsBox) }))
  } else if (kind === 'identity') {
    const r = any as unknown as ExtractResultMap['identity']
    r.documents = (r.documents ?? []).map((x) => {
      const number = String(x.number ?? '').replace(/\s+/g, '').toUpperCase()
      // Aadhaar: keep only the last 4 digits, whatever the model returned
      return { ...x, file: clampFile(x.file, count), number: x.kind === 'aadhaar' ? number.replace(/\D/g, '').slice(-4) : number, tamperSigns: x.tamperSigns ?? [], numberBox: box(x.numberBox), nameBox: box(x.nameBox) }
    })
  } else if (kind === 'business') {
    const r = any as unknown as ExtractResultMap['business']
    r.documents = (r.documents ?? []).map((x) => ({ ...x, file: clampFile(x.file, count), number: String(x.number ?? '').replace(/\s+/g, '').toUpperCase(), tamperSigns: x.tamperSigns ?? [], numberBox: box(x.numberBox) }))
  } else if (kind === 'shopfront') {
    const r = any as unknown as ExtractResultMap['shopfront']
    r.signBox = box(r.signBox)
    r.observations = r.observations ?? []
  }
  return d
}
