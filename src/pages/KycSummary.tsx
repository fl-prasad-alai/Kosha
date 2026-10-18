// One printable page a lender can keep for its own compliance file: who the owner is (masked), how each fact
// was proven, the checks, the offer, the consent behind the share, and the passport's seal and QR to verify it.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import type { Assessment } from '@shared/types'
import { PROOF_LABEL } from '@shared/types'
import { isPublic } from '@shared/policy'
import { getPassport } from '@/lib/api'
import { useAuth } from '@/state/auth'
import { money } from '@/lib/format'
import { verifyUrl } from '@/lib/passportView'

const STATUS: Record<string, string> = { pass: 'Pass', watch: 'Watch', fail: 'Fail', missing: 'Not checked' }
const OFFER: Record<string, string> = { offer: 'Ready to offer', hold: 'On hold', decline: 'No offer yet' }

export default function KycSummary() {
  const { id = '' } = useParams()
  const user = useAuth((s) => s.user)
  const [a, setA] = useState<Assessment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string>()

  useEffect(() => {
    getPassport(id)
      .then((p) => (isPublic(p) ? setError('Only the shop and the lenders it shared with can download this summary.') : setA(p)))
      .catch((e) => setError((e as Error).message))
  }, [id, user?.id])
  useEffect(() => {
    if (a) QRCode.toDataURL(verifyUrl({ id: a.id, seal: a.seal }), { margin: 0, width: 220 }).then(setQr).catch(() => {})
  }, [a])

  const now = new Date()
  return (
    <div className="kyc fixed inset-0 z-[60] overflow-auto bg-white text-[#14161c]">
      <style>{`@media print { body * { visibility: hidden !important } .kyc, .kyc * { visibility: visible !important } .kyc { position: absolute; inset: 0; overflow: visible } .no-print { display: none !important } @page { margin: 14mm } }`}</style>
      <div className="mx-auto max-w-[820px] px-8 py-10 text-[13px] leading-relaxed">
        {error && <p className="text-red-700">{error}</p>}
        {!a && !error && <p>Preparing the summary…</p>}
        {a && (
          <>
            <div className="no-print mb-6 flex justify-end gap-2">
              <button onClick={() => print()} className="rounded-full bg-[#14161c] px-5 py-2 text-sm font-semibold text-white">Save as PDF / print</button>
            </div>
            <header className="flex items-start justify-between gap-6 border-b border-[#d8dae0] pb-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a3711c]">Kosha · KYC & credit summary</div>
                <h1 className="mt-1 text-2xl font-semibold">{a.profile.shopName}</h1>
                <div className="text-[#555]">Passport {a.id} · issued {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · seal {a.seal ?? '—'}</div>
              </div>
              {qr && <div className="text-center"><img src={qr} alt="QR code to verify this passport" className="size-24" /><div className="mt-1 text-[10px] text-[#777]">Scan to verify</div></div>}
            </header>

            <section className="mt-5 grid grid-cols-2 gap-5">
              <div>
                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777]">Shop</h2>
                <div>{a.profile.ownerName} · {a.profile.shopType}</div>
                <div className="text-[#555]">{a.profile.address}</div>
                <div className="text-[#555]">Open since {a.profile.since}</div>
              </div>
              <div>
                <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777]">Result</h2>
                <div>Kosha score <b>{a.score}</b> (band {a.band}) · {OFFER[a.offer.status]}</div>
                {a.offer.status === 'offer' && <div className="text-[#555]">Up to {money(a.offer.limit, a.profile.currency)} over {a.offer.tenureMonths} months, about {money(a.offer.flatEmi, a.profile.currency)} a month</div>}
                <div className="text-[#555]">Monthly sales {money(a.metrics.monthlySales, a.profile.currency)} · surplus {money(a.metrics.surplus, a.profile.currency)}</div>
              </div>
            </section>

            <section className="mt-6">
              <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777]">Identity and registration</h2>
              {a.identity ? (
                <>
                  <div className="mb-2">Owner identity: <b>{PROOF_LABEL[a.identity.person]}</b> · Business: <b>{PROOF_LABEL[a.identity.business]}</b></div>
                  <table className="w-full border-collapse">
                    <tbody>
                      {a.identity.facts.map((f) => (
                        <tr key={f.id} className="border-t border-[#e4e6ea]">
                          <td className="py-1.5 pr-3 text-[#555]">{f.label}</td>
                          <td className="py-1.5 pr-3 font-mono">{f.value}</td>
                          <td className="py-1.5 pr-3 text-[#555]">{f.source}</td>
                          <td className="py-1.5 pr-3">{PROOF_LABEL[f.proof]}</td>
                          <td className="py-1.5">{STATUS[f.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <p className="text-[#555]">This passport was issued before identity checks; treat identity as self-declared.</p>}
            </section>

            <section className="mt-6">
              <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777]">Cross-checks</h2>
              <table className="w-full border-collapse">
                <tbody>
                  {a.checks.map((c) => (
                    <tr key={c.id} className="border-t border-[#e4e6ea] align-top">
                      <td className="w-20 py-1.5 pr-3 font-medium">{STATUS[c.status]}</td>
                      <td className="py-1.5 pr-3">{c.title}</td>
                      <td className="py-1.5 text-[#555]">{c.finding}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <footer className="mt-8 border-t border-[#d8dae0] pt-4 text-[11px] text-[#777]">
              Shared by the shop with consent{a.consent ? ` on ${new Date(a.consent.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}. Generated {now.toLocaleString('en-GB')} for {user?.org ?? 'the viewer'}{user ? ` (${user.name})` : ''}.
              ID numbers are masked; Kosha does not store card images. Kosha pre-screens; the lender makes the final decision. Verify the seal at {verifyUrl({ id: a.id, seal: a.seal })}.
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
