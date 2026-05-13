import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = createRoot(document.getElementById('root'))

const hash = window.location.hash
if (hash.startsWith('#p=') || hash === '#preview') {
  import('./App.jsx').then(m =>
    root.render(<StrictMode><m.default /></StrictMode>)
  )
} else {
  import('./Admin.jsx').then(m =>
    root.render(<StrictMode><m.default /></StrictMode>)
  )
}
