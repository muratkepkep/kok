import { ArrowLeft, BellRing, CalendarClock, Droplets, Pill } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { lazy, Suspense, useState } from 'react'
import { celebrate } from '../components/celebrate'
import { Press } from '../components/fx'
import { MED_CATALOG, medFromCatalog } from '../domain/catalog'
import { buildDemoState } from '../domain/demo'
import { fmtInt } from '../domain/format'
import { AREAS, TECHNIQUES, type Surgery } from '../domain/types'
import { tapFirm, tapSuccess } from '../haptics'
import { requestNotifications } from '../notifications'
import { actions, useToday } from '../store'

const HeadScan = lazy(() => import('../components/HeadScan').then((module) => ({ default: module.HeadScan })))

const STEP_COUNT = 4
const NOTIFY_STEP = STEP_COUNT - 1

function Welcome({ onNext, onDemo }: { onNext: () => void; onDemo: () => void }) {
  return (
    <div className="welcome">
      <Suspense fallback={null}>
        <HeadScan growth={0.92} offset={0} />
      </Suspense>
      <motion.div
        className="welcome-copy"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 90, damping: 15, delay: 0.5 }}
      >
        <h1>KÖK</h1>
        <p>Saç ekiminden sonraki 18 ayını hafta hafta izle. Hologramı parmağınla çevir.</p>
      </motion.div>
      <motion.div
        className="welcome-actions"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 90, damping: 15, delay: 0.75 }}
      >
        <Press className="cta cta-pulse" onClick={onNext}>
          Takibe başla
        </Press>
        <Press className="ghost-button" onClick={onDemo}>
          Örnek verilerle incele
        </Press>
      </motion.div>
    </div>
  )
}

