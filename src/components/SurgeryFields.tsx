import { fmtInt } from '../domain/format'
import { AREAS, TECHNIQUES, type Surgery } from '../domain/types'

interface Props {
  value: Surgery
  onChange: (next: Surgery) => void
}

export function SurgeryFields({ value, onChange }: Props) {
  const set = <K extends keyof Surgery>(key: K, next: Surgery[K]) => onChange({ ...value, [key]: next })

  const toggleArea = (area: string) =>
    set(
      'areas',
      value.areas.includes(area) ? value.areas.filter((item) => item !== area) : [...value.areas, area],
    )

  const setAreaGrafts = (area: string, text: string) => {
    const { [area]: _removed, ...rest } = value.graftMap
    set('graftMap', text === '' ? rest : { ...rest, [area]: Number(text) })
  }

  const mapped = Object.values(value.graftMap).reduce((sum, count) => sum + count, 0)

  return (
    <>
      <div className="field-row">
        <label className="field">
          <span>Ameliyat tarihi</span>
          <input
            type="date"
            value={value.date}
            required
            onChange={(event) => set('date', event.target.value)}
          />
        </label>
        <label className="field">
          <span>Ekilen greft sayısı</span>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="Örneğin 3200"
            value={value.graftCount ?? ''}
            onChange={(event) =>
              set('graftCount', event.target.value === '' ? null : Number(event.target.value))
            }
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Klinik</span>
          <input value={value.clinic} onChange={(event) => set('clinic', event.target.value)} />
        </label>
        <label className="field">
          <span>Klinik telefonu</span>
          <input
            type="tel"
            inputMode="tel"
            value={value.clinicPhone}
            onChange={(event) => set('clinicPhone', event.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Doktor</span>
          <input value={value.doctor} onChange={(event) => set('doctor', event.target.value)} />
        </label>
        <label className="field">
          <span>Şehir</span>
          <input value={value.city} onChange={(event) => set('city', event.target.value)} />
        </label>
      </div>

      <fieldset className="field">
        <legend>Teknik</legend>
        <div className="segmented">
          {TECHNIQUES.map((technique) => (
            <button
              key={technique}
              type="button"
              aria-pressed={value.technique === technique}
              onClick={() => set('technique', technique)}
            >
              {technique}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Ekim bölgesi</legend>
        <div className="chips">
          {AREAS.map((area) => (
            <button
              key={area}
              type="button"
              className="chip"
              aria-pressed={value.areas.includes(area)}
              onClick={() => toggleArea(area)}
            >
              {area}
            </button>
          ))}
        </div>
        {value.areas.length > 0 && (
          <div className="field-row graft-map">
            {value.areas.map((area) => (
              <label key={area} className="field">
                <span>{area}, greft</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={value.graftMap[area] ?? ''}
                  onChange={(event) => setAreaGrafts(area, event.target.value)}
                />
              </label>
            ))}
          </div>
        )}
        {mapped > 0 && value.graftCount !== null && mapped !== value.graftCount && (
          <small>
            Bölgelerin toplamı {fmtInt(mapped)}, toplam greft {fmtInt(value.graftCount)}.
          </small>
        )}
      </fieldset>

      <label className="field">
        <span>Not</span>
        <textarea rows={2} value={value.note} onChange={(event) => set('note', event.target.value)} />
      </label>
    </>
  )
}
