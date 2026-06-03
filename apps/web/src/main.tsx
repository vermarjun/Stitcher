// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from '@/Components/ui/sonner'
import { initAnalytics } from '@/lib/analytics'
import { initClarity } from '@/lib/clarity'

// Set up product analytics once at startup (idempotent, never throws).
initAnalytics()
// Boot Microsoft Clarity once at startup — it then auto-captures every page
// (session recordings + heatmaps). No-ops if VITE_CLARITY_PROJECT_ID is unset.
initClarity()

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  <>
    <App />
    <Toaster />
  </>
  // </StrictMode>,
)
