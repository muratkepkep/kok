import '@fontsource-variable/onest/wght.css'
import '@fontsource-variable/unbounded/wght.css'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { loadState } from './store'
import './styles.css'

void loadState().then(() => {
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </StrictMode>,
  )
})
