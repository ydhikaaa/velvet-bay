// Velvet Bay — vehicles: player driving physics, traffic AI (brake when
// blocked, panic-flee 1.7x after gunfire/collisions), parked cars to steal.
// Written fresh for round 10 (attempt 5).
import { ROAD_LINES, WORLD } from './state.js';
import { buildCar } from './models.js';
import { createRng } from './state.js';

const PALETTE = [0xc22430, 0x2f6fd0, 0xe8b73a, 0x3f9448, 0x8a8f98, 0x6a4a8c, 0xd97b2f, 0x22262e, 0x7fb3c8, 0xb03a5a];
const NAMES = ['Comet', 'Stallion', 'Falcon', 'Vortex', 'Cruiser', 'Specter', 'Ranger', 'Duchess', 'Tornado', 'Mirage'];

function roadCoord(v) { return v; }

// Pick a random point on the road grid. Forward is (sin h, cos h): heading
// PI/2 drives +x, 0 drives +z. A car on a road running along X heads +-PI/2.
function randomRoadPoint(rng) {
  const horizontal = rng.chance(0.5);
  const line = rng.pick(ROAD_LINES);
  const along = rng.range(-288, 288);
  return horizontal ? { x: along, z: line, heading: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 }
    : { x: line, z: along, heading: rng.chance(0.5) ? 0 : Math.PI };
}

