import * as THREE from "vendor/three";

const containera = document.getElementById("viewport");
if (container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 4.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // placeholder geometry — swap this block for a GLTFLoader call once you
  // have a real .glb model, e.g.:
  //
  // import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
  // new GLTFLoader().load("../assets/models/yourmodel.glb", (gltf) => {
  //   scene.add(gltf.scene);
  // });

  const geometry = new THREE.IcosahedronGeometry(1.3, 1);
  const wireframe = new THREE.WireframeGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color: 0xe6e6e2, transparent: true, opacity: 0.85 });
  const mesh = new THREE.LineSegments(wireframe, material);
  scene.add(mesh);

  function animate() {
    requestAnimationFrame(animate);
    mesh.rotation.x += 0.0022;
    mesh.rotation.y += 0.0032;
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}
