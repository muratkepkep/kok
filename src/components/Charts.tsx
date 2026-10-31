import { useState, type ReactNode } from 'react'
import { weeklyWashGaps, type WashRow } from '../domain/care'
import { fmtRange, fmtWeekday, fmtDay, addDays, weekdayIndex, eachDay } from '../domain/dates'
import { GOOD_ADHERENCE, type MonthRow } from '../domain/efficacy'
import { fmtDecimal, fmtRatio, fmtScore, fmtSigned } from '../domain/format'
import { EXPECTED_CURVE, expectedAt, monthOfDay, dayNumber, TRACKED_MONTHS } from '../domain/timeline'
import type { CheckIn, ISODate } from '../domain/types'
import { useWidth } from './useWidth'

interface Tip {
  x: number
  y: number
  title: string
  lines: ReactNode[]
}

const tipLeft = (x: number, width: number) => Math.min(Math.max(x, 78), width - 78)

function ChartTip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null
  return (
    <div className="chart-tip" style={{ left: tipLeft(tip.x, width), top: tip.y }}>
      <strong>{tip.title}</strong>
      {tip.lines.map((line, index) => (
        <span key={index}>{line}</span>
      ))}
    </div>
  )
}

const niceTicks = (max: number) => {
  const step = max <= 4 ? 1 : max <= 8 ? 2 : 5
  const ticks: number[] = []
  for (let value = 0; value <= max; value += step) ticks.push(value)
  return ticks
}

/** Beklenen seyir bandı üzerinde kişinin ölçümleri. */
export function GrowthChart({ surgeryDate, checkIns, today }: { surgeryDate: ISODate; checkIns: CheckIn[]; today: ISODate }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const height = 280
  const pad = { top: 16, right: 18, bottom: 28, left: 40 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const x = (month: number) => pad.left + (month / TRACKED_MONTHS) * innerW
  const y = (value: number) => pad.top + (1 - value / 100) * innerH

  const band = [
    ...EXPECTED_CURVE.map((point) => `${x(point.month)},${y(point.high)}`),
    ...[...EXPECTED_CURVE].reverse().map((point) => `${x(point.month)},${y(point.low)}`),
  ].join(' ')
  const midLine = EXPECTED_CURVE.map((point) => `${x(point.month)},${y(point.mid)}`).join(' ')

  const points = checkIns.map((entry) => {
    const day = dayNumber(surgeryDate, entry.date)
    return { entry, day, px: x(Math.min(monthOfDay(day), TRACKED_MONTHS)), py: y(entry.fullness) }
  })
  const line = points.map((point) => `${point.px},${point.py}`).join(' ')
  const last = points[points.length - 1]
  const nowX = x(Math.max(0, Math.min(monthOfDay(dayNumber(surgeryDate, today)), TRACKED_MONTHS)))

  const nearest = (clientX: number, box: DOMRect) => {
    if (points.length === 0) return
    const px = clientX - box.left
    const point = points.reduce((best, item) =>
      Math.abs(item.px - px) < Math.abs(best.px - px) ? item : best,
    )
    const expected = expectedAt(point.day)
    setTip({
      x: point.px,
      y: Math.max(0, point.py - 76),
      title: `${point.day}. gün, ${fmtDay(point.entry.date)}`,
      lines: [
        <>
          <b>{fmtScore(point.entry.fullness)}</b> senin ölçümün
        </>,
        <>
          <b>{fmtScore(Math.round(expected.mid))}</b> beklenen
        </>,
      ],
    })
  }

  return (
    <figure className="chart">
      <div ref={ref} className="chart-frame">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Beklenen iyileşme bandı ve kendi ölçümlerin"
            onPointerMove={(event) => nearest(event.clientX, event.currentTarget.getBoundingClientRect())}
            onPointerDown={(event) => nearest(event.clientX, event.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setTip(null)}
          >
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
                <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="chart-axis">
                  {fmtScore(tick)}
                </text>
              </g>
            ))}
            {(width < 460 ? [6, 12, 18] : [3, 6, 9, 12, 15, 18]).map((month) => (
              <text
                key={month}
                x={x(month)}
                y={height - 8}
                textAnchor={month === TRACKED_MONTHS ? 'end' : 'middle'}
                className="chart-axis"
              >
                {month}. ay
              </text>
            ))}
            <defs>
              <linearGradient id="kok-line" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0" stopColor="#ff2e9f" />
                <stop offset="0.55" stopColor="#7a5cff" />
                <stop offset="1" stopColor="#2ef2ff" />
              </linearGradient>
            </defs>
            <polygon points={band} className="chart-band" />
            <polyline points={midLine} className="chart-expected" />
            <line x1={nowX} x2={nowX} y1={pad.top} y2={height - pad.bottom} className="chart-now" />
            {points.length > 1 && <polyline points={line} className="chart-line" stroke="url(#kok-line)" pathLength={1} />}
            {points.map((point, index) => (
              <circle
                key={point.entry.id}
                cx={point.px}
                cy={point.py}
                r={3}
                className="chart-dot"
                style={{ animationDelay: `${index * 45}ms` }}
              />
            ))}
            {last && (
              <text x={last.px + 9} y={last.py + 4} className="chart-label">
                {fmtScore(last.entry.fullness)}
              </text>
            )}
          </svg>
        )}
        <ChartTip tip={tip} width={width} />
      </div>
      <figcaption className="legend">
        <span>
          <i className="key-band" /> Beklenen aralık
        </span>
        <span>
          <i className="key-expected" /> Beklenen orta değer
        </span>
        <span>
          <i className="key-line" /> Senin ölçümün
        </span>
      </figcaption>
    </figure>
  )
}

