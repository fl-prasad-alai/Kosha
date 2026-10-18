// Who the owner is and whether the business is registered. Deterministic checks only: ID formats and check
// digits, the PAN inside a GSTIN, state codes, and whether every source names the same person and place.
// Gemini only reads the cards; these rules decide. Identity is a gate and a confidence level, never score points.
import type {
  AadhaarQr, BusinessDoc, BusinessResult, Check, CheckStatus, ElectricityResult, EvidenceRef, IdentityDoc, IdentityFact,
  IdentityInput, IdentityResult, IdentitySummary, PaymentsResult, Profile, ProofLevel,
} from '@shared/types'
import { addressSimilarity } from './score.ts'

// ─────────────────────────────────────────────── formats

const PAN = /^[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]$/
const PAN_HOLDER: Record<string, string> = {
  P: 'an individual', C: 'a company', H: 'a Hindu undivided family', F: 'a firm', A: 'an association of persons', T: 'a trust',
  B: 'a body of individuals', L: 'a local authority', J: 'an artificial juridical person', G: 'a government body',
}
export const validPan = (pan?: string) => !!pan && PAN.test(pan)
export const panHolder = (pan: string) => PAN_HOLDER[pan[3]] ?? 'unknown'
export const maskPan = (pan: string) => `${pan.slice(0, 5)}****${pan.slice(9)}`

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const CP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
/** The 15th character of a GSTIN is a check character over the first 14 (Luhn mod 36). */
export function gstinCheckChar(first14: string) {
  let factor = 2, sum = 0
  for (let i = first14.length - 1; i >= 0; i--) {
    const d = factor * CP.indexOf(first14[i])
    factor = factor === 2 ? 1 : 2
    sum += Math.floor(d / 36) + (d % 36)
  }
  return CP[(36 - (sum % 36)) % 36]
}
export const validGstin = (g?: string) => !!g && GSTIN.test(g) && gstinCheckChar(g.slice(0, 14)) === g[14]

export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh', '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
}
export const validUdyam = (u?: string) => !!u && /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(u)
export const validFssai = (f?: string) => !!f && /^[12]\d{13}$/.test(f)
export const validTin = (t?: string) => !!t && /^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/.test(t)

/** What is wrong with a typed GSTIN, in plain words, or null when it is fine. */
export function gstinProblem(g: string, pan?: string, address?: string): string | null {
  if (!GSTIN.test(g)) return 'A GSTIN has 15 characters: 2-digit state code, the 10-character PAN, then 3 more.'
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return 'The last character does not match the rest, so there is a typing mistake.'
  if (pan && validPan(pan) && g.slice(2, 12) !== pan) return 'This GSTIN belongs to a different PAN.'
  const state = GST_STATES[g.slice(0, 2)]
  if (!state) return 'The first two digits are not a valid state code.'
  if (address && !sameState(address, state)) return `This GSTIN is registered in ${state}, but the shop address is elsewhere.`
  return null
}
const sameState = (address: string, state: string) => address.toLowerCase().includes(state.toLowerCase().split(' ')[0])

// ─────────────────────────────────────────────── names

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'smt', 'shri', 'shrimati', 'sri', 'km', 'kumari', 'dr', 'sh', 'ibu', 'bapak', 'bpk', 'gng', 'mr.'])
const nameTokens = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t && !TITLES.has(t))
/** 0–1: how well two names agree. Initials match whole words ("S. Sharma" ~ "Sunita Sharma"). */
export function nameMatch(a: string, b: string): number {
  const A = nameTokens(a), B = nameTokens(b)
  if (!A.length || !B.length) return 0
  const [small, big] = A.length <= B.length ? [A, B] : [B, A]
  const used = new Set<number>()
  let hit = 0
  for (const t of small) {
    const j = big.findIndex((u, k) => !used.has(k) && (u === t || (t.length === 1 && u[0] === t) || (u.length === 1 && t[0] === u) || (t.length > 3 && u.length > 3 && (u.startsWith(t) || t.startsWith(u)))))
    if (j >= 0) { used.add(j); hit++ }
  }
  return hit / small.length
}
const surnameInitial = (name: string) => nameTokens(name).at(-1)?.[0]?.toUpperCase()

// ─────────────────────────────────────────────── the summary and checks

