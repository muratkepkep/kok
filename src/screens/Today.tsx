import { Check, ChevronLeft, ChevronRight, Droplets } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CheckInForm } from '../components/CheckInForm'
import { Strands } from '../components/Strands'
import { inUseOn, medStart, plannedSlots, SLOT_NAMES, streak, windowTally } from '../domain/adherence'
import { scabStats, washStats } from '../domain/care'
import { addDays, diffDays, fmtDay, fmtFull, fmtWeekday, minDate } from '../domain/dates'
import { fmtDecimal, fmtInt, fmtRatio, fmtScore } from '../domain/format'
import { dayNumber, monthNumber, stageAt, weekNumber, weekPeriod } from '../domain/timeline'
import type { AppState, ISODate } from '../domain/types'
import { actions, useAppState, useToday } from '../store'

const dayLabel = (date: ISODate, today: ISODate) => {
  if (date === today) return 'Bugün'
  if (date === addDays(today, -1)) return 'Dün'
  return `${fmtDay(date)} ${fmtWeekday(date)}`
}

function Hero({ state, today }: { state: AppState; today: ISODate }) {
  const surgery = state.surgery!
  const day = dayNumber(surgery.date, today)
  const stage = stageAt(Math.max(day, 0))
  const before = day < 0

  return (
    <header className="hero">
      <div className="hero-top">
        <p className="hero-day">
          <span className="hero-number">{Math.abs(day)}</span>
          <span className="hero-unit">{before ? 'gün kaldı' : '. gün'}</span>
        </p>
        <div className="hero-stage">
          {before ? (
            <>
              <p className="hero-when">Ameliyat tarihin {fmtFull(surgery.date)}</p>
              <h1>Ameliyata hazırlık</h1>
              <p>Takip ameliyat gününde başlar. Hazırlık için kliniğinin talimatını izle.</p>
            </>
          ) : (
            <>
              <p className="hero-when">
                {weekNumber(surgery.date, today)}. hafta, {monthNumber(surgery.date, today)}. ay
              </p>
              <h1>{stage.title}</h1>
              <p>{stage.body}</p>
            </>
          )}
        </div>
      </div>
      <Strands currentWeek={weekNumber(surgery.date, today)} />
      <a href="#operasyon" className="facts">
        {[
          surgery.graftCount && `${fmtInt(surgery.graftCount)} greft`,
          surgery.clinic,
          surgery.technique,
          fmtFull(surgery.date),
        ]
          .filter(Boolean)
          .join(', ')}
      </a>
    </header>
  )
}