/** Yıkama aralığı hafta eksenine oturur; 18 ay sonra bile ilk haftalar görünür kalır. */
export function WashGapChart({ rows, currentWeek }: { rows: WashRow[]; currentWeek: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const data = weeklyWashGaps(rows)
  const weeks = Math.max(8, currentWeek, ...data.map((item) => item.week))
  const maxGap = Math.max(3, Math.ceil(Math.max(...data.map((item) => item.averageGap))))
  const height = 190
  const pad = { top: 14, right: 8, bottom: 26, left: 30 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const band = innerW / weeks
  const barW = Math.min(24, Math.max(2, band - 2))
  const y = (value: number) => pad.top + (1 - value / maxGap) * innerH
  const centerOf = (week: number) => pad.left + band * (week - 0.5)
  const labelEvery = [1, 2, 4, 8, 13, 26].find((every) => every * band >= 64) ?? 26

  const onPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (data.length === 0) return
    const px = event.clientX - event.currentTarget.getBoundingClientRect().left
    const item = data.reduce((best, next) =>
      Math.abs(centerOf(next.week) - px) < Math.abs(centerOf(best.week) - px) ? next : best,
    )
    setTip({
      x: centerOf(item.week),
      y: Math.max(0, y(item.averageGap) - 62),
      title: `${item.week}. hafta`,
      lines: [
        <>
          <b>{fmtDecimal(item.averageGap)}</b> günde bir, {item.washes} yıkama
        </>,
      ],
    })
  }

  return (
    <figure className="chart">
      <div ref={ref} className="chart-frame">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label="Haftalara göre ortalama yıkama aralığı"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={() => setTip(null)}
          >
            <defs>
              <linearGradient id="kok-water" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#7a5cff" />
                <stop offset="1" stopColor="#2ef2ff" />
              </linearGradient>
            </defs>
            {niceTicks(maxGap).map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
                <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="chart-axis">
                  {tick}
                </text>
              </g>
            ))}
            {data.map((item, index) => {
              const left = centerOf(item.week) - barW / 2
              const top = y(item.averageGap)
              const bottom = y(0)
              const radius = Math.min(4, barW / 2, bottom - top)
              return (
                <path
                  key={item.week}
                  d={`M${left} ${bottom}V${top + radius}Q${left} ${top} ${left + radius} ${top}H${left + barW - radius}Q${left + barW} ${top} ${left + barW} ${top + radius}V${bottom}Z`}
                  className="grow-up"
                  fill="url(#kok-water)"
                  style={{ animationDelay: `${index * 24}ms` }}
                />
              )
            })}
            {Array.from({ length: Math.floor(weeks / labelEvery) }, (_, index) => (index + 1) * labelEvery).map(
              (week) => (
                <text key={week} x={centerOf(week)} y={height - 8} textAnchor="middle" className="chart-axis">
                  {week}. hafta
                </text>
              ),
            )}
          </svg>
        )}
        <ChartTip tip={tip} width={width} />
      </div>
    </figure>
  )
}

