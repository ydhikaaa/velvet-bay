// Velvet Bay — the city: renderer, cinematic sky, textured ground, 5+ distinct
// districts, pier, beach, lamps, props, hidden packages, time of day.
// Written fresh for round 10 (attempt 5).
import { WORLD, ROAD_LINES, createRng } from './state.js';
import {
  asphaltTexture, sidewalkTexture, grassTexture, sandTexture,
  waterTexture, crosswalkTexture, glowTexture, cloudTexture,
} from './textures.js';
import { buildTower, buildPalm, buildLamp, buildBench, buildCrate, buildUmbrella, buildHelicopter, mat } from './models.js';

const PARK_BLOCKS = new Set(['-192,-192', '-192,192', '192,-192', '64,192']);

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2f5d8f) },
      midColor: { value: new THREE.Color(0xe8975a) },
      botColor: { value: new THREE.Color(0x3a2a33) },
      sunDir: { value: new THREE.Vector3(0.5, 0.25, 0.2).normalize() },
      sunColor: { value: new THREE.Color(0xffd9a0) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w; // pin sky to the far plane
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 topColor, midColor, botColor, sunColor;
      uniform vec3 sunDir;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(botColor, midColor, smoothstep(-0.05, 0.16, h));
        col = mix(col, topColor, smoothstep(0.12, 0.65, h));
        float sunAmt = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 90.0);
        float halo = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 7.0);
        col += sunColor * (sunAmt * 0.9 + halo * 0.28);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function createCity(scene) {
  const rng = createRng(20261123);
  const dyn = {
    lamps: [], lampGlows: [], beams: [], clouds: [], heli: null,
    beacon: null, beaconRing: null, packages: [], sun: null, hemi: null,
    skyMat: null, water: null, timeOfDay: 'golden', sunDir: new THREE.Vector3(0.55, 0.3, 0.3).normalize(),
  };

  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('scene'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene.background = new THREE.Color(0x1a2436);
  scene.fog = new THREE.Fog(0xd88a5e, 180, 620);

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1500);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Lights ---
  const sun = new THREE.DirectionalLight(0xffd9a8, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x8fb4d8, 0x4a3b2e, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffe0b8, 0.25);
  scene.add(amb);
  // Shadow-side fill: a dim warm light from the opposite side of the sun so
  // shaded facades never go black (the "Minecraft" complaint was flat dark slabs).
  const fill = new THREE.DirectionalLight(0xffd0a0, 0.55);
  fill.position.set(-200, 120, -80);
  scene.add(fill);
  scene.add(fill.target);
  dyn.sun = sun; dyn.hemi = hemi; dyn.fill = fill;

  // --- Sky dome + sun disc sprite + drifting clouds ---
  const skyMat = skyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 16), skyMat);
  scene.add(sky);
  dyn.skyMat = skyMat;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,225,160,1)', 'rgba(255,180,90,0)'),
    transparent: true, opacity: 0.95, depthWrite: false, depthTest: false,
  }));
  sunSprite.scale.set(220, 220, 1);
  scene.add(sunSprite);
  dyn.sunSprite = sunSprite;
  const cloudTex = cloudTexture();
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.5 + rng.range(0, 0.3), depthWrite: false,
    }));
    sp.position.set(rng.range(-600, 600), rng.range(110, 210), rng.range(-600, 600));
    sp.scale.set(rng.range(90, 220), rng.range(28, 60), 1);
    sp.userData.drift = rng.range(0.6, 1.8);
    scene.add(sp);
    dyn.clouds.push(sp);
  }

  // Ground: grass base — ends at the beach (x=292) so the sea stays visible.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(612, 1100),
    new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }));
  ground.material.map.repeat.set(14, 24);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-14, -0.08, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const asphalt = asphaltTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 });
  for (const v of ROAD_LINES) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(640, 15), roadMat.clone());
      strip.material.map = asphalt.clone();
      strip.material.map.needsUpdate = true;
      strip.material.map.repeat.set(40, 1);
      strip.rotation.x = -Math.PI / 2;
      if (horizontal) strip.rotation.z = Math.PI / 2;
      strip.position.set(horizontal ? 0 : v, 0.0, horizontal ? v : 0);
      strip.receiveShadow = true;
      scene.add(strip);
    }
  }
  const walkTex = sidewalkTexture();
  for (const v of ROAD_LINES) {
    for (const off of [-9.5, 9.5]) {
      for (const horizontal of [true, false]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(640, 4.4),
          new THREE.MeshStandardMaterial({ map: walkTex, roughness: 1 }));
        sw.material.map = walkTex.clone();
        sw.material.map.needsUpdate = true;
        sw.material.map.repeat.set(60, 1);
        sw.rotation.x = -Math.PI / 2;
        if (horizontal) sw.rotation.z = Math.PI / 2;
        sw.position.set(horizontal ? 0 : v + off, 0.03, horizontal ? v + off : 0);
        sw.receiveShadow = true;
        scene.add(sw);
      }
    }
  }
  const crossTex = crosswalkTexture();
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      const cw = new THREE.Mesh(new THREE.PlaneGeometry(15, 15),
        new THREE.MeshStandardMaterial({ map: crossTex, roughness: 0.9, transparent: true }));
      cw.rotation.x = -Math.PI / 2;
      cw.position.set(x, 0.05, z);
      cw.receiveShadow = true;
      scene.add(cw);
    }
  }

  // --- Beach + water (east) ---
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 660),
    new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
  sand.material.map.repeat.set(2, 24);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(262, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(320, 1100),
    new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.25, metalness: 0.35 }));
  water.material.map.repeat.set(6, 22);
  water.rotation.x = -Math.PI / 2;
  water.position.set(452, -0.35, 0);
  scene.add(water);
  dyn.water = water;

  // --- Pier: deck planks (extruded), posts, umbrellas, end platform.
  // The pier runs along the z=32 road line so cars can drive onto it.
  const pierGroup = new THREE.Group();
  const deckShape = new THREE.Shape();
  deckShape.moveTo(0, -6); deckShape.lineTo(64, -6); deckShape.lineTo(64, 6); deckShape.lineTo(0, 6);
  deckShape.closePath();
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, { depth: 0.5, bevelEnabled: false });
  deckGeo.rotateX(-Math.PI / 2);
  deckGeo.translate(0, 0, 0);
  const deck = new THREE.Mesh(deckGeo, new THREE.MeshStandardMaterial({
    color: 0x8a6a44, roughness: 0.9,
  }));
  deck.position.set(240, 1.2, 32);
  deck.castShadow = true; deck.receiveShadow = true;
  pierGroup.add(deck);
  // deck plank lines: thin dark cylinders laid across
  const plankGeo = new THREE.CylinderGeometry(0.09, 0.09, 12, 5);
  plankGeo.rotateX(Math.PI / 2);
  for (let x = 244; x < 304; x += 4) {
    const p = new THREE.Mesh(plankGeo, mat(0x6b4f2e, { rough: 0.95 }));
    p.position.set(x, 1.48, 32);
    pierGroup.add(p);
  }
  for (let x = 246; x < 304; x += 8) {
    for (const z of [27, 37]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 3.4, 8),
        mat(0x5d4630, { rough: 0.9 }));
      post.position.set(x, -0.2, z);
      pierGroup.add(post);
    }
  }
  for (const [ux, uz] of [[292, 26], [292, 38], [284, 32]]) {
    const um = buildUmbrella();
    um.position.set(ux, 1.5, uz);
    pierGroup.add(um);
  }
  scene.add(pierGroup);

  // --- Buildings per block ---
  const towerSpots = [];
  for (let bx = -256; bx <= 256; bx += 64) {
    for (let bz = -256; bz <= 256; bz += 64) {
      if (bx > 200) continue; // beach blocks stay open
      if (PARK_BLOCKS.has(`${bx},${bz}`)) continue;
      if (bz === 32 && bx >= 192) continue; // pier approach stays clear
      towerSpots.push([bx, bz]);
    }
  }
  const districtOf = (x, z) => {
    if (x >= 130) return 'coastal';
    if (z <= -130) return x < -130 ? 'harbor' : 'dockyard';
    if (x < -130) return 'residential';
    if (z >= 30 && z < 190 && x >= -130) return 'entertainment';
    if (z >= 190) return 'oldtown';
    return 'downtown';
  };
  for (const [bx, bz] of towerSpots) {
    const hue = districtOf(bx, bz);
    const variant = rng.int(0, 7);
    let height;
    if (hue === 'downtown') height = rng.range(45, 95);
    else if (hue === 'coastal') height = rng.range(22, 48);
    else if (hue === 'entertainment') height = rng.range(16, 38);
    else if (hue === 'harbor' || hue === 'dockyard') height = rng.range(10, 20);
    else height = rng.range(9, 22);
    const tower = buildTower(rng, variant, height);
    tower.position.set(bx + rng.range(-8, 8), 0, bz + rng.range(-8, 8));
    tower.rotation.y = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    scene.add(tower);
    // A second low annex on big downtown blocks.
    if (hue === 'downtown' && rng.chance(0.5)) {
      const annex = buildTower(rng, (variant + 3) % 8, rng.range(12, 24));
      annex.position.set(bx + rng.range(-14, 14), 0, bz + rng.range(-14, 14));
      annex.rotation.y = rng.pick([0, Math.PI / 2]);
      scene.add(annex);
    }
  }

  // --- Parks: palms, benches, grass mounds ---
  for (const key of PARK_BLOCKS) {
    const [px, pz] = key.split(',').map(Number);
    for (let i = 0; i < 6; i++) {
      const palm = buildPalm(rng);
      palm.position.set(px + rng.range(-24, 24), 0, pz + rng.range(-24, 24));
      scene.add(palm);
    }
    for (let i = 0; i < 3; i++) {
      const bench = buildBench();
      bench.position.set(px + rng.range(-20, 20), 0, pz + rng.range(-20, 20));
      bench.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(bench);
    }
    for (let i = 0; i < 4; i++) {
      const crate = buildCrate(rng);
      crate.position.set(px + rng.range(-22, 22), 0.45, pz + rng.range(-22, 22));
      scene.add(crate);
    }
  }

  // --- Palms along the coastal boulevard + beach umbrellas ---
  for (let z = -288; z <= 288; z += 32) {
    for (const x of [226, 252]) {
      const palm = buildPalm(rng);
      palm.position.set(x + rng.range(-3, 3), 0, z + rng.range(-6, 6));
      scene.add(palm);
    }
  }
  for (const [ux, uz] of [[258, -120], [266, -40], [258, 120], [268, 200], [256, -200]]) {
    const um = buildUmbrella();
    um.position.set(ux, 0, uz);
    scene.add(um);
  }

  // --- Street lamps at intersections + glow pools ---
  const glowTex = glowTexture('rgba(255,214,140,0.9)', 'rgba(255,180,80,0)');
  for (const x of ROAD_LINES) {
    for (const z of ROAD_LINES) {
      if (rng.chance(0.25)) continue;
      const lamp = buildLamp();
      lamp.position.set(x + 12, 0, z + 12);
      lamp.rotation.y = Math.PI * (rng.int(0, 3) / 2);
      scene.add(lamp);
      dyn.lamps.push(lamp);
      const poolGeo = new THREE.CircleGeometry(6, 20);
      poolGeo.rotateX(-Math.PI / 2);
      const pool = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      pool.position.set(x + 12, 0.08, z + 12);
      scene.add(pool);
      dyn.lampGlows.push(pool);
    }
  }

  // --- Distant skyline silhouettes for depth (dark extruded slabs) ---
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = 520;
    const shape = new THREE.Shape();
    const w = rng.range(30, 60), h = rng.range(60, 150);
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h);
    shape.lineTo(w / 4, h + 12); shape.lineTo(-w / 4, h + 12); shape.lineTo(-w / 2, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 8, bevelEnabled: false });
    const sil = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x2a2438, roughness: 1,
    }));
    sil.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    sil.lookAt(0, 0, 0);
    scene.add(sil);
  }

  // --- Hidden packages: 12 glowing pickups ---
  const pkgSpots = [
    [-224, -224], [-160, 32], [-32, -160], [32, -224], [96, -32], [160, 96],
    [-224, 160], [32, 224], [-96, -32], [160, -160], [-32, 96], [296, 32],
  ];
  for (let i = 0; i < pkgSpots.length; i++) {
    const [px, pz] = pkgSpots[i];
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffd23e, roughness: 0.3, metalness: 0.4,
        emissive: 0xa8820a, emissiveIntensity: 0.7,
      }));
    core.position.y = 0.9; core.rotation.y = Math.PI / 6;
    core.castShadow = true;
    g.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture('rgba(255,210,62,0.95)', 'rgba(255,210,62,0)'),
      transparent: true, opacity: 0.85, depthWrite: false,
    }));
    halo.scale.set(4, 4, 1);
    halo.position.y = 1.0;
    g.add(halo);
    g.position.set(px, 0, pz);
    g.userData.index = i;
    scene.add(g);
    dyn.packages.push(g);
  }

  // --- Mission beacon: a slim light pillar + ground ring (kept subtle so it
  // never reads as a stray beam in screenshots) ---
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 26, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
  beacon.position.y = 13;
  beacon.visible = false;
  scene.add(beacon);
  dyn.beacon = beacon;
  const ringGeo = new THREE.TorusGeometry(3.2, 0.28, 8, 28);
  ringGeo.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  ring.visible = false;
  scene.add(ring);
  dyn.beaconRing = ring;

  // --- Police helicopter (hidden until wanted >= 3) ---
  const heli = buildHelicopter();
  heli.visible = false;
  heli.position.set(0, 55, 0);
  scene.add(heli);
  dyn.heli = heli;

  // --- Time of day presets ---
  function applyTimeOfDay(mode) {
    dyn.timeOfDay = mode;
    const u = dyn.skyMat.uniforms;
    if (mode === 'golden') {
      dyn.sunDir.set(0.55, 0.22, 0.3).normalize();
      sun.position.set(220, 90, 120);
      sun.intensity = 2.4; sun.color.set(0xffd9a8);
      hemi.intensity = 0.85;
      scene.fog.color.set(0xd88a5e); scene.fog.near = 180; scene.fog.far = 620;
      u.topColor.value.set(0x2f5d8f); u.midColor.value.set(0xe8975a); u.botColor.value.set(0x3a2a33);
      u.sunDir.value.set(0.55, 0.22, 0.3).normalize();
      u.sunColor.value.set(0xffd9a0);
      dyn.sunSprite.position.set(440, 150, 240);
      dyn.sunSprite.material.opacity = 0.95;
      setLampGlow(0.12);
    } else if (mode === 'noon') {
      dyn.sunDir.set(0.2, 0.9, 0.25).normalize();
      sun.position.set(60, 320, 80);
      sun.intensity = 3.0; sun.color.set(0xfff2dd);
      hemi.intensity = 1.1;
      scene.fog.color.set(0xbfd4e6); scene.fog.near = 220; scene.fog.far = 700;
      u.topColor.value.set(0x3f7fc4); u.midColor.value.set(0xa8c8e0); u.botColor.value.set(0xd8e4ea);
      u.sunDir.value.set(0.2, 0.9, 0.25).normalize();
      u.sunColor.value.set(0xfff6da);
      dyn.sunSprite.position.set(160, 720, 200);
      dyn.sunSprite.material.opacity = 0.85;
      setLampGlow(0);
    } else if (mode === 'dusk') {
      dyn.sunDir.set(-0.8, 0.12, 0.15).normalize();
      sun.position.set(-260, 55, 60);
      sun.intensity = 1.5; sun.color.set(0xff9a5a);
      hemi.intensity = 0.55;
      scene.fog.color.set(0x7a4a63); scene.fog.near = 150; scene.fog.far = 520;
      u.topColor.value.set(0x1d2a52); u.midColor.value.set(0xc65a7a); u.botColor.value.set(0x2a1c28);
      u.sunDir.value.set(-0.8, 0.12, 0.15).normalize();
      u.sunColor.value.set(0xff8a5a);
      dyn.sunSprite.position.set(-560, 90, 120);
      dyn.sunSprite.material.opacity = 0.9;
      setLampGlow(0.5);
    } else { // night
      dyn.sunDir.set(-0.3, 0.5, -0.2).normalize();
      sun.position.set(-120, 200, -80);
      sun.intensity = 0.55; sun.color.set(0x8fb0e8);
      hemi.intensity = 0.5;
      scene.fog.color.set(0x0e1526); scene.fog.near = 120; scene.fog.far = 460;
      u.topColor.value.set(0x060a18); u.midColor.value.set(0x101c38); u.botColor.value.set(0x1a2036);
      u.sunDir.value.set(-0.3, 0.5, -0.2).normalize();
      u.sunColor.value.set(0xbfd4ff);
      dyn.sunSprite.position.set(-240, 400, -160);
      dyn.sunSprite.material.opacity = 0.25;
      setLampGlow(0.85);
    }
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
  }
  function setLampGlow(op) {
    for (const pool of dyn.lampGlows) pool.material.opacity = op;
    for (const lamp of dyn.lamps) {
      lamp.userData.head.material.emissiveIntensity = op > 0.3 ? 1.8 : 0.6;
    }
  }

  function update(dt, state, focus) {
    // Sun shadow frustum follows the player, keeping the stored direction.
    const fx = focus?.x ?? 0, fz = focus?.z ?? 0;
    const dir = dyn.sunDir;
    sun.target.position.set(fx, 0, fz);
    sun.position.set(fx + dir.x * 300, Math.max(40, dir.y * 300 + 40), fz + dir.z * 300);
    sun.target.updateMatrixWorld();
    // Clouds drift.
    for (const c of dyn.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 650) c.position.x = -650;
    }
    // Water shimmer.
    if (dyn.water) {
      dyn.water.material.map.offset.x += dt * 0.004;
      dyn.water.material.map.offset.y += dt * 0.0015;
    }
    // Package bob + spin.
    for (const p of dyn.packages) {
      if (!p.visible) continue;
      p.children[0].rotation.y += dt * 1.4;
      p.children[0].position.y = 0.9 + Math.sin(state.time * 2.2 + p.userData.index) * 0.18;
    }
    // Beacon pulse.
    if (dyn.beacon.visible) {
      const s = 1 + Math.sin(state.time * 3) * 0.12;
      dyn.beaconRing.scale.set(s, 1, s);
      dyn.beacon.material.opacity = 0.14 + Math.sin(state.time * 3) * 0.05;
    }
    // Helicopter rotor + hover bob.
    if (dyn.heli.visible) {
      dyn.heli.userData.rotor.rotation.y += dt * 22;
      dyn.heli.position.y = 55 + Math.sin(state.time * 1.3) * 2;
    }
  }

  applyTimeOfDay('golden');
  return {
    renderer, camera, dyn, applyTimeOfDay, update,
    setBeacon(x, z, visible) {
      dyn.beacon.visible = visible;
      dyn.beaconRing.visible = visible;
      if (visible) {
        dyn.beacon.position.set(x, 13, z);
        dyn.beaconRing.position.set(x, 0.3, z);
      }
    },
  };
}
