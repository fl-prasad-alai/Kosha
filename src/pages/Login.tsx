import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Eye, EyeOff, Landmark, Loader2, Store } from 'lucide-react'
import type { Role } from '@shared/types'
import { AuthScene } from '@/components/kosha/AuthScene'
import { fieldCls } from '@/components/kosha/ui'
import { homeFor, useAuth } from '@/state/auth'
import { cn } from '@/lib/utils'

const ease = [0.22, 1, 0.36, 1] as const

export default function Login() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const auth = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [role, setRole] = useState<Role>(params.get('role') === 'lender' ? 'lender' : 'business')
  const [form, setForm] = useState({ name: '', org: '', email: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const next = params.get('next')

  if (auth.ready && auth.user && !params.get('switch')) return <Navigate to={next && next.startsWith('/') ? next : homeFor(auth.user)} replace />
  const done = (u: Parameters<typeof homeFor>[0]) => nav(next && next.startsWith('/') ? next : homeFor(u), { replace: true })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy('form')
    try {
      done(mode === 'signin' ? await auth.login(form.email, form.password) : await auth.signup({ role, ...form }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }
  const demo = async (r: Role) => {
    setError(null)
    setBusy(r)
    try {
      done(await auth.demo(r))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-64px)] max-w-7xl items-center gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
      {/* Scene */}
      <section className="relative order-1 h-[34vh] min-h-[240px] overflow-hidden rounded-3xl bg-glass ring-1 ring-line lg:h-[min(78vh,720px)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgb(var(--k-gold-rgb)/0.16),transparent_65%)]" />
        <AuthScene className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-night via-night/70 to-transparent p-5 sm:p-8">
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }} className="font-display text-[clamp(26px,3.6vw,46px)] leading-[1.05]">
            Every shop's records, <em className="text-gold-grad">a treasury of trust.</em>
          </motion.h1>
          <p className="mt-2 hidden max-w-md text-sm text-ink-2 sm:block">Shop owners build a credit passport from the ledger they already keep. Lenders review it with every piece of evidence attached.</p>
        </div>
      </section>

      {/* Form */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease, delay: 0.1 }} className="glass-strong edge-gold order-2 w-full max-w-xl justify-self-center rounded-3xl p-5 sm:p-8">
        <div className="relative mb-6 grid grid-cols-2 rounded-full bg-glass p-1 text-sm ring-1 ring-line">
          {(['signin', 'signup'] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(null) }} className={cn('relative z-10 rounded-full py-2.5 font-medium transition-colors', mode === m ? 'text-[#1b1203]' : 'text-ink-2 hover:text-ink')}>
              {mode === m && <motion.span layoutId="tab" className="absolute inset-0 -z-10 rounded-full bg-gold" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <AnimatePresence initial={false} mode="popLayout">
            {mode === 'signup' && (
              <motion.div key="signup" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease }} className="space-y-4 overflow-hidden">
                <fieldset>
                  <legend className="mb-2 text-sm text-ink-2">I am</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {([['business', Store, 'A shop owner', 'Build a credit passport'], ['lender', Landmark, 'A lender', 'Review passports']] as const).map(([r, Icon, title, sub]) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        aria-pressed={role === r}
                        className={cn('flex min-h-[88px] flex-col items-start gap-1 rounded-2xl border p-3.5 text-left transition', role === r ? 'border-gold bg-gold/10 shadow-[0_0_0_4px_rgb(var(--k-gold-rgb)/0.12)]' : 'border-line hover:border-line-2')}
                      >
                        <Icon className={cn('size-5', role === r ? 'text-gold' : 'text-ink-3')} />
                        <span className="font-medium">{title}</span>
                        <span className="text-xs text-ink-3">{sub}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-ink-2">Your name</span>
                    <input id="name" autoComplete="name" className={fieldCls} value={form.name} onChange={set('name')} placeholder={role === 'lender' ? 'Arjun Mehta' : 'Sunita Sharma'} />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-ink-2">{role === 'lender' ? 'Bank or lender' : 'Shop name'}</span>
                    <input id="org" autoComplete="organization" className={fieldCls} value={form.org} onChange={set('org')} placeholder={role === 'lender' ? 'Pune Merchants Bank' : 'Sharma General Store'} />
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <label className="grid gap-1.5 text-sm">
            <span className="text-ink-2">Email</span>
            <input id="email" type="email" inputMode="email" autoComplete="email" className={fieldCls} value={form.email} onChange={set('email')} placeholder="you@example.com" />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-ink-2">Password</span>
            <span className="relative">
              <input id="password" type={show ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} className={cn(fieldCls, 'pr-12')} value={form.password} onChange={set('password')} placeholder={mode === 'signup' ? 'At least 8 characters' : ''} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          <AnimatePresence>
            {error && (
              <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-vermilion/40 bg-vermilion/10 px-3.5 py-2.5 text-sm text-vermilion">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button whileTap={{ scale: 0.98 }} disabled={!!busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-gold-2 to-gold font-semibold text-[#1b1203] shadow-[0_10px_40px_-12px_rgb(var(--k-gold-rgb)/0.9)] disabled:opacity-60">
            {busy === 'form' ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === 'signin' ? 'Sign in' : role === 'lender' ? 'Create lender account' : 'Create shop account'}
            {busy !== 'form' && <ArrowRight className="size-4" />}
          </motion.button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" /> or explore without an account <span className="h-px flex-1 bg-line" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([['business', Store, 'Shop owner demo', 'Sunita · Sharma General Store'], ['lender', Landmark, 'Lender demo', 'Arjun · Pune Merchants Bank']] as const).map(([r, Icon, title, sub]) => (
            <button key={r} type="button" onClick={() => demo(r)} disabled={!!busy} className="glass flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:border-gold/50 disabled:opacity-60">
              {busy === r ? <Loader2 className="size-5 animate-spin text-gold" /> : <Icon className="size-5 text-gold" />}
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block truncate text-xs text-ink-3">{sub}</span>
              </span>
            </button>
          ))}
        </div>
      </motion.section>
    </div>
  )
}
