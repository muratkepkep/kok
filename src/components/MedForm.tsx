import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { activePlan, doseStep, isStopped, SLOT_NAMES, WEEKDAY_SHORT, withPlan } from '../domain/adherence'
import { MED_CATALOG, type CatalogItem } from '../domain/catalog'
import { addDays, fmtFull } from '../domain/dates'
import { DEFAULT_SLOT_TIMES } from '../domain/migrate'
import { DOSE_UNITS, type DoseUnit, type ISODate, type Medication, type MedKind, type StockLog } from '../domain/types'
import { actions, useToday } from '../store'
import { Stepper } from './fx'
import { Sheet } from './Sheet'

const INTERVALS = [
  { value: 1, label: 'Her gün' },
  { value: 2, label: 'Gün aşırı' },
  { value: 3, label: '3 günde bir' },
  { value: 7, label: 'Haftada bir' },
  { value: 0, label: 'Belirli günler' },
]

const COURSE_DAYS = [5, 7, 10, 14, 30]
const KINDS: { value: MedKind; label: string }[] = [
  { value: 'ilac', label: 'İlaç' },
  { value: 'takviye', label: 'Takviye' },
  { value: 'bakim', label: 'Bakım' },
]

interface Props {
  med: Medication | null
  onClose: () => void
}

