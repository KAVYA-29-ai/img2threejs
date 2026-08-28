import * as THREE from 'three';

/**
 * Procedural reconstruction for the supplied portrait reference:
 * dark-haired man, glasses, black blazer, white shirt, holding a Sony-style camera.
 *
 * Code-only: no textures, GLB, OBJ or external model files.
 * The model is intentionally built from smooth primitives + curved profile geometry
 * so the silhouette survives orbit views instead of reading like a mannequin.
 */

const M = {
  skin: new THREE.MeshPhysicalMaterial({ color: 0xb86f49, roughness: 0.58, metalness: 0, clearcoat: 0.03 }),
  skinDark: new THREE.MeshPhysicalMaterial({ color: 0x70402d, roughness: 0.72 }),
  skinLight: new THREE.MeshPhysicalMaterial({ color: 0xd28a5d, roughness: 0.52 }),
  hair: new THREE.MeshPhysicalMaterial({ color: 0x090706, roughness: 0.42, metalness: 0, clearcoat: 0.18, clearcoatRoughness: 0.28 }),
  hairHi: new THREE.MeshPhysicalMaterial({ color: 0x24140c, roughness: 0.34, clearcoat: 0.22 }),
  suit: new THREE.MeshPhysicalMaterial({ color: 0x101114, roughness: 0.76, metalness: 0.02 }),
  suitHi: new THREE.MeshPhysicalMaterial({ color: 0x191a1d, roughness: 0.67 }),
  shirt: new THREE.MeshPhysicalMaterial({ color: 0xe9e0d5, roughness: 0.88 }),
  shirtShadow: new THREE.MeshPhysicalMaterial({ color: 0xcfc4b8, roughness: 0.9 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x7c573d, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.28 }),
  frame: new THREE.MeshPhysicalMaterial({ color: 0x6d513b, roughness: 0.26, metalness: 0.72 }),
  camera: new THREE.MeshPhysicalMaterial({ color: 0x111214, roughness: 0.42, metalness: 0.32, clearcoat: 0.16 }),
  cameraRubber: new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.72 }),
  lensMetal: new THREE.MeshPhysicalMaterial({ color: 0x9c9a92, roughness: 0.28, metalness: 0.78 }),
  lensGlass: new THREE.MeshPhysicalMaterial({ color: 0x15100b, roughness: 0.06, metalness: 0.28, clearcoat: 0.75 }),
  lensCoat: new THREE.MeshPhysicalMaterial({ color: 0x4a351b, roughness: 0.08, metalness: 0.45, clearcoat: 0.9 }),
  gold: new THREE.MeshPhysicalMaterial({ color: 0x9b6b2f, roughness: 0.23, metalness: 0.82 }),
  eye: new THREE.MeshPhysicalMaterial({ color: 0x17100b, roughness: 0.1, metalness: 0.05, clearcoat: 0.8 }),
  white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};

function mesh(g: THREE.BufferGeometry, material: THREE.Material, name: string) {
  const o = new THREE.Mesh(g, material);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

function ellipsoid(name: string, s: [number, number, number], p: [number, number, number], mat: THREE.Material) {
  const o = mesh(new THREE.SphereGeometry(1, 40, 28), mat, name);
  o.scale.set(...s);
  o.position.set(...p);
  return o;
}

function capsule(name: string, radius: number, length: number, p: [number, number, number], mat: THREE.Material) {
  const o = mesh(new THREE.CapsuleGeometry(radius, length, 8, 24), mat, name);
  o.position.set(...p);
  return o;
}

function cylinder(name: string, r1: number, r2: number, h: number, p: [number, number, number], mat: THREE.Material, rot: [number, number, number] = [0, 0, 0]) {
  const o = mesh(new THREE.CylinderGeometry(r1, r2, h, 40), mat, name);
  o.position.set(...p);
  o.rotation.set(...rot);
  return o;
}

function tube(name: string, points: THREE.Vector3[], radius: number, mat: THREE.Material, radial = 12) {
  const curve = new THREE.CatmullRomCurve3(points);
  return mesh(new THREE.TubeGeometry(curve, Math.max(8, points.length * 5), radius, radial, false), mat, name);
}

function profilePanel(name: string, points: THREE.Vector2[], depth: number, z: number, mat: THREE.Material, bevel = 0.025) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: bevel, bevelThickness: bevel });
  const o = mesh(g, mat, name);
  o.position.z = z;
  return o;
}

