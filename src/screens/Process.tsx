import { Check, Circle, CircleDot, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { CheckInForm } from '../components/CheckInForm'
import { tally } from '../domain/adherence'
import { fmtDay, fmtRange, minDate } from '../domain/dates'
import { sortedCheckIns } from '../domain/efficacy'
import { fmtRatio, fmtScore, fmtSigned } from '../domain/format'
import {
  dayNumber,
  monthNumber,
  monthPeriod,
  stageAt,
  STAGES,
  weekNumber,
  weekPeriod,
  type Period,
} from '../domain/timeline'
import { SHEDDING_LEVELS, type AppState, type CheckIn, type ISODate } from '../domain/types'
import { usePhotoUrl } from '../photos'
import { useAppState, useToday } from '../store'

const WEEKS_SHOWN = 12

function Photo({ id, caption }: { id: string; caption: string }) {
  const url = usePhotoUrl(id)
  return (
    <figure className="photo">
      {url && <img src={url} alt={caption} loading="lazy" />}
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

interface EntryProps {
  entry: CheckIn
  surgeryDate: ISODate
  onEdit: () => void
}

function Entry({ entry, surgeryDate, onEdit }: EntryProps) {
  const day = dayNumber(surgeryDate, entry.date)
  return (
    <div className="entry">
      <div className="entry-head">
        <strong>
          {fmtDay(entry.date)}, {day}. gün
        </strong>
        <button type="button" className="icon-button" aria-label="Ölçümü düzenle" onClick={onEdit}>
          <Pencil size={17} />
        </button>
      </div>
      <dl className="entry-facts">
        <div>
          <dt>İlerleme</dt>
          <dd>{fmtScore(entry.fullness)}</dd>
        </div>
        <div>
          <dt>Dökülme</dt>
          <dd>{SHEDDING_LEVELS[entry.shedding]}</dd>
        </div>
        {entry.density !== null && (
          <div>
            <dt>Yoğunluk</dt>
            <dd>{entry.density} kıl/cm²</dd>
          </div>
        )}
      </dl>
      {entry.sideEffects.length > 0 && <p>Şikâyet: {entry.sideEffects.join(', ')}</p>}
      {entry.note && <p>{entry.note}</p>}
      {entry.photoIds.length > 0 && (
        <div className="photo-row">
          {entry.photoIds.map((id) => (
            <Photo key={id} id={id} caption={`${day}. gün`} />
          ))}
        </div>
      )}
    </div>
  )
}

interface RowProps {
  period: Period
  current: boolean
  state: AppState
  today: ISODate
  onAdd: (date: ISODate) => void
  onEdit: (entry: CheckIn) => void
}

function PeriodRow({ period, current, state, today, onAdd, onEdit }: RowProps) {
  const surgeryDate = state.surgery!.date
  const checkIns = sortedCheckIns(state.checkIns)
  const entries = checkIns.filter((item) => item.date >= period.start && item.date <= period.end)
  const latest = entries.at(-1)
  const before = checkIns.filter((item) => item.date < period.start).at(-1)
  const adherence = tally(state.meds, state.doses, period.start, period.end, today)
  const washes = state.washes.filter((wash) => wash.date >= period.start && wash.date <= period.end).length
  const stage = stageAt(dayNumber(surgeryDate, minDate(period.end, today)))
  const unit = period.kind === 'week' ? 'hafta' : 'ay'

  return (
    <details className="period" data-current={current || undefined} open={current}>
      <summary>
        <span className="period-n">
          {period.n}.<small>{unit}</small>
        </span>
        <span className="period-when">
          <strong>{stage.title}</strong>
          <span>{fmtRange(period.start, period.end)}</span>
        </span>
        <span className="period-stats">
          <span>
            <small>Uyum</small>
            {fmtRatio(adherence.ratio)}
          </span>
          <span>
            <small>Yıkama</small>
            {washes}
          </span>
          <span>
            <small>İlerleme</small>
            {fmtScore(latest?.fullness ?? null)}
          </span>
        </span>
      </summary>
      <div className="period-body">
        {period.kind === 'month' && latest && before && (
          <p className="section-note">
            Önceki döneme göre {fmtSigned(latest.fullness - before.fullness)} puan, {entries.length} ölçüm.
          </p>
        )}
        {entries.length === 0 && <p className="section-note">Bu dönemde ölçüm yok.</p>}
        {entries.map((entry) => (
          <Entry key={entry.id} entry={entry} surgeryDate={surgeryDate} onEdit={() => onEdit(entry)} />
        ))}
        <button type="button" className="button-quiet" onClick={() => onAdd(minDate(period.end, today))}>
          <Plus size={17} aria-hidden /> Bu döneme ölçüm ekle
        </button>
      </div>
    </details>
  )
}

function Roadmap({ day }: { day: number }) {
  return (
    <section className="section">
      <h2>Yol haritası</h2>
      <ol className="roadmap">
        {STAGES.map((stage) => {
          const status = day > stage.toDay ? 'done' : day >= stage.fromDay ? 'now' : 'next'
          const Icon = status === 'done' ? Check : status === 'now' ? CircleDot : Circle
          const range = Number.isFinite(stage.toDay) ? `${stage.fromDay}–${stage.toDay}. gün` : `${stage.fromDay}. günden sonra`
          return (
            <li key={stage.title} data-status={status} aria-current={status === 'now' ? 'step' : undefined}>
              <Icon size={17} aria-hidden />
              <strong>{stage.title}</strong>
              <span>{range}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function Gallery({ state }: { state: AppState }) {
  const surgeryDate = state.surgery!.date
  const photos = sortedCheckIns(state.checkIns).flatMap((entry) =>
    entry.photoIds.map((id) => ({ id, caption: `${dayNumber(surgeryDate, entry.date)}. gün` })),
  )
  return (
    <section className="section">
      <h2>Fotoğraflar</h2>
      {photos.length === 0 ? (
        <p className="empty">Ölçümlere eklediğin fotoğraflar burada tarih sırasıyla görünür.</p>
      ) : (
        <div className="gallery">
          {photos.map((photo) => (
            <Photo key={photo.id} id={photo.id} caption={photo.caption} />
          ))}
        </div>
      )}
    </section>
  )
}

type FormState = { entry: CheckIn | null; date?: ISODate } | null

export function Process() {
  const state = useAppState()
  const today = useToday()
  const [view, setView] = useState<'week' | 'month'>('week')
  const [showAll, setShowAll] = useState(false)
  const [form, setForm] = useState<FormState>(null)

  const surgeryDate = state.surgery!.date
  const day = dayNumber(surgeryDate, today)
  const count = view === 'week' ? weekNumber(surgeryDate, today) : monthNumber(surgeryDate, today)
  const period = view === 'week' ? weekPeriod : monthPeriod
  const all = Array.from({ length: count }, (_, index) => period(surgeryDate, count - index))
  const rows = view === 'week' && !showAll ? all.slice(0, WEEKS_SHOWN) : all

  return (
    <>
      <header className="page-head">
        <h1>Süreç</h1>
        <div className="page-actions">
          <div className="segmented" role="group" aria-label="Görünüm">
            <button type="button" aria-pressed={view === 'week'} onClick={() => setView('week')}>
              Haftalık
            </button>
            <button type="button" aria-pressed={view === 'month'} onClick={() => setView('month')}>
              Aylık
            </button>
          </div>
          {day >= 0 && (
            <button type="button" className="button" onClick={() => setForm({ entry: null })}>
              Ölçüm ekle
            </button>
          )}
        </div>
      </header>

      <div className="split">
        <section className="periods">
          {day < 0 && <p className="empty">Süreç ameliyat gününde başlar.</p>}
          {rows.map((item) => (
            <PeriodRow
              key={`${view}-${item.n}`}
              period={item}
              current={item.n === count}
              state={state}
              today={today}
              onAdd={(date) => setForm({ entry: null, date })}
              onEdit={(entry) => setForm({ entry })}
            />
          ))}
          {rows.length < all.length && (
            <button type="button" className="button-quiet" onClick={() => setShowAll(true)}>
              Tüm haftaları göster ({all.length})
            </button>
          )}
        </section>
        <div>
          <Roadmap day={day} />
          <Gallery state={state} />
        </div>
      </div>

      {form && (
        <CheckInForm
          surgeryDate={surgeryDate}
          entry={form.entry}
          defaultDate={form.date}
          onClose={() => setForm(null)}
        />
      )}
    </>
  )
}
