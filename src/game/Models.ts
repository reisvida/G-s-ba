import * as THREE from 'three';
import { VEHICLE_SPECS, VehicleTypeId } from '../types/game';
import { ProceduralTextureSet } from './ProceduralTextures';

// Shared geometries & materials for P13 Blue Gas Cylinders
let sharedCylinderGroup: THREE.Group | null = null;

export function createGasCylinderMesh(): THREE.Group {
  if (!sharedCylinderGroup) {
    const group = new THREE.Group();

    // Lathe profile for classic Brazilian P13 13kg LPG cylinder (height ~0.58m, radius ~0.18m)
    const pts = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.155, 0.0),
      new THREE.Vector2(0.155, 0.04),
      new THREE.Vector2(0.182, 0.07),
      new THREE.Vector2(0.185, 0.36),
      new THREE.Vector2(0.145, 0.44),
      new THREE.Vector2(0.055, 0.47),
      new THREE.Vector2(0.055, 0.51),
      new THREE.Vector2(0.0, 0.51),
    ];
    const tankGeo = new THREE.LatheGeometry(pts, 18);
    const blueTankMat = new THREE.MeshStandardMaterial({
      color: 0x1a75ff,
      roughness: 0.34,
      metalness: 0.45,
    });
    const tankMesh = new THREE.Mesh(tankGeo, blueTankMat);
    tankMesh.castShadow = true;
    tankMesh.receiveShadow = true;
    group.add(tankMesh);

    // Top protective collar (alça)
    const collarGeo = new THREE.CylinderGeometry(0.115, 0.125, 0.09, 14, 1, true);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0x155eef,
      roughness: 0.4,
      metalness: 0.5,
      side: THREE.DoubleSide,
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = 0.515;
    group.add(collar);

    // Brass valve & black safety seal
    const valveGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.06, 10);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.25,
      metalness: 0.85,
    });
    const valve = new THREE.Mesh(valveGeo, brassMat);
    valve.position.y = 0.53;
    group.add(valve);

    const capGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.022, 10);
    const capMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.8,
      metalness: 0.1,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.562;
    group.add(cap);

    sharedCylinderGroup = group;
  }

  return sharedCylinderGroup.clone();
}

export interface ArticulatedCharacter {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  carriedCylinder: THREE.Group;
  cashProp: THREE.Mesh;
  cardProp: THREE.Mesh;
}

export function createPlayerCharacter(): ArticulatedCharacter {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd99b72, roughness: 0.65, metalness: 0.05 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72, metalness: 0.08 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.12 });
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.78, metalness: 0.05 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85, metalness: 0.1 });
  const helmetMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.22, metalness: 0.6 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.1, metalness: 0.9 });

  // Torso + High-Vis Brazilian Delivery Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.26), shirtMat);
  torso.position.y = 1.12;
  torso.castShadow = true;
  root.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.28), vestMat);
  vest.position.y = 1.14;
  vest.castShadow = true;
  root.add(vest);

  // Head + Motorcycle Helmet with Tinted Visor
  const head = new THREE.Group();
  head.position.set(0, 1.48, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 10), skinMat);
  neck.position.y = 0.04;
  head.add(neck);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), helmetMat);
  helmet.position.y = 0.18;
  helmet.scale.set(0.95, 1.0, 1.08);
  helmet.castShadow = true;
  head.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.14), visorMat);
  visor.position.set(0, 0.18, 0.14);
  head.add(visor);
  root.add(head);

  // Articulated Arms
  const makeArm = (side: -1 | 1) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.31, 1.36, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), shirtMat);
    sleeve.position.y = -0.12;
    sleeve.castShadow = true;
    armGroup.add(sleeve);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), skinMat);
    forearm.position.y = -0.36;
    forearm.castShadow = true;
    armGroup.add(forearm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.13), bootMat);
    glove.position.y = -0.52;
    armGroup.add(glove);
    root.add(armGroup);
    return armGroup;
  };

  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Articulated Legs
  const makeLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.13, 0.82, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.42, 0.19), jeansMat);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.17), jeansMat);
    shin.position.y = -0.56;
    shin.castShadow = true;
    legGroup.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.24), bootMat);
    boot.position.set(0, -0.76, 0.03);
    boot.castShadow = true;
    legGroup.add(boot);
    root.add(legGroup);
    return legGroup;
  };

  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Carried P13 Cylinder in front of chest (visible when carrying!)
  const carriedCylinder = createGasCylinderMesh();
  carriedCylinder.position.set(0, 0.92, 0.36);
  carriedCylinder.scale.setScalar(0.88);
  carriedCylinder.visible = false;
  root.add(carriedCylinder);

  const cashProp = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.02, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 }),
  );
  cashProp.visible = false;
  root.add(cashProp);

  const cardProp = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.03, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35, metalness: 0.4 }),
  );
  cardProp.visible = false;
  root.add(cardProp);

  return {
    root,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    carriedCylinder,
    cashProp,
    cardProp,
  };
}

