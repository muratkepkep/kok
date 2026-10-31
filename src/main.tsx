import '@fontsource/alegreya-sans/latin-400.css'
import '@fontsource/alegreya-sans/latin-ext-400.css'
import '@fontsource/alegreya-sans/latin-500.css'
import '@fontsource/alegreya-sans/latin-ext-500.css'
import '@fontsource/alegreya-sans/latin-700.css'
import '@fontsource/alegreya-sans/latin-ext-700.css'
import '@fontsource/alegreya-sans/latin-800.css'
import '@fontsource/alegreya-sans/latin-ext-800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { loadState } from './store'
import './styles.css'

void loadState().then(() => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
