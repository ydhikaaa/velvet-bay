// Combat for Velvet Bay: hitscan shooting with tracers, enemy return fire,
// health, and cash pickups scattered around the city.

import { clamp } from './state.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.pickups = [];
    this.gunfirePos = null;
    this.gunfireUntil = 0;
    this.enemyFireTimer = 0;
  }

  spawnPickups(scene, positions) {
    for (const [x, z] of positions) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.5, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2ecc71 }));
      mesh.position.set(x, 0.7, z);
      scene.add(mesh);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.07, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0x7dff9b }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.7, z);
      scene.add(ring);
      this.pickups.push({ mesh, ring, x, z, taken: false, value: 50 });
    }
  }

  // Player fires from the camera toward the crosshair. Returns what was hit.
  shoot(state, camera, peds, vehicles, audio) {
    if (state.ammo <= 0 || state.mode !== 'playing') return null;
    state.ammo -= 1;
    audio.gunshot();
    this.gunfirePos = { x: state.playerPos.x, z: state.playerPos.z };
    this.gunfireUntil = state.elapsed + 2;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const ray = new THREE.Raycaster(origin, dir, 0.1, 90);
    let best = null;
    let bestDist = 90;
    for (const p of peds) {
      if (p.state === 'down') continue;
      const d = this.rayHitPed(ray, p);
      if (d !== null && d < bestDist) { bestDist = d; best = { type: 'ped', target: p }; }
    }
    for (const v of vehicles) {
      if (v.wrecked) continue;
      const d = this.rayHitCar(ray, v);
      if (d !== null && d < bestDist) { bestDist = d; best = { type: 'car', target: v }; }
    }
    const end = origin.clone().add(dir.clone().multiplyScalar(best ? bestDist : 60));
    this.addTracer(origin, end);
    if (best && best.type === 'ped') {
      best.target.health -= 50;
      if (best.target.health <= 0) {
        best.target.state = 'down';
        best.target.mesh.rotation.x = Math.PI / 2;
        best.target.mesh.position.y = 0.4;
        state.kills += 1;
        state.money += 25;
        if (best.target.enemy) state.missionKills = (state.missionKills || 0) + 1;
      }
    }
    if (best && best.type === 'car') {
      best.target.health -= 20;
      if (best.target.health <= 0) best.target.wrecked = true;
    }
    return best;
  }

  rayHitPed(ray, p) {
    const sphere = new THREE.Sphere(new THREE.Vector3(p.x, 1.0, p.z), 0.9);
    const hit = ray.ray.intersectSphere(sphere, new THREE.Vector3());
    return hit ? ray.ray.origin.distanceTo(hit) : null;
  }

  rayHitCar(ray, v) {
    const box = new THREE.Box3(
      new THREE.Vector3(v.x - 1.4, 0, v.z - 2.6),
      new THREE.Vector3(v.x + 1.4, 2, v.z + 2.6));
    const hit = ray.ray.intersectBox(box, new THREE.Vector3());
    return hit ? ray.ray.origin.distanceTo(hit) : null;
  }

  addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8 }));
    this.scene.add(line);
    this.tracers.push({ line, until: performance.now() / 1000 + 0.08 });
  }

  // Enemies shoot back with poor aim; the player takes damage over time.
  enemyFire(dt, state, enemies, audio) {
    this.enemyFireTimer -= dt;
    const alive = enemies.filter((e) => e.state !== 'down');
    if (alive.length === 0 || state.mode !== 'playing') return;
    for (const e of alive) {
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        e.shootCooldown = 2 + Math.random() * 2;
        const dist = Math.hypot(e.x - state.playerPos.x, e.z - state.playerPos.z);
        if (dist < 45) {
          const from = new THREE.Vector3(e.x, 1.4, e.z);
          const to = new THREE.Vector3(
            state.playerPos.x + (Math.random() - 0.5) * 3,
            1.2,
            state.playerPos.z + (Math.random() - 0.5) * 3);
          this.addTracer(from, to);
          audio.gunshot();
          if (Math.random() < 0.35) {
            state.health = Math.max(0, state.health - 8);
          }
        }
      }
    }
  }

  update(dt, state, playerPos, audio) {
    const now = performance.now() / 1000;
    this.tracers = this.tracers.filter((t) => {
      if (now > t.until) { this.scene.remove(t.line); return false; }
      return true;
    });
    if (this.gunfireUntil < state.elapsed) this.gunfirePos = null;
    for (const p of this.pickups) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 2;
      p.ring.rotation.z += dt;
      if (Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 1.6) {
        p.taken = true;
        this.scene.remove(p.mesh);
        this.scene.remove(p.ring);
        state.money += p.value;
        state.toast = `+$${p.value} street cash`;
        state.toastUntil = state.elapsed + 2;
        audio.pickup();
      }
    }
  }
}

export function damagePlayer(state, amount) {
  state.health = clamp(state.health - amount, 0, 100);
  return state.health <= 0;
}
