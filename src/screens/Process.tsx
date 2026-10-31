import { Check, ChevronDown, Pencil, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CheckInForm } from '../components/CheckInForm'
import { Press, Reveal, Ring, Segmented } from '../components/fx'
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

function Entry({ entry, surgeryDate, onEdit }: { entry: CheckIn; surgeryDate: ISODate; onEdit: () => void }) {
  const day = dayNumber(surgeryDate, entry.date)
  return (
    <div className="entry">
      <div className="entry-head">
        <strong>
          {fmtDay(entry.date)}, {day}. gün
        </strong>
        <button type="button" className="round-button round-small" aria-label="Ölçümü düzenle" onClick={onEdit}>
          <Pencil size={15} aria-hidden />
        </button>
      </div>
      <div className="chip-row">
        <span className="glass-chip">İlerleme {fmtScore(entry.fullness)}</span>
        <span className="glass-chip">Dökülme: {SHEDDING_LEVELS[entry.shedding]}</span>
        {entry.density !== null && <span className="glass-chip">{entry.density} kıl/cm²</span>}
      </div>
      {entry.sideEffects.length > 0 && <p className="muted">Şikâyet: {entry.sideEffects.join(', ')}</p>}
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
  index: number
  onAdd: (date: ISODate) => void
  onEdit: (entry: CheckIn) => void
}

function PeriodRow({ period, current, state, today, index, onAdd, onEdit }: RowProps) {
  const [open, setOpen] = useState(current)
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
    <Reveal i={index} className="timeline-item">
      <span className="timeline-node" data-current={current || undefined} aria-hidden />
      <div className="period" data-current={current || undefined}>
        <button type="button" className="period-head" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Ring value={adherence.ratio ?? 0} size={54} thickness={6}>
            <span className="period-ring">{period.n}</span>
          </Ring>
          <span className="period-title">
            <strong>
              {period.n}. {unit}, {stage.title}
            </strong>
            <span>{fmtRange(period.start, period.end)}</span>
          </span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="period-chevron">
            <ChevronDown size={18} aria-hidden />
          </motion.span>
        </button>
        <div className="period-stats">
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
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              className="period-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            >
              <div className="period-inner">
                {period.kind === 'month' && latest && before && (
                  <p className="muted">
                    Önceki döneme göre {fmtSigned(latest.fullness - before.fullness)} puan, {entries.length} ölçüm.
                  </p>
                )}
                {entries.length === 0 && <p className="muted">Bu dönemde ölçüm yok.</p>}
                {entries.map((entry) => (
                  <Entry key={entry.id} entry={entry} surgeryDate={surgeryDate} onEdit={() => onEdit(entry)} />
                ))}
                <Press className="mini-button" onClick={() => onAdd(minDate(period.end, today))}>
                  <Plus size={16} aria-hidden /> Bu döneme ölçüm ekle
                </Press>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Reveal>
  )
}

function Roadmap({ day }: { day: number }) {
  const current = useRef<HTMLLIElement>(null)
  useEffect(() => {
    current.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [])

  return (
    <section>
      <h2 className="section-title">Yol haritası</h2>
      <ol className="roadmap">
        {STAGES.map((stage) => {
          const status = day > stage.toDay ? 'done' : day >= stage.fromDay ? 'now' : 'next'
          return (
            <li
              key={stage.title}
              ref={status === 'now' ? current : undefined}
              data-status={status}
              aria-current={status === 'now' ? 'step' : undefined}
            >
              <span className="roadmap-dot">{status === 'done' && <Check size={14} strokeWidth={3} aria-hidden />}</span>
              <strong>{stage.title}</strong>
              <small>
                {Number.isFinite(stage.toDay) ? `${stage.fromDay}–${stage.toDay}. gün` : `${stage.fromDay}. gün sonrası`}
              </small>
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
  if (photos.length === 0) return null
  return (
    <section>
      <div className="section-row">
        <h2 className="section-title">Fotoğraflar</h2>
        <a href="#foto" className="link">
          Önce ve sonrayı kıyasla
        </a>
      </div>
      <div className="gallery">
        {photos.map((photo) => (
          <Photo key={photo.id} id={photo.id} caption={photo.caption} />
        ))}
      </div>
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
    <div className="page stack">
      <header className="page-head">
        <h1>Süreç</h1>
        <Segmented
          name="surec"
          label="Görünüm"
          value={view}
          onChange={setView}
          options={[
            { value: 'week', label: 'Haftalık' },
            { value: 'month', label: 'Aylık' },
          ]}
        />
      </header>

      <Reveal>
        <Roadmap day={day} />
      </Reveal>

      {day >= 0 && (
        <Reveal i={1}>
          <Press className="cta" onClick={() => setForm({ entry: null })}>
            <Plus size={20} aria-hidden /> Ölçüm ekle
          </Press>
        </Reveal>
      )}

      {day < 0 && <p className="muted">Süreç ameliyat gününde başlar.</p>}
      <div className="timeline" key={view}>
        {rows.map((item, index) => (
          <PeriodRow
            key={item.n}
            index={index}
            period={item}
            current={item.n === count}
            state={state}
            today={today}
            onAdd={(date) => setForm({ entry: null, date })}
            onEdit={(entry) => setForm({ entry })}
          />
        ))}
      </div>
      {rows.length < all.length && (
        <Press className="ghost-button" onClick={() => setShowAll(true)}>
          Tüm haftaları göster ({all.length})
        </Press>
      )}
      <Gallery state={state} />

      {form && (
        <CheckInForm
          surgeryDate={surgeryDate}
          entry={form.entry}
          defaultDate={form.date}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  )
}
