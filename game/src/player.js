// Velvet Bay — on-foot player: movement, walk cycle, enter/exit car,
// low chase camera with mouse-wheel zoom (0.55x–1.9x).
// Written fresh for round 10 (attempt 5).
import { buildCharacter } from './models.js';
import { WORLD } from './state.js';

export function createPlayer(scene, state) {
  const mesh = buildCharacter({ shirt: 0x2f6fd0, skin: 0xc98d64, pants: 0x23262e });
  mesh.position.set(state.player.x, 0, state.player.z);
  scene.add(mesh);
  const cam = { yaw: Math.PI / 2, pitch: 0.32, dist: 9 };
  let walkPhase = 0;
  let moving = false;

  function update(dt, input, vehicles, events) {
    const p = state.player;
    const look = input.consumeLook();
    cam.yaw -= look.dx * 0.004;
    cam.pitch = Math.max(0.08, Math.min(1.1, cam.pitch + look.dy * 0.002));
    const wheel = input.consumeWheel();
    if (wheel !== 0) {
      state.cameraZoom = Math.max(0.55, Math.min(1.9, state.cameraZoom + (wheel > 0 ? 0.12 : -0.12)));
    }
    if (p.inCar) { mesh.visible = false; return; }
    mesh.visible = true;

    // Enter a nearby car.
    if (input.pressed('enter')) {
      const car = vehicles.nearestStealable(p.x, p.z);
      if (car) {
        events?.onSteal?.(car);
        return;
      }
    }

    const run = input.keys.has('run');
    const speed = run ? 9.5 : 5.2;
    let mx = 0, mz = 0;
    if (input.keys.has('up')) mz += 1;
    if (input.keys.has('down')) mz -= 1;
    if (input.keys.has('left')) mx -= 1;
    if (input.keys.has('right')) mx += 1;
    moving = mx !== 0 || mz !== 0;
    if (moving) {
      // Move relative to the camera yaw: forward = (sin yaw, cos yaw),
      // screen-right = (-cos yaw, sin yaw).
      const sin = Math.sin(cam.yaw), cos = Math.cos(cam.yaw);
      const wx = sin * mz - cos * mx;
      const wz = cos * mz + sin * mx;
      const len = Math.hypot(wx, wz) || 1;
      p.x += (wx / len) * speed * dt;
      p.z += (wz / len) * speed * dt;
      p.x = Math.max(-312, Math.min(WORLD.beachX - 2, p.x));
      p.z = Math.max(-312, Math.min(312, p.z));
      const targetHeading = Math.atan2(wx / len, wz / len);
      let dh = targetHeading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += dh * Math.min(1, 12 * dt);
      walkPhase += dt * (run ? 13 : 9);
    }
    // Walk-cycle swing.
    const swing = moving ? Math.sin(walkPhase) * (run ? 0.85 : 0.6) : 0;
    const { arms, legs } = mesh.userData;
    arms[0].rotation.x = swing;
    arms[1].rotation.x = -swing;
    legs[0].rotation.x = -swing;
    legs[1].rotation.x = swing;
    // Idle breathing.
    if (!moving) {
      mesh.userData.torso.position.y = 1.18 + Math.sin(state.time * 2) * 0.012;
    }
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = p.heading;
    p.speed = moving ? speed : 0;
  }

  function updateCamera(dt, camera, focusCar) {
    const p = state.player;
    const dist = 7 * state.cameraZoom;
    const height = 2.6 + cam.pitch * 3.2;
    let tx, tz, ty;
    if (p.inCar && focusCar) {
      const back = focusCar.heading + Math.PI;
      tx = focusCar.x + Math.sin(back) * dist;
      tz = focusCar.z + Math.cos(back) * dist;
      ty = 2.3 + cam.pitch * 2.2;
      camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, 7 * dt));
      camera.lookAt(focusCar.x + Math.sin(focusCar.heading) * 8, 1.4, focusCar.z + Math.cos(focusCar.heading) * 8);
    } else {
      const back = cam.yaw + Math.PI;
      tx = p.x + Math.sin(back) * dist;
      tz = p.z + Math.cos(back) * dist;
      ty = height;
      camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, 8 * dt));
      camera.lookAt(p.x, 1.5, p.z);
    }
  }

  function menuCamera(dt, camera, t) {
    // Slow cinematic orbit over the golden-hour boulevard for the title screen.
    const a = t * 0.05;
    camera.position.set(Math.sin(a) * 150 + 120, 42 + Math.sin(t * 0.11) * 6, Math.cos(a) * 150 + 40);
    camera.lookAt(120, 18, 0);
  }

  return { mesh, update, updateCamera, menuCamera, cam };
}
