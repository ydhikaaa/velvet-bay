// Velvet Bay — main loop and wiring. Boots the renderer, builds the city,
// and runs the frame loop that ties player, traffic, police, missions,
// combat, HUD, audio and saving together.

import { createState, clamp } from './state.js';
import { createInput } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity, updateSky } from './city.js';
import { spawnVehicles, driveVehicle, updateTraffic, flashPolice, nearestVehicle } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, nearestPed } from './pedestrians.js';
import { Police, addHeat } from './police.js';
import { Combat } from './combat.js';
import { MissionManager, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { Player } from './player.js';
import { saveGame, loadGame, applySave } from './save.js';
import { applyShotMode } from './shots.js';

const state = createState();
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 6, 14);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const input = createInput(canvas);
const audio = new AudioEngine();
const rig = buildCity(scene, state);
const vehicles = spawnVehicles(scene);
const peds = spawnPedestrians(scene, 42);
const police = new Police(scene);
const combat = new Combat(scene);
const missions = new MissionManager(scene);
const hud = new HUD(state);
const player = new Player(scene, state);

combat.spawnPickups(scene, [
  [30, 90], [-90, -30], [150, -90], [-150, 150], [90, -210],
  [-210, -150], [210, 210], [30, -150], [-30, 210], [120, 30],
]);

// Overlays.
const startScreen = document.getElementById('start');
const pauseScreen = document.getElementById('pause');
const bustedScreen = document.getElementById('busted');
const wastedScreen = document.getElementById('wasted');
const saveNote = document.getElementById('saveNote');

const saved = loadGame();
if (saved) {
  applySave(state, saved);
  saveNote.textContent = `Save found: $${saved.money.toLocaleString('en-US')}, ${saved.missionsDone} mission(s) done — press START ENGINE to continue.`;
  player.mesh.position.set(state.playerPos.x, 0, state.playerPos.z);
}

function showOnly(el) {
  for (const s of [startScreen, pauseScreen, bustedScreen, wastedScreen]) s.style.display = 'none';
  if (el) el.style.display = 'flex';
}

function startPlaying() {
  audio.ensure();
  state.mode = 'playing';
  showOnly(null);
  hud.show();
  if (!missions.active && state.missionIndex < MISSIONS.length) {
    missions.start(state, state.missionIndex, audio);
  }
}

document.getElementById('startBtn').addEventListener('click', startPlaying);
document.getElementById('resumeBtn').addEventListener('click', () => {
  state.mode = 'playing';
  showOnly(null);
});
document.getElementById('bustedBtn').addEventListener('click', () => {
  state.money = Math.max(0, state.money - 200);
  player.respawn(0, 30);
  police.clear();
  state.mode = 'playing';
  showOnly(null);
  saveGame(state);
});
document.getElementById('wastedBtn').addEventListener('click', () => {
  state.money = Math.max(0, state.money - 200);
  player.respawn(0, 30);
  police.clear();
  state.mode = 'playing';
  showOnly(null);
  saveGame(state);
});

function onBusted() {
  if (state.mode !== 'playing') return;
  state.busts += 1;
  state.mode = 'busted';
  audio.busted();
  showOnly(bustedScreen);
  saveGame(state);
}

function onWasted() {
  if (state.mode !== 'playing') return;
  state.deaths += 1;
  state.mode = 'wasted';
  audio.busted();
  showOnly(wastedScreen);
  saveGame(state);
}

// Staged screenshot modes: skip the menu and drop straight into the scene.
const shot = applyShotMode({ state, player, vehicles, police, missions, audio });
if (shot && shot !== 'start') {
  state.mode = 'playing';
  showOnly(null);
  hud.show();
}

