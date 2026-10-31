import { Camera, Check, ChevronLeft, ChevronRight, Droplets, Flame, Settings, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { celebrate } from '../components/celebrate'
import { CheckInForm } from '../components/CheckInForm'
import { CountUp, Press, Reveal, Ring } from '../components/fx'
import { burstHair, HairField } from '../components/HairField'
import {
  dayRatio,
  inUseOn,
  medStart,
  plannedSlots,
  SLOT_NAMES,
  streak,
  takenSlots,
  windowTally,
} from '../domain/adherence'
import { scabStats, washStats } from '../domain/care'
import { addDays, diffDays, fmtDay, fmtFull, fmtWeekday, minDate } from '../domain/dates'
import { fmtDecimal, fmtInt, fmtRatio, fmtScore } from '../domain/format'
import { dayNumber, monthNumber, stageAt, weekNumber, weekPeriod } from '../domain/timeline'
import type { AppState, ISODate, Medication } from '../domain/types'
import { tapFirm, tapSuccess } from '../haptics'
import { actions, getState, useAppState, useToday } from '../store'

const dayLabel = (date: ISODate, today: ISODate) => {
  if (date === today) return 'Bugün'
  if (date === addDays(today, -1)) return 'Dün'
  return `${fmtDay(date)}, ${fmtWeekday(date)}`
}

function Hero({ state, today }: { state: AppState; today: ISODate }) {
  const surgery = state.surgery!
  const day = dayNumber(surgery.date, today)
  const before = day < 0
  const stage = stageAt(Math.max(day, 0))

  return (
    <header className="hero">
      <HairField currentWeek={weekNumber(surgery.date, today)} />
      <div className="hero-top">
        <span className="wordmark">Kök</span>
        <a href="#operasyon" className="round-button" aria-label="Operasyon bilgileri">
          <Settings size={20} aria-hidden />
        </a>
      </div>
      <div className="hero-copy">
        <p className="hero-day">
          <CountUp value={Math.abs(day)} className="hero-number" />
          <span className="hero-unit">{before ? 'gün kaldı' : '. gün'}</span>
        </p>
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 18, delay: 0.35 }}
        >
          <h1>{before ? 'Ameliyata hazırlık' : stage.title}</h1>
          <div className="chip-row">
            {before ? (
              <span className="glass-chip">{fmtFull(surgery.date)}</span>
            ) : (
              <>
                <span className="glass-chip">{weekNumber(surgery.date, today)}. hafta</span>
                <span className="glass-chip">{monthNumber(surgery.date, today)}. ay</span>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </header>
  )
}

function DoseCapsule({
  label,
  done,
  medName,
  onToggle,
}: {
  label: string
  done: boolean
  medName: string
  onToggle: () => void
}) {
  return (
    <Press className="capsule" aria-pressed={done} aria-label={`${medName}, ${label}`} onClick={onToggle}>
      <motion.span
        className="capsule-fill"
        initial={false}
        animate={{ scaleX: done ? 1 : 0, opacity: done ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      />
      <span className="capsule-text">
        <AnimatePresence initial={false}>
          {done && (
            <motion.span
              className="capsule-check"
              initial={{ scale: 0, rotate: -40, width: 0 }}
              animate={{ scale: 1, rotate: 0, width: 20 }}
              exit={{ scale: 0, width: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 18 }}
            >
              <Check size={18} strokeWidth={3.4} aria-hidden />
            </motion.span>
          )}
        </AnimatePresence>
        {label}
      </span>
    </Press>
  )
}

function DayProgress({ state, today }: { state: AppState; today: ISODate }) {
  const [date, setDate] = useState(today)
  const [cheer, setCheer] = useState(false)
  useEffect(() => setDate(today), [today])
  useEffect(() => {
    if (!cheer) return
    const timer = window.setTimeout(() => setCheer(false), 3200)
    return () => window.clearTimeout(timer)
  }, [cheer])

  const surgeryDate = state.surgery!.date
  const earliest = state.meds.map(medStart).reduce(minDate, surgeryDate)
  const planned = state.meds.filter((med) => plannedSlots(med, date) > 0)
  const resting = state.meds.filter((med) => inUseOn(med, date) && plannedSlots(med, date) === 0)
  const totalSlots = planned.reduce((sum, med) => sum + plannedSlots(med, date), 0)
  const takenCount = planned.reduce(
    (sum, med) => sum + takenSlots(state.doses, med.id, date, plannedSlots(med, date)),
    0,
  )
  const days = streak(state.meds, state.doses, today)
  const week = windowTally(state.meds, state.doses, 7, today)

  const toggle = (med: Medication, slot: number, wasTaken: boolean) => {
    const wasComplete = dayRatio(state.meds, state.doses, date) === 1
    actions.toggleDose(date, med.id, slot)
    if (wasTaken) return
    tapFirm()
    burstHair(24)
    const current = getState()
    if (!wasComplete && dayRatio(current.meds, current.doses, date) === 1) {
      tapSuccess()
      celebrate()
      setCheer(true)
    }
  }

  return (
    <section className="card card-glow">
      <div className="progress-head">
        <Ring value={totalSlots ? takenCount / totalSlots : 0}>
          <strong className="ring-value">
            {takenCount}
            <small>/{totalSlots}</small>
          </strong>
          <span>doz</span>
        </Ring>
        <div className="progress-side">
          <div className="day-switch">
            <button
              type="button"
              className="round-button round-small"
              aria-label="Önceki gün"
              disabled={date <= earliest}
              onClick={() => setDate(addDays(date, -1))}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <span aria-live="polite">{dayLabel(date, today)}</span>
            <button
              type="button"
              className="round-button round-small"
              aria-label="Sonraki gün"
              disabled={date >= today}
              onClick={() => setDate(addDays(date, 1))}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          {state.meds.length > 0 && (
            <dl className="mini-stats">
              <div>
                <dt>
                  <Flame size={15} aria-hidden /> Seri
                </dt>
                <dd>
                  <CountUp value={days} /> gün
                </dd>
              </div>
              <div>
                <dt>Son 7 gün</dt>
                <dd>
                  <CountUp value={week.ratio ?? 0} format={fmtRatio} />
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      <AnimatePresence>
        {cheer && (
          <motion.p
            className="cheer"
            initial={{ opacity: 0, scale: 0.7, height: 0 }}
            animate={{ opacity: 1, scale: 1, height: 'auto' }}
            exit={{ opacity: 0, scale: 0.9, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <Sparkles size={18} aria-hidden /> Bugünün dozları tamam
          </motion.p>
        )}
      </AnimatePresence>

      {state.meds.length === 0 && (
        <a href="#ilaclar" className="cta">
          İlaç veya takviye ekle
        </a>
      )}
      {state.meds.length > 0 && planned.length === 0 && <p className="muted">Bu gün için planlı doz yok.</p>}

      <ul className="doses">
        {planned.map((med) => {
          const slots = plannedSlots(med, date)
          const taken = state.doses[date]?.[med.id] ?? []
          return (
            <li key={med.id} className="dose">
              <div className="dose-name">
                <strong>{med.name}</strong>
                {med.dose && <span>{med.dose}</span>}
              </div>
              <div className="capsules">
                {SLOT_NAMES[slots].map((label, slot) => {
                  const done = taken.includes(slot)
                  return (
                    <DoseCapsule
                      key={label}
                      label={label}
                      done={done}
                      medName={med.name}
                      onToggle={() => toggle(med, slot, done)}
                    />
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>

      {resting.length > 0 && (
        <p className="muted">Bu gün planı olmayan: {resting.map((med) => med.name).join(', ')}</p>
      )}
    </section>
  )
}

function CareTiles({ state, today }: { state: AppState; today: ISODate }) {
  const surgeryDate = state.surgery!.date
  const washed = state.washes.some((wash) => wash.date === today)
  const wash = washStats(surgeryDate, state.washes, today)
  const scab = scabStats(surgeryDate, state.scabs, today)

  const washNote =
    wash.averageGap !== null
      ? `Ortalama ${fmtDecimal(wash.averageGap)} günde bir`
      : wash.count > 0
        ? `İlk yıkama ${wash.firstDay}. gün`
        : 'Henüz kayıt yok'

  return (
    <div className="tile-grid">
      <Press
        className="tile tile-water"
        aria-pressed={washed}
        onClick={() => {
          if (washed) {
            actions.removeWash(today)
          } else {
            actions.addWash(today)
            tapFirm()
          }
        }}
      >
        <span className="water" data-full={washed || undefined} aria-hidden>
          <i />
          <i />
        </span>
        <span className="tile-icon">
          {washed ? <Check size={22} strokeWidth={3} aria-hidden /> : <Droplets size={22} aria-hidden />}
        </span>
        <strong>{washed ? 'Bugün yıkandı' : 'Bugün yıkadım'}</strong>
        <small>{washNote}</small>
      </Press>

      <div className="tile tile-scab">
        <span className="scab-steps" aria-hidden>
          {['bekliyor', 'suruyor', 'tamam'].map((step, index) => (
            <i key={step} data-on={['bekliyor', 'suruyor', 'tamam'].indexOf(scab.status) >= index || undefined} />
          ))}
        </span>
        <strong>Kabuk dökümü</strong>
        {scab.status === 'tamam' && <small>{scab.endDay}. günde tamamlandı</small>}
        {scab.status === 'suruyor' && (
          <Press className="mini-button" onClick={() => actions.saveScabs({ ...state.scabs, end: today })}>
            Tamamen döküldü
          </Press>
        )}
        {scab.status === 'bekliyor' && (
          <Press className="mini-button" onClick={() => actions.saveScabs({ ...state.scabs, start: today })}>
            Döküm başladı
          </Press>
        )}
      </div>
    </div>
  )
}

function WeekCheck({ state, today }: { state: AppState; today: ISODate }) {
  const [adding, setAdding] = useState(false)
  const surgeryDate = state.surgery!.date
  const week = weekPeriod(surgeryDate, weekNumber(surgeryDate, today))
  const entry = state.checkIns
    .filter((item) => item.date >= week.start && item.date <= week.end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1)
  const daysLeft = diffDays(today, week.end)

  return (
    <>
      {entry ? (
        <a href="#surec" className="card week-done">
          <Ring value={entry.fullness / 100} size={58} thickness={7} from="#2df5b0" to="#38b6ff" />
          <div>
            <strong>{week.n}. hafta ölçümü tamam</strong>
            <small>
              {fmtDay(entry.date)}, {fmtScore(entry.fullness)}
            </small>
          </div>
        </a>
      ) : (
        <Press className="cta cta-pulse" onClick={() => setAdding(true)}>
          <Camera size={20} aria-hidden />
          <span>
            {week.n}. hafta ölçümünü ekle
            <small>{daysLeft === 0 ? 'Bugün son gün' : `${daysLeft} gün kaldı`}</small>
          </span>
        </Press>
      )}
      {adding && <CheckInForm surgeryDate={surgeryDate} entry={null} onClose={() => setAdding(false)} />}
    </>
  )
}

function SurgeryCard({ state }: { state: AppState }) {
  const surgery = state.surgery!
  return (
    <a href="#operasyon" className="card surgery-card">
      <div>
        <small>Greft</small>
        <strong className="display-number">
          {surgery.graftCount ? <CountUp value={surgery.graftCount} format={fmtInt} /> : '–'}
        </strong>
      </div>
      <div>
        <small>Klinik</small>
        <strong>{surgery.clinic || 'Ekle'}</strong>
      </div>
      <div>
        <small>Teknik</small>
        <strong>{surgery.technique}</strong>
      </div>
    </a>
  )
}

export function Today() {
  const state = useAppState()
  const today = useToday()
  const day = dayNumber(state.surgery!.date, today)
  const started = day >= 0

  return (
    <>
      <Hero state={state} today={today} />
      <div className="stack dock">
        <Reveal i={1}>
          <DayProgress state={state} today={today} />
        </Reveal>
        {started && (
          <Reveal i={2}>
            <CareTiles state={state} today={today} />
          </Reveal>
        )}
        {started && (
          <Reveal i={3}>
            <WeekCheck state={state} today={today} />
          </Reveal>
        )}
        {started && (
          <Reveal i={4}>
            <section className="card stage-card">
              <h2>{stageAt(day).title}</h2>
              <p>{stageAt(day).body}</p>
            </section>
          </Reveal>
        )}
        <Reveal i={5}>
          <SurgeryCard state={state} />
        </Reveal>
      </div>
    </>
  )
}
