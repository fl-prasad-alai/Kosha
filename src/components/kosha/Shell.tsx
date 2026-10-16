import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
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

export function Shell({ children }: { children: ReactNode }) {
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
            <NavLink to="/build" className={({ isActive }) => cn(nav, isActive && 'bg-glass text-ink')}>Build a passport</NavLink>
            <NavLink to="/lender" className={({ isActive }) => cn(nav, isActive && 'bg-glass text-ink')}>For lenders</NavLink>
          </nav>
          <ThemeToggle />
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
