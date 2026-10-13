import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const container = document.getElementById('viewport')

if (container) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  } catch (e) {
    console.warn('WebGL unavailable:', e)
    container.style.display = 'none'
  }

  if (renderer) {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(0, 1, 6.5)

    // pivot — то, что вращается; модель внутри него отцентрована
    const pivot = new THREE.Group()
    scene.add(pivot)
    let currentRadius = 0

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.touchAction = 'pan-y'
    container.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableZoom = false
    controls.enablePan = false

    function fitCamera () {
      if (!currentRadius) return
      const vFov = THREE.MathUtils.degToRad(camera.fov)
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
      const dist = (currentRadius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.1

      camera.near = dist / 100
      camera.far = dist * 100
      camera.position.set(0, currentRadius * 0.15, dist)
      camera.updateProjectionMatrix()

      controls.target.set(0, 0, 0)
      controls.update()
    }

    function resize () {
      const w = container.clientWidth
      const h = container.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      renderer.setSize(w, h)
      camera.updateProjectionMatrix()
      fitCamera()
    }

    new ResizeObserver(resize).observe(container)
    resize()

    // ---- тема ----
    const COLORS = {
      light: { fill: 0x000000, edge: 0xffb000 },
      dark: { fill: 0xffffff, edge: 0x000000 },
      valve: { fill: 0x2b3126, edge: 0xc4b550 },   // тёмно-зелёная модель, золотые рёбра
    }
    const fillMat = new THREE.MeshBasicMaterial()
    const edgeMat = new THREE.LineBasicMaterial()

    function applyModelTheme () {
      const c = COLORS[document.documentElement.dataset.theme] || COLORS.valve
      fillMat.color.set(c.fill)
      edgeMat.color.set(c.edge)
    }

    applyModelTheme()
    new MutationObserver(applyModelTheme).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-theme'] })

    // ---- модели ----
    const MODELS = ['new logo', 'old logo']       // первая — по умолчанию
    const loader = new GLTFLoader()
    const cache = {}                        // name -> { model, radius }
    let loadToken = 0

    let currentName = MODELS[0]
    try {
      const saved = localStorage.getItem('model')
      if (MODELS.includes(saved)) currentName = saved
    } catch (e) {
    }

    const toggleBtn = document.getElementById('model-toggle')

    function updateButton () {
      if (toggleBtn) toggleBtn.textContent = `[ model: ${currentName} ]`
    }

    function prepare (gltf) {
      const model = gltf.scene
      model.traverse((child) => {
        if (child.isMesh) {
          child.material = fillMat
          const edges = new THREE.EdgesGeometry(child.geometry, 15)
          child.add(new THREE.LineSegments(edges, edgeMat))
        }
      })
      // центрируем в origin
      const center = new THREE.Box3().setFromObject(model).
        getCenter(new THREE.Vector3())
      model.position.sub(center)

      // радиус считаем один раз, пока модель не повёрнута
      const size = new THREE.Box3().setFromObject(model).
        getSize(new THREE.Vector3())
      return { model, radius: size.length() / 2 }
    }

    function showModel (name) {
      const token = ++loadToken               // защита от быстрых кликов

      const apply = (entry) => {
        if (token !== loadToken) return
        pivot.clear()
        pivot.rotation.set(0, 0, 0)
        pivot.add(entry.model)
        currentRadius = entry.radius
        fitCamera()
      }

      if (cache[name]) {
        apply(cache[name])
        return
      }

      loader.load(
        `/assets/models/${name}.glb`,
        (gltf) => {
          cache[name] = prepare(gltf)
          apply(cache[name])
        },
        undefined,
        (err) => console.error(`failed to load ${name}.glb:`, err),
      )
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        currentName = MODELS[(MODELS.indexOf(currentName) + 1) % MODELS.length]
        try {
          localStorage.setItem('model', currentName)
        } catch (e) {
        }
        updateButton()
        showModel(currentName)
      })
    }

    updateButton()
    showModel(currentName)

    // ---- рендер ----
    let visible = true
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
    }).observe(container)

    const clock = new THREE.Clock()
    renderer.setAnimationLoop(() => {
      if (!visible || document.hidden) return
      pivot.rotation.x = Math.sin(clock.getElapsedTime() * 2) * 0.05
      pivot.rotation.y += 0.009
      renderer.render(scene, camera)
    })
  }
}
