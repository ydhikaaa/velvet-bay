// Velvet Bay — pedestrians: walkers on sidewalks, night phone glow,
// panic flee after gunfire, Red Tide gang enemies for combat missions.
// Written fresh for round 10 (attempt 5).
import { buildCharacter } from './models.js';
import { createRng, ROAD_LINES } from './state.js';

const SHIRTS = [0xd94f4f, 0x3f9448, 0xe8b73a, 0x7a4a8c, 0x4a6fa5, 0xd97b2f, 0x9a8f98, 0x2f8f7a];
const SKINS = [0xc98d64, 0x8a5a34, 0xe8b88a, 0x6b4226, 0xd9a06b];

export function createPedestrians(scene, state) {
  const rng = createRng(424242);
  const peds = [];
  let nextId = 1;

  function spawnPed(x, z, kind = 'walker') {
    const mesh = kind === 'gang'
      ? buildCharacter({ shirt: 0x8c1f28, skin: rng.pick(SKINS), pants: 0x1a1a1e, hair: 0x0d0d0d })
      : buildCharacter({ shirt: rng.pick(SHIRTS), skin: rng.pick(SKINS), pants: rng.pick([0x23262e, 0x3a3f46, 0x5a4a3a]), hair: rng.pick([0x1a1410, 0x3a2a1a, 0x0d0d0d, 0x6a6a6a]) });
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    // Phone glow: small emissive plane held up at night.
    const phone = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0 }));
    phone.position.set(0.42, 1.35, 0.25);
    phone.rotation.y = -0.4;
    mesh.add(phone);
    const ped = {
      id: nextId++, mesh, phone, kind,
      x, z, heading: rng.range(0, Math.PI * 2),
      speed: kind === 'gang' ? 0 : rng.range(1.2, 2.2),
      target: null, panic: 0, phase: rng.range(0, 6),
      health: kind === 'gang' ? 60 : 100,
      alive: true,
    };
    pickTarget(ped);
    peds.push(ped);
    return ped;
  }

  function pickTarget(ped) {
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(-288, 288);
    ped.target = rng.chance(0.5)
      ? { x: along, z: line + rng.pick([-12, 12]) }
      : { x: line + rng.pick([-12, 12]), z: along };
  }

  // Walkers scattered across the city, clustered near downtown + beach.
  for (let i = 0; i < 26; i++) {
    const line = rng.pick(ROAD_LINES);
    const along = rng.range(-288, 288);
    const x = rng.chance(0.5) ? along : line + rng.pick([-12, 12]);
    const z = rng.chance(0.5) ? line + rng.pick([-12, 12]) : along;
    spawnPed(x, z, 'walker');
  }

  function update(dt, events) {
    const night = state.timeOfDay === 'night' || state.timeOfDay === 'dusk';
    for (const ped of peds) {
      if (!ped.alive) continue;
      if (ped.kind === 'gang') {
        // Gang members hold position, occasionally sidestep; they shoot when
        // the player is near (handled by combat.js via ped positions).
        ped.phase += dt;
        ped.mesh.position.y = Math.sin(ped.phase * 2) * 0.02;
        ped.phone.material.opacity = 0;
        continue;
      }
      ped.phone.material.opacity = night ? 0.85 : 0;
      let speed = ped.speed;
      let tx = ped.target.x, tz = ped.target.z;
      if (ped.panic > 0) {
        ped.panic -= dt;
        speed = 6.5;
        // Flee directly away from the player.
        const dx = ped.x - state.player.x, dz = ped.z - state.player.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.x + (dx / d) * 30;
        tz = ped.z + (dz / d) * 30;
      }
      const dx = tx - ped.x, dz = tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) { pickTarget(ped); continue; }
      ped.heading = Math.atan2(dx / d, dz / d);
      ped.x += (dx / d) * speed * dt;
      ped.z += (dz / d) * speed * dt;
      ped.x = Math.max(-312, Math.min(288, ped.x));
      ped.z = Math.max(-312, Math.min(312, ped.z));
      ped.phase += dt * speed * 3.2;
      const swing = Math.sin(ped.phase) * 0.55;
      const { arms, legs } = ped.mesh.userData;
      arms[0].rotation.x = swing; arms[1].rotation.x = -swing;
      legs[0].rotation.x = -swing; legs[1].rotation.x = swing;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Player ran one over: crime + panic burst.
      const pd = Math.hypot(ped.x - state.player.x, ped.z - state.player.z);
      if (state.player.inCar && state.player.speed > 6 && pd < 2.2) {
        events?.onPedHit?.(ped);
      }
    }
  }

  function panicNearby(x, z, radius) {
    for (const ped of peds) {
      if (ped.kind !== 'walker' || !ped.alive) continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.panic = 4;
    }
  }

  function spawnGang(x, z, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(spawnPed(x + (i - count / 2) * 4, z + (i % 2) * 3, 'gang'));
    }
    return out;
  }

  function removeGang(list) {
    for (const ped of list) {
      ped.alive = false;
      scene.remove(ped.mesh);
      const i = peds.indexOf(ped);
      if (i >= 0) peds.splice(i, 1);
    }
  }

  return { peds, update, panicNearby, spawnGang, removeGang };
}
