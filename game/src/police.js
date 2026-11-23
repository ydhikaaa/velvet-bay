// Velvet Bay — Bay PD: wanted stars, cruiser pursuit + ramming, foot cops,
// roadblocks at 4+ stars, CONDOR-1 helicopter at 3+ stars, busted logic.
// Written fresh for round 10 (attempt 5).
import { buildCar, buildCharacter } from './models.js';
import { createRng, ROAD_LINES } from './state.js';

export function createPolice(scene, state, vehicles) {
  const rng = createRng(99117);
  const cruisers = [];
  const cops = [];
  let nextId = 1;
  let spawnCooldown = 0;
  let roadblock = null; // { x, z, heading, cars: [] }
  const heli = { active: false, angle: 0 };

  function spawnCruiser(x, z) {
    const mesh = buildCar(0x14181f, {});
    // White doors read as a police livery: pale roof band.
    const bandGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.1, 4);
    bandGeo.rotateZ(Math.PI / 2);
    bandGeo.scale(1, 0.5, 1);
    const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({
      color: 0xe8e8e8, roughness: 0.4, metalness: 0.3,
    }));
    band.position.set(0, 1.05, 0);
    mesh.add(band);
    // Light bar: two emissive domes.
    for (const [wz, col] of [[0.4, 0xff2020], [-0.4, 0x2040ff]]) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 2.2, roughness: 0.3,
        }));
      dome.scale.set(1, 0.6, 1);
      dome.position.set(-0.1, 1.32, wz);
      mesh.add(dome);
    }
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const c = {
      id: nextId++, mesh, x, z, heading: 0, speed: 0, maxSpeed: 33,
      ramCooldown: 0,
    };
    cruisers.push(c);
    return c;
  }

  function spawnCop(x, z) {
    const mesh = buildCharacter({ shirt: 0x1c2f4a, skin: rng.pick([0xc98d64, 0x8a5a34, 0xe8b88a]), pants: 0x1c2f4a, hair: 0x0d0d0d });
    // Cap: flattened dark sphere.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x10141c, roughness: 0.6 }));
    cap.scale.set(1, 0.45, 1);
    cap.position.y = 1.92;
    mesh.add(cap);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const cop = { id: nextId++, mesh, x, z, heading: 0, phase: rng.range(0, 6) };
    cops.push(cop);
    return cop;
  }

  function clearRoadblock() {
    if (!roadblock) return;
    for (const car of roadblock.cars) {
      scene.remove(car.mesh);
      const i = cruisers.indexOf(car);
      if (i >= 0) cruisers.splice(i, 1);
    }
    roadblock = null;
  }

  function makeRoadblock(px, pz, heading) {
    clearRoadblock();
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const bx = px + fx * 42, bz = pz + fz * 42;
    const cars = [];
    // Two cruisers angled across the road + a barrier of crates is implied by
    // the angled cars; place them perpendicular to the road.
    for (const off of [-4.5, 4.5]) {
      const rx = -fz, rz = fx; // road-right vector
      const car = spawnCruiser(bx + rx * off, bz + rz * off);
      car.heading = heading + Math.PI / 2 + (off > 0 ? 0.35 : -0.35);
      car.mesh.rotation.y = car.heading - Math.PI / 2;
      car.mesh.position.set(car.x, 0, car.z);
      car.roadblock = true;
      cars.push(car);
    }
    roadblock = { x: bx, z: bz, heading, cars };
  }

  function wantedTarget() {
    return Math.max(0, Math.min(5, Math.floor(state.wantedHeat / 20)));
  }

  function addHeat(amount) {
    state.wantedHeat = Math.max(0, Math.min(100, state.wantedHeat + amount));
    const target = wantedTarget();
    if (target > state.wanted) state.wanted = target;
  }

  function update(dt, events) {
    // In screenshot staging the police hold still: no spawns, no pursuit,
    // no ram toasts mid-shot. The HUD still shows the staged wanted level.
    if (events?.frozen) return;
    const p = state.player;
    // Wanted decays when the player stays out of trouble and out of sight.
    const nearCop = cruisers.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 40)
      || cops.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 25);
    if (state.wanted > 0 && !nearCop) {
      state.wantedHeat = Math.max(0, state.wantedHeat - dt * 1.6);
      const target = wantedTarget();
      if (target < state.wanted) state.wanted = target;
    }

    // Spawn pressure scales with stars.
    spawnCooldown -= dt;
    const wantCruisers = state.wanted === 0 ? 0 : state.wanted <= 1 ? 1 : state.wanted <= 2 ? 2 : state.wanted <= 3 ? 3 : 4;
    if (state.wanted > 0 && cruisers.filter((c) => !c.roadblock).length < wantCruisers && spawnCooldown <= 0) {
      const a = rng.range(0, Math.PI * 2);
      spawnCruiser(p.x + Math.sin(a) * 70, p.z + Math.cos(a) * 70);
      spawnCooldown = 4;
    }
    // Foot cops join at 2+ stars when the player is on foot.
    if (state.wanted >= 2 && !p.inCar && cops.length < 2 && spawnCooldown <= -2) {
      const a = rng.range(0, Math.PI * 2);
      spawnCop(p.x + Math.sin(a) * 26, p.z + Math.cos(a) * 26);
      spawnCooldown = 6;
    }
    // Helicopter at 3+ stars.
    const city = events?.city;
    if (state.wanted >= 3) {
      heli.active = true;
      if (city?.dyn?.heli) {
        city.dyn.heli.visible = true;
        heli.angle += dt * 0.25;
        const hx = p.x + Math.sin(heli.angle) * 38;
        const hz = p.z + Math.cos(heli.angle) * 38;
        city.dyn.heli.position.set(hx, 55 + Math.sin(state.time * 1.3) * 2, hz);
        city.dyn.heli.rotation.y = Math.atan2(p.x - hx, p.z - hz) - Math.PI / 2;
        city.dyn.heli.userData.rotor.rotation.y += dt * 22;
      }
    } else if (heli.active) {
      heli.active = false;
      if (city?.dyn?.heli) city.dyn.heli.visible = false;
    }
    // Roadblocks at 4+ stars, ahead of the player.
    if (state.wanted >= 4 && !roadblock) {
      makeRoadblock(p.x, p.z, p.heading);
    } else if (state.wanted < 4 && roadblock) {
      clearRoadblock();
    }

    // Cruiser pursuit: chase, ram, and slow near the player.
    for (const c of cruisers) {
      if (c.roadblock) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx / d, dz / d);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += dh * Math.min(1, 2.6 * dt);
      const targetSpeed = d > 60 ? c.maxSpeed : d > 12 ? c.maxSpeed * 0.85 : 10;
      c.speed += Math.sign(targetSpeed - c.speed) * Math.min(Math.abs(targetSpeed - c.speed), 22 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading - Math.PI / 2;
      const spin = c.speed * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.rotation.z += spin;
      // Ram: contact with the player's car slows them and rattles the player.
      if (d < 4.6) {
        c.ramCooldown -= dt;
        if (c.ramCooldown <= 0) {
          c.ramCooldown = 1.2;
          events?.onRam?.(c);
        }
      }
    }
    // Foot cops walk toward the player; arrest on contact.
    for (const cop of cops) {
      const dx = p.x - cop.x, dz = p.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      cop.heading = Math.atan2(dx / d, dz / d);
      const speed = p.inCar ? 7 : 5.4;
      cop.x += (dx / d) * speed * dt;
      cop.z += (dz / d) * speed * dt;
      cop.phase += dt * speed * 3;
      const swing = Math.sin(cop.phase) * 0.6;
      const { arms, legs } = cop.mesh.userData;
      arms[0].rotation.x = swing; arms[1].rotation.x = -swing;
      legs[0].rotation.x = -swing; legs[1].rotation.x = swing;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      if (d < 2.0 && !p.inCar) events?.onArrest?.(cop);
    }
    // Despawn far units when the heat is gone.
    if (state.wanted === 0) {
      for (let i = cruisers.length - 1; i >= 0; i--) {
        const c = cruisers[i];
        if (c.roadblock) continue;
        if (Math.hypot(c.x - p.x, c.z - p.z) > 160) {
          scene.remove(c.mesh);
          cruisers.splice(i, 1);
        }
      }
      for (let i = cops.length - 1; i >= 0; i--) {
        const cop = cops[i];
        if (Math.hypot(cop.x - p.x, cop.z - p.z) > 90) {
          scene.remove(cop.mesh);
          cops.splice(i, 1);
        }
      }
    }
  }

  function clearAll() {
    for (const c of cruisers) scene.remove(c.mesh);
    for (const cop of cops) scene.remove(cop.mesh);
    cruisers.length = 0;
    cops.length = 0;
    clearRoadblock();
  }

  return {
    cruisers, cops, addHeat, update, clearAll,
    get roadblock() { return roadblock; },
    unitCount() { return cruisers.filter((c) => !c.roadblock).length + cops.length + (heli.active ? 1 : 0); },
  };
}