export function createCustomerNpc(): {
  root: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  shirtMat: THREE.MeshStandardMaterial;
  propCash: THREE.Mesh;
  propCard: THREE.Mesh;
} {
  const root = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc6865c, roughness: 0.65 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.24), shirtMat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), skinMat);
  head.position.y = 1.56;
  head.castShadow = true;
  root.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.162, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.set(0, 1.58, -0.01);
  root.add(hair);

  const makeLimb = (w: number, h: number, x: number, y: number, mat: THREE.Material) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    m.position.y = -h * 0.45;
    m.castShadow = true;
    g.add(m);
    root.add(g);
    return g;
  };

  const leftArm = makeLimb(0.13, 0.48, -0.3, 1.34, skinMat);
  const rightArm = makeLimb(0.13, 0.48, 0.3, 1.34, skinMat);
  const leftLeg = makeLimb(0.16, 0.78, -0.12, 0.8, pantsMat);
  const rightLeg = makeLimb(0.16, 0.78, 0.12, 0.8, pantsMat);

  const propCash = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.025, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.5 }),
  );
  propCash.position.set(0, -0.45, 0.12);
  propCash.visible = false;
  rightArm.add(propCash);

  const propCard = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.035, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.5 }),
  );
  propCard.position.set(0, -0.45, 0.14);
  propCard.visible = false;
  rightArm.add(propCard);

  return { root, leftArm, rightArm, leftLeg, rightLeg, shirtMat, propCash, propCard };
}