export function MedForm({ med, onClose }: Props) {
  const today = useToday()
  const current = med ? activePlan(med) : null
  const stopped = med ? isStopped(med) : false

  const [query, setQuery] = useState('')
  const [name, setName] = useState(med?.name ?? '')
  const [kind, setKind] = useState<MedKind>(med?.kind ?? 'ilac')
  const [dose, setDose] = useState(med?.dose ?? '')
  const [unit, setUnit] = useState<DoseUnit>(med?.unit ?? 'mg')
  const [amount, setAmount] = useState<number | null>(current?.amount ?? null)
  const [timesPerDay, setTimesPerDay] = useState(current?.timesPerDay ?? 1)
  const [interval, setIntervalDays] = useState(current?.weekdays?.length ? 0 : (current?.everyNDays ?? 1))
  const [weekdays, setWeekdays] = useState<number[]>(current?.weekdays ?? [])
  const [times, setTimes] = useState<string[]>(med?.slotTimes ?? DEFAULT_SLOT_TIMES[1])
  const [start, setStart] = useState<ISODate>(med?.schedule[0].from ?? today)
  const [endDate, setEndDate] = useState<ISODate | null>(med?.endDate ?? null)
  const [hasStock, setHasStock] = useState(!!med?.stock)
  const [units, setUnits] = useState(med?.stock?.units ?? 30)
  const [perDose, setPerDose] = useState(med?.stock?.perDose ?? 1)
  const [alertDays, setAlertDays] = useState(med?.stock?.alertDays ?? 7)
  const [note, setNote] = useState(med?.note ?? '')

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr-TR')
    return MED_CATALOG.map((group) => ({
      ...group,
      items: group.items.filter((item) => !needle || item.name.toLocaleLowerCase('tr-TR').includes(needle)),
    })).filter((group) => group.items.length)
  }, [query])

  const startLocked = (med?.schedule.length ?? 1) > 1
  const planChanged =
    !!current &&
    (current.timesPerDay !== timesPerDay ||
      (interval === 0 ? (current.weekdays ?? []).join() !== weekdays.join() : current.everyNDays !== interval || !!current.weekdays?.length) ||
      current.amount !== amount)

  const applyCatalog = (item: CatalogItem) => {
    setName(item.name)
    setKind(item.kind)
    setDose(item.dose)
    setUnit(item.unit)
    setTimesPerDay(item.timesPerDay)
    setTimes(DEFAULT_SLOT_TIMES[item.timesPerDay])
    setQuery('')
  }

  const changeCount = (count: number) => {
    setTimesPerDay(count)
    setTimes((old) => DEFAULT_SLOT_TIMES[count].map((time, index) => old[index] ?? time))
  }

  const toggleDay = (day: number) =>
    setWeekdays((days) => (days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort((a, b) => a - b)))

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const plan = {
      timesPerDay,
      everyNDays: interval === 0 ? 1 : interval,
      weekdays: interval === 0 ? weekdays : null,
      amount,
    }
    const stock: StockLog | null = hasStock
      ? {
          // Adet değişmediyse başlangıç korunur, yoksa alınan dozlar yeniden düşülür.
          from: med?.stock && med.stock.units === units ? med.stock.from : today,
          units,
          perDose,
          alertDays,
        }
      : null
    const fields = {
      name: name.trim(),
      kind,
      dose: dose.trim(),
      unit,
      slotTimes: times,
      endDate,
      stock,
      note: note.trim(),
    }
    if (!med) {
      actions.newMed({ ...fields, schedule: [{ from: start, ...plan }] })
    } else {
      const schedule = med.schedule.map((entry, index) => (index === 0 ? { ...entry, from: start } : entry))
      actions.saveMed({ ...med, ...fields, schedule: planChanged ? withPlan(schedule, plan, today) : schedule })
    }
    onClose()
  }

  const dayMissing = interval === 0 && weekdays.length === 0

  return (
    <Sheet title={med ? `${med.name} düzenle` : 'İlaç veya takviye ekle'} onClose={onClose}>
      <form className="form" onSubmit={save}>
        {!med && (
          <div className="catalog">
            <label className="search-field">
              <Search size={17} aria-hidden />
              <span className="visually-hidden">Listede ara</span>
              <input value={query} placeholder="Listede ara" onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="catalog-list">
              {results.map((group) => (
                <div key={group.title}>
                  <h3>{group.title}</h3>
                  <div className="chips">
                    {group.items.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className="chip"
                        aria-pressed={name === item.name}
                        onClick={() => applyCatalog(item)}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span>Ad</span>
          <input value={name} required placeholder="Listede yoksa adını yaz" onChange={(event) => setName(event.target.value)} />
        </label>

        <fieldset className="field">
          <legend>Tür</legend>
          <div className="segmented">
            {KINDS.map((item) => (
              <button key={item.value} type="button" aria-pressed={kind === item.value} onClick={() => setKind(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Doz</legend>
          <small>Doktorunun yazdığı miktarı gir. Değiştirirsen eski doz geçmişte kalır.</small>
          <div className="dose-row">
            <Stepper value={amount ?? 0} step={doseStep(unit)} label="Doz" onChange={setAmount} />
            <input
              className="dose-input"
              inputMode="decimal"
              aria-label="Doz miktarı"
              value={amount ?? ''}
              placeholder="Miktar"
              onChange={(event) => {
                const parsed = Number(event.target.value.replace(',', '.'))
                setAmount(event.target.value === '' || Number.isNaN(parsed) ? null : parsed)
              }}
            />
          </div>
          <div className="chips">
            {DOSE_UNITS.map((item) => (
              <button key={item} type="button" className="chip chip-small" aria-pressed={unit === item} onClick={() => setUnit(item)}>
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Form</span>
          <input value={dose} placeholder="Örneğin %5 köpük, film tablet" onChange={(event) => setDose(event.target.value)} />
        </label>

        <fieldset className="field" disabled={stopped}>
          <legend>Sıklık</legend>
          <div className="segmented">
            {INTERVALS.map((item) => (
              <button key={item.value} type="button" aria-pressed={interval === item.value} onClick={() => setIntervalDays(item.value)}>
                {item.label}
              </button>
            ))}
          </div>
          {interval === 0 && (
            <div className="weekday-row">
              {WEEKDAY_SHORT.map((label, day) => (
                <button key={label} type="button" aria-pressed={weekdays.includes(day)} onClick={() => toggleDay(day)}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {dayMissing && <small className="field-error">En az bir gün seç.</small>}
        </fieldset>

        <fieldset className="field" disabled={stopped}>
          <legend>O gün kaç kez, hangi saatte?</legend>
          <div className="segmented">
            {[1, 2, 3, 4].map((count) => (
              <button key={count} type="button" aria-pressed={timesPerDay === count} onClick={() => changeCount(count)}>
                {count} kez
              </button>
            ))}
          </div>
          <div className="time-row">
            {times.slice(0, timesPerDay).map((time, index) => (
              <label key={index} className="field">
                <span>{timesPerDay === 1 ? 'Hatırlatma' : SLOT_NAMES[timesPerDay][index]}</span>
                <input
                  type="time"
                  value={time}
                  required
                  onChange={(event) => setTimes((old) => old.map((item, slot) => (slot === index ? event.target.value : item)))}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <label className="field">
            <span>Başlangıç</span>
            <input type="date" value={start} required disabled={startLocked} onChange={(event) => setStart(event.target.value)} />
            {startLocked && <small>{fmtFull(med!.schedule[0].from)}</small>}
          </label>
          <label className="field">
            <span>Bitiş (kürse)</span>
            <input type="date" value={endDate ?? ''} min={start} onChange={(event) => setEndDate(event.target.value || null)} />
          </label>
        </div>
        <div className="chips">
          {COURSE_DAYS.map((days) => (
            <button key={days} type="button" className="chip chip-small" onClick={() => setEndDate(addDays(start, days - 1))}>
              {days} gün
            </button>
          ))}
          {endDate && (
            <button type="button" className="chip chip-small" onClick={() => setEndDate(null)}>
              Sürekli
            </button>
          )}
        </div>

        <fieldset className="field">
          <legend>Stok takibi</legend>
          <div className="segmented">
            <button type="button" aria-pressed={!hasStock} onClick={() => setHasStock(false)}>
              Kapalı
            </button>
            <button type="button" aria-pressed={hasStock} onClick={() => setHasStock(true)}>
              Açık
            </button>
          </div>
          {hasStock && (
            <div className="stock-grid">
              <div className="field">
                <span>Eldeki miktar ({unit})</span>
                <Stepper value={units} step={unit === 'ml' ? 10 : 5} min={1} label="Eldeki miktar" onChange={setUnits} />
              </div>
              <div className="field">
                <span>Doz başına harcanan</span>
                <Stepper value={perDose} step={unit === 'ml' ? 0.5 : 1} min={0.5} label="Doz başına" onChange={setPerDose} />
              </div>
              <div className="field">
                <span>Kaç gün kala uyarsın?</span>
                <Stepper value={alertDays} step={1} min={1} label="Uyarı günü" onChange={setAlertDays} />
              </div>
            </div>
          )}
        </fieldset>

        <label className="field">
          <span>Not</span>
          <textarea rows={2} value={note} placeholder="Örneğin yemekten sonra" onChange={(event) => setNote(event.target.value)} />
        </label>

        {planChanged && <p className="form-note">Yeni plan bugünden başlar, geçmiş günlerin uyum oranı değişmez.</p>}

        <div className="form-actions">
          <button type="submit" className="button" disabled={dayMissing || !name.trim()}>
            {med ? 'Değişiklikleri kaydet' : 'İlacı ekle'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
