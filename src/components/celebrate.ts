const COLORS = ['#2ef2ff', '#7a5cff', '#ff2e9f', '#b6ff3c', '#ffb020', '#ffffff']
const PIECES = 150
const DURATION = 2200

/** Tam ekran konfeti. Hareket azaltma açıksa çalışmaz. */
export const celebrate = () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.append(canvas)

  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const width = window.innerWidth
  const height = window.innerHeight
  canvas.width = width * ratio
  canvas.height = height * ratio
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.scale(ratio, ratio)

  const pieces = Array.from({ length: PIECES }, (_, index) => {
    const fromLeft = index % 2 === 0
    const angle = (fromLeft ? -1 : -Math.PI + 1) + (Math.random() - 0.5) * 0.7
    const speed = 9 + Math.random() * 11
    return {
      x: fromLeft ? -10 : width + 10,
      y: height * 0.62,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 7,
      spin: Math.random() * Math.PI,
      turn: (Math.random() - 0.5) * 0.4,
      color: COLORS[index % COLORS.length],
    }
  })

  const started = performance.now()
  const frame = (now: number) => {
    const elapsed = now - started
    ctx.clearRect(0, 0, width, height)
    ctx.globalAlpha = Math.min(1, (DURATION - elapsed) / 500)
    for (const piece of pieces) {
      piece.vy += 0.26
      piece.vx *= 0.985
      piece.x += piece.vx
      piece.y += piece.vy
      piece.spin += piece.turn
      ctx.save()
      ctx.translate(piece.x, piece.y)
      ctx.rotate(piece.spin)
      ctx.fillStyle = piece.color
      ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2 + Math.abs(Math.sin(piece.spin)) * 4)
      ctx.restore()
    }
    if (elapsed < DURATION) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
