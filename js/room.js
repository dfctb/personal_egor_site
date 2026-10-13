/* ROOM — полноэкранная 3D-сцена (three.js, ES modules).
   Прокрутка НЕ управляет камерой — это обычная прокрутка страницы.
   Камера сама «летает по-стрекозьи»: рывок к точке -> зависание -> следующий рывок, по кругу.
   Клик по предмету — камера подлетает к нему (полёт ставится на паузу), «back»/Esc — возвращает.

   Режимы URL:
     /pages/room.html?debug  — по клику пишет имя объекта (чтобы заполнить NAMES/LINKS)
     /pages/room.html?free   — свободная камера мышью; клик = копия точки, клавиша C = копия камеры
*/
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/* ============================================================
   НАСТРОЙКИ (всё, что стоит править, — в этом блоке)
   ============================================================ */
const MODEL_URL = '/assets/models/room-min.glb'
const SHADOW_SIZE = 4096      // качество теней: 2048 / 4096 (на телефонах будет 2048)
const MAX_DPR = 2             // потолок плотности пикселей (на телефонах 1.5)

// свет: подкручивай по вкусу
const SUN_INTENSITY = 0.3     // яркость «солнца» (оно даёт тени). Было 1.15
const FILL_INTENSITY = 0.07   // общая подсветка (меньше = контрастнее тени). Было 0.3
const ENV_INTENSITY = 0.12    // отражения/окружение. Было 0.45
const SUN_POS = [9, 17, 7]    // откуда светит солнце (x, y, z)
const SUN_AIM = [-3, 3, 0]    // куда оно светит

// светильник (торшер). Свет ставится автоматически в верх абажура.
const LAMP_ROOT = 'Cylinder'        // имя корневого объекта лампы (см. NAMES)
const LAMP_POS = null               // вручную: [x, y, z] — если авто-позиция не попала (в ?free клик по лампе печатает точку)
const LAMP_COLOR = 0xe8b8ff         // цвет света
const LAMP_INTENSITY = 90           // яркость света лампы
const LAMP_RADIUS = 18              // на каком расстоянии свет гаснет
const LAMP_GLOW = 1.1               // насколько светится сам абажур (0 = не светится)

// полёт камеры (секунды)
const HOVER = 2.2             // сколько камера «висит» в точке
const DART = 3.0              // сколько длится рывок до следующей точки
const JITTER = 0.07           // дрожание в зависании (0 = выкл)
const SHOW_CAPTIONS = true    // подписи ROOM / TURNTABLES / ... (false = скрыть все)

// внешний вид человечка. null = как в модели. Пример глянца:
// { roughness: 0.15, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }
const HUMAN_LOOK = null

// границы комнаты — камера не выходит за них при кликах
const MINB = new THREE.Vector3(-11.8, 1.2, -8.3)
const MAXB = new THREE.Vector3(9.0, 10.8, 8.0)
const ROOM_CENTER = new THREE.Vector3(-1.4, 5.5, 0)

// путь камеры (замкнутый круг): CAM[i] — где камера, LOOK[i] — куда смотрит.
// Первая точка = вид «наблюдателя» сзади, дальше камера летает по комнате и возвращается.
// Номер точки = data-wp у подписи в room.html.
const CAM = [
  [6.5, 6.2, 0.8],
  [3, 7.2, -4.5],
  [-1.5, 8.2, -4.0],
  [-5.5, 9.0, -3.8],
  [-8.6, 9.0, 0.8],
  [-5.5, 9.0, 5.6],
  [0, 7, 6.2],
  [2.5, 6.5, 2],
]
const LOOK = [
  [-8, 5.0, 0.6],
  [-8, 5.2, -0.5],
  [-9.5, 5.2, -1.3],
  [-10.7, 5.2, -1.3],
  [-10.5, 5.2, 0.8],
  [-10.8, 5.2, 3.0],
  [-7.4, 5.5, 0.6],
  [-3.2, 5.4, -6.2],
]

