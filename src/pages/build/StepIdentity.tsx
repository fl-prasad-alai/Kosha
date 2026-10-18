import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { Building2, CreditCard, Fingerprint, ImageUp, Info, Keyboard, Loader2, Lock, ScanLine, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react'
import type { BusinessDoc, IdentityDoc } from '@shared/types'
import { useKosha } from '@/state/kosha'
import { Dropzone } from '@/components/kosha/Dropzone'
import { DocImage } from '@/components/kosha/DocImage'
import { QrScan } from '@/components/kosha/QrScan'
import { AssuranceMeter, ProofBadge } from '@/components/kosha/Assurance'
import { MetaLine, Panel, StatusIcon, StepHeader, fieldCls } from '@/components/kosha/ui'
import { buildIdentity, gstinProblem, maskPan, validFssai, validPan, validTin, validUdyam } from '@/fb/identity'
import { cn } from '@/lib/utils'

const ID_NAME: Record<string, string> = { pan: 'PAN card', aadhaar: 'Aadhaar card', voter_id: 'Voter ID', driving_licence: 'Driving licence', passport: 'Passport', philsys: 'PhilSys ID', umid: 'UMID', ktp: 'KTP', other: 'ID card' }
const BIZ_NAME: Record<string, string> = { gst: 'GST certificate', udyam: 'Udyam certificate', udyam_assist: 'Udyam Assist certificate', fssai: 'FSSAI licence', shop_establishment: 'Shop licence', trade_licence: 'Trade licence', dti: 'DTI business name', mayors_permit: "Mayor's permit", bir: 'BIR registration', nib: 'NIB', other: 'Registration' }
const isAadhaarFile = (f: File) => f.name.startsWith('aadhaar-')

function Hint({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <p className={cn('mt-1.5 text-xs', ok ? 'text-jade' : 'text-vermilion')}>{children}</p>
}

/** Two ways to give the same thing, e.g. "upload the card" or "type the number". */
function Choice<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, typeof ImageUp, string, string][]; label: string }) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={label}>
      {options.map(([v, Icon, title, sub]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn('flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-left transition', value === v ? 'border-gold/70 bg-gold/12' : 'border-line hover:border-line-2')}>
          <Icon className={cn('size-5 shrink-0', value === v ? 'text-gold' : 'text-ink-3')} />
          <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-ink-3">{sub}</span></span>
        </button>
      ))}
    </div>
  )
}

/** While a picked document is being read: no preview yet, just what is happening. */
function ReadingRow({ text }: { text: string }) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-dashed border-gold/50 bg-gold/5 px-4" role="status">
      <Loader2 className="size-5 shrink-0 animate-spin text-gold" />
      <span className="text-sm"><b className="font-medium">{text}</b><span className="block text-xs text-ink-3">It appears here once Gemini confirms it is the right document.</span></span>
    </div>
  )
}

/** Why the last picked document was not used. Calm, specific, and the uploader stays right there. */
function NotUsed({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-k/40 bg-amber-k/8 px-3 py-2 text-sm" role="alert">
      <Info className="mt-0.5 size-4 shrink-0 text-amber-k" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="text-ink-3 hover:text-ink"><X className="size-4" /></button>
    </div>
  )
}

function DocBadge({ d, sample }: { d: { tamperSigns: string[]; specimen: boolean }; sample: boolean }) {
  if (d.tamperSigns.length) return <span className="text-xs text-vermilion">Signs of editing</span>
  if (d.specimen) return <span className="text-xs text-amber-k">Specimen{sample ? ' · sample shop' : ''}</span>
  return <ProofBadge level="document" />
}

