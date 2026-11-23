// Velvet Bay — HUD: mission panel, money/clock/district, wanted stars,
// health/armor, weapon slots, crew chips, package counter, Bay PD panel,
// dialogue box, toasts, and a street-shape minimap.
// Written fresh for round 10 (attempt 5).
import { WEAPONS } from './combat.js';
import { ROAD_LINES, districtAt } from './state.js';

function el(id) { return document.getElementById(id); }

export function createHud(state, getCtx) {
  const mm = el('minimap');
  const mctx = mm.getContext('2d');
  let dialogueUntil = 0;
  let toastUntil = 0;

  function fmtClock() {
    const m = Math.floor(state.clockMinutes % 1440);
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm2 = String(m % 60).padStart(2, '0');
    return `${hh}:${mm2}`;
  }

  function say(name, text) {
    const box = el('dialogue');
    el('dlgName').textContent = name;
    el('dlgText').textContent = text;
    box.classList.add('on');
    dialogueUntil = state.time + 5;
  }

  function toast(text) {
    const t = el('toast');
    t.textContent = text;
    t.style.opacity = '1';
    toastUntil = state.time + 3.2;
  }

  function update() {
    const ctx = getCtx();
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '<span class="dim">★</span>';
    el('wanted').innerHTML = stars;
    // Money / clock / district / packages.
    el('money').textContent = state.money.toLocaleString();
    el('clock').textContent = fmtClock();
    el('district').textContent = districtAt(state.player.x, state.player.z);
    el('pkgcount').textContent = `${state.packages}/12`;
    el('healthfill').style.width = `${Math.max(0, state.health)}%`;
    el('armorfill').style.width = `${Math.max(0, state.armor)}%`;
    // Objective.
    const mission = ctx.missionRt;
    const objEl = el('objtext');
    if (mission) {
      const s = mission.stage();
      const timer = s?.type === 'timed' ? ` — ${Math.max(0, Math.ceil(mission.timer))}s` : '';
      objEl.textContent = `${mission.def.title}: ${s?.text ?? ''}${timer}`;
      el('objtitle').textContent = mission.def.title;
      el('objgiver').textContent = `${mission.def.giver} · $${mission.def.pay.toLocaleString()}`;
    } else {
      const next = ctx.nextMission;
      el('objtitle').textContent = 'VELVET BAY';
      el('objgiver').textContent = next ? `Next job: ${next.title} — ${next.giver}` : 'All jobs complete — free roam';
      objEl.textContent = next
        ? 'Drive to the gold marker at Delia\u2019s office and press E to start the job.'
        : 'Free roam — grab packages, steal cars, own the bay.';
    }
    // Weapon slots.
    const slotsEl = el('slots');
    slotsEl.innerHTML = WEAPONS.map((w, i) => {
      const active = i === ctx.combat.slot ? ' active' : '';
      const ammo = w.ammo === Infinity ? '∞' : w.ammo;
      return `<span class="slot${active}">${i + 1} ${w.name} · ${ammo}</span>`;
    }).join('');
    // Speed + vehicle.
    const sp = el('speed');
    if (state.player.inCar) {
      const kmh = Math.round(state.player.speed * 3.6);
      sp.innerHTML = `${kmh}<small> km/h</small><div class="veh">${ctx.playerCar?.name ?? 'Ride'}</div>`;
    } else {
      sp.innerHTML = `<small>ON FOOT</small>`;
    }
    // Bay PD response panel.
    const pd = el('pd');
    const units = ctx.police?.unitCount?.() ?? 0;
    if (state.wanted > 0) {
      pd.classList.add('on');
      el('pdunits').textContent = units > 0
        ? `${units} unit${units > 1 ? 's' : ''} responding${state.wanted >= 3 ? ' · CONDOR-1 overhead' : ''}${state.wanted >= 4 ? ' · ROADBLOCKS AHEAD' : ''}`
        : 'Bay PD is searching…';
    } else {
      pd.classList.remove('on');
    }
    // Crew chips.
    el('crew').innerHTML = [
      `<span class="chip">RIO · DRIVER</span>`,
      `<span class="chip">DELIA · FIXER</span>`,
      `<span class="chip">MARTA · QUIET CARGO</span>`,
      state.missionsDone.length ? `<span class="chip gold">${state.missionsDone.length}/8 JOBS DONE</span>` : '',
    ].join('');
    // Hint line.
    const hint = el('hint');
    if (!state.player.inCar) {
      hint.textContent = 'WASD move · SHIFT run · E steal car · CLICK / F shoot · wheel zoom · P pause';
    } else {
      hint.textContent = 'WASD drive · SPACE handbrake · E exit car · CLICK / F shoot · wheel zoom · P pause';
    }
    // Dialogue / toast expiry.
    if (state.time > dialogueUntil) el('dialogue').classList.remove('on');
    if (state.time > toastUntil) el('toast').style.opacity = '0';
    drawMinimap(ctx);
  }

  function drawMinimap(ctx) {
    const W = mm.width, H = mm.height;
    const scale = W / 680;
    const toX = (x) => (x + 340) * scale;
    const toY = (z) => (z + 340) * scale;
    mctx.clearRect(0, 0, W, H);
    // Water + beach.
    mctx.fillStyle = '#0e3a52';
    mctx.fillRect(toX(292), 0, W - toX(292), H);
    mctx.fillStyle = '#c9a86e';
    mctx.fillRect(toX(240), 0, toX(292) - toX(240), H);
    // Blocks (city base).
    mctx.fillStyle = '#1c2436';
    mctx.fillRect(0, 0, toX(240), H);
    // Streets as real lines.
    mctx.strokeStyle = '#5a6478';
    mctx.lineWidth = 3;
    for (const v of ROAD_LINES) {
      mctx.beginPath(); mctx.moveTo(toX(v), 0); mctx.lineTo(toX(v), H); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, toY(v)); mctx.lineTo(toX(240), toY(v)); mctx.stroke();
    }
    // Pier.
    mctx.strokeStyle = '#8a6a44';
    mctx.lineWidth = 4;
    mctx.beginPath(); mctx.moveTo(toX(240), toY(60)); mctx.lineTo(toX(304), toY(60)); mctx.stroke();
    // Packages.
    mctx.fillStyle = '#ffd23e';
    for (const pkg of ctx.cityPackages) {
      if (!pkg.visible) continue;
      mctx.beginPath();
      mctx.arc(toX(pkg.position.x), toY(pkg.position.z), 2.5, 0, 7);
      mctx.fill();
    }
    // Mission target / beacon.
    const mission = ctx.missionRt;
    if (mission) {
      const t = mission.target();
      if (t) {
        mctx.fillStyle = '#ffd23e';
        mctx.beginPath();
        mctx.arc(toX(t.x), toY(t.z), 5, 0, 7);
        mctx.fill();
        mctx.strokeStyle = '#ffd23e';
        mctx.lineWidth = 1.5;
        mctx.beginPath();
        mctx.arc(toX(t.x), toY(t.z), 8, 0, 7);
        mctx.stroke();
      }
    } else if (ctx.nextMission) {
      mctx.fillStyle = '#ffd23e';
      mctx.beginPath();
      mctx.arc(toX(-32), toY(-32), 5, 0, 7);
      mctx.fill();
    }
    // Police diamonds.
    mctx.fillStyle = '#4a90ff';
    for (const c of ctx.policeCruisers ?? []) {
      mctx.save();
      mctx.translate(toX(c.x), toY(c.z));
      mctx.rotate(Math.PI / 4);
      mctx.fillRect(-3, -3, 6, 6);
      mctx.restore();
    }
    // Player arrow.
    const p = state.player;
    mctx.save();
    mctx.translate(toX(p.x), toY(p.z));
    mctx.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)) + Math.PI);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
    mctx.fill();
    mctx.restore();
    // North marker.
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 11px sans-serif';
    mctx.fillText('N', W - 14, 14);
  }

  return { update, say, toast };
}
