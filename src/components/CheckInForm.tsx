import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { fmtFull } from '../domain/dates'
import { sortedCheckIns } from '../domain/efficacy'
import { fmtScore } from '../domain/format'
import { dayNumber, expectedAt, weekNumber } from '../domain/timeline'
import { SHEDDING_LEVELS, SIDE_EFFECTS, type CheckIn, type ISODate } from '../domain/types'
import { deletePhoto, savePhoto, usePhotoUrl } from '../photos'
import { actions, useAppState, useToday } from '../store'
import { Sheet } from './Sheet'

interface Props {
  surgeryDate: ISODate
  entry: CheckIn | null
  defaultDate?: ISODate
  onClose: () => void
}

function PhotoThumb({ id, onRemove }: { id: string; onRemove: () => void }) {
  const url = usePhotoUrl(id)
  return (
    <div className="photo-thumb">
      {url && <img src={url} alt="Ölçüme eklenen fotoğraf" />}
      <button type="button" className="icon-button" aria-label="Fotoğrafı kaldır" onClick={onRemove}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}

export function CheckInForm({ surgeryDate, entry, defaultDate, onClose }: Props) {
  const today = useToday()
  const { checkIns } = useAppState()
  const [date, setDate] = useState(entry?.date ?? defaultDate ?? today)
  // Kaydırıcı dokunulmadan kalırsa ölçüm sıfır değil, son bilinen değer olarak kaydedilir.
  const [fullness, setFullness] = useState(entry?.fullness ?? sortedCheckIns(checkIns).at(-1)?.fullness ?? 0)
  const [shedding, setShedding] = useState(entry?.shedding ?? 0)
  const [density, setDensity] = useState(entry?.density?.toString() ?? '')
  const [sideEffects, setSideEffects] = useState(entry?.sideEffects ?? [])
  const [note, setNote] = useState(entry?.note ?? '')
  const [photoIds, setPhotoIds] = useState(entry?.photoIds ?? [])
  const [photoError, setPhotoError] = useState('')
  const added = useRef<string[]>([])

  const band = expectedAt(dayNumber(surgeryDate, date))
  const validDate = date >= surgeryDate && date <= today

  const toggleEffect = (effect: string) =>
    setSideEffects((items) =>
      items.includes(effect) ? items.filter((item) => item !== effect) : [...items, effect],
    )

  const addPhotos = async (files: FileList | null) => {
    setPhotoError('')
    try {
      for (const file of Array.from(files ?? [])) {
        const id = await savePhoto(file)
        added.current.push(id)
        setPhotoIds((ids) => [...ids, id])
      }
    } catch {
      setPhotoError('Fotoğraf eklenemedi. JPEG veya PNG bir dosya dene.')
    }
  }

  // Fotoğraf silme kayıtla kesinleşir; vazgeçilirse eski fotoğraflar yerinde kalır.
  const discard = () => {
    added.current.forEach((id) => void deletePhoto(id))
    onClose()
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    const dropped = [...(entry?.photoIds ?? []), ...added.current].filter((id) => !photoIds.includes(id))
    dropped.forEach((id) => void deletePhoto(id))
    const parsedDensity = Number(density.replace(',', '.'))
    actions.saveCheckIn({
      id: entry?.id,
      date,
      fullness,
      shedding,
      density: density.trim() && Number.isFinite(parsedDensity) ? parsedDensity : null,
      sideEffects,
      note: note.trim(),
      photoIds,
    })
    onClose()
  }

  return (
    <Sheet title={entry ? 'Ölçümü düzenle' : 'Ölçüm ekle'} onClose={discard}>
      <form className="form" onSubmit={save}>
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
          {validDate ? (
            <small>
              {dayNumber(surgeryDate, date)}. gün, {weekNumber(surgeryDate, date)}. hafta
            </small>
          ) : (
            <small className="field-error">
              {fmtFull(surgeryDate)} ile bugün arasında bir tarih seç.
            </small>
          )}
        </label>

        <div className="field">
          <label htmlFor="doluluk">
            Beklediğin son hâle göre neredesin? <strong>{fmtScore(fullness)}</strong>
          </label>
          <input
            id="doluluk"
            type="range"
            min={0}
            max={100}
            step={5}
            value={fullness}
            onChange={(event) => setFullness(Number(event.target.value))}
          />
          <small>
            Bu dönemde genelde {fmtScore(Math.round(band.low))} ile {fmtScore(Math.round(band.high))} arası görülür.
          </small>
        </div>

        <fieldset className="field">
          <legend>Dökülme</legend>
          <div className="segmented">
            {SHEDDING_LEVELS.map((level, index) => (
              <button
                key={level}
                type="button"
                aria-pressed={shedding === index}
                onClick={() => setShedding(index)}
              >
                {level}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Yoğunluk, kıl/cm² (ölçtürdüysen)</span>
          <input
            inputMode="decimal"
            value={density}
            placeholder="Örneğin 42"
            onChange={(event) => setDensity(event.target.value)}
          />
        </label>

        <fieldset className="field">
          <legend>Yan etki veya şikâyet</legend>
          <div className="chips">
            {SIDE_EFFECTS.map((effect) => (
              <button
                key={effect}
                type="button"
                className="chip"
                aria-pressed={sideEffects.includes(effect)}
                onClick={() => toggleEffect(effect)}
              >
                {effect}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Not</span>
          <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>

        <div className="field">
          <span>Fotoğraf</span>
          <div className="photo-row">
            {photoIds.map((id) => (
              <PhotoThumb
                key={id}
                id={id}
                onRemove={() => setPhotoIds((ids) => ids.filter((item) => item !== id))}
              />
            ))}
            <label className="photo-add">
              <Camera size={20} />
              <span>Fotoğraf ekle</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => {
                  void addPhotos(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
          {photoError ? (
            <small className="field-error">{photoError}</small>
          ) : (
            <small>Her seferinde aynı açı ve ışıkta çekersen karşılaştırma kolaylaşır.</small>
          )}
        </div>

        <div className="form-actions">
          {entry && (
            <button
              type="button"
              className="button-quiet"
              onClick={() => {
                if (window.confirm('Bu ölçüm silinsin mi?')) {
                  entry.photoIds.forEach((id) => void deletePhoto(id))
                  actions.deleteCheckIn(entry.id)
                  discard()
                }
              }}
            >
              Ölçümü sil
            </button>
          )}
          <button type="submit" className="button" disabled={!validDate}>
            Ölçümü kaydet
          </button>
        </div>
      </form>
    </Sheet>
  )
}
