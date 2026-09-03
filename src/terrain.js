/**
 * terrain.js
 * ----------------------------------------------------------------------
 * Identity-rich island world.
 * Reflects: Asian heritage, CS/tech, audiophile, personal identity.
 *
 * Zones:
 *   - OUTER RIM: chaos + stereotypes (tech-bro stuff, circuit boards, server racks)
 *   - TRANSITION: cultural blend (cherry blossoms, lanterns, torii gates, koi pond)
 *   - INNER CORE: acoustic panels (the structured self)
 *
 * Color: Bruno Simon palette (orange -> teal -> dark blue)
 * Assignment: "There is not just one way to be ___"
 * ----------------------------------------------------------------------
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export const ISLAND_HALF = 65;
export const CORE_RADIUS = 26;
export const RIM_OUTER = 42;
export const PLANE_SIZE = ISLAND_HALF * 2;

const BRUNO_ORANGE = new THREE.Color('#ffa94e');
const BRUNO_TEAL   = new THREE.Color('#5bc2b9');
const BRUNO_DARK   = new THREE.Color('#13375f');

/* ===========================================================
   PRNG
   =========================================================== */

function mulberry32(seed) {
  let t = (seed >>> 0) + 0x6d2b79f5;
  return () => {
    t |= 0; t = (t + 0x9e3779b9) | 0;
    let s = Math.imul(t ^ (t >>> 15), 1 | t);
    s = (s + Math.imul(s ^ (s >>> 7), 61 | s)) ^ s;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerpF(a, b, t) { return a + t * (b - a); }

function hash2(ix, iy) {
  let n = ((ix * 1619 + iy * 31337) ^ 0x5eed) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967296;
}

function grad2(h, x, y) {
  const u = (h & 1) ? x : y;
  const v = (h & 2) ? x : y;
  return ((h & 4) ? -u : u) + ((h & 8) ? -v : v);
}

function perlin(x, y) {
  const xi = Math.floor(x) | 0, yi = Math.floor(y) | 0;
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const n00 = grad2((hash2(xi, yi) * 4) | 0, xf, yf);
  const n10 = grad2((hash2(xi + 1, yi) * 4) | 0, xf - 1, yf);
  const n01 = grad2((hash2(xi, yi + 1) * 4) | 0, xf, yf - 1);
  const n11 = grad2((hash2(xi + 1, yi + 1) * 4) | 0, xf - 1, yf - 1);
  return lerpF(lerpF(n00, n10, u), lerpF(n01, n11, u), v);
}

function fbm(x, y, octaves = 4) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) { v += perlin(x * freq, y * freq) * amp; amp *= 0.5; freq *= 2.1; }
  return v;
}

/* ===========================================================
   Build all
   =========================================================== */
export function buildTerrain(scene, world) {

  /* Physics ground */
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({
    mass: 0, shape: groundShape,
    material: new CANNON.Material({ friction: 0.8, restitution: 0.0 }),
  });
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(groundBody);

  /* Sky dome */
  scene.add(buildSkyDome());

  /* Lighting */
  scene.add(new THREE.AmbientLight(0xfff0d8, 0.5));
  scene.add(new THREE.HemisphereLight(0xfde8c0, 0x4a7a9a, 0.7));

  const sun = new THREE.DirectionalLight(0xffd090, 2.2);
  sun.position.set(35, 55, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x7090b0, 0.4);
  fill.position.set(-30, 20, -20);
  scene.add(fill);

  /* Water */
  scene.add(buildWater());

  /* Terrain mesh */
  scene.add(buildTerrainMesh());

  /* Core floor */
  scene.add(buildCoreFloor());

  /* Koi pond */
  scene.add(buildKoiPond());

  /* Cherry blossom trees */
  scene.add(buildCherryBlossoms());

  /* Lanterns */
  scene.add(buildLanterns());

  /* Torii gate */
  scene.add(buildToriiGate());

  /* Circuit board ground patches */
  scene.add(buildCircuitPatches());

  /* Tech decorations */
  scene.add(buildTechDecorations());

  /* Standard trees */
  scene.add(buildTrees());

  /* Rocks */
  scene.add(buildRocks());

  /* Chaos primitives */
  scene.add(buildChaosPrimitives());

  /* Identity signs */
  scene.add(buildIdentitySigns());

  /* Road */
  scene.add(buildRoad());

  /* Fog */
  scene.fog = new THREE.FogExp2(0xc8b090, 0.0055);

  /* Collect animated objects for main.js tick loop */
  const koiGroup = scene.children.find((c) => c.userData && c.userData.koiFish && c.userData.koiFish.length > 0);
  const codeSnippets = [];
  scene.traverse((obj) => {
    if (obj.userData && obj.userData.rotSpeed !== undefined) codeSnippets.push(obj);
  });

  return { groundBody, koiGroup, codeSnippets };
}

