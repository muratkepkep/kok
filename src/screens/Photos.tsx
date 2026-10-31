import { Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Press, Reveal, Segmented, SubHead } from '../components/fx'
import { fmtFull } from '../domain/dates'
import { sortedCheckIns } from '../domain/efficacy'
import { dayNumber } from '../domain/timeline'
import { PHOTO_ANGLES, type PhotoAngle } from '../domain/types'
import { usePhotoUrl } from '../photos'
import { useAppState } from '../store'

interface Shot {
  id: string
  date: string
  day: number
  angle: PhotoAngle
}

function Compare({ before, after }: { before: Shot; after: Shot }) {
  const [split, setSplit] = useState(50)
  const beforeUrl = usePhotoUrl(before.id)
  const afterUrl = usePhotoUrl(after.id)

  return (
    <div className="compare">
      <div className="compare-stage">
        {afterUrl && <img src={afterUrl} alt={`${after.day}. gün fotoğrafı`} />}
        {beforeUrl && (
          <img
            src={beforeUrl}
            alt={`${before.day}. gün fotoğrafı`}
            style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          />
        )}
        <span className="compare-line" style={{ left: `${split}%` }} aria-hidden />
        <span className="compare-tag compare-tag-a">{before.day}. gün</span>
        <span className="compare-tag compare-tag-b">{after.day}. gün</span>
      </div>
      <label className="field">
        <span className="visually-hidden">Karşılaştırma çizgisi</span>
        <input type="range" min={0} max={100} value={split} onChange={(event) => setSplit(Number(event.target.value))} />
      </label>
    </div>
  )
}

function Frame({ shot }: { shot: Shot }) {
  const url = usePhotoUrl(shot.id)
  return (
    <div className="compare-stage">
      {url && <img src={url} alt={`${shot.day}. gün fotoğrafı`} />}
      <span className="compare-tag compare-tag-a">{shot.day}. gün</span>
    </div>
  )
}

export function Photos() {
  const state = useAppState()
  const surgeryDate = state.surgery!.date
  const [chosen, setAngle] = useState<PhotoAngle | null>(null)
  const [fromIndex, setFromIndex] = useState(0)
  const [toIndex, setToIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [frame, setFrame] = useState(0)

  const shots = useMemo<Shot[]>(
    () =>
      sortedCheckIns(state.checkIns).flatMap((entry) =>
        entry.photoIds.map((id) => ({
          id,
          date: entry.date,
          day: dayNumber(surgeryDate, entry.date),
          angle: entry.photoAngles[id] ?? 'Diğer',
        })),
      ),
    [state.checkIns, surgeryDate],
  )
  // Eski sürüm fotoğraflarının açısı yoktur; ilk görünüm boş kalmasın.
  const angle = chosen ?? shots[0]?.angle ?? 'Ön'
  const filtered = shots.filter((shot) => shot.angle === angle)
  const last = filtered.length - 1
  const before = filtered[Math.min(fromIndex, last)]
  const after = filtered[toIndex === null ? last : Math.min(toIndex, last)]

  useEffect(() => {
    if (!playing || filtered.length < 2) return
    const timer = window.setInterval(() => setFrame((value) => (value + 1) % filtered.length), 700)
    return () => window.clearInterval(timer)
  }, [playing, filtered.length])

  const options = PHOTO_ANGLES.filter((item) => item === angle || shots.some((shot) => shot.angle === item)).map((item) => ({
    value: item,
    label: item,
  }))

  return (
    <div className="page stack">
      <SubHead title="Foto kıyası" />

      {shots.length === 0 ? (
        <p className="muted">Haftalık ölçümlere fotoğraf ekledikçe burada aynı açıdan önce ve sonrasını kıyaslayabilirsin.</p>
      ) : (
        <>
          <div className="scroll-x">
            <Segmented
              name="foto"
              label="Çekim açısı"
              value={angle}
              onChange={(value) => {
                setAngle(value)
                setFromIndex(0)
                setToIndex(null)
                setFrame(0)
              }}
              options={options}
            />
          </div>

          {filtered.length === 0 && <p className="muted">Bu açıda fotoğraf yok.</p>}

          {filtered.length === 1 && before && (
            <Reveal>
              <Frame shot={before} />
            </Reveal>
          )}

          {filtered.length > 1 && before && after && (
            <>
              <Reveal>
                <section className="card">
                  <h2>Önce ve sonra</h2>
                  <Compare key={`${before.id}-${after.id}`} before={before} after={after} />
                  <div className="field-row">
                    <label className="field">
                      <span>Önce</span>
                      <select value={Math.min(fromIndex, last)} onChange={(event) => setFromIndex(Number(event.target.value))}>
                        {filtered.map((shot, index) => (
                          <option key={shot.id} value={index}>
                            {shot.day}. gün
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Sonra</span>
                      <select value={toIndex ?? last} onChange={(event) => setToIndex(Number(event.target.value))}>
                        {filtered.map((shot, index) => (
                          <option key={shot.id} value={index}>
                            {shot.day}. gün
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>
              </Reveal>

              <Reveal i={1}>
                <section className="card">
                  <h2>Hızlandırılmış gelişim</h2>
                  <Frame shot={filtered[Math.min(frame, last)]} />
                  <Press className="cta" onClick={() => setPlaying(!playing)}>
                    {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
                    {playing ? 'Durdur' : 'Oynat'}
                  </Press>
                  <p className="muted">
                    {fmtFull(filtered[0].date)} ile {fmtFull(filtered[last].date)} arası, {filtered.length} fotoğraf.
                  </p>
                </section>
              </Reveal>
            </>
          )}
        </>
      )}
    </div>
  )
}
