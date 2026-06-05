// main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { SessionProvider } from './context/SessionContext'
import { ThemeProvider } from './context/ThemeContext'

// Initialize i18n (must be imported before rendering)
import './i18n/i18n'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
