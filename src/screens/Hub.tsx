import {
  Activity,
  Award,
  BellRing,
  BookOpen,
  CalendarClock,
  Droplets,
  FileText,
  ImageIcon,
  Phone,
  ShieldCheck,
  Stethoscope,
  TimerReset,
} from 'lucide-react'
import { useState } from 'react'
import { Press, Reveal } from '../components/fx'
import { badgesOf } from '../domain/badges'
import { buildReport } from '../domain/report'
import { ruleStatuses } from '../domain/rules'
import { saveBackupFile } from '../photos'
import { useAppState, useToday } from '../store'

export function Hub() {
  const state = useAppState()
  const today = useToday()
  const [message, setMessage] = useState('')
  const surgery = state.surgery!

  const earned = badgesOf(state, today).filter((badge) => badge.done).length
  const active = ruleStatuses(surgery.date, state.ruleDays, today).filter((rule) => !rule.free).length
  const upcoming = state.appointments.filter((item) => !item.done && item.date >= today).length
  const photos = state.checkIns.reduce((sum, item) => sum + item.photoIds.length, 0)

  const tiles = [
    { href: '#bakim', icon: Droplets, title: 'Bakım', sub: 'Yıkama ve kabuk' },
    { href: '#belirti', icon: Activity, title: 'Belirtiler', sub: 'Günlük kayıt' },
    { href: '#foto', icon: ImageIcon, title: 'Foto kıyası', sub: `${photos} fotoğraf` },
    { href: '#randevu', icon: CalendarClock, title: 'Randevular', sub: upcoming ? `${upcoming} yaklaşan` : 'Kontrol, PRP' },
    { href: '#kurallar', icon: TimerReset, title: 'Kısıtlar', sub: active ? `${active} devam ediyor` : 'Hepsi bitti' },
    { href: '#hatirlatma', icon: BellRing, title: 'Hatırlatmalar', sub: state.reminders.enabled ? 'Açık' : 'Kapalı' },
    { href: '#rozet', icon: Award, title: 'Başarılar', sub: `${earned} rozet` },
    { href: '#rehber', icon: BookOpen, title: 'Normal mi?', sub: 'Sık sorular' },
    { href: '#operasyon', icon: Stethoscope, title: 'Operasyon', sub: 'Greft ve klinik' },
    { href: '#gizlilik', icon: ShieldCheck, title: 'Gizlilik', sub: 'Verilerin cihazda' },
  ]

  const shareReport = async () => {
    setMessage('')
    try {
      const saved = await saveBackupFile(`kok-rapor-${today}.html`, buildReport(state, today), 'text/html')
      if (saved) setMessage('Rapor oluşturuldu.')
    } catch {
      setMessage('Rapor oluşturulamadı.')
    }
  }

  return (
    <div className="page stack">
      <header className="page-head">
        <h1>Merkez</h1>
      </header>

      <div className="hub-grid">
        {tiles.map(({ href, icon: Icon, title, sub }, index) => (
          <Reveal key={href} i={index}>
            <a href={href} className="hub-tile">
              <span className="hub-icon">
                <Icon size={20} aria-hidden />
              </span>
              <strong>{title}</strong>
              <small>{sub}</small>
            </a>
          </Reveal>
        ))}
      </div>

      <Reveal i={10}>
        <section className="card">
          <h2>Doktora rapor</h2>
          <p className="muted">İlaçların, uyumun, ölçümlerin ve belirtilerin tek sayfalık özeti. Kontrole giderken paylaş.</p>
          <Press className="cta" onClick={() => void shareReport()}>
            <FileText size={19} aria-hidden /> Raporu oluştur
          </Press>
          {message && <p className="muted" role="status">{message}</p>}
        </section>
      </Reveal>

      {surgery.clinicPhone && (
        <Reveal i={11}>
          <a className="cta cta-ghost" href={`tel:${surgery.clinicPhone}`}>
            <Phone size={19} aria-hidden /> {surgery.clinic || 'Kliniği'} ara
          </a>
        </Reveal>
      )}
    </div>
  )
}