// Кнопки в меню под сценой: камера летит в указанную точку.
const SPOTS = [
  {
    label: 'mixer',
    pos: [-8.6, 9.0, 0.8],
    look: [-10.5, 5.2, 0.8],
    text: 'Dynacord CMS600 mixer',
    link: '',
  },
  {
    label: 'turntable 1',
    pos: [-5.5, 9.0, -3.8],
    look: [-10.7, 5.2, -1.3],
    text: 'Turntable',
    link: '',
  },
  {
    label: 'turntable 2',
    pos: [-5.5, 9.0, 5.6],
    look: [-10.8, 5.2, 3.0],
    text: 'Turntable',
    link: '',
  },
  {
    label: 'shelf',
    pos: [2.5, 6.5, 2],
    look: [-4.6, 5.5, -7],
    text: 'Records and gear',
    link: 'https://xeuqra.com/',
  },
]

// Ссылки на объекты (ключ = имя корневого объекта в Blender, видно при ?debug).
// Если url пустой — клик только двигает камеру.
const LINKS = {
  // 'Cube.016': { title: 'Wall unit', url: 'https://xeuqra.com/' },
}

// Подписи при клике (ключ = имя корневого объекта, см. ?debug)
const NAMES = {
  'Armature': 'The guy',
  'Sketchfab_model': 'Dynacord CMS600 mixer',
  'FACE.PLATE.lo res02.001_Baked': 'Mixer',
  'Cylinder': 'Floor lamp',
  'Cube.016': 'Wall unit',
  'Cube.098': 'Studio monitor',
  'Cube.099': 'Studio monitor',
  'Cube.108': 'Studio monitor',
  'pCube17': 'Vinyl',
  'pCube17.001': 'Vinyl',
}

// Эти корневые объекты некликабельны (стены, пол, ковёр)
const NO_CLICK = new Set(['Cube', 'Plane.001'])
// Эти корни не отбрасывают тень (оболочка комнаты, иначе она закроет свет)
const NO_SHADOW = new Set(['Cube'])

/* ============================================================
   DOM
   ============================================================ */
const $ = (id) => document.getElementById(id)
const q = new URLSearchParams(location.search)
const FREE = q.has('free')
const DEBUG = q.has('debug') || FREE

const header = $('top')
const stage = $('stage')
const canvas = $('c')
const msg = $('msg')
const caps = [...document.querySelectorAll('.cap')]
const backBtn = $('back')
const info = $('info')
const nmEl = $('nm')
const goEl = $('go')
const dbg = $('dbg')
const spotList = $('spot-list')

function setHeaderVar () {
  document.documentElement.style.setProperty('--hdr',
    header.offsetHeight + 'px')
}

setHeaderVar()
if (window.ResizeObserver) new ResizeObserver(setHeaderVar).observe(header)

function fail (t) {
  msg.textContent = t
  msg.classList.remove('hide')
}

/* ============================================================
   RENDERER / SCENE / СВЕТ
   ============================================================ */
let renderer
try {
  renderer = new THREE.WebGLRenderer(
    { canvas, antialias: true, powerPreference: 'high-performance' })
} catch (e) {
  fail('WebGL is not available on this device')
  throw e
}

const coarse = matchMedia('(pointer:coarse)').matches
const dpr = () => Math.min(devicePixelRatio || 1, coarse ? 1.5 : MAX_DPR)

if ('outputColorSpace' in
  renderer) renderer.outputColorSpace = THREE.SRGBColorSpace
else renderer.outputEncoding = THREE.sRGBEncoding
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
// человечек анимируется, поэтому тени пересчитываются каждый кадр (autoUpdate по умолчанию true)

// в three r155+ интенсивность света считается иначе (нет множителя π) — подстраиваемся
const LK = parseInt(THREE.REVISION, 10) >= 155 ? Math.PI : 1

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0b0b0b)
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200)

scene.environment = new THREE.PMREMGenerator(renderer).fromScene(
  new RoomEnvironment(), 0.04).texture
const hasEnvIntensity = 'environmentIntensity' in scene
if (hasEnvIntensity) scene.environmentIntensity = ENV_INTENSITY

scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b800, FILL_INTENSITY * LK))

const sun = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY * LK)
sun.position.set(...SUN_POS)
sun.target.position.set(...SUN_AIM)
sun.castShadow = true
const smap = Math.min(coarse ? 2048 : SHADOW_SIZE,
  renderer.capabilities.maxTextureSize || 2048)
sun.shadow.mapSize.set(smap, smap)
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.03
scene.add(sun, sun.target)

