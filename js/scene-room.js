import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const container = document.getElementById('room')

if (container) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
  } catch (e) {
    console.warn('WebGL unavailable:', e)
    container.style.display = 'none'
  }

  if (renderer) {
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x111111)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    camera.position.set(4, 3, 6)

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.style.touchAction = 'pan-y'
    container.appendChild(renderer.domElement)

    // отражения для блестящих материалов (твой фиолетовый человечек)
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    // свет (подкрути значения по вкусу)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.5)
    sun.position.set(3, 6, 4)
    scene.add(sun)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableZoom = false
    controls.enablePan = false
    controls.enableDamping = true
    controls.minPolarAngle = Math.PI * 0.2   // чтобы нельзя было уйти под пол
    controls.maxPolarAngle = Math.PI * 0.55

    function resize () {
      const w = container.clientWidth, h = container.clientHeight
      if (!w || !h) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    new ResizeObserver(resize).observe(container)
    resize()

    // ---- загрузка модели ----
    const draco = new DRACOLoader()
    draco.setDecoderPath('/js/vendor/three/examples/jsm/libs/draco/gltf/')
    const loader = new GLTFLoader()
    loader.setDRACOLoader(draco)

    let mixer = null

    loader.load(
      '/assets/models/room-min.glb',
      (gltf) => {
        const root = gltf.scene
        scene.add(root)

        // подгоняем камеру под размер сцены
        const box = new THREE.Box3().setFromObject(root)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const radius = size.length() / 2
        const dist = radius /
          Math.sin(THREE.MathUtils.degToRad(camera.fov) / 2)

        camera.near = dist / 100
        camera.far = dist * 100
        camera.position.copy(center).
          add(new THREE.Vector3(0.6, 0.45, 1).normalize().
            multiplyScalar(dist * 0.75))
        camera.updateProjectionMatrix()
        controls.target.copy(center)
        controls.update()

        // анимация человечка
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(root)
          gltf.animations.forEach((clip) => mixer.clipAction(clip).play())
        }
      },
      undefined,
      (err) => console.error('failed to load room.glb:', err),
    )

    // ---- рендер только пока блок виден ----
    let visible = true
    new IntersectionObserver(([e]) => { visible = e.isIntersecting }).observe(
      container)

    const clock = new THREE.Clock()
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta()
      if (!visible || document.hidden) return
      if (mixer) mixer.update(dt)
      controls.update()
      renderer.render(scene, camera)
    })
  }
}