// Velvet Bay city: roads, blocks, towers, beach, palms, lamps and the sky.
// All geometry is procedural; window and road textures are drawn on canvas.

import { CITY, ROAD_LINES, mulberry32, pick, clamp, lerp } from './state.js';

function facadeTexture(rng, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 6, rows = 14;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#1c2733' : '#2a3a4d');
      g.fillRect(6 + x * 20, 8 + y * 17, 13, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#23262c';
  g.fillRect(0, 0, 128, 128);
  // Centre dashes run along the road (long in U, thin in V).
  g.fillStyle = '#f7c948';
  g.fillRect(8, 61, 34, 6);
  g.fillRect(74, 61, 34, 6);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(8, 0); g.lineTo(8, 128); g.moveTo(120, 0); g.lineTo(120, 128); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 6, 6), trunkMat);
  trunk.position.y = 3;
  trunk.rotation.z = (rng() - 0.5) * 0.2;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.2, 6.1, Math.sin(a) * 1.2);
    leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    group.add(leaf);
  }
  const nut = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4f2a }));
  nut.position.y = 5.8;
  group.add(nut);
  return group;
}

export function buildCity(scene, state) {
  const rng = mulberry32(20261117);
  const colliders = [];
  const lamps = [];
  const city = new THREE.Group();
  scene.add(city);

  // Ground: grass-green base under the whole map.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, CITY.half * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x4a7c43 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  city.add(ground);

  // Roads: dark strips with centre dashes, both directions.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const r of ROAD_LINES) {
    for (const horizontal of [true, false]) {
      const len = CITY.half * 2;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(len, CITY.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = horizontal ? 0 : Math.PI / 2;
      road.material = roadMat;
      road.position.set(horizontal ? 0 : r, 0, horizontal ? r : 0);
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(len / 16, 1);
      road.material = new THREE.MeshLambertMaterial({ map: tex });
      city.add(road);
    }
  }

  // Sidewalks: light strips flanking every road.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a9a92 });
  for (const r of ROAD_LINES) {
    for (const off of [-9, 9]) {
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, 5), walkMat);
      w1.rotation.x = -Math.PI / 2;
      w1.position.set(0, 0.02, r + off);
      city.add(w1);
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(5, CITY.half * 2), walkMat);
      w2.rotation.x = -Math.PI / 2;
      w2.position.set(r + off, 0.02, 0);
      city.add(w2);
    }
  }

  // Buildings: one or two towers per block, heights grow toward downtown.
  const palette = ['#c96f4a', '#d9a05b', '#7fa3b8', '#b8a88a', '#e07a5f', '#8fa8bf', '#c9b458', '#9b7fb8'];
  const facadeCache = {};
  for (let bx = 0; bx < ROAD_LINES.length - 1; bx++) {
    for (let bz = 0; bz < ROAD_LINES.length - 1; bz++) {
      const x0 = ROAD_LINES[bx] + CITY.roadWidth / 2 + 4;
      const z0 = ROAD_LINES[bz] + CITY.roadWidth / 2 + 4;
      const x1 = ROAD_LINES[bx + 1] - CITY.roadWidth / 2 - 4;
      const z1 = ROAD_LINES[bz + 1] - CITY.roadWidth / 2 - 4;
      if (z0 > CITY.beachZ - 20) continue; // beach blocks stay open
      const downtown = 1 - Math.hypot((x0 + x1) / 2, (z0 + z1) / 2) / 420;
      const count = rng() < 0.55 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const w = 14 + rng() * 16;
        const d = 14 + rng() * 16;
        const h = 8 + rng() * rng() * 46 * (0.4 + downtown);
        const cx = x0 + w / 2 + rng() * Math.max(1, (x1 - x0 - w));
        const cz = z0 + d / 2 + rng() * Math.max(1, (z1 - z0 - d));
        const color = pick(rng, palette);
        if (!facadeCache[color]) facadeCache[color] = facadeTexture(mulberry32(color.length * 7919 + 13), color, 0.25);
        // Repeat the facade so windows stay small on tall towers.
        const tex = facadeCache[color].clone();
        tex.needsUpdate = true;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 16)));
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(cx, h / 2, cz);
        city.add(tower);
        // Rooftop box so skylines read at distance.
        if (rng() < 0.6) {
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.3, 2.5, d * 0.3),
            new THREE.MeshLambertMaterial({ color: 0x555a60 }));
          roof.position.set(cx, h + 1.2, cz);
          city.add(roof);
        }
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }
      // A tree or two per block for green relief.
      if (rng() < 0.7) {
        const tx = x0 + rng() * (x1 - x0);
        const tz = z0 + rng() * (z1 - z0);
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.45, 3, 6),
          new THREE.MeshLambertMaterial({ color: 0x6b4f2a }));
        trunk.position.set(tx, 1.5, tz);
        const crown = new THREE.Mesh(
          new THREE.SphereGeometry(2.4, 8, 6),
          new THREE.MeshLambertMaterial({ color: 0x2f7d3a }));
        crown.position.set(tx, 4.4, tz);
        city.add(trunk); city.add(crown);
      }
    }
  }

  // Beach: sand strip, ocean plane, pier, palms along the boardwalk.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 80, 64),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, CITY.beachZ + 8);
  city.add(sand);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 400, 200),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.1, CITY.waterZ + 90);
  city.add(water);
  // Pier reaching into the water at x = 60.
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1, 60),
    new THREE.MeshLambertMaterial({ color: 0x8a6b4a }));
  pier.position.set(60, 0.6, CITY.beachZ + 34);
  city.add(pier);
  for (let z = CITY.beachZ + 10; z < CITY.beachZ + 62; z += 12) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 3, 6),
      new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
    post.position.set(54, 0.5, z);
    city.add(post);
    const post2 = post.clone();
    post2.position.x = 66;
    city.add(post2);
  }
  for (let x = -280; x <= 280; x += 40) {
    const palm = makePalm(rng);
    palm.position.set(x + rng() * 10, 0, CITY.beachZ - 6 + rng() * 4);
    city.add(palm);
  }

  // Street lamps at intersections; they glow after dark.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      if (rng() < 0.35) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), lampMat);
      pole.position.set(rx + 8, 3.5, rz + 8);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
      bulb.position.set(rx + 8, 7.1, rz + 8);
      city.add(pole); city.add(bulb);
      lamps.push(bulb);
    }
  }

  // Landmarks: the Velvet Bay sign tower downtown and the dockyard cranes.
  const signTower = new THREE.Mesh(
    new THREE.BoxGeometry(18, 58, 18),
    new THREE.MeshLambertMaterial({ color: 0x27324a }));
  signTower.position.set(0, 29, 0);
  city.add(signTower);
  colliders.push({ minX: -9, maxX: 9, minZ: -9, maxZ: 9 });
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(20, 6, 1),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  sign.position.set(0, 56, 9.6);
  city.add(sign);

  for (let i = 0; i < 3; i++) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(
      new THREE.BoxGeometry(2, 26, 2),
      new THREE.MeshLambertMaterial({ color: 0xd94f30 }));
    mast.position.y = 13;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(24, 1.6, 1.6),
      new THREE.MeshLambertMaterial({ color: 0xd94f30 }));
    arm.position.set(6, 25, 0);
    crane.add(mast); crane.add(arm);
    crane.position.set(-260 + i * 30, 0, 240);
    city.add(crane);
    colliders.push({ minX: -262 + i * 30, maxX: -258 + i * 30, minZ: 238, maxZ: 242 });
  }

  // Lighting rig.
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a4a3a, 0.75);
  scene.add(hemi);
  scene.fog = new THREE.Fog(0xbfd9ff, 220, 700);

  return { colliders, lamps, water, sun, hemi };
}