function taperedLock(name: string, pts: THREE.Vector3[], widths: number[], mat: THREE.Material) {
  // Volumetric ribbon: wide root, narrow tip. This gives hair designed silhouette
  // rather than a collection of identical cones.
  const verts: number[] = [];
  const uvs: number[] = [];
  const faces: number[] = [];
  const rings = pts.length;

  for (let i = 0; i < rings; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(rings - 1, i + 1)];
    const tangent = next.clone().sub(prev).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize();
    if (side.lengthSq() < 0.1) side.set(1, 0, 0);
    const normal = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const w = widths[i];
    const d = w * 0.30;
    const a = pts[i].clone().addScaledVector(side, w).addScaledVector(normal, d);
    const b = pts[i].clone().addScaledVector(side, -w).addScaledVector(normal, d);
    const c = pts[i].clone().addScaledVector(side, -w).addScaledVector(normal, -d);
    const d0 = pts[i].clone().addScaledVector(side, w).addScaledVector(normal, -d);
    for (const v of [a, b, c, d0]) verts.push(v.x, v.y, v.z);
    const v = i / (rings - 1);
    uvs.push(0, v, 1, v, 1, v, 0, v);
  }

  for (let i = 0; i < rings - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    const quads = [[a, b, b + 1, a + 1], [a + 1, b + 1, b + 2, a + 2], [a + 2, b + 2, b + 3, a + 3], [a + 3, b + 3, b, a]];
    for (const q of quads) faces.push(...q);
  }
  faces.push(0, 1, 2, 0, 2, 3);
  const last = (rings - 1) * 4;
  faces.push(last, last + 2, last + 1, last, last + 3, last + 2);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(faces);
  g.computeVertexNormals();
  return mesh(g, mat, name);
}

