// Pedestrians for Velvet Bay: walkers on the sidewalks who flee gunfire and
// police chases. Built from simple coloured boxes and spheres.

import { CITY, ROAD_LINES, mulberry32, pick, clamp } from './state.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8];
const SKINS = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];

export function buildPedMesh(shirt, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.95, 0.34),
    new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.78;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), legMat);
  legL.position.set(-0.16, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  g.add(legL); g.add(legR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function spawnPedestrians(scene, count) {
  const rng = mulberry32(4242);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildPedMesh(pick(rng, SHIRTS), pick(rng, SKINS));
    const road = pick(rng, ROAD_LINES);
    const along = -280 + rng() * 560;
    const horizontal = rng() < 0.5;
    const x = horizontal ? along : road + (rng() < 0.5 ? -8.5 : 8.5);
    const z = horizontal ? road + (rng() < 0.5 ? -8.5 : 8.5) : along;
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      mesh,
      x, z,
      heading: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.9,
      walkPhase: rng() * 6,
      fleeing: false,
      state: 'walk', // walk | flee | down
      health: 100,
      enemy: false,
    });
  }
  return peds;
}

// Spawn hostile gang members for the dockyard mission.
export function spawnEnemies(scene, cx, cz, count) {
  const rng = mulberry32(99);
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildPedMesh(0x8b0000, pick(rng, SKINS));
    const x = cx + (rng() - 0.5) * 40;
    const z = cz + (rng() - 0.5) * 40;
    mesh.position.set(x, 0, z);
    // Red bandana stripe so enemies read clearly.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.12, 0.56),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    band.position.y = 1.85;
    mesh.add(band);
    scene.add(mesh);
    enemies.push({
      mesh, x, z,
      heading: rng() * Math.PI * 2,
      speed: 2.2,
      walkPhase: 0,
      fleeing: false,
      state: 'walk',
      health: 100,
      enemy: true,
      shootCooldown: 1 + rng() * 2,
    });
  }
  return enemies;
}

export function updatePedestrians(peds, dt, playerPos, gunfirePos, colliders) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    const dPlayer = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
    p.fleeing = (gunfirePos && Math.hypot(p.x - gunfirePos.x, p.z - gunfirePos.z) < 40) || dPlayer < 6;
    if (p.fleeing) {
      // Run away from the threat.
      const ax = p.x - playerPos.x, az = p.z - playerPos.z;
      const len = Math.hypot(ax, az) || 1;
      p.heading = Math.atan2(ax / len, az / len);
      p.speed = 4.2;
    } else {
      p.speed = 1.3;
      if (Math.random() < dt * 0.02) p.heading += (Math.random() - 0.5) * 1.6;
    }
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.x = clamp(p.x, -CITY.half, CITY.half);
    p.z = clamp(p.z, -CITY.half, CITY.waterZ - 6);
    p.walkPhase += dt * p.speed * 4;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    p.mesh.userData.legL.rotation.x = Math.sin(p.walkPhase) * 0.6;
    p.mesh.userData.legR.rotation.x = -Math.sin(p.walkPhase) * 0.6;
  }
}

export function nearestPed(peds, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const p of peds) {
    if (p.state === 'down') continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}
