// Velvet Bay — boot + frame loop. Wires city, vehicles, player, pedestrians,
// police, missions, combat, HUD, audio and save together.
// Written fresh for round 10 (attempt 5).
import { createState, districtAt } from './state.js';
import { createInput } from './input.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPlayer } from './player.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame } from './save.js';
import { MISSIONS, missionById, nextMissionId, createMissionRuntime, updateMission } from './missions.js';
import { stageShot } from './shots.js';
import { auditGeometry } from './models.js';

// ---- Error accounting (never claim zero errors without this) ----
window.__pageErrors = 0;
window.__pageErrorLog = [];
function noteError(source, message) {
  window.__pageErrors++;
  window.__pageErrorLog.push(`${source}: ${message}`);
}
window.addEventListener('error', (e) => noteError('error', e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => noteError('rejection', String(e.reason)));
const _consoleError = console.error.bind(console);
console.error = (...args) => {
  noteError('console.error', args.map(String).join(' '));
  _consoleError(...args);
};

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);

const state = createState();
const scene = new THREE.Scene();
const city = createCity(scene);
const input = createInput(document.getElementById('scene'));
const vehicles = createVehicles(scene, state);
const player = createPlayer(scene, state);
const pedestrians = createPedestrians(scene, state);
const police = createPolice(scene, state, vehicles);
const combat = createCombat(scene, state, city.camera);
const audio = createAudio(state);

const hudCtx = {
  get missionRt() { return state.mission; },
  get nextMission() {
    const id = nextMissionId(state.missionsDone);
    return id ? missionById(id) : null;
  },
  combat, police,
  get playerCar() { return vehicles.playerCar; },
  get cityPackages() { return city.dyn.packages; },
  get policeCruisers() { return police.cruisers; },
};
const hud = createHud(state, () => hudCtx);

const missionCtx = {
  state, city, scene, vehicles, pedestrians, police, combat, audio,
  say: (name, text) => hud.say(name, text),
  toast: (text) => hud.toast(text),
};
const shotCtx = {
  ...missionCtx, hud,
  markShotReady() { shotFrames = 0; shotArmed = true; },
};

// Geometry audit hook for the headless verification gate.
window.__geometryAudit = () => auditGeometry(scene);
window.__game = { state, city, vehicles, police, pedestrians, combat, MISSIONS };

let shotArmed = false;
let shotFrames = -1;

// ---- Save ----
let saveLoaded = false;
if (!shotMode) {
  saveLoaded = loadGame(state);
  if (saveLoaded) {
    // Hide already-collected packages.
    for (const idx of state.packagesFound) {
      const pkg = city.dyn.packages[idx];
      if (pkg) pkg.visible = false;
    }
    if (state.timeOfDay) city.applyTimeOfDay(state.timeOfDay);
  }
}
if (saveLoaded) {
  document.getElementById('saveNote').textContent = 'Save found — your money, jobs and packages are waiting.';
}

// ---- Screens ----
const screens = {
  start: document.getElementById('start'),
  pause: document.getElementById('pause'),
  busted: document.getElementById('busted'),
  wasted: document.getElementById('wasted'),
};
function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.style.display = key === name ? 'flex' : 'none';
  }
  document.getElementById('hud').classList.toggle('on', name === null);
  if (name === null) document.getElementById('hud').classList.add('on');
}
document.getElementById('startBtn').addEventListener('click', () => {
  audio.ensure(); audio.resume();
  state.screen = 'play';
  showScreen(null);
  hud.say('DELIA', saveLoaded
    ? 'Back already? Good. The city missed you — let us get back to work.'
    : 'Rio. You made it out of the docks. Get wheels, get money, stay ahead of the Bay PD.');
});
document.getElementById('resumeBtn').addEventListener('click', () => {
  state.screen = 'play';
  showScreen(null);
});
document.getElementById('bustedBtn').addEventListener('click', () => {
  respawn();
  state.screen = 'play';
  showScreen(null);
});
document.getElementById('wastedBtn').addEventListener('click', () => {
  respawn();
  state.screen = 'play';
  showScreen(null);
});

function respawn() {
  state.health = 100;
  state.armor = 0;
  state.wanted = 0;
  state.wantedHeat = 0;
  police.clearAll();
  state.player.inCar = false;
  state.player.carId = null;
  state.player.x = -64; state.player.z = -64;
  state.player.heading = Math.PI / 2;
  const car = vehicles.playerCar;
  car.x = -56; car.z = -64; car.heading = Math.PI / 2; car.speed = 0;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading - Math.PI / 2;
  state.money = Math.max(0, state.money - 200);
  saveGame(state);
}