// плотно подгоняем камеру теней под комнату
;(function fitShadow () {
  sun.updateMatrixWorld()
  sun.target.updateMatrixWorld()
  const m = new THREE.Matrix4().lookAt(sun.position, sun.target.position,
    new THREE.Vector3(0, 1, 0))
  const e = m.elements
  const X = new THREE.Vector3(e[0], e[1], e[2]),
    Y = new THREE.Vector3(e[4], e[5], e[6]),
    Z = new THREE.Vector3(e[8], e[9], e[10])
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], r = new THREE.Vector3()
  for (const x of [-12.5, 9.6]) for (const y of [
    0.5,
    11.5]) for (const z of [-9, 8.8]) {
    r.set(x, y, z).sub(sun.position)
    const l = [r.dot(X), r.dot(Y), r.dot(Z)]
    for (let i = 0; i < 3; i++) {
      mn[i] = Math.min(mn[i], l[i])
      mx[i] = Math.max(mx[i], l[i])
    }
  }
  const c = sun.shadow.camera
  c.left = mn[0] - 0.5
  c.right = mx[0] + 0.5
  c.bottom = mn[1] - 0.5
  c.top = mx[1] + 0.5
  c.near = Math.max(0.5, -mx[2] - 1)
  c.far = -mn[2] + 1
  c.updateProjectionMatrix()
})()

/* ============================================================
   ПУТЬ КАМЕРЫ / СОСТОЯНИЕ
   ============================================================ */
const V = (a) => new THREE.Vector3(a[0], a[1], a[2])
const camPts = CAM.map(V), lookPts = LOOK.map(V)
const camCurve = new THREE.CatmullRomCurve3(camPts, true, 'catmullrom', 0.5)
const lookCurve = new THREE.CatmullRomCurve3(lookPts, true, 'catmullrom', 0.5)

let mx = 0, my = 0, flyT = 0
let ready = false, world = null, visible = true, mixer = null
let focus = null, humanMesh = null
const camPos = camPts[0].clone(), camLook = lookPts[0].clone()
const tmpP = new THREE.Vector3(), tmpL = new THREE.Vector3(),
  tmpV = new THREE.Vector3()

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const N = camPts.length

// Положение «стрекозы» в момент t: сначала зависание в точке from, потом рывок к from+1.
// Результат пишет в tmpP / tmpL.
function flightAt (t) {
  const cycle = HOVER + DART
  const k = Math.floor(t / cycle)
  const within = t - k * cycle
  const f = clamp01((within - HOVER) / DART)
  const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2
  const from = k % N
  const u = (from + e) / N
  camCurve.getPoint(u, tmpP)
  lookCurve.getPoint(u, tmpL)
  return { from, hovering: within < HOVER }
}

addEventListener('mousemove', (e) => {
  mx = e.clientX / innerWidth - 0.5
  my = e.clientY / innerHeight - 0.5
}, { passive: true })

function resize () {
  const w = stage.clientWidth, h = stage.clientHeight
  if (!w || !h) return
  renderer.setPixelRatio(dpr())
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.fov = w / h < 0.9 ? 78 : 60
  camera.updateProjectionMatrix()
}

if (window.ResizeObserver) new ResizeObserver(resize).observe(stage)
addEventListener('resize', resize)
resize()

if (window.IntersectionObserver) {
  new IntersectionObserver((en) => { visible = en[0].isIntersecting }).observe(
    stage)
}

/* ============================================================
   КЛИКИ: камера летит к объекту
   ============================================================ */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(),
  box = new THREE.Box3()
const YAXIS = new THREE.Vector3(0, 1, 0)
const meshBoxes = []

const rootOf = (o) => {
  while (o && o.parent && o.parent !== world) o = o.parent
  return o
}
const nameOf = (root) => (root &&
  ((root.userData && root.userData.name) || root.name)) || ''
const within = (o, anc) => {
  while (o) {
    if (o === anc) return true
    o = o.parent
  }
  return false
}
const inRoom = (p) => p.x >= MINB.x && p.x <= MAXB.x && p.y >= MINB.y && p.y <=
  MAXB.y && p.z >= MINB.z && p.z <= MAXB.z
const safeUrl = (u) => (typeof u === 'string' &&
  /^(https?:\/\/|mailto:)/i.test(u.trim())) ? u.trim() : ''

