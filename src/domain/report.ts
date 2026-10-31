import { activePlan, doseLabel, medStart, scheduleLabel, tally, windowTally } from './adherence'
import { scabStats, washStats } from './care'
import { fmtFull } from './dates'
import { sortedCheckIns } from './efficacy'
import { fmtDecimal, fmtInt, fmtRatio, fmtScore } from './format'
import { dayNumber, expectedAt } from './timeline'
import { SHEDDING_LEVELS, type AppState, type ISODate } from './types'

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char] ?? char)

const row = (cells: (string | number)[], tag = 'td') =>
  `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(String(cell))}</${tag}>`).join('')}</tr>`

/** Kontrole götürülecek yalın, yazdırılabilir özet. */
export const buildReport = (state: AppState, today: ISODate) => {
  const surgery = state.surgery
  if (!surgery) return ''
  const day = dayNumber(surgery.date, today)
  const wash = washStats(surgery.date, state.washes, today)
  const scab = scabStats(surgery.date, state.scabs, today)
  const checkIns = sortedCheckIns(state.checkIns).slice(-12)
  const symptomDays = Object.entries(state.symptoms).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14)

  const meds = state.meds.map((med) =>
    row([
      med.name,
      doseLabel(med) || '-',
      scheduleLabel(activePlan(med)),
      fmtFull(medStart(med)),
      fmtRatio(windowTally([med], state.doses, 30, today).ratio),
      fmtRatio(tally([med], state.doses, medStart(med), today, today).ratio),
    ]),
  )
  const measures = checkIns.map((entry) => {
    const entryDay = dayNumber(surgery.date, entry.date)
    return row([
      fmtFull(entry.date),
      `${entryDay}. gün`,
      fmtScore(entry.fullness),
      fmtScore(Math.round(expectedAt(entryDay).mid)),
      SHEDDING_LEVELS[entry.shedding],
      entry.sideEffects.join(', ') || '-',
    ])
  })
  const symptoms = symptomDays.map(([date, log]) =>
    row([
      fmtFull(date),
      Object.entries(log.scores).filter(([, score]) => score > 0).map(([name, score]) => `${name} ${score}/3`).join(', ') || '-',
      log.flags.join(', ') || '-',
    ]),
  )

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kök takip raporu</title>
<style>body{font:15px/1.5 -apple-system,Segoe UI,sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 16px}h1{font-size:24px}h2{font-size:17px;margin-top:28px}table{width:100%;border-collapse:collapse;font-size:13.5px}th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left}small{color:#555}</style></head><body>
<h1>Kök takip raporu</h1>
<p>${escapeHtml(fmtFull(today))} tarihinde oluşturuldu. Kullanıcının kendi kayıtlarına dayanır, tıbbi değerlendirme değildir.</p>
<h2>Operasyon</h2>
<table>
${row(['Tarih', `${fmtFull(surgery.date)} (${day}. gün)`])}
${row(['Klinik', [surgery.clinic, surgery.city].filter(Boolean).join(', ') || '-'])}
${row(['Doktor', surgery.doctor || '-'])}
${row(['Greft', surgery.graftCount ? fmtInt(surgery.graftCount) : '-'])}
${row(['Teknik', surgery.technique])}
${row(['Bölge', surgery.areas.join(', ') || '-'])}
</table>
<h2>İyileşme</h2>
<table>
${row(['İlk yıkama', wash.firstDay === null ? '-' : `${wash.firstDay}. gün`])}
${row(['Ortalama yıkama aralığı', wash.averageGap === null ? '-' : `${fmtDecimal(wash.averageGap)} gün`])}
${row(['Kabuk dökümü tamamlandı', scab.endDay === null ? '-' : `${scab.endDay}. gün`])}
</table>
<h2>İlaç ve takviyeler</h2>
<table>${row(['Ad', 'Doz', 'Plan', 'Başlangıç', '30 gün uyum', 'Toplam uyum'], 'th')}${meds.join('') || row(['Kayıt yok'])}</table>
<h2>Son ölçümler</h2>
<table>${row(['Tarih', 'Gün', 'Kendi değerlendirmesi', 'Genel beklenti', 'Dökülme', 'Şikâyet'], 'th')}${measures.join('') || row(['Kayıt yok'])}</table>
<h2>Son belirtiler</h2>
<table>${row(['Tarih', 'Belirti', 'Acil işaret'], 'th')}${symptoms.join('') || row(['Kayıt yok'])}</table>
${state.clinicNotes ? `<h2>Notlar</h2><p>${escapeHtml(state.clinicNotes)}</p>` : ''}
</body></html>`
}
