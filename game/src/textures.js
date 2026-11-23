// Velvet Bay — procedural canvas textures. Every visible surface gets real
// texture detail (noise, wear, window grids, signage) so no flat color fields
// appear on screen. Written fresh for round 10 (attempt 5).
const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function speckle(ctx, w, h, n, colors, sizeMax) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.globalAlpha = 0.08 + Math.random() * 0.22;
    const s = 1 + Math.random() * sizeMax;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Facade: base tone + floor bands + window grid with a varied lit ratio +
// ground-floor storefront strip + signage band. One texture per variant.
export function facadeTexture(variant, litRatio) {
  const key = `facade-${variant}-${litRatio}`;
  if (cache.has(key)) return cache.get(key);
  const palettes = [
    ['#8a6f5c', '#6e5847', '#a5856d'], // warm brick
    ['#5f6b7a', '#4a5563', '#7b8aa0'], // blue-grey glass tower
    ['#7d7468', '#655d52', '#97897a'], // sandstone
    ['#4e5a68', '#3d4753', '#67778a'], // slate
    ['#96684f', '#7a523c', '#b08263'], // terracotta
    ['#6b5f7d', '#554a63', '#877a9c'], // dusk violet
    ['#5c6e58', '#49573f', '#74876e'], // sage
    ['#8c7a5e', '#72614b', '#a8936f'], // ochre
  ];
  const [base, dark, light] = palettes[variant % palettes.length];
  const [c, ctx] = canvas(256, 512);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 512);
  // subtle vertical tonal bands so faces are never one flat field
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = Math.random() < 0.5 ? dark : light;
    ctx.globalAlpha = 0.10; ctx.fillRect(x, 0, 32, 512);
  }
  ctx.globalAlpha = 1;
  // floor slabs
  const floors = 8;
  for (let f = 0; f < floors; f++) {
    const y = 28 + f * 56;
    ctx.fillStyle = dark; ctx.globalAlpha = 0.55;
    ctx.fillRect(0, y + 52, 256, 4);
    ctx.globalAlpha = 1;
    // windows across the floor
    for (let wx = 14; wx < 240; wx += 36) {
      const lit = Math.random() < litRatio;
      if (lit) {
        ctx.fillStyle = ['#ffd98a', '#ffe9b0', '#ffb46b'][Math.floor(Math.random() * 3)];
      } else {
        ctx.fillStyle = Math.random() < 0.5 ? '#20242e' : '#2e3a4a';
      }
      ctx.fillRect(wx, y, 24, 34);
      // window frame + mullion
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(wx, y + 16, 24, 2);
      ctx.fillRect(wx + 11, y, 2, 34);
    }
  }
  // ground-floor storefront: awning stripes + glass + sign band
  ctx.fillStyle = '#23202a'; ctx.fillRect(0, 472, 256, 40);
  const awn = ['#c94f4f', '#3f7d6b', '#d9a441', '#4a6fa5', '#7a4a8c'][variant % 5];
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = (x / 32) % 2 === 0 ? awn : '#f2ead8';
    ctx.fillRect(x, 452, 32, 20);
  }
  ctx.fillStyle = '#1d2733'; ctx.fillRect(8, 482, 240, 22);
  ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(['VELVET', 'BAY MART', 'NEON', 'PIER 9', 'HOTEL', 'CAFÉ', 'TACOS', '24H'][variant % 8], 128, 498);
  speckle(ctx, 256, 512, 500, ['#000000', '#ffffff'], 3);
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Asphalt: dark base, aggregate noise, lane wear streaks, center dashes.
export function asphaltTexture() {
  const key = 'asphalt';
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#33343a'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 2600, ['#1c1d22', '#4a4b52', '#5c5d66', '#2a2b31'], 3);
  // wear streaks along driving direction
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.05 + Math.random() * 0.08;
    const x = Math.random() * 256;
    ctx.fillRect(x, 0, 3 + Math.random() * 8, 256);
  }
  ctx.globalAlpha = 1;
  // center dashed line (drawn along v)
  ctx.fillStyle = '#d8c25a';
  for (let y = 0; y < 256; y += 42) ctx.fillRect(125, y, 6, 24);
  // edge lines
  ctx.fillStyle = 'rgba(230,230,230,0.75)';
  ctx.fillRect(8, 0, 3, 256); ctx.fillRect(245, 0, 3, 256);
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Sidewalk: warm concrete pavers with joints and stains.
export function sidewalkTexture() {
  const key = 'sidewalk';
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#9a938a'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 1600, ['#7e776e', '#b0a89d', '#8a8378'], 3);
  ctx.strokeStyle = 'rgba(60,55,48,0.6)'; ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Grass: tonally varied green with blades / patches, never one flat color.
export function grassTexture() {
  const key = 'grass';
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#4d7a3a'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 3200, ['#3a5c2b', '#5f9448', '#6fae52', '#2f4d24', '#86b364'], 3);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(120,160,80,0.25)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 20, 5 + Math.random() * 10, Math.random() * 3, 0, 7);
    ctx.fill();
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Sand: pale beach with speckles and faint ripple bands.
export function sandTexture() {
  const key = 'sand';
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#d9c08d'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 2200, ['#c4a76e', '#ecd3a0', '#b89a62', '#f2e2b2'], 3);
  ctx.strokeStyle = 'rgba(180,150,95,0.35)'; ctx.lineWidth = 2;
  for (let y = 20; y < 256; y += 34) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.08) * 4);
    ctx.stroke();
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Water: deep teal with lighter wave streaks.
export function waterTexture() {
  const key = 'water';
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#14506b'; ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 1200, ['#0d3a4f', '#1f6a8a', '#2f88a8'], 4);
  ctx.strokeStyle = 'rgba(160,220,240,0.28)'; ctx.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const y = Math.random() * 256;
    ctx.beginPath(); ctx.moveTo(Math.random() * 100, y);
    ctx.lineTo(120 + Math.random() * 136, y + (Math.random() * 8 - 4)); ctx.stroke();
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Crosswalk: white zebra stripes on transparent backing (drawn on a plane).
export function crosswalkTexture() {
  const key = 'crosswalk';
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(240,240,235,0.92)';
  for (let x = 6; x < 128; x += 22) ctx.fillRect(x, 6, 12, 116);
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Soft radial glow sprite (lamps, headlights, sun, clouds).
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const key = `glow-${inner}`;
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = tex(c);
  cache.set(key, t);
  return t;
}

// Cloud puff sprite.
export function cloudTexture() {
  const key = 'cloud';
  if (cache.has(key)) return cache.get(key);
  const [c, ctx] = canvas(256, 128);
  ctx.clearRect(0, 0, 256, 128);
  const blobs = [[70, 80, 42], [120, 62, 52], [175, 82, 44], [100, 90, 38], [150, 92, 36]];
  for (const [x, y, r] of blobs) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(255,250,245,0.85)');
    g.addColorStop(1, 'rgba(255,250,245,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}
