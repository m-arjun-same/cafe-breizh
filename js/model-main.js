/* Café Breizh — hero: ONE real 3D croissant (GLB mesh, Three.js).
   Same engine as the approved hero sample, scoped to the main page's
   hero section. No particles. Controls: Pulse, Pause/Play spin,
   Light/Dark (hero only), drag to turn, gentle mouse parallax. */
import * as THREE from 'three';
import { GLTFLoader } from '../assets/vendor/three/GLTFLoader.js';
import { RoomEnvironment } from '../assets/vendor/three/RoomEnvironment.js';
import { MeshoptDecoder } from '../assets/vendor/three/meshopt_decoder.module.js';

var section = document.querySelector('.s-hero--model');
var canvas = document.querySelector('[data-hero-gl]');
var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

var scene = new THREE.Scene();
var pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0.6, 5.2);
camera.lookAt(0, -0.05, 0);

var key = new THREE.DirectionalLight(0xfff1d6, 2.2);
key.position.set(2.5, 3.5, 3);
scene.add(key);
var rim = new THREE.DirectionalLight(0xfe8826, 0.9);
rim.position.set(-3, 1.2, -2.5);
scene.add(rim);
scene.add(new THREE.AmbientLight(0xfff6e8, 0.35));

var holder = new THREE.Group();
scene.add(holder);

var loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.load('assets/models/croissant.glb', function (gltf) {
  var model = gltf.scene;
  var box = new THREE.Box3().setFromObject(model);
  var size = box.getSize(new THREE.Vector3());
  var centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre);
  var s = 2.8 / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(s);
  holder.add(model);
}, undefined, function () { section.classList.add('no-gl'); });

/* soft contact shadow */
var shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1.05, 40),
  new THREE.MeshBasicMaterial({ color: 0x60150d, transparent: true, opacity: 0.10, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -0.88;
shadow.scale.set(1.25, 1, 1);
scene.add(shadow);

/* state + controls */
var spinning = true, pulseT = -1, velY = 0, targetRX = 0.32, dragging = false, lastX = 0, lastY = 0;
var parX = 0, parY = 0;
holder.rotation.x = targetRX;

var pauseBtn = document.querySelector('[data-hero-pause]');
var playBtn = document.querySelector('[data-hero-play]');
pauseBtn.addEventListener('click', function () { spinning = false; syncSpin(); });
playBtn.addEventListener('click', function () { spinning = true; syncSpin(); });
function syncSpin() {
  pauseBtn.classList.toggle('is-off', !spinning);
  playBtn.classList.toggle('is-off', spinning);
  if (window.innerWidth <= 760) {
    pauseBtn.innerHTML = spinning ? 'Pause Spin ❚❚' : 'Play Spin ▷';
    pauseBtn.classList.toggle('is-off', false);
    pauseBtn.onclick = function () { spinning = !spinning; syncSpin(); };
  }
}
document.querySelector('[data-hero-pulse]').addEventListener('click', function () { pulseT = 0; });
document.querySelector('[data-hero-theme]').addEventListener('click', function () {
  section.classList.toggle('is-dark');
});

canvas.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; lastY = e.clientY; });
window.addEventListener('pointerup', function () { dragging = false; });
window.addEventListener('pointermove', function (e) {
  if (!dragging) return;
  velY = (e.clientX - lastX) * 0.005;
  holder.rotation.y += velY;
  targetRX = THREE.MathUtils.clamp(targetRX + (e.clientY - lastY) * 0.004, -0.4, 1.1);
  lastX = e.clientX; lastY = e.clientY;
});
section.addEventListener('pointermove', function (e) {
  var r = section.getBoundingClientRect();
  parX = ((e.clientX - r.left) / r.width) * 2 - 1;
  parY = ((e.clientY - r.top) / r.height) * 2 - 1;
});

var fit = 1;
function resize() {
  var w = section.clientWidth, h = section.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  var visibleW = 2 * 5.2 * Math.tan(THREE.MathUtils.degToRad(19)) * camera.aspect;
  fit = Math.min(1, (visibleW * 0.92) / 2.8);
  holder.scale.setScalar(fit);
  shadow.scale.set(1.25 * fit, fit, 1);
  shadow.position.y = camera.aspect < 1 ? -0.55 : -0.88;
}
window.addEventListener('resize', resize);
resize();
syncSpin();

/* render only while the hero is on screen */
var visible = true;
new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(section);

var clock = new THREE.Clock();
(function tick() {
  requestAnimationFrame(tick);
  if (!visible) return;
  var t = clock.getElapsedTime();
  if (!dragging) {
    if (spinning) holder.rotation.y += 0.005 + velY;
    velY *= 0.95;
  }
  holder.rotation.x += (targetRX - holder.rotation.x) * 0.06 + parY * 0.0006;
  holder.rotation.z = parX * -0.03;
  holder.position.y = Math.sin(t * 1.1) * 0.07;
  holder.position.x = parX * 0.08;
  if (pulseT >= 0) {
    pulseT += 0.045;
    var k = Math.sin(Math.min(pulseT, 1) * Math.PI);
    holder.scale.y = fit * (1 - k * 0.13);
    holder.scale.x = holder.scale.z = fit * (1 + k * 0.07);
    if (pulseT >= 1) { pulseT = -1; holder.scale.setScalar(fit); }
  }
  shadow.material.opacity = 0.10 + Math.sin(t * 1.1) * 0.018;
  renderer.render(scene, camera);
})();