export function createVehicles(scene, state) {
  const rng = createRng(777001);
  const cars = []; // traffic + parked + player car share this list
  let nextId = 1;

  function spawnCar(x, z, heading, kind) {
    const color = kind === 'police' ? 0x1c2733 : rng.pick(PALETTE);
    const mesh = buildCar(color, {});
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading - Math.PI / 2;
    scene.add(mesh);
    const car = {
      id: nextId++, mesh, kind: kind || 'traffic',
      x, z, heading, speed: 0,
      maxSpeed: kind === 'police' ? 34 : rng.range(13, 19),
      cruise: rng.range(10, 16),
      name: kind === 'police' ? 'Bay PD Cruiser' : rng.pick(NAMES),
      panic: 0, // seconds of panic-flee remaining
      blocked: 0,
      target: null, // traffic waypoint {x,z}
      color,
      stolen: false,
    };
    if (kind === 'traffic') {
      const p = randomRoadPoint(rng);
      car.x = p.x; car.z = p.z; car.heading = p.heading;
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = p.heading - Math.PI / 2;
      pickWaypoint(car);
    }
    cars.push(car);
    return car;
  }

  function pickWaypoint(car) {
    // Traffic follows the grid: pick a random road line, drive along it.
    // alongX: fixed z-line, heading +-PI/2 (forward is (sin h, cos h)).
    if (rng.chance(0.5)) {
      const z = rng.pick(ROAD_LINES);
      const dir = rng.chance(0.5) ? 1 : -1;
      car.target = { x: dir > 0 ? 288 : -288, z, alongX: true };
      car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const x = rng.pick(ROAD_LINES);
      const dir = rng.chance(0.5) ? 1 : -1;
      car.target = { x, z: dir > 0 ? 288 : -288, alongX: false };
      car.heading = dir > 0 ? 0 : Math.PI;
    }
  }

  // Player's starting ride + parked cars to steal.
  const playerCar = spawnCar(28, 60, Math.PI / 2, 'player');
  playerCar.maxSpeed = 38;
  for (let i = 0; i < 16; i++) {
    const p = randomRoadPoint(rng);
    const parked = spawnCar(p.x + rng.range(-2, 2), p.z + rng.range(-2, 2), p.heading, 'parked');
    parked.speed = 0;
  }
  for (let i = 0; i < 13; i++) spawnCar(0, 0, 0, 'traffic');

  function carAhead(car, dist) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let best = null, bestD = dist;
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < bestD && side < 3.2) { best = other; bestD = along; }
    }
    return best;
  }

  function updateTraffic(dt, events) {
    for (const car of cars) {
      if (car.kind === 'player' || car.kind === 'police') continue;
      if (car.kind === 'parked') continue;
      // Panic: flee fast in current direction after gunfire/collision.
      const speedTarget = car.panic > 0 ? car.maxSpeed * 1.7 : car.cruise;
      if (car.panic > 0) car.panic -= dt;
      const blocker = carAhead(car, 11);
      let target = speedTarget;
      if (blocker) {
        target = Math.max(0, blocker.speed - 2);
        car.blocked += dt;
      } else car.blocked = 0;
      car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 14 * dt);
      if (car.speed < 0) car.speed = 0;
      // Waypoint reached? pick a new road.
      const t = car.target;
      if (t) {
        const arrived = t.alongX ? Math.abs(car.x - t.x) < 6 : Math.abs(car.z - t.z) < 6;
        if (arrived) pickWaypoint(car);
      }
      // Steer toward target line gently (snap to grid lane).
      if (t) {
        if (t.alongX) {
          car.z += Math.sign(t.z - car.z) * Math.min(Math.abs(t.z - car.z), 6 * dt);
          car.heading = car.target.x > car.x ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.x += Math.sign(t.x - car.x) * Math.min(Math.abs(t.x - car.x), 6 * dt);
          car.heading = car.target.z > car.z ? 0 : Math.PI;
        }
      }
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Keep inside the city; bounce at the edges.
      if (car.x < -310 || car.x > WORLD.beachX - 6 || car.z < -310 || car.z > 310) {
        car.heading += Math.PI;
        car.x = Math.max(-308, Math.min(WORLD.beachX - 8, car.x));
        car.z = Math.max(-308, Math.min(308, car.z));
        pickWaypoint(car);
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading - Math.PI / 2;
      // Wheel spin.
      const spin = car.speed * dt * 2.4;
      for (const w of car.mesh.userData.wheels) w.rotation.z += spin;
    }
  }

  // Player driving: arcade physics with accel, brake, steering, handbrake.
  function updatePlayerCar(dt, input, events) {
    const car = playerCar;
    if (!state.player.inCar) return;
    const accel = input.keys.has('up') ? 26 : input.keys.has('down') ? -18 : 0;
    const steer = (input.keys.has('left') ? 1 : 0) - (input.keys.has('right') ? 1 : 0);
    const braking = input.keys.has('brake');
    car.speed += accel * dt;
    if (braking) car.speed *= Math.max(0, 1 - 3.2 * dt);
    // Drag + rolling resistance.
    car.speed -= car.speed * 0.55 * dt;
    car.speed = Math.max(-12, Math.min(car.maxSpeed, car.speed));
    if (Math.abs(car.speed) < 0.15 && accel === 0) car.speed = 0;
    // Steering scales with speed; reverse flips it.
    const steerRate = 1.9 * Math.min(1, Math.abs(car.speed) / 9) * (car.speed < 0 ? -1 : 1);
    car.heading += steer * steerRate * dt * (braking ? 1.5 : 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // Collide with buildings: clamp to road corridors near blocks is too
    // costly; instead soft-clamp at the world edge + beach water line.
    car.x = Math.max(-312, Math.min(WORLD.beachX - 2, nx));
    car.z = Math.max(-312, Math.min(312, nz));
    // Bump into traffic: slow down + spark panic in the other car.
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.4 && Math.abs(car.speed) > 4) {
        other.panic = 3;
        car.speed *= 0.45;
        events?.onCollision?.(other);
      }
    }
    state.player.x = car.x; state.player.z = car.z;
    state.player.heading = car.heading;
    state.player.speed = Math.abs(car.speed);
    state.stats.distanceDriven += Math.abs(car.speed) * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading - Math.PI / 2;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.z += spin;
    // Headlight beams at dusk/night.
    const night = state.timeOfDay === 'night' || state.timeOfDay === 'dusk';
    for (const b of car.mesh.userData.beams) b.material.opacity = night ? 0.28 : 0;
  }

  function nearestStealable(x, z, maxD = 5) {
    let best = null, bestD = maxD;
    for (const car of cars) {
      if (car.kind !== 'parked' && car.kind !== 'traffic') continue;
      if (car.kind === 'traffic' && car.speed > 0.5) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }

  function setBeams(car, on) {
    for (const b of car.mesh.userData.beams) b.material.opacity = on ? 0.28 : 0;
  }

  return {
    cars, playerCar, updateTraffic, updatePlayerCar, nearestStealable, setBeams,
    panicNearby(x, z, radius) {
      for (const car of cars) {
        if (car.kind !== 'traffic') continue;
        if (Math.hypot(car.x - x, car.z - z) < radius) car.panic = 4;
      }
    },
  };
}
