/**
 * monuments.js
 * ----------------------------------------------------------------------
 * Luminous obelisks in the structured core.
 * Data-driven: one MONUMENTS array defines everything — 3D obelisk,
 * collision box, and the modal content that opens when the car reaches it.
 *
 * Each obelisk:
 *   - Tapered tall shaft (THREE.CylinderGeometry, open-ended cone shape)
 *   - Pulsing emissive glow
 *   - Point light + spotlight
 *   - Concentric ring base
 *   - AABB collision for the car
 *
 * The pulse and glow are animated per frame.
 * ----------------------------------------------------------------------
 */

import * as THREE from 'three';

const SHAFT_H = 7.5;
const SHAFT_R = [1.1, 0.45];
const AABB_MARGIN = 1.0;

/* -----------------------------------------------------------------------
   Monument definitions
   ----------------------------------------------------------------------- */
export const MONUMENTS = [
  {
    id: 'modalAudio',
    position: new THREE.Vector3(-10, 0, 8),
    color: 0x8ab4ff,
    label: 'AUDIO',
    quote: '"I spent $300 on one cable. Am I chasing sound, or chasing myself?"',
    modalEyebrow: 'Monument I — The Audio Pillar',
    modalTitle: 'The headphones, the cables, the rabbit hole.',
    modalBody:
      'I own three cables that measure nearly identical. I can tell you the soundstage ' +
      'width of the Simgot EW300 versus the Zero:Red. My friends call it obsessive. ' +
      "But there's something almost meditative about it — like studying a painting, " +
      'except you live inside the painting. Is it a problem, or is it how some of us love music?',
  },
  {
    id: 'modalStructure',
    position: new THREE.Vector3(9, 0, -10),
    color: 0xffd98a,
    label: 'STRUCTURE',
    quote: '"My app has 50k users. My family still asks when I\'ll get a real job."',
    modalEyebrow: 'Monument II — The Structural Pillar',
    modalTitle: 'The invisible architecture.',
    modalBody:
      'React Native. Vercel. AeroSpace. My code is in your pocket, your browser, your ' +
      'commute. And I shipped it from my apartment, alone, probably at 2am. Society says ' +
      "programmers are basement hermits. Maybe we're just building things that outgrow " +
      'the rooms they came from.',
  },
  {
    id: 'modalCultural',
    position: new THREE.Vector3(0, 0, -14),
    color: 0xff88aa,
    label: 'CULTURE',
    quote: '"Too Asian for the CS kids. Too quiet for everyone else."',
    modalEyebrow: 'Monument III — The Cultural Pillar',
    modalTitle: 'The model minority myth, and the cost of performing it.',
    modalBody:
      "People assume I'm good at math before I open my mouth. They assume I'm quiet " +
      "because I'm Asian. When I do speak up, I'm 'different.' When I don't, I'm 'typical.' " +
      "I didn't ask to be a stereotype. I just wanted to exist without having my whole identity defined by others.",
  },
  {
    id: 'modalAcademic',
    position: new THREE.Vector3(-14, 0, -6),
    color: 0x88ffcc,
    label: 'ACHIEVEMENT',
    quote: '"Every A felt like proof I belonged. Every B felt like proof I didn\'t."',
    modalEyebrow: 'Monument IV — The Achievement Pillar',
    modalTitle: 'The grade, the worth, and the silence between.',
    modalBody:
      "My transcript is clean. My sense of self is not. Somewhere along the way, 'being good " +
      "at school' became the only dimension anyone cared about. Now I code at 3am chasing that " +
      'same validation from a different authority — real world results, not report cards.',
  },
  {
    id: 'modalGamer',
    position: new THREE.Vector3(14, 0, 4),
    color: 0xcc88ff,
    label: 'GAMER',
    quote: '"I\'m in the top 1%. I\'m also deeply depressed."',
    modalEyebrow: 'Monument V — The Gamer Pillar',
    modalTitle: 'The rank, the grind, and what nobody talks about.',
    modalBody:
      "I hit Grandmaster. Then I hit a wall. Turns out climbing the ladder feels a lot like " +
      "escaping something. Gaming was my safe world — where the rules were clear and skill " +
      "mattered. Real life doesn't have an ELO. It took me a long time to admit that being " +
      "good at a game didn't teach me how to be good at being a person.",
  },
  {
    id: 'modalImposter',
    position: new THREE.Vector3(-6, 0, 14),
    color: 0xffcc88,
    label: 'IMPOSTER',
    quote: '"Fifty thousand users. I still feel like I faked my way here."',
    modalEyebrow: 'Monument VI — The Imposter Pillar',
    modalTitle: 'The 50k-user delusion.',
    modalBody:
      "50,000 people opened my app today. And I sat there thinking: when are they going to " +
      "figure out I'm just guessing? The code works but I don't know why half of it works. " +
      "I'm either genuinely good or the luckiest fraud alive. Most days I can't tell the " +
      "difference. Maybe that's just what shipping things feels like.",
  },
  {
    id: 'modalMusician',
    position: new THREE.Vector3(6, 0, 16),
    color: 0x88aaff,
    label: 'MUSICIAN',
    quote: '"I play piano in a genre nobody takes seriously, and I love it."',
    modalEyebrow: 'Monument VII — The Musician Pillar',
    modalTitle: 'The genre nobody respects, and the joy nobody can take.',
    modalBody:
      "My parents wanted classical. I found electronic. They don't understand how sitting " +
      "at a piano — with a midi controller and four synthesizers — is still playing piano. " +
      "Music school kids look at me sideways. Tech kids think it's a hobby. It's neither. " +
      "It's the most honest thing I do and genuinely enjoy.",
  },
  {
    id: 'modalCreator',
    position: new THREE.Vector3(-16, 0, 10),
    color: 0xaaffcc,
    label: 'CREATOR',
    quote: '"I build the apps people use to escape reality. What do I use?"',
    modalEyebrow: 'Monument VIII — The Creator Pillar',
    modalTitle: "The builder, the builder's builder, and the builder's builder's builder.",
    modalBody:
      "I make things that help people feel less alone. I shipped a meditation app. I still " +
      "can't meditate. I built a social platform that helps people make friends. I have three " +
      "close ones. There's a strange guilt in being the person who builds the raft while " +
      "sitting in the water alone. Maybe the raft is enough. Maybe I need to swim too.",
  },
];

