// Velvet Bay — 8 story missions on a generic stage engine.
// Stage types: goto, timed (goto with a clock), kill (defeat gang at a spot),
// escort (follow the slow courier van), losewanted (stage ends when heat is 0).
// Written fresh for round 10 (attempt 5).
import { buildCar } from './models.js';

export const MISSIONS = [
  {
    id: 'm1', title: 'FIRST WHEELS', giver: 'Delia Voss', pay: 800,
    brief: 'Rio, you need wheels before you need work. Get in a car, any car, then bring it to my office.',
    stages: [
      { type: 'goto', x: 28, z: 32, r: 6, text: 'Get in a car — press E near any ride', needCar: true },
      { type: 'goto', x: -32, z: -32, r: 8, text: 'Drive to Delia\u2019s office, Downtown' },
    ],
  },
  {
    id: 'm2', title: 'HARBOR LIGHTS', giver: 'Delia Voss', pay: 4500,
    brief: 'A package is waiting on the pier. Grab it, then run it across the city before the clock dies. Lose the heat, then vanish into the hideout.',
    stages: [
      { type: 'goto', x: 296, z: 32, r: 7, text: 'Pick up the package at the end of the pier' },
      { type: 'timed', x: -224, z: 192, r: 10, time: 120, text: 'Cross-city run — reach the hideout in 2:00' },
      { type: 'losewanted', text: 'Lose the heat — stay out of sight until the stars clear' },
      { type: 'goto', x: -224, z: 192, r: 10, text: 'Slip into the hideout' },
    ],
  },
  {
    id: 'm3', title: 'PIER PRESSURE', giver: 'Delia Voss', pay: 2200,
    brief: 'Red Tide is leaning on the pier crew. Show them the door — then report back to me.',
    stages: [
      { type: 'goto', x: 296, z: 32, r: 7, text: 'Meet the pier crew' },
      { type: 'kill', x: -192, z: -192, r: 18, count: 4, text: 'Clear the Red Tide crew at the dockyard (4)' },
      { type: 'goto', x: -32, z: -32, r: 8, text: 'Report back to Delia' },
    ],
  },
  {
    id: 'm4', title: 'BAYFRONT DASH', giver: 'Marta Quill', pay: 1800,
    brief: 'Three drops, one clock, no excuses. Hit every checkpoint and the money is yours.',
    stages: [
      { type: 'timed', x: 192, z: -192, r: 9, time: 60, text: 'Checkpoint 1/3 — Coastal north (1:00)' },
      { type: 'timed', x: 224, z: 192, r: 9, time: 60, text: 'Checkpoint 2/3 — Marina (1:00)' },
      { type: 'timed', x: -192, z: 192, r: 9, time: 60, text: 'Checkpoint 3/3 — Residential west (1:00)' },
    ],
  },
  {
    id: 'm5', title: 'QUIET CARGO', giver: 'Marta Quill', pay: 6000,
    brief: 'This one is quiet. Escort the courier van across town. If the Bay PD so much as looks at you, the deal is dead.',
    stealth: true,
    stages: [
      { type: 'goto', x: -32, z: 224, r: 8, text: 'Meet the courier van in Old Town' },
      { type: 'escort', toX: 192, toZ: 224, text: 'Escort the van to the Marina — stay close, stay clean' },
    ],
  },
  {
    id: 'm6', title: 'RED TIDE TAKEDOWN', giver: 'Delia Voss', pay: 3500,
    brief: 'The gang thinks the dockyard is theirs. Take it back, then bring me proof.',
    stages: [
      { type: 'kill', x: -192, z: -192, r: 20, count: 6, text: 'Take the dockyard — defeat the Red Tide (6)' },
      { type: 'goto', x: -32, z: -32, r: 8, text: 'Bring word back to Delia' },
    ],
  },
  {
    id: 'm7', title: 'NEON NIGHTS', giver: 'Marta Quill', pay: 2800,
    brief: 'Night run through the Entertainment district. Pick up the goods, drop them on the coast. The city looks better at night — enjoy it.',
    night: true,
    stages: [
      { type: 'goto', x: 0, z: 96, r: 8, text: 'Pick up the goods in the Entertainment district' },
      { type: 'timed', x: 224, z: 0, r: 9, time: 75, text: 'Deliver to Coastal Boulevard (1:15)' },
    ],
  },
  {
    id: 'm8', title: 'THE VELVET RUN', giver: 'Delia Voss', pay: 12000,
    brief: 'The big one. Hit the vault, hold the dockyard crew off, then run the whole city with the heat on your tail. Pull this off and you own the bay.',
    stages: [
      { type: 'goto', x: 32, z: -64, r: 8, text: 'Reach the vault, Downtown' },
      { type: 'kill', x: 32, z: -64, r: 18, count: 5, text: 'Hold off the Red Tide guards (5)' },
      { type: 'timed', x: 296, z: 32, r: 9, time: 100, text: 'Run the score to the pier (1:40)' },
      { type: 'losewanted', text: 'Lose the heat' },
      { type: 'goto', x: -224, z: 192, r: 10, text: 'Vanish into the hideout' },
    ],
  },
];

export function nextMissionId(doneIds) {
  for (const m of MISSIONS) if (!doneIds.includes(m.id)) return m.id;
  return null;
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || null;
}

// Runtime for one active mission. ctx: { state, city, vehicles, pedestrians,
// police, combat, audio, say(name, text), toast(text) }
export function createMissionRuntime(def, ctx) {
  const rt = {
    def, stageIndex: 0, timer: 0, enemies: [], van: null, vanPath: [],
    vanTarget: 0, startedAt: ctx.state.time,
    stage() { return def.stages[rt.stageIndex]; },
    target() {
      const s = rt.stage();
      if (!s) return null;
      if (s.type === 'escort' && rt.van) return { x: rt.van.position.x, z: rt.van.position.z };
      return { x: s.x, z: s.z };
    },
  };
  enterStage(rt, ctx);
  return rt;
}

