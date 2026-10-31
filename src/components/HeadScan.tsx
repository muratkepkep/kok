import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { HairField } from './HairField'
import { pulses } from './scanBus'

const SHELL_RINGS = 40
const RING_POINTS = 240
const BUST_RINGS = 24
const BUST_POINTS = 150
const STRANDS = 3200
const STATIONS = [0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1]
const MAX_PIXEL_RATIO = 2
const NATIVE_GROWTH = 0.72
const RIG_LIFT = -0.28
const CROWN = new THREE.Vector3(0.12, 0.8, -0.58).normalize()

/** Ekim bölgesinin başın üzerindeki yönü ve dahil edilme eşiği. */
const GRAFT_ZONES: Record<string, [number, number, number, number][]> = {
  'Ön saç çizgisi': [[0, 0.6, 0.8, 0.84]],
  'Orta bölge': [[0, 0.97, 0.24, 0.86]],
  Tepe: [[0, 0.74, -0.67, 0.86]],
  Şakak: [
    [0.74, 0.42, 0.52, 0.93],
    [-0.74, 0.42, 0.52, 0.93],
  ],
}
const DEFAULT_AREAS = ['Ön saç çizgisi', 'Orta bölge']

const smooth = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const bump = (x: number, y: number, width: number, height: number) => Math.exp(-((x / width) ** 2 + (y / height) ** 2))

/** Birim yönü baş şekline açar: kafatası, çene, burun, göz ve kulak çıkıntıları. */
const headSurface = (dir: THREE.Vector3, out: THREE.Vector3) => {
  const { x, y, z } = dir
  const lower = smooth(0.12, -0.95, y)
  out.set(x * (0.88 - 0.26 * lower), y > 0 ? y * 1.16 : -((-y) ** 0.86) * 1.34, z * (1.04 - 0.26 * lower) + lower * 0.06)
  if (z > 0) {
    out.z += bump(x, y + 0.24, 0.1, 0.2) * 0.2
    out.z += bump(x, y - 0.1, 0.34, 0.07) * 0.05
    out.z -= (bump(x - 0.3, y, 0.14, 0.08) + bump(x + 0.3, y, 0.14, 0.08)) * 0.06
    out.z += bump(x, y + 0.58, 0.16, 0.06) * 0.05
    out.z += bump(x, y + 0.84, 0.2, 0.12) * 0.07
  }
  out.x += Math.sign(x) * bump(y + 0.08, z, 0.17, 0.13) * 0.12
  return out
}

/** Saç çizgisi önde yüksek, arkada ve yanlarda aşağıdadır. */
const isScalp = (dir: THREE.Vector3) => {
  const front = smooth(-0.15, 0.85, dir.z)
  return dir.y > -0.28 + 0.8 * front + Math.abs(dir.x) * 0.05 * front
}

const isGrafted = (dir: THREE.Vector3, areas: string[]) =>
  areas.some((area) =>
    (GRAFT_ZONES[area] ?? []).some(([x, y, z, limit]) => dir.x * x + dir.y * y + dir.z * z > limit),
  )

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const randomDirection = (random: () => number, out: THREE.Vector3) => {
  const y = random() * 2 - 1
  const angle = random() * Math.PI * 2
  const radius = Math.sqrt(1 - y * y)
  return out.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
}

const pointVertex = /* glsl */ `
  attribute vec3 aSurface;
  attribute float aSeed;
  attribute float aScalp;
  uniform float uTime;
  uniform float uScan;
  uniform float uPulse;
  uniform float uPixel;
  varying float vGlow;
  varying float vScalp;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(normalMatrix * aSurface);
    vec4 view = viewMatrix * world;
    float facing = max(dot(normal, normalize(-view.xyz)), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    float light = pow(max(dot(normal, normalize(vec3(-0.55, 0.35, 0.76))), 0.0), 4.0);
    float band = smoothstep(0.16, 0.0, abs(position.y - uScan));
    float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + aSeed * 40.0);
    vGlow = ((0.1 + light * 1.1 + rim * 0.9) * twinkle + band * 0.9 + uPulse * 0.5) * mix(1.0, 0.22, aScalp);
    vScalp = aScalp;
    gl_Position = projectionMatrix * view;
    gl_PointSize = (1.1 + light * 0.9 + band * 1.6 + rim) * uPixel;
  }
`

