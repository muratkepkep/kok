import { useMemo, useState } from 'react'
import { expectedAt, TRACKED_WEEKS } from '../domain/timeline'
import { fmtScore } from '../domain/format'
import { useWidth } from './useWidth'

const MONTH_MARKS = [
  { week: 13, label: '3. ay' },
  { week: 26, label: '6. ay' },
  { week: 39, label: '9. ay' },
  { week: 52, label: '12. ay' },
  { week: 78, label: '18. ay' },
]

const STUBBLE = 7
const ROOT_DEPTH = 11

/** Haftaların sabit dizilimi: her tel her çizimde aynı yöne yatar. */
const jitter = (index: number) => Math.sin(index * 12.9898) * 0.5 + Math.sin(index * 4.1414) * 0.5

interface Props {
  /** Ameliyattan önce 0, sonrasında 1'den başlayan hafta. */
  currentWeek: number
}

/** Her telin bir hafta olduğu 18 aylık şerit. Boy, beklenen iyileşme eğrisini izler. */
export function Strands({ currentWeek }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hovered, setHovered] = useState<number | null>(null)

  const narrow = width < 620
  const growth = narrow ? 96 : 150
  const sky = growth + 14
  const height = sky + 52
  const step = width / TRACKED_WEEKS

  const strands = useMemo(
    () =>
      Array.from({ length: TRACKED_WEEKS }, (_, index) => {
        const week = index + 1
        const x = (index + 0.5) * step
        const expected = expectedAt(index * 7 + 3).mid
        const length = STUBBLE + (expected / 100) * growth * (0.92 + jitter(index) * 0.08)
        const lean = (length / growth) * (narrow ? 12 : 20) + jitter(index) * 2
        const d = `M${x.toFixed(1)} ${sky} C${(x + lean * 0.1).toFixed(1)} ${(sky - length * 0.45).toFixed(1)} ${(x + lean * 0.45).toFixed(1)} ${(sky - length * 0.85).toFixed(1)} ${(x + lean).toFixed(1)} ${(sky - length).toFixed(1)}`
        return { week, x, d, expected }
      }),
    [step, growth, sky, narrow],
  )

  const tip = hovered === null ? null : strands[hovered]

  const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const index = Math.floor(((event.clientX - box.left) / box.width) * TRACKED_WEEKS)
    setHovered(Math.max(0, Math.min(TRACKED_WEEKS - 1, index)))
  }

  return (
    <div ref={ref} className="strands">
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`18 aylık süreç şeridi, her tel bir hafta. Şu an ${currentWeek}. haftadasın.`}
        >
          <rect x={0} y={sky} width={width} height={height - sky} className="strands-scalp" />
          {strands.map(({ week, x, d }) => {
            const state = week === currentWeek ? 'now' : week < currentWeek ? 'past' : 'next'
            return (
              <g key={week} className={`strand strand-${state}`}>
                <path d={d} pathLength={1} style={{ animationDelay: `${week * 7}ms` }} />
                <line x1={x} x2={x} y1={sky} y2={sky + ROOT_DEPTH - 3} />
                <circle cx={x} cy={sky + ROOT_DEPTH} r={week === currentWeek ? 3.4 : 1.9} />
              </g>
            )
          })}
          {MONTH_MARKS.map(({ week, label }) => {
            const x = week * step
            const hide = narrow && week === 39
            return hide ? null : (
              <text key={week} x={x} y={height - 11} textAnchor="end" className="strands-mark">
                {label}
              </text>
            )
          })}
          {tip && (
            <line x1={tip.x} x2={tip.x} y1={4} y2={height} className="strands-crosshair" />
          )}
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={() => setHovered(null)}
          />
        </svg>
      )}
      {tip && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(tip.x, 70), width - 70), top: 4 }}
        >
          <strong>{tip.week}. hafta</strong>
          <span>Beklenen {fmtScore(Math.round(tip.expected))}</span>
        </div>
      )}
    </div>
  )
}
