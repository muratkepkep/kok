import { ArrowLeft, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { celebrate } from '../components/celebrate'
import { Press } from '../components/fx'
import { HairField } from '../components/HairField'
import { MED_PRESETS } from '../components/MedForm'
import { buildDemoState } from '../domain/demo'
import { fmtInt } from '../domain/format'
import { AREAS, TECHNIQUES, type Surgery } from '../domain/types'
import { tapFirm, tapSuccess } from '../haptics'
import { actions, useToday } from '../store'

const STEP_COUNT = 3

const MED_NOTES: Record<string, string> = {
  Minoksidil: 'Günde 2 kez',
  Finasterid: 'Günde bir kez',
  Biotin: 'Günde bir kez',
}

function Welcome({ onNext, onDemo }: { onNext: () => void; onDemo: () => void }) {
  return (
    <div className="welcome">
      <HairField currentWeek={78} />
      <motion.div
        className="welcome-copy"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 90, damping: 15, delay: 0.5 }}
      >
        <h1>Kök</h1>
        <p>Saç ekiminden sonraki 18 ayını hafta hafta izle. Dokun, teller hareket etsin.</p>
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
    graftCount: 3000,
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
    for (const preset of MED_PRESETS) {
      if (!selected.includes(preset.name)) continue
      actions.newMed({
        name: preset.name,
        kind: preset.kind,
        dose: preset.dose,
        schedule: [{ from: today, timesPerDay: preset.timesPerDay, everyNDays: preset.everyNDays }],
      })
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
        <button
          type="button"
          className="round-button"
          aria-label="Geri"
          onClick={() => setStep(step - 1)}
        >
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
            if (step === STEP_COUNT - 1) finish()
            else setStep(step + 1)
          }}
        >
          {step === 0 && (
            <>
              <h1>Ameliyat günün</h1>
              <p className="wizard-lead">Her şey bu günden itibaren sayılır.</p>
              <label className="field">
                <span>Ameliyat tarihi</span>
                <input
                  type="date"
                  value={surgery.date}
                  required
                  onChange={(event) => set('date', event.target.value)}
                />
              </label>
              <label className="field">
                <span>Klinik</span>
                <input
                  value={surgery.clinic}
                  placeholder="Kliniğin adı"
                  onChange={(event) => set('clinic', event.target.value)}
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
              <p className="wizard-lead">Doktorunun önerdiklerini seç. Doz ve sıklığı sonra değiştirebilirsin.</p>
              <div className="med-picks">
                {MED_PRESETS.map((preset) => {
                  const active = selected.includes(preset.name)
                  return (
                    <Press
                      key={preset.name}
                      className="med-pick"
                      aria-pressed={active}
                      onClick={() => toggleMed(preset.name)}
                    >
                      <span>
                        <strong>{preset.name}</strong>
                        <small>{MED_NOTES[preset.name]}</small>
                      </span>
                      <span className="med-pick-check">{active && <Check size={18} strokeWidth={3} aria-hidden />}</span>
                    </Press>
                  )
                })}
              </div>
              <p className="muted">Verilerin bu cihazda saklanır. Uygulama hiçbir sunucuya veri göndermez.</p>
            </>
          )}

          <motion.button type="submit" className="cta" whileTap={{ scale: 0.96 }}>
            {step === STEP_COUNT - 1 ? 'Takibi başlat' : 'Devam et'}
          </motion.button>
        </motion.form>
      </AnimatePresence>
    </div>
  )
}
