// Velvet Bay — 3D model builders. Anti-Minecraft mandate: the hero car is an
// extruded curved profile (real bevel), characters are capsule limbs + sphere
// heads, buildings are layered setback extrusions with textured facades.
// This file contains ZERO BoxGeometry. Written fresh for round 10 (attempt 5).
import { facadeTexture } from './textures.js';

const MATS = {};
export function mat(color, opts = {}) {
  const key = `${color}-${opts.rough ?? 0.8}-${opts.metal ?? 0}-${opts.emissive ?? ''}`;
  if (!MATS[key]) {
    MATS[key] = new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.8, metalness: opts.metal ?? 0,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
    });
  }
  return MATS[key];
}

// ---- Hero car: extruded curved side profile, bevelled, glossy two-tone ----
export function buildCar(color = 0xc22430, opts = {}) {
  const group = new THREE.Group();
  group.name = 'heroCar';
  // Side profile (x = length axis after rotation, y = height). Sleek sedan:
  // long hood, raked windshield, curved roof, short deck.
  const s = new THREE.Shape();
  s.moveTo(-2.1, 0.35);
  s.quadraticCurveTo(-2.25, 0.55, -2.05, 0.72); // rear bumper curve
  s.quadraticCurveTo(-1.7, 0.78, -1.25, 0.82); // deck
  s.quadraticCurveTo(-0.75, 1.18, -0.15, 1.22); // rear glass -> roof
  s.quadraticCurveTo(0.45, 1.24, 0.85, 1.12); // roof -> windshield
  s.quadraticCurveTo(1.35, 0.98, 1.75, 0.82); // hood slope
  s.quadraticCurveTo(2.15, 0.72, 2.2, 0.5); // nose
  s.quadraticCurveTo(2.22, 0.32, 2.0, 0.3);
  s.lineTo(-1.9, 0.3);
  s.quadraticCurveTo(-2.1, 0.3, -2.1, 0.35);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.7, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.13,
    bevelSegments: 4, curveSegments: 14, steps: 1,
  });
  geo.translate(0, 0, -0.85);
  const paint = new THREE.MeshStandardMaterial({
    color, roughness: 0.28, metalness: 0.65,
  });
  const body = new THREE.Mesh(geo, paint);
  body.castShadow = true;
  group.add(body);

  // Glasshouse: a lower, darker extruded canopy sitting on the roof line.
  const g = new THREE.Shape();
  g.moveTo(-1.15, 0.86);
  g.quadraticCurveTo(-0.7, 1.14, -0.1, 1.18);
  g.quadraticCurveTo(0.5, 1.18, 0.8, 1.02);
  g.lineTo(0.85, 0.9);
  g.lineTo(-1.15, 0.86);
  const ggeo = new THREE.ExtrudeGeometry(g, {
    depth: 1.45, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05,
    bevelSegments: 2, curveSegments: 10,
  });
  ggeo.translate(0, 0, -0.725);
  const glass = new THREE.Mesh(ggeo, new THREE.MeshStandardMaterial({
    color: 0x10161f, roughness: 0.12, metalness: 0.9,
  }));
  group.add(glass);

  // Glossy roof highlight strip (thin extruded band, pale, semi-gloss).
  const r = new THREE.Shape();
  r.moveTo(-0.55, 1.2); r.quadraticCurveTo(0, 1.26, 0.55, 1.14);
  r.lineTo(0.5, 1.1); r.quadraticCurveTo(0, 1.2, -0.5, 1.16); r.closePath();
  const rgeo = new THREE.ExtrudeGeometry(r, { depth: 0.9, bevelEnabled: false });
  rgeo.translate(0, 0, -0.45);
  group.add(new THREE.Mesh(rgeo, mat(0xffffff, { rough: 0.15, metal: 0.4, transparent: true, opacity: 0.35 })));

  // Wheels: torus tyre + cylinder hubcap, axis along Z (car width).
  const wheelGeo = new THREE.TorusGeometry(0.42, 0.16, 12, 22);
  const hubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.2, 18);
  hubGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-1.35, 0.86], [-1.35, -0.86], [1.35, 0.86], [1.35, -0.86]]) {
    const w = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, mat(0x14151a, { rough: 0.9 }));
    const hub = new THREE.Mesh(hubGeo, mat(0xb9c0c9, { rough: 0.3, metal: 0.8 }));
    tyre.castShadow = true;
    w.add(tyre); w.add(hub);
    w.position.set(wx, 0.42, wz);
    group.add(w);
    wheels.push(w);
  }
  // Wheel-arch shadow discs (soft dark ellipse under each wheel).
  const shadowGeo = new THREE.CircleGeometry(0.55, 20);
  shadowGeo.rotateX(-Math.PI / 2);
  for (const [wx, wz] of [[-1.35, 0.86], [-1.35, -0.86], [1.35, 0.86], [1.35, -0.86]]) {
    const sh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false,
    }));
    sh.position.set(wx, 0.02, wz);
    group.add(sh);
  }

  // Headlights (emissive) + taillights.
  const lampGeo = new THREE.SphereGeometry(0.09, 10, 8);
  lampGeo.scale(1, 0.7, 0.6);
  for (const wz of [0.55, -0.55]) {
    const h = new THREE.Mesh(lampGeo, mat(0xffffff, { rough: 0.2, emissive: 0xfff2b0, emissiveIntensity: 1.6 }));
    h.position.set(2.18, 0.62, wz);
    group.add(h);
    const t = new THREE.Mesh(lampGeo, mat(0xff2222, { rough: 0.2, emissive: 0xff2020, emissiveIntensity: 1.4 }));
    t.position.set(-2.22, 0.66, wz);
    group.add(t);
  }
  // Headlight beam cones (visible at dusk/night; opacity driven by city).
  // ConeGeometry's apex sits at +h/2 on Y: rotate it so the apex is at the
  // lamp (origin) and the wide opening faces forward (+X, the car's nose).
  const beamGeo = new THREE.ConeGeometry(0.55, 3.4, 12, 1, true);
  beamGeo.rotateZ(Math.PI / 2);
  beamGeo.translate(1.7, 0, 0);
  const beams = [];
  for (const wz of [0.55, -0.55]) {
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    beam.position.set(2.1, 0.55, wz);
    group.add(beam);
    beams.push(beam);
  }
  // Car faces +X after this rotation: profile was drawn in XY (length on X).
  group.rotation.y = 0;
  group.userData = { wheels, beams, paint };
  return group;
}