export interface IdentityInputs {
  profile: Profile
  input?: IdentityInput & { sample?: boolean }
  identity?: IdentityResult
  business?: BusinessResult
  electricity?: ElectricityResult
  payments?: PaymentsResult
  claim?: IdentitySummary['claim']
}

const RANK: ProofLevel[] = ['none', 'self', 'document', 'registry', 'signed']
const max = (a: ProofLevel, b: ProofLevel) => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b)
const worst = (xs: CheckStatus[]): CheckStatus => (xs.includes('fail') ? 'fail' : xs.includes('watch') ? 'watch' : xs.length ? 'pass' : 'missing')
const year = (d: string) => (d ? Number(d.slice(0, 4)) : 0)
const ID_LABEL: Record<string, string> = { pan: 'PAN card', aadhaar: 'Aadhaar card', voter_id: 'Voter ID', driving_licence: 'Driving licence', passport: 'Passport', philsys: 'PhilSys ID', umid: 'UMID', ktp: 'KTP', other: 'ID card' }
const BIZ_LABEL: Record<string, string> = { gst: 'GST certificate', udyam: 'Udyam certificate', udyam_assist: 'Udyam Assist certificate', fssai: 'FSSAI licence', shop_establishment: 'Shop & establishment licence', trade_licence: 'Trade licence', dti: 'DTI business name', mayors_permit: "Mayor's permit", bir: 'BIR registration', nib: 'NIB', other: 'Registration' }

