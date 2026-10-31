import { CircleAlert, CircleCheck, CircleHelp, Minus } from 'lucide-react'
import { GrowthChart, MonthlyCharts } from '../components/Charts'
import { windowTally } from '../domain/adherence'
import {
  GOOD_ADHERENCE,
  groupEfficacy,
  MEANINGFUL_DIFF,
  MIN_COMPARABLE_MONTHS,
  monthRows,
  positionOf,
  readingOf,
  sideEffectCounts,
  sortedCheckIns,
  type MedEfficacy,
  type Verdict,
} from '../domain/efficacy'
import { fmtRange } from '../domain/dates'
import { fmtDecimal, fmtRatio, fmtScore, fmtSigned } from '../domain/format'
import { dayNumber, expectedAt } from '../domain/timeline'
import { useAppState, useToday } from '../store'

const VERDICTS: Record<Verdict, { label: string; icon: typeof CircleCheck; tone: string }> = {
  yetersiz: { label: 'Veri yetersiz', icon: CircleHelp, tone: 'neutral' },
  'karsilastirma-yok': { label: 'Karşılaştırma yok', icon: Minus, tone: 'neutral' },
  olumlu: { label: 'Düzenli aylar önde', icon: CircleCheck, tone: 'good' },
  belirsiz: { label: 'Belirgin fark yok', icon: Minus, tone: 'neutral' },
  olumsuz: { label: 'Düzenli aylar geride', icon: CircleAlert, tone: 'warn' },
}

const explain = (result: MedEfficacy) => {
  const net = (value: number | null) => (value === null ? '–' : `${fmtSigned(value)} puan`)
  switch (result.verdict) {
    case 'yetersiz':
      return `${MIN_COMPARABLE_MONTHS} tamamlanmış ay gerekiyor, şu an ${result.usableMonths} ay var. Her ay en az bir ölçüm gir.`
    case 'karsilastirma-yok':
      return result.irregular.months === 0
        ? `Tüm aylarda düzenliydin, karşılaştıracak düzensiz ay yok. Aylık net ilerlemen ${net(result.regular.averageNet)}.`
        : `Hiç düzenli ay yok. Aylık net ilerlemen ${net(result.irregular.averageNet)}.`
    default:
      return `Düzenli ${result.regular.months} ayda ${net(result.regular.averageNet)}, düzensiz ${result.irregular.months} ayda ${net(result.irregular.averageNet)}. Fark ayda ${net(result.diff)}.`
  }
}

