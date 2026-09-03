/**
 * vehicle.js
 * Low-poly car. Zero-drift: velocity and yaw snapped each frame.
 * Car faces -Z (forward). W=forward, S=backward, A=left, D=right.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const CAR_HALF = { x: 0.88, y: 0.35, z: 1.45 };
const MAX_SPEED = 18;
const YAW_RATE_AT_SPEED = 1.7;
const YAW_RATE_STATIONARY = 2.6;

export function createVehicle({ scene, world, spawn = new THREE.Vector3(0, 0.4, 50) }) {

  const group = new THREE.Group();
  group.position.copy(spawn);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f8, metalness: 0.15, roughness: 0.5, flatShading: true });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1a1e28, metalness: 0.5, roughness: 0.2, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.7, flatShading: true });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9, metalness: 0.0, flatShading: true });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x909090, roughness: 0.3, metalness: 0.8, flatShading: true });
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff8d0 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x8ab4ff, transparent: true, opacity: 0.14, side: THREE.DoubleSide });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_HALF.x * 2, CAR_HALF.y * 2, CAR_HALF.z * 2), bodyMat);
  body.position.y = CAR_HALF.y + 0.1;
  body.castShadow = true;
  group.add(body);

  // Cabin
  const cabinH = CAR_HALF.y * 1.1;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR_HALF.x * 1.5, cabinH * 2, CAR_HALF.z * 1.0), cabinMat);
  cabin.position.set(0, CAR_HALF.y * 2 + cabinH * 0.9, 0.08);
  cabin.castShadow = true;
  group.add(cabin);

  // Windshield
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(CAR_HALF.x * 1.4, cabinH * 1.6), glassMat);
  ws.position.set(0, CAR_HALF.y * 2 + cabinH * 0.9, -CAR_HALF.z * 0.52 + 0.08);
  ws.rotation.x = -0.15;
  group.add(ws);

  // Hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(CAR_HALF.x * 1.8, CAR_HALF.y * 0.5, CAR_HALF.z * 0.6), bodyMat);
  hood.position.set(0, CAR_HALF.y * 1.25, -CAR_HALF.z * 0.72);
  hood.castShadow = true;
  group.add(hood);

  // Bumpers
  for (const side of [-1, 1]) {
    const bumper = new THREE.Mesh(
      new THREE.BoxGeometry(CAR_HALF.x * 0.15, CAR_HALF.y * 0.6, CAR_HALF.z * 0.2),
      new THREE.MeshStandardMaterial({ color: 0x888890, roughness: 0.7, flatShading: true })
    );
    bumper.position.set(side * (CAR_HALF.x + 0.07), CAR_HALF.y * 0.3, 0);
    bumper.castShadow = true;
    group.add(bumper);
  }

  // Headlights
  for (const dx of [-0.48, 0.48]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), hlMat);
    hl.position.set(dx, CAR_HALF.y * 0.7, -CAR_HALF.z - 0.05);
    group.add(hl);
  }

  // Taillights
  for (const dx of [-0.52, 0.52]) {
    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), tlMat);
    tl.position.set(dx, CAR_HALF.y * 0.7, CAR_HALF.z + 0.05);
    group.add(tl);
  }

  // Underglow
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(CAR_HALF.x * 2.2, CAR_HALF.z * 2.4), glowMat);
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = -CAR_HALF.y * 0.55;
  group.add(glowPlane);

  // SpotLight
  const spot = new THREE.SpotLight(0xfff8d0, 2.0, 24, Math.PI / 8, 0.4, 1.4);
  spot.position.set(0, CAR_HALF.y * 1.2, -CAR_HALF.z);
  spot.target.position.set(0, 0, -15);
  group.add(spot);
  group.add(spot.target);

  // Wheels
  const wheelR = 0.28, wheelT = 0.18;
  const wheelPositions = [
    [-CAR_HALF.x - wheelT * 0.4, wheelR, -CAR_HALF.z * 0.65],
    [ CAR_HALF.x + wheelT * 0.4, wheelR, -CAR_HALF.z * 0.65],
    [-CAR_HALF.x - wheelT * 0.4, wheelR,  CAR_HALF.z * 0.65],
    [ CAR_HALF.x + wheelT * 0.4, wheelR,  CAR_HALF.z * 0.65],
  ];
  const wheels = wheelPositions.map(([wx, wy, wz]) => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelT, 10, 1), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(wheelT * 1.2, wheelR * 0.15, wheelR * 0.8), rimMat);
      spoke.rotation.x = (s / 5) * Math.PI * 2;
      wg.add(spoke);
    }
    wg.position.set(wx, wy, wz);
    group.add(wg);
    return wg;
  });

  scene.add(group);

  // Physics
  const shape = new CANNON.Box(new CANNON.Vec3(CAR_HALF.x, CAR_HALF.y, CAR_HALF.z));
  const body3 = new CANNON.Body({
    mass: 1.0, shape,
    position: new CANNON.Vec3(spawn.x, spawn.y, spawn.z),
    angularDamping: 0.0, linearDamping: 0.0,
    material: new CANNON.Material({ friction: 1.0, restitution: 0.0 }),
  });
  body3.angularFactor.set(0, 1, 0);
  body3.updateMassProperties();
  world.addBody(body3);

  let controlsEnabled = true;
  const tmpForward = new THREE.Vector3();

  function setControlsEnabled(enabled) {
    controlsEnabled = enabled;
    if (!enabled) { body3.velocity.set(0, body3.velocity.y, 0); body3.angularVelocity.set(0, 0, 0); }
  }

  function pushBack(amount = 5) {
    const p = body3.position;
    body3.position.set(p.x, p.y, p.z + amount);
    body3.velocity.set(0, 0, 0);
    body3.angularVelocity.set(0, 0, 0);
  }

  function update(dt, state) {
    group.position.set(body3.position.x, body3.position.y, body3.position.z);
    group.quaternion.set(body3.quaternion.x, body3.quaternion.y, body3.quaternion.z, body3.quaternion.w);
    if (!controlsEnabled) return;

    // Drive — snap velocity to forward axis
    const fwdInput = (state.forward ? 1 : 0) + (state.backward ? -1 : 0);
    const targetSpeed = fwdInput * MAX_SPEED;
    tmpForward.set(0, 0, -1).applyQuaternion(group.quaternion);
    tmpForward.y = 0;
    tmpForward.normalize();
    body3.velocity.x = tmpForward.x * targetSpeed;
    body3.velocity.z = tmpForward.z * targetSpeed;

    // Turn: A = left, D = right
    const turnInput = (state.left ? 1 : 0) + (state.right ? -1 : 0);
    const speedFrac = Math.min(1, Math.abs(targetSpeed) / MAX_SPEED);
    const yawCap = THREE.MathUtils.lerp(YAW_RATE_STATIONARY, YAW_RATE_AT_SPEED, speedFrac);
    const targetYaw = turnInput * yawCap;
    body3.angularVelocity.set(0, targetYaw, 0);

    // Brake
    if (state.brake) { body3.velocity.x = 0; body3.velocity.z = 0; }

    // Wheel spin
    const spinSpeed = targetSpeed * dt * 2.5;
    for (const w of wheels) w.rotation.x += spinSpeed;

    // Keep car on ground
    body3.position.y = CAR_HALF.y + 0.1;
  }

  return { group, body: body3, halfExtents: CAR_HALF, update, setControlsEnabled, pushBack };
}