const pointFragment = /* glsl */ `
  varying float vGlow;
  varying float vScalp;
  void main() {
    float dist = length(gl_PointCoord - 0.5);
    if (dist > 0.5) discard;
    vec3 color = mix(vec3(0.18, 0.95, 1.0), vec3(0.48, 0.36, 1.0), vScalp);
    gl_FragColor = vec4(color, smoothstep(0.5, 0.1, dist) * vGlow);
  }
`

const strandVertex = /* glsl */ `
  attribute vec3 aDir;
  attribute vec3 aFlow;
  attribute float aT;
  attribute float aSeed;
  attribute float aGraft;
  uniform float uTime;
  uniform float uGrowth;
  uniform float uPulse;
  uniform float uScan;
  varying float vT;
  varying float vBand;
  varying float vAlive;
  varying float vGraft;
  void main() {
    float grown = mix(${NATIVE_GROWTH.toFixed(2)}, uGrowth, aGraft);
    float length_ = (0.03 + grown * 0.5) * (0.7 + aSeed * 0.5);
    float t = aT;
    vec3 pos = position + aDir * length_ * (0.55 * t - 0.25 * t * t) + aFlow * length_ * (0.2 * t + 0.72 * t * t);
    pos.y -= length_ * 0.16 * t * t;
    pos.x += sin(uTime * 1.3 + aSeed * 30.0 + position.y * 3.0) * 0.018 * t * t * (0.4 + grown);
    pos.z += cos(uTime * 1.1 + aSeed * 22.0) * 0.014 * t * t * (0.4 + grown);
    pos += aDir * uPulse * 0.07 * t * aGraft;
    vT = t;
    vGraft = aGraft;
    vBand = smoothstep(0.2, 0.0, abs(position.y - uScan));
    vAlive = step(aSeed, mix(1.0, 0.3 + uGrowth * 0.7, aGraft));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const strandFragment = /* glsl */ `
  varying float vT;
  varying float vBand;
  varying float vAlive;
  varying float vGraft;
  uniform float uPulse;
  void main() {
    if (vAlive < 0.5) discard;
    vec3 root = vec3(1.0, 0.18, 0.62);
    vec3 middle = vec3(0.48, 0.36, 1.0);
    vec3 tip = vec3(0.18, 0.95, 1.0);
    vec3 grafted = vT < 0.5 ? mix(root, middle, vT * 2.0) : mix(middle, tip, (vT - 0.5) * 2.0);
    vec3 own = mix(vec3(0.14, 0.2, 0.55), vec3(0.28, 0.4, 0.86), vT);
    vec3 color = mix(mix(own, grafted, vGraft), vec3(1.0), vBand * 0.6);
    float alpha = mix(0.26, 0.62 + vT * 0.38, vGraft);
    gl_FragColor = vec4(color, alpha + vBand * 0.4 + uPulse * 0.4 * vGraft);
  }
