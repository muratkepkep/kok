import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdherenceCalendar } from '../components/Charts'
import { CountUp, Press, Reveal, Ring, Segmented } from '../components/fx'
import { MedForm } from '../components/MedForm'
import {
  activePlan,
  dayRatio,
  isStopped,
  medStart,
  scheduleLabel,
  slotTally,
  SLOT_NAMES,
  streak,
  tally,
  weekdayMisses,
  weeklyRate,
  windowTally,
} from '../domain/adherence'
import { fmtFull, minDate, WEEKDAYS } from '../domain/dates'
import { fmtDecimal, fmtRatio } from '../domain/format'
import type { AppState, ISODate, Medication } from '../domain/types'
import { actions, useAppState, useToday } from '../store'

const RING_COLORS = [
  ['#ff3d81', '#ffd23f'],
  ['#b45cff', '#38b6ff'],
  ['#2df5b0', '#ffd23f'],
  ['#38b6ff', '#2df5b0'],
]

function MedCard({
  med,
  state,
  today,
  index,
  onEdit,
}: {
  med: Medication
  state: AppState
  today: ISODate
  index: number
  onEdit: () => void
}) {
  const plan = activePlan(med)
  const stopped = isStopped(med)
  const week = windowTally([med], state.doses, 7, today)
  const month = windowTally([med], state.doses, 30, today)
  const all = tally([med], state.doses, medStart(med), today, today)
  const rate = weeklyRate(med, state.doses, today)
  const plannedPerWeek = (plan.timesPerDay * 7) / plan.everyNDays
  const slots = slotTally(med, state.doses, today)
  const slotNames = SLOT_NAMES[slots.length]
  const [from, to] = RING_COLORS[index % RING_COLORS.length]

  return (
    <article className="card med" data-stopped={stopped || undefined}>
      <div className="med-head">
        <Ring value={month.ratio ?? 0} size={96} thickness={11} from={from} to={to}>
          <strong className="ring-value ring-small">
            <CountUp value={month.ratio ?? 0} format={fmtRatio} />
          </strong>
          <span>30 gün</span>
        </Ring>
        <div className="med-title">
          <h2>{med.name}</h2>
          <p>{[med.kind === 'ilac' ? 'İlaç' : 'Takviye', med.dose].filter(Boolean).join(', ')}</p>
          <span className="glass-chip">{stopped ? 'Ara verildi' : scheduleLabel(plan)}</span>
        </div>
      </div>

      <dl className="stat-row">
        <div>
          <dt>7 gün</dt>
          <dd>{fmtRatio(week.ratio)}</dd>
        </div>
        <div>
          <dt>Tümü</dt>
          <dd>{fmtRatio(all.ratio)}</dd>
        </div>
        <div>
          <dt>Haftalık doz</dt>
          <dd>
            {rate === null ? '–' : fmtDecimal(rate)}
            <small> / {fmtDecimal(plannedPerWeek)}</small>
          </dd>
        </div>
      </dl>

      <p className="muted">
        {slots.length > 1 &&
          `${slots.map((slot, slotIndex) => `${slotNames[slotIndex]} ${fmtRatio(slot.ratio)}`).join(', ')}. `}
        Başlangıç: {fmtFull(medStart(med))}.
      </p>

      <div className="action-row">
        <Press className="round-button" aria-label={`${med.name} düzenle`} onClick={onEdit}>
          <Pencil size={18} aria-hidden />
        </Press>
        {stopped ? (
          <Press className="mini-button" onClick={() => actions.resumeMed(med.id, today)}>
            <Play size={15} aria-hidden /> Yeniden başlat
          </Press>
        ) : (
          <Press className="mini-button" onClick={() => actions.stopMed(med.id, today)}>
            <Pause size={15} aria-hidden /> Ara ver
          </Press>
        )}
        <Press
          className="round-button round-danger"
          aria-label={`${med.name} sil`}
          onClick={() => {
            if (window.confirm(`${med.name} tüm doz kayıtlarıyla silinsin mi?`)) actions.deleteMed(med.id)
          }}
        >
          <Trash2 size={18} aria-hidden />
        </Press>
      </div>
    </article>
  )
}

export function Meds() {
  const state = useAppState()
  const today = useToday()
  const [form, setForm] = useState<{ med: Medication | null } | null>(null)
  const [filter, setFilter] = useState('hepsi')

  const scope = filter === 'hepsi' ? state.meds : state.meds.filter((med) => med.id === filter)
  const firstDate = scope.length ? scope.map(medStart).reduce(minDate) : today
  const misses = weekdayMisses(scope, state.doses, firstDate, today)
  const worst = misses
    .filter((row) => row.planned > 0)
    .reduce<(typeof misses)[number] | null>(
      (best, row) => (!best || row.missed / row.planned > best.missed / best.planned ? row : best),
      null,
    )
  const totalMissed = misses.reduce((sum, row) => sum + row.missed, 0)

  return (
    <div className="page stack">
      <header className="page-head">
        <h1>İlaçlar</h1>
        <Press className="round-button round-accent" aria-label="İlaç ekle" onClick={() => setForm({ med: null })}>
          <Plus size={22} aria-hidden />
        </Press>
      </header>

      {state.meds.length === 0 && (
        <Press className="cta" onClick={() => setForm({ med: null })}>
          Minoksidil, finasterid veya takviye ekle
        </Press>
      )}

      {state.meds.map((med, index) => (
        <Reveal key={med.id} i={index}>
          <MedCard med={med} state={state} today={today} index={index} onEdit={() => setForm({ med })} />
        </Reveal>
      ))}

      {state.meds.length > 0 && (
        <Reveal i={state.meds.length}>
          <section className="card">
            <h2>Doz takvimi</h2>
            <div className="scroll-x">
              <Segmented
                name="takvim"
                label="Takvimde gösterilen ilaç"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'hepsi', label: 'Hepsi' },
                  ...state.meds.map((med) => ({ value: med.id, label: med.name })),
                ]}
              />
            </div>
            <dl className="stat-row">
              <div>
                <dt>30 gün uyum</dt>
                <dd>{fmtRatio(windowTally(scope, state.doses, 30, today).ratio)}</dd>
              </div>
              <div>
                <dt>Seri</dt>
                <dd>{streak(scope, state.doses, today)} gün</dd>
              </div>
              {worst && totalMissed >= 3 && worst.missed > 0 && (
                <div>
                  <dt>En çok aksayan</dt>
                  <dd>{WEEKDAYS[worst.weekday]}</dd>
                </div>
              )}
            </dl>
            <AdherenceCalendar
              key={filter}
              ratioOf={(date) => dayRatio(scope, state.doses, date)}
              today={today}
              firstDate={firstDate}
            />
          </section>
        </Reveal>
      )}

      {form && <MedForm med={form.med} onClose={() => setForm(null)} />}
    </div>
  )
}