/* -----------------------------------------------------------------------
   Build all obelisks in the scene
   ----------------------------------------------------------------------- */
export function createMonuments(scene) {
  const items = [];
  for (const def of MONUMENTS) {
    items.push(buildObelisk(def));
  }
  for (const it of items) scene.add(it.root);
  return items;
}

/* -----------------------------------------------------------------------
   Build one obelisk
   ----------------------------------------------------------------------- */
function buildObelisk({ id, position, color, label, quote }) {
  const root = new THREE.Group();
  root.position.copy(position);
  const colorObj = new THREE.Color(color);

  // Concentric rings at the base
  for (let r = 0; r < 3; r++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.5 + r * 1.4, 1.8 + r * 1.4, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: colorObj.clone().multiplyScalar(1 - r * 0.25),
        transparent: true,
        opacity: 0.5 - r * 0.12,
        side: THREE.DoubleSide,
      })
    );
    ring.position.y = 0.015 * (r + 1);
    root.add(ring);
  }

  // Inner glow disc
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.3, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: colorObj,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    })
  );
  glowDisc.position.y = 0.02;
  root.add(glowDisc);

  // Shaft (tapered cylinder)
  const shaftGeo = new THREE.CylinderGeometry(SHAFT_R[1], SHAFT_R[0], SHAFT_H, 5, 1, true);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4ff,
    emissive: colorObj,
    emissiveIntensity: 0.8,
    metalness: 0.25,
    roughness: 0.2,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = SHAFT_H / 2 + 0.01;
  shaft.castShadow = false;
  root.add(shaft);

  // Cap (small pyramid)
  const capGeo = new THREE.ConeGeometry(SHAFT_R[0] * 1.2, 1.0, 5);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: colorObj,
    emissiveIntensity: 1.2,
    metalness: 0.4,
    roughness: 0.15,
    flatShading: true,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = SHAFT_H + 0.5;
  cap.rotation.y = Math.PI / 5;
  root.add(cap);

  // Point light
  const light = new THREE.PointLight(color, 2.0, 22, 1.8);
  light.position.y = SHAFT_H * 0.6;
  root.add(light);

  // Spot at the ground (light pool)
  const spot = new THREE.SpotLight(color, 1.5, 15, Math.PI / 6, 0.6, 1.2);
  spot.position.y = SHAFT_H * 0.8;
  spot.target.position.set(0, 0, 0);
  root.add(spot);
  root.add(spot.target);

  // Quote banner at base
  const quoteTex = makeQuoteTexture(quote, color);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.55),
    new THREE.MeshBasicMaterial({ map: quoteTex, transparent: true, side: THREE.DoubleSide })
  );
  banner.position.set(0, 0.35, SHAFT_R[0] + 0.08);
  root.add(banner);

  // AABB (collision box)
  const aabb = new THREE.Box3();
  aabb.min.set(
    position.x - SHAFT_R[0] - AABB_MARGIN,
    0,
    position.z - SHAFT_R[0] - AABB_MARGIN
  );
  aabb.max.set(
    position.x + SHAFT_R[0] + AABB_MARGIN,
    SHAFT_H + 1,
    position.z + SHAFT_R[0] + AABB_MARGIN
  );

  const phaseOffset = Math.random() * Math.PI * 2;

  return {
    id,
    root,
    aabb,
    light,
    shaft,
    cap,
    glowDisc,
    shaftMat,
    capMat,
    phaseOffset,
    label,
    update(elapsed) {
      const t = elapsed + phaseOffset;
      const pulse = 0.65 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.4));
      shaftMat.emissiveIntensity = 0.5 + 0.6 * pulse;
      capMat.emissiveIntensity = 0.8 + 0.8 * pulse;
      light.intensity = 1.5 + 1.2 * pulse;
      glowDisc.material.opacity = 0.12 + 0.18 * pulse;
      root.rotation.y = t * 0.18;
    },
  };
}

/* -----------------------------------------------------------------------
   Canvas texture helpers
   ----------------------------------------------------------------------- */
function makeQuoteTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
  roundRect(ctx, 0, 0, 512, 96, 8);
  ctx.fill();

  const hex = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 512, 5);

  ctx.fillStyle = '#dde4f4';
  ctx.font = 'bold 22px "Space Grotesk", "Arial", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* -----------------------------------------------------------------------
   Collision detection
   ----------------------------------------------------------------------- */
export function checkMonumentCollision(car, monuments) {
  const carAabb = new THREE.Box3();
  carAabb.min.set(
    car.body.position.x - car.halfExtents.x,
    0,
    car.body.position.z - car.halfExtents.z
  );
  carAabb.max.set(
    car.body.position.x + car.halfExtents.x,
    car.halfExtents.y * 3,
    car.body.position.z + car.halfExtents.z
  );
  for (const m of monuments) {
    if (carAabb.intersectsBox(m.aabb)) return m.id;
  }
  return null;
}