export function StepIdentity() {
  const s = useKosha()
  const { profile, idInput, qr, sampleId, pending } = s
  const idDoc = s.docs.identity
  const bizDoc = s.docs.business
  const india = profile.country === 'IN'
  const sample = !!sampleId

  // Accepted documents only: what has been read and checked. An Aadhaar photo and the PAN / ID cards are read
  // together but shown in their own panels.
  const idDone = idDoc.status === 'done' && !!idDoc.result
  const aadhaarFiles = idDoc.files.filter(isAadhaarFile)
  const cardFiles = idDoc.files.filter((f) => !isAadhaarFile(f))
  const firstCard = idDoc.files.findIndex((f) => !isAadhaarFile(f))
  const aadhaarCard = idDone ? idDoc.result!.documents.find((d) => d.kind === 'aadhaar') : undefined
  const cardDocs = idDone ? idDoc.result!.documents.filter((d) => d.kind !== 'aadhaar') : []
  const bizDocs = bizDoc.status === 'done' ? bizDoc.result?.documents ?? [] : []
  const idReading = pending.identity?.status === 'reading' || idDoc.status === 'reading'
  const bizReading = pending.business?.status === 'reading' || bizDoc.status === 'reading'

  // PAN: a photo of the card, or the number and date of birth typed in. Business: a certificate, or the number.
  const [panMode, setPanMode] = useState<'photo' | 'type'>(idInput.pan && !cardFiles.length ? 'type' : 'photo')
  const [bizMode, setBizMode] = useState<'photo' | 'type'>((idInput.gstin || idInput.udyam || idInput.fssai || idInput.tin) && !bizDoc.files.length ? 'type' : 'photo')
  const [replacing, setReplacing] = useState<{ pan?: boolean; biz?: boolean }>({})
  const choosePan = (m: 'photo' | 'type') => {
    if (m === panMode) return
    setPanMode(m)
    s.clearPending('identity')
    if (m === 'type' && cardFiles.length) {
      // keep an accepted Aadhaar photo; drop the PAN card
      if (aadhaarFiles.length) void s.upload('identity', [], { keep: aadhaarFiles, what: 'aadhaar', check: () => null })
      else s.setFiles('identity', [])
    }
    if (m === 'photo') s.setIdInput({ pan: undefined, dob: idInput.aadhaar?.dob || undefined })
  }
  const chooseBiz = (m: 'photo' | 'type') => {
    if (m === bizMode) return
    setBizMode(m)
    s.clearPending('business')
    if (m === 'type') s.setFiles('business', [])
    else s.setIdInput({ gstin: undefined, udyam: undefined, fssai: undefined, tin: undefined })
  }

  const uploadCard = (f: File[]) => {
    setReplacing((r) => ({ ...r, pan: false }))
    void s.upload('identity', f, {
      keep: aadhaarFiles,
      what: india ? 'PAN card' : 'ID card',
      check: (r, from) => {
        const mine = r.documents.filter((d) => d.file >= from)
        if (india && !mine.some((d) => d.kind === 'pan')) {
          const other = mine.find((d) => d.kind !== 'other')
          return other ? `This is ${other.kind === 'aadhaar' ? 'an' : 'a'} ${ID_NAME[other.kind]}, not a PAN card. ${other.kind === 'aadhaar' ? 'Add it in the Aadhaar panel, and upload' : 'Upload'} the front of the PAN card here.` : "This doesn't look like a PAN card. Upload a clear photo of the front of the card, in good light."
        }
        if (!mine.length) return "We couldn't find an ID card in this photo. Try a clear photo of the front of the card."
        return null
      },
    })
  }
  const uploadBiz = (f: File[]) => {
    setReplacing((r) => ({ ...r, biz: false }))
    void s.upload('business', f, {
      what: 'certificate',
      check: (r) => (r.documents.some((d) => d.kind !== 'other' && d.number) ? null : `This doesn't look like a registration certificate. Upload ${india ? 'a GST, Udyam or Udyam Assist, FSSAI or shop licence certificate' : 'a business registration or permit'}.`),
    })
  }

  // The same rules the passport uses, run live so the owner sees each check as she goes.
  const live = useMemo(
    () => buildIdentity({ profile, input: { ...idInput, sample }, identity: idDone ? idDoc.result : undefined, business: bizDoc.status === 'done' ? bizDoc.result : undefined, electricity: s.docs.electricity.result }),
    [profile, idInput, sample, idDone, idDoc.result, bizDoc.status, bizDoc.result, s.docs.electricity.result],
  )
  const pan = (idInput.pan ?? '').toUpperCase()
  const gst = (idInput.gstin ?? '').toUpperCase()
  const panForGst = pan || cardDocs.find((d) => d.kind === 'pan')?.number || ''
  const gstMsg = gst.length === 15 ? gstinProblem(gst, validPan(panForGst) ? panForGst : undefined, profile.address) : null

  // Fill the shop details from the documents, so step 2 becomes "check and confirm".
  const suggestion = useMemo(() => {
    const card = [...cardDocs, ...(aadhaarCard ? [aadhaarCard] : [])].find((d) => d.nameLatin || d.name)
    const reg = bizDocs.find((d) => d.tradeName || d.legalName)
    const ownerName = idInput.aadhaar?.name || card?.nameLatin || ''
    const shopName = reg?.tradeName || ''
    const address = reg?.address || ''
    const since = reg?.registeredOn ? Number(reg.registeredOn.slice(0, 4)) : 0
    const patch: Partial<typeof profile> = {}
    const same = (x: string, y: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '') === y.toLowerCase().replace(/[^a-z0-9]/g, '')
    const title = (x: string) => x.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase())
    if (ownerName && !same(ownerName, profile.ownerName)) patch.ownerName = title(ownerName)
    if (shopName && !same(shopName, profile.shopName)) patch.shopName = title(shopName)
    if (address && !same(address, profile.address)) patch.address = address
    if (since && since < profile.since) patch.since = since
    return patch
  }, [idInput.aadhaar, cardDocs, aadhaarCard, bizDocs, profile])

  const personHint = live.summary.person === 'signed' ? 'Govt-signed: the strongest proof.' : india ? 'Scan the Aadhaar QR to reach Govt-signed.' : 'Add a photo of a national ID.'
  const bizHint = live.summary.business === 'none' ? (india ? 'Optional. A free Udyam Assist registration works for small shops.' : 'Optional. Add a business name registration or permit.') : 'Registration added.'
  const idChecks = live.checks.filter((c) => c.status !== 'missing')
  const aadhaarPending = pending.identity?.what === 'aadhaar' ? pending.identity : undefined
  const cardPending = pending.identity && pending.identity.what !== 'aadhaar' ? pending.identity : undefined

  return (
    <>
      <StepHeader
        eyebrow="Step 1 · Who you are"
        title="Show who runs the shop"
        sub="Scan or upload instead of typing. Every detail is checked against your other documents, so lenders can trust your passport without a visit."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <AssuranceMeter label="Your identity" level={live.summary.person} icon={UserRound} hint={personHint} />
        <AssuranceMeter label="Your business" level={live.summary.business} icon={Building2} hint={bizHint} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Aadhaar: scan the QR, or upload a photo of the card */}
        {india && (
          <Panel>
            <div className="mb-4 flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold"><ScanLine className="size-5" /></span>
              <div>
                <h2 className="text-lg font-semibold">Your Aadhaar <span className="font-normal text-ink-3">· fastest</span></h2>
                <p className="text-sm text-ink-2">Scan the QR on the card, or upload a photo of it. The QR is signed by UIDAI and checked on this phone.</p>
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
            ) : aadhaarCard ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{aadhaarCard.nameLatin || aadhaarCard.name}</span><DocBadge d={aadhaarCard} sample={sample} /></div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-ink-3">Aadhaar</dt><dd className="font-mono">•••• •••• {aadhaarCard.number.slice(-4) || '····'}</dd></div>
                  <div><dt className="text-ink-3">Born</dt><dd>{aadhaarCard.dob || '—'}</dd></div>
                </dl>
                <p className="mt-2 text-xs text-ink-3">Read from the card photo; only the last 4 digits are kept. Scan the QR to make it Govt-signed.</p>
                <button className="mt-1 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline" onClick={() => (cardFiles.length ? void s.upload('identity', [], { keep: cardFiles, what: 'PAN card', check: () => null }) : s.setFiles('identity', []))}>Remove</button>
              </motion.div>
            ) : qr.status === 'reading' || aadhaarPending?.status === 'reading' ? (
              <ReadingRow text={qr.status === 'reading' ? "Checking UIDAI's signature…" : 'Reading your Aadhaar card…'} />
            ) : (
              <>
                <QrScan busy={false} onText={(t) => void s.scanQr(t)} onPhoto={(f) => s.addAadhaarPhoto(f)} onError={(m) => useKosha.setState({ qr: { status: 'error', error: m } })} />
                {qr.status === 'error' && <NotUsed message={qr.error!} onDismiss={() => useKosha.setState({ qr: { status: 'idle' } })} />}
                {aadhaarPending?.status === 'rejected' && <NotUsed message={aadhaarPending.message!} onDismiss={() => s.clearPending('identity')} />}
                <p className="mt-3 text-xs text-ink-3">The QR is the big square on the card or e-Aadhaar. No Aadhaar? Use your PAN or any ID instead.</p>
              </>
            )}
          </Panel>
        )}

        {/* ── PAN (or a national ID outside India): upload the card, or type the number and date of birth */}
        <Panel className={india ? '' : 'lg:col-span-2'}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold"><CreditCard className="size-5" /></span>
              <div>
                <h2 className="text-lg font-semibold">{india ? 'Your PAN' : 'Your national ID'}</h2>
                <p className="text-sm text-ink-2">{india ? 'Upload a photo of the card, or type the number and your date of birth.' : 'Upload a photo of the card. Gemini reads it and looks for signs of editing.'}</p>
              </div>
            </div>
            {idDone && cardDocs.length > 0 && <MetaLine meta={idDoc.meta} />}
          </div>
          {india && (
            <Choice label="How to add your PAN" value={panMode} onChange={choosePan} options={[['photo', ImageUp, 'Upload a photo of the card', 'Gemini reads it · Read from document'], ['type', Keyboard, 'Type the number', 'PAN and date of birth · Self-declared']]} />
          )}
          {india && panMode === 'type' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="text-ink-2">PAN</span>
                <input id="pan" className={cn(fieldCls, 'font-mono uppercase')} maxLength={10} placeholder="ABCPS1234F" value={idInput.pan ?? ''} onChange={(e) => s.setIdInput({ pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                {pan.length === 10 && <Hint ok={validPan(pan)}>{validPan(pan) ? `Valid PAN of ${pan[3] === 'P' ? 'an individual' : 'a non-individual'}.` : 'That is not a valid PAN.'}</Hint>}
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="text-ink-2">Date of birth</span>
                <input id="dob" type="date" className={fieldCls} value={idInput.dob ?? ''} onChange={(e) => s.setIdInput({ dob: e.target.value })} />
              </label>
              <p className="text-xs text-ink-3 sm:col-span-2">Typed details count as self-declared. A photo of the card, or the Aadhaar QR, makes them stronger.</p>
            </div>
          ) : cardDocs.length > 0 && !replacing.pan ? (
            <div className="space-y-3">
              <DocImage url={idDoc.urls[firstCard]} type={idDoc.files[firstCard]?.type} marks={cardDocs.filter((d) => d.file === firstCard).flatMap((d, k) => [{ id: `n${k}`, box: d.numberBox, tone: 'gold' as const }, { id: `m${k}`, box: d.nameBox, tone: 'jade' as const }])} className="max-h-72 overflow-hidden" />
              {cardDocs.map((d: IdentityDoc, k) => (
                <div key={k} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2"><b>{ID_NAME[d.kind]}</b><DocBadge d={d} sample={sample} /></div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 text-ink-2">
                    <span className="font-mono">{d.kind === 'pan' && validPan(d.number) ? maskPan(d.number) : d.number.replace(/.(?=.{4})/g, '•')}</span>
                    <span>{d.nameLatin || d.name}</span>
                    {d.dob && <span>Born {d.dob}</span>}
                  </div>
                </div>
              ))}
              <button className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline" onClick={() => setReplacing((r) => ({ ...r, pan: true }))}>Use a different photo</button>
            </div>
          ) : idReading && !aadhaarPending ? (
            <ReadingRow text={`Reading your ${india ? 'PAN card' : 'ID card'}…`} />
          ) : (
            <>
              <Dropzone files={[]} urls={[]} multiple={false} label={india ? 'Upload the PAN card' : 'Upload your ID card'} hint="A photo of the front, flat and in good light (JPG, PNG, HEIC or PDF)." onChange={uploadCard} />
              {cardPending?.status === 'rejected' && <NotUsed message={cardPending.message!} onDismiss={() => s.clearPending('identity')} />}
              {replacing.pan && <button className="mt-2 text-sm text-ink-3 hover:text-ink" onClick={() => setReplacing((r) => ({ ...r, pan: false }))}>Keep the current photo</button>}
            </>
          )}
          {!india && (
            <label className="mt-4 grid gap-1.5 text-sm sm:max-w-xs">
              <span className="text-ink-2">Date of birth</span>
              <input type="date" className={fieldCls} value={idInput.dob ?? (cardDocs.find((d) => d.dob.length === 10)?.dob ?? '')} onChange={(e) => s.setIdInput({ dob: e.target.value })} />
            </label>
          )}
        </Panel>

        {/* ── Business registration: upload a certificate, or type the number */}
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold"><Building2 className="size-5" /></span>
              <div>
                <h2 className="text-lg font-semibold">Business registration <span className="font-normal text-ink-3">· optional</span></h2>
                <p className="text-sm text-ink-2">{india ? 'GST, Udyam or Udyam Assist, FSSAI or a shop licence. Upload the certificate, or type the number.' : 'A business name registration, permit or tax number.'}</p>
              </div>
            </div>
            {bizDocs.length > 0 && <MetaLine meta={bizDoc.meta} />}
          </div>
          <Choice label="How to add your registration" value={bizMode} onChange={chooseBiz} options={[['photo', ImageUp, 'Upload the certificate', 'Gemini reads it · Read from document'], ['type', Keyboard, 'Type the number', india ? 'GSTIN, Udyam or FSSAI · Self-declared' : 'Tax number · Self-declared']]} />
          {bizMode === 'type' ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {india ? (
                <>
                  <label className="grid content-start gap-1.5 text-sm">
                    <span className="text-ink-2">GSTIN</span>
                    <input id="gstin" className={cn(fieldCls, 'font-mono uppercase')} maxLength={15} placeholder="27ABCPS1234F1ZX" value={idInput.gstin ?? ''} onChange={(e) => s.setIdInput({ gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                    {gst.length === 15 && <Hint ok={!gstMsg}>{gstMsg ?? `Valid GSTIN${validPan(panForGst) && gst.slice(2, 12) === panForGst ? ', linked to your PAN' : ''}.`}</Hint>}
                  </label>
                  <label className="grid content-start gap-1.5 text-sm">
                    <span className="text-ink-2">Udyam or Udyam Assist</span>
                    <input id="udyam" className={cn(fieldCls, 'font-mono uppercase')} maxLength={19} placeholder="UDYAM-MH-26-0012345" value={idInput.udyam ?? ''} onChange={(e) => s.setIdInput({ udyam: e.target.value.toUpperCase() })} />
                    {(idInput.udyam ?? '').length >= 19 && <Hint ok={validUdyam(idInput.udyam)}>{validUdyam(idInput.udyam) ? 'Valid Udyam number.' : 'It should look like UDYAM-MH-26-0012345.'}</Hint>}
                  </label>
                  <label className="grid content-start gap-1.5 text-sm">
                    <span className="text-ink-2">FSSAI <span className="text-ink-3">(if you sell food)</span></span>
                    <input id="fssai" className={cn(fieldCls, 'font-mono')} inputMode="numeric" maxLength={14} placeholder="12345678901234" value={idInput.fssai ?? ''} onChange={(e) => s.setIdInput({ fssai: e.target.value.replace(/\D/g, '') })} />
                    {(idInput.fssai ?? '').length === 14 && <Hint ok={validFssai(idInput.fssai)}>{validFssai(idInput.fssai) ? 'Valid FSSAI number format.' : 'An FSSAI number starts with 1 or 2.'}</Hint>}
                  </label>
                </>
              ) : (
                <label className="grid content-start gap-1.5 text-sm">
                  <span className="text-ink-2">Tax number (TIN)</span>
                  <input id="tin" className={cn(fieldCls, 'font-mono')} placeholder="123-456-789-000" value={idInput.tin ?? ''} onChange={(e) => s.setIdInput({ tin: e.target.value })} />
                  {(idInput.tin ?? '').length >= 11 && <Hint ok={validTin(idInput.tin)}>{validTin(idInput.tin) ? 'Valid TIN format.' : 'It should look like 123-456-789-000.'}</Hint>}
                </label>
              )}
            </div>
          ) : bizDocs.length > 0 && !replacing.biz ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <DocImage url={bizDoc.urls[0]} type={bizDoc.files[0]?.type} marks={bizDocs.filter((d) => d.file === 0).map((d, k) => ({ id: `b${k}`, box: d.numberBox, tone: 'gold' as const }))} className="max-h-72 overflow-hidden" />
              <div className="space-y-2">
                {bizDocs.map((d: BusinessDoc, k) => (
                  <div key={k} className="rounded-xl border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2"><b>{BIZ_NAME[d.kind]}</b><DocBadge d={d} sample={sample} /></div>
                    <div className="mt-1 text-ink-2"><span className="font-mono">{d.number}</span> · {d.tradeName || d.legalName}{d.registeredOn && ` · since ${d.registeredOn.slice(0, 4)}`}{d.statusPrinted && ` · ${d.statusPrinted}`}</div>
                  </div>
                ))}
                <button className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline" onClick={() => setReplacing((r) => ({ ...r, biz: true }))}>Use a different certificate</button>
              </div>
            </div>
          ) : bizReading ? (
            <ReadingRow text="Reading your certificate…" />
          ) : (
            <>
              <Dropzone files={[]} urls={[]} multiple={false} label="Upload a registration certificate" hint="A photo or PDF of a GST, Udyam, FSSAI or shop licence certificate." onChange={uploadBiz} />
              {pending.business?.status === 'rejected' && <NotUsed message={pending.business.message!} onDismiss={() => s.clearPending('business')} />}
              {replacing.biz && <button className="mt-2 text-sm text-ink-3 hover:text-ink" onClick={() => setReplacing((r) => ({ ...r, biz: false }))}>Keep the current certificate</button>}
            </>
          )}
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

      <p className="mt-5 flex items-start gap-2 text-xs text-ink-3"><Lock className="mt-0.5 size-3.5 shrink-0" />Kosha keeps only the results: a PAN shows as ABCDE****F and Aadhaar as •••• 1234. Card photos are read and not stored with your passport. You can skip this step; your passport will then say your identity is self-declared.</p>
    </>
  )
}