// ---- Character: capsule limbs + sphere head, no boxes ----
export function buildCharacter({ shirt = 0x2f6fd0, skin = 0xc98d64, pants = 0x23262e, hair = 0x1a1410 } = {}) {
  const group = new THREE.Group();
  group.name = 'character';
  const shirtMat = mat(shirt, { rough: 0.85 });
  const skinMat = mat(skin, { rough: 0.7 });
  const pantsMat = mat(pants, { rough: 0.9 });
  const hairMat = mat(hair, { rough: 0.95 });

  // Torso: capsule, slightly tapered look via scale.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.55, 6, 12), shirtMat);
  torso.position.y = 1.18; torso.castShadow = true;
  group.add(torso);
  // Head: sphere + hair cap (sphere squashed, offset back/up).
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skinMat);
  head.position.y = 1.78; head.castShadow = true;
  group.add(head);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.215, 16, 10), hairMat);
  hairMesh.scale.set(1, 0.72, 1);
  hairMesh.position.set(0, 1.86, -0.03);
  group.add(hairMesh);
  // Arms: capsule, pivoted at the shoulder via a group.
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.34 * side, 1.48, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 10), shirtMat);
    arm.position.y = -0.32; arm.castShadow = true;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skinMat);
    hand.position.y = -0.62;
    pivot.add(hand);
    group.add(pivot);
    arms.push(pivot);
  }
  // Legs: capsule, pivoted at the hip.
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.14 * side, 0.88, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 4, 10), pantsMat);
    leg.position.y = -0.42; leg.castShadow = true;
    pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xf2ead8, { rough: 0.6 }));
    shoe.scale.set(1, 0.6, 1.5);
    shoe.position.set(0, -0.78, 0.05);
    pivot.add(shoe);
    group.add(pivot);
    legs.push(pivot);
  }
  group.userData = { arms, legs, torso, head };
  return group;
}

