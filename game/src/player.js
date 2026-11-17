// Player for Velvet Bay: the on-foot character, third-person camera,
// and entering / exiting cars (including stealing them).

import { clamp } from './state.js';
import { collideCircle, insideCity } from './city.js';
import { nearestVehicle } from './vehicles.js';
import { addHeat } from './police.js';

export function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0e7490 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.95, 0.36), jacket);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xf1c27d }));
  head.position.y = 1.8;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.84;
  g.add(hair);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.24), legMat);
  legL.position.set(-0.17, 0.31, 0);
  const legR = legL.clone();
  legR.position.x = 0.17;
  g.add(legL); g.add(legR);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x0e7490 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), armMat);
  armL.position.set(-0.44, 1.1, 0);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armL); g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

export class Player {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.mesh = buildPlayerMesh();
    this.mesh.position.set(state.playerPos.x, 0, state.playerPos.z);
    scene.add(this.mesh);
    this.walkPhase = 0;
    this.speed = 0;
  }

  // On-foot movement, camera-relative. Returns speed in m/s.
  update(dt, input, colliders, vehicles) {
    const s = this.state;
    if (s.inCar) {
      this.mesh.visible = false;
      return 0;
    }
    this.mesh.visible = true;
    // Drag-look rotates the camera yaw.
    s.cameraYaw -= input.lookDX * 0.005;
    s.cameraPitch = clamp(s.cameraPitch + input.lookDY * 0.003, 0.08, 1.1);
    const fwd = input.isDown('up') ? 1 : 0;
    const back = input.isDown('down') ? 1 : 0;
    const left = input.isDown('left') ? 1 : 0;
    const right = input.isDown('right') ? 1 : 0;
    const run = input.isDown('run');
    const moveZ = fwd - back;
    const moveX = right - left;
    const moving = moveZ !== 0 || moveX !== 0;
    const targetSpeed = moving ? (run ? 8.5 : 4.2) : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
    if (moving) {
      const camSin = Math.sin(s.cameraYaw);
      const camCos = Math.cos(s.cameraYaw);
      // Forward is away from the camera.
      let dx = -camSin * moveZ + camCos * moveX;
      let dz = -camCos * moveZ - camSin * moveX;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const nx = s.playerPos.x + dx * this.speed * dt;
      const nz = s.playerPos.z + dz * this.speed * dt;
      const pos = { x: nx, z: nz };
      collideCircle(colliders, pos, 0.7);
      if (insideCity(pos.x, pos.z)) {
        s.playerPos.x = pos.x;
        s.playerPos.z = pos.z;
      }
      s.playerHeading = Math.atan2(dx, dz);
      this.walkPhase += dt * this.speed * 2.2;
    }
    this.mesh.position.set(s.playerPos.x, 0, s.playerPos.z);
    this.mesh.rotation.y = s.playerHeading;
    const swing = Math.sin(this.walkPhase) * (this.speed > 0.3 ? 0.55 : 0);
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
    this.mesh.userData.armL.rotation.x = -swing * 0.7;
    this.mesh.userData.armR.rotation.x = swing * 0.7;
    return this.speed;
  }

  // E near a car: steal it (or hop into a parked one). E in a car: step out.
  tryEnterExit(vehicles, audio, addHeatFn) {
    const s = this.state;
    if (s.inCar) {
      const v = s.inCar;
      s.inCar = null;
      s.playerPos.x = v.x + Math.sin(v.heading + Math.PI / 2) * 2.5;
      s.playerPos.z = v.z + Math.cos(v.heading + Math.PI / 2) * 2.5;
      s.speedKmh = 0;
      return 'exit';
    }
    const v = nearestVehicle(vehicles, s.playerPos.x, s.playerPos.z, 4.5);
    if (!v) return null;
    s.inCar = v;
    s.carsStolen += 1;
    if (v.parked) {
      v.parked = false;
      v.traffic = false;
      addHeatFn(18, 'car theft');
      s.toast = `Stole the ${v.name} — the Bay PD noticed`;
      s.toastUntil = s.elapsed + 3;
      if (audio) audio.pickup();
    } else {
      s.toast = `Driving the ${v.name}`;
      s.toastUntil = s.elapsed + 2;
    }
    return 'enter';
  }

  // Third-person camera: behind the player, or high and far behind the car.
  // Staged screenshots snap the camera at once so the first frame is framed.
  updateCamera(camera, dt, input) {
    const s = this.state;
    if (s.inCar) {
      const v = s.inCar;
      s.cameraYaw = v.heading + Math.PI;
      const dist = 13;
      const h = 5.5;
      const tx = v.x + Math.sin(s.cameraYaw) * dist;
      const tz = v.z + Math.cos(s.cameraYaw) * dist;
      if (s.snapCamera) {
        camera.position.set(tx, h, tz);
        s.snapCamera = false;
      } else {
        camera.position.lerp(new THREE.Vector3(tx, h, tz), Math.min(1, dt * 6));
      }
      camera.lookAt(v.x, 1.6, v.z);
      return;
    }
    const dist = 10;
    const h = 3.2 + s.cameraPitch * 4;
    const tx = s.playerPos.x + Math.sin(s.cameraYaw) * dist;
    const tz = s.playerPos.z + Math.cos(s.cameraYaw) * dist;
    if (s.snapCamera) {
      camera.position.set(tx, h, tz);
      s.snapCamera = false;
    } else {
      camera.position.lerp(new THREE.Vector3(tx, h, tz), Math.min(1, dt * 8));
    }
    camera.lookAt(s.playerPos.x, 1.6, s.playerPos.z);
  }

  respawn(x, z) {
    const s = this.state;
    s.inCar = null;
    s.playerPos.x = x;
    s.playerPos.z = z;
    s.health = 100;
    s.wantedHeat = 0;
    s.wanted = 0;
    this.mesh.position.set(x, 0, z);
  }
}