export function buildIdentity(x: IdentityInputs): { summary: IdentitySummary; checks: Check[] } {
  const p = x.profile
  const inp = x.input ?? {}
  const qr = inp.aadhaar
  const docs = x.identity?.documents ?? []
  const biz = x.business?.documents ?? []
  const facts: IdentityFact[] = []
  const checks: Check[] = []
  const sample = !!inp.sample
  const idRef = (d: IdentityDoc, label: string): EvidenceRef => ({ doc: 'identity', file: d.file, index: docs.indexOf(d), label })
  const bizRef = (d: BusinessDoc, label: string): EvidenceRef => ({ doc: 'business', file: d.file, index: biz.indexOf(d), label })
  // A card stamped SPECIMEN is only acceptable for the fictional sample shops.
  const usable = (d: { specimen: boolean; tamperSigns: string[] }) => !d.tamperSigns.length && (!d.specimen || sample)

  // ── person
  let person: ProofLevel = 'none'
  const notes: string[] = []
  const st: CheckStatus[] = []
  const refs: EvidenceRef[] = []
  const names: { source: string; name: string }[] = []

  if (qr) {
    if (qr.signed === false) {
      st.push('fail')
      notes.push("The Aadhaar QR is not signed by UIDAI, so the card may have been edited.")
    } else {
      person = max(person, qr.signed ? 'signed' : 'document')
      names.push({ source: 'Aadhaar QR', name: qr.name })
    }
    facts.push({ id: 'aadhaar', label: 'Aadhaar', value: `•••• •••• ${qr.last4 || '····'}`, proof: qr.signed ? 'signed' : qr.signed === false ? 'self' : 'document', source: qr.signed ? `Secure QR, signed by UIDAI` : 'Aadhaar QR (signature not checked)', status: qr.signed === false ? 'fail' : 'pass', note: [qr.district, qr.state].filter(Boolean).join(', ') })
  }
  for (const d of docs) {
    if (d.tamperSigns.length) {
      st.push('fail')
      notes.push(`The ${ID_LABEL[d.kind]} shows signs of editing: ${d.tamperSigns[0]}.`)
      refs.push(idRef(d, ID_LABEL[d.kind]))
      continue
    }
    if (d.specimen && !sample) {
      st.push('fail')
      notes.push(`The ${ID_LABEL[d.kind]} is a specimen, not a real card.`)
      continue
    }
    person = max(person, 'document')
    names.push({ source: ID_LABEL[d.kind], name: d.nameLatin || d.name })
    refs.push(idRef(d, ID_LABEL[d.kind]))
    // other ID cards: show the number masked to its last 4 characters
    if (d.kind !== 'pan' && d.number) facts.push({ id: `id_${d.kind}`, label: ID_LABEL[d.kind], value: d.number.replace(/[^A-Z0-9]/gi, '').replace(/.(?=.{4})/g, '•'), proof: 'document', source: `Read from the ${ID_LABEL[d.kind]}`, status: 'pass' })
  }

  // PAN: typed or read from the card
  const panDoc = docs.find((d) => d.kind === 'pan' && usable(d))
  const pan = (inp.pan || panDoc?.number || '').toUpperCase()
  if (pan) {
    if (!validPan(pan)) {
      st.push('fail')
      notes.push(`"${maskPan(pan.padEnd(10, '?'))}" is not a valid PAN.`)
    } else {
      const holder = panHolder(pan)
      if (pan[3] !== 'P') { st.push('watch'); notes.push(`The PAN belongs to ${holder}, not an individual.`) }
      const ini = surnameInitial(p.ownerName)
      if (pan[3] === 'P' && ini && pan[4] !== ini) { st.push('watch'); notes.push(`A personal PAN's 5th letter is the surname's initial; ${pan[4]} does not match "${p.ownerName}".`) }
      if (panDoc && inp.pan && panDoc.number !== inp.pan.toUpperCase()) { st.push('fail'); notes.push('The PAN typed differs from the PAN card.') }
      person = max(person, 'self')
      facts.push({ id: 'pan', label: 'PAN', value: maskPan(pan), proof: panDoc ? (sample && panDoc.specimen ? 'document' : 'document') : 'self', source: panDoc ? 'Read from the PAN card' : 'Typed by the owner', status: 'pass', note: `Holder: ${holder}` })
    }
  }

  // Same name everywhere: declared owner, ID cards, Aadhaar, electricity bill
  const bill = x.electricity?.bills?.[0]
  const others = [...names, ...(bill?.consumerName ? [{ source: 'Electricity bill', name: bill.consumerName }] : [])]
  const weak = others.filter((o) => nameMatch(o.name, p.ownerName) < 0.5)
  if (names.length) {
    if (weak.some((o) => o.source !== 'Electricity bill')) { st.push('fail'); notes.push(`${weak.filter((o) => o.source !== 'Electricity bill').map((o) => `${o.source} says "${o.name}"`).join('; ')}, not "${p.ownerName}".`) }
    else if (weak.length) { st.push('watch'); notes.push(`The electricity bill is in the name of "${bill!.consumerName}"; ask how they are related.`) }
    facts.unshift({ id: 'name', label: 'Owner', value: p.ownerName, proof: person === 'none' ? 'self' : person, source: names.map((n) => n.source).join(' · '), status: weak.some((o) => o.source !== 'Electricity bill') ? 'fail' : 'pass' })
  }

  // Date of birth: Aadhaar, PAN card and what the owner typed must agree
  const dobs = [
    ...(qr?.dob ? [{ source: 'Aadhaar QR', dob: qr.dob }] : []),
    ...docs.filter(usable).filter((d) => d.dob).map((d) => ({ source: ID_LABEL[d.kind], dob: d.dob })),
    ...(inp.dob ? [{ source: 'typed', dob: inp.dob }] : []),
  ]
  if (dobs.length) {
    const full = dobs.filter((d) => d.dob.length === 10)
    const clash = full.some((d) => d.dob !== full[0].dob) || dobs.some((d) => year(d.dob) !== year(dobs[0].dob))
    if (clash) { st.push('fail'); notes.push(`Dates of birth differ: ${dobs.map((d) => `${d.source} ${d.dob}`).join(', ')}.`) }
    const age = new Date().getFullYear() - year(dobs[0].dob)
    if (age < 18) { st.push('fail'); notes.push('The owner is under 18.') }
    facts.push({ id: 'dob', label: 'Date of birth', value: `•• •• ${year(dobs[0].dob)}`, proof: qr?.dob ? (qr.signed ? 'signed' : 'document') : docs.some((d) => d.dob && usable(d)) ? 'document' : 'self', source: dobs.map((d) => d.source).join(' · '), status: clash ? 'fail' : 'pass' })
  }

  const personStatus: CheckStatus = st.length ? worst(st) : 'pass'
  checks.push({
    id: 'id_person',
    title: "The owner's identity is consistent",
    status: person === 'none' && !st.length ? 'missing' : personStatus,
    finding:
      person === 'none' && !st.length
        ? 'Add an ID (scan the Aadhaar QR or photograph a PAN card) to run this check.'
        : personStatus === 'pass'
          ? `${names.map((n) => n.source).join(', ')} name the same person as the shop owner${dobs.length > 1 ? ', with the same date of birth' : ''}.${qr?.signed ? ' The Aadhaar QR carries UIDAI\'s digital signature.' : ''}${sample && docs.some((d) => d.specimen) ? ' (Sample shop: specimen cards.)' : ''}`
          : notes.join(' '),
    refs: refs.slice(0, 3),
  })

  // ── business registration
  let business: ProofLevel = 'none'
  const bst: CheckStatus[] = []
  const bnotes: string[] = []
  const brefs: EvidenceRef[] = []
  const gstDoc = biz.find((d) => d.kind === 'gst')
  const udyamDoc = biz.find((d) => d.kind === 'udyam' || d.kind === 'udyam_assist')
  const gstin = (inp.gstin || gstDoc?.number || '').toUpperCase()
  const udyam = (inp.udyam || udyamDoc?.number || '').toUpperCase()

  if (gstin) {
    const problem = gstinProblem(gstin, pan || undefined, p.address)
    if (problem) { bst.push(/elsewhere/.test(problem) ? 'watch' : 'fail'); bnotes.push(`GSTIN: ${problem}`) }
    if (!problem || /elsewhere/.test(problem)) {
      business = max(business, gstDoc && usable(gstDoc) ? 'document' : 'self')
      facts.push({ id: 'gstin', label: 'GSTIN', value: gstin, proof: gstDoc && usable(gstDoc) ? 'document' : 'self', source: gstDoc ? 'GST certificate' : 'Typed by the owner', status: problem ? 'watch' : 'pass', note: `${GST_STATES[gstin.slice(0, 2)] ?? ''}${pan && gstin.slice(2, 12) === pan ? ' · linked to the owner\'s PAN' : ''}` })
    }
  }
  if (udyam) {
    if (!validUdyam(udyam)) { bst.push('fail'); bnotes.push(`"${udyam}" is not a valid Udyam number (UDYAM-XX-00-0000000).`) }
    else {
      business = max(business, udyamDoc && usable(udyamDoc) ? 'document' : 'self')
      facts.push({ id: 'udyam', label: udyamDoc?.kind === 'udyam_assist' ? 'Udyam Assist' : 'Udyam', value: udyam, proof: udyamDoc && usable(udyamDoc) ? 'document' : 'self', source: udyamDoc ? BIZ_LABEL[udyamDoc.kind] : 'Typed by the owner', status: 'pass', note: 'Micro enterprise registration' })
    }
  }
  if (inp.fssai) {
    if (!validFssai(inp.fssai)) { bst.push('watch'); bnotes.push('The FSSAI number should be 14 digits.') }
    else facts.push({ id: 'fssai', label: 'FSSAI', value: inp.fssai, proof: 'self', source: 'Typed by the owner', status: 'pass' })
  }
  if (inp.tin) {
    if (!validTin(inp.tin)) { bst.push('watch'); bnotes.push('The TIN should look like 123-456-789-000.') }
    else facts.push({ id: 'tin', label: 'TIN', value: inp.tin, proof: 'self', source: 'Typed by the owner', status: 'pass' })
  }
  for (const d of biz) {
    const label = BIZ_LABEL[d.kind]
    brefs.push(bizRef(d, label))
    if (d.tamperSigns.length) { bst.push('fail'); bnotes.push(`The ${label} shows signs of editing: ${d.tamperSigns[0]}.`); continue }
    if (d.specimen && !sample) { bst.push('fail'); bnotes.push(`The ${label} is a specimen.`); continue }
    business = max(business, 'document')
    if (/cancel|suspend|revok|inactive/i.test(d.statusPrinted)) { bst.push('fail'); bnotes.push(`The ${label} says the registration is ${d.statusPrinted.toLowerCase()}.`) }
    if (d.validTill && Date.parse(d.validTill) < Date.now()) { bst.push('watch'); bnotes.push(`The ${label} expired on ${d.validTill}.`) }
    const nm = Math.max(nameMatch(d.tradeName || d.legalName, p.shopName), nameMatch(d.legalName, p.ownerName), nameMatch(d.ownerName, p.ownerName))
    if (nm < 0.5) { bst.push('watch'); bnotes.push(`The ${label} is for "${d.tradeName || d.legalName}", not "${p.shopName}".`) }
    if (d.address && addressSimilarity(d.address, p.address) < 0.3) { bst.push('watch'); bnotes.push(`The ${label} address differs from the shop address.`) }
    if (d.registeredOn && year(d.registeredOn) < p.since - 1) { bst.push('watch'); bnotes.push(`Registered in ${year(d.registeredOn)}, before the shop says it opened (${p.since}).`) }
    if (!facts.some((f) => f.id === d.kind) && !['gst', 'udyam', 'udyam_assist'].includes(d.kind) && d.number) facts.push({ id: d.kind, label, value: d.number, proof: 'document', source: label, status: 'pass', note: d.registeredOn ? `since ${year(d.registeredOn)}` : undefined })
  }
  const regYear = biz.filter((d) => usable(d) && d.registeredOn).map((d) => year(d.registeredOn)).sort()[0]
  const bStatus: CheckStatus = bst.length ? worst(bst) : 'pass'
  checks.push({
    id: 'id_business',
    title: 'The business registration fits',
    status: business === 'none' && !bst.length ? 'missing' : bStatus,
    finding:
      business === 'none' && !bst.length
        ? 'No business registration added. Many small shops have none; a free Udyam Assist registration takes ten minutes.'
        : bStatus === 'pass'
          ? `${facts.filter((f) => ['gstin', 'udyam', 'fssai', 'tin', 'dti', 'mayors_permit', 'shop_establishment', 'trade_licence', 'nib', 'bir'].includes(f.id)).map((f) => f.label).join(', ')} check out${gstin && pan && gstin.slice(2, 12) === pan ? ', and the GSTIN carries the owner\'s own PAN' : ''}${regYear ? `; registered since ${regYear}` : ''}.`
          : bnotes.join(' '),
    refs: brefs.slice(0, 3),
  })

  // ── same place: the ID or registration address against the shop
  const homeArea = qr ? [qr.locality, qr.district, qr.state, qr.pincode].filter(Boolean).join(', ') : docs.find((d) => d.address && usable(d))?.address ?? ''
  const regAddr = gstDoc?.address || udyamDoc?.address || ''
  const pin = (s: string) => /\b\d{6}\b/.exec(s)?.[0]
  if (homeArea || regAddr) {
    const regOk = regAddr ? addressSimilarity(regAddr, p.address) >= 0.4 || (!!pin(regAddr) && pin(regAddr) === pin(p.address)) : true
    const homeOk = homeArea ? addressSimilarity(homeArea, p.address) >= 0.2 || (!!qr?.pincode && qr.pincode === pin(p.address)) || (!!qr?.district && p.address.toLowerCase().includes(qr.district.toLowerCase())) : true
    checks.push({
      id: 'id_place',
      title: 'ID and registration addresses fit the shop',
      status: !regOk ? 'watch' : homeOk ? 'pass' : 'watch',
      finding: !regOk
        ? `The registered business address ("${regAddr.slice(0, 70)}") is not the shop's address.`
        : homeOk
          ? `The owner's ${qr ? 'Aadhaar' : 'ID'} address${regAddr ? ' and the registered business address' : ''} are in the same area as the shop.`
          : `The owner lives in ${[qr?.district, qr?.state].filter(Boolean).join(', ') || 'another area'}, away from the shop. Common for shopkeepers, but worth a question.`,
      refs: [...(gstDoc ? [bizRef(gstDoc, 'GST address')] : [])],
    })
  }

  // ── one identity, one shop
  if (x.claim && x.claim !== 'none') {
    checks.push({
      id: 'id_unique',
      title: 'One identity, one shop',
      status: x.claim === 'taken' ? 'fail' : 'pass',
      finding: x.claim === 'taken'
        ? 'This PAN already backs another shop\'s passport on Kosha. Kosha holds the offer until the owner explains.'
        : 'This PAN backs no other shop on Kosha. (Kosha keeps only a one-way fingerprint of the PAN for this check.)',
      refs: [],
    })
  }

  return {
    summary: {
      person,
      business,
      facts,
      panMasked: validPan(pan) ? maskPan(pan) : undefined,
      aadhaarLast4: qr?.last4 || undefined,
      gstin: validGstin(gstin) ? gstin : undefined,
      udyam: validUdyam(udyam) ? udyam : undefined,
      claim: x.claim ?? 'none',
    },
    checks,
  }
}

/** A one-way fingerprint of a PAN for the "one identity, one shop" check. The PAN itself is never stored. */
export async function panFingerprint(pan: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kosha-pan-v1|${pan.toUpperCase()}`))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40)
}
export type { AadhaarQr }
