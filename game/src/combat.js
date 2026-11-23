// Velvet Bay — combat: 4 weapon slots, hitscan tracers that fade,
// muzzle flash, gang return fire, ammo, damage + wanted heat.
// Written fresh for round 10 (attempt 5).

export const WEAPONS = [
  { name: 'PISTOL', dmg: 34, rate: 0.38, spread: 0.012, auto: false, ammo: Infinity, max: Infinity, color: 0xffe9a8 },
  { name: 'SMG', dmg: 17, rate: 0.09, spread: 0.045, auto: true, ammo: 240, max: 240, color: 0x9fd0ff },
  { name: 'SHOTGUN', dmg: 13, rate: 0.85, spread: 0.09, auto: false, ammo: 48, max: 48, pellets: 6, color: 0xffb36b },
  { name: 'RIFLE', dmg: 55, rate: 0.5, spread: 0.006, auto: false, ammo: 60, max: 60, color: 0xb6ff9d },
];

export function createCombat(scene, state, camera) {
  const tracers = [];
  let slot = 0;
  let cooldown = 0;
  let flashUntil = 0;
  let flashSprite = null;
  let enemyFireTimer = 0;

  function muzzleWorld() {
    const p = state.player;
    const fwd = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
    const pos = new THREE.Vector3(p.x, 1.35, p.z).addScaledVector(fwd, 0.9);
    return pos;
  }

  function shoot(events) {
    if (cooldown > 0) return;
    const w = WEAPONS[slot];
    if (w.ammo !== Infinity && w.ammo <= 0) {
      events?.onDryFire?.();
      cooldown = 0.25;
      return;
    }
    cooldown = w.rate;
    if (w.ammo !== Infinity) w.ammo--;
    state.shotsFired++;
    const p = state.player;
    // Aim from the camera through the screen center.
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const pellets = w.pellets || 1;
    let hitAnything = false;
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.y += (Math.random() - 0.5) * w.spread * 2;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
      const hit = traceShot(origin, d, events);
      if (hit) hitAnything = true;
    }
    // Muzzle flash sprite at the gun.
    if (!flashSprite) {
      const tex = makeFlashTexture();
      flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      flashSprite.scale.set(1.6, 1.6, 1);
      scene.add(flashSprite);
    }
    flashSprite.position.copy(muzzleWorld());
    flashSprite.material.opacity = 1;
    flashUntil = state.time + 0.07;
    events?.onShot?.(hitAnything);
  }

  function makeFlashTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,220,1)');
    g.addColorStop(0.4, 'rgba(255,200,90,0.9)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  // Ray vs gang peds (sphere test) + traffic cars (sphere test) + ground.
  function traceShot(origin, dir, events) {
    const maxDist = 120;
    let bestT = maxDist;
    let bestPed = null;
    let bestCar = null;
    const peds = events?.peds?.peds ?? [];
    for (const ped of peds) {
      if (!ped.alive || ped.kind !== 'gang') continue;
      const t = raySphere(origin, dir, new THREE.Vector3(ped.x, 1.1, ped.z), 0.9);
      if (t !== null && t < bestT) { bestT = t; bestPed = ped; bestCar = null; }
    }
    const cars = events?.vehicles?.cars ?? [];
    for (const car of cars) {
      if (car.kind === 'player') continue;
      const t = raySphere(origin, dir, new THREE.Vector3(car.x, 0.8, car.z), 2.4);
      if (t !== null && t < bestT) { bestT = t; bestCar = car; bestPed = null; }
    }
    const groundT = dir.y < -0.001 ? (0.05 - origin.y) / dir.y : null;
    if (groundT !== null && groundT > 0 && groundT < bestT) bestT = groundT;
    const end = origin.clone().addScaledVector(dir, Math.min(bestT, maxDist));
    spawnTracer(muzzleWorld(), end, WEAPONS[slot].color);
    if (bestPed) {
      const w = WEAPONS[slot];
      bestPed.health -= w.dmg;
      if (bestPed.health <= 0 && bestPed.alive) {
        bestPed.alive = false;
        events?.onKill?.(bestPed);
      }
      return true;
    }
    if (bestCar) {
      bestCar.panic = 4;
      events?.onCarHit?.(bestCar);
      return true;
    }
    return false;
  }

  function raySphere(origin, dir, center, radius) {
    const oc = center.clone().sub(origin);
    const tca = oc.dot(dir);
    if (tca < 0) return null;
    const d2 = oc.dot(oc) - tca * tca;
    const r2 = radius * radius;
    if (d2 > r2) return null;
    return tca - Math.sqrt(r2 - d2);
  }

  function spawnTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.9,
    }));
    scene.add(line);
    tracers.push({ line, life: 0.22 });
  }

  function update(dt, events) {
    cooldown = Math.max(0, cooldown - dt);
    if (flashSprite && state.time > flashUntil) flashSprite.material.opacity = 0;
    for (let i = tracers.length - 1; i >= 0; i--) {
      const t = tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.22) * 0.9;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        tracers.splice(i, 1);
      }
    }
    // Gang return fire: nearby gang members shoot at the player.
    enemyFireTimer -= dt;
    if (enemyFireTimer <= 0) {
      enemyFireTimer = 1.1;
      const peds = events?.peds?.peds ?? [];
      const p = state.player;
      for (const ped of peds) {
        if (!ped.alive || ped.kind !== 'gang') continue;
        const d = Math.hypot(ped.x - p.x, ped.z - p.z);
        if (d < 34 && Math.random() < 0.5) {
          spawnTracer(new THREE.Vector3(ped.x, 1.4, ped.z), new THREE.Vector3(p.x, 1.2, p.z), 0xff6b5a);
          if (Math.random() < 0.45) {
            events?.onPlayerHit?.(6 + Math.floor(Math.random() * 7));
          }
        }
      }
    }
  }

  function selectSlot(i) {
    if (i >= 0 && i < WEAPONS.length) slot = i;
  }

  function refill() {
    for (const w of WEAPONS) if (w.ammo !== Infinity) w.ammo = w.max;
  }

  return {
    shoot, update, selectSlot, refill,
    get slot() { return slot; },
    get weapon() { return WEAPONS[slot]; },
    get cooldown() { return cooldown; },
  };
}
