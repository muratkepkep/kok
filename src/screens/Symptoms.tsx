import { Phone, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Reveal, SubHead } from '../components/fx'
import { addDays, fmtDayShort, fmtFull } from '../domain/dates'
import { needsAttention, RED_FLAGS, SYMPTOM_LEVELS, SYMPTOMS, symptomTrend } from '../domain/symptoms'
import type { SymptomLog } from '../domain/types'
import { tapLight } from '../haptics'
import { actions, useAppState, useToday } from '../store'

const EMPTY: SymptomLog = { scores: {}, flags: [], note: '' }
const TREND_DAYS = 14

export function Symptoms() {
  const state = useAppState()
  const today = useToday()
  const [date, setDate] = useState(today)
  const log = state.symptoms[date] ?? EMPTY
  const surgery = state.surgery!

  const save = (change: Partial<SymptomLog>) => actions.saveSymptoms(date, { ...log, ...change })

  const toggleFlag = (flag: string) => {
    tapLight()
    save({ flags: log.flags.includes(flag) ? log.flags.filter((item) => item !== flag) : [...log.flags, flag] })
  }

  return (
    <div className="page stack">
      <SubHead title="Belirtiler" />

      <Reveal>
        <label className="field">
          <span>{fmtFull(date)}</span>
          <input
            type="date"
            value={date}
            min={surgery.date}
            max={today}
            onChange={(event) => setDate(event.target.value || today)}
          />
        </label>
      </Reveal>

      {needsAttention(log) && (
        <Reveal>
          <div className="alert" role="alert">
            <ShieldAlert size={22} aria-hidden />
            <div>
              <strong>Kliniğine danış</strong>
              <span>Durum ağırsa veya hızla kötüleşiyorsa en yakın sağlık kuruluşuna başvur.</span>
            </div>
            {surgery.clinicPhone && (
              <a className="round-button round-accent" href={`tel:${surgery.clinicPhone}`} aria-label="Kliniği ara">
                <Phone size={18} aria-hidden />
              </a>
            )}
          </div>
        </Reveal>
      )}

      <Reveal i={1}>
        <section className="card">
          <h2>Bugün nasılsın?</h2>
          <div className="symptom-list">
            {SYMPTOMS.map((name) => (
              <fieldset key={name} className="symptom-row">
                <legend>{name}</legend>
                <div className="level-picker">
                  {SYMPTOM_LEVELS.map((level, score) => (
                    <button
                      key={level}
                      type="button"
                      data-level={score}
                      aria-pressed={(log.scores[name] ?? 0) === score}
                      onClick={() => {
                        tapLight()
                        save({ scores: { ...log.scores, [name]: score } })
                      }}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal i={2}>
        <section className="card card-danger">
          <h2>Acil işaretler</h2>
          <p className="muted">Bunlardan biri varsa beklemeden kliniğini ara.</p>
          <div className="chips">
            {RED_FLAGS.map((flag) => (
              <button
                key={flag}
                type="button"
                className="chip chip-danger"
                aria-pressed={log.flags.includes(flag)}
                onClick={() => toggleFlag(flag)}
              >
                {flag}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Not</span>
            <textarea rows={2} value={log.note} onChange={(event) => save({ note: event.target.value })} />
          </label>
        </section>
      </Reveal>

      <Reveal i={3}>
        <section className="card">
          <h2>Son 14 gün</h2>
          <div className="scroll-x">
            <table className="trend">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Belirti</span>
                  </th>
                  <th scope="col" colSpan={TREND_DAYS}>
                    {fmtDayShort(addDays(today, -(TREND_DAYS - 1)))} – {fmtDayShort(today)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {SYMPTOMS.map((name) => (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    {symptomTrend(state.symptoms, name, TREND_DAYS, today).map(({ date: day, score }) => (
                      <td key={day}>
                        <i data-level={score ?? undefined} />
                        <span className="visually-hidden">
                          {fmtDayShort(day)}: {score === null ? 'kayıt yok' : SYMPTOM_LEVELS[score]}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </Reveal>
    </div>
  )
}