function Doses({ state, today }: { state: AppState; today: ISODate }) {
  const [date, setDate] = useState(today)
  useEffect(() => setDate(today), [today])

  const surgeryDate = state.surgery!.date
  const earliest = state.meds.map(medStart).reduce(minDate, surgeryDate)
  const planned = state.meds.filter((med) => plannedSlots(med, date) > 0)
  const resting = state.meds.filter((med) => inUseOn(med, date) && plannedSlots(med, date) === 0)

  return (
    <section className="section">
      <div className="section-head">
        <h2>Dozlar</h2>
        <div className="day-switch">
          <button
            type="button"
            className="icon-button"
            aria-label="Önceki gün"
            disabled={date <= earliest}
            onClick={() => setDate(addDays(date, -1))}
          >
            <ChevronLeft size={20} />
          </button>
          <span aria-live="polite">{dayLabel(date, today)}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Sonraki gün"
            disabled={date >= today}
            onClick={() => setDate(addDays(date, 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {state.meds.length === 0 && (
        <p className="empty">
          Henüz ilaç eklemedin. <a href="#ilaclar">İlaç veya takviye ekle</a>
        </p>
      )}

      {state.meds.length > 0 && planned.length === 0 && <p className="empty">Bu gün için planlı doz yok.</p>}

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
                    <button
                      key={label}
                      type="button"
                      className="capsule"
                      aria-pressed={done}
                      aria-label={`${med.name}, ${label}`}
                      onClick={() => actions.toggleDose(date, med.id, slot)}
                    >
                      {done && <Check size={17} strokeWidth={3} aria-hidden />}
                      {label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>

      {resting.length > 0 && (
        <p className="section-note">Bu gün planı olmayan: {resting.map((med) => med.name).join(', ')}</p>
      )}
    </section>
  )
}

function CareToday({ state, today }: { state: AppState; today: ISODate }) {
  const surgeryDate = state.surgery!.date
  const washed = state.washes.some((wash) => wash.date === today)
  const wash = washStats(surgeryDate, state.washes, today)
  const scab = scabStats(surgeryDate, state.scabs, today)

  return (
    <section className="section">
      <h2>Bakım</h2>
      <button
        type="button"
        className="wash-toggle"
        aria-pressed={washed}
        onClick={() => (washed ? actions.removeWash(today) : actions.addWash(today))}
      >
        {washed ? <Check size={20} strokeWidth={3} aria-hidden /> : <Droplets size={20} aria-hidden />}
        {washed ? 'Bugün yıkadım' : 'Bugün yıkadım olarak işaretle'}
      </button>
      <p className="section-note">
        {wash.count === 0 && 'Henüz yıkama kaydı yok.'}
        {wash.count > 0 && wash.averageGap === null && `İlk yıkama ${wash.firstDay}. günde yapıldı.`}
        {wash.averageGap !== null && (
          <>
            Ortalama {fmtDecimal(wash.averageGap)} günde bir yıkıyorsun.{' '}
            {wash.daysSinceLast === 0 ? '' : `Son yıkama ${wash.daysSinceLast} gün önce.`}
          </>
        )}
      </p>

      <div className="scab-quick">
        {scab.status === 'tamam' && (
          <p>
            Kabuklar <strong>{scab.endDay}. günde</strong> tamamen döküldü.
          </p>
        )}
        {scab.status === 'suruyor' && (
          <>
            <p>
              Kabuk dökümü <strong>{scab.runningDays}. gününde</strong>.
            </p>
            <button
              type="button"
              className="button-quiet"
              onClick={() => actions.saveScabs({ ...state.scabs, end: today })}
            >
              Tamamen döküldü
            </button>
          </>
        )}
        {scab.status === 'bekliyor' && (
          <>
            <p>Kabuk dökümü henüz kaydedilmedi.</p>
            <button
              type="button"
              className="button-quiet"
              onClick={() => actions.saveScabs({ ...state.scabs, start: today })}
            >
              Döküm başladı
            </button>
          </>
        )}
      </div>
    </section>
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
    <section className="section">
      <h2>{week.n}. hafta ölçümü</h2>
      {entry ? (
        <p className="section-note">
          {fmtDay(entry.date)} ölçümün: <strong>{fmtScore(entry.fullness)}</strong>
        </p>
      ) : (
        <>
          <p className="section-note">
            Bu hafta ölçüm girmedin. {daysLeft === 0 ? 'Bugün son gün.' : `${daysLeft} gün kaldı.`}
          </p>
          <button type="button" className="button" onClick={() => setAdding(true)}>
            Ölçüm ekle
          </button>
        </>
      )}
      {adding && <CheckInForm surgeryDate={surgeryDate} entry={null} onClose={() => setAdding(false)} />}
    </section>
  )
}

export function Today() {
  const state = useAppState()
  const today = useToday()
  const started = today >= state.surgery!.date
  const week = windowTally(state.meds, state.doses, 7, today)

  return (
    <>
      <Hero state={state} today={today} />
      <div className="today-grid">
        <div>
          <Doses state={state} today={today} />
          {state.meds.length > 0 && (
            <dl className="figures">
              <div>
                <dt>Son 7 gün uyum</dt>
                <dd>{fmtRatio(week.ratio)}</dd>
              </div>
              <div>
                <dt>Eksiksiz gün serisi</dt>
                <dd>{streak(state.meds, state.doses, today)}</dd>
              </div>
            </dl>
          )}
        </div>
        {started && (
          <div>
            <CareToday state={state} today={today} />
            <WeekCheck state={state} today={today} />
          </div>
        )}
      </div>
    </>
  )
}