function startNextMission() {
  const id = nextMissionId(state.missionsDone);
  if (!id) { hud.toast('All 8 jobs complete — the bay is yours.'); return; }
  const def = missionById(id);
  combat.refill();
  const rt = createMissionRuntime(def, missionCtx);
  state.mission = rt;
  state.missionId = id;
  hud.say(def.giver.toUpperCase(), def.brief);
  hud.toast(`JOB STARTED — ${def.title} · $${def.pay.toLocaleString()}`);
  audio.chirp();
}

// ---- Combat + crime events ----
const combatEvents = {
  peds: pedestrians, vehicles,
  onShot(hit) {
    audio.gunshot();
    police.addHeat(4);
    pedestrians.panicNearby(state.player.x, state.player.z, 45);
    vehicles.panicNearby(state.player.x, state.player.z, 45);
    if (state.wanted >= 1) audio.sirenBlip();
  },
  onDryFire() { audio.dryFire(); hud.toast('Out of ammo — mission restock refills you.'); },
  onKill(ped) {
    state.kills++;
    police.addHeat(15);
    hud.toast('Red Tide down.');
  },
  onCarHit() { police.addHeat(6); },
  onPlayerHit(dmg) {
    state.health -= dmg;
    const d = document.getElementById('damage');
    d.style.display = 'block';
    setTimeout(() => { d.style.display = 'none'; }, 180);
    if (state.health <= 0) {
      state.screen = 'wasted';
      showScreen('wasted');
    }
  },
};

const pedEvents = {
  onPedHit(ped) {
    ped.alive = false;
    scene.remove(ped.mesh);
    const i = pedestrians.peds.indexOf(ped);
    if (i >= 0) pedestrians.peds.splice(i, 1);
    police.addHeat(30);
    state.stats.pedsHit++;
    pedestrians.panicNearby(ped.x, ped.z, 30);
    hud.toast('You hit a pedestrian — the Bay PD is coming.');
  },
};

const vehicleEvents = {
  onCollision() { audio.crash(); },
  onSteal(car) {
    // The stolen car becomes the player's ride; the old starter car is
    // removed from the world so it can never be "stolen" again invisible.
    const old = vehicles.playerCar;
    if (old && old !== car) {
      scene.remove(old.mesh);
      const i = vehicles.cars.indexOf(old);
      if (i >= 0) vehicles.cars.splice(i, 1);
    }
    car.kind = 'player';
    vehicles.playerCar = car;
    state.player.inCar = true;
    state.player.carId = car.id;
    state.player.x = car.x; state.player.z = car.z;
    state.player.heading = car.heading;
    state.carsStolen++;
    police.addHeat(25);
    audio.sirenBlip();
    hud.toast(`You stole the ${car.name} — Bay PD is on you.`);
  },
};

// ---- Frame loop ----
const clock = new THREE.Clock();
let saveTimer = 0;
let frameCount = 0;

