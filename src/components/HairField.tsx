import { useEffect, useRef } from 'react'
import { expectedAt, TRACKED_WEEKS } from '../domain/timeline'

/** Teller sıklaşınca ışıklar toplanıp beyaza döner, renk kaybolur. */
const STRAND_SPACING = 2.6
const MAX_PIXEL_RATIO = 2
const GROUND_OFFSET = 54
const STUBBLE = 9
const PUSH_RADIUS = 96
const MONTH_MARKS = [
  { week: 13, label: '3. ay' },
  { week: 26, label: '6. ay' },
  { week: 52, label: '12. ay' },
  { week: 78, label: '18. ay' },
]
const FIBERS = [
  ['#ff2e9f', '#7a5cff', '#2ef2ff'],
  ['#7a5cff', '#2ef2ff', '#ffffff'],
  ['#ff2e9f', '#a08cff', '#2ef2ff'],
]

interface Strand {
  x: number
  length: number
  lean: number
  phase: number
  speed: number
  delay: number
  lit: boolean
  fiber: number
  tipX: number
  tipY: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
}

const bursts = new Set<(count: number) => void>()

/** Sahnedeki köklerden ışık parçacıkları yükseltir. */
export const burstHair = (count = 26) => bursts.forEach((burst) => burst(count))

const noise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const easeOut = (value: number) => 1 - (1 - value) ** 3

const glowSprite = () => {
  const size = 32
  const sprite = document.createElement('canvas')
  sprite.width = size
  sprite.height = size
  const ctx = sprite.getContext('2d') as CanvasRenderingContext2D
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.25, 'rgba(190,245,255,.75)')
  gradient.addColorStop(1, 'rgba(46,242,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return sprite
}

interface Props {
  /** Ameliyattan önce 0; bu haftaya kadarki teller yanar. */
  currentWeek: number
}

/**
 * 18 aylık süreç, fiber optik saç telleri olarak çizilir: soldan sağa haftalar
 * ilerler, boylar beklenen iyileşmeyi izler, parmak telleri iter.
 */
