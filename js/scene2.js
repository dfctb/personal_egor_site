import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const container = document.getElementById("viewport");

if (container) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.warn("WebGL unavailable:", e);
    container.style.display = "none";   // или покажи статичную картинку
  }

  if (renderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1, 6.5);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.touchAction = "pan-y"; // скролл страницы на телефоне
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    new ResizeObserver(resize).observe(container);
    resize();

    const COLORS = {
      light: { fill: 0x000000, edge: 0xffb000 },  // чёрная модель, янтарные рёбра
      dark:  { fill: 0xffffff, edge: 0x000000 },  // белая модель, тёмно-янтарные рёбра
    };
    const fillMat = new THREE.MeshBasicMaterial();
    const edgeMat = new THREE.LineBasicMaterial();

    function applyModelTheme() {
      const c = COLORS[document.documentElement.dataset.theme === "dark" ? "dark" : "light"];
      fillMat.color.set(c.fill);
      edgeMat.color.set(c.edge);
    }
    applyModelTheme();
    new MutationObserver(applyModelTheme)
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    let rotatingObject = null;
    new GLTFLoader().load(
      "/assets/models/logo.glb",
      (gltf) => {
        rotatingObject = gltf.scene;
        rotatingObject.traverse((child) => {
          if (child.isMesh) {
            child.material = fillMat;
            const edges = new THREE.EdgesGeometry(child.geometry, 15);
            child.add(new THREE.LineSegments(edges, edgeMat));
          }
        });
        scene.add(rotatingObject);
      },
      undefined,
      (err) => console.error("failed to load logo.glb:", err)
    );

    // рендерим только пока блок виден
    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; })
      .observe(container);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (!visible || document.hidden) return;
      if (rotatingObject) {
        rotatingObject.rotation.x = Math.sin(clock.getElapsedTime() * 2) * 0.05;
        rotatingObject.rotation.y += 0.009;
      }
      renderer.render(scene, camera);
    });
  }
}