export interface VehicleInstance {
  root: THREE.Group;
  bodyPaintMat: THREE.MeshStandardMaterial;
  wheels: THREE.Group[];
  frontSteerWheels: THREE.Group[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  headlightBeam: THREE.SpotLight;
  cylinderMeshes: THREE.Group[];
  riderSeatAnchor: THREE.Vector3;
}

export function createVehicleMesh(
  typeId: VehicleTypeId,
  colorHex: number,
  cargoLevel: number,
  textures: ProceduralTextureSet,
): VehicleInstance {
  const spec = VEHICLE_SPECS[typeId];
  const root = new THREE.Group();

  const bodyPaintMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.28,
    metalness: 0.45,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.75,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.92,
  });
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x14161a,
    roughness: 0.88,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.62,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.5,
    roughness: 0.25,
  });

  const wheels: THREE.Group[] = [];
  const frontSteerWheels: THREE.Group[] = [];
  const headlightMeshes: THREE.Mesh[] = [];
  const taillightMeshes: THREE.Mesh[] = [];
  const cylinderSlots: { pos: THREE.Vector3; rot: THREE.Euler; scale: number }[] = [];
  const riderSeatAnchor = new THREE.Vector3(0, 0.85, 0);

  const makeWheel = (radius: number, width: number) => {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, width, 18),
      rubberMat,
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.015, 12),
      chromeMat,
    );
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width + 0.03, 10),
      darkMetalMat,
    );
    hub.rotation.z = Math.PI / 2;
    wg.add(hub);
    return wg;
  };

  if (spec.isMoto) {
    // Motorcycle (CG 125 Carga / Titan 160 Pro) - +Z is forward!
    const r = spec.wheelRadius;
    const frontWheel = makeWheel(r, 0.12);
    frontWheel.position.set(0, r, 0.68);
    root.add(frontWheel);
    wheels.push(frontWheel);
    frontSteerWheels.push(frontWheel);

    const rearWheel = makeWheel(r, 0.14);
    rearWheel.position.set(0, r, -0.66);
    root.add(rearWheel);
    wheels.push(rearWheel);

    // Frame & Engine block
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.42), chromeMat);
    engine.position.set(0, 0.46, 0.06);
    engine.castShadow = true;
    root.add(engine);

    // Exhaust pipe on right side
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.95, 10), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.18, 0.34, -0.34);
    root.add(exhaust);

    // Front Fork & Handlebars
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.68, 0.08), chromeMat);
    fork.position.set(0, 0.68, 0.56);
    fork.rotation.x = -0.28;
    root.add(fork);

    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.68, 8), darkMetalMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.02, 0.44);
    root.add(handlebar);

    // Fuel Tank (sculpted)
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.54), bodyPaintMat);
    tank.position.set(0, 0.84, 0.18);
    tank.castShadow = true;
    root.add(tank);

    // Seat
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.58), rubberMat);
    seat.position.set(0, 0.78, -0.24);
    root.add(seat);

    // Headlight & Taillight
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.1, 12), headlightMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, 0.92, 0.64);
    root.add(hl);
    headlightMeshes.push(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.06), taillightMat);
    tl.position.set(0, 0.74, -0.92);
    root.add(tl);
    taillightMeshes.push(tl);

    // Iron Rear Bagageiro (Cylinder Rack)
    const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.48), darkMetalMat);
    rackBase.position.set(0, 0.78, -0.74);
    root.add(rackBase);

    const rackBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.04), darkMetalMat);
    rackBack.position.set(0, 0.96, -0.52);
    root.add(rackBack);

    if (typeId === 'moto_simples') {
      // 2 slots: 1 upright + 1 horizontal on top (matches Image 1!)
      cylinderSlots.push(
        { pos: new THREE.Vector3(0, 0.8, -0.76), rot: new THREE.Euler(0, 0, 0), scale: 0.92 },
        { pos: new THREE.Vector3(-0.22, 1.32, -0.74), rot: new THREE.Euler(0, 0, -Math.PI / 2), scale: 0.9 },
      );
    } else {
      // Moto de Carga: side pannier racks + top rack (up to 6 slots with upgrades)
      const sideRackL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 0.46), darkMetalMat);
      sideRackL.position.set(-0.36, 0.68, -0.72);
      root.add(sideRackL);
      const sideRackR = sideRackL.clone();
      sideRackR.position.x = 0.36;
      root.add(sideRackR);

      cylinderSlots.push(
        { pos: new THREE.Vector3(-0.26, 0.56, -0.72), rot: new THREE.Euler(0, 0, 0), scale: 0.86 },
        { pos: new THREE.Vector3(0.26, 0.56, -0.72), rot: new THREE.Euler(0, 0, 0), scale: 0.86 },
        { pos: new THREE.Vector3(0, 0.8, -0.76), rot: new THREE.Euler(0, 0, 0), scale: 0.88 },
        { pos: new THREE.Vector3(-0.21, 1.3, -0.74), rot: new THREE.Euler(0, 0, -Math.PI / 2), scale: 0.86 },
        { pos: new THREE.Vector3(0, 1.05, -0.55), rot: new THREE.Euler(0, 0, 0), scale: 0.82 },
        { pos: new THREE.Vector3(-0.2, 1.56, -0.74), rot: new THREE.Euler(0, 0, -Math.PI / 2), scale: 0.82 },
      );
    }

    riderSeatAnchor.set(0, 0.78, -0.14);
  } else {
    // 4-Wheeled Vehicles: Fiorino, Kombi, Caminhão Pequeno, Caminhão Distribuidor
    const r = spec.wheelRadius;
    const halfW = spec.width * 0.46;
    const zFront = spec.length * 0.32;
    const zRear = -spec.length * 0.32;

    const wheelCoords = [
      { x: -halfW, z: zFront, steer: true },
      { x: halfW, z: zFront, steer: true },
      { x: -halfW, z: zRear, steer: false },
      { x: halfW, z: zRear, steer: false },
    ];
    if (typeId === 'caminhao_dist') {
      wheelCoords.push(
        { x: -halfW, z: zRear + 0.95, steer: false },
        { x: halfW, z: zRear + 0.95, steer: false },
      );
    }

    wheelCoords.forEach((wc) => {
      const w = makeWheel(r, 0.24);
      w.position.set(wc.x, r, wc.z);
      root.add(w);
      wheels.push(w);
      if (wc.steer) frontSteerWheels.push(w);
    });

    // Chassis frame
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(spec.width * 0.92, 0.24, spec.length * 0.94),
      darkMetalMat,
    );
    chassis.position.set(0, r + 0.08, 0);
    chassis.castShadow = true;
    root.add(chassis);

    if (typeId === 'fiorino' || typeId === 'kombi') {
      // Van body (Fiorino or Kombi)
      const isKombi = typeId === 'kombi';
      const lowerBody = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width, spec.height * 0.46, spec.length * 0.94),
        bodyPaintMat,
      );
      lowerBody.position.set(0, r + 0.18 + spec.height * 0.23, 0);
      lowerBody.castShadow = true;
      lowerBody.receiveShadow = true;
      root.add(lowerBody);

      const upperMat = isKombi
        ? new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.2 })
        : bodyPaintMat;
      const upperBody = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width * 0.96, spec.height * 0.42, isKombi ? spec.length * 0.92 : spec.length * 0.72),
        upperMat,
      );
      upperBody.position.set(
        0,
        r + 0.18 + spec.height * 0.66,
        isKombi ? 0 : -spec.length * 0.1,
      );
      upperBody.castShadow = true;
      root.add(upperBody);

      // Windshield
      const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width * 0.86, spec.height * 0.3, 0.08),
        glassMat,
      );
      windshield.position.set(
        0,
        r + 0.18 + spec.height * 0.64,
        isKombi ? spec.length * 0.46 : spec.length * 0.26,
      );
      windshield.rotation.x = -0.18;
      root.add(windshield);

      // Side windows for Kombi
      if (isKombi) {
        const sideWin = new THREE.Mesh(
          new THREE.BoxGeometry(spec.width + 0.02, spec.height * 0.24, spec.length * 0.72),
          glassMat,
        );
        sideWin.position.set(0, r + 0.18 + spec.height * 0.66, -0.1);
        root.add(sideWin);
      }

      // Roof rack for visible cylinders on Fiorino/Kombi
      const roofY = r + 0.18 + spec.height * 0.88;
      const roofRack = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width * 0.86, 0.06, spec.length * 0.62),
        darkMetalMat,
      );
      roofRack.position.set(0, roofY, -0.25);
      root.add(roofRack);

      const cols = 3;
      const rows = Math.ceil((spec.cargoCapacity + 4) / cols);
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          cylinderSlots.push({
            pos: new THREE.Vector3(
              (j - 1) * 0.44,
              roofY + 0.03,
              -0.25 + (i - (rows - 1) * 0.5) * 0.44,
            ),
            rot: new THREE.Euler(0, 0, 0),
            scale: 0.84,
          });
        }
      }
      riderSeatAnchor.set(-0.38, r + 0.55, spec.length * 0.22);
    } else {
      // Trucks: Caminhão Pequeno VUC & Caminhão Distribuidor 1620
      const cabLen = spec.length * 0.3;
      const cabZ = spec.length * 0.5 - cabLen * 0.5 - 0.1;
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width * 0.96, spec.height * 0.74, cabLen),
        bodyPaintMat,
      );
      cab.position.set(0, r + 0.2 + spec.height * 0.37, cabZ);
      cab.castShadow = true;
      root.add(cab);

      const windshield = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width * 0.86, spec.height * 0.28, 0.08),
        glassMat,
      );
      windshield.position.set(0, r + 0.2 + spec.height * 0.52, cabZ + cabLen * 0.5 + 0.01);
      root.add(windshield);

      // Open Steel Gas Cage Bed (Carroceria Gaiola)
      const bedLen = spec.length * 0.64;
      const bedZ = -spec.length * 0.5 + bedLen * 0.5 + 0.1;
      const bedY = r + 0.24;

      const bedFloor = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width, 0.12, bedLen),
        darkMetalMat,
      );
      bedFloor.position.set(0, bedY, bedZ);
      bedFloor.castShadow = true;
      bedFloor.receiveShadow = true;
      root.add(bedFloor);

      // Yellow/Blue safety cage rails
      const railMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.4,
        metalness: 0.5,
      });
      const sideRailL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, bedLen), railMat);
      sideRailL.position.set(-spec.width * 0.48, bedY + 0.46, bedZ);
      root.add(sideRailL);

      const sideRailR = sideRailL.clone();
      sideRailR.position.x = spec.width * 0.48;
      root.add(sideRailR);

      const backRail = new THREE.Mesh(new THREE.BoxGeometry(spec.width, 0.85, 0.06), railMat);
      backRail.position.set(0, bedY + 0.46, bedZ - bedLen * 0.49);
      root.add(backRail);

      // Populate cylinder slots inside the truck bed (2 layers)
      const cols = typeId === 'caminhao_dist' ? 5 : 4;
      const rows = typeId === 'caminhao_dist' ? 5 : 4;
      for (let layer = 0; layer < 2; layer++) {
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            cylinderSlots.push({
              pos: new THREE.Vector3(
                (col - (cols - 1) * 0.5) * 0.42,
                bedY + 0.06 + layer * 0.54,
                bedZ + (row - (rows - 1) * 0.5) * 0.44,
              ),
              rot: new THREE.Euler(0, 0, 0),
              scale: 0.88,
            });
          }
        }
      }

      riderSeatAnchor.set(-0.45, r + 0.72, cabZ);
    }

    // Front Headlights & Rear Taillights for 4-wheeled vehicles
    const hlY = r + 0.42;
    const hlZ = spec.length * 0.48;
    [-spec.width * 0.34, spec.width * 0.34].forEach((hx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), headlightMat);
      hl.position.set(hx, hlY, hlZ);
      root.add(hl);
      headlightMeshes.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.06), taillightMat);
      tl.position.set(hx, hlY, -hlZ);
      root.add(tl);
      taillightMeshes.push(tl);
    });
  }

  // Instantiate cylinder slots (hidden until loaded!)
  const maxPossibleSlots = Math.min(cylinderSlots.length, spec.cargoCapacity + 4);
  const cylinderMeshes: THREE.Group[] = [];
  for (let i = 0; i < maxPossibleSlots; i++) {
    const slot = cylinderSlots[i];
    const cyl = createGasCylinderMesh();
    cyl.position.copy(slot.pos);
    cyl.rotation.copy(slot.rot);
    cyl.scale.setScalar(slot.scale);
    cyl.visible = false;
    root.add(cyl);
    cylinderMeshes.push(cyl);
  }

  // Grounded radial contact shadow beneath vehicle
  const shadowGeo = new THREE.PlaneGeometry(spec.width * 1.45, spec.length * 1.3);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  // Night headlight spotlight
  const headlightBeam = new THREE.SpotLight(0xfffbeb, 0, 38, Math.PI / 5, 0.45, 1.5);
  headlightBeam.position.set(0, 1.0, spec.length * 0.48);
  const beamTarget = new THREE.Object3D();
  beamTarget.position.set(0, 0.2, spec.length * 0.5 + 14);
  root.add(headlightBeam);
  root.add(beamTarget);
  headlightBeam.target = beamTarget;

  return {
    root,
    bodyPaintMat,
    wheels,
    frontSteerWheels,
    headlightMeshes,
    taillightMeshes,
    headlightBeam,
    cylinderMeshes,
    riderSeatAnchor,
  };
}

