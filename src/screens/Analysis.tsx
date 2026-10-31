import { CircleAlert, CircleCheck, CircleHelp, Minus, Sparkles } from 'lucide-react'
import { GrowthChart, MonthlyCharts } from '../components/Charts'
import { CountUp, Reveal, Ring } from '../components/fx'
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
    <div className="page stack">
      <header className="page-head">
        <h1>Analiz</h1>
      </header>

      <Reveal>
        {reading ? (
          <section className="spotlight" data-tone={reading.tone}>
            <div className="spotlight-inner">
              <span className="spotlight-icon">
                {reading.tone === 'iyi' ? <Sparkles size={22} aria-hidden /> : <CircleAlert size={22} aria-hidden />}
              </span>
              <h2>{reading.title}</h2>
              <p>{reading.body}</p>
            </div>
          </section>
        ) : (
          <a href="#surec" className="cta">
            Özet için Süreç sayfasından ölçüm ekle
          </a>
        )}
      </Reveal>

      <Reveal i={1}>
        <section className="card duo-rings">
          <div>
            <Ring value={month.ratio ?? 0} size={124} thickness={13}>
              <strong className="ring-value ring-small">
                <CountUp value={month.ratio ?? 0} format={fmtRatio} />
              </strong>
            </Ring>
            <small>Son 30 gün uyum</small>
          </div>
          <div>
            <Ring value={(latest?.fullness ?? 0) / 100} size={124} thickness={13} from="#b6ff3c" to="#2ef2ff">
              <strong className="ring-value ring-small">
                <CountUp value={latest?.fullness ?? 0} format={(value) => fmtScore(value)} />
              </strong>
            </Ring>
            <small>Son ölçüm</small>
          </div>
        </section>
      </Reveal>

      <Reveal i={2}>
        <dl className="stat-grid">
          <div>
            <dt>Beklenen aralık</dt>
            <dd>{band ? `${fmtScore(Math.round(band.low))}–${fmtScore(Math.round(band.high))}` : '–'}</dd>
          </div>
          {densities.length > 1 && (
            <div>
              <dt>Yoğunluk, kıl/cm²</dt>
              <dd>
                {fmtDecimal(densities[0].density as number)} / {fmtDecimal(densities.at(-1)!.density as number)}
              </dd>
            </div>
          )}
        </dl>
      </Reveal>

      <Reveal i={3}>
        <section className="card">
          <h2>İlerleme ve beklenen seyir</h2>
          <GrowthChart surgeryDate={surgeryDate} checkIns={checkIns} today={today} />
          <p className="muted">
            Bant, klinik kaynaklardaki genel seyri gösterir ve kişiden kişiye değişir. Ölçümler senin kendi değerlendirmendir.
          </p>
        </section>
      </Reveal>

      <Reveal i={4}>
        <section className="card">
          <h2>İlaç verimliliği</h2>
          <p className="muted">
            Her ay için net ilerleme hesaplanır: ölçümündeki artıştan o ay beklenen doğal artış çıkarılır. Sonra{' '}
            {fmtRatio(GOOD_ADHERENCE)} ve üzeri düzenli kullandığın aylar, düzensiz aylarla karşılaştırılır.
          </p>
          {state.meds.length === 0 && <p className="muted">Karşılaştırma için ilaç ekle.</p>}
          <div className="verdicts">
            {groupEfficacy(rows, state.meds).map(({ meds, result, entangled }) => {
              const verdict = VERDICTS[result.verdict]
              const Icon = verdict.icon
              return (
                <article key={meds[0].id} className="verdict" data-tone={verdict.tone}>
                  <header>
                    <h3>{meds.map((med) => med.name).join(', ')}</h3>
                    <span className="verdict-tag">
                      <Icon size={15} aria-hidden /> {verdict.label}
                    </span>
                  </header>
                  <p>{explain(result)}</p>
                  {entangled && (
                    <p className="muted">
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
      </Reveal>

      {rows.length > 0 && (
        <Reveal i={5}>
          <section className="card">
            <h2>Aylara göre</h2>
            <MonthlyCharts rows={rows} />
            <details className="table-toggle">
              <summary>Tablo olarak göster</summary>
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Ay</th>
                      <th scope="col">Tarih</th>
                      <th scope="col">Uyum</th>
                      <th scope="col">Ölçüm</th>
                      <th scope="col">Beklenen</th>
                      <th scope="col">Net</th>
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
              </div>
            </details>
          </section>
        </Reveal>
      )}

      <Reveal i={6}>
        <section className="card">
          <h2>Şikâyetler</h2>
          {effects.length === 0 ? (
            <p className="muted">Ölçümlerde işaretlediğin yan etki veya şikâyet yok.</p>
          ) : (
            <>
              <div className="chip-row">
                {effects.map((effect) => (
                  <span key={effect.name} className="glass-chip">
                    {effect.name} <strong>{effect.count}</strong>
                  </span>
                ))}
              </div>
              <p className="muted">Sayılar, şikâyetin işaretlendiği ölçüm adedidir. Süren şikâyetleri doktoruna bildir.</p>
            </>
          )}
        </section>
      </Reveal>
    </div>
  )
}
