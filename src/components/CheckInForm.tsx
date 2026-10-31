import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { fmtFull } from '../domain/dates'
import { sortedCheckIns } from '../domain/efficacy'
import { fmtScore } from '../domain/format'
import { dayNumber, expectedAt, weekNumber } from '../domain/timeline'
import { PHOTO_ANGLES, SHEDDING_LEVELS, SIDE_EFFECTS, type CheckIn, type ISODate, type PhotoAngle } from '../domain/types'
import { deletePhoto, savePhoto, usePhotoUrl } from '../photos'
import { actions, useAppState, useToday } from '../store'
import { Sheet } from './Sheet'

interface Props {
  surgeryDate: ISODate
  entry: CheckIn | null
  defaultDate?: ISODate
  onClose: () => void
}

function PhotoThumb({
  id,
  angle,
  onAngle,
  onRemove,
}: {
  id: string
  angle: PhotoAngle
  onAngle: (angle: PhotoAngle) => void
  onRemove: () => void
}) {
  const url = usePhotoUrl(id)
  return (
    <div className="photo-thumb">
      {url && <img src={url} alt="Ölçüme eklenen fotoğraf" />}
      <button type="button" className="icon-button" aria-label="Fotoğrafı kaldır" onClick={onRemove}>
        <Trash2 size={16} />
      </button>
      <select aria-label="Çekim açısı" value={angle} onChange={(event) => onAngle(event.target.value as PhotoAngle)}>
        {PHOTO_ANGLES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
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
  const [photoAngles, setPhotoAngles] = useState(entry?.photoAngles ?? {})
  const [nextAngle, setNextAngle] = useState<PhotoAngle>('Ön')
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
        setPhotoAngles((angles) => ({ ...angles, [id]: nextAngle }))
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
      photoAngles: Object.fromEntries(photoIds.map((id) => [id, photoAngles[id] ?? 'Diğer'])),
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
          <div className="chips" role="group" aria-label="Eklenecek fotoğrafın açısı">
            {PHOTO_ANGLES.map((item) => (
              <button
                key={item}
                type="button"
                className="chip chip-small"
                aria-pressed={nextAngle === item}
                onClick={() => setNextAngle(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="photo-row">
            {photoIds.map((id) => (
              <PhotoThumb
                key={id}
                id={id}
                angle={photoAngles[id] ?? 'Diğer'}
                onAngle={(angle) => setPhotoAngles((angles) => ({ ...angles, [id]: angle }))}
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
            <small>Önce açıyı seç. Her hafta aynı açı ve ışıkta çekersen Foto kıyası daha doğru çalışır.</small>
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
