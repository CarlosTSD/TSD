import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import { readShareFromUrl } from './shareLink.js'

const sharedData = readShareFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {sharedData ? <LandingPage data={sharedData} /> : <App />}
  </StrictMode>,
)
