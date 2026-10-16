import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BadgeCheck } from 'lucide-react'
import type { Assessment } from '@shared/types'
import { getPassport } from '@/lib/api'
import { useKosha } from '@/state/kosha'
import { PassportResult } from '@/components/kosha/PassportResult'
import { ErrorNote, Reading } from '@/components/kosha/ui'

export default function PassportPage() {
  const { id = '' } = useParams()
  const local = useKosha((s) => (s.assessment?.id === id ? s.assessment : null))
  const [a, setA] = useState<Assessment | null>(local)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (local) return setA(local)
    setError(null)
    getPassport(id).then(setA).catch((e) => setError((e as Error).message))
  }, [id, local])

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <div className="glass mb-6 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm">
        <BadgeCheck className="size-5 text-jade" />
        <span className="min-w-0 flex-1">
          {a ? <>Passport <b className="font-mono">{a.id}</b> issued {new Date(a.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} by Kosha. This page is the record a lender verifies.</> : 'Looking up the passport…'}
        </span>
        <Link to="/lender" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">All passports</Link>
      </div>
      {error && <ErrorNote error={error} />}
      {!a && !error && <Reading text="Fetching the passport record…" />}
      {a && <PassportResult a={a} />}
    </div>
  )
}