export function Onboarding() {
  const today = useToday()
  const [step, setStep] = useState(-1)
  const [selected, setSelected] = useState<string[]>([])
  const [surgery, setSurgery] = useState<Surgery>({
    date: today,
    clinic: '',
    doctor: '',
    city: '',
    clinicPhone: '',
    graftCount: 3000,
    graftMap: {},
    technique: 'FUE',
    areas: [],
    note: '',
  })

  const set = <K extends keyof Surgery>(key: K, value: Surgery[K]) => setSurgery((item) => ({ ...item, [key]: value }))

  const toggleMed = (name: string) =>
    setSelected((items) => (items.includes(name) ? items.filter((item) => item !== name) : [...items, name]))

  const toggleArea = (area: string) =>
    set('areas', surgery.areas.includes(area) ? surgery.areas.filter((item) => item !== area) : [...surgery.areas, area])

  const finish = () => {
    actions.saveSurgery({ ...surgery, clinic: surgery.clinic.trim() })
    for (const item of MED_CATALOG.flatMap((group) => group.items)) {
      if (selected.includes(item.name)) actions.newMed(medFromCatalog(item, today))
    }
    tapSuccess()
    celebrate()
  }

  if (step < 0) {
    return <Welcome onNext={() => setStep(0)} onDemo={() => actions.replaceAll(buildDemoState(today))} />
  }

  return (
    <div className="wizard">
      <header className="wizard-head">
        <button type="button" className="round-button" aria-label="Geri" onClick={() => setStep(step - 1)}>
          <ArrowLeft size={20} aria-hidden />
        </button>
        <div className="wizard-bars" role="progressbar" aria-valuemin={1} aria-valuemax={STEP_COUNT} aria-valuenow={step + 1}>
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span key={index}>
              <motion.i initial={false} animate={{ scaleX: index <= step ? 1 : 0 }} />
            </span>
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.form
          key={step}
          className="wizard-step"
          initial={{ opacity: 0, x: 44 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -44 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          onSubmit={(event) => {
            event.preventDefault()
            tapFirm()
            if (step === NOTIFY_STEP) void requestNotifications().catch(() => undefined).finally(finish)
            else setStep(step + 1)
          }}
        >
          {step === 0 && (
            <>
              <h1>Ameliyat günün</h1>
              <p className="wizard-lead">Her şey bu günden itibaren sayılır.</p>
              <label className="field">
                <span>Ameliyat tarihi</span>
                <input type="date" value={surgery.date} required onChange={(event) => set('date', event.target.value)} />
              </label>
              <label className="field">
                <span>Klinik</span>
                <input value={surgery.clinic} placeholder="Kliniğin adı" onChange={(event) => set('clinic', event.target.value)} />
              </label>
              <label className="field">
                <span>Klinik telefonu</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={surgery.clinicPhone}
                  placeholder="Sorun olursa tek dokunuşla arayabilmen için"
                  onChange={(event) => set('clinicPhone', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Doktor</span>
                <input value={surgery.doctor} onChange={(event) => set('doctor', event.target.value)} />
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Kaç greft ekildi?</h1>
              <p className="graft-value" aria-live="polite">
                {fmtInt(surgery.graftCount ?? 0)}
                <small>greft</small>
              </p>
              <label className="field">
                <span className="visually-hidden">Greft sayısı</span>
                <input
                  type="range"
                  min={500}
                  max={8000}
                  step={50}
                  value={surgery.graftCount ?? 3000}
                  onChange={(event) => set('graftCount', Number(event.target.value))}
                />
              </label>
              <fieldset className="field">
                <legend>Teknik</legend>
                <div className="chips">
                  {TECHNIQUES.map((technique) => (
                    <button
                      key={technique}
                      type="button"
                      className="chip"
                      aria-pressed={surgery.technique === technique}
                      onClick={() => set('technique', technique)}
                    >
                      {technique}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="field">
                <legend>Ekim bölgesi</legend>
                <div className="chips">
                  {AREAS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      className="chip"
                      aria-pressed={surgery.areas.includes(area)}
                      onClick={() => toggleArea(area)}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {step === 2 && (
            <>
              <h1>Ne kullanıyorsun?</h1>
              <p className="wizard-lead">Doktorunun verdiklerini seç. Doz, saat ve sıklığı İlaçlar sayfasından ayarlarsın.</p>
              <div className="catalog-list catalog-open">
                {MED_CATALOG.map((group) => (
                  <div key={group.title}>
                    <h3>{group.title}</h3>
                    <div className="chips">
                      {group.items.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          className="chip"
                          aria-pressed={selected.includes(item.name)}
                          onClick={() => toggleMed(item.name)}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === NOTIFY_STEP && (
            <>
              <h1>Dozunu kaçırma</h1>
              <p className="wizard-lead">Kök zamanı gelince yazar, sen işaretleyene kadar da hatırlatmaya devam eder.</p>
              <ul className="promise-list">
                <li>
                  <Pill size={20} aria-hidden />
                  <span>
                    <strong>İlaç saatleri</strong>
                    <small>Bildirimden Aldım deyip geç veya ertele</small>
                  </span>
                </li>
                <li>
                  <Droplets size={20} aria-hidden />
                  <span>
                    <strong>Yıkama ve ölçüm</strong>
                    <small>Sıradaki yıkama, haftalık fotoğraf</small>
                  </span>
                </li>
                <li>
                  <CalendarClock size={20} aria-hidden />
                  <span>
                    <strong>Randevu ve kısıtlar</strong>
                    <small>Kontrol günü, spor ve güneş serbest olduğunda</small>
                  </span>
                </li>
              </ul>
              <p className="muted">Verilerin bu cihazda saklanır, hiçbir sunucuya gönderilmez.</p>
            </>
          )}

          <motion.button type="submit" className="cta" whileTap={{ scale: 0.96 }}>
            {step === NOTIFY_STEP && <BellRing size={19} aria-hidden />}
            {step === NOTIFY_STEP ? 'Bildirimlere izin ver' : 'Devam et'}
          </motion.button>
          {step === NOTIFY_STEP && (
            <button type="button" className="button-quiet" onClick={finish}>
              Şimdilik geç
            </button>
          )}
        </motion.form>
      </AnimatePresence>
    </div>
  )
}
