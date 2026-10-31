import { ChartNoAxesCombined, LayoutGrid, Pill, Route, Sprout } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ComponentType } from 'react'
import { ScreenBoundary } from './components/ScreenBoundary'
import { EMPTY_STATE } from './domain/types'
import { tapLight } from './haptics'
import { clearPhotos } from './photos'
import { Analysis } from './screens/Analysis'
import { Appointments } from './screens/Appointments'
import { Badges } from './screens/Badges'
import { Care } from './screens/Care'
import { Guide } from './screens/Guide'
import { Hub } from './screens/Hub'
import { Meds } from './screens/Meds'
import { Onboarding } from './screens/Onboarding'
import { Photos } from './screens/Photos'
import { Privacy } from './screens/Privacy'
import { Process } from './screens/Process'
import { Reminders } from './screens/Reminders'
import { Rules } from './screens/Rules'
import { SurgeryPage } from './screens/SurgeryPage'
import { Symptoms } from './screens/Symptoms'
import { Today } from './screens/Today'
import { actions, useAppState, useSaveFailed } from './store'

const TABS = [
  { id: 'bugun', label: 'Bugün', icon: Sprout },
  { id: 'surec', label: 'Süreç', icon: Route },
  { id: 'ilaclar', label: 'İlaçlar', icon: Pill },
  { id: 'analiz', label: 'Analiz', icon: ChartNoAxesCombined },
  { id: 'merkez', label: 'Merkez', icon: LayoutGrid },
]

const SCREENS: Record<string, ComponentType> = {
  bugun: Today,
  surec: Process,
  ilaclar: Meds,
  analiz: Analysis,
  merkez: Hub,
  bakim: Care,
  belirti: Symptoms,
  randevu: Appointments,
  kurallar: Rules,
  foto: Photos,
  rehber: Guide,
  rozet: Badges,
  hatirlatma: Reminders,
  operasyon: SurgeryPage,
  gizlilik: Privacy,
}

/** Alt sayfalarda menüde ait olduğu sekme parlar. */
const ACTIVE_TAB: Record<string, string> = Object.fromEntries(
  Object.keys(SCREENS).map((id) => [id, TABS.some((tab) => tab.id === id) ? id : 'merkez']),
)

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

function Space() {
  return (
    <div className="space" aria-hidden>
      <span />
      <span />
      <i />
    </div>
  )
}

function TabBar({ tab }: { tab: string }) {
  return (
    <nav className="tabbar" aria-label="Ana menü">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = ACTIVE_TAB[tab] === id
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
              <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 380, damping: 28 }} />
            )}
            <span className="tab-icon">
              <Icon size={21} strokeWidth={active ? 2.5 : 1.9} aria-hidden />
            </span>
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
        <Space />
        <Onboarding />
      </>
    )
  }

  const Screen = SCREENS[tab]

  return (
    <>
      <Space />
      <main className="main">
        {saveFailed && (
          <p className="notice" role="alert">
            Son değişiklik kaydedilemedi. Cihazda yeterli alan olduğundan emin ol.
          </p>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <ScreenBoundary>
              <Screen />
            </ScreenBoundary>
          </motion.div>
        </AnimatePresence>
        {state.demo && (
          <div className="notice">
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
