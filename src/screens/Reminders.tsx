import { BellOff, BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Press, Reveal, Stepper, SubHead } from '../components/fx'
import { fmtDayShort, localToday } from '../domain/dates'
import { planReminders } from '../domain/reminders'
import type { ReminderSettings } from '../domain/types'
import { notificationStatus, requestNotifications, type PermissionState } from '../notifications'
import { actions, useAppState } from '../store'

type BoolKey = {
  [K in keyof ReminderSettings]: ReminderSettings[K] extends boolean ? K : never
}[keyof ReminderSettings]

const TOGGLES: { key: BoolKey; title: string; body: string }[] = [
  { key: 'doses', title: 'Doz saatleri', body: 'Her ilacın kendi saatinde' },
  { key: 'nag', title: 'Israrcı hatırlatma', body: 'Doz işaretlenene kadar tekrarlar' },
  { key: 'wash', title: 'Yıkama', body: 'Sıradaki yıkama zamanı' },
  { key: 'checkIn', title: 'Haftalık ölçüm', body: 'Fotoğraf ve ilerleme kaydı' },
  { key: 'symptoms', title: 'Belirti kaydı', body: 'İlk 14 gün her akşam' },
  { key: 'appointments', title: 'Randevular', body: 'Bir gün ve iki saat önce' },
  { key: 'rules', title: 'Kısıt bitişleri', body: 'Spor, havuz, güneş gibi' },
  { key: 'stock', title: 'Stok azalması', body: 'İlaç bitmeden önce' },
  { key: 'milestones', title: 'Evre ve kilometre taşları', body: '100. gün, yeni dönem gibi' },
]

function Toggle({
  title,
  body,
  checked,
  disabled,
  onChange,
}: {
  title: string
  body: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      className="toggle-row"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span>
        <strong>{title}</strong>
        <small>{body}</small>
      </span>
      <i className="toggle" aria-hidden />
    </button>
  )
}

export function Reminders() {
  const state = useAppState()
  const settings = state.reminders
  const [permission, setPermission] = useState<PermissionState>('web')

  useEffect(() => {
    void notificationStatus().then(setPermission)
  }, [])

  const today = localToday()
  // Israr turları aynı dozun tekrarıdır, listeyi doldurmasın.
  const upcoming = planReminders(state, new Date())
    .filter((item) => item.kind !== 'nag')
    .slice(0, 6)
  const save = (change: Partial<ReminderSettings>) => actions.saveReminders(change)

  return (
    <div className="page stack">
      <SubHead title="Hatırlatmalar" />

      {permission !== 'granted' && permission !== 'web' && (
        <Reveal>
          <section className="card card-glow">
            <h2>Bildirimleri aç</h2>
            <p className="muted">
              {permission === 'denied'
                ? 'Bildirimler kapalı. iPhone Ayarlar > Kök > Bildirimler bölümünden açabilirsin.'
                : 'Doz, yıkama ve ölçüm zamanlarını kaçırmaman için izin ver.'}
            </p>
            {permission === 'prompt' && (
              <Press className="cta" onClick={() => void requestNotifications().then(setPermission)}>
                <BellRing size={19} aria-hidden /> Bildirimlere izin ver
              </Press>
            )}
          </section>
        </Reveal>
      )}

      <Reveal i={1}>
        <section className="card">
          <Toggle
            title="Tüm hatırlatmalar"
            body={settings.enabled ? 'Açık' : 'Kapalı'}
            checked={settings.enabled}
            onChange={(enabled) => save({ enabled })}
          />
          {TOGGLES.map(({ key, title, body }) => (
            <Toggle
              key={key}
              title={title}
              body={body}
              checked={settings[key]}
              disabled={!settings.enabled}
              onChange={(value) => save({ [key]: value })}
            />
          ))}
        </section>
      </Reveal>

      <Reveal i={2}>
        <section className="card">
          <h2>Ayarlar</h2>
          <div className="setting-row">
            <span>Israr aralığı</span>
            <Stepper value={settings.nagMinutes} step={5} min={5} label="Israr aralığı" format={(value) => `${value} dk`} onChange={(nagMinutes) => save({ nagMinutes })} />
          </div>
          <div className="setting-row">
            <span>Yıkama aralığı</span>
            <Stepper value={settings.washEveryDays} step={1} min={1} label="Yıkama aralığı" format={(value) => `${value} gün`} onChange={(washEveryDays) => save({ washEveryDays })} />
          </div>
          <div className="field-row">
            <label className="field">
              <span>Yıkama saati</span>
              <input type="time" value={settings.washTime} onChange={(event) => save({ washTime: event.target.value })} />
            </label>
            <label className="field">
              <span>Ölçüm saati</span>
              <input type="time" value={settings.checkInTime} onChange={(event) => save({ checkInTime: event.target.value })} />
            </label>
            <label className="field">
              <span>Sessiz başlangıç</span>
              <input type="time" value={settings.quietStart} onChange={(event) => save({ quietStart: event.target.value })} />
            </label>
            <label className="field">
              <span>Sessiz bitiş</span>
              <input type="time" value={settings.quietEnd} onChange={(event) => save({ quietEnd: event.target.value })} />
            </label>
          </div>
          <Toggle
            title="Kilit ekranında ilaç adını gizle"
            body="Bildirimde yalnızca genel metin görünür"
            checked={settings.hideDetails}
            onChange={(hideDetails) => save({ hideDetails })}
          />
        </section>
      </Reveal>

      <Reveal i={3}>
        <section className="card">
          <h2>Sıradakiler</h2>
          {upcoming.length === 0 && (
            <p className="muted">
              <BellOff size={15} aria-hidden /> Planlı hatırlatma yok.
            </p>
          )}
          <ul className="upcoming">
            {upcoming.map((item) => {
              const date = localToday(item.at)
              return (
                <li key={item.key}>
                  <time>
                    {date === today ? 'Bugün' : fmtDayShort(date)} {item.at.toTimeString().slice(0, 5)}
                  </time>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="muted">Hatırlatmalar uygulamayı her açtığında yenilenir. Uzun süre açmazsan iOS sınırı nedeniyle durabilir.</p>
        </section>
      </Reveal>
    </div>
  )
}
