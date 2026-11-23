// Velvet Bay — shared game state: districts, seeded RNG, save version.
// Written fresh for round 10 (attempt 5). No code copied from earlier rounds.
export const SAVE_VERSION = 2;
export const SAVE_KEY = 'velvet-bay-save-v2';

// The city spans x in [-320, 320], z in [-320, 320]. East (x > 240) is the
// beach and the sea; the pier reaches out from the Coastal Boulevard.
export const WORLD = { min: -320, max: 320, beachX: 240, seaX: 292, roadStep: 64 };

export const DISTRICTS = [
  { name: 'DOWNTOWN', x0: -130, z0: -130, x1: 130, z1: 30, hue: 'downtown' },
  { name: 'HARBOR', x0: -320, z0: -320, x1: -130, z1: -130, hue: 'harbor' },
  { name: 'RESIDENTIAL', x0: -320, z0: -130, x1: -130, z1: 320, hue: 'residential' },
  { name: 'COASTAL BLVD', x0: 130, z0: -320, x1: 240, z1: 320, hue: 'coastal' },
  { name: 'ENTERTAINMENT', x0: -130, z0: 30, x1: 130, z1: 190, hue: 'entertainment' },
  { name: 'MARINA', x0: 130, z0: 190, x1: 240, z1: 320, hue: 'marina' },
  { name: 'DOCKYARD', x0: -320, z0: -320, x1: 130, z1: -130, hue: 'dockyard' },
  { name: 'OLD TOWN', x0: -130, z0: 190, x1: 130, z1: 320, hue: 'oldtown' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  if (x >= WORLD.beachX) return 'BEACHFRONT';
  return 'VELVET BAY';
}

// Deterministic xorshift RNG so screenshots and replays are reproducible.
export function createRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

export function createState() {
  return {
    screen: 'start', // start | play | paused | busted | wasted
    time: 0, // seconds since boot
    clockMinutes: 17 * 60 + 20, // in-game clock, starts golden hour
    money: 250,
    health: 100,
    armor: 0,
    wanted: 0,
    wantedHeat: 0, // 0..100, drives star changes
    packages: 0,
    packagesFound: [], // indices of collected hidden packages
    missionsDone: [], // mission ids completed
    mission: null, // active mission runtime
    missionId: null,
    respect: 0,
    kills: 0,
    carsStolen: 0,
    shotsFired: 0,
    timeOfDay: 'golden', // golden | noon | night | dusk
    musicOn: true,
    muted: false,
    player: {
      x: 20, z: 60, heading: Math.PI / 2, speed: 0,
      inCar: false, carId: null, onFoot: true,
    },
    cameraZoom: 1,
    dialogue: null, // { name, text, until }
    toast: null,
    stats: { distanceDriven: 0, pedsHit: 0 },
  };
}
