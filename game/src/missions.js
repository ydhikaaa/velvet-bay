// Missions + story for Velvet Bay: three jobs from fixer Delia Voss, each with
// stages, a map marker, a timer where it matters, and a cash reward.

import { spawnEnemies } from './pedestrians.js';
import { addHeat } from './police.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'MISSION 1 — FIRST WHEELS',
    intro: 'Delia: "Rio, I need wheels. Steal any car on the street, then bring it to my garage on Coral Row."',
    reward: 500,
    stages: [
      { text: 'Steal a car — walk up to one and press E.', check: (s) => !!s.inCar },
      { text: 'Drive to Delia\'s garage (yellow marker).', marker: { x: 60, z: 120 } },
    ],
  },
  {
    id: 'sunset-delivery',
    title: 'MISSION 2 — SUNSET DELIVERY',
    intro: 'Delia: "A package for the pier, no questions. You have 150 seconds. Lose the cops if they spot you."',
    reward: 1200,
    timeLimit: 150,
    stages: [
      { text: 'Get in a car and drive to the pier (yellow marker).', marker: { x: 60, z: 290 } },
    ],
  },
  {
    id: 'dockyard-showdown',
    title: 'MISSION 3 — DOCKYARD SHOWDOWN',
    intro: 'Delia: "The Red Tide gang took my shipment at the dockyard. Take it back. All five of them."',
    reward: 3000,
    stages: [
      { text: 'Go to the dockyard (yellow marker).', marker: { x: -250, z: 240 } },
      { text: 'Take down all 5 Red Tide gang members.', killsNeeded: 5 },
      { text: 'Escape to the safe house (yellow marker).', marker: { x: -60, z: -60 } },
    ],
  },
];

export class MissionManager {
  constructor(scene) {
    this.scene = scene;
    this.active = null;      // { def, stage, timeLeft, enemies }
    this.markerMesh = null;
    this.beacon = null;
  }

  start(state, index, audio) {
    const def = MISSIONS[index];
    if (!def) return false;
    this.clearMarker();
    this.active = { def, stage: 0, timeLeft: def.timeLimit || 0, enemies: [] };
    state.missionIndex = index;
    state.missionKills = 0;
    state.objectiveTitle = def.title;
    state.objectiveText = def.intro;
    state.toast = def.title;
    state.toastUntil = state.elapsed + 4;
    this.setMarkerForStage(state);
    if (audio) audio.missionDone();
    return true;
  }

  // Spawn the dockyard gang for the combat stage (used by staged screenshots).
  spawnStageEnemies(state) {
    const stage = this.active.def.stages[this.active.stage];
    const marker = stage.marker || { x: -250, z: 240 };
    const enemies = spawnEnemies(this.scene, marker.x, marker.z, 5);
    addHeat(state, 20, 'dockyard');
    return enemies;
  }

  setMarkerForStage(state) {
    this.clearMarker();
    const stage = this.active.def.stages[this.active.stage];
    if (!stage || !stage.marker) {
      state.objectiveText = stage ? stage.text : 'Free roam';
      return;
    }
    state.objectiveText = stage.text;
    const m = stage.marker;
    const geo = new THREE.CylinderGeometry(3, 3, 40, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(m.x, 20, m.z);
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(m.x, 0.1, m.z);
    this.scene.add(ring);
    this.markerMesh = ring;
    this.markerPos = m;
  }

  clearMarker() {
    if (this.beacon) { this.scene.remove(this.beacon); this.beacon = null; }
    if (this.markerMesh) { this.scene.remove(this.markerMesh); this.markerMesh = null; }
    this.markerPos = null;
  }

  // Called every frame; returns 'done' | 'failed' | null.
  update(dt, state, playerPos, scene, audio) {
    if (!this.active) return null;
    const a = this.active;
    const stage = a.def.stages[a.stage];
    if (this.beacon) this.beacon.rotation.y += dt;
    if (a.def.timeLimit) {
      a.timeLeft -= dt;
      state.objectiveText = `${stage.text}  —  ${Math.max(0, Math.ceil(a.timeLeft))}s left`;
      if (a.timeLeft <= 0) return this.fail(state, 'Out of time.');
    }
    if (stage.check && stage.check(state)) return this.nextStage(state, audio);
    if (stage.killsNeeded) {
      state.objectiveText = `${stage.text}  —  ${state.missionKills || 0}/${stage.killsNeeded} down`;
      if ((state.missionKills || 0) >= stage.killsNeeded) return this.nextStage(state, audio);
    }
    if (stage.marker) {
      const d = Math.hypot(playerPos.x - stage.marker.x, playerPos.z - stage.marker.z);
      if (d < 6) {
        if (a.stage === 0 && a.def.id === 'dockyard-showdown' && a.enemies.length === 0) {
          a.enemies = spawnEnemies(scene, stage.marker.x, stage.marker.z, 5);
          addHeat(state, 20, 'dockyard');
          return this.nextStage(state, audio);
        }
        return this.nextStage(state, audio);
      }
    }
    return null;
  }

  nextStage(state, audio) {
    const a = this.active;
    a.stage += 1;
    if (a.stage >= a.def.stages.length) return this.complete(state, audio);
    this.setMarkerForStage(state);
    if (audio) audio.pickup();
    return null;
  }

  complete(state, audio) {
    const def = this.active.def;
    state.money += def.reward;
    state.missionsDone += 1;
    state.missionIndex += 1;
    state.toast = `MISSION COMPLETE — +$${def.reward}`;
    state.toastUntil = state.elapsed + 4;
    state.objectiveTitle = 'VELVET BAY';
    state.objectiveText = 'Free roam — the next job will come when you are ready.';
    this.clearMarker();
    this.active = null;
    state.missionKills = 0;
    if (audio) audio.missionDone();
    // Offer the next job after a short breather.
    setTimeout(() => {
      if (!this.active && state.mode === 'playing' && state.missionIndex < MISSIONS.length) {
        this.start(state, state.missionIndex, audio);
      }
    }, 6000);
    return 'done';
  }

  fail(state, reason) {
    state.toast = `MISSION FAILED — ${reason}`;
    state.toastUntil = state.elapsed + 4;
    state.objectiveTitle = 'VELVET BAY';
    state.objectiveText = 'Free roam — press R to retry the job.';
    this.clearMarker();
    this.active = null;
    return 'failed';
  }

  retry(state, audio) {
    const idx = Math.min(state.missionIndex, MISSIONS.length - 1);
    return this.start(state, idx, audio);
  }
}
