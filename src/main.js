/**
 * main.js
 * Orchestrator. Boots Three.js + Cannon-es, wires up the world.
 */

import '../style.css';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

import { createControls } from './controls.js';
import { createAudioSystem } from './audio.js';
import { buildTerrain } from './terrain.js';
import { createVehicle } from './vehicle.js';
import { createMonuments, checkMonumentCollision } from './monuments.js';
import { createModalManager, createAudioGate } from './modals.js';

function showFatal(message) {
  console.error('[fatal]', message);
  const gate = document.getElementById('audioGate');
  if (!gate) return;
  const card = gate.querySelector('.gate__card');
  if (card) {
    card.innerHTML = `
      <div class="gate__eyebrow" style="color:#ff7a7a">RUNTIME ERROR</div>
      <h1 class="gate__title" style="font-size:24px">Could not start the scene</h1>
      <pre class="gate__body" style="font-family:ui-monospace,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;color:#ffb3b3;background:rgba(0,0,0,0.35);padding:12px;border-radius:8px;max-height:240px;overflow:auto">${message.replace(/</g,'&lt;')}</pre>
      <div class="gate__foot">Open the browser devtools console for the full stack.</div>
    `;
  }
}

window.addEventListener('error', (e) => { showFatal(`${e.message}\n  at ${e.filename}:${e.lineno}:${e.colno}`); });
window.addEventListener('unhandledrejection', (e) => { showFatal(`Unhandled promise rejection: ${e.reason && e.reason.message ? e.reason.message : e.reason}`); });

try { bootstrap(); } catch (err) { showFatal(err && err.stack ? err.stack : String(err)); }

function bootstrap() {

const stage = document.getElementById('stage');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 5.8, 63);
camera.lookAt(0, 0, 45);

const listener = new THREE.AudioListener();
camera.add(listener);
const audio = createAudioSystem(listener);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = false;
world.defaultContactMaterial.friction = 0.95;
world.defaultContactMaterial.restitution = 0.0;

const { groundBody, koiGroup, codeSnippets } = buildTerrain(scene, world);

const car = createVehicle({ scene, world, spawn: new THREE.Vector3(0, 0.4, 50) });
const monuments = createMonuments(scene);

const controls = createControls(window);
const modals = createModalManager();

let simPaused = false;
let lastMonumentHit = null;

modals.onOpen(() => { simPaused = true; car.setControlsEnabled(false); });
modals.onClose(() => {
  car.pushBack(5);
  car.setControlsEnabled(true);
  simPaused = false;
  lastMonumentHit = null;
});

createAudioGate(async () => { await audio.start(); });

const distEl = document.getElementById('distValue');
const distFill = document.getElementById('distFill');
const zoneEl = document.getElementById('zoneLabel');
const brandMark = document.querySelector('.hud__brand-mark');

const CORE_RADIUS_VIS = 26;
const RIM_OUTER_VIS = 42;

const camTarget = new THREE.Vector3();
const camDesired = new THREE.Vector3();
const camOffset = new THREE.Vector3(0, 5.2, 11);
const camLookOffset = new THREE.Vector3(0, 1.0, -4);

function updateCamera(dt) {
  camDesired.copy(car.group.position);
  const yaw = car.group.rotation.y;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const ox = camOffset.x * cos + camOffset.z * sin;
  const oz = -camOffset.x * sin + camOffset.z * cos;
  camDesired.x += ox; camDesired.z += oz; camDesired.y += camOffset.y;
  camera.position.lerp(camDesired, 1 - Math.exp(-dt * 8));
  camTarget.copy(car.group.position);
  camTarget.x += camLookOffset.x * cos + camLookOffset.z * sin;
  camTarget.z += -camLookOffset.x * sin + camLookOffset.z * cos;
  camTarget.y += camLookOffset.y;
  camera.lookAt(camTarget);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

const FIXED_DT = 1 / 60;
const MAX_SUB_STEPS = 4;
let lastT = performance.now();
let elapsed = 0;

function tick(now) {
  requestAnimationFrame(tick);
  const dtMs = Math.min(now - lastT, 100);
  lastT = now;
  const dt = dtMs / 1000;
  elapsed += dt;

  if (!simPaused) {
    world.step(FIXED_DT, dt, MAX_SUB_STEPS);
    car.update(dt, controls.state);
  } else {
    car.group.position.set(car.body.position.x, car.body.position.y, car.body.position.z);
    car.group.quaternion.set(car.body.quaternion.x, car.body.quaternion.y, car.body.quaternion.z, car.body.quaternion.w);
  }

  updateCamera(dt);
  audio.update(camera.position);

  for (const m of monuments) m.update(elapsed);

  // Animate water shader
  scene.traverse((obj) => {
    if (obj.isMesh && obj.material && obj.material.uniforms && obj.material.uniforms.uTime) {
      obj.material.uniforms.uTime.value = elapsed;
    }
  });

  // Animate koi fish
  if (koiGroup && koiGroup.userData && koiGroup.userData.koiFish) {
    for (const fish of koiGroup.userData.koiFish) {
      fish.userData.angle += fish.userData.speed * dt;
      fish.position.x = fish.userData.pondX + Math.cos(fish.userData.angle) * fish.userData.radius;
      fish.position.z = fish.userData.pondZ + Math.sin(fish.userData.angle) * fish.userData.radius;
      fish.position.y = fish.userData.depth + Math.sin(fish.userData.angle * 2) * 0.05;
      fish.rotation.y = -fish.userData.angle + Math.PI / 2;
    }
  }

  // Animate floating code snippets
  if (codeSnippets) {
    for (const snippet of codeSnippets) {
      snippet.rotation.y += snippet.userData.rotSpeed * dt;
      snippet.position.y = 1.5 + Math.sin(elapsed * 0.5 + snippet.userData.floatOffset) * 0.3;
    }
  }

  if (!simPaused) {
    const hit = checkMonumentCollision(car, monuments);
    if (hit && hit !== lastMonumentHit && !modals.isOpen()) {
      lastMonumentHit = hit;
      modals.open(hit);
    }
  }

  const d = Math.hypot(car.group.position.x, car.group.position.z);
  distEl.textContent = d.toFixed(1);
  const fillT = Math.max(0, Math.min(1, 1 - d / RIM_OUTER_VIS));
  distFill.style.transform = `scaleX(${fillT.toFixed(3)})`;
  if (d <= CORE_RADIUS_VIS) {
    zoneEl.textContent = 'STRUCTURE — THE CORE';
    zoneEl.classList.add('is-core');
    brandMark.style.background = 'var(--core)';
    brandMark.style.boxShadow = '0 0 12px rgba(138, 180, 255, 0.9)';
  } else if (d <= RIM_OUTER_VIS) {
    zoneEl.textContent = 'TRANSITION — THE WINDING PATH';
    zoneEl.classList.remove('is-core');
    brandMark.style.background = '#aaa';
    brandMark.style.boxShadow = '0 0 8px rgba(255,255,255,0.4)';
  } else {
    zoneEl.textContent = 'CHAOS — OUTER RIM';
    zoneEl.classList.remove('is-core');
    brandMark.style.background = 'var(--rim)';
    brandMark.style.boxShadow = '0 0 8px rgba(255,255,255,0.3)';
  }

  renderer.render(scene, camera);
}

requestAnimationFrame(tick);

if (typeof window !== 'undefined') {
  window.__coreRim = { scene, world, car, monuments, audio, modals, controls };
}

} // end bootstrap