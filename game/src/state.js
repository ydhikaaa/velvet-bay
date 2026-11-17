// Velvet Bay shared state: city constants, seeded random, and the game state object.
// Every subsystem reads and writes this one object, so the main loop stays thin.

export const CITY = {
  half: 300,            // city extends -300..300 on x and z
  roadGap: 60,          // distance between parallel roads
  roadWidth: 12,
  beachZ: 268,          // south of this line: sand, then water
  waterZ: 300,
  blockInset: 9,        // buildings stay this far inside a block
};

export const ROAD_LINES = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

// Deterministic random so the city looks the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }

// Nearest road line to a coordinate (used by traffic + minimap + spawning).
export function nearestRoad(v) {
  let best = ROAD_LINES[0];
  for (const r of ROAD_LINES) if (Math.abs(v - r) < Math.abs(v - best)) best = r;
  return best;
}

export function createState() {
  return {
    mode: 'menu',           // menu | playing | paused | busted | wasted
    money: 0,
    health: 100,
    ammo: 60,
    wanted: 0,              // 0..5 stars
    wantedHeat: 0,          // continuous heat that feeds the star level
    timeOfDay: 10.5,        // hours, 0..24
    missionIndex: 0,        // next mission to play
    missionsDone: 0,
    kills: 0,
    carsStolen: 0,
    deaths: 0,
    busts: 0,
    speedKmh: 0,
    inCar: null,            // vehicle object the player drives, or null
    playerPos: { x: 0, z: 30 },
    playerHeading: 0,
    cameraYaw: 0,
    cameraPitch: 0.32,
    shotMode: null,         // set from ?shot= for staged screenshots
    muted: false,
    mission: null,          // active mission runtime object
    objectiveText: 'Free roam — steal a car, explore Velvet Bay.',
    objectiveTitle: 'VELVET BAY',
    toast: '',
    toastUntil: 0,
    elapsed: 0,
  };
}
