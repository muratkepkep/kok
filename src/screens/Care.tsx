import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { WashGapChart } from '../components/Charts'
import { scabStats, TYPICAL_SCAB_END, washStats } from '../domain/care'
import { fmtDay } from '../domain/dates'
import { fmtDecimal } from '../domain/format'
import { weekNumber } from '../domain/timeline'
import { actions, useAppState, useToday } from '../store'

const RECENT_WASHES = 8

const SCAB_TIMING = {
  erken: 'Genel aralıktan erken',
  tipik: 'Genel aralıkta',
  gec: 'Genel aralıktan geç',
}

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
    <section className="section">
      <h2>Saç yıkama</h2>
      <dl className="figures">
        <div>
          <dt>İlk yıkama</dt>
          <dd>{stats.firstDay === null ? '–' : `${stats.firstDay}. gün`}</dd>
        </div>
        <div>
          <dt>Ortalama aralık</dt>
          <dd>{stats.averageGap === null ? '–' : `${fmtDecimal(stats.averageGap)} gün`}</dd>
        </div>
        <div>
          <dt>İlk 14 gün</dt>
          <dd>{stats.earlyAverageGap === null ? '–' : `${fmtDecimal(stats.earlyAverageGap)} gün`}</dd>
        </div>
        <div>
          <dt>Sonrası</dt>
          <dd>{stats.lateAverageGap === null ? '–' : `${fmtDecimal(stats.lateAverageGap)} gün`}</dd>
        </div>
        <div>
          <dt>En uzun ara</dt>
          <dd>{stats.longestGap === null ? '–' : `${stats.longestGap} gün`}</dd>
        </div>
        <div>
          <dt>Toplam</dt>
          <dd>{stats.count}</dd>
        </div>
      </dl>

      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          actions.addWash(date, note.trim())
          setNote('')
        }}
      >
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
        <label className="field inline-grow">
          <span>Not</span>
          <input
            value={note}
            placeholder="Örneğin klinikte yapıldı"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <button type="submit" className="button" disabled={duplicate}>
          {duplicate ? 'Bu gün kayıtlı' : 'Yıkama ekle'}
        </button>
      </form>

      {stats.averageGap !== null ? (
        <>
          <h3>Haftalara göre ortalama yıkama aralığı, gün</h3>
          <WashGapChart rows={stats.rows} currentWeek={weekNumber(surgeryDate, today)} />
        </>
      ) : (
        <p className="empty">İki yıkama girdikten sonra aralıkların grafiği burada görünür.</p>
      )}

      {rows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Tarih</th>
              <th scope="col">Ameliyattan sonra</th>
              <th scope="col">Önceki yıkamadan</th>
              <th scope="col">Not</th>
              <th scope="col">
                <span className="visually-hidden">Sil</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{fmtDay(row.date)}</td>
                <td className="num">{row.day}. gün</td>
                <td className="num">{row.gap === null ? 'İlk yıkama' : `${row.gap} gün`}</td>
                <td>{row.note}</td>
                <td>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${fmtDay(row.date)} yıkamasını sil`}
                    onClick={() => actions.removeWash(row.date)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows.length < newestFirst.length && (
        <button type="button" className="button-quiet" onClick={() => setShowAll(true)}>
          Tüm yıkamaları göster ({newestFirst.length})
        </button>
      )}
    </section>
  )
}

function Scabs() {
  const state = useAppState()
  const today = useToday()
  const surgeryDate = state.surgery!.date
  const scabs = state.scabs
  const stats = scabStats(surgeryDate, scabs, today)
  const invalid = scabs.start && scabs.end && scabs.end < scabs.start

  return (
    <section className="section">
      <h2>Kabuk dökümü</h2>
      {stats.status === 'tamam' ? (
        <dl className="figures">
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
            <dd>{SCAB_TIMING[stats.timing!]}</dd>
          </div>
        </dl>
      ) : (
        <p className="section-note">
          {stats.status === 'suruyor'
            ? `Döküm ${stats.startDay}. günde başladı, ${stats.runningDays} gündür sürüyor.`
            : `Kabuklar çoğunlukla ${TYPICAL_SCAB_END.from}–${TYPICAL_SCAB_END.to}. günlerde dökülür.`}
          {stats.overdue && ' 14. gün geçti, kabuklar hâlâ duruyorsa kliniğine sor.'}
        </p>
      )}

      <div className="field-row scab-fields">
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
  )
}

export function Care() {
  return (
    <>
      <header className="page-head">
        <h1>Bakım</h1>
      </header>
      <p className="lead">Yıkama sıklığını kliniğinin verdiği talimata göre sürdür. Buradaki sayılar öneri değil, kendi kaydındır.</p>
      <div className="split split-care">
        <Washes />
        <Scabs />
      </div>
    </>
  )
}
