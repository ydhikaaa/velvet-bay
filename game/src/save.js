// Save / load for Velvet Bay: one small JSON blob in localStorage.
// Autosaves on mission completion, bust, death and every 15 seconds of play.

const KEY = 'velvet-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      health: state.health,
      ammo: state.ammo,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      kills: state.kills,
      carsStolen: state.carsStolen,
      timeOfDay: state.timeOfDay,
      playerPos: state.playerPos,
      playerHeading: state.playerHeading,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function applySave(state, data) {
  state.money = data.money;
  state.health = data.health ?? 100;
  state.ammo = data.ammo ?? 60;
  state.missionIndex = data.missionIndex ?? 0;
  state.missionsDone = data.missionsDone ?? 0;
  state.kills = data.kills ?? 0;
  state.carsStolen = data.carsStolen ?? 0;
  state.timeOfDay = data.timeOfDay ?? 10.5;
  if (data.playerPos) state.playerPos = data.playerPos;
  state.playerHeading = data.playerHeading ?? 0;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* storage unavailable */ }
}