function enterStage(rt, ctx) {
  const s = rt.stage();
  if (!s) return;
  if (s.type === 'timed') rt.timer = s.time;
  if (s.type === 'kill') {
    rt.enemies = ctx.pedestrians.spawnGang(s.x, s.z, s.count);
    ctx.say('DELIA', `Red Tide at ${s.x < 0 ? 'the dockyard' : 'the vault'} — ${s.count} of them. Drop them all.`);
  }
  if (s.type === 'escort') {
    const van = buildCar(0xe8e2d0, {});
    van.position.set(-32, 0, 224);
    van.rotation.y = Math.PI / 2;
    ctx.scene.add(van);
    rt.van = van;
    rt.vanPath = [
      { x: 0, z: 224 }, { x: 64, z: 224 }, { x: 128, z: 224 },
      { x: 192, z: 224 }, { x: 192, z: 224 },
    ];
    rt.vanTarget = 0;
    rt.vanSpeed = 8;
    ctx.say('MARTA', 'Van is rolling. Stay within sight and keep your nose clean — any star and we are done.');
  }
  if (s.type === 'losewanted' && ctx.state.wanted === 0) {
    // Already clean: skip ahead immediately.
    advance(rt, ctx);
    return;
  }
  ctx.city.setBeacon(s.x ?? rt.van?.position.x ?? ctx.state.player.x, s.z ?? rt.van?.position.z ?? ctx.state.player.z, s.type !== 'losewanted');
  if (s.type === 'losewanted') ctx.city.setBeacon(0, 0, false);
  ctx.say(s.type === 'goto' || s.type === 'timed' ? rt.def.giver.toUpperCase() : 'VELVET BAY', s.text);
}

function advance(rt, ctx) {
  rt.stageIndex++;
  if (rt.stageIndex >= rt.def.stages.length) {
    finish(rt, ctx, true);
    return 'done';
  }
  enterStage(rt, ctx);
  return 'stage';
}

function finish(rt, ctx, success) {
  if (rt.van) { ctx.scene.remove(rt.van); rt.van = null; }
  if (rt.enemies.length) ctx.pedestrians.removeGang(rt.enemies);
  rt.enemies = [];
  ctx.city.setBeacon(0, 0, false);
  if (success) {
    ctx.state.money += rt.def.pay;
    ctx.state.respect += 10;
    ctx.state.missionsDone.push(rt.def.id);
    ctx.audio?.jingle?.();
    ctx.toast(`${rt.def.title} COMPLETE — $${rt.def.pay.toLocaleString()}`);
    ctx.say(rt.def.giver.toUpperCase(), rt.def.id === 'm8'
      ? 'That was the run of the year, Rio. The bay is yours.'
      : 'Clean work, Rio. The money is in your pocket.');
  }
  ctx.state.mission = null;
  ctx.state.missionId = null;
  return success ? 'done' : 'failed';
}

export function updateMission(rt, dt, ctx) {
  const s = rt.stage();
  if (!s) return null;
  const p = ctx.state.player;

  // Stealth fail: any wanted star kills a stealth mission.
  if (rt.def.stealth && ctx.state.wanted > 0) {
    ctx.say('MARTA', 'The cops saw us. Deal is dead — get out of there.');
    finish(rt, ctx, false);
    return 'failed';
  }
  // Night mission sets dusk lighting on entry.
  if (rt.def.night && ctx.state.timeOfDay !== 'dusk') {
    ctx.city.applyTimeOfDay('dusk');
    ctx.state.timeOfDay = 'dusk';
  }

  if (s.type === 'goto' || s.type === 'timed') {
    if (s.type === 'timed') {
      rt.timer -= dt;
      if (rt.timer <= 0) {
        ctx.say(rt.def.giver.toUpperCase(), 'Too slow. The window closed.');
        finish(rt, ctx, false);
        return 'failed';
      }
    }
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    if (s.needCar && !p.inCar) return null;
    if (d < s.r) {
      ctx.audio?.chirp?.();
      return advance(rt, ctx);
    }
    return null;
  }
  if (s.type === 'kill') {
    rt.enemies = rt.enemies.filter((e) => e.alive);
    if (rt.enemies.length === 0) return advance(rt, ctx);
    return null;
  }
  if (s.type === 'losewanted') {
    if (ctx.state.wanted === 0) return advance(rt, ctx);
    return null;
  }
  if (s.type === 'escort') {
    const van = rt.van;
    if (!van) return 'failed';
    const wp = rt.vanPath[rt.vanTarget];
    if (!wp) return advance(rt, ctx);
    const dx = wp.x - van.position.x, dz = wp.z - van.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) {
      rt.vanTarget++;
      if (rt.vanTarget >= rt.vanPath.length) return advance(rt, ctx);
    } else {
      const h = Math.atan2(dx / d, dz / d);
      van.rotation.y = h - Math.PI / 2;
      van.position.x += (dx / d) * rt.vanSpeed * dt;
      van.position.z += (dz / d) * rt.vanSpeed * dt;
      const spin = rt.vanSpeed * dt * 2.4;
      for (const w of van.userData.wheels) w.rotation.z += spin;
    }
    const pd = Math.hypot(p.x - van.position.x, p.z - van.position.z);
    if (pd > 55) ctx.say('MARTA', 'You are falling behind the van — catch up!');
    ctx.city.setBeacon(van.position.x, van.position.z, true);
    return null;
  }
  return null;
}
