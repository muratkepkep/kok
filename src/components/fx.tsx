import { animate, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { fmtInt } from '../domain/format'
import { tapLight } from '../haptics'

const SPRING = { type: 'spring', stiffness: 420, damping: 24 } as const

/** Sıralı beliren blok; i değeri gecikmeyi belirler. */
export function Reveal({
  i = 0,
  children,
  className,
}: {
  i?: number
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 190, damping: 21, delay: Math.min(i, 10) * 0.05 }}
    >
      {children}
    </motion.div>
  )
}

/** Basınca içeri gömülen buton. */
export function Press({ children, onClick, ...props }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      transition={SPRING}
      onClick={(event) => {
        tapLight()
        onClick?.(event)
      }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

/** Değere sayarak ulaşan rakam. */
export function CountUp({
  value,
  format = fmtInt,
  className,
}: {
  value: number
  format?: (value: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef(0)
  const formatter = useRef(format)
  const reduced = useReducedMotion()
  formatter.current = format

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const controls = animate(shown.current, value, {
      duration: reduced ? 0 : 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (next) => {
        shown.current = next
        node.textContent = formatter.current(next)
      },
    })
    return () => controls.stop()
  }, [value, reduced])

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  )
}

interface RingProps {
  /** 0–1 doluluk. */
  value: number
  size?: number
  thickness?: number
  from?: string
  to?: string
  children?: ReactNode
}

/** Ölçek çizgili, yaylanarak dolan HUD halkası. */
export function Ring({ value, size = 132, thickness = 12, from = '#2ef2ff', to = '#7a5cff', children }: RingProps) {
  const gradient = useId()
  const radius = (size - thickness) / 2 - 5
  const center = size / 2
  const tickRadius = size / 2 - 1.5
  const ticks = Math.round(size / 3.4)
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        <circle
          className="ring-ticks"
          cx={center}
          cy={center}
          r={tickRadius}
          strokeDasharray={`1.5 ${((Math.PI * 2 * tickRadius) / ticks - 1.5).toFixed(2)}`}
        />
        <circle className="ring-track" cx={center} cy={center} r={radius} strokeWidth={thickness} />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth={thickness}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: Math.max(0.001, Math.min(1, value)), opacity: value > 0 ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 13 }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  name: string
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

/** Seçili sekmenin üzerinde kayan parlak gösterge. */
export function Segmented<T extends string>({ name, label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="switcher" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => {
            tapLight()
            onChange(option.value)
          }}
        >
          {value === option.value && (
            <motion.span layoutId={`switcher-${name}`} className="switcher-pill" transition={SPRING} />
          )}
          <span className="switcher-label">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Alt sayfaların başlığı ve geri bağlantısı. */
export function SubHead({ title, back = 'merkez', children }: { title: string; back?: string; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-title">
        <a href={`#${back}`} className="round-button round-small" aria-label="Geri" onClick={tapLight}>
          <ChevronLeft size={20} aria-hidden />
        </a>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  )
}

/** Azalt ve artır düğmeli sayı denetimi. */
export function Stepper({
  value,
  step,
  min = 0,
  label,
  format,
  onChange,
}: {
  value: number
  step: number
  min?: number
  label: string
  format?: (value: number) => string
  onChange: (value: number) => void
}) {
  const change = (next: number) => onChange(Math.max(min, Math.round(next * 1000) / 1000))
  return (
    <div className="stepper-control" role="group" aria-label={label}>
      <Press aria-label={`${label} azalt`} disabled={value <= min} onClick={() => change(value - step)}>
        −
      </Press>
      <output>{format ? format(value) : value}</output>
      <Press aria-label={`${label} artır`} onClick={() => change(value + step)}>
        +
      </Press>
    </div>
  )
}