// bbox объекта; для скинированной модели (человечек) считаем по костям — так надёжнее во всех версиях three
function boxOf (obj, out = new THREE.Box3()) {
  let skinned = null
  obj.traverse((o) => { if (o.isSkinnedMesh) skinned = o })
  if (skinned) {
    out.makeEmpty()
    skinned.skeleton.bones.forEach(
      (b) => out.expandByPoint(b.getWorldPosition(tmpV)))
    return out.expandByScalar(0.8)
  }
  return out.setFromObject(obj)
}

// что кадрировать: поднимаемся от меша вверх, пока группа остаётся «размером с предмет»
function unitOf (o) {
  let u = o
  const b = new THREE.Box3(), s = new THREE.Vector3()
  while (u.parent && u.parent !== world) {
    boxOf(u.parent, b).getSize(s)
    if (Math.max(s.x, s.y, s.z) > 7.5) break
    u = u.parent
  }
  return u
}

function pick (cx, cy) {
  if (!world) return null
  const r = canvas.getBoundingClientRect()
  ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  let best = null
  for (const h of ray.intersectObject(world, true)) {
    if (!NO_CLICK.has(nameOf(rootOf(h.object)))) {
      best = h
      break
    }
  }
  // запасной вариант для человечка: если луч попал в бокс костей раньше любого меша
  if (humanMesh) {
    const hb = boxOf(rootOf(humanMesh))
    const pt = ray.ray.intersectBox(hb, new THREE.Vector3())
    if (pt) {
      const d = pt.distanceTo(ray.ray.origin)
      if (!best || d < best.distance) best = {
        object: humanMesh,
        distance: d,
        point: pt,
      }
    }
  }
  return best
}

function showInfo (label, url) {
  nmEl.textContent = label
  nmEl.style.display = label ? '' : 'none'
  info.classList.add('show')
  backBtn.classList.add('show')
  if (url) {
    goEl.href = url
    goEl.classList.add('show')
  } else {
    goEl.classList.remove('show')
    goEl.removeAttribute('href')
  }
}

function focusOn (hit) {
  const root = rootOf(hit.object), nm = nameOf(root)
  if (NO_CLICK.has(nm)) return
  const unit = unitOf(hit.object)
  boxOf(unit, box)
  const c = box.getCenter(new THREE.Vector3()),
    sz = box.getSize(new THREE.Vector3())
  const m = Math.max(sz.x, sz.y, sz.z, 1.5)
  const dir = new THREE.Vector3().subVectors(ROOM_CENTER, c)
  dir.y = 0
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1)
  dir.normalize()
  const base = Math.min(8, Math.max(3.5, m * 1.5))
  let best = null, bestScore = 1e9
  const angs = [0, 35, -35, 70, -70, 105, -105, 140, -140, 180],
    dists = [1, 0.8, 0.65, 1.25]
  for (const a of angs) {
    for (const d of dists) {
      const p = c.clone().
        addScaledVector(dir.clone().applyAxisAngle(YAXIS, a * Math.PI / 180),
          base * d)
      p.y = Math.min(MAXB.y, Math.max(MINB.y, c.y + 0.8))
      if (!inRoom(p)) continue
      let score = Math.abs(a) / 180 * 2 + Math.abs(d - 1)
      for (const mb of meshBoxes) {
        if (within(mb.mesh, unit)) continue
        if (mb.box.distanceToPoint(p) < 0.5) score += 10
      }
      if (score < bestScore) {
        bestScore = score
        best = p
      }
    }
  }
  if (!best) {
    best = c.clone().addScaledVector(dir, Math.min(base, 6))
    best.clamp(MINB, MAXB)
  }
  const L = LINKS[nm] || {}
  let label = L.title || NAMES[nm] || ''
  if (DEBUG) label = (label ? label + '  ' : '') + '[' + nm + ']'
  focus = { pos: best, look: c }
  showInfo(label, safeUrl(L.url))
}

function focusSpot (s) {
  focus = { pos: V(s.pos), look: V(s.look) }
  showInfo(s.text ? `${s.label} — ${s.text}` : s.label, safeUrl(s.link))
}

function clearFocus () {
  focus = null
  backBtn.classList.remove('show')
  info.classList.remove('show')
  goEl.classList.remove('show')
}

