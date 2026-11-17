// Wanted level + Bay PD for Velvet Bay. Crimes add heat; heat sets stars;
// police cars chase, foot cops arrest, and heat cools when the player hides.

import { CITY, clamp } from './state.js';
import { makeVehicle } from './vehicles.js';

export const WANTED_NAMES = ['Clean', 'Suspect', 'Fugitive', 'Most Wanted', 'Heat Wave', 'Citywide Manhunt'];

export function addHeat(state, amount, reason) {
  state.wantedHeat = clamp(state.wantedHeat + amount, 0, 100);
  const stars = state.wantedHeat <= 0 ? 0
    : state.wantedHeat < 18 ? 1
    : state.wantedHeat < 38 ? 2
    : state.wantedHeat < 58 ? 3
    : state.wantedHeat < 80 ? 4 : 5;
  if (stars > state.wanted) {
    state.wanted = stars;
    state.toast = `WANTED LEVEL ${stars} — ${WANTED_NAMES[stars]}`;
    state.toastUntil = state.elapsed + 3;
  } else {
    state.wanted = stars;
  }
  return stars;
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.cops = [];
    this.arrestTimer = 0;
    this.spawnTimer = 0;
  }

  // Spawn one pursuit car at an exact spot (used by staged screenshots).
  spawnCarAt(x, z) {
    const car = makeVehicle(this.scene, {
      x, z,
      heading: 0,
      color: 0x111111,
      police: true,
      maxSpeed: 30,
    });
    return car;
  }

  desiredCars(wanted) {
    return wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted + 1;
  }

  update(dt, state, playerPos, playerSpeed, colliders, onBusted, audio) {
    const wanted = state.wanted;
    // Cool down when the player is out of sight and slow.
    if (wanted > 0 && playerSpeed < 4) {
      state.wantedHeat = Math.max(0, state.wantedHeat - dt * 1.4);
      state.wanted = state.wantedHeat <= 0 ? 0
        : state.wantedHeat < 18 ? 1
        : state.wantedHeat < 38 ? 2
        : state.wantedHeat < 58 ? 3
        : state.wantedHeat < 80 ? 4 : 5;
    }
    audio.setSiren(wanted > 0);

    // Spawn / despawn pursuit cars to match the wanted level.
    this.spawnTimer -= dt;
    if (this.cars.length < this.desiredCars(wanted) && this.spawnTimer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const car = makeVehicle(this.scene, {
        x: clamp(playerPos.x + Math.sin(angle) * 60, -CITY.half, CITY.half),
        z: clamp(playerPos.z + Math.cos(angle) * 60, -CITY.half, CITY.waterZ - 10),
        heading: angle,
        color: 0x111111,
        police: true,
        maxSpeed: 26 + wanted * 2,
      });
      this.cars.push(car);
      this.spawnTimer = 3;
    }
    while (this.cars.length > this.desiredCars(wanted)) {
      const car = this.cars.pop();
      this.scene.remove(car.mesh);
    }

    // Pursuit: steer toward the player, ram on contact.
    for (const car of this.cars) {
      const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
      const targetSpeed = dist > 8 ? car.maxSpeed : car.maxSpeed * 0.5;
      car.speed += (targetSpeed - car.speed) * dt * 0.8;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
      if (dist < 3.2) {
        // Ram: shove the player and add a little heat.
        state.health = Math.max(0, state.health - dt * 14);
        if (state.inCar) car.speed *= 0.6;
      }
    }

    // Foot cops: only when the player is on foot and wanted.
    if (wanted >= 2 && !state.inCar && this.cops.length < wanted) {
      const angle = Math.random() * Math.PI * 2;
      const cop = this.spawnCop(
        clamp(playerPos.x + Math.sin(angle) * 26, -CITY.half, CITY.half),
        clamp(playerPos.z + Math.cos(angle) * 26, -CITY.half, CITY.waterZ - 10));
      this.cops.push(cop);
    }
    let nearestCop = Infinity;
    for (const cop of this.cops) {
      const dx = playerPos.x - cop.x, dz = playerPos.z - cop.z;
      const dist = Math.hypot(dx, dz);
      nearestCop = Math.min(nearestCop, dist);
      cop.heading = Math.atan2(dx, dz);
      const speed = dist > 4 ? 5.2 : 3.2;
      cop.x += Math.sin(cop.heading) * speed * dt;
      cop.z += Math.cos(cop.heading) * speed * dt;
      cop.walkPhase += dt * speed * 4;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      cop.mesh.userData.legL.rotation.x = Math.sin(cop.walkPhase) * 0.6;
      cop.mesh.userData.legR.rotation.x = -Math.sin(cop.walkPhase) * 0.6;
    }
    // Arrest: a cop stays within arm's reach while the player is slow.
    if (nearestCop < 1.8 && playerSpeed < 2 && wanted > 0) {
      this.arrestTimer += dt;
      if (this.arrestTimer > 1.2) {
        this.arrestTimer = 0;
        onBusted();
      }
    } else {
      this.arrestTimer = Math.max(0, this.arrestTimer - dt * 2);
    }
    if (wanted === 0) {
      for (const cop of this.cops) this.scene.remove(cop.mesh);
      this.cops = [];
    }
  }

  spawnCop(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.95, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xf1c27d }));
    head.position.y = 1.78;
    g.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.28, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x0d1b33 }));
    cap.position.y = 1.98;
    g.add(cap);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x0d1b33 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.22), legMat);
    legL.position.set(-0.16, 0.3, 0);
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legL); g.add(legR);
    g.userData.legL = legL; g.userData.legR = legR;
    g.position.set(x, 0, z);
    this.scene.add(g);
    return { mesh: g, x, z, heading: 0, walkPhase: 0 };
  }

  clear() {
    for (const car of this.cars) this.scene.remove(car.mesh);
    for (const cop of this.cops) this.scene.remove(cop.mesh);
    this.cars = [];
    this.cops = [];
    this.arrestTimer = 0;
  }
}