function step(dt) {
  state.time += dt;
  state.clockMinutes += dt * 1.0; // 1 real second = 1 game minute
  if (state.clockMinutes >= 1440) state.clockMinutes -= 1440;

  // Auto time-of-day from the clock (skipped in shot mode).
  if (!shotMode) {
    const h = Math.floor(state.clockMinutes / 60);
    const want = h >= 7 && h < 17 ? 'noon' : h >= 17 && h < 19 ? 'golden' : h >= 19 || h < 5 ? 'night' : 'dusk';
    if (want !== state.timeOfDay && !(state.mission && state.mission.def.night)) {
      state.timeOfDay = want;
      city.applyTimeOfDay(want);
    }
  }

  // Exit car.
  if (state.player.inCar && input.pressed('enter')) {
    const car = vehicles.playerCar;
    state.player.inCar = false;
    state.player.carId = null;
    state.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
    state.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
    state.player.heading = car.heading;
    vehicles.setBeams(car, false);
  }
  // Start next mission at the office beacon.
  if (!state.mission && input.pressed('enter')) {
    const d = Math.hypot(state.player.x - (-64), state.player.z - (-64));
    if (d < 9) startNextMission();
  }
  // Pause / music / retry / weapon slots.
  if (input.pressed('pause') && state.screen === 'play') {
    state.screen = 'paused';
    showScreen('pause');
  } else if (input.pressed('pause') && state.screen === 'paused') {
    state.screen = 'play';
    showScreen(null);
  }
  if (input.pressed('music')) {
    state.musicOn = !state.musicOn;
    hud.toast(state.musicOn ? 'Music on.' : 'Music off.');
  }
  if (input.pressed('retry') && state.mission) {
    // Clean up the active run (gang + van) before restarting the same job.
    const rt = state.mission;
    if (rt.enemies?.length) pedestrians.removeGang(rt.enemies);
    if (rt.van) scene.remove(rt.van);
    state.mission = null; state.missionId = null;
    city.setBeacon(0, 0, false);
    startNextMission();
  }
  for (let i = 0; i < 4; i++) {
    if (input.pressed(`slot${i + 1}`)) combat.selectSlot(i);
  }
  if (input.consumeShoot() || input.keys.has('shoot')) combat.shoot(combatEvents);

  // World updates.
  vehicles.updateTraffic(dt);
  vehicles.updatePlayerCar(dt, input, vehicleEvents);
  player.update(dt, input, vehicles, vehicleEvents);
  pedestrians.update(dt, pedEvents);
  police.update(dt, { city, frozen: !!shotMode });
  combat.update(dt, combatEvents);
  city.update(dt, state, state.player);

  // Mission update.
  if (state.mission) {
    const res = updateMission(state.mission, dt, missionCtx);
    if (res === 'done') {
      saveGame(state);
      hud.toast('Job complete.');
    } else if (res === 'failed') {
      hud.toast('Job failed — press E at Delia\u2019s office to try again.');
    }
  } else {
    // Idle office beacon for the next job.
    const next = nextMissionId(state.missionsDone);
    city.setBeacon(-64, -64, !!next);
  }

  // Hidden package pickup.
  for (const pkg of city.dyn.packages) {
    if (!pkg.visible) continue;
    const d = Math.hypot(state.player.x - pkg.position.x, state.player.z - pkg.position.z);
    if (d < 3.2) {
      pkg.visible = false;
      state.packages++;
      state.packagesFound.push(pkg.userData.index);
      state.money += 150;
      audio.pickup();
      hud.toast(`Hidden package ${state.packages}/12 — +$150`);
      if (state.packages >= 12) {
        state.money += 2500;
        hud.toast('ALL 12 PACKAGES — completion bonus +$2,500!');
        hud.say('DELIA', 'Every package in the city, Rio. You are a legend now.');
      }
      saveGame(state);
    }
  }

  // Police ram feedback.
  // (handled via police events below)

  // Audio + HUD.
  audio.update(dt, state.player.inCar ? state.player.speed * 3.6 : 0, state.player.inCar);
  hud.update();

  // Autosave.
  saveTimer += dt;
  if (saveTimer > 15) { saveTimer = 0; saveGame(state); }

  // Camera.
  if (state.screen === 'start') {
    player.menuCamera(dt, city.camera, state.time);
  } else {
    player.updateCamera(dt, city.camera, vehicles.playerCar);
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  frameCount++;
  if (state.screen === 'play') step(dt);
  else if (state.screen === 'start') {
    state.time += dt;
    city.update(dt, state, { x: 120, z: 40 });
    player.menuCamera(dt, city.camera, state.time);
    vehicles.updateTraffic(dt);
  }
  city.renderer.render(scene, city.camera);
  if (shotArmed) {
    shotFrames++;
    if (shotFrames >= 45) {
      window.__shotReady = true;
      shotArmed = false;
    }
  }
}

// Police ram + arrest wiring (events passed into police.update).
const _policeUpdate = police.update;
police.update = (dt, events) => _policeUpdate(dt, {
  ...events,
  onRam() {
    audio.crash();
    state.health = Math.max(1, state.health - 3);
    hud.toast('Bay PD rammed you!');
  },
  onArrest() {
    state.screen = 'busted';
    showScreen('busted');
    state.wanted = 0;
    state.wantedHeat = 0;
    police.clearAll();
    hud.say('BAY PD', 'You are coming with us, Marlowe.');
  },
});

// ---- Shot mode ----
if (shotMode) {
  showScreen(null);
  stageShot(shotMode, shotCtx);
} else {
  showScreen('start');
}

frame();
console.log('Velvet Bay ready. screen=', state.screen, 'shot=', shotMode || 'none');
