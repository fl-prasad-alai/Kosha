import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/kosha/Shell'
import { EvidenceModal } from '@/components/kosha/Evidence'
import { Intro } from '@/components/kosha/Intro'
import Landing from '@/pages/Landing'
import { RequireAuth } from '@/components/kosha/RequireAuth'
import { useAuth } from '@/state/auth'

const Build = lazy(() => import('@/pages/Build'))
const PassportPage = lazy(() => import('@/pages/PassportPage'))
const Lender = lazy(() => import('@/pages/Lender'))
const Login = lazy(() => import('@/pages/Login'))
const Home = lazy(() => import('@/pages/Home'))
const Admin = lazy(() => import('@/pages/Admin'))

const INTRO_KEY = 'kosha-intro-seen'

/** The opening sequence plays once per session, only when someone lands on the home page (or on /#intro). */
function shouldPlayIntro() {
  if (location.hash === '#intro' || (import.meta.env.DEV && location.search.includes('introAt'))) return true
  if (location.pathname !== '/') return false
  try {
    return !sessionStorage.getItem(INTRO_KEY)
  } catch {
    return true
  }
}

export default function App() {
  const [intro, setIntro] = useState(shouldPlayIntro)
  useEffect(() => void useAuth.getState().load(), [])
  const done = () => {
    try {
      sessionStorage.setItem(INTRO_KEY, '1')
    } catch { /* storage blocked */ }
    if (location.hash === '#intro') history.replaceState(null, '', location.pathname)
    setIntro(false)
  }
  return (
    <BrowserRouter>
      {intro && <Intro onDone={done} />}
      <Shell>
        {intro ? <div className="min-h-[100dvh]" /> : <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/app" element={<RequireAuth role="business"><Home /></RequireAuth>} />
            <Route path="/build" element={<RequireAuth role="business"><Build /></RequireAuth>} />
            <Route path="/passport/:id" element={<PassportPage />} />
            <Route path="/lender" element={<RequireAuth role="lender"><Lender /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth role="admin" need="lender:verify"><Admin /></RequireAuth>} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>}
      </Shell>
      <EvidenceModal />
    </BrowserRouter>
  )
}