backBtn.addEventListener('click', clearFocus)
addEventListener('keydown', (e) => { if (e.key === 'Escape') clearFocus() })

let down = null
canvas.addEventListener('pointerdown',
  (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() } })
canvas.addEventListener('pointerup', (e) => {
  if (!down || !ready) {
    down = null
    return
  }
  const dx = e.clientX - down.x, dy = e.clientY - down.y,
    quick = performance.now() - down.t < 500
  down = null
  if (dx * dx + dy * dy >= 64 || !quick) return
  const h = pick(e.clientX, e.clientY)
  if (FREE) {
    if (h) out(`at: ${JSON.stringify(
      h.point.toArray().map((n) => +n.toFixed(2)))}  // ${nameOf(
      rootOf(h.object))} / ${h.object.name}`)
  } else if (h) focusOn(h)
})
let hoverBusy = false
canvas.addEventListener('pointermove', (e) => {
  if (!ready || hoverBusy || e.pointerType === 'touch' || FREE) return
  hoverBusy = true
  const x = e.clientX, y = e.clientY
  setTimeout(() => {
    canvas.style.cursor = pick(x, y) ? 'pointer' : 'default'
    hoverBusy = false
  }, 60)
})

// меню под сценой
SPOTS.forEach((s, i) => {
  const li = document.createElement('li')
  li.innerHTML = `<span class="key">[${i + 1}]</span><a href="#">${s.label}</a>`
  li.querySelector('a').addEventListener('click', (e) => {
    e.preventDefault()
    stage.scrollIntoView({ block: 'start' })
    focusSpot(s)
  })
  spotList.appendChild(li)
})

/* ============================================================
   РЕЖИМ ?free: узнать координаты
   ============================================================ */
let controls = null

function out (t) {
  console.log(t)
  navigator.clipboard?.writeText(t)
  dbg.hidden = false
  dbg.textContent = t
}

if (FREE) {
  controls = new OrbitControls(camera, canvas)
  controls.target.copy(lookPts[0])
  camera.position.copy(camPts[0])
  controls.update()
  dbg.hidden = false
  dbg.textContent = 'free: click = copy point, C = copy camera'
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'c') return
    const f = (a) => JSON.stringify(a.map((n) => +n.toFixed(2)))
    out(`cam: ${f(camera.position.toArray())}, look: ${f(
      controls.target.toArray())}`)
  })
}

/* ============================================================
   ЦИКЛ
   ============================================================ */
let last = performance.now()

function frame (now) {
  requestAnimationFrame(frame)
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (!ready || !visible || document.hidden) return
  if (mixer) mixer.update(dt)

  if (FREE) {
    controls.update()
  } else {
    let wantP, wantL, fl = null
    if (focus) {
      wantP = focus.pos
      wantL = focus.look
    } else {
      flyT += dt
      fl = flightAt(flyT)
      wantP = tmpP
      wantL = tmpL
      if (JITTER) {
        wantP.x += Math.sin(flyT * 2.3) * JITTER + Math.sin(flyT * 5.1) * JITTER * 0.4
        wantP.y += Math.sin(flyT * 1.7 + 1) * JITTER
        wantP.z += Math.cos(flyT * 2.9) * JITTER
        wantL.x += Math.sin(flyT * 1.9 + 2) * JITTER * 0.8
        wantL.y += Math.cos(flyT * 2.2) * JITTER * 0.5
      }
    }
    const k = 1 - Math.exp(-dt * (focus ? 3.5 : 7))
    camPos.lerp(wantP, k)
    camLook.lerp(wantL, k)
    camera.position.copy(camPos)
    camera.position.x += mx * 0.6
    camera.position.y -= my * 0.4
    camera.lookAt(camLook)

    caps.forEach((c) => c.classList.toggle('on',
      SHOW_CAPTIONS && !!fl && fl.hovering &&
      parseInt(c.getAttribute('data-wp'), 10) === fl.from))
  }
  renderer.render(scene, camera)
}

/* ============================================================
   СВЕТИЛЬНИК: точечный свет + светящийся абажур
   ============================================================ */
