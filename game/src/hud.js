// HUD + minimap for Velvet Bay: money, health, wanted stars, objective,
// speed, toasts, and a live top-down map drawn on a 2D canvas.

import { CITY, ROAD_LINES } from './state.js';

export class HUD {
  constructor(state) {
    this.state = state;
    this.el = {
      hud: document.getElementById('hud'),
      wanted: document.getElementById('wanted'),
      money: document.getElementById('money'),
      ammo: document.getElementById('ammo'),
      healthfill: document.getElementById('healthfill'),
      objective: document.getElementById('objective'),
      objtext: document.getElementById('objtext'),
      speed: document.getElementById('speed'),
      hint: document.getElementById('hint'),
      crosshair: document.getElementById('crosshair'),
      toast: document.getElementById('toast'),
      damage: document.getElementById('damage'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
  }

  show() { this.el.hud.classList.add('on'); }
  hide() { this.el.hud.classList.remove('on'); }

  update(state, vehicles, peds, police, markerPos) {
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i++) {
      stars += i < state.wanted
        ? '<span>★</span>'
        : '<span class="dim">★</span>';
    }
    this.el.wanted.innerHTML = stars;
    this.el.money.textContent = state.money.toLocaleString('en-US');
    this.el.ammo.textContent = state.inCar ? '' : `Ammo ${state.ammo}`;
    this.el.healthfill.style.width = `${state.health}%`;
    const title = this.el.objective.querySelector('.title');
    if (title) title.textContent = state.objectiveTitle;
    this.el.objtext.textContent = state.objectiveText;
    this.el.speed.innerHTML = state.inCar
      ? `${Math.round(state.speedKmh)}<small> km/h — ${state.inCar.name}</small>`
      : '';
    this.el.hint.textContent = state.inCar
      ? 'W/S drive · A/D steer · SPACE handbrake · E exit car · CLICK shoot'
      : 'WASD move · SHIFT run · E steal car · CLICK / F shoot · P pause';
    this.el.crosshair.style.display = state.inCar ? 'none' : 'block';
    const showToast = state.elapsed < state.toastUntil && state.toast;
    this.el.toast.style.opacity = showToast ? 1 : 0;
    if (showToast) this.el.toast.textContent = state.toast;
    this.el.damage.style.display = state.health < 35 ? 'block' : 'none';
    this.drawMinimap(state, vehicles, peds, police, markerPos);
  }

  drawMinimap(state, vehicles, peds, police, markerPos) {
    const ctx = this.mapCtx;
    const S = 190;
    const scale = S / (CITY.half * 2 + 60);
    const toMap = (x, z) => [(x + CITY.half + 30) * scale, (z + CITY.half + 30) * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0e1a2e';
    ctx.fillRect(0, 0, S, S);
    // Water + sand on the south edge.
    const [, wy] = toMap(0, CITY.beachZ);
    ctx.fillStyle = '#1e6f9e';
    ctx.fillRect(0, wy, S, S - wy);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(0, wy - 8, S, 8);
    // Roads.
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = 4;
    for (const r of ROAD_LINES) {
      const [x1] = toMap(r, 0);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      const [, z1] = toMap(0, r);
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    // Mission marker.
    if (markerPos) {
      const [mx, my] = toMap(markerPos.x, markerPos.z);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx, my, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic (white dots) and police (blue/red dots).
    for (const v of vehicles) {
      if (v.wrecked) continue;
      const [vx, vy] = toMap(v.x, v.z);
      ctx.fillStyle = v.police ? '#3b82f6' : '#dfe6ee';
      ctx.fillRect(vx - 2, vy - 2, 4, 4);
    }
    for (const p of peds) {
      if (p.state === 'down') continue;
      const [px, py] = toMap(p.x, p.z);
      ctx.fillStyle = p.enemy ? '#ff2222' : '#9fb3c8';
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
    // Player arrow, rotated by heading.
    const [px, py] = toMap(state.playerPos.x, state.playerPos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.playerHeading);
    ctx.fillStyle = '#7dff9b';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('N', 6, 14);
  }
}
