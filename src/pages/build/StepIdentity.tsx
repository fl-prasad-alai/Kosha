import { useMemo } from 'react'
import { motion } from 'motion/react'
import { Building2, CreditCard, Fingerprint, Lock, ScanLine, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import type { BusinessDoc, IdentityDoc } from '@shared/types'
import { useKosha } from '@/state/kosha'
import { Dropzone } from '@/components/kosha/Dropzone'
import { DocImage } from '@/components/kosha/DocImage'
import { QrScan } from '@/components/kosha/QrScan'
import { AssuranceMeter, ProofBadge } from '@/components/kosha/Assurance'
import { ErrorNote, MetaLine, Panel, Reading, StatusIcon, StepHeader, fieldCls } from '@/components/kosha/ui'
import { buildIdentity, gstinProblem, maskPan, validFssai, validPan, validTin, validUdyam } from '@/fb/identity'
import { cn } from '@/lib/utils'

const ID_NAME: Record<string, string> = { pan: 'PAN card', aadhaar: 'Aadhaar card', voter_id: 'Voter ID', driving_licence: 'Driving licence', passport: 'Passport', philsys: 'PhilSys ID', umid: 'UMID', ktp: 'KTP', other: 'ID card' }
const BIZ_NAME: Record<string, string> = { gst: 'GST certificate', udyam: 'Udyam certificate', udyam_assist: 'Udyam Assist', fssai: 'FSSAI licence', shop_establishment: 'Shop licence', trade_licence: 'Trade licence', dti: 'DTI business name', mayors_permit: "Mayor's permit", bir: 'BIR registration', nib: 'NIB', other: 'Registration' }

function Hint({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  if (ok === null) return null
  return <p className={cn('mt-1.5 text-xs', ok ? 'text-jade' : 'text-vermilion')}>{children}</p>
}

export function StepIdentity() {
  const s = useKosha()
  const { profile, idInput, qr, sampleId } = s
  const idDoc = s.docs.identity
  const bizDoc = s.docs.business
  const india = profile.country === 'IN'

  // The same rules the passport uses, run live so the owner sees each check as she goes.
  const live = useMemo(
    () => buildIdentity({ profile, input: { ...idInput, sample: !!sampleId }, identity: idDoc.result, business: bizDoc.result, electricity: s.docs.electricity.result }),
    [profile, idInput, sampleId, idDoc.result, bizDoc.result, s.docs.electricity.result],
  )
  const panFromCard = idDoc.result?.documents.find((d) => d.kind === 'pan')?.number
  const pan = (idInput.pan ?? panFromCard ?? '').toUpperCase()
  const gst = (idInput.gstin ?? '').toUpperCase()
  const gstMsg = gst ? gstinProblem(gst, validPan(pan) ? pan : undefined, profile.address) : null

  // Fill the shop details from the documents, so step 2 becomes "check and confirm".
  const suggestion = useMemo(() => {
    const q = idInput.aadhaar
    const card = idDoc.result?.documents.find((d) => d.nameLatin || d.name)
    const reg = bizDoc.result?.documents.find((d) => d.tradeName || d.legalName)
    const ownerName = q?.name || card?.nameLatin || ''
    const shopName = reg?.tradeName || ''
    const address = reg?.address || ''
    const since = reg?.registeredOn ? Number(reg.registeredOn.slice(0, 4)) : 0
    const patch: Partial<typeof profile> = {}
    const same = (x: string, y: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '') === y.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (ownerName && !same(ownerName, profile.ownerName)) patch.ownerName = ownerName.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
    if (shopName && !same(shopName, profile.shopName)) patch.shopName = shopName.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
    if (address && !same(address, profile.address)) patch.address = address
    if (since && since < profile.since) patch.since = since
    return patch
  }, [idInput.aadhaar, idDoc.result, bizDoc.result, profile])

  const personHint = live.summary.person === 'signed' ? 'Govt-signed: the strongest proof.' : india ? 'Scan the Aadhaar QR to reach Govt-signed.' : 'Add a photo of a national ID.'
  const bizHint = live.summary.business === 'none' ? (india ? 'Optional. A free Udyam Assist registration works for small shops.' : 'Optional. Add a business name registration or permit.') : 'Registration added.'
  const idChecks = live.checks.filter((c) => c.status !== 'missing')

  return (
    <>
      <StepHeader
        eyebrow="Step 1 · Who you are"
        title="Show who runs the shop"
        sub="Scan instead of typing. Every detail is checked against your other documents, so lenders can trust your passport without a visit."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <AssuranceMeter label="Your identity" level={live.summary.person} icon={UserRound} hint={personHint} />
        <AssuranceMeter label="Your business" level={live.summary.business} icon={Building2} hint={bizHint} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {india ? (
          <Panel>
            <div className="mb-4 flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold"><ScanLine className="size-5" /></span>
              <div>
                <h2 className="text-lg font-semibold">Scan the QR on your Aadhaar <span className="font-normal text-ink-3">· fastest</span></h2>
                <p className="text-sm text-ink-2">The big QR on the card or e-Aadhaar is signed by UIDAI. Kosha checks the signature on this phone; the card never leaves it.</p>
              </div>
            </div>
            {idInput.aadhaar ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-jade/40 bg-jade/8 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-jade" /> {idInput.aadhaar.name}</span>
                  <ProofBadge level={idInput.aadhaar.signed ? 'signed' : 'document'} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-ink-3">Aadhaar</dt><dd className="font-mono">•••• •••• {idInput.aadhaar.last4}</dd></div>
                  <div><dt className="text-ink-3">Born</dt><dd>{idInput.aadhaar.dob || '—'}</dd></div>
                  <div><dt className="text-ink-3">Gender</dt><dd>{idInput.aadhaar.gender || '—'}</dd></div>
                  <div><dt className="text-ink-3">Area</dt><dd>{[idInput.aadhaar.district, idInput.aadhaar.state, idInput.aadhaar.pincode].filter(Boolean).join(', ') || '—'}</dd></div>
                </dl>
                <p className="mt-3 text-xs text-ink-3">{idInput.aadhaar.signed ? `Signature verified with UIDAI's public key (${idInput.aadhaar.signedBy}).` : "Read from the QR. Kosha could not confirm UIDAI's signature with the keys it has, so this counts as a document, not Govt-signed."}</p>
                <button className="mt-2 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline" onClick={() => s.setIdInput({ aadhaar: undefined })}>Remove</button>
              </motion.div>
            ) : (
              <>
                <QrScan busy={qr.status === 'reading'} onText={(t) => void s.scanQr(t)} onError={(m) => useKosha.setState({ qr: { status: 'error', error: m } })} />
                {qr.status === 'reading' && <Reading className="mt-3" text="Checking UIDAI's signature…" />}
                {qr.status === 'error' && <div className="mt-3"><ErrorNote error={qr.error!} /></div>}
                <p className="mt-3 text-xs text-ink-3">No Aadhaar QR? Photograph a PAN card or any ID on the right instead.</p>
              </>
            )}
          </Panel>
        ) : null}

        <Panel className={india ? '' : 'lg:col-span-2'}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold"><CreditCard className="size-5" /></span>
              <div>
                <h2 className="text-lg font-semibold">{india ? 'Photograph your PAN card' : 'Photograph your national ID'}</h2>
                <p className="text-sm text-ink-2">Gemini reads the number, name and date of birth, and looks for signs of editing.</p>
              </div>
            </div>
            <div className="flex items-center gap-3"><MetaLine meta={idDoc.meta} />{idDoc.files.length > 0 && <button className="text-sm text-ink-3 hover:text-ink" onClick={() => s.setFiles('identity', [])}>Replace</button>}</div>
          </div>
          {idDoc.files.length === 0 ? (
            <Dropzone files={idDoc.files} urls={idDoc.urls} max={3} label={india ? 'Add the PAN card' : 'Add an ID card'} hint="Front side, flat, in good light. You can add up to three IDs." onChange={(f) => { s.setFiles('identity', f); void s.read('identity') }} />
          ) : (
            <div className="space-y-3">
              <DocImage url={idDoc.urls[0]} type={idDoc.files[0].type} marks={(idDoc.result?.documents ?? []).filter((d) => d.file === 0).flatMap((d, k) => [{ id: `n${k}`, box: d.numberBox, tone: 'gold' as const }, { id: `m${k}`, box: d.nameBox, tone: 'jade' as const }])} scanning={idDoc.status === 'reading'} className="max-h-72 overflow-hidden" />
              {idDoc.status === 'reading' && <Reading text="Gemini is reading the card…" />}
              {idDoc.status === 'error' && <ErrorNote error={idDoc.error!} onRetry={() => s.read('identity')} />}
              {idDoc.result?.documents.map((d: IdentityDoc, k) => (
                <div key={k} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{ID_NAME[d.kind]}</b>
                    {d.tamperSigns.length ? <span className="text-xs text-vermilion">Signs of editing</span> : d.specimen ? <span className="text-xs text-amber-k">Specimen{sampleId ? ' · sample shop' : ''}</span> : <ProofBadge level="document" />}
                  </div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 text-ink-2">
                    <span className="font-mono">{d.kind === 'pan' && validPan(d.number) ? maskPan(d.number) : d.number.replace(/.(?=.{4})/g, '•')}</span>
                    <span>{d.nameLatin || d.name}</span>
                    {d.dob && <span>Born {d.dob}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {india && (
              <label className="grid gap-1.5 text-sm">
                <span className="text-ink-2">PAN</span>
                <input className={cn(fieldCls, 'font-mono uppercase')} maxLength={10} placeholder="ABCPS1234F" value={idInput.pan ?? panFromCard ?? ''} onChange={(e) => s.setIdInput({ pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                {pan.length === 10 && <Hint ok={validPan(pan)}>{validPan(pan) ? `Valid PAN of ${pan[3] === 'P' ? 'an individual' : 'a non-individual'}.` : 'That is not a valid PAN.'}</Hint>}
              </label>
            )}
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-2">Date of birth</span>
              <input type="date" className={fieldCls} value={idInput.dob ?? (idDoc.result?.documents.find((d) => d.dob.length === 10)?.dob ?? '')} onChange={(e) => s.setIdInput({ dob: e.target.value })} />
            </label>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold"><Building2 className="size-5" /></span>
              <div>
                <h2 className="text-lg font-semibold">Business registration <span className="font-normal text-ink-3">· optional, any one</span></h2>
                <p className="text-sm text-ink-2">{india ? 'GST, Udyam or Udyam Assist, FSSAI or a shop licence. Numbers are checked as you type.' : 'A business name registration, permit or tax number.'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3"><MetaLine meta={bizDoc.meta} />{bizDoc.files.length > 0 && <button className="text-sm text-ink-3 hover:text-ink" onClick={() => s.setFiles('business', [])}>Replace</button>}</div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
            <div className="grid content-start gap-3">
              {india ? (
                <>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-ink-2">GSTIN</span>
                    <input className={cn(fieldCls, 'font-mono uppercase')} maxLength={15} placeholder="27ABCPS1234F1ZX" value={idInput.gstin ?? ''} onChange={(e) => s.setIdInput({ gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                    {gst.length === 15 && <Hint ok={!gstMsg}>{gstMsg ?? `Valid GSTIN${validPan(pan) && gst.slice(2, 12) === pan ? ', linked to your PAN' : ''}.`}</Hint>}
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-ink-2">Udyam or Udyam Assist number</span>
                    <input className={cn(fieldCls, 'font-mono uppercase')} maxLength={19} placeholder="UDYAM-MH-26-0012345" value={idInput.udyam ?? ''} onChange={(e) => s.setIdInput({ udyam: e.target.value.toUpperCase() })} />
                    {(idInput.udyam ?? '').length >= 19 && <Hint ok={validUdyam(idInput.udyam)}>{validUdyam(idInput.udyam) ? 'Valid Udyam number.' : 'It should look like UDYAM-MH-26-0012345.'}</Hint>}
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-ink-2">FSSAI licence <span className="text-ink-3">(if you sell food)</span></span>
                    <input className={cn(fieldCls, 'font-mono')} inputMode="numeric" maxLength={14} placeholder="12345678901234" value={idInput.fssai ?? ''} onChange={(e) => s.setIdInput({ fssai: e.target.value.replace(/\D/g, '') })} />
                    {(idInput.fssai ?? '').length === 14 && <Hint ok={validFssai(idInput.fssai)}>{validFssai(idInput.fssai) ? 'Valid FSSAI number format.' : 'An FSSAI number starts with 1 or 2.'}</Hint>}
                  </label>
                </>
              ) : (
                <label className="grid gap-1.5 text-sm">
                  <span className="text-ink-2">Tax number (TIN)</span>
                  <input className={cn(fieldCls, 'font-mono')} placeholder="123-456-789-000" value={idInput.tin ?? ''} onChange={(e) => s.setIdInput({ tin: e.target.value })} />
                  {(idInput.tin ?? '').length >= 11 && <Hint ok={validTin(idInput.tin)}>{validTin(idInput.tin) ? 'Valid TIN format.' : 'It should look like 123-456-789-000.'}</Hint>}
                </label>
              )}
            </div>
            <div>
              {bizDoc.files.length === 0 ? (
                <Dropzone files={bizDoc.files} urls={bizDoc.urls} max={4} label="Add a registration certificate" hint="A photo or PDF. Gemini reads the number, names, address and dates." onChange={(f) => { s.setFiles('business', f); void s.read('business') }} />
              ) : (
                <div className="space-y-2">
                  {bizDoc.status === 'reading' && <Reading text="Gemini is reading the certificate…" />}
                  {bizDoc.status === 'error' && <ErrorNote error={bizDoc.error!} onRetry={() => s.read('business')} />}
                  {bizDoc.result?.documents.map((d: BusinessDoc, k) => (
                    <div key={k} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2"><b>{BIZ_NAME[d.kind]}</b>{d.tamperSigns.length ? <span className="text-xs text-vermilion">Signs of editing</span> : d.specimen ? <span className="text-xs text-amber-k">Specimen{sampleId ? ' · sample shop' : ''}</span> : <ProofBadge level="document" />}</div>
                      <div className="mt-1 text-ink-2"><span className="font-mono">{d.number}</span> · {d.tradeName || d.legalName}{d.registeredOn && ` · since ${d.registeredOn.slice(0, 4)}`}{d.statusPrinted && ` · ${d.statusPrinted}`}</div>
                    </div>
                  ))}
                  {bizDoc.files.length > 0 && !bizDoc.result && bizDoc.status !== 'reading' && <DocImage url={bizDoc.urls[0]} type={bizDoc.files[0].type} className="max-h-60 overflow-hidden" />}
                </div>
              )}
            </div>
          </div>
        </Panel>

        {(idChecks.length > 0 || Object.keys(suggestion).length > 0) && (
          <Panel className="lg:col-span-2">
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <div className="mb-2 flex items-center gap-2 font-semibold"><Fingerprint className="size-4 text-gold" /> What Kosha checked</div>
                <ul className="space-y-2">
                  {idChecks.map((c) => (
                    <li key={c.id} className="flex gap-2.5 text-sm"><StatusIcon status={c.status} className="mt-0.5 size-4 shrink-0" /><span><b className="font-medium">{c.title}.</b> <span className="text-ink-2">{c.finding}</span></span></li>
                  ))}
                  {!idChecks.length && <li className="text-sm text-ink-3">Add an ID to see the checks.</li>}
                </ul>
              </div>
              {Object.keys(suggestion).length > 0 && (
                <div className="rounded-2xl border border-gold/40 bg-gold/8 p-4">
                  <div className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-gold" /> Fill your shop details from these?</div>
                  <ul className="mt-2 space-y-1 text-sm text-ink-2">
                    {suggestion.ownerName && <li>Owner: <b className="text-ink">{suggestion.ownerName}</b></li>}
                    {suggestion.shopName && <li>Shop: <b className="text-ink">{suggestion.shopName}</b></li>}
                    {suggestion.address && <li>Address: <b className="text-ink">{suggestion.address}</b></li>}
                    {suggestion.since && <li>Open since: <b className="text-ink">{suggestion.since}</b></li>}
                  </ul>
                  <button onClick={() => s.setProfile(suggestion)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-gold px-4 text-sm font-semibold text-[#1b1203]">Use these details</button>
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>

      <p className="mt-5 flex items-start gap-2 text-xs text-ink-3"><Lock className="mt-0.5 size-3.5 shrink-0" />Kosha keeps only the results: your PAN shows as {validPan(pan) ? maskPan(pan) : 'ABCDE****F'} and Aadhaar as •••• 1234. Card photos are read and not stored with your passport. You can skip this step; your passport will then say your identity is self-declared.</p>
    </>
  )
}