export function createKavyaCameraPortrait() {
  const root = new THREE.Group();
  root.name = 'KavyaCameraPortrait';
  root.position.y = -0.05;

  // ---------------- body proportions ----------------
  const pelvisY = 1.25;
  const chestY = 2.15;
  const neckY = 3.15;
  const headY = 3.88;

  // Legs: slightly tapered, not rectangular blocks.
  const legL = capsule('Leg.L', 0.34, 1.02, [-0.34, 0.62, 0.02], M.suit);
  legL.scale.set(0.82, 1, 0.86);
  const legR = capsule('Leg.R', 0.34, 1.02, [0.34, 0.62, 0.02], M.suit);
  legR.scale.set(0.82, 1, 0.86);

  const waist = ellipsoid('Waist', [0.78, 0.43, 0.38], [0, 1.32, 0], M.suit);
  waist.scale.z = 0.92;

  // Chest volume uses overlapping ellipsoids for shoulder/chest planes.
  ellipsoid('TorsoCore', [0.92, 1.05, 0.46], [0, chestY, 0], M.suit);
  ellipsoid('Chest.L', [0.55, 0.62, 0.47], [-0.47, 2.32, -0.01], M.suitHi);
  ellipsoid('Chest.R', [0.55, 0.62, 0.47], [0.47, 2.32, -0.01], M.suitHi);

  // White shirt opening.
  profilePanel('ShirtBib', [
    new THREE.Vector2(-0.30, 2.92), new THREE.Vector2(0.30, 2.92),
    new THREE.Vector2(0.22, 1.62), new THREE.Vector2(-0.22, 1.62)
  ], 0.055, -0.49, M.shirt, 0.018);

  // Shirt placket/buttons.
  for (let i = 0; i < 5; i++) {
    const b = ellipsoid(`ShirtButton.${i}`, [0.035, 0.035, 0.018], [0, 1.80 + i * 0.22, -0.535], M.frame);
    b.castShadow = false;
  }

  // Blazer lapels as real panels with thickness.
  profilePanel('Lapel.L', [
    new THREE.Vector2(-0.02, 2.98), new THREE.Vector2(-0.47, 2.70),
    new THREE.Vector2(-0.28, 2.16), new THREE.Vector2(-0.08, 1.82),
    new THREE.Vector2(-0.18, 2.48)
  ], 0.07, -0.54, M.suitHi, 0.022);
  profilePanel('Lapel.R', [
    new THREE.Vector2(0.02, 2.98), new THREE.Vector2(0.47, 2.70),
    new THREE.Vector2(0.28, 2.16), new THREE.Vector2(0.08, 1.82),
    new THREE.Vector2(0.18, 2.48)
  ], 0.07, -0.54, M.suitHi, 0.022);

  // Arms: shoulder -> upper arm -> forearm, with real joint volume.
  for (const s of [-1, 1]) {
    const shoulder = ellipsoid(`Shoulder.${s}`, [0.42, 0.42, 0.42], [s * 0.96, 2.67, 0], M.suit);
    shoulder.rotation.z = s * 0.08;
    const upper = capsule(`UpperArm.${s}`, 0.29, 0.78, [s * 1.07, 2.14, -0.01], M.suit);
    upper.rotation.z = s * 0.13;
    const fore = capsule(`Forearm.${s}`, 0.255, 0.82, [s * 1.05, 1.55, -0.10], M.suit);
    fore.rotation.z = s * -0.08;
    const cuff = cylinder(`Cuff.${s}`, 0.25, 0.27, 0.18, [s * 1.03, 1.08, -0.12], M.shirt, [0, 0, 0]);
    cuff.rotation.z = s * -0.08;
  }

  // ---------------- neck + head ----------------
  cylinder('Neck', 0.29, 0.33, 0.48, [0, 3.22, 0], M.skin);

  const head = ellipsoid('Head', [0.72, 0.91, 0.63], [0, headY, -0.01], M.skin);
  head.scale.y = 1.02;

  // Jaw/chin planes.
  ellipsoid('Jaw.L', [0.38, 0.30, 0.52], [-0.30, 3.66, -0.08], M.skin);
  ellipsoid('Jaw.R', [0.38, 0.30, 0.52], [0.30, 3.66, -0.08], M.skin);
  ellipsoid('Chin', [0.27, 0.18, 0.18], [0, 3.42, -0.57], M.skinLight);

  // Ears.
  for (const s of [-1, 1]) ellipsoid(`Ear.${s}`, [0.12, 0.22, 0.10], [s * 0.70, 3.91, -0.01], M.skin);

  // Nose bridge + tip.
  tube('NoseBridge', [new THREE.Vector3(0, 4.13, -0.54), new THREE.Vector3(0, 3.89, -0.69), new THREE.Vector3(0, 3.73, -0.61)], 0.075, M.skinDark, 10);
  ellipsoid('NoseTip', [0.11, 0.10, 0.10], [0, 3.70, -0.67], M.skinLight);

  // Eyes, brows and beard shadow.
  for (const s of [-1, 1]) {
    ellipsoid(`Eye.${s}`, [0.14, 0.065, 0.035], [s * 0.265, 4.01, -0.595], M.eye);
    ellipsoid(`EyeCatch.${s}`, [0.026, 0.018, 0.008], [s * 0.285, 4.03, -0.633], M.white);
    tube(`Brow.${s}`, [new THREE.Vector3(s * 0.40, 4.19, -0.58), new THREE.Vector3(s * 0.27, 4.25, -0.60), new THREE.Vector3(s * 0.12, 4.20, -0.58)], 0.026, M.hair, 8);
  }
  ellipsoid('BeardShadow', [0.47, 0.26, 0.055], [0, 3.63, -0.58], M.skinDark);
  ellipsoid('Mouth', [0.20, 0.035, 0.022], [0, 3.50, -0.63], M.skinDark);

  // ---------------- glasses ----------------
  for (const s of [-1, 1]) {
    const lens = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.035, 48), M.glass, `Lens.${s}`);
    lens.rotation.x = Math.PI / 2;
    lens.scale.y = 0.72;
    lens.position.set(s * 0.285, 4.04, -0.66);
    lens.rotation.z = s * -0.045;

    const rim = mesh(new THREE.TorusGeometry(0.20, 0.018, 8, 48), M.frame, `Frame.${s}`);
    rim.scale.y = 0.72;
    rim.position.copy(lens.position);
    rim.rotation.copy(lens.rotation);
  }
  tube('GlassesBridge', [new THREE.Vector3(-0.10, 4.04, -0.67), new THREE.Vector3(0, 4.08, -0.70), new THREE.Vector3(0.10, 4.04, -0.67)], 0.017, M.frame, 8);
  for (const s of [-1, 1]) tube(`GlassesTemple.${s}`, [new THREE.Vector3(s * 0.48, 4.06, -0.63), new THREE.Vector3(s * 0.67, 4.08, -0.36), new THREE.Vector3(s * 0.70, 3.99, -0.08)], 0.018, M.frame, 8);

  // ---------------- hair: layered clumps, not spheres ----------------
  ellipsoid('Scalp', [0.75, 0.62, 0.64], [0, 4.49, 0.00], M.hair);
  const locks: Array<[string, THREE.Vector3[], number[]]> = [
    ['Hair.Center', [new THREE.Vector3(-0.05,4.37,-0.40),new THREE.Vector3(-0.10,4.70,-0.26),new THREE.Vector3(0.10,4.78,-0.05),new THREE.Vector3(0.18,4.60,0.02)], [0.28,0.24,0.15,0.025]],
    ['Hair.Front.L', [new THREE.Vector3(-0.18,4.35,-0.45),new THREE.Vector3(-0.43,4.55,-0.38),new THREE.Vector3(-0.55,4.68,-0.18),new THREE.Vector3(-0.48,4.46,-0.05)], [0.25,0.22,0.13,0.02]],
    ['Hair.Front.R', [new THREE.Vector3(0.12,4.39,-0.45),new THREE.Vector3(0.39,4.56,-0.34),new THREE.Vector3(0.55,4.72,-0.10),new THREE.Vector3(0.48,4.47,0.00)], [0.25,0.22,0.13,0.02]],
    ['Hair.Side.L', [new THREE.Vector3(-0.56,4.36,-0.18),new THREE.Vector3(-0.78,4.35,-0.05),new THREE.Vector3(-0.75,4.05,0.00),new THREE.Vector3(-0.64,3.86,0.04)], [0.19,0.16,0.10,0.018]],
    ['Hair.Side.R', [new THREE.Vector3(0.56,4.36,-0.18),new THREE.Vector3(0.77,4.38,-0.03),new THREE.Vector3(0.74,4.08,0.01),new THREE.Vector3(0.62,3.89,0.03)], [0.19,0.16,0.10,0.018]],
    ['Hair.Top.Back', [new THREE.Vector3(-0.42,4.45,0.10),new THREE.Vector3(-0.55,4.68,0.22),new THREE.Vector3(-0.30,4.91,0.20),new THREE.Vector3(0.02,4.96,0.16)], [0.28,0.25,0.17,0.03]],
    ['Hair.Top.Back.R', [new THREE.Vector3(0.28,4.46,0.11),new THREE.Vector3(0.50,4.69,0.22),new THREE.Vector3(0.35,4.91,0.22),new THREE.Vector3(0.08,4.98,0.14)], [0.26,0.23,0.15,0.03]],
  ];
  for (const [name, pts, widths] of locks) root.add(taperedLock(name, pts, widths, name.includes('Side') ? M.hairHi : M.hair));

  // ---------------- hands + camera ----------------
  for (const s of [-1, 1]) {
    const hand = ellipsoid(`Hand.${s}`, [0.27,0.20,0.25], [s * 0.56, 1.25, -0.66], M.skin);
    hand.rotation.z = s * 0.25;
    for (let i = 0; i < 4; i++) {
      const finger = capsule(`Finger.${s}.${i}`, 0.045, 0.18, [s * (0.47 + i * 0.055), 1.16 - (i % 2) * 0.035, -0.86], M.skinLight);
      finger.rotation.z = s * (0.15 + i * 0.03);
    }
  }

  const cam = new THREE.Group();
  cam.name = 'CameraAssembly';
  cam.position.set(0.02, 1.62, -0.73);
  cam.rotation.set(-0.10, 0.02, -0.06);
  root.add(cam);

  const body = mesh(new THREE.BoxGeometry(0.72,0.56,0.42), M.camera, 'CameraBody');
  body.position.set(0,0,0);
  cam.add(body);
  const grip = mesh(new THREE.BoxGeometry(0.18,0.45,0.28), M.cameraRubber, 'CameraGrip');
  grip.position.set(-0.36,-0.02,0.02);
  grip.rotation.z = -0.08;
  cam.add(grip);
  const prism = mesh(new THREE.BoxGeometry(0.26,0.15,0.24), M.camera, 'Viewfinder');
  prism.position.set(0,0.34,0.02);
  cam.add(prism);

  const lens = new THREE.Group();
  lens.name = 'CameraLens';
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0,-0.02,-0.34);
  cam.add(lens);
  lens.add(mesh(new THREE.CylinderGeometry(0.30,0.27,0.20,48), M.lensMetal, 'LensBarrel'));
  for (let i = 0; i < 4; i++) lens.add(mesh(new THREE.TorusGeometry(0.235 + i*0.018,0.018,8,48), i === 1 ? M.lensCoat : M.cameraRubber, `LensRing.${i}`));
  const glass = mesh(new THREE.CylinderGeometry(0.205,0.205,0.035,64), M.lensGlass, 'FrontGlass');
  glass.position.z = -0.12;
  lens.add(glass);
  const aperture = mesh(new THREE.CylinderGeometry(0.105,0.105,0.012,48), M.cameraRubber, 'Aperture');
  aperture.position.z = -0.145;
  lens.add(aperture);

  // Camera strap/edge accents.
  tube('CameraAccent', [new THREE.Vector3(-0.30,0.18,-0.23),new THREE.Vector3(0,0.27,-0.24),new THREE.Vector3(0.30,0.18,-0.23)], 0.012, M.gold, 6).position.z = 0;

  // subtle suit seam lines
  for (const s of [-1, 1]) tube(`SleeveSeam.${s}`, [new THREE.Vector3(s*0.98,2.68,-0.31),new THREE.Vector3(s*1.15,2.05,-0.32),new THREE.Vector3(s*1.08,1.35,-0.31)], 0.008, M.suitHi, 5);

  root.scale.setScalar(1.12);
  root.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return root;
}

export function setupPortraitLighting(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xffe9d4, 0x16181e, 2.0));
  const key = new THREE.DirectionalLight(0xffd0a2, 3.2);
  key.position.set(-3.5, 6.0, -4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 20;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9bbcff, 1.35);
  rim.position.set(4, 4.5, 3.5);
  scene.add(rim);

  const fill = new THREE.PointLight(0xffb477, 0.55, 8);
  fill.position.set(0, 3.0, -3.5);
  scene.add(fill);
}
