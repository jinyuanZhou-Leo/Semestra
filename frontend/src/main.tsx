// input:  [DOM `#root` element, React runtime, app shell module, HTTP bootstrap side effect]
// output: [application mount side effect via `createRoot(...).render(...)`]
// pos:    [Vite entrypoint that boots the browser runtime]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './services/http'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