export function HairField({ currentWeek }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sprite = glowSprite()
    const started = performance.now()
    const pointer = { x: 0, power: 0, target: 0 }
    const sparks: Spark[] = []
    let width = 0
    let height = 0
    let ground = 0
    let strands: Strand[] = []
    let fibers: CanvasGradient[] = []
    let groundLine: CanvasGradient | null = null
    let frameId = 0
    let onScreen = true

    const layout = () => {
      const box = canvas.getBoundingClientRect()
      width = box.width
      height = box.height
      if (width === 0 || height === 0) return
      const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

      ground = height - GROUND_OFFSET
      const reach = ground * 0.82
      const lean = Math.min(width * 0.1, 46)
      strands = []
      const count = Math.round(width / STRAND_SPACING)
      for (let index = 0; index < count; index += 1) {
        const position = (index + noise(index)) / count
        const week = Math.floor(position * TRACKED_WEEKS)
        const x = position * width
        const expected = expectedAt(week * 7 + 3).mid
        strands.push({
          x,
          length: STUBBLE + (expected / 100) * reach * (0.74 + noise(index + 7) * 0.3),
          lean: (0.3 + noise(index + 13) * 0.7) * lean,
          phase: noise(index + 19) * Math.PI * 2,
          speed: 0.7 + noise(index + 23) * 0.9,
          delay: (x / width) * 0.8,
          lit: week < currentWeek,
          fiber: index % FIBERS.length,
          tipX: x,
          tipY: ground,
        })
      }

      fibers = FIBERS.map(([root, middle, tip]) => {
        const gradient = ctx.createLinearGradient(0, ground, 0, ground - reach)
        gradient.addColorStop(0, root)
        gradient.addColorStop(0.5, middle)
        gradient.addColorStop(1, tip)
        return gradient
      })
      groundLine = ctx.createLinearGradient(0, 0, width, 0)
      groundLine.addColorStop(0, '#ff2e9f')
      groundLine.addColorStop(0.5, '#7a5cff')
      groundLine.addColorStop(1, '#2ef2ff')
    }

    const traceStrand = (strand: Strand, time: number) => {
      const grown = reduced ? 1 : easeOut(Math.min(1, Math.max(0, (time - strand.delay) / 1.2)))
      const length = strand.length * grown
      const weight = length / (ground * 0.82)
      const breeze = Math.sin(time * strand.speed + strand.phase + strand.x * 0.012) * (2 + 18 * weight)
      const gust = Math.sin(time * 0.45 + strand.x * 0.004) * 16 * weight
      const distance = strand.x - pointer.x
      const near = Math.max(0, 1 - Math.abs(distance) / PUSH_RADIUS)
      const push = (near * near * Math.sign(distance || 1) * pointer.power * (length * 0.75 + 14))

      const tipX = strand.x + strand.lean * weight + (reduced ? 0 : breeze + gust) + push
      const tipY = ground - length + Math.abs(push) * 0.28
      ctx.moveTo(strand.x, ground)
      ctx.quadraticCurveTo(strand.x + (tipX - strand.x) * 0.18, ground - length * 0.62, tipX, tipY)
      strand.tipX = tipX
      strand.tipY = tipY
    }

    const draw = (now: number) => {
      const time = (now - started) / 1000
      ctx.clearRect(0, 0, width, height)
      ctx.lineCap = 'round'
      pointer.power += (pointer.target - pointer.power) * 0.14
      ctx.globalCompositeOperation = 'lighter'

      ctx.beginPath()
      for (const strand of strands) if (!strand.lit) traceStrand(strand, time)
      ctx.strokeStyle = 'rgba(185, 170, 255, .2)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      fibers.forEach((gradient, fiber) => {
        ctx.beginPath()
        for (const strand of strands) if (strand.lit && strand.fiber === fiber) traceStrand(strand, time)
        ctx.strokeStyle = gradient
        ctx.globalAlpha = 0.62
        ctx.lineWidth = 1.7
        ctx.stroke()
        ctx.globalAlpha = 0.05
        ctx.lineWidth = 7
        ctx.stroke()
        ctx.globalAlpha = 1
      })

      for (const strand of strands) {
        if (!strand.lit || strand.length < STUBBLE + 6) continue
        const twinkle = 0.55 + 0.45 * Math.sin(time * 2.4 + strand.phase)
        const size = 6 + 6 * twinkle
        ctx.globalAlpha = 0.3 + 0.5 * twinkle
        ctx.drawImage(sprite, strand.tipX - size / 2, strand.tipY - size / 2, size, size)
      }
      ctx.globalAlpha = 1

      // Kök hattı ve köklerden yükselen ışık parçacıkları.
      if (groundLine) {
        ctx.fillStyle = groundLine
        ctx.globalAlpha = 0.9
        ctx.fillRect(0, ground, width, 2)
        ctx.globalAlpha = 0.14
        ctx.fillRect(0, ground - 3, width, 8)
        ctx.globalAlpha = 1
      }
      for (let index = 0; index < strands.length; index += 6) {
        const strand = strands[index]
        const pulse = 1.4 + Math.sin(time * 1.6 + strand.phase) * 0.6
        ctx.fillStyle = strand.lit ? '#ffb3cf' : 'rgba(185,170,255,.3)'
        ctx.beginPath()
        ctx.arc(strand.x, ground + 9, strand.lit ? pulse + 0.6 : 1.2, 0, Math.PI * 2)
        ctx.fill()
      }

      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index]
        spark.age += 1 / 60
        spark.x += spark.vx
        spark.y += spark.vy
        spark.vy *= 0.985
        if (spark.age >= spark.life) {
          sparks.splice(index, 1)
          continue
        }
        const size = 12 * (1 - spark.age / spark.life) + 4
        ctx.globalAlpha = 1 - spark.age / spark.life
        ctx.drawImage(sprite, spark.x - size / 2, spark.y - size / 2, size, size)
      }
      ctx.globalAlpha = 1

      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(246, 243, 255, .62)'
      ctx.font = '600 11px "Onest Variable", sans-serif'
      ctx.textAlign = 'right'
      for (const mark of MONTH_MARKS) {
        ctx.fillText(mark.label, mark.week * (width / TRACKED_WEEKS) - 4, height - 16)
      }

      if (!reduced && onScreen) frameId = requestAnimationFrame(draw)
    }

    const start = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(draw)
    }

    const burst = (count: number) => {
      if (reduced) return
      const lit = strands.filter((strand) => strand.lit)
      for (let index = 0; index < count; index += 1) {
        const origin = lit[Math.floor(Math.random() * lit.length)]
        if (!origin) return
        sparks.push({
          x: origin.x,
          y: ground,
          vx: (Math.random() - 0.5) * 1.1,
          vy: -2.2 - Math.random() * 3.2,
          age: 0,
          life: 0.8 + Math.random() * 0.9,
        })
      }
    }
    bursts.add(burst)

    const moveTo = (event: PointerEvent) => {
      pointer.x = event.clientX - canvas.getBoundingClientRect().left
      pointer.target = 1
    }
    const release = () => {
      pointer.target = 0
    }
    canvas.addEventListener('pointerdown', moveTo)
    canvas.addEventListener('pointermove', moveTo)
    canvas.addEventListener('pointerup', release)
    canvas.addEventListener('pointercancel', release)
    canvas.addEventListener('pointerleave', release)

    const resize = new ResizeObserver(() => {
      layout()
      if (reduced) start()
    })
    resize.observe(canvas)
    // Ekrandan çıkınca çizim durur, pil harcanmaz.
    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      if (onScreen && !reduced) start()
    })
    visibility.observe(canvas)

    layout()
    start()

    return () => {
      cancelAnimationFrame(frameId)
      bursts.delete(burst)
      resize.disconnect()
      visibility.disconnect()
      canvas.removeEventListener('pointerdown', moveTo)
      canvas.removeEventListener('pointermove', moveTo)
      canvas.removeEventListener('pointerup', release)
      canvas.removeEventListener('pointercancel', release)
      canvas.removeEventListener('pointerleave', release)
    }
  }, [currentWeek])

  return (
    <canvas
      ref={ref}
      className="hair-field"
      role="img"
      aria-label={`18 aylık süreç sahnesi. Parlayan her tel geçen haftaları gösterir, şu an ${currentWeek}. haftadasın.`}
    />
  )
}
