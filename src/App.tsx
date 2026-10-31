import { ChartNoAxesCombined, ClipboardList, Droplets, Pill, Sprout, Stethoscope } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { ScreenBoundary } from './components/ScreenBoundary'
import { EMPTY_STATE } from './domain/types'
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
  { id: 'surec', label: 'Süreç', icon: ClipboardList, screen: Process },
  { id: 'ilaclar', label: 'İlaçlar', icon: Pill, screen: Meds },
  { id: 'bakim', label: 'Bakım', icon: Droplets, screen: Care },
  { id: 'analiz', label: 'Analiz', icon: ChartNoAxesCombined, screen: Analysis },
  { id: 'operasyon', label: 'Operasyon', icon: Stethoscope, screen: SurgeryPage },
] satisfies { id: string; label: string; icon: unknown; screen: ComponentType }[]

const currentTab = () => {
  const id = window.location.hash.slice(1)
  return TABS.some((tab) => tab.id === id) ? id : 'bugun'
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

export function App() {
  const state = useAppState()
  const saveFailed = useSaveFailed()
  const tab = useHashTab()

  if (state.surgery === null) return <Onboarding />

  const Screen = (TABS.find((item) => item.id === tab) ?? TABS[0]).screen

  return (
    <div className="shell">
      <nav className="nav" aria-label="Ana menü">
        <a className="brand" href="#bugun">
          Kök
        </a>
        {TABS.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} className="nav-item" aria-current={tab === id ? 'page' : undefined}>
            <Icon size={21} aria-hidden />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <main className="main">
        {saveFailed && (
          <p className="banner" role="alert">
            Son değişiklik kaydedilemedi. Tarayıcı depolaması dolu veya kapalı olabilir.
          </p>
        )}
        {state.demo && (
          <p className="banner">
            <span>Örnek verileri görüyorsun.</span>
            <button
              type="button"
              className="button-quiet"
              onClick={() => {
                void clearPhotos()
                actions.replaceAll(EMPTY_STATE)
                window.location.hash = 'bugun'
              }}
            >
              Kendi takibimi başlat
            </button>
          </p>
        )}
        <ScreenBoundary key={tab}>
          <Screen />
        </ScreenBoundary>
      </main>
    </div>
  )
}
