import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Hourglass, LockKeyhole, ShieldX } from 'lucide-react'
import type { PublicPassport as PP, User } from '@shared/types'
import { Passport } from './passport/Passport'
import { ShareSheet } from './passport/ShareSheet'
import { fromPublic } from '@/lib/passportView'
import { Panel } from './ui'

const ease = [0.22, 1, 0.36, 1] as const
/** Why this visitor sees only the public record, and what they can do about it. */
function Why({ p, user }: { p: PP; user: User | null }) {
  const next = `/login?next=${encodeURIComponent(`/passport/${p.id}`)}&role=lender`
  if (!user) {
    return (
      <>
        <p>Lenders the shop has chosen can open the full passport with every document and check behind it.</p>
        <Link to={next} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold">Lender? Sign in <ArrowRight className="size-4" /></Link>
      </>
    )
  }
  if (user.role === 'lender' && user.status !== 'verified') {
    return (
      <div className="flex gap-2.5">
        {user.status === 'rejected' ? <ShieldX className="mt-0.5 size-4 shrink-0 text-vermilion" /> : <Hourglass className="mt-0.5 size-4 shrink-0 text-amber-k" />}
        <p>{user.status === 'rejected' ? `${user.org} could not be verified, so it cannot open shop passports.` : `Kosha is still verifying ${user.org}. Shared passports open in full once that is done.`}</p>
      </div>
    )
  }
  if (user.role === 'lender') return <p>This shop has not shared its full passport with {user.org}. If you are working with the shop, ask them to add {user.org} from their dashboard.</p>
  if (user.role === 'admin') return <p>Kosha staff see only this public record. A shop's documents stay with the shop and the lenders it chose.</p>
  return <p>This passport belongs to another shop.</p>
}

/** The redacted record anyone with the link or QR code can verify. The server sends nothing more than this. */
export function PublicPassport({ p, user }: { p: PP; user: User | null }) {
  const view = useMemo(() => fromPublic(p), [p])
  const [sharing, setSharing] = useState(false)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
        <Passport v={view} live onShare={() => setSharing(true)} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.08 }}>
        <Panel className="h-full">
          <div className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4 text-gold" /> This is the public record</div>
          <p className="mt-2 text-sm text-ink-2">It proves Kosha issued this passport and shows the result. The shop's documents, evidence, street address, interview and lender notes stay private. The shop decides which lenders can open the full passport.</p>
          <div className="mt-4 border-t border-line pt-4 text-sm text-ink-2"><Why p={p} user={user} /></div>
        </Panel>
      </motion.div>
      <ShareSheet open={sharing} onClose={() => setSharing(false)} pub={view} who={user?.role === 'lender' ? 'lender' : 'other'} user={user} />
    </div>
  )
}
