import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/kosha/Shell'
import { EvidenceModal } from '@/components/kosha/Evidence'
import { Intro } from '@/components/kosha/Intro'
import Landing from '@/pages/Landing'

const Build = lazy(() => import('@/pages/Build'))
const PassportPage = lazy(() => import('@/pages/PassportPage'))
const Lender = lazy(() => import('@/pages/Lender'))

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
            <Route path="/build" element={<Build />} />
            <Route path="/passport/:id" element={<PassportPage />} />
            <Route path="/lender" element={<Lender />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>}
      </Shell>
      <EvidenceModal />
    </BrowserRouter>
  )
}
