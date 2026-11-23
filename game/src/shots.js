// Velvet Bay — screenshot staging: ?shot=cover|street|mission|night poses the
// real running game (never a mockup) and main.js sets window.__shotReady
// after the scene has rendered for a few frames.
// Written fresh for round 10 (attempt 5).
import { missionById, createMissionRuntime } from './missions.js';

function putPlayerInCar(ctx, x, z, heading, speed = 0) {
  const { state, vehicles } = ctx;
  const car = vehicles.playerCar;
  car.x = x; car.z = z; car.heading = heading; car.speed = speed;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading - Math.PI / 2;
  state.player.inCar = true;
  state.player.carId = car.id;
  state.player.x = x; state.player.z = z;
  state.player.heading = heading;
  state.player.speed = speed;
}

function putPlayerOnFoot(ctx, x, z, heading) {
  const { state } = ctx;
  state.player.inCar = false;
  state.player.carId = null;
  state.player.x = x; state.player.z = z;
  state.player.heading = heading;
  state.player.speed = 0;
}

function seedTraffic(ctx, spots) {
  // Park a few traffic cars around the shot for density.
  const { vehicles } = ctx;
  const traffic = vehicles.cars.filter((c) => c.kind === 'traffic');
  spots.forEach((s, i) => {
    const car = traffic[i % traffic.length];
    if (!car) return;
    car.x = s.x; car.z = s.z; car.heading = s.h;
    car.speed = s.speed ?? 8;
    car.mesh.position.set(s.x, 0, s.z);
    car.mesh.rotation.y = s.h - Math.PI / 2;
  });
}

function showHeli(ctx, x, y, z) {
  const heli = ctx.city.dyn.heli;
  if (!heli) return;
  heli.visible = true;
  heli.userData.baseY = y;
  heli.position.set(x, y, z);
}

export function stageShot(mode, ctx) {
  const { state, city } = ctx;
  state.screen = 'play';
  document.getElementById('hud').classList.add('on');
  document.getElementById('start').classList.add('hidden');
  state.muted = true; // screenshots run silent
  state.musicOn = false;

  if (mode === 'cover') {
    // Elevated golden-hour chase: eastbound on the pier road, helicopter
    // crossing the sky, traffic ahead, mission HUD live.
    city.applyTimeOfDay('golden');
    state.timeOfDay = 'golden';
    state.clockMinutes = 17 * 60 + 35;
    putPlayerInCar(ctx, 150, 32, Math.PI / 2, 14);
    seedTraffic(ctx, [
      { x: 216, z: 30, h: Math.PI / 2, speed: 12 },
      { x: 226, z: 36, h: Math.PI / 2, speed: 11 },
      { x: 176, z: 34, h: Math.PI / 2, speed: 13 },
      { x: 240, z: 28, h: -Math.PI / 2, speed: 10 },
    ]);
    showHeli(ctx, 268, 14, 50);
    const rt = createMissionRuntime(missionById('m2'), ctx);
    rt.stageIndex = 0;
    state.mission = rt;
    state.missionId = 'm2';
    ctx.hud.say('DELIA', 'Package is on the pier, Rio. Grab it and run the city — you have two minutes.');
    ctx.city.setBeacon(296, 32, true);
    state.cameraZoom = 1.0;
  } else if (mode === 'street') {
    // Premium street level at noon: downtown canyon, traffic + pedestrians.
    city.applyTimeOfDay('noon');
    state.timeOfDay = 'noon';
    state.clockMinutes = 12 * 60 + 10;
    putPlayerOnFoot(ctx, 20, 44, Math.PI * 0.85);
    seedTraffic(ctx, [
      { x: 24, z: -32, h: 0, speed: 10 },
      { x: -24, z: 32, h: Math.PI, speed: 9 },
      { x: 0, z: -64, h: Math.PI / 2, speed: 11 },
      { x: 32, z: 0, h: -Math.PI / 2, speed: 8 },
    ]);
    ctx.hud.say('VELVET BAY', 'Downtown at noon — towers, traffic and a whole city to take.');
    state.cameraZoom = 0.9;
  } else if (mode === 'mission') {
    // Real mission in progress: Harbor Lights stage 2, timed run, HUD live.
    city.applyTimeOfDay('golden');
    state.timeOfDay = 'golden';
    state.clockMinutes = 18 * 60 + 5;
    // Westbound through downtown, toward the hideout (the timed run's goal).
    putPlayerInCar(ctx, 0, 32, -Math.PI / 2, 18);
    seedTraffic(ctx, [
      { x: -20, z: 30, h: -Math.PI / 2, speed: 13 },
      { x: -32, z: 36, h: -Math.PI / 2, speed: 12 },
      { x: 20, z: 34, h: -Math.PI / 2, speed: 14 },
      { x: -64, z: -64, h: 0, speed: 11 },
    ]);
    const rt = createMissionRuntime(missionById('m2'), ctx);
    rt.stageIndex = 1; // timed cross-city stage
    rt.timer = 87;
    state.mission = rt;
    state.missionId = 'm2';
    ctx.hud.say('DELIA', 'Clock is running — 87 seconds to the hideout. Do not stop for anyone.');
    ctx.city.setBeacon(-224, 192, true);
    state.wanted = 2;
    state.wantedHeat = 45;
    state.cameraZoom = 1.0;
  } else if (mode === 'night') {
    // Coastal boulevard at night: palms, lamp glow, neon, beams on.
    city.applyTimeOfDay('night');
    state.timeOfDay = 'night';
    state.clockMinutes = 21 * 60 + 40;
    putPlayerInCar(ctx, 188, -32, Math.PI / 2, 12);
    seedTraffic(ctx, [
      { x: 210, z: -30, h: Math.PI / 2, speed: 11 },
      { x: 222, z: -36, h: Math.PI / 2, speed: 10 },
      { x: 168, z: -34, h: Math.PI / 2, speed: 12 },
    ]);
    showHeli(ctx, 250, 12, -18);
    ctx.hud.say('MARTA', 'The boulevard never sleeps. Neither do we.');
    state.cameraZoom = 1.1;
  }
  // Let the loop settle, then the page is ready to screenshot.
  ctx.markShotReady();
}
