import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut, Moon, Sun } from 'lucide-react'
import { homeFor, useAuth } from '@/state/auth'
import { Backdrop } from './Backdrop'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)} aria-label="Kosha home">
      <svg viewBox="0 0 64 64" className="size-8 transition-transform duration-500 group-hover:rotate-[8deg]" aria-hidden>
        <defs>
          <linearGradient id="kg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--k-gold-2)" />
            <stop offset="1" stopColor="#e8912c" />
          </linearGradient>
        </defs>
        <path d="M32 6 54 18v16c0 12-9.5 20.5-22 24C19.5 54.5 10 46 10 34V18Z" fill="none" stroke="url(#kg)" strokeWidth="3.4" strokeLinejoin="round" />
        <circle cx="32" cy="31" r="8.5" fill="none" stroke="url(#kg)" strokeWidth="3" />
        <path d="M32 22.5v17M23.5 31h17" stroke="url(#kg)" strokeWidth="2" />
      </svg>
      <span className="font-display text-[22px] font-semibold tracking-tight">Kosha</span>
    </Link>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('kosha-theme', dark ? 'dark' : 'light')
    } catch { /* storage blocked */ }
  }, [dark])
  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="glass grid size-9 place-items-center rounded-full text-ink-2 transition hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}

function Account() {
  const { user, ready, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navTo = useNavigate()
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    addEventListener('click', close)
    return () => removeEventListener('click', close)
  }, [open])
  if (!ready) return <span className="size-9" />
  if (!user) return <Link to="/login" className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-[#1b1203]">Sign in</Link>
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="relative">
      <button onClick={(e) => { e.stopPropagation(); setOpen(!open) }} className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm" aria-haspopup="menu" aria-expanded={open}>
        <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-gold-2 to-gold font-mono text-[11px] font-semibold text-[#1b1203]">{initials}</span>
        <span className="hidden max-w-[12ch] truncate sm:inline">{user.name.split(' ')[0]}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} onClick={(e) => e.stopPropagation()} className="glass-strong absolute right-0 top-12 z-50 w-64 rounded-2xl p-2 shadow-2xl">
            <div className="px-3 py-2">
              <div className="truncate font-medium">{user.name}</div>
              <div className="truncate text-xs text-ink-3">{user.org}</div>
              <div className="mt-1.5 inline-block rounded-full bg-gold/12 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold">{user.role === 'lender' ? 'Lender' : 'Shop owner'}{user.demo ? ' · demo' : ''}</div>
            </div>
            <Link to={homeFor(user)} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-glass">{user.role === 'lender' ? 'Lender queue' : 'My passports'}</Link>
            {user.role === 'business' && <Link to="/build" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-glass sm:hidden">Build a passport</Link>}
            <button role="menuitem" onClick={async () => { setOpen(false); await logout(); navTo('/') }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-vermilion hover:bg-vermilion/10"><LogOut className="size-4" /> Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  const nav = 'rounded-full px-3.5 py-1.5 text-sm text-ink-2 transition hover:text-ink'
  return (
    <div className="relative min-h-dvh">
      <Backdrop />
      <header className="sticky top-0 z-40 border-b border-line/60 bg-night/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo className="mr-auto" />
          <nav className="hidden items-center gap-1 sm:flex">
            {user?.role === 'business' && (
              <>
                <NavLink to="/app" className={({ isActive }) => cn(nav, isActive && 'bg-glass text-ink')}>My passports</NavLink>
                <NavLink to="/build" className={({ isActive }) => cn(nav, isActive && 'bg-glass text-ink')}>Build a passport</NavLink>
              </>
            )}
            {user?.role === 'lender' && <NavLink to="/lender" className={({ isActive }) => cn(nav, isActive && 'bg-glass text-ink')}>Lender queue</NavLink>}
          </nav>
          <ThemeToggle />
          <Account />
        </div>
      </header>
      <main>{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-16 text-xs text-ink-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <span>Kosha · built on Gemini and Google Cloud.</span>
          <span>Prototype. Sample shops and documents are fictional. Kosha pre-screens. A lender makes the final decision.</span>
        </div>
      </footer>
    </div>
  )
}