export type TrafficVehicleVariant = 'hatch' | 'sedan' | 'suv' | 'pickup' | 'van' | 'bus';

export function createTrafficVehicleMesh(variant: TrafficVehicleVariant): {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  taillightMat: THREE.MeshStandardMaterial;
  length: number;
  width: number;
} {
  const root = new THREE.Group();
  const wheels: THREE.Mesh[] = [];

  const palette = [
    0x3b82f6, // blue
    0xef4444, // red
    0x10b981, // emerald
    0xf59e0b, // amber
    0x64748b, // slate
    0xf8fafc, // white
    0xdc2626, // crimson
    0x0ea5e9, // sky
    0x334155, // charcoal
    0xeab308, // taxi yellow
  ];
  const color = palette[Math.floor(Math.random() * palette.length)];

  const paintMat = new THREE.MeshStandardMaterial({
    color: variant === 'bus' ? 0x0284c7 : color,
    roughness: 0.32,
    metalness: 0.4,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.15, metalness: 0.35 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });

  const dims =
    variant === 'bus'
      ? { w: 2.35, h: 2.75, l: 8.4, r: 0.48 }
      : variant === 'pickup'
        ? { w: 1.86, h: 1.68, l: 4.75, r: 0.38 }
        : variant === 'van'
          ? { w: 1.86, h: 2.12, l: 4.85, r: 0.36 }
          : variant === 'suv'
            ? { w: 1.84, h: 1.72, l: 4.5, r: 0.36 }
            : variant === 'hatch'
              ? { w: 1.68, h: 1.44, l: 3.8, r: 0.31 }
              : { w: 1.76, h: 1.46, l: 4.3, r: 0.33 };

  // Lower chassis body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w, dims.h * 0.48, dims.l),
    paintMat,
  );
  body.position.y = dims.r + dims.h * 0.24;
  body.castShadow = true;
  root.add(body);

  // Front & rear dark bumpers
  const bumperGeo = new THREE.BoxGeometry(dims.w * 1.02, 0.18, 0.14);
  const frontBumper = new THREE.Mesh(bumperGeo, darkMat);
  frontBumper.position.set(0, dims.r + 0.08, dims.l * 0.5 + 0.02);
  root.add(frontBumper);

  const rearBumper = new THREE.Mesh(bumperGeo, darkMat);
  rearBumper.position.set(0, dims.r + 0.08, -dims.l * 0.5 - 0.02);
  root.add(rearBumper);

  // Cabin geometry tailored to vehicle type
  const cabinLen =
    variant === 'pickup'
      ? dims.l * 0.42
      : variant === 'bus'
        ? dims.l * 0.96
        : variant === 'van' || variant === 'suv'
          ? dims.l * 0.68
          : variant === 'hatch'
            ? dims.l * 0.62
            : dims.l * 0.54;
  const cabinZ =
    variant === 'pickup'
      ? dims.l * 0.15
      : variant === 'hatch' || variant === 'suv' || variant === 'van'
        ? -dims.l * 0.08
        : -dims.l * 0.04;

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w * 0.92, dims.h * 0.44, cabinLen),
    variant === 'bus'
      ? new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
      : paintMat,
  );
  cabin.position.set(0, dims.r + dims.h * 0.68, cabinZ);
  cabin.castShadow = true;
  root.add(cabin);

  // Greenhouse glass
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(dims.w * 0.94, dims.h * 0.28, cabinLen * 0.95),
    glassMat,
  );
  win.position.set(0, dims.r + dims.h * 0.7, cabinZ);
  root.add(win);

  // Bus illuminated route header on front roof
  if (variant === 'bus') {
    const ledSign = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.24, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    ledSign.position.set(0, dims.r + dims.h * 0.86, dims.l * 0.48 + 0.02);
    root.add(ledSign);
  }

  // Headlights & Taillights
  [-dims.w * 0.34, dims.w * 0.34].forEach((lx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.06), headlightMat);
    hl.position.set(lx, dims.r + dims.h * 0.32, dims.l * 0.5 + 0.01);
    root.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.06), taillightMat);
    tl.position.set(lx, dims.r + dims.h * 0.34, -dims.l * 0.5 - 0.01);
    root.add(tl);
  });

  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(dims.r, dims.r, 0.22, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  [
    [-dims.w * 0.46, dims.l * 0.32],
    [dims.w * 0.46, dims.l * 0.32],
    [-dims.w * 0.46, -dims.l * 0.32],
    [dims.w * 0.46, -dims.l * 0.32],
  ].forEach(([wx, wz]) => {
    const wm = new THREE.Mesh(wheelGeo, darkMat);
    wm.position.set(wx, dims.r, wz);
    root.add(wm);
    wheels.push(wm);
  });

  return { root, wheels, taillightMat, length: dims.l, width: dims.w };
}
