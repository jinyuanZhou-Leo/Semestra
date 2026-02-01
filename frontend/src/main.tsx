import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Import plugin setup - they will load asynchronously and update UI reactively
import './widget-setup'
import './tab-setup'
import './services/http'
import App from './App.tsx'

// Render immediately - plugins will load in background and UI will update reactively
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
