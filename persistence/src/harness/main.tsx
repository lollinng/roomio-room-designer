import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { useSession } from '../app/session'

// Debug hook for the headless verify script (harness-only).
;(window as unknown as { __roomioRev?: () => number | null }).__roomioRev = () =>
  useSession.getState().current?.rev ?? null

// Global keyframes for the save spinner (kept here so components stay self-contained).
const style = document.createElement('style')
style.textContent = `@keyframes roomio-spin { to { transform: rotate(360deg); } }`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
