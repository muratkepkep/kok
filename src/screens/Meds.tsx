import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AdherenceCalendar } from '../components/Charts'
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

function MedRow({
  med,
  state,
  today,
  onEdit,
}: {
  med: Medication
  state: AppState
  today: ISODate
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

  return (
    <article className="med">
      <header>
        <h3>{med.name}</h3>
        <p>
          {[med.kind === 'ilac' ? 'İlaç' : 'Takviye', med.dose, stopped ? 'Ara verildi' : scheduleLabel(plan)]
            .filter(Boolean)
            .join(', ')}
        </p>
      </header>
      <dl className="med-stats">
        <div>
          <dt>Son 7 gün</dt>
          <dd>{fmtRatio(week.ratio)}</dd>
        </div>
        <div>
          <dt>Son 30 gün</dt>
          <dd>{fmtRatio(month.ratio)}</dd>
        </div>
        <div>
          <dt>Başlangıçtan beri</dt>
          <dd>{fmtRatio(all.ratio)}</dd>
        </div>
        <div>
          <dt>Haftalık kullanım</dt>
          <dd>
            {rate === null ? '–' : fmtDecimal(rate)}
            <small> / {fmtDecimal(plannedPerWeek)} doz</small>
          </dd>
        </div>
      </dl>
      <p className="section-note">
        {slots.length > 1 &&
          `${slots.map((slot, index) => `${slotNames[index]} ${fmtRatio(slot.ratio)}`).join(', ')}. `}
        Başlangıç: {fmtFull(medStart(med))}.
      </p>
      <div className="med-actions">
        <button type="button" className="button-quiet" onClick={onEdit}>
          Düzenle
        </button>
        {stopped ? (
          <button type="button" className="button-quiet" onClick={() => actions.resumeMed(med.id, today)}>
            Yeniden başlat
          </button>
        ) : (
          <button type="button" className="button-quiet" onClick={() => actions.stopMed(med.id, today)}>
            Ara ver
          </button>
        )}
        <button
          type="button"
          className="button-quiet"
          onClick={() => {
            if (window.confirm(`${med.name} tüm doz kayıtlarıyla silinsin mi?`)) actions.deleteMed(med.id)
          }}
        >
          Sil
        </button>
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
    <>
      <header className="page-head">
        <h1>İlaçlar</h1>
        <div className="page-actions">
          <button type="button" className="button" onClick={() => setForm({ med: null })}>
            <Plus size={18} aria-hidden /> İlaç ekle
          </button>
        </div>
      </header>

      {state.meds.length === 0 ? (
        <p className="empty">Minoksidil, finasterid veya kullandığın takviyeleri ekle, doz takibi Bugün sayfasında başlasın.</p>
      ) : (
        <div className="meds">
          {state.meds.map((med) => (
            <MedRow key={med.id} med={med} state={state} today={today} onEdit={() => setForm({ med })} />
          ))}
        </div>
      )}

      {state.meds.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Doz takvimi</h2>
            <div className="segmented" role="group" aria-label="Takvimde gösterilen ilaç">
              <button type="button" aria-pressed={filter === 'hepsi'} onClick={() => setFilter('hepsi')}>
                Hepsi
              </button>
              {state.meds.map((med) => (
                <button key={med.id} type="button" aria-pressed={filter === med.id} onClick={() => setFilter(med.id)}>
                  {med.name}
                </button>
              ))}
            </div>
          </div>
          <dl className="figures">
            <div>
              <dt>Son 30 gün uyum</dt>
              <dd>{fmtRatio(windowTally(scope, state.doses, 30, today).ratio)}</dd>
            </div>
            <div>
              <dt>Eksiksiz gün serisi</dt>
              <dd>{streak(scope, state.doses, today)}</dd>
            </div>
            {worst && totalMissed >= 3 && worst.missed > 0 && (
              <div>
                <dt>En çok aksayan gün</dt>
                <dd>{WEEKDAYS[worst.weekday]}</dd>
              </div>
            )}
          </dl>
          <AdherenceCalendar
            ratioOf={(date) => dayRatio(scope, state.doses, date)}
            today={today}
            firstDate={firstDate}
          />
        </section>
      )}

      {form && <MedForm med={form.med} onClose={() => setForm(null)} />}
    </>
  )
}
