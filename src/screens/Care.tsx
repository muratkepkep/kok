import { Check, Droplets, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { WashGapChart } from '../components/Charts'
import { CountUp, Press, Reveal } from '../components/fx'
import { scabStats, TYPICAL_SCAB_END, washStats } from '../domain/care'
import { fmtDay } from '../domain/dates'
import { fmtDecimal } from '../domain/format'
import { weekNumber } from '../domain/timeline'
import { tapFirm } from '../haptics'
import { actions, useAppState, useToday } from '../store'

const RECENT_WASHES = 6

const SCAB_TIMING = {
  erken: 'Genel aralıktan erken',
  tipik: 'Genel aralıkta',
  gec: 'Genel aralıktan geç',
}

const gapText = (value: number | null) => (value === null ? '–' : `${fmtDecimal(value)} gün`)

function Washes() {
  const state = useAppState()
  const today = useToday()
  const surgeryDate = state.surgery!.date
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [showAll, setShowAll] = useState(false)

  const stats = washStats(surgeryDate, state.washes, today)
  const duplicate = state.washes.some((wash) => wash.date === date)
  const newestFirst = [...stats.rows].reverse()
  const rows = showAll ? newestFirst : newestFirst.slice(0, RECENT_WASHES)

  return (
    <>
      <Reveal>
        <section className="card water-hero">
          <span className="water" data-full aria-hidden>
            <i />
            <i />
          </span>
          <div className="water-hero-copy">
            <small>Ortalama yıkama aralığı</small>
            <p className="display-number display-large">
              {stats.averageGap === null ? (
                '–'
              ) : (
                <>
                  <CountUp value={stats.averageGap} format={fmtDecimal} />
                  <span className="unit"> gün</span>
                </>
              )}
            </p>
          </div>
          <Droplets className="water-hero-icon" size={40} aria-hidden />
        </section>
      </Reveal>

      <Reveal i={1}>
        <dl className="stat-grid">
          <div>
            <dt>İlk yıkama</dt>
            <dd>{stats.firstDay === null ? '–' : `${stats.firstDay}. gün`}</dd>
          </div>
          <div>
            <dt>İlk 14 gün</dt>
            <dd>{gapText(stats.earlyAverageGap)}</dd>
          </div>
          <div>
            <dt>Sonrası</dt>
            <dd>{gapText(stats.lateAverageGap)}</dd>
          </div>
          <div>
            <dt>En uzun ara</dt>
            <dd>{stats.longestGap === null ? '–' : `${stats.longestGap} gün`}</dd>
          </div>
        </dl>
      </Reveal>

      <Reveal i={2}>
        <form
          className="card form-card"
          onSubmit={(event) => {
            event.preventDefault()
            actions.addWash(date, note.trim())
            setNote('')
            tapFirm()
          }}
        >
          <div className="field-row">
            <label className="field">
              <span>Tarih</span>
              <input
                type="date"
                value={date}
                min={surgeryDate}
                max={today}
                required
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Not</span>
              <input value={note} placeholder="Klinikte yapıldı" onChange={(event) => setNote(event.target.value)} />
            </label>
          </div>
          <motion.button type="submit" className="cta cta-water" whileTap={{ scale: 0.96 }} disabled={duplicate}>
            {duplicate ? 'Bu gün kayıtlı' : 'Yıkama ekle'}
          </motion.button>
        </form>
      </Reveal>

      {stats.averageGap !== null ? (
        <Reveal i={3}>
          <section className="card">
            <h2>Haftalara göre yıkama aralığı</h2>
            <WashGapChart rows={stats.rows} currentWeek={weekNumber(surgeryDate, today)} />
          </section>
        </Reveal>
      ) : (
        <p className="muted">İki yıkama girdikten sonra aralıkların grafiği burada görünür.</p>
      )}

      {rows.length > 0 && (
        <Reveal i={4}>
          <section className="card">
            <h2>Son yıkamalar</h2>
            <ul className="wash-list">
              {rows.map((row) => (
                <li key={row.date}>
                  <div>
                    <strong>{fmtDay(row.date)}</strong>
                    <small>
                      {row.day}. gün{row.note ? `, ${row.note}` : ''}
                    </small>
                  </div>
                  <span className="glass-chip">{row.gap === null ? 'İlk yıkama' : `${row.gap} gün sonra`}</span>
                  <button
                    type="button"
                    className="round-button round-small"
                    aria-label={`${fmtDay(row.date)} yıkamasını sil`}
                    onClick={() => actions.removeWash(row.date)}
                  >
                    <Trash2 size={15} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {rows.length < newestFirst.length && (
              <Press className="ghost-button" onClick={() => setShowAll(true)}>
                Tüm yıkamaları göster ({newestFirst.length})
              </Press>
            )}
          </section>
        </Reveal>
      )}
    </>
  )
}

function Scabs() {
  const state = useAppState()
  const today = useToday()
  const surgeryDate = state.surgery!.date
  const scabs = state.scabs
  const stats = scabStats(surgeryDate, scabs, today)
  const invalid = scabs.start && scabs.end && scabs.end < scabs.start
  const step = ['bekliyor', 'suruyor', 'tamam'].indexOf(stats.status)

  return (
    <Reveal i={5}>
      <section className="card">
        <h2>Kabuk dökümü</h2>
        <ol className="stepper">
          {['Bekliyor', 'Dökülüyor', 'Tamamlandı'].map((label, index) => (
            <li key={label} data-on={step >= index || undefined}>
              <span>{step > index || stats.status === 'tamam' ? <Check size={14} strokeWidth={3} aria-hidden /> : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        {stats.status === 'tamam' ? (
          <dl className="stat-grid">
            <div>
              <dt>Tamamen döküldü</dt>
              <dd>{stats.endDay}. gün</dd>
            </div>
            {stats.startDay !== null && (
              <div>
                <dt>Döküm başladı</dt>
                <dd>{stats.startDay}. gün</dd>
              </div>
            )}
            {stats.durationDays !== null && stats.durationDays > 0 && (
              <div>
                <dt>Döküm süresi</dt>
                <dd>{stats.durationDays} gün</dd>
              </div>
            )}
            <div>
              <dt>Karşılaştırma</dt>
              <dd className="stat-text">{SCAB_TIMING[stats.timing!]}</dd>
            </div>
          </dl>
        ) : (
          <p className="muted">
            {stats.status === 'suruyor'
              ? `Döküm ${stats.startDay}. günde başladı, ${stats.runningDays} gündür sürüyor.`
              : `Kabuklar çoğunlukla ${TYPICAL_SCAB_END.from}–${TYPICAL_SCAB_END.to}. günlerde dökülür.`}
            {stats.overdue && ' 14. gün geçti, kabuklar hâlâ duruyorsa kliniğine sor.'}
          </p>
        )}

        <div className="field-row">
          <label className="field">
            <span>Döküm başladı</span>
            <input
              type="date"
              value={scabs.start ?? ''}
              min={surgeryDate}
              max={today}
              onChange={(event) => actions.saveScabs({ ...scabs, start: event.target.value || null })}
            />
          </label>
          <label className="field">
            <span>Tamamen döküldü</span>
            <input
              type="date"
              value={scabs.end ?? ''}
              min={scabs.start ?? surgeryDate}
              max={today}
              onChange={(event) => actions.saveScabs({ ...scabs, end: event.target.value || null })}
            />
          </label>
        </div>
        {invalid && <p className="field-error">Bitiş tarihi başlangıçtan önce olamaz.</p>}
      </section>
    </Reveal>
  )
}

export function Care() {
  return (
    <div className="page stack">
      <header className="page-head">
        <h1>Bakım</h1>
      </header>
      <Washes />
      <Scabs />
      <p className="muted">Yıkama sıklığını kliniğinin talimatına göre sürdür. Buradaki sayılar öneri değil, kendi kaydındır.</p>
    </div>
  )
}
