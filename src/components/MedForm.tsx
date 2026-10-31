import { useState } from 'react'
import { activePlan, isStopped, withPlan } from '../domain/adherence'
import { fmtFull } from '../domain/dates'
import type { ISODate, Medication } from '../domain/types'
import { actions, useToday } from '../store'
import { Sheet } from './Sheet'

export const MED_PRESETS = [
  { name: 'Minoksidil', kind: 'ilac', dose: '%5 köpük veya solüsyon', timesPerDay: 2, everyNDays: 1 },
  { name: 'Finasterid', kind: 'ilac', dose: '1 mg tablet', timesPerDay: 1, everyNDays: 1 },
  { name: 'Biotin', kind: 'takviye', dose: '', timesPerDay: 1, everyNDays: 1 },
] as const

const INTERVALS = [
  { value: 1, label: 'Her gün' },
  { value: 2, label: 'Gün aşırı' },
  { value: 3, label: '3 günde bir' },
  { value: 7, label: 'Haftada bir' },
]

interface Props {
  med: Medication | null
  onClose: () => void
}

export function MedForm({ med, onClose }: Props) {
  const today = useToday()
  const current = med ? activePlan(med) : null
  const stopped = med ? isStopped(med) : false
  const [name, setName] = useState(med?.name ?? '')
  const [kind, setKind] = useState<Medication['kind']>(med?.kind ?? 'ilac')
  const [dose, setDose] = useState(med?.dose ?? '')
  const [timesPerDay, setTimesPerDay] = useState(current?.timesPerDay ?? 1)
  const [everyNDays, setEveryNDays] = useState(current?.everyNDays ?? 1)
  const [start, setStart] = useState<ISODate>(med?.schedule[0].from ?? today)

  const startLocked = (med?.schedule.length ?? 1) > 1
  const planChanged =
    !!current && (current.timesPerDay !== timesPerDay || current.everyNDays !== everyNDays)

  const applyPreset = (preset: (typeof MED_PRESETS)[number]) => {
    setName(preset.name)
    setKind(preset.kind)
    setDose(preset.dose)
    setTimesPerDay(preset.timesPerDay)
    setEveryNDays(preset.everyNDays)
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const fields = { name: name.trim(), kind, dose: dose.trim() }
    if (!med) {
      actions.newMed({
        ...fields,
        schedule: [{ from: start, timesPerDay, everyNDays }],
      })
    } else {
      const schedule = med.schedule.map((entry, index) => (index === 0 ? { ...entry, from: start } : entry))
      actions.saveMed({
        ...med,
        ...fields,
        schedule: planChanged ? withPlan(schedule, { timesPerDay, everyNDays }, today) : schedule,
      })
    }
    onClose()
  }

  return (
    <Sheet title={med ? `${med.name} düzenle` : 'İlaç veya takviye ekle'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        {!med && (
          <div className="chips">
            {MED_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="chip"
                aria-pressed={name === preset.name}
                onClick={() => applyPreset(preset)}
              >
                {preset.name}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Ad</span>
          <input value={name} required onChange={(event) => setName(event.target.value)} />
        </label>

        <fieldset className="field">
          <legend>Tür</legend>
          <div className="segmented">
            <button type="button" aria-pressed={kind === 'ilac'} onClick={() => setKind('ilac')}>
              İlaç
            </button>
            <button type="button" aria-pressed={kind === 'takviye'} onClick={() => setKind('takviye')}>
              Takviye
            </button>
          </div>
        </fieldset>

        <label className="field">
          <span>Doz</span>
          <input
            value={dose}
            placeholder="Örneğin 1 mg tablet"
            onChange={(event) => setDose(event.target.value)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Sıklık</span>
            <select
              value={everyNDays}
              disabled={stopped}
              onChange={(event) => setEveryNDays(Number(event.target.value))}
            >
              {INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>O gün kaç kez</span>
            <select
              value={timesPerDay}
              disabled={stopped}
              onChange={(event) => setTimesPerDay(Number(event.target.value))}
            >
              {[1, 2, 3, 4].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Başlangıç tarihi</span>
          <input
            type="date"
            value={start}
            required
            disabled={startLocked}
            onChange={(event) => setStart(event.target.value)}
          />
          <small>
            {startLocked
              ? `${fmtFull(med!.schedule[0].from)} tarihinde başladı.`
              : 'Doktorunun söylediği başlangıç tarihini gir. Uyum bu tarihten itibaren sayılır.'}
          </small>
        </label>

        {planChanged && (
          <p className="form-note">Yeni plan bugünden başlar, geçmiş günlerin uyum oranı değişmez.</p>
        )}

        <div className="form-actions">
          <button type="submit" className="button">
            {med ? 'Değişiklikleri kaydet' : 'İlacı ekle'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