/* ===========================================================
   Terrain mesh
   =========================================================== */
function buildTerrainMesh() {
  const SIZE = ISLAND_HALF * 2;
  const SEGS = 80;
  const step = SIZE / SEGS;
  const half = SIZE / 2;

  const geo = new THREE.BufferGeometry();
  const positions = [];
  const vertexColors = [];

  for (let zi = 0; zi <= SEGS; zi++) {
    for (let xi = 0; xi <= SEGS; xi++) {
      const wx = xi * step - half, wz = zi * step - half;
      const d = Math.hypot(wx, wz);
      const t = d / ISLAND_HALF;

      let height = 0;
      let col = new THREE.Color();

      if (t < 0.93) {
        const noise = fbm(wx * 0.028, wz * 0.028, 4) * 4.8;
        const ramp = THREE.MathUtils.clamp(1 - Math.pow(t / 0.88, 2.4), 0, 1);
        height = Math.max(0, noise * ramp + ramp * 0.25);

        if (d > RIM_OUTER) {
          // OUTER RIM — grayscale
          const g = THREE.MathUtils.clamp(0.15 + Math.abs(fbm(wx * 0.06, wz * 0.06, 2)) * 0.35 + ramp * 0.1, 0.08, 0.55);
          col.setHSL(0, 0, g);
        } else if (d > CORE_RADIUS) {
          // TRANSITION — Bruno Simon palette
          const transT = (t - CORE_RADIUS / ISLAND_HALF) / ((RIM_OUTER - CORE_RADIUS) / ISLAND_HALF);
          const colorT = THREE.MathUtils.clamp(transT + fbm(wx * 0.07, wz * 0.07, 2) * 0.2, 0, 1);
          if (colorT < 0.5) col.lerpColors(BRUNO_ORANGE, BRUNO_TEAL, colorT * 2);
          else col.lerpColors(BRUNO_TEAL, BRUNO_DARK, (colorT - 0.5) * 2);
          const warmth = fbm(wx * 0.04 + 50, wz * 0.04 + 50, 2) * 0.15;
          col.r = Math.min(1, col.r + warmth);
          col.g = Math.min(1, col.g + warmth * 0.5);
        } else {
          const innerT = d / CORE_RADIUS;
          col.lerpColors(BRUNO_TEAL, BRUNO_DARK, innerT * 0.7 + fbm(wx * 0.08, wz * 0.08, 2) * 0.1);
          col.r = Math.min(1, col.r + 0.08);
        }
      }

      positions.push(wx, height, wz);
      vertexColors.push(col.r, col.g, col.b);
    }
  }

  const vCount = SEGS + 1;
  const indices = [];
  for (let zi = 0; zi < SEGS; zi++) {
    for (let xi = 0; xi < SEGS; xi++) {
      const a = xi + zi * vCount, b = xi + 1 + zi * vCount;
      const c = xi + (zi + 1) * vCount, d = xi + 1 + (zi + 1) * vCount;
      indices.push(a, c, b, b, c, d);
    }
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0.0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/* ===========================================================
   Water
   =========================================================== */
function buildWater() {
  const geo = new THREE.PlaneGeometry(600, 600, 64, 64);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color(0x1a5f8a) },
      uDeep:  { value: new THREE.Color(0x0d2a3f) },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(pos.x * 0.08 + uTime * 0.6) * 0.15
                   + sin(pos.z * 0.11 + uTime * 0.8) * 0.12
                   + sin((pos.x + pos.z) * 0.05 + uTime * 0.4) * 0.08;
        pos.y += wave;
        vElevation = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uDeep;
      varying vec2 vUv;
      varying float vElevation;
      void main() {
        float mix_ = smoothstep(-0.15, 0.2, vElevation);
        gl_FragColor = vec4(mix(uDeep, uColor, mix_), 0.92);
      }
    `,
    transparent: true, side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.15;
  mesh.userData.isWater = true;
  return mesh;
}

/* ===========================================================
   Core floor
   =========================================================== */
function buildCoreFloor() {
  const tileSize = 3.5;
  const tiles = Math.ceil((CORE_RADIUS * 2) / tileSize) + 2;
  const geo = new THREE.PlaneGeometry(tiles * tileSize, tiles * tileSize, 1, 1);
  geo.rotateX(-Math.PI / 2);

  const tex = makeAcousticTexture(tiles);
  const mat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.05, roughness: 0.65 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.015;
  mesh.receiveShadow = true;

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(CORE_RADIUS * 0.82, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4a6cff, transparent: true, opacity: 0.09, side: THREE.DoubleSide })
  );
  glow.position.y = 0.025;
  mesh.add(glow);
  return mesh;
}

function makeAcousticTexture(tiles) {
  const px = 256;
  const canvas = document.createElement('canvas');
  canvas.width = px * tiles; canvas.height = px * tiles;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ccd0da'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const x = tx * px, y = ty * px, m = 16;
      ctx.fillStyle = '#c5c9d2'; ctx.fillRect(x + m, y + m, px - 2 * m, px - 2 * m);
      const hl = ctx.createLinearGradient(x, y, x + px, y + px);
      hl.addColorStop(0, 'rgba(255,255,255,0.5)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl; ctx.fillRect(x + m, y + m, px - 2 * m, px - 2 * m);
      const sh = ctx.createLinearGradient(x, y, x + px, y + px);
      sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = sh; ctx.fillRect(x + m, y + m, px - 2 * m, px - 2 * m);
      ctx.strokeStyle = 'rgba(80,90,110,0.45)'; ctx.lineWidth = 2;
      ctx.strokeRect(x + m, y + m, px - 2 * m, px - 2 * m);
    }
  }
  const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width * 0.6);
  vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(40,50,80,0.2)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/* ===========================================================
   Koi Pond
   =========================================================== */
function buildKoiPond() {
  const group = new THREE.Group();

  const pondGeo = new THREE.CircleGeometry(4.5, 32).rotateX(-Math.PI / 2);
  const pondMat = new THREE.MeshStandardMaterial({ color: 0x1a4a6a, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 });
  const pond = new THREE.Mesh(pondGeo, pondMat);
  pond.position.set(-8, 0.01, -8);
  group.add(pond);

  const rimGeo = new THREE.TorusGeometry(4.5, 0.4, 6, 32).rotateX(-Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: 0x808080, flatShading: true, roughness: 0.9 }));
  rim.position.set(-8, 0.05, -8); rim.castShadow = true;
  group.add(rim);

  // Koi fish
  const koiColors = [0xff6b35, 0xffffff, 0xff4500, 0xffd700];
  for (let i = 0; i < 5; i++) {
    const koiGroup = new THREE.Group();
    const rng = mulberry32(0xdead0001 + i);
    const color = koiColors[i % koiColors.length];
    const koiMat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), koiMat);
    body.scale.set(2.2, 0.7, 0.9);
    koiGroup.add(body);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 4), koiMat);
    tail.position.set(-0.45, 0, 0); tail.rotation.z = Math.PI / 2;
    koiGroup.add(tail);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    eye.position.set(0.3, 0.1, 0.1);
    koiGroup.add(eye);

    koiGroup.position.set(-8 + (rng() - 0.5) * 5, 0.15, -8 + (rng() - 0.5) * 5);
    koiGroup.userData.pondX = -8;
    koiGroup.userData.pondZ = -8;
    koiGroup.userData.angle = rng() * Math.PI * 2;
    koiGroup.userData.speed = 0.3 + rng() * 0.4;
    koiGroup.userData.radius = 1.5 + rng() * 1.5;
    koiGroup.userData.depth = 0.1 + rng() * 0.3;
    koiGroup.castShadow = true;
    group.add(koiGroup);
  }

  // Bamboo border
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const bamboo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 1.5 + Math.sin(i) * 0.5, 5),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.22, 0.6, 0.35 + Math.sin(i * 2) * 0.05), flatShading: true, roughness: 0.8 })
    );
    bamboo.position.set(-8 + Math.cos(a) * 5.2, 0.75, -8 + Math.sin(a) * 5.2);
    bamboo.castShadow = true;
    group.add(bamboo);
  }

  // Lily pads
  for (let i = 0; i < 3; i++) {
    const rng = mulberry32(0x0b000b00 + i);
    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(0.35 + rng() * 0.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x2d7a2d, flatShading: true, roughness: 0.9, side: THREE.DoubleSide })
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(-8 + (rng() - 0.5) * 5, 0.03, -8 + (rng() - 0.5) * 5);
    group.add(pad);
  }

  group.userData.koiFish = group.children.filter((c) => c.userData.pondX !== undefined);
  return group;
}

/* ===========================================================
   Cherry blossom trees (Sakura)
   =========================================================== */
function buildCherryBlossoms() {
  const group = new THREE.Group();
  const rng = mulberry32(0xcafebabe);
  for (let i = 0; i < 35; i++) {
    let x, z, d;
    do {
      x = (rng() * 2 - 1) * ISLAND_HALF * 0.8;
      z = (rng() * 2 - 1) * ISLAND_HALF * 0.8;
      d = Math.hypot(x, z);
    } while (d < CORE_RADIUS + 5 || d > RIM_OUTER - 3);
    const scale = 0.6 + rng() * 1.2;
    group.add(makeCherryTree(rng, scale, x, z));
  }
  return group;
}

function makeCherryTree(rng, scale, x, z) {
  const g = new THREE.Group();
  const trunkH = (1.4 + rng() * 0.8) * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, trunkH, 5, 1),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.06, 0.4, 0.18 + rng() * 0.08), flatShading: true, roughness: 0.95 })
  );
  trunk.position.set(x, trunkH / 2, z);
  trunk.rotation.z = (rng() - 0.5) * 0.15;
  trunk.castShadow = true;
  g.add(trunk);

  const clusters = 3 + Math.floor(rng() * 3);
  const baseHue = 0.88 + rng() * 0.08;
  for (let c = 0; c < clusters; c++) {
    const ch = (1.0 + rng() * 1.2) * scale;
    const cr = (0.5 + rng() * 0.6) * scale;
    const clusterGeo = new THREE.IcosahedronGeometry(cr, 0);
    const clusterMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(baseHue + (rng() - 0.5) * 0.06, 0.45 + rng() * 0.2, 0.75 + rng() * 0.12),
      flatShading: true, roughness: 0.9, transparent: true, opacity: 0.9,
    });
    const cluster = new THREE.Mesh(clusterGeo, clusterMat);
    cluster.position.set(x + (rng() - 0.5) * trunkH * 0.6, trunkH + (rng() - 0.5) * ch * 0.3, z + (rng() - 0.5) * trunkH * 0.6);
    cluster.castShadow = true;
    g.add(cluster);
  }

  const glowMesh = new THREE.Mesh(
    new THREE.SphereGeometry(scale * 0.8, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffccdd, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
  glowMesh.position.set(x, trunkH * 0.9, z);
  g.add(glowMesh);
  return g;
}

/* ===========================================================
   Paper lanterns
   =========================================================== */
function buildLanterns() {
  const group = new THREE.Group();
  const rng = mulberry32(9876543);
  for (let i = 0; i < 20; i++) {
    let x, z, d;
    do {
      x = (rng() * 2 - 1) * ISLAND_HALF * 0.7;
      z = (rng() * 2 - 1) * ISLAND_HALF * 0.7;
      d = Math.hypot(x, z);
    } while (d < CORE_RADIUS || d > RIM_OUTER);
    group.add(makeLantern(rng, x, z));
  }
  return group;
}

function makeLantern(rng, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const poleH = 2.0 + rng() * 1.5;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, poleH, 4),
    new THREE.MeshStandardMaterial({ color: 0x4a3020, flatShading: true, roughness: 0.9 })
  );
  pole.position.y = poleH / 2; pole.castShadow = true; g.add(pole);

  const lanternColors = [0xff4444, 0xff8800, 0xffcc00, 0xee5500];
  const lanternColor = lanternColors[Math.floor(rng() * lanternColors.length)];
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.22 + rng() * 0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: lanternColor, emissive: new THREE.Color(lanternColor), emissiveIntensity: 0.6, flatShading: true, roughness: 0.5, transparent: true, opacity: 0.85 })
  );
  lantern.position.y = poleH + 0.2; lantern.castShadow = true; g.add(lantern);

  const innerLight = new THREE.PointLight(lanternColor, 0.8, 8, 2);
  innerLight.position.y = poleH + 0.2; g.add(innerLight);

  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 3), new THREE.MeshBasicMaterial({ color: 0x333333 }));
  string.position.y = poleH + 0.08; g.add(string);
  return g;
}

/* ===========================================================
   Torii gate
   =========================================================== */
function buildToriiGate() {
  const g = new THREE.Group(); g.position.set(-18, 0, 5);
  const vermillion = new THREE.MeshStandardMaterial({ color: 0xcc2200, flatShading: true, roughness: 0.7 });
  const pillarH = 4.5;

  for (const side of [-1.4, 1.4]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, pillarH, 6), vermillion);
    pillar.position.set(side, pillarH / 2, 0); pillar.castShadow = true; g.add(pillar);
  }

  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 0.3), vermillion);
  kasagi.position.set(0, pillarH + 0.15, 0); kasagi.castShadow = true; g.add(kasagi);

  const nuki = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.25), vermillion);
  nuki.position.set(0, pillarH - 0.3, 0); g.add(nuki);

  const shimaki = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.2, 0.35), vermillion);
  shimaki.position.set(0, pillarH + 0.42, 0); g.add(shimaki);

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 0.15), vermillion);
  crossbar.position.set(0, pillarH * 0.5, 0); g.add(crossbar);

  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true, roughness: 0.7 })
  );
  plaque.position.set(0, pillarH - 0.5, 0.18); g.add(plaque);
  return g;
}/* ===========================================================
   Circuit board patches
   =========================================================== */
function buildCircuitPatches() {
  const group = new THREE.Group();
  const rng = mulberry32(6666666);
  for (let i = 0; i < 25; i++) {
    let x, z, d;
    do {
      x = (rng() * 2 - 1) * ISLAND_HALF * 0.75;
      z = (rng() * 2 - 1) * ISLAND_HALF * 0.75;
      d = Math.hypot(x, z);
    } while (d < CORE_RADIUS + 8 || d > RIM_OUTER);
    const size = 1.5 + rng() * 2.5;
    const patch = buildCircuitPatch(rng, size);
    patch.position.set(x, 0.02, z);
    patch.rotation.y = rng() * Math.PI * 2;
    group.add(patch);
  }
  return group;
}

function buildCircuitPatch(rng, size) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: 0x0a2a0a, flatShading: true, roughness: 0.6, metalness: 0.3 })
  );
  base.rotation.x = -Math.PI / 2; base.receiveShadow = true; g.add(base);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7 });
  const traceW = 0.04;

  for (let t = 0; t < 6; t++) {
    const x1 = (rng() - 0.5) * size * 0.8, z1 = (rng() - 0.5) * size * 0.8;
    const x2 = x1 + (rng() - 0.5) * size * 0.6, z2 = z1 + (rng() - 0.5) * size * 0.6;
    const len = Math.hypot(x2 - x1, z2 - z1);
    const angle = Math.atan2(z2 - z1, x2 - x1);
    const trace = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, traceW), lineMat);
    trace.position.set((x1 + x2) / 2, 0.015, (z1 + z2) / 2); trace.rotation.y = -angle; g.add(trace);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(traceW * 2, 8), lineMat);
    pad.rotation.x = -Math.PI / 2; pad.position.set(x2, 0.015, z2); g.add(pad);
  }

  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(size * 0.2, 0.06, size * 0.2),
    new THREE.MeshStandardMaterial({ color: 0x111111, flatShading: true, roughness: 0.4, metalness: 0.6 })
  );
  chip.position.set((rng() - 0.5) * size * 0.4, 0.03, (rng() - 0.5) * size * 0.4); g.add(chip);
  return g;
}

/* ===========================================================
   Tech decorations (server racks, spectrum bars, code)
   =========================================================== */
function buildTechDecorations() {
  const group = new THREE.Group();
  const rng = mulberry32(7777777);

  for (let i = 0; i < 8; i++) {
    const x = (rng() - 0.5) * ISLAND_HALF * 1.5;
    const z = (rng() - 0.5) * ISLAND_HALF * 1.5;
    if (Math.hypot(x, z) < RIM_OUTER) continue;
    group.add(makeServerRack(rng, x, z));
  }

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.5;
    const r = 7 + rng() * 3;
    group.add(makeSpectrumBars(rng, -10 + Math.cos(a) * r, 8 + Math.sin(a) * r));
  }

  for (let i = 0; i < 6; i++) {
    let x, z, d;
    do {
      x = (rng() * 2 - 1) * ISLAND_HALF * 0.6;
      z = (rng() * 2 - 1) * ISLAND_HALF * 0.6;
      d = Math.hypot(x, z);
    } while (d < CORE_RADIUS || d > RIM_OUTER);
    group.add(makeCodeSnippet(rng, x, z));
  }
  return group;
}

function makeServerRack(rng, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const h = 2.5 + rng() * 2, w = 0.8 + rng() * 0.4, d = 0.6 + rng() * 0.3;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, flatShading: true, roughness: 0.5, metalness: 0.6 })
  );
  body.position.y = h / 2; body.castShadow = true; g.add(body);

  const ledColors = [0x00ff00, 0xff0000, 0x00aaff, 0xff8800, 0xff00ff];
  for (let l = 0; l < 5; l++) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.03, 0.01),
      new THREE.MeshBasicMaterial({ color: ledColors[Math.floor(rng() * ledColors.length)] })
    );
    led.position.set(-w * 0.3 + l * 0.1, h * 0.3 + rng() * h * 0.5, d / 2 + 0.01); g.add(led);
  }
  for (let v = 0; v < 3; v++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.08, 0.01), new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 0.8 }));
    vent.position.set(0, h * 0.15 + v * 0.15, d / 2 + 0.01); g.add(vent);
  }
  const glow = new THREE.PointLight(0x0044ff, 0.4, 5, 2); glow.position.set(0, h * 0.7, 0); g.add(glow);
  return g;
}

function makeSpectrumBars(rng, x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const barCount = 8;
  const barColors = [0xff4488, 0xff8800, 0xffdd00, 0x44ff88, 0x44aaff, 0xaa44ff];
  for (let b = 0; b < barCount; b++) {
    const barH = 0.5 + rng() * 1.5;
    const color = barColors[b % barColors.length];
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, barH, 0.08),
      new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.4, flatShading: true, roughness: 0.5 })
    );
    bar.position.set((b - barCount / 2) * 0.2, barH / 2 + 0.1, 0); bar.castShadow = true; g.add(bar);
  }
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(barCount * 0.2 + 0.1, 0.1, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x222233, flatShading: true, roughness: 0.7, metalness: 0.4 })
  );
  base.position.y = 0.05; g.add(base);
  return g;
}

function makeCodeSnippet(rng, x, z) {
  const g = new THREE.Group(); g.position.set(x, 1.5 + rng() * 2, z);
  const w = 1.8 + rng() * 1.2, h = 0.8 + rng() * 0.6;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), new THREE.MeshBasicMaterial({ color: 0x0d1117, transparent: true, opacity: 0.85 }));
  g.add(panel);

  const codeColors = [0xff79c6, 0x8be9fd, 0x50fa7b, 0xffb86c, 0xf1fa8c, 0xff5555];
  const lineCount = 3 + Math.floor(rng() * 4);
  for (let l = 0; l < lineCount; l++) {
    const lineW = (0.3 + rng() * 0.6) * w;
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(lineW, 0.04, 0.01),
      new THREE.MeshBasicMaterial({ color: codeColors[Math.floor(rng() * codeColors.length)] })
    );
    line.position.set(-w / 2 + lineW / 2 + rng() * 0.1, h / 2 - 0.1 - l * 0.12, 0.03); g.add(line);
  }
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.01), new THREE.MeshBasicMaterial({ color: 0x50fa7b }));
  cursor.position.set(w / 2 - 0.1, h / 2 - 0.1 - lineCount * 0.12, 0.03); g.add(cursor);
  g.userData.rotSpeed = 0.1 + rng() * 0.3;
  g.userData.floatOffset = rng() * Math.PI * 2;
  return g;
}

/* ===========================================================
   Trees, Rocks, Chaos primitives
   =========================================================== */
function buildTrees() {
  const group = new THREE.Group();
  const rng = mulberry32(5555555);
  for (let i = 0; i < 50; i++) {
    let x, z, d;
    do { x = (rng() * 2 - 1) * ISLAND_HALF * 0.86; z = (rng() * 2 - 1) * ISLAND_HALF * 0.86; d = Math.hypot(x, z); }
    while (d < RIM_OUTER - 4 || d > ISLAND_HALF - 5);
    group.add(makeTree(rng, 0.7 + rng() * 1.5, x, z));
  }
  return group;
}

function makeTree(rng, scale, x, z) {
  const g = new THREE.Group();
  const trunkH = (1.1 + rng() * 0.9) * scale, trunkR = (0.14 + rng() * 0.1) * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 5, 1),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.08, 0.4, 0.22 + rng() * 0.1), flatShading: true, roughness: 0.95 })
  );
  trunk.position.set(x, trunkH / 2, z); trunk.castShadow = true; g.add(trunk);
  const layers = 2 + Math.floor(rng() * 2);
  const baseH = 0.28 + rng() * 0.06, baseS = 0.5 + rng() * 0.1, baseL = 0.25 + rng() * 0.1;
  for (let l = 0; l < layers; l++) {
    const ch = (1.6 + rng() * 1.4) * scale * (1 - l * 0.18), cr = (0.9 + rng() * 0.7) * scale * (1 - l * 0.12);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(cr, ch, 6 + Math.floor(rng() * 3), 1),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(baseH + rng() * 0.06 - 0.03, baseS, baseL + rng() * 0.06 - 0.03), flatShading: true, roughness: 0.88 })
    );
    cone.position.set(x, trunkH + l * ch * 0.45, z); cone.rotation.y = rng() * Math.PI; cone.castShadow = true; g.add(cone);
  }
  return g;
}

function buildRocks() {
  const group = new THREE.Group();
  const rng = mulberry32(0xbabecafe);
  for (let i = 0; i < 55; i++) {
    let x, z, d;
    do { x = (rng() * 2 - 1) * ISLAND_HALF * 0.88; z = (rng() * 2 - 1) * ISLAND_HALF * 0.88; d = Math.hypot(x, z); }
    while (d < RIM_OUTER - 3 || d > ISLAND_HALF - 4);
    const scale = 0.4 + rng() * 1.1;
    const geo = new THREE.IcosahedronGeometry(1.0, 0);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) pos.setXYZ(v, pos.getX(v) * (0.65 + rng() * 0.7), pos.getY(v) * (0.45 + rng() * 0.55), pos.getZ(v) * (0.65 + rng() * 0.7));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.06, 0.08, 0.4 + rng() * 0.22), flatShading: true, roughness: 0.92 }));
    mesh.scale.setScalar(scale); mesh.position.set(x, scale * 0.35, z); mesh.rotation.y = rng() * Math.PI * 2;
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  }
  return group;
}

function buildChaosPrimitives() {
  const group = new THREE.Group();
  const rng = mulberry32(0xdeadc0de);
  const SHAPES = ['box', 'tallBox', 'tetra', 'octa', 'spike', 'slab'];
  for (let i = 0; i < 120; i++) {
    let x, z, d;
    do { x = (rng() * 2 - 1) * ISLAND_HALF * 0.88; z = (rng() * 2 - 1) * ISLAND_HALF * 0.88; d = Math.hypot(x, z); }
    while (d < RIM_OUTER - 2 || d > ISLAND_HALF - 4);
    const kind = SHAPES[Math.floor(rng() * SHAPES.length)];
    const scale = 0.5 + rng() * 1.8;
    const mesh = makeChaosMesh(kind, rng, scale);
    mesh.position.set(x, 0, z);
    mesh.rotation.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
    group.add(mesh);
  }
  for (let i = 0; i < 65; i++) {
    const a = (i / 65) * Math.PI * 2 + (rng() - 0.5) * 0.07;
    const r = ISLAND_HALF * 0.86 + rng() * ISLAND_HALF * 0.12, h = 2 + rng() * 9, w = 0.7 + rng() * 1.6;
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(w, h, 3 + Math.floor(rng() * 3), 1),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0, 0, 0.1 + rng() * 0.35), flatShading: true, roughness: 0.95 })
    );
    mesh.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); mesh.rotation.y = rng() * Math.PI; mesh.castShadow = true; group.add(mesh);
  }
  return group;
}

function makeChaosMesh(kind, rng, scale) {
  let geo;
  switch (kind) {
    case 'box': geo = new THREE.BoxGeometry(1, 1, 1); break;
    case 'tallBox': geo = new THREE.BoxGeometry(0.7 + rng() * 0.5, 2.0 + rng() * 1.6, 0.7 + rng() * 0.5); break;
    case 'tetra': geo = new THREE.TetrahedronGeometry(0.9 + rng() * 0.5); break;
    case 'octa': geo = new THREE.OctahedronGeometry(0.8 + rng() * 0.5); break;
    case 'spike': geo = new THREE.ConeGeometry(0.6, 2.2 + rng() * 1.6, 4 + Math.floor(rng() * 3)); break;
    default: geo = new THREE.BoxGeometry(1.4 + rng(), 0.3 + rng() * 0.4, 1.4 + rng());
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0, 0, 0.08 + rng() * 0.5), flatShading: true, roughness: 0.93, metalness: rng() * 0.1 }));
  mesh.position.y = (kind === 'tallBox' || kind === 'spike') ? scale * 1.0 : scale * 0.5;
  mesh.castShadow = true; return mesh;
}

/* ===========================================================
   Identity signs
   =========================================================== */
const PROMPTS = [
  // Identity category signs
  { text: '"There is not just one way\nto be a GAMER"', pos: [20, 0, -5], color: 0x8ab4ff },
  { text: '"There is not just one way\nto be TECHNICAL"', pos: [-22, 0, 8], color: 0xffd98a },
  { text: '"There is not just one way\nto be an ARTIST"', pos: [5, 0, 22], color: 0xff8a8a },
  { text: '"There is not just one way\nto be a MUSICIAN"', pos: [-8, 0, -20], color: 0xa8ff8a },
  { text: '"There is not just one way\nto be IDENTIFIED"', pos: [14, 0, 16], color: 0xd4aaff },
  { text: '"What single word defines you?"', pos: [-15, 0, -14], color: 0xffb38a },

  // Personal identity references
  { text: '"Simgot EW300.\nZero:Red. FX15. Three cables. Why?"', pos: [-5, 0, -18], color: 0x88aaff },
  { text: '"React Native. AeroSpace.\nVercel. Shipped alone."', pos: [18, 0, 12], color: 0x88ffaa },

  // Stereotype signs — the "you're supposed to be" stuff
  { text: '"CS students are nerds\nwith no social skills"', pos: [-30, 0, -15], color: 0xffaaaa },
  { text: '"Chinese kids are supposed\nto be good at math"', pos: [28, 0, -18], color: 0xffcc88 },
  { text: '"Musicians are supposed\nto be poor and chaotic"', pos: [-25, 0, 20], color: 0xaaffcc },
  { text: '"Asians are supposed\nto be quiet and polite"', pos: [30, 0, 20], color: 0xffdd88 },
  { text: '"You code? You must\nbe a basement hermit"', pos: [20, 0, -28], color: 0xccddff },
  { text: '"Asian + tech = you\nare supposed to be robotic"', pos: [-28, 0, -28], color: 0xffbbcc },
  { text: '"Gamers are antisocial\nand live in the dark"', pos: [25, 0, 30], color: 0xbbffcc },
  { text: '"You play piano? You must\nbe a classical nerd"', pos: [-18, 0, -30], color: 0xffccbb },
  { text: '"Good student = quiet kid\nwho follows the script"', pos: [15, 0, -25], color: 0xccffbb },
];

function buildIdentitySigns() {
  const group = new THREE.Group();
  for (const { text, pos, color } of PROMPTS) group.add(makeSign(text, pos, color));
  return group;
}

function makeSign(text, [x, , z], color) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1.7, 5),
    new THREE.MeshStandardMaterial({ color: 0x505060, roughness: 0.85, flatShading: true })
  );
  pole.position.y = 0.85; pole.castShadow = true; g.add(pole);
  const lines = text.split('\n');
  const tex = makeSignTex(text, lines.length, color);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.9 + (lines.length - 1) * 0.35, 0.07),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 })
  );
  board.position.y = 1.75 + (lines.length - 1) * 0.08; board.castShadow = true; g.add(board);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.7, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 })
  );
  glow.position.y = 0.02; g.add(glow);
  return g;
}

function makeSignTex(text, lines, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = lines === 1 ? 128 : (lines === 2 ? 192 : 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 12, 20, 0.88)'; ctx.fillRect(0, 0, 512, canvas.height);
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`; ctx.fillRect(0, 0, 512, 6);
  ctx.fillStyle = '#dde4f4';
  ctx.font = `bold ${canvas.height < 160 ? 28 : 22}px Arial`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  text.split('\n').forEach((l, i) => ctx.fillText(l.replace(/"/g, ''), 256, canvas.height / (lines + 0.5) * (i + 1)));
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}

/* ===========================================================
   Road
   =========================================================== */
function buildRoad() {
  const group = new THREE.Group();
  const points = [];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22, a = t * Math.PI * 1.9 + 0.3;
    const r = THREE.MathUtils.lerp(ISLAND_HALF * 0.78, 11, t);
    const wiggle = Math.sin(t * Math.PI * 3.2) * 5.5 * (1 - t);
    points.push(new THREE.Vector3(Math.cos(a) * r + wiggle, 0.055, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 70, 1.3, 6, false),
    new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.94, metalness: 0.0 })
  );
  tube.receiveShadow = true; group.add(tube);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8e0b8, roughness: 0.7 });
  for (let i = 0; i < 28; i++) {
    const t = i / 28;
    const p = curve.getPointAt(Math.min(0.99, t + 0.015)), p2 = curve.getPointAt(Math.min(0.99, t + 0.05));
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.01, 0.7), dashMat);
    dash.position.copy(p); dash.position.y = 0.065;
    const dir = new THREE.Vector3().subVectors(p2, p).normalize();
    dash.rotation.y = Math.atan2(dir.x, dir.z); group.add(dash);
  }
  return group;
}

/* ===========================================================
   Sky dome
   =========================================================== */
function buildSkyDome() {
  const geo = new THREE.SphereGeometry(420, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(0x1a2a4a) }, uHorizon: { value: new THREE.Color(0xf4c080) }, uBot: { value: new THREE.Color(0x8ab0c8) } },
    vertexShader: `varying vec3 vWorld; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `varying vec3 vWorld; uniform vec3 uTop, uHorizon, uBot; void main() { float h = normalize(vWorld).y * 0.5 + 0.5; vec3 col = mix(uBot, uHorizon, smoothstep(0.0, 0.15, h)); col = mix(col, uTop, smoothstep(0.15, 0.65, h)); gl_FragColor = vec4(col, 1.0); }`,
  });
  return new THREE.Mesh(geo, mat);
}