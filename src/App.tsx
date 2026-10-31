import { ChartNoAxesCombined, Droplets, Pill, Route, Sprout } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ComponentType } from 'react'
import { ScreenBoundary } from './components/ScreenBoundary'
import { EMPTY_STATE } from './domain/types'
import { tapLight } from './haptics'
import { clearPhotos } from './photos'
import { Analysis } from './screens/Analysis'
import { Care } from './screens/Care'
import { Meds } from './screens/Meds'
import { Onboarding } from './screens/Onboarding'
import { Process } from './screens/Process'
import { SurgeryPage } from './screens/SurgeryPage'
import { Today } from './screens/Today'
import { actions, useAppState, useSaveFailed } from './store'

const TABS = [
  { id: 'bugun', label: 'Bugün', icon: Sprout, screen: Today },
  { id: 'surec', label: 'Süreç', icon: Route, screen: Process },
  { id: 'ilaclar', label: 'İlaçlar', icon: Pill, screen: Meds },
  { id: 'bakim', label: 'Bakım', icon: Droplets, screen: Care },
  { id: 'analiz', label: 'Analiz', icon: ChartNoAxesCombined, screen: Analysis },
] satisfies { id: string; label: string; icon: unknown; screen: ComponentType }[]

const SCREENS: Record<string, ComponentType> = {
  ...Object.fromEntries(TABS.map((tab) => [tab.id, tab.screen])),
  operasyon: SurgeryPage,
}

const currentTab = () => {
  const id = window.location.hash.slice(1)
  return id in SCREENS ? id : 'bugun'
}

const useHashTab = () => {
  const [tab, setTab] = useState(currentTab)
  useEffect(() => {
    const sync = () => {
      setTab(currentTab())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return tab
}

function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <span />
      <span />
      <span />
    </div>
  )
}

function TabBar({ tab }: { tab: string }) {
  return (
    <nav className="tabbar" aria-label="Ana menü">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = tab === id
        return (
          <a
            key={id}
            href={`#${id}`}
            className="tab"
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            onClick={tapLight}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="tab-pill"
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
            <motion.span
              className="tab-icon"
              animate={{ scale: active ? 1.08 : 1, y: active ? 0 : 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden />
            </motion.span>
            <AnimatePresence initial={false}>
              {active && (
                <motion.span
                  className="tab-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </a>
        )
      })}
    </nav>
  )
}

export function App() {
  const state = useAppState()
  const saveFailed = useSaveFailed()
  const tab = useHashTab()

  if (state.surgery === null) {
    return (
      <>
        <Aurora />
        <Onboarding />
      </>
    )
  }

  const Screen = SCREENS[tab]

  return (
    <>
      <Aurora />
      <main className="main">
        {saveFailed && (
          <p className="notice" role="alert">
            Son değişiklik kaydedilemedi. Cihazda yeterli alan olduğundan emin ol.
          </p>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ScreenBoundary>
              <Screen />
            </ScreenBoundary>
          </motion.div>
        </AnimatePresence>
        {state.demo && (
          <div className="notice notice-demo">
            <span>Örnek verileri görüyorsun.</span>
            <button
              type="button"
              className="link"
              onClick={() => {
                void clearPhotos()
                actions.replaceAll(EMPTY_STATE)
                window.location.hash = 'bugun'
              }}
            >
              Kendi takibimi başlat
            </button>
          </div>
        )}
      </main>
      <TabBar tab={tab} />
    </>
  )
}