export function Analysis() {
  const state = useAppState()
  const today = useToday()
  const surgeryDate = state.surgery!.date

  const checkIns = sortedCheckIns(state.checkIns)
  const latest = checkIns.at(-1)
  const rows = monthRows(state, today)
  const month = windowTally(state.meds, state.doses, 30, today)
  const position = latest ? positionOf(surgeryDate, latest) : null
  const reading = readingOf(month.ratio, position)
  const band = latest ? expectedAt(dayNumber(surgeryDate, latest.date)) : null
  const densities = checkIns.filter((entry) => entry.density !== null)
  const effects = sideEffectCounts(checkIns)

  return (
    <>
      <header className="page-head">
        <h1>Analiz</h1>
      </header>

      {reading ? (
        <section className="reading" data-tone={reading.tone}>
          <h2>{reading.title}</h2>
          <p>{reading.body}</p>
        </section>
      ) : (
        <p className="empty">
          Özet için en az bir ölçüm ve doz kaydı gerekiyor. <a href="#surec">Süreç sayfasından ölçüm ekle</a>
        </p>
      )}

      <dl className="figures figures-large">
        <div>
          <dt>Son 30 gün uyum</dt>
          <dd>{fmtRatio(month.ratio)}</dd>
        </div>
        <div>
          <dt>Son ölçüm</dt>
          <dd>{fmtScore(latest?.fullness ?? null)}</dd>
        </div>
        <div>
          <dt>Beklenen aralık</dt>
          <dd>
            {band ? `${fmtScore(Math.round(band.low))}–${fmtScore(Math.round(band.high))}` : '–'}
          </dd>
        </div>
        {densities.length > 1 && (
          <div>
            <dt>Yoğunluk, kıl/cm²</dt>
            <dd>
              İlk {fmtDecimal(densities[0].density as number)}, son {fmtDecimal(densities.at(-1)!.density as number)}
            </dd>
          </div>
        )}
      </dl>

      <section className="section">
        <h2>İlerleme ve beklenen seyir</h2>
        <GrowthChart surgeryDate={surgeryDate} checkIns={checkIns} today={today} />
        <p className="section-note">
          Bant, klinik kaynaklardaki genel seyri gösterir ve kişiden kişiye değişir. Ölçümler senin kendi değerlendirmendir.
        </p>
      </section>

      <section className="section">
        <h2>İlaç verimliliği</h2>
        <p className="lead">
          Her ay için net ilerleme hesaplanır: ölçümündeki artıştan o ay beklenen doğal artış çıkarılır. Sonra
          {' '}{fmtRatio(GOOD_ADHERENCE)} ve üzeri düzenli kullandığın aylar, düzensiz aylarla karşılaştırılır.
        </p>
        {state.meds.length === 0 && <p className="empty">Karşılaştırma için ilaç ekle.</p>}
        <div className="verdicts">
          {groupEfficacy(rows, state.meds).map(({ meds, result, entangled }) => {
            const verdict = VERDICTS[result.verdict]
            const Icon = verdict.icon
            return (
              <article key={meds[0].id} className="verdict">
                <header>
                  <h3>{meds.map((med) => med.name).join(', ')}</h3>
                  <span className="verdict-tag" data-tone={verdict.tone}>
                    <Icon size={16} aria-hidden /> {verdict.label}
                  </span>
                </header>
                <p>{explain(result)}</p>
                {entangled && (
                  <p className="section-note">
                    Bunları aynı aylarda aynı düzende kullandığın için hangisinin etkili olduğu ayırt edilemiyor.
                  </p>
                )}
              </article>
            )
          })}
        </div>
        <p className="caution">
          Bu sonuç tek kişinin kendi değerlendirmesine dayanır, {MEANINGFUL_DIFF} puandan küçük aylık farklar anlamlı
          sayılmaz. İlacın işe yaradığını veya yaramadığını kanıtlamaz; ilaçların etkisi aylar içinde görülür. Dozu
          değiştirmeden veya ilacı bırakmadan önce doktoruna danış.
        </p>
      </section>

      {rows.length > 0 && (
        <section className="section">
          <h2>Aylara göre</h2>
          <MonthlyCharts rows={rows} />
          <details className="table-toggle">
            <summary>Tablo olarak göster</summary>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Ay</th>
                  <th scope="col">Tarih</th>
                  <th scope="col">Uyum</th>
                  <th scope="col">Ölçüm</th>
                  <th scope="col">Beklenen</th>
                  <th scope="col">Net ilerleme</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.n}>
                    <td>{row.n}. ay</td>
                    <td>{fmtRange(row.start, row.end)}</td>
                    <td className="num">{fmtRatio(row.adherence.ratio)}</td>
                    <td className="num">{fmtScore(row.score)}</td>
                    <td className="num">{row.expectedMid === null ? '–' : fmtScore(Math.round(row.expectedMid))}</td>
                    <td className="num">{row.net === null ? '–' : fmtSigned(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>
      )}

      <section className="section">
        <h2>Şikâyetler</h2>
        {effects.length === 0 ? (
          <p className="empty">Ölçümlerde işaretlediğin yan etki veya şikâyet yok.</p>
        ) : (
          <>
            <ul className="tally">
              {effects.map((effect) => (
                <li key={effect.name}>
                  {effect.name} <strong>{effect.count}</strong>
                </li>
              ))}
            </ul>
            <p className="section-note">Sayılar, şikâyetin işaretlendiği ölçüm adedidir. Süren şikâyetleri doktoruna bildir.</p>
          </>
        )}
      </section>
    </>
  )
}