function setupLamp () {
  const lamp = world.children.find((c) => nameOf(c) === LAMP_ROOT)
  let pos = null
  if (LAMP_POS) {
    pos = V(LAMP_POS)
  } else if (lamp) {
    const lb = new THREE.Box3().setFromObject(lamp)
    const h = lb.max.y - lb.min.y
    const c = lb.getCenter(new THREE.Vector3())
    pos = new THREE.Vector3(c.x, lb.max.y - h * 0.22, c.z)
  } else {
    console.warn('lamp root "' + LAMP_ROOT + '" not found; set LAMP_POS')
    return
  }
  const modern = LK > 1
  const light = new THREE.PointLight(LAMP_COLOR,
    modern ? LAMP_INTENSITY : 1.2, LAMP_RADIUS, modern ? 2 : 1)
  light.position.copy(pos)
  scene.add(light)

  // светим только верхнюю часть лампы (абажур); материалы клонируем, чтобы не засветить другие объекты
  if (lamp && LAMP_GLOW > 0) {
    const lb = new THREE.Box3().setFromObject(lamp)
    const cut = lb.min.y + (lb.max.y - lb.min.y) * 0.6
    const mb = new THREE.Box3(), mc = new THREE.Vector3()
    const glow = (m) => {
      if (!m.emissive) return m
      const g = m.clone()
      g.emissive.copy(g.color)
      if (g.map) g.emissiveMap = g.map
      g.emissiveIntensity = LAMP_GLOW
      return g
    }
    lamp.traverse((o) => {
      if (!o.isMesh) return
      mb.setFromObject(o).getCenter(mc)
      if (mc.y < cut) return
      o.material = Array.isArray(o.material) ? o.material.map(glow) : glow(o.material)
    })
  }
}

/* ============================================================
   ЗАГРУЗКА МОДЕЛИ
   ============================================================ */
async function makeLoader () {
  const loader = new GLTFLoader()
  // декодеры подключаем «мягко»: если файла нет — просто работаем без них
  try {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js')
    const d = new DRACOLoader()
    d.setDecoderPath('/js/vendor/three/examples/jsm/libs/draco/gltf/')
    loader.setDRACOLoader(d)
  } catch (e) { console.warn('Draco decoder unavailable', e) }
  try {
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js')
    loader.setMeshoptDecoder(MeshoptDecoder)
  } catch (e) { console.warn('Meshopt decoder unavailable', e) }
  return loader
}

// rootOf, но до того как world присвоен (нужно при обходе сразу после загрузки)
function rootOfIn (rootScene, o) {
  while (o && o.parent && o.parent !== rootScene) o = o.parent
  return o
}

makeLoader().then((loader) => loader.load(MODEL_URL, (gltf) => {
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return
    if (o.isSkinnedMesh) {
      o.frustumCulled = false
      humanMesh = humanMesh || o
    }
    if (HUMAN_LOOK && o.isSkinnedMesh && !Array.isArray(o.material)) {
      const old = o.material
      o.material = new THREE.MeshPhysicalMaterial(
        { color: old.color, map: old.map, ...HUMAN_LOOK })
    }
    const nm = nameOf(rootOfIn(gltf.scene, o))
    o.castShadow = !NO_SHADOW.has(nm)
    o.receiveShadow = true
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    mats.forEach((m) => {
      m.side = THREE.DoubleSide
      if (!hasEnvIntensity &&
        m.isMeshStandardMaterial) m.envMapIntensity = (m.metalness > 0.5)
        ? 1.1
        : ENV_INTENSITY
      m.needsUpdate = true
    })
  })
  world = gltf.scene
  scene.add(world)
  world.updateMatrixWorld(true)

  world.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return
    const r = rootOf(o)
    if (!r || NO_CLICK.has(nameOf(r))) return
    meshBoxes.push({ mesh: o, box: new THREE.Box3().setFromObject(o) })
  })

  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(world)
    gltf.animations.forEach((a) => mixer.clipAction(a).play())
  }
  setupLamp()
  ready = true
  msg.classList.add('hide')
}, (e) => {
  if (e.lengthComputable) msg.textContent = 'loading scene… ' +
    Math.round(e.loaded / e.total * 100) + '%'
}, (err) => {
  console.error(err)
  fail('could not read the 3D scene')
})).catch((err) => {
  console.error(err)
  fail('could not start the 3D scene')
})

requestAnimationFrame(frame)