// ---- Buildings: layered setback extrusions with textured facades ----
export function buildTower(rng, variant, height) {
  const group = new THREE.Group();
  group.name = 'heroBuilding';
  const w = rng.range(16, 26);
  const d = rng.range(16, 26);
  const lit = rng.range(0.25, 0.75);
  const tex = facadeTexture(variant, lit);
  const tiers = height > 55 ? 3 : height > 30 ? 2 : 1;
  const tierH = height / tiers;
  let y = 0;
  let cw = w, cd = d;
  for (let t = 0; t < tiers; t++) {
    const shape = new THREE.Shape();
    // Slightly chamfered rectangle footprint so edges catch light.
    const hw = cw / 2, hd = cd / 2, ch = Math.min(2.5, cw * 0.12);
    shape.moveTo(-hw + ch, -hd);
    shape.lineTo(hw - ch, -hd); shape.lineTo(hw, -hd + ch); shape.lineTo(hw, hd - ch);
    shape.lineTo(hw - ch, hd); shape.lineTo(-hw + ch, hd); shape.lineTo(-hw, hd - ch);
    shape.lineTo(-hw, -hd + ch); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: tierH, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4,
      bevelSegments: 1, curveSegments: 4,
    });
    geo.rotateX(-Math.PI / 2); // shape XY -> XZ footprint, extrusion up
    geo.translate(0, y, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.85, metalness: 0.05,
    }));
    // UVs from extrude are in shape units; rescale so one texture tile spans
    // roughly one face width, keeping windows a believable size.
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, pos.getX(i) / 26, pos.getY(i) / 52);
    }
    uv.needsUpdate = true;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    // Parapet rim: thin extruded ring on top of the tier.
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-hw, -hd); rimShape.lineTo(hw, -hd); rimShape.lineTo(hw, hd);
    rimShape.lineTo(-hw, hd); rimShape.closePath();
    const hole = new THREE.Path();
    const iw = hw - 0.5, id = hd - 0.5;
    hole.moveTo(-iw, -id); hole.lineTo(iw, -id); hole.lineTo(iw, id);
    hole.lineTo(-iw, id); hole.closePath();
    rimShape.holes.push(hole);
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.7, bevelEnabled: false });
    rimGeo.rotateX(-Math.PI / 2);
    rimGeo.translate(0, y + tierH, 0);
    const rim = new THREE.Mesh(rimGeo, mat(0x2c2f36, { rough: 0.9 }));
    rim.castShadow = true;
    group.add(rim);
    y += tierH;
    cw *= 0.78; cd *= 0.78;
  }
  // Rooftop props: cylinder AC units + a small antenna mast.
  const acGeo = new THREE.CylinderGeometry(1.1, 1.1, 1.0, 10);
  for (let i = 0; i < rng.int(1, 3); i++) {
    const ac = new THREE.Mesh(acGeo, mat(0x8f979e, { rough: 0.7, metal: 0.5 }));
    ac.position.set(rng.range(-cw / 4, cw / 4), y + 0.5, rng.range(-cd / 4, cd / 4));
    ac.castShadow = true;
    group.add(ac);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7, 8),
    mat(0x3a3f46, { rough: 0.5, metal: 0.7 }));
  mast.position.set(cw / 4, y + 3.5, -cd / 4);
  group.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    mat(0xff3030, { rough: 0.3, emissive: 0xff2020, emissiveIntensity: 1.5 }));
  beacon.position.set(cw / 4, y + 7.2, -cd / 4);
  group.add(beacon);
  group.userData = { topY: y, w, d };
  return group;
}