const LEVELS = [0, 0.5, 0.8, 1]

const levelOf = (ratio: number) => {
  if (ratio >= 1) return 4
  if (ratio >= LEVELS[2]) return 3
  if (ratio >= LEVELS[1]) return 2
  if (ratio > 0) return 1
  return 0
}

/** Son haftaların gün gün doz takvimi; sütunlar pazartesi başlar. */
export function AdherenceCalendar({
  ratioOf,
  today,
  firstDate,
}: {
  ratioOf: (date: ISODate) => number | null
  today: ISODate
  firstDate: ISODate
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const gap = 3
  const labelW = 30
  const size = 20
  const shownWeeks = Math.min(52, Math.max(8, Math.floor((width - labelW) / (size + gap))))
  const lastMonday = addDays(today, -weekdayIndex(today))
  const firstMonday = addDays(lastMonday, -(shownWeeks - 1) * 7)
  const days = [...eachDay(firstMonday, today)]

  return (
    <figure className="chart">
      <div ref={ref} className="chart-frame">
        {width > 0 && (
          <div
            className="calendar"
            style={{
              gridTemplateColumns: `${labelW - gap}px repeat(${shownWeeks}, ${size}px)`,
              gridTemplateRows: `repeat(7, ${size}px)`,
              gap,
            }}
            role="img"
            aria-label={`Son ${shownWeeks} haftanın doz takvimi`}
          >
            {['Pzt', '', 'Çar', '', 'Cum', '', 'Paz'].map((label, index) => (
              <span key={index} className="calendar-label" style={{ gridRow: index + 1, gridColumn: 1 }}>
                {label}
              </span>
            ))}
            {days.map((date, index) => {
              const ratio = date < firstDate ? null : ratioOf(date)
              const column = Math.floor(index / 7) + 2
              const row = weekdayIndex(date) + 1
              const show = (event: React.PointerEvent<HTMLSpanElement>) => {
                const frame = ref.current?.getBoundingClientRect()
                const box = event.currentTarget.getBoundingClientRect()
                setTip({
                  x: box.left - (frame?.left ?? 0) + size / 2,
                  y: Math.max(0, box.top - (frame?.top ?? 0) - 62),
                  title: `${fmtDay(date)} ${fmtWeekday(date)}`,
                  lines: [ratio === null ? 'Plan yok' : <><b>{fmtRatio(ratio)}</b> doz alındı</>],
                })
              }
              return (
                <span
                  key={date}
                  className={ratio === null ? 'calendar-cell calendar-empty' : `calendar-cell level-${levelOf(ratio)}`}
                  style={{ gridRow: row, gridColumn: column, animationDelay: `${column * 28 + row * 12}ms` }}
                  data-today={date === today || undefined}
                  onPointerEnter={show}
                  onPointerDown={show}
                  onPointerLeave={() => setTip(null)}
                />
              )
            })}
          </div>
        )}
        <ChartTip tip={tip} width={width} />
      </div>
      <figcaption className="legend">
        <span>
          <i className="calendar-cell level-0 key-cell" /> Hiç
        </span>
        <span>
          <i className="calendar-cell level-1 key-cell" /> %50 altı
        </span>
        <span>
          <i className="calendar-cell level-2 key-cell" /> %50–79
        </span>
        <span>
          <i className="calendar-cell level-3 key-cell" /> %80–99
        </span>
        <span>
          <i className="calendar-cell level-4 key-cell" /> Tamamı
        </span>
      </figcaption>
    </figure>
  )
}

/** Aynı ay ekseninde üstte uyum, altta net ilerleme. İki ölçek tek grafikte birleşmez. */
export function MonthlyCharts({ rows }: { rows: MonthRow[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [tip, setTip] = useState<Tip | null>(null)

  const pad = { left: 40, right: 10 }
  const innerW = Math.max(0, width - pad.left - pad.right)
  const band = rows.length ? innerW / rows.length : 0
  const barW = Math.min(24, Math.max(6, band - 8))
  const labelEvery = band >= 42 ? 1 : band >= 21 ? 2 : 3

  const topH = 142
  const topStart = 28
  const topY = (ratio: number) => topStart + (1 - ratio) * (topH - topStart)
  const nets = rows.flatMap((row) => (row.net === null ? [] : [Math.abs(row.net)]))
  const netMax = Math.max(10, ...nets)
  const netH = 104
  const zero = topH + 40 + netH / 2
  const netY = (value: number) => zero - (value / netMax) * (netH / 2 - 6)
  const height = zero + netH / 2 + 26

  const columnPath = (left: number, from: number, to: number) => {
    const size = Math.abs(to - from)
    if (size < 0.5) return ''
    const radius = Math.min(4, barW / 2, size)
    const dir = to < from ? 1 : -1
    return `M${left} ${from}V${to + dir * radius}Q${left} ${to} ${left + radius} ${to}H${left + barW - radius}Q${left + barW} ${to} ${left + barW} ${to + dir * radius}V${from}Z`
  }

  const show = (row: MonthRow, cx: number) =>
    setTip({
      x: cx,
      y: 0,
      title: `${row.n}. ay, ${fmtRange(row.start, row.end)}`,
      lines: [
        <>
          <b>{fmtRatio(row.adherence.ratio)}</b> uyum
        </>,
        <>
          <b>{row.net === null ? '–' : fmtSigned(row.net)}</b> net ilerleme, puan
        </>,
      ],
    })

  return (
    <figure className="chart">
      <div ref={ref} className="chart-frame">
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Aylık uyum ve net ilerleme">
            <defs>
              <linearGradient id="kok-bar" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0" stopColor="#7a5cff" />
                <stop offset="1" stopColor="#2ef2ff" />
              </linearGradient>
            </defs>
            <text x={0} y={14} className="chart-title">
              Uyum, çizgi {fmtRatio(GOOD_ADHERENCE)} düzenli eşiği
            </text>
            {[0, 0.5, 1].map((tick) => (
              <g key={tick}>
                <line x1={pad.left} x2={width - pad.right} y1={topY(tick)} y2={topY(tick)} className="chart-grid" />
                <text x={pad.left - 8} y={topY(tick) + 4} textAnchor="end" className="chart-axis">
                  {fmtRatio(tick)}
                </text>
              </g>
            ))}
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={topY(GOOD_ADHERENCE)}
              y2={topY(GOOD_ADHERENCE)}
              className="chart-threshold"
            />

            <text x={0} y={topH + 26} className="chart-title">
              Doğal seyrin üstündeki net ilerleme, puan
            </text>
            <line x1={pad.left} x2={width - pad.right} y1={zero} y2={zero} className="chart-zero" />
            <text x={pad.left - 8} y={zero + 4} textAnchor="end" className="chart-axis">
              0
            </text>
            <text x={pad.left - 8} y={netY(netMax) + 4} textAnchor="end" className="chart-axis">
              {fmtSigned(netMax)}
            </text>
            <text x={pad.left - 8} y={netY(-netMax) + 4} textAnchor="end" className="chart-axis">
              {fmtSigned(-netMax)}
            </text>

            {rows.map((row, index) => {
              const cx = pad.left + band * (index + 0.5)
              const left = cx - barW / 2
              return (
                <g key={row.n}>
                  {row.adherence.ratio !== null && (
                    <path
                      d={columnPath(left, topY(0), topY(row.adherence.ratio))}
                      className={row.complete ? 'grow-up' : 'grow-up chart-bar-open'}
                      fill="url(#kok-bar)"
                      style={{ animationDelay: `${index * 70}ms` }}
                    />
                  )}
                  {row.net !== null && (
                    <path
                      d={columnPath(left, zero, netY(row.net))}
                      className={row.net >= 0 ? 'grow-up' : 'grow-down'}
                      fill={row.net >= 0 ? '#b6ff3c' : '#ffb020'}
                      style={{ animationDelay: `${300 + index * 70}ms` }}
                    />
                  )}
                  {row.n % labelEvery === 0 && (
                    <text x={cx} y={height - 8} textAnchor="middle" className="chart-axis">
                      {row.n}. ay
                    </text>
                  )}
                  <rect
                    x={cx - band / 2}
                    y={0}
                    width={band}
                    height={height}
                    fill="transparent"
                    onPointerEnter={() => show(row, cx)}
                    onPointerDown={() => show(row, cx)}
                    onPointerLeave={() => setTip(null)}
                  />
                </g>
              )
            })}
          </svg>
        )}
        <ChartTip tip={tip} width={width} />
      </div>
    </figure>
  )
}
