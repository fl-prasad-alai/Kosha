import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Shell } from '@/components/kosha/Shell'
import { EvidenceModal } from '@/components/kosha/Evidence'
import Landing from '@/pages/Landing'

const Build = lazy(() => import('@/pages/Build'))
const PassportPage = lazy(() => import('@/pages/PassportPage'))
const Lender = lazy(() => import('@/pages/Lender'))

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/build" element={<Build />} />
            <Route path="/passport/:id" element={<PassportPage />} />
            <Route path="/lender" element={<Lender />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </Suspense>
      </Shell>
      <EvidenceModal />
    </BrowserRouter>
  )
}
