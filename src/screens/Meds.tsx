import { Bell, History, Package, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AdherenceCalendar } from '../components/Charts'
import { CountUp, Press, Reveal, Ring, Segmented, Stepper } from '../components/fx'
import { MedForm } from '../components/MedForm'
import {
  activePlan,
  dayRatio,
  doseHistory,
  doseStep,
  isStopped,
  medStart,
  scheduleLabel,
  slotTally,
  SLOT_NAMES,
  stockStatus,
  streak,
  tally,
  weekdayMisses,
  weeklyRate,
  windowTally,
} from '../domain/adherence'
import { fmtDayShort, fmtFull, minDate, WEEKDAYS } from '../domain/dates'
import { fmtDecimal, fmtRatio } from '../domain/format'
import type { AppState, ISODate, Medication } from '../domain/types'
import { actions, useAppState, useToday } from '../store'

const RING_COLORS = [
  ['#2ef2ff', '#7a5cff'],
  ['#ff2e9f', '#7a5cff'],
  ['#b6ff3c', '#2ef2ff'],
  ['#ffb020', '#ff2e9f'],
]

const KIND_LABELS = { ilac: 'İlaç', takviye: 'Takviye', bakim: 'Bakım' }

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
  const [showHistory, setShowHistory] = useState(false)
  const plan = activePlan(med)
  const stopped = isStopped(med)
  const finished = med.endDate !== null && med.endDate < today
  const week = windowTally([med], state.doses, 7, today)
  const month = windowTally([med], state.doses, 30, today)
  const all = tally([med], state.doses, medStart(med), today, today)
  const rate = weeklyRate(med, state.doses, today)
  const perWeek = plan.weekdays?.length ? plan.weekdays.length : 7 / plan.everyNDays
  const slots = slotTally(med, state.doses, today)
  const slotNames = SLOT_NAMES[slots.length]
  const stock = stockStatus(med, state.doses, today)
  const history = doseHistory(med)
  const [from, to] = RING_COLORS[index % RING_COLORS.length]

  return (
    <article className="card med" data-stopped={stopped || finished || undefined}>
      <div className="med-head">
        <Ring value={month.ratio ?? 0} size={92} thickness={8} from={from} to={to}>
          <strong className="ring-value ring-small">
            <CountUp value={month.ratio ?? 0} format={fmtRatio} />
          </strong>
          <span>30 gün</span>
        </Ring>
        <div className="med-title">
          <h2>{med.name}</h2>
          <p>{[KIND_LABELS[med.kind], med.dose].filter(Boolean).join(', ')}</p>
          <span className="tag">{finished ? 'Kür bitti' : stopped ? 'Ara verildi' : scheduleLabel(plan)}</span>
        </div>
      </div>

      <div className="dose-control">
        <div>
          <small>Doz başına</small>
          <p className="muted">{plan.amount === null ? 'Doz girilmedi' : 'Değişiklik bugünden başlar'}</p>
        </div>
        <Stepper
          value={plan.amount ?? 0}
          step={doseStep(med.unit)}
          label={`${med.name} dozu`}
          format={(value) => `${fmtDecimal(value)} ${med.unit}`}
          onChange={(value) => actions.setDoseAmount(med.id, value, today)}
        />
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
            <small> / {fmtDecimal(plan.timesPerDay * perWeek)}</small>
          </dd>
        </div>
      </dl>

      <div className="chip-row">
        <span className="tag">
          <Bell size={13} aria-hidden /> {med.slotTimes.slice(0, plan.timesPerDay).join(', ')}
        </span>
        {stock && (
          <span className="tag" data-tone={stock.low ? 'warn' : undefined}>
            <Package size={13} aria-hidden /> {fmtDecimal(stock.remaining)} {med.unit}
            {stock.daysLeft !== null && `, ${stock.daysLeft} gün`}
          </span>
        )}
        {med.endDate && <span className="tag">Bitiş {fmtDayShort(med.endDate)}</span>}
      </div>

      {slots.length > 1 && (
        <p className="muted">{slots.map((slot, slotIndex) => `${slotNames[slotIndex]} ${fmtRatio(slot.ratio)}`).join(', ')}</p>
      )}
      {med.note && <p className="muted">{med.note}</p>}

      {showHistory && (
        <ul className="dose-history">
          {history.map((row) => (
            <li key={row.from}>
              <span>{fmtFull(row.from)}</span>
              <strong>
                {fmtDecimal(row.amount)} {med.unit}
              </strong>
            </li>
          ))}
        </ul>
      )}

      <div className="action-row">
        <Press className="round-button" aria-label={`${med.name} düzenle`} onClick={onEdit}>
          <Pencil size={17} aria-hidden />
        </Press>
        {history.length > 0 && (
          <Press className="round-button" aria-label="Doz geçmişi" aria-pressed={showHistory} onClick={() => setShowHistory(!showHistory)}>
            <History size={17} aria-hidden />
          </Press>
        )}
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
          <Trash2 size={17} aria-hidden />
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
        <Press className="cta cta-small" onClick={() => setForm({ med: null })}>
          <Plus size={18} aria-hidden /> Ekle
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