`

/** Yüzeyin gerçek yönü; burun ve kaş ışıkta bu sayede kabarık görünür. */
const surfaceNormal = (dir: THREE.Vector3, point: THREE.Vector3) => {
  const side = new THREE.Vector3(0, 1, 0).cross(dir)
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
  side.normalize()
  const up = new THREE.Vector3().crossVectors(dir, side)
  const towards = (axis: THREE.Vector3) =>
    headSurface(dir.clone().addScaledVector(axis, 0.02).normalize(), new THREE.Vector3()).sub(point)
  return towards(side).cross(towards(up)).normalize().multiplyScalar(-1)
}

/** Lazer tarama gibi enlem halkaları; burun ve çene çizgilerde okunur. */
const buildShell = () => {
  const random = seeded(4711)
  const direction = new THREE.Vector3()
  const point = new THREE.Vector3()
  const positions: number[] = []
  const surfaces: number[] = []
  const seeds: number[] = []
  const scalp: number[] = []
  for (let row = 0; row < SHELL_RINGS; row += 1) {
    const y = 1 - (2 * (row + 0.5)) / SHELL_RINGS
    const radius = Math.sqrt(1 - y * y)
    const count = Math.max(8, Math.round(RING_POINTS * radius))
    for (let index = 0; index < count; index += 1) {
      const angle = ((index + row * 0.5) / count) * Math.PI * 2
      direction.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      headSurface(direction, point)
      surfaceNormal(direction, point).toArray(surfaces, surfaces.length)
      positions.push(point.x, point.y, point.z)
      seeds.push(random())
      scalp.push(isScalp(direction) ? 1 : 0)
    }
  }
  // Boyun ve omuz halkaları büstü tamamlar.
  for (let row = 0; row < BUST_RINGS; row += 1) {
    const progress = row / (BUST_RINGS - 1)
    const flare = progress ** 3
    for (let index = 0; index < BUST_POINTS; index += 1) {
      const angle = ((index + row * 0.5) / BUST_POINTS) * Math.PI * 2
      positions.push(
        Math.cos(angle) * (0.42 + flare * 1.05),
        -1.0 - progress * 0.95,
        Math.sin(angle) * (0.4 + flare * 0.34) - 0.12,
      )
      surfaces.push(Math.cos(angle), 0.25, Math.sin(angle))
      seeds.push(random())
      scalp.push(0)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aSurface', new THREE.Float32BufferAttribute(surfaces, 3))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('aScalp', new THREE.Float32BufferAttribute(scalp, 1))
  return geometry
}

/** Görünmez baş; arkadaki teller yüzün içinden görünmesin diye derinlik yazar. */
const buildOccluder = () => {
  const geometry = new THREE.IcosahedronGeometry(1, 14)
  const position = geometry.attributes.position
  const direction = new THREE.Vector3()
  const point = new THREE.Vector3()
  for (let index = 0; index < position.count; index += 1) {
    direction.fromBufferAttribute(position, index).normalize()
    headSurface(direction, point).multiplyScalar(0.985)
    position.setXYZ(index, point.x, point.y, point.z)
  }
  return geometry
}

const buildStrands = (areas: string[]) => {
  const random = seeded(90210)
  const direction = new THREE.Vector3()
  const root = new THREE.Vector3()
  const flow = new THREE.Vector3()
  const jitter = new THREE.Vector3()
  const positions: number[] = []
  const directions: number[] = []
  const flows: number[] = []
  const steps: number[] = []
  const seeds: number[] = []
  const grafts: number[] = []
  for (let made = 0; made < STRANDS; ) {
    randomDirection(random, direction)
    if (!isScalp(direction)) continue
    const graft = isGrafted(direction, areas) ? 1 : 0
    // Ekim bölgesi daha sık telle öne çıkar.
    if (!graft && random() < 0.45) continue
    headSurface(direction, root)
    // Teller tepeden dışa doğru taranır, önde hafif yana yatar.
    flow.copy(direction).multiplyScalar(direction.dot(CROWN)).sub(CROWN)
    flow.x += 0.25 * smooth(0.2, 0.9, direction.z)
    flow.normalize().addScaledVector(randomDirection(random, jitter), 0.18).normalize()
    const seed = random()
    for (const station of STATIONS) {
      positions.push(root.x, root.y, root.z)
      directions.push(direction.x, direction.y, direction.z)
      flows.push(flow.x, flow.y, flow.z)
      steps.push(station)
      seeds.push(seed)
      grafts.push(graft)
    }
    made += 1
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aDir', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flows, 3))
  geometry.setAttribute('aT', new THREE.Float32BufferAttribute(steps, 1))
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('aGraft', new THREE.Float32BufferAttribute(grafts, 1))
  return geometry
}

const ring = (radius: number, color: number, opacity: number, dashes = 0) => {
  const points: THREE.Vector3[] = []
  const steps = dashes || 128
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending })
  return dashes ? new THREE.LineSegments(geometry, material) : new THREE.Line(geometry, material)
}

interface Props {
  /** 0–1 iyileşme; tel boyu ve yoğunluğu bunu izler. */
  growth: number
  /** Hologramı sağa kaydırarak metne yer açar. */
  offset?: number
  /** Ameliyat kaydındaki ekim bölgeleri; bu teller parlar ve iyileşmeyle uzar. */
  areas?: string[]
}

export function HeadScan({ growth, offset = 0.55, areas = [] }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const target = useRef(growth)
  const [failed, setFailed] = useState(false)
  target.current = growth
  const zones = (areas.length ? areas : DEFAULT_AREAS).join('|')

  useEffect(() => {
    const element = host.current
    if (!element) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    } catch {
      setFailed(true)
      return
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
    renderer.setPixelRatio(ratio)
    renderer.setClearColor(0x000000, 0)
    element.append(renderer.domElement)
    renderer.domElement.className = 'head-canvas'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40)
    camera.position.set(0, 0.25, 7.2)

    const uniforms = {
      uTime: { value: 0 },
      uScan: { value: 0 },
      uPulse: { value: 0 },
      uGrowth: { value: 0 },
      uPixel: { value: ratio },
    }

    const rig = new THREE.Group()
    rig.position.x = offset
    scene.add(rig)

    const head = new THREE.Group()
    head.rotation.x = 0.06
    head.rotation.y = -0.6
    rig.add(head)

    const occluderGeometry = buildOccluder()
    const occluderMaterial = new THREE.MeshBasicMaterial({ colorWrite: false })
    head.add(new THREE.Mesh(occluderGeometry, occluderMaterial))

    const shellGeometry = buildShell()
    const shellMaterial = new THREE.ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    head.add(new THREE.Points(shellGeometry, shellMaterial))

    const strandGeometry = buildStrands(zones.split('|'))
    const strandMaterial = new THREE.ShaderMaterial({
      vertexShader: strandVertex,
      fragmentShader: strandFragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const strands = new THREE.LineSegments(strandGeometry, strandMaterial)
    strands.frustumCulled = false
    head.add(strands)

    const scanRing = ring(1.42, 0x2ef2ff, 0.8)
    const orbitA = ring(1.92, 0x7a5cff, 0.5, 96)
    const orbitB = ring(2.18, 0x2ef2ff, 0.24, 64)
    const base = ring(1.2, 0x2ef2ff, 0.5)
    const baseOuter = ring(1.62, 0x7a5cff, 0.36, 72)
    orbitA.rotation.set(0.42, 0, 0.26)
    orbitB.rotation.set(-0.36, 0, -0.2)
    base.position.y = -2
    baseOuter.position.y = -2
    rig.add(scanRing, orbitA, orbitB, base, baseOuter)

    const drag = { active: false, x: 0, spin: 0.0035 }
    const onDown = (event: PointerEvent) => {
      drag.active = true
      drag.x = event.clientX
    }
    const onMove = (event: PointerEvent) => {
      if (!drag.active) return
      const delta = event.clientX - drag.x
      drag.x = event.clientX
      head.rotation.y += delta * 0.011
      drag.spin = delta * 0.0011
    }
    const onUp = () => {
      drag.active = false
    }
    const canvas = renderer.domElement
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)

    const pulse = () => {
      uniforms.uPulse.value = 1
    }
    pulses.add(pulse)

    const resize = () => {
      const { width, height } = element.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      // Dar ekranda baş sığsın diye kamera geri çekilir.
      camera.position.z = camera.aspect < 0.95 ? 8.6 : 7.2
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(() => {
      resize()
      if (reduced) renderer.render(scene, camera)
    })
    observer.observe(element)
    resize()

    let frame = 0
    let onScreen = true
    const clock = new THREE.Clock()

    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05)
      const time = clock.elapsedTime
      uniforms.uTime.value = time
      uniforms.uGrowth.value += (target.current - uniforms.uGrowth.value) * 0.035
      uniforms.uPulse.value *= 0.94
      uniforms.uScan.value = Math.sin(time * 0.8) * 1.28 + 0.1
      scanRing.position.y = uniforms.uScan.value
      const radius = 1 - (uniforms.uScan.value / 1.5) ** 2 * 0.42
      scanRing.scale.set(radius, 1, radius)
      if (!drag.active) {
        drag.spin += (0.0035 - drag.spin) * 0.03
        head.rotation.y += drag.spin * (delta / 0.0166)
      }
      orbitA.rotation.y += delta * 0.32
      orbitB.rotation.y -= delta * 0.2
      baseOuter.rotation.y -= delta * 0.14
      rig.position.y = RIG_LIFT + Math.sin(time * 0.7) * 0.03
      renderer.render(scene, camera)
      if (onScreen && !reduced) frame = requestAnimationFrame(render)
    }

    const visibility = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting
      cancelAnimationFrame(frame)
      if (onScreen && !reduced) frame = requestAnimationFrame(render)
    })
    visibility.observe(element)

    if (reduced) {
      uniforms.uGrowth.value = target.current
      head.rotation.y = 0.5
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      pulses.delete(pulse)
      observer.disconnect()
      visibility.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      occluderGeometry.dispose()
      occluderMaterial.dispose()
      shellGeometry.dispose()
      shellMaterial.dispose()
      strandGeometry.dispose()
      strandMaterial.dispose()
      for (const line of [scanRing, orbitA, orbitB, base, baseOuter]) {
        line.geometry.dispose()
        ;(line.material as THREE.Material).dispose()
      }
      renderer.dispose()
      canvas.remove()
    }
  }, [offset, zones])

  if (failed) return <HairField currentWeek={78} />

  return <div ref={host} className="head-scan" role="img" aria-label="Ekim bölgendeki saçların iyileşme durumunu gösteren üç boyutlu tarama. Parmağınla çevirebilirsin." />
}
