// Velvet Bay — save/load, SAVE_VERSION 2 with v1 backward compatibility.
// Written fresh for round 10 (attempt 5).
import { SAVE_KEY, SAVE_VERSION } from './state.js';

const LEGACY_KEY = 'velvet-bay-save';

export function saveGame(state) {
  try {
    const data = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      money: state.money,
      health: state.health,
      packages: state.packages,
      packagesFound: state.packagesFound,
      missionsDone: state.missionsDone,
      respect: state.respect,
      x: state.player.x,
      z: state.player.z,
      heading: state.player.heading,
      clockMinutes: state.clockMinutes,
      timeOfDay: state.timeOfDay,
      kills: state.kills,
      carsStolen: state.carsStolen,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(state) {
  let raw = null;
  try { raw = window.localStorage.getItem(SAVE_KEY); } catch { raw = null; }
  if (!raw) {
    // v1 migration: legacy key held { money } only.
    try { raw = window.localStorage.getItem(LEGACY_KEY); } catch { raw = null; }
    if (!raw) return false;
    try {
      const old = JSON.parse(raw);
      if (typeof old.money === 'number') state.money = old.money;
      saveGame(state);
      return true;
    } catch { return false; }
  }
  try {
    const data = JSON.parse(raw);
    if (data.version !== SAVE_VERSION) return false;
    state.money = data.money ?? state.money;
    state.health = data.health ?? 100;
    state.packages = data.packages ?? 0;
    state.packagesFound = data.packagesFound ?? [];
    state.missionsDone = data.missionsDone ?? [];
    state.respect = data.respect ?? 0;
    state.player.x = data.x ?? state.player.x;
    state.player.z = data.z ?? state.player.z;
    state.player.heading = data.heading ?? state.player.heading;
    state.clockMinutes = data.clockMinutes ?? state.clockMinutes;
    state.timeOfDay = data.timeOfDay ?? state.timeOfDay;
    state.kills = data.kills ?? 0;
    state.carsStolen = data.carsStolen ?? 0;
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
    window.localStorage.removeItem(LEGACY_KEY);
  } catch { /* storage unavailable */ }
}