// ---- Palm tree: cylinder trunk + layered cone fronds ----
export function buildPalm(rng) {
  const group = new THREE.Group();
  group.name = 'palm';
  const h = rng.range(7, 11);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.42, h, 8),
    mat(0x7a5c3e, { rough: 0.95 }));
  trunk.position.y = h / 2;
  trunk.rotation.z = rng.range(-0.06, 0.06);
  trunk.castShadow = true;
  group.add(trunk);
  // Fronds: two rings of flattened cones drooping outward.
  const frondGeo = new THREE.ConeGeometry(0.55, 3.4, 6);
  frondGeo.translate(0, -1.2, 0);
  const frondMat = mat(0x2f7a3a, { rough: 0.85 });
  const frondMat2 = mat(0x3f9448, { rough: 0.85 });
  for (let ring = 0; ring < 2; ring++) {
    const n = 7 - ring;
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(frondGeo, ring === 0 ? frondMat : frondMat2);
      const a = (i / n) * Math.PI * 2 + ring * 0.4;
      f.position.set(Math.cos(a) * 0.3, h + ring * 0.35, Math.sin(a) * 0.3);
      f.rotation.set(Math.sin(a) * (1.9 - ring * 0.35), 0, -Math.cos(a) * (1.9 - ring * 0.35));
      f.rotation.y = -a;
      f.castShadow = true;
      group.add(f);
    }
  }
  // Coconuts: small spheres clustered under the crown.
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), mat(0x6b4a26, { rough: 0.9 }));
    nut.position.set(Math.cos(i * 2.1) * 0.4, h - 0.25, Math.sin(i * 2.1) * 0.4);
    group.add(nut);
  }
  return group;
}

// ---- Helicopter: extruded body, cylinder tail, spinning rotor ----
export function buildHelicopter() {
  const group = new THREE.Group();
  group.name = 'heli';
  const s = new THREE.Shape();
  s.moveTo(-1.6, 0.2);
  s.quadraticCurveTo(-2.0, 0.8, -1.4, 1.1);
  s.quadraticCurveTo(-0.4, 1.5, 0.6, 1.3);
  s.quadraticCurveTo(1.4, 1.1, 1.5, 0.6);
  s.quadraticCurveTo(1.5, 0.2, 0.8, 0.15);
  s.lineTo(-1.2, 0.15);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.6, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25,
    bevelSegments: 3, curveSegments: 10,
  });
  geo.translate(0, 0, -0.8);
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0x1c2f4a, roughness: 0.35, metalness: 0.6,
  }));
  body.castShadow = true;
  group.add(body);
  // Glass nose.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0e1a26, roughness: 0.1, metalness: 0.9 }));
  nose.scale.set(1.2, 0.8, 1.1);
  nose.position.set(1.25, 0.85, 0);
  group.add(nose);
  // Tail boom + fin.
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 3.4, 8),
    mat(0x1c2f4a, { rough: 0.4, metal: 0.6 }));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-3.0, 0.95, 0);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 4), mat(0x28456a, { rough: 0.4, metal: 0.6 }));
  fin.rotation.z = -Math.PI / 2;
  fin.position.set(-4.7, 1.15, 0);
  group.add(fin);
  // Skids: thin cylinders.
  const skidGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
  skidGeo.rotateX(Math.PI / 2);
  for (const wz of [0.7, -0.7]) {
    const skid = new THREE.Mesh(skidGeo, mat(0x222222, { rough: 0.5, metal: 0.7 }));
    skid.position.set(0.1, -0.15, wz);
    group.add(skid);
  }
  // Main rotor: two thin extruded blades on a mast.
  const rotor = new THREE.Group();
  rotor.position.set(0, 1.75, 0);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-3.4, -0.14); bladeShape.lineTo(3.4, -0.14);
  bladeShape.lineTo(3.4, 0.14); bladeShape.lineTo(-3.4, 0.14); bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.06, bevelEnabled: false });
  bladeGeo.translate(0, 0, -0.03);
  const blade = new THREE.Mesh(bladeGeo, mat(0x14161a, { rough: 0.4, metal: 0.5 }));
  rotor.add(blade);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), mat(0x333333, { rough: 0.5, metal: 0.7 }));
  mast.position.y = -0.2;
  rotor.add(mast);
  group.add(rotor);
  // Searchlight cone under the belly.
  const spot = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff6c8, transparent: true, opacity: 0.14,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
  spot.rotation.x = Math.PI;
  spot.position.y = -2.6;
  group.add(spot);
  group.userData = { rotor };
  return group;
}

