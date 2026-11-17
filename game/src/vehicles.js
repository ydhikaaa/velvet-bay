// Vehicles for Velvet Bay: car factory, player driving, traffic AI and police cars.
// Cars are built from boxes + cylinder wheels; no external models.

import { CITY, ROAD_LINES, mulberry32, pick, clamp, nearestRoad } from './state.js';
import { collideCircle } from './city.js';

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x7f8c8d, 0x16a085];
const CAR_NAMES = ['Comet', 'Stallion', 'Bison', 'Falcon', 'Vortex', 'Sunset', 'Marlin', 'Dune'];

export function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.2),
    new THREE.MeshLambertMaterial({ color: isPolice ? 0x111111 : 0x1e2a38 }));
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights so cars read at dusk.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    h.position.set(hx, 0.55, 2.22);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const hx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t.position.set(hx, 0.55, -2.22);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.16, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 4.42),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  return group;
}

export function makeVehicle(scene, opts) {
  const mesh = buildCarMesh(opts.color, !!opts.police);
  mesh.position.set(opts.x, 0, opts.z);
  mesh.rotation.y = opts.heading || 0;
  scene.add(mesh);
  const v = {
    mesh,
    x: opts.x, z: opts.z,
    heading: opts.heading || 0,
    speed: 0,
    maxSpeed: opts.maxSpeed || (14 + Math.random() * 8),
    accel: 11,
    name: opts.name || pick(mulberry32((opts.x | 0) + 7), CAR_NAMES),
    color: opts.color,
    police: !!opts.police,
    traffic: !!opts.traffic,
    parked: !!opts.parked,
    axis: opts.axis || 'z',       // traffic travel axis
    dir: opts.dir || 1,
    lane: opts.lane || 0,
    turnCooldown: 0,
    wrecked: false,
    health: 100,
  };
  return v;
}

// Spawn parked stealable cars along roads and a traffic stream.
export function spawnVehicles(scene) {
  const rng = mulberry32(777);
  const vehicles = [];
  for (let i = 0; i < 14; i++) {
    const road = pick(rng, ROAD_LINES);
    const along = -260 + rng() * 520;
    const horizontal = rng() < 0.5;
    const v = makeVehicle(scene, {
      x: horizontal ? along : road + (rng() < 0.5 ? -3.4 : 3.4),
      z: horizontal ? road + (rng() < 0.5 ? -3.4 : 3.4) : along,
      heading: horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      color: pick(rng, CAR_COLORS),
      parked: true,
    });
    vehicles.push(v);
  }
  for (let i = 0; i < 16; i++) {
    const road = pick(rng, ROAD_LINES);
    const horizontal = rng() < 0.5;
    const v = makeVehicle(scene, {
      x: horizontal ? -260 + rng() * 520 : road + (rng() < 0.5 ? -3 : 3),
      z: horizontal ? road + (rng() < 0.5 ? -3 : 3) : -260 + rng() * 520,
      heading: 0,
      color: pick(rng, CAR_COLORS),
      traffic: true,
      axis: horizontal ? 'x' : 'z',
      dir: rng() < 0.5 ? 1 : -1,
      lane: 3,
    });
    v.speed = v.maxSpeed * (0.6 + rng() * 0.4);
    v.heading = v.axis === 'x' ? (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (v.dir > 0 ? 0 : Math.PI);
    vehicles.push(v);
  }
  return vehicles;
}

export function nearestVehicle(vehicles, x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const v of vehicles) {
    if (v.wrecked) continue;
    const d = Math.hypot(v.x - x, v.z - z);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

// Arcade driving: accelerate, steer by speed, brake, handbrake drift.
export function driveVehicle(v, input, dt, colliders) {
  const fwd = input.isDown('up');
  const back = input.isDown('down');
  const left = input.isDown('left');
  const right = input.isDown('right');
  const brake = input.isDown('brake');
  if (fwd) v.speed += v.accel * dt;
  if (back) v.speed -= v.accel * 0.8 * dt;
  if (brake) v.speed *= Math.pow(0.12, dt);
  v.speed -= v.speed * 0.35 * dt; // rolling drag
  v.speed = clamp(v.speed, -9, v.maxSpeed * 1.6);
  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  const steerFactor = clamp(Math.abs(v.speed) / 8, 0, 1);
  v.heading += steer * 1.9 * steerFactor * dt * Math.sign(v.speed || 1);
  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  const pos = { x: nx, z: nz };
  const hit = collideCircle(colliders, pos, 2.2);
  if (hit) v.speed *= 0.4;
  if (Math.abs(nx) > CITY.half + 6 || nz < -CITY.half - 6 || nz > CITY.waterZ - 6) {
    v.speed *= 0.5;
  } else {
    v.x = pos.x; v.z = pos.z;
  }
  v.mesh.position.set(v.x, 0, v.z);
  v.mesh.rotation.y = v.heading;
  v.mesh.rotation.z = -steer * 0.05 * steerFactor;
  for (const w of v.mesh.userData.wheels) w.rotation.x += v.speed * dt * 2.2;
  return Math.abs(v.speed) * 3.6;
}

// Traffic cars cruise their road; at intersections they sometimes turn.
export function updateTraffic(vehicles, dt, colliders, playerPos, wanted) {
  for (const v of vehicles) {
    if (!v.traffic || v.wrecked) continue;
    v.turnCooldown -= dt;
    const nearX = nearestRoad(v.x);
    const nearZ = nearestRoad(v.z);
    if (v.turnCooldown <= 0 && Math.abs(v.x - nearX) < 4 && Math.abs(v.z - nearZ) < 4 && Math.random() < 0.01) {
      // Turn onto the crossing road.
      const wasX = v.axis === 'x';
      v.axis = wasX ? 'z' : 'x';
      v.dir = Math.random() < 0.5 ? 1 : -1;
      v.heading = v.axis === 'x' ? (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (v.dir > 0 ? 0 : Math.PI);
      v.turnCooldown = 4;
    }
    // Slow down if the player is right ahead (a little courtesy).
    const pd = Math.hypot(v.x - playerPos.x, v.z - playerPos.z);
    let target = v.maxSpeed;
    if (pd < 10) target = v.maxSpeed * 0.4;
    v.speed += (target - v.speed) * dt;
    v.x += Math.sin(v.heading) * v.speed * dt;
    v.z += Math.cos(v.heading) * v.speed * dt;
    if (v.x > CITY.half) v.x = -CITY.half;
    if (v.x < -CITY.half) v.x = CITY.half;
    if (v.z > CITY.waterZ - 8) v.z = -CITY.half;
    if (v.z < -CITY.half) v.z = CITY.waterZ - 8;
    v.mesh.position.set(v.x, 0, v.z);
    v.mesh.rotation.y = v.heading;
    for (const w of v.mesh.userData.wheels) w.rotation.x += v.speed * dt * 2.2;
  }
}

// Flash the police light bar red/blue.
export function flashPolice(vehicles, t) {
  for (const v of vehicles) {
    if (!v.police || !v.mesh.userData.lightBar) continue;
    v.mesh.userData.lightBar.material.color.setHex(Math.sin(t * 10) > 0 ? 0xff2222 : 0x2244ff);
  }
}
