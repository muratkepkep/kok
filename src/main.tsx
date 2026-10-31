import '@fontsource-variable/jetbrains-mono/wght.css'
import '@fontsource-variable/onest/wght.css'
import '@fontsource-variable/oxanium/wght.css'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { startReminders } from './notifications'
import { loadState } from './store'
import './styles.css'

void loadState().then(() => {
  // Bildirim dokunuşu kaçmasın diye dinleyiciler ilk çizimden önce kurulur.
  void startReminders().catch(() => undefined)
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </StrictMode>,
  )
})
