import { Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Press, Reveal, SubHead } from '../components/fx'
import { Sheet } from '../components/Sheet'
import { addMonths, fmtFull } from '../domain/dates'
import { APPOINTMENT_KINDS, type Appointment, type AppointmentKind } from '../domain/types'
import { actions, useAppState, useToday } from '../store'

const FOLLOW_UPS = [1, 3, 6, 9, 12]

function AppointmentForm({ entry, onClose }: { entry: Partial<Appointment>; onClose: () => void }) {
  const today = useToday()
  const [kind, setKind] = useState<AppointmentKind>(entry.kind ?? 'Kontrol')
  const [title, setTitle] = useState(entry.title ?? '')
  const [date, setDate] = useState(entry.date ?? today)
  const [time, setTime] = useState(entry.time ?? '10:00')
  const [note, setNote] = useState(entry.note ?? '')

  return (
    <Sheet title={entry.id ? 'Randevuyu düzenle' : 'Randevu ekle'} onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          actions.saveAppointment({ id: entry.id, kind, title: title.trim() || kind, date, time, note: note.trim(), done: entry.done ?? false })
          onClose()
        }}
      >
        <fieldset className="field">
          <legend>Tür</legend>
          <div className="chips">
            {APPOINTMENT_KINDS.map((item) => (
              <button key={item} type="button" className="chip" aria-pressed={kind === item} onClick={() => setKind(item)}>
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Başlık</span>
          <input value={title} placeholder="Örneğin 6. ay kontrolü" onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Tarih</span>
            <input type="date" value={date} required onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field">
            <span>Saat</span>
            <input type="time" value={time} required onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Not</span>
          <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <div className="form-actions">
          <button type="submit" className="button">
            Randevuyu kaydet
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export function Appointments() {
  const state = useAppState()
  const today = useToday()
  const [form, setForm] = useState<Partial<Appointment> | null>(null)
  const surgery = state.surgery!

  const sorted = [...state.appointments].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const upcoming = sorted.filter((item) => !item.done && item.date >= today)
  const past = sorted.filter((item) => item.done || item.date < today).reverse()
  const suggestions = FOLLOW_UPS.map((month) => ({ month, date: addMonths(surgery.date, month) })).filter(
    ({ month, date }) => date >= today && !state.appointments.some((item) => item.title === `${month}. ay kontrolü`),
  )

  const row = (item: Appointment, index: number) => (
    <Reveal key={item.id} i={index}>
      <article className="card appointment" data-done={item.done || undefined}>
        <button type="button" className="appointment-main" onClick={() => setForm(item)}>
          <span className="tag">{item.kind}</span>
          <strong>{item.title}</strong>
          <small>
            {fmtFull(item.date)}, {item.time}
          </small>
          {item.note && <small>{item.note}</small>}
        </button>
        <div className="action-row">
          <Press
            className="round-button"
            aria-label={item.done ? 'Tamamlandı işaretini kaldır' : 'Tamamlandı işaretle'}
            aria-pressed={item.done}
            onClick={() => actions.saveAppointment({ ...item, done: !item.done })}
          >
            <Check size={17} aria-hidden />
          </Press>
          <Press
            className="round-button round-danger"
            aria-label="Randevuyu sil"
            onClick={() => {
              if (window.confirm('Bu randevu silinsin mi?')) actions.deleteAppointment(item.id)
            }}
          >
            <Trash2 size={17} aria-hidden />
          </Press>
        </div>
      </article>
    </Reveal>
  )

  return (
    <div className="page stack">
      <SubHead title="Randevular">
        <Press className="cta cta-small" onClick={() => setForm({})}>
          <Plus size={18} aria-hidden /> Ekle
        </Press>
      </SubHead>

      {upcoming.length === 0 && <p className="muted">Yaklaşan randevun yok. Kontrol, PRP veya tahlil tarihlerini ekle, bir gün ve iki saat önce hatırlatayım.</p>}
      {upcoming.map(row)}

      {suggestions.length > 0 && (
        <section>
          <h2 className="section-title">Önerilen kontroller</h2>
          <div className="chips">
            {suggestions.map(({ month, date }) => (
              <button
                key={month}
                type="button"
                className="chip"
                onClick={() => setForm({ kind: 'Kontrol', title: `${month}. ay kontrolü`, date })}
              >
                {month}. ay kontrolü
              </button>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && <h2 className="section-title">Geçmiş</h2>}
      {past.map(row)}

      {form && <AppointmentForm entry={form} onClose={() => setForm(null)} />}
    </div>
  )
}
