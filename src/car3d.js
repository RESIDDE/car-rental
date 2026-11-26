import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const canvas = document.getElementById('car3d');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);
camera.position.set(4.6, 1.5, -4.2);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.45, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 4.5; controls.maxDistance = 9;
controls.minPolarAngle = 0.9; controls.maxPolarAngle = Math.PI / 2.05;
controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotateSpeed = 1.2;
canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });
canvas.addEventListener('dblclick', () => { controls.autoRotate = true; });

// paint colours cycle per fleet car
const PAINTS = [0xc9ccd1, 0x1d1f24, 0x2a6df4, 0xb0151d, 0xf2f2f2, 0x2f6b4f, 0x6b6f78];
const body = new THREE.MeshPhysicalMaterial({ color: PAINTS[0], metalness: 1, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.03 });
const details = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.3 });
const glass = new THREE.MeshPhysicalMaterial({ color: 0x111111, metalness: 0.25, roughness: 0, transmission: 1 });
let target = new THREE.Color(PAINTS[0]);
addEventListener('stagecar', e => { target = new THREE.Color(PAINTS[e.detail.i % PAINTS.length]); });

const draco = new DRACOLoader(); draco.setDecoderPath('/draco/');
const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
loader.load('/models/car.glb', gltf => {
  const car = gltf.scene.children[0];
  car.getObjectByName('body').material = body;
  ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim'].forEach(n => { const o = car.getObjectByName(n); if (o) o.material = details; });
  car.getObjectByName('glass').material = glass;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
    new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load('/models/car_ao.png'), blending: THREE.MultiplyBlending, toneMapped: false, transparent: true }));
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 2; car.add(shadow);
  scene.add(car);
  document.getElementById('carLoading').hidden = true;
}, undefined, () => { document.getElementById('carLoading').textContent = '3D car could not load'; });

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
renderer.setAnimationLoop(() => { resize(); body.color.lerp(target, 0.06); controls.update(); renderer.render(scene, camera); });