// Frame loop.
const clock = new THREE.Clock();
let saveTimer = 0;
let lastFrame = performance.now();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now() / 1000;
  state.elapsed += dt;

  if (state.mode === 'playing') {
    // Day cycle drifts slowly forward; the clock never stops the city.
    state.timeOfDay = (state.timeOfDay + dt * 0.02) % 24;

    // Edge-triggered actions.
    if (input.wasPressed('pause')) {
      state.mode = 'paused';
      showOnly(pauseScreen);
    }
    if (input.wasPressed('music')) {
      const on = audio.toggleMusic();
      state.toast = on ? 'Music on' : 'Music off';
      state.toastUntil = state.elapsed + 1.5;
    }
    if (input.wasPressed('restart') && missions.active) {
      missions.retry(state, audio);
    }
    if (input.wasPressed('enter')) {
      player.tryEnterExit(vehicles, audio, (amt, why) => addHeat(state, amt, why));
    }
    if ((input.mouseClicked || input.wasPressed('shoot')) && !state.inCar) {
      const enemies = missions.active ? missions.active.enemies : [];
      const hit = combat.shoot(state, camera, peds.concat(enemies), vehicles, audio);
      if (hit && hit.type === 'ped' && !hit.target.enemy) addHeat(state, 22, 'assault');
      if (hit && hit.type === 'ped' && hit.target.enemy) addHeat(state, 4, 'shootout');
    }

    // Movement: drive or walk.
    let speedMs = 0;
    if (state.inCar) {
      state.speedKmh = driveVehicle(state.inCar, input, dt, rig.colliders);
      speedMs = state.speedKmh / 3.6;
      state.playerPos.x = state.inCar.x;
      state.playerPos.z = state.inCar.z;
      state.playerHeading = state.inCar.heading;
      // Running over a pedestrian is a crime, and it shows.
      const victim = nearestPed(peds, state.playerPos.x, state.playerPos.z, 2.6);
      if (victim && speedMs > 4) {
        victim.state = 'down';
        victim.mesh.rotation.x = Math.PI / 2;
        victim.mesh.position.y = 0.4;
        addHeat(state, 26, 'hit pedestrian');
        state.toast = 'You hit a pedestrian!';
        state.toastUntil = state.elapsed + 2;
      }
      audio.setEngine(state.speedKmh, true);
    } else {
      speedMs = player.update(dt, input, rig.colliders, vehicles);
      state.speedKmh = 0;
      audio.setEngine(0, false);
    }
    player.updateCamera(camera, dt, input);

    // World systems.
    updateTraffic(vehicles, dt, rig.colliders, state.playerPos, state.wanted);
    updatePedestrians(peds, dt, state.playerPos, combat.gunfirePos, rig.colliders);
    const enemies = missions.active ? missions.active.enemies : [];
    updatePedestrians(enemies, dt, state.playerPos, combat.gunfirePos, rig.colliders);
    combat.enemyFire(dt, state, enemies, audio);
    combat.update(dt, state, state.playerPos, audio);
    police.update(dt, state, state.playerPos, speedMs, rig.colliders, onBusted, audio);
    flashPolice(vehicles.concat(police.cars), now);

    // Mission progression.
    const result = missions.update(dt, state, state.playerPos, scene, audio);
    if (result === 'done' || result === 'failed') saveGame(state);

    // Health: slow regen out of combat, death check.
    if (state.health < 100 && state.wanted === 0) state.health = Math.min(100, state.health + dt * 1.5);
    if (state.health <= 0) onWasted();

    // Autosave every 15 seconds.
    saveTimer += dt;
    if (saveTimer > 15) {
      saveTimer = 0;
      saveGame(state);
    }

    hud.update(state, vehicles.concat(police.cars), peds.concat(enemies), police, missions.markerPos);
  } else if (state.mode === 'menu') {
    // Slow cinematic orbit behind the start screen.
    const t = now * 0.05;
    camera.position.set(Math.sin(t) * 120, 40, Math.cos(t) * 120);
    camera.lookAt(0, 10, 60);
  } else if (state.mode === 'paused') {
    if (input.wasPressed('pause')) {
      state.mode = 'playing';
      showOnly(null);
    }
  }

  updateSky(state, rig);
  audio.updateSiren(dt);
  renderer.render(scene, camera);
  input.endFrame();
  lastFrame = now;
}

frame();
window.__velvetBay = { state, missions, police, player, vehicles };