// Sun position, sky colour and lamp glow follow the time of day.
export function updateSky(state, rig) {
  const t = state.timeOfDay;
  const sunAngle = ((t - 6) / 12) * Math.PI; // 6h sunrise, 18h sunset
  const sunH = Math.sin(sunAngle);
  const sunset = clamp(1 - Math.abs(sunH) * 3, 0, 1) * (t > 12 ? 1 : 0.4);
  // Keep sunsets readable: never let the light drop as fast as the sun does.
  const day = Math.max(clamp(sunH * 1.6 + 0.25, 0.08, 1), sunset * 0.6);
  const sky = new THREE.Color().setHSL(0.58 - sunset * 0.12, 0.55, lerp(0.08, 0.62, day) - sunset * 0.08);
  const scene = rig.sun.parent;
  scene.background = sky;
  scene.fog.color.copy(sky);
  rig.sun.position.set(Math.cos(sunAngle) * 200, Math.max(sunH, 0.06) * 220 + 8, 90);
  rig.sun.intensity = 0.25 + day * 1.0;
  rig.sun.color.setHSL(0.09 * sunset + 0.13 * (1 - sunset), 0.5 * sunset + 0.1, 0.75);
  rig.hemi.intensity = 0.2 + day * 0.6;
  const night = t < 5.5 || t > 19.5;
  for (const bulb of rig.lamps) bulb.material = bulb.material; // bulbs are basic: always visible
  rig.water.material.color.setHSL(0.55, 0.6, lerp(0.12, 0.42, day));
  return { day, night, sunset };
}

// Push a circle (x, z, radius) out of building colliders. Returns true on hit.
export function collideCircle(colliders, pos, radius) {
  let hit = false;
  for (const c of colliders) {
    const cx = clamp(pos.x, c.minX, c.maxX);
    const cz = clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius;
      }
    }
  }
  return hit;
}

export function insideCity(x, z) {
  return Math.abs(x) < CITY.half && z > -CITY.half && z < CITY.waterZ - 4;
}
