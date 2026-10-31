import { animate, motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
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
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 170, damping: 19, delay: Math.min(i, 10) * 0.06 }}
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
      whileTap={{ scale: 0.94 }}
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
      duration: reduced ? 0 : 1,
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
  /** 0–1 arası doluluk. */
  value: number
  size?: number
  thickness?: number
  from?: string
  to?: string
  children?: ReactNode
}

/** Yaylanarak dolan parlak halka. */
export function Ring({ value, size = 132, thickness = 14, from = '#ff3d81', to = '#ffd23f', children }: RingProps) {
  const gradient = useId()
  const radius = (size - thickness) / 2
  const center = size / 2
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
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
