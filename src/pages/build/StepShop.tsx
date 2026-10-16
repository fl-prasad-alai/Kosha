import { useKosha } from '@/state/kosha'
import { Dropzone } from '@/components/kosha/Dropzone'
import { DocImage } from '@/components/kosha/DocImage'
import { ErrorNote, MetaLine, Panel, Reading, StatusPill, StepHeader, fieldCls } from '@/components/kosha/ui'
import { COUNTRIES } from '@/lib/format'
import { LANGUAGES } from '@shared/questions'

const TYPES = ['Kirana (general store)', 'Warung sembako (grocery)', 'Sari-sari store', 'Pharmacy', 'Bakery or sweet shop', 'Mobile and electronics', 'Tailoring or garments', 'Other']

export function StepShop() {
  const profile = useKosha((s) => s.profile)
  const setProfile = useKosha((s) => s.setProfile)
  const doc = useKosha((s) => s.docs.shopfront)
  const setFiles = useKosha((s) => s.setFiles)
  const read = useKosha((s) => s.read)
  const r = doc.result
  const year = new Date().getFullYear()

  return (
    <>
      <StepHeader eyebrow="Step 1 · The shop" title="Tell Kosha about the shop" sub="These details are matched against every document, so use the name and address exactly as they appear on bills." />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-2">Shop name</span>
              <input id="shopName" className={fieldCls} value={profile.shopName} onChange={(e) => setProfile({ shopName: e.target.value })} placeholder="Sharma General Store" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-2">Owner's full name</span>
              <input id="ownerName" className={fieldCls} value={profile.ownerName} onChange={(e) => setProfile({ ownerName: e.target.value })} placeholder="Sunita Sharma" />
            </label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              <span className="text-ink-2">Shop address</span>
              <textarea id="address" rows={2} className={fieldCls} value={profile.address} onChange={(e) => setProfile({ address: e.target.value })} placeholder="Shop 4, Karve Road, Kothrud, Pune 411038" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-2">Country</span>
              <select
                id="country"
                className={fieldCls}
                value={profile.country}
                onChange={(e) => {
                  const c = COUNTRIES[e.target.value]
                  setProfile({ country: e.target.value, currency: c.currency, language: c.language })
                }}
              >
                {Object.entries(COUNTRIES).map(([k, c]) => (
                  <option key={k} value={k}>{c.flag} {c.name}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-2">Owner's language</span>
              <select id="language" className={fieldCls} value={profile.language} onChange={(e) => setProfile({ language: e.target.value })}>
                {Object.entries(LANGUAGES).map(([k, l]) => (
                  <option key={k} value={k}>{l.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-2">Type of shop</span>
              <select id="shopType" className={fieldCls} value={TYPES.includes(profile.shopType) ? profile.shopType : 'Other'} onChange={(e) => setProfile({ shopType: e.target.value })}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-ink-2">Open since (year)</span>
              <input id="since" type="number" min={1950} max={year} className={fieldCls} value={profile.since} onChange={(e) => setProfile({ since: Math.min(year, Math.max(1950, Number(e.target.value) || year)) })} />
            </label>
          </div>
          <p className="mt-4 text-xs text-ink-3">Amounts are read in {profile.currency}. The explanation at the end is written in {LANGUAGES[profile.language]?.label ?? 'English'} and English.</p>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">Shopfront photo <span className="font-normal text-ink-3">· optional</span></h3>
            {r && <StatusPill status={r.matchesShopName ? 'pass' : 'watch'}>{r.matchesShopName ? 'Sign matches' : 'Sign differs'}</StatusPill>}
          </div>
          {doc.files.length === 0 ? (
            <Dropzone files={doc.files} urls={doc.urls} multiple={false} label="Add a photo of the shop" hint="Show the signboard. It becomes the passport photo." onChange={(f) => { setFiles('shopfront', f); void read('shopfront') }} />
          ) : (
            <div className="space-y-3">
              <DocImage url={doc.urls[0]} type={doc.files[0].type} marks={r?.signBox ? [{ id: 'sign', box: r.signBox, tone: 'gold' }] : []} scanning={doc.status === 'reading'} />
              {doc.status === 'reading' && <Reading text="Gemini is reading the signboard…" />}
              {doc.status === 'error' && <ErrorNote error={doc.error!} onRetry={() => read('shopfront')} />}
              {r && (
                <div className="space-y-2 text-sm">
                  <p className="font-local text-base">“{r.signboardText}”</p>
                  <ul className="list-inside list-disc text-ink-2">
                    {r.observations.slice(0, 4).map((o) => <li key={o}>{o}</li>)}
                  </ul>
                  <MetaLine meta={doc.meta} />
                </div>
              )}
              <button className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline" onClick={() => setFiles('shopfront', [])}>Replace photo</button>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
