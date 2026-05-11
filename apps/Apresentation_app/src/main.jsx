import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

const root = createRoot(document.getElementById('root'))

if (window.location.hash === '#admin') {
  import('./Admin.jsx').then(m =>
    root.render(<StrictMode><m.default /></StrictMode>)
  )
} else {
  import('./App.jsx').then(m =>
    root.render(<StrictMode><m.default /></StrictMode>)
  )
}