// ---- Street props (no boxes anywhere) ----
export function buildLamp() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.4, 8),
    mat(0x2f333a, { rough: 0.5, metal: 0.7 }));
  pole.position.y = 2.7; pole.castShadow = true;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6),
    mat(0x2f333a, { rough: 0.5, metal: 0.7 }));
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.75, 5.3, 0);
  group.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
    mat(0xfff2b0, { rough: 0.3, emissive: 0xffe9a0, emissiveIntensity: 0.6 }));
  head.scale.set(1.4, 0.6, 0.8);
  head.position.set(1.5, 5.25, 0);
  group.add(head);
  group.userData = { head };
  return group;
}

export function buildBench() {
  const group = new THREE.Group();
  const seatGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.0, 4);
  seatGeo.rotateZ(Math.PI / 2); // axis along X: bench length
  seatGeo.scale(1, 0.22, 1); // flatten vertically into a seat slab
  const seat = new THREE.Mesh(seatGeo, mat(0x8a5a34, { rough: 0.85 }));
  seat.position.y = 0.55; seat.castShadow = true;
  group.add(seat);
  const backGeo = new THREE.CylinderGeometry(0.5, 0.5, 2.0, 4);
  backGeo.rotateZ(Math.PI / 2); // axis along X: backrest length
  backGeo.scale(1, 0.85, 0.16); // tall, thin in depth
  const back = new THREE.Mesh(backGeo, mat(0x8a5a34, { rough: 0.85 }));
  back.position.set(0, 1.0, -0.55);
  back.rotation.x = -0.25;
  group.add(back);
  for (const x of [-0.85, 0.85]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 6),
      mat(0x2f333a, { rough: 0.5, metal: 0.7 }));
    leg.position.set(x, 0.28, 0);
    group.add(leg);
  }
  return group;
}

export function buildCrate(rng) {
  const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.9, 6);
  const crate = new THREE.Mesh(geo, mat(rng.pick([0x9a7b4f, 0x6b7a5a, 0x7d6a8a]), { rough: 0.9 }));
  crate.castShadow = true;
  crate.rotation.y = rng.range(0, Math.PI);
  return crate;
}

export function buildUmbrella() {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6),
    mat(0xe8e2d0, { rough: 0.6 }));
  pole.position.y = 1.3;
  group.add(pole);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 10),
    mat(0xd94f4f, { rough: 0.8 }));
  canopy.position.y = 2.8; canopy.castShadow = true;
  group.add(canopy);
  return group;
}

// Geometry audit: walk the live scene, count geometry types per hero group.
export function auditGeometry(scene) {
  const result = { pass: true, groups: {} };
  const targets = ['heroCar', 'character', 'heroBuilding'];
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    let node = obj;
    let groupName = null;
    while (node) {
      if (targets.includes(node.name)) { groupName = node.name; break; }
      node = node.parent;
    }
    if (!groupName) return;
    const type = obj.geometry?.type ?? 'none';
    result.groups[groupName] ??= { total: 0, BoxGeometry: 0, types: {} };
    const g = result.groups[groupName];
    g.total++;
    g.types[type] = (g.types[type] ?? 0) + 1;
    if (type === 'BoxGeometry') g.BoxGeometry++;
  });
  for (const name of targets) {
    const g = result.groups[name];
    if (g && g.BoxGeometry > 0) result.pass = false;
  }
  return result;
}
