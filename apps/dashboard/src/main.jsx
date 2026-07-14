import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import BootstrapPage from './pages/BootstrapPage.jsx'
import { EipLanguageProvider } from './i18n/EipLanguageContext.jsx'

const pathname = window.location.pathname.replace(/\/+$/, '')
const Root = pathname === '/bootstrap' ? BootstrapPage : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <EipLanguageProvider>
      <Root />
    </EipLanguageProvider>
  </StrictMode>,
)
