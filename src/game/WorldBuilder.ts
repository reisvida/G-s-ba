import * as THREE from 'three';
import { createGasCylinderMesh } from './Models';
import { ProceduralTextureSet } from './ProceduralTextures';
import {
  AMBIENT_BUILDINGS,
  BuildingBlock,
  CUSTOMER_HOUSES,
  groundHeightAt,
  ROAD_SEGMENTS,
  SPEED_BUMPS,
  WORLD_POIS,
} from './WorldLayout';

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  isNarrowAlleyWall?: boolean;
}

export interface CircleCollider {
  x: number;
  z: number;
  radius: number;
}

export interface BuiltWorld {
  colliders: BuildingCollider[];
  circleColliders: CircleCollider[];
  asphaltMat: THREE.MeshStandardMaterial;
  dirtMat: THREE.MeshStandardMaterial;
  windowMat: THREE.MeshStandardMaterial;
  streetLampMat: THREE.MeshStandardMaterial;
  beaconGroup: THREE.Group;
  beaconRing: THREE.Mesh;
  gpsLine: THREE.Line;
  updateGpsRoute: (fromX: number, fromZ: number, toX: number, toZ: number, active: boolean) => void;
  updateWeatherVisuals: (isRaining: boolean, nightFactor: number, dt: number, camPos: THREE.Vector3) => void;
  spawnBurstParticles: (x: number, y: number, z: number, colorHex: number, count?: number) => void;
  updateParticles: (dt: number) => void;
}

function createSubdividedRibbonGeometry(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  width: number,
  yOffset: number,
  segments = 24,
): THREE.BufferGeometry {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const halfW = width * 0.5;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const cx = x1 + dx * t;
    const cz = z1 + dz * t;

    const lx = cx - nx * halfW;
    const lz = cz - nz * halfW;
    const rx = cx + nx * halfW;
    const rz = cz + nz * halfW;

    const ly = groundHeightAt(lx, lz) + yOffset;
    const ry = groundHeightAt(rx, rz) + yOffset;

    positions.push(lx, ly, lz, rx, ry, rz);
    const vCoord = (len * t) / 14;
    uvs.push(0, vCoord, 1, vCoord);

    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildOpenWorld(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
): BuiltWorld {
  const colliders: BuildingCollider[] = [];
  const circleColliders: CircleCollider[] = [];

  // 1. Continuous Open-World Terrain
  const terrainSize = 1120;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, 112, 112);
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cGrass = new THREE.Color(0x567d46);
  const cHill = new THREE.Color(0x7c6a43);
  const cUrban = new THREE.Color(0x6c7566);
  const tmpColor = new THREE.Color();

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = groundHeightAt(vx, vz);
    posAttr.setY(i, vy);

    if (vy > 1.5) {
      const t = Math.min(1, (vy - 1.5) / 9);
      tmpColor.copy(cGrass).lerp(cHill, t);
    } else if (Math.abs(vx) < 220 && Math.abs(vz) < 240) {
      tmpColor.copy(cUrban);
    } else {
      tmpColor.copy(cGrass);
    }
    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  scene.add(terrainMesh);

  // 2. Road Network & Sidewalks
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltMap,
    roughness: 0.82,
    metalness: 0.06,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const alleyMat = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    roughness: 0.88,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const dirtMat = new THREE.MeshStandardMaterial({
    map: textures.dirtMap,
    roughness: 0.94,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalkMap,
    roughness: 0.86,
    metalness: 0.04,
  });

  ROAD_SEGMENTS.forEach((seg) => {
    const isAlley = seg.surface === 'alley';
    const mat =
      seg.surface === 'dirt'
        ? dirtMat
        : isAlley
          ? alleyMat
          : asphaltMat;

    const roadGeo = createSubdividedRibbonGeometry(
      seg.x1,
      seg.z1,
      seg.x2,
      seg.z2,
      seg.width,
      isAlley ? 0.055 : 0.045,
      26,
    );
    const roadMesh = new THREE.Mesh(roadGeo, mat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    if (seg.hasSidewalk) {
      const swGeo = createSubdividedRibbonGeometry(
        seg.x1,
        seg.z1,
        seg.x2,
        seg.z2,
        seg.width + 3.4,
        0.025,
        26,
      );
      const swMesh = new THREE.Mesh(swGeo, sidewalkMat);
      swMesh.receiveShadow = true;
      scene.add(swMesh);
    }
  });

  // Speed Bumps (Lombadas)
  const sbMat = new THREE.MeshStandardMaterial({
    map: textures.speedBumpMap,
    roughness: 0.75,
  });
  SPEED_BUMPS.forEach((sb) => {
    const geo = new THREE.CylinderGeometry(0.28, 0.28, sb.width, 10, 1, false, 0, Math.PI);
    geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, sbMat);
    mesh.position.set(sb.x, groundHeightAt(sb.x, sb.z) + 0.02, sb.z);
    mesh.rotation.y = sb.yaw;
    mesh.scale.set(1, 0.42, 1.8);
    scene.add(mesh);
  });

  // Shared Architectural Materials
  const roofMat = new THREE.MeshStandardMaterial({
    map: textures.roofTileMap,
    roughness: 0.82,
    metalness: 0.05,
  });
  const brickMat = new THREE.MeshStandardMaterial({
    map: textures.brickMap,
    roughness: 0.88,
    metalness: 0.04,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.08,
    roughness: 0.2,
    metalness: 0.4,
  });
  const waterTankMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.38,
    metalness: 0.15,
  });
  const darkIronMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    roughness: 0.55,
    metalness: 0.7,
  });
  const streetLampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 0.1,
    roughness: 0.25,
  });

  // Helper to construct a Brazilian building with pitched roof, windows, door, water tank, and collider
  const addBrazilianBuilding = (cfg: {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    yaw: number;
    wallColor: number;
    useBrick?: boolean;
    hasPitchedRoof?: boolean;
    hasWaterTank?: boolean;
    signText?: string;
    signBg?: string;
    signFg?: string;
    isCustomer?: boolean;
  }) => {
    const group = new THREE.Group();
    const gy = groundHeightAt(cfg.x, cfg.z);
    group.position.set(cfg.x, gy, cfg.z);
    group.rotation.y = cfg.yaw;

    const wallMat = cfg.useBrick
      ? brickMat
      : new THREE.MeshStandardMaterial({
          color: cfg.wallColor,
          roughness: 0.82,
          metalness: 0.04,
        });

    const body = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), wallMat);
    body.position.y = cfg.h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Pitched terracotta roof or flat concrete laje
    if (cfg.hasPitchedRoof !== false) {
      const roofH = Math.min(2.2, cfg.w * 0.22);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(cfg.w, cfg.d) * 0.76, roofH, 4),
        roofMat,
      );
      roof.position.y = cfg.h + roofH * 0.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
    }

    // Iconic Brazilian blue fiberglass rooftop water tank (Caixa d'água)
    if (cfg.hasWaterTank) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.62, 1.15, 12), waterTankMat);
      tank.position.set(cfg.w * 0.25, cfg.h + 0.6, -cfg.d * 0.22);
      tank.castShadow = true;
      group.add(tank);

      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.76, 0.12, 12), waterTankMat);
      lid.position.set(cfg.w * 0.25, cfg.h + 1.2, -cfg.d * 0.22);
      group.add(lid);
    }

    // Front Door (facing +Z in local space)
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.25, 0.12), darkIronMat);
    door.position.set(0, 1.125, cfg.d * 0.5 + 0.02);
    group.add(door);

    // Windows on front & sides
    const winGeo = new THREE.BoxGeometry(1.45, 1.15, 0.1);
    [-cfg.w * 0.28, cfg.w * 0.28].forEach((wx) => {
      if (Math.abs(wx) + 0.9 < cfg.w * 0.5) {
        const w1 = new THREE.Mesh(winGeo, windowMat);
        w1.position.set(wx, 2.2, cfg.d * 0.5 + 0.02);
        group.add(w1);

        if (cfg.h > 6.2) {
          const w2 = new THREE.Mesh(winGeo, windowMat);
          w2.position.set(wx, 4.9, cfg.d * 0.5 + 0.02);
          group.add(w2);
        }
      }
    });

    // Front yard low wall & gate for residential customer houses
    if (cfg.isCustomer) {
      const muroMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
      const muroL = new THREE.Mesh(new THREE.BoxGeometry(cfg.w * 0.36, 1.35, 0.22), muroMat);
      muroL.position.set(-cfg.w * 0.32, 0.675, cfg.d * 0.5 + 2.2);
      group.add(muroL);

      const muroR = muroL.clone();
      muroR.position.x = cfg.w * 0.32;
      group.add(muroR);

      const gate = new THREE.Mesh(new THREE.BoxGeometry(cfg.w * 0.26, 1.45, 0.12), darkIronMat);
      gate.position.set(0, 0.725, cfg.d * 0.5 + 2.2);
      group.add(gate);
    }

    // Commercial Signboard
    if (cfg.signText) {
      const signTex = textures.createSignTexture(
        cfg.signText,
        cfg.signBg || '#1e293b',
        cfg.signFg || '#facc15',
      );
      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(cfg.w * 0.88, 9.5), 1.45, 0.18),
        new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 }),
      );
      signMesh.position.set(0, Math.min(cfg.h - 0.8, 4.2), cfg.d * 0.5 + 0.12);
      group.add(signMesh);
    }

    scene.add(group);

    // Axis-aligned world collider (accounting for 90-deg rotations & customer front walls)
    const rot90 = Math.abs(Math.sin(cfg.yaw)) > 0.7;
    const halfX = (rot90 ? cfg.d : cfg.w) * 0.52;
    const halfZ = (rot90 ? cfg.w : cfg.d) * 0.52;
    const fwdX = Math.sin(cfg.yaw);
    const fwdZ = Math.cos(cfg.yaw);
    const wallExtra = cfg.isCustomer ? 2.25 : 0;

    colliders.push({
      minX: cfg.x - halfX + Math.min(0, fwdX * wallExtra),
      maxX: cfg.x + halfX + Math.max(0, fwdX * wallExtra),
      minZ: cfg.z - halfZ + Math.min(0, fwdZ * wallExtra),
      maxZ: cfg.z + halfZ + Math.max(0, fwdZ * wallExtra),
    });
  };

  // 3. Build All Customer Houses
  CUSTOMER_HOUSES.forEach((ch) => {
    const isRest = ch.buildingType === 'restaurante';
    const isCom = ch.buildingType === 'comercio';
    const isSob = ch.buildingType === 'sobrado' || ch.buildingType === 'mansao';
    const w = ch.buildingType === 'mansao' ? 15 : isRest || isCom ? 12.5 : 9.5;
    const d = ch.buildingType === 'mansao' ? 12 : 9.0;
    const h = isSob ? 6.8 : isRest ? 5.6 : 4.4;

    addBrazilianBuilding({
      x: ch.houseX,
      z: ch.houseZ,
      w,
      d,
      h,
      yaw: ch.yaw,
      wallColor: ch.wallColor,
      useBrick: ch.district === 'morro' && Math.random() > 0.45,
      hasPitchedRoof: ch.buildingType !== 'comercio',
      hasWaterTank: ch.buildingType !== 'mansao',
      signText: isRest || isCom ? ch.name.toUpperCase() : undefined,
      signBg: isRest ? '#991b1b' : '#1e3a8a',
      signFg: '#fef08a',
      isCustomer: !isRest && !isCom,
    });
  });

  // 4. Build Ambient Neighborhood Buildings
  AMBIENT_BUILDINGS.forEach((b: BuildingBlock, idx: number) => {
    addBrazilianBuilding({
      x: b.x,
      z: b.z,
      w: b.width,
      d: b.depth,
      h: b.height,
      yaw: b.yaw,
      wallColor: b.wallColor,
      useBrick: b.style === 'casa' && idx % 3 === 1,
      hasPitchedRoof: b.style !== 'predio' && b.style !== 'galpao',
      hasWaterTank: b.hasWaterTank,
      signText: b.signText,
      signBg: b.style === 'galpao' ? '#ea580c' : '#0f172a',
      signFg: '#f8fafc',
    });
  });

  // 5. Build Special Landmarks (Depósito São Jorge, Postos, Oficinas, Atacadão, Radares)
  // A) Depósito São Jorge (Matriz) at (-124, 88)
  {
    const depotGroup = new THREE.Group();
    depotGroup.position.set(-124, 0, 88);

    // Paved concrete yard + driveway apron connecting to Av. São Jorge
    const yard = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 }),
    );
    yard.position.set(-4, 0.06, 0);
    yard.receiveShadow = true;
    depotGroup.add(yard);

    // Warehouse building with iconic orange fascia (inspired by Image 1!)
    const whBody = new THREE.Mesh(
      new THREE.BoxGeometry(11, 5.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72 }),
    );
    whBody.position.set(-4.5, 2.6, 0);
    whBody.castShadow = true;
    whBody.receiveShadow = true;
    depotGroup.add(whBody);

    const orangeFascia = new THREE.Mesh(
      new THREE.BoxGeometry(11.8, 1.1, 16.8),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45 }),
    );
    orangeFascia.position.set(-4.5, 5.5, 0);
    orangeFascia.castShadow = true;
    depotGroup.add(orangeFascia);

    // Roll-up steel doors
    [-4, 4].forEach((dz) => {
      const shutter = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 3.6, 4.2),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5, metalness: 0.6 }),
      );
      shutter.position.set(1.05, 1.8, dz);
      depotGroup.add(shutter);
    });

    // Signboard
    const signTex = textures.createSignTexture('DEPÓSITO SÃO JORGE · GÁS P13', '#0f172a', '#f97316');
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.4, 11),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 }),
    );
    sign.position.set(1.45, 5.5, 0);
    depotGroup.add(sign);

    // Outdoor steel cylinder cage with stacked blue 3D P13 cylinders
    const cageFloor = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.18, 6.4),
      darkIronMat,
    );
    cageFloor.position.set(4.5, 0.15, -5.5);
    depotGroup.add(cageFloor);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const cyl = createGasCylinderMesh();
        cyl.position.set(3.6 + c * 0.85, 0.24, -7.2 + r * 1.1);
        depotGroup.add(cyl);
      }
    }

    // Glowing cyan/amber loading bay pad on ground
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.2, 28),
      new THREE.MeshBasicMaterial({
        color: 0x06b6d4,
        side: THREE.DoubleSide,
      }),
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.set(4.2, 0.15, 3.5);
    depotGroup.add(padRing);

    scene.add(depotGroup);

    colliders.push({
      minX: -124 - 10,
      maxX: -124 + 1.2,
      minZ: 88 - 8.2,
      maxZ: 88 + 8.2,
    });
    // Outdoor steel cylinder cage collider
    colliders.push({
      minX: -124 + 2.4,
      maxX: -124 + 6.6,
      minZ: 88 - 8.7,
      maxZ: 88 - 2.3,
    });
  }

  // B) Gas Stations (Postos de Combustível), Workshops & Wholesale Plant
  WORLD_POIS.forEach((poi) => {
    const gy = groundHeightAt(poi.x, poi.z);

    if (poi.type === 'gas_station') {
      const g = new THREE.Group();
      g.position.set(poi.x, gy, poi.z);

      const pad = new THREE.Mesh(
        new THREE.BoxGeometry(16, 0.12, 14),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 }),
      );
      pad.position.y = 0.06;
      pad.receiveShadow = true;
      g.add(pad);

      // Canopy roof (PetroBrasil Yellow & Green)
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(13, 0.75, 10),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 }),
      );
      canopy.position.set(0, 4.6, 0);
      canopy.castShadow = true;
      g.add(canopy);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(13.2, 0.3, 10.2),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 }),
      );
      trim.position.set(0, 4.15, 0);
      g.add(trim);

      // 4 Canopy Pillars & 2 Fuel Dispensers
      [
        [-4.5, -3.2],
        [4.5, -3.2],
        [-4.5, 3.2],
        [4.5, 3.2],
      ].forEach(([px, pz]) => {
        const pil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.25, 4.2, 10),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
        );
        pil.position.set(px, 2.1, pz);
        pil.castShadow = true;
        g.add(pil);
      });

      [-2.2, 2.2].forEach((bx) => {
        const pump = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 1.85, 0.65),
          new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 }),
        );
        pump.position.set(bx, 1.0, 0);
        pump.castShadow = true;
        g.add(pump);
      });

      const refuelRing = new THREE.Mesh(
        new THREE.RingGeometry(2.4, 2.9, 24),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }),
      );
      refuelRing.rotation.x = -Math.PI / 2;
      refuelRing.position.set(0, 0.14, 3.2);
      g.add(refuelRing);

      scene.add(g);

      // Fuel pump islands & canopy pillar colliders
      [-2.2, 2.2].forEach((bx) => {
        colliders.push({
          minX: poi.x + bx - 0.55,
          maxX: poi.x + bx + 0.55,
          minZ: poi.z - 0.45,
          maxZ: poi.z + 0.45,
        });
      });
      [
        [-4.5, -3.2],
        [4.5, -3.2],
        [-4.5, 3.2],
        [4.5, 3.2],
      ].forEach(([px, pz]) => {
        circleColliders.push({ x: poi.x + px, z: poi.z + pz, radius: 0.32 });
      });
    } else if (poi.type === 'workshop') {
      addBrazilianBuilding({
        x: poi.x,
        z: poi.z,
        w: 13,
        d: 11,
        h: 5.2,
        yaw: 0,
        wallColor: 0x334155,
        hasPitchedRoof: false,
        hasWaterTank: true,
        signText: poi.name.toUpperCase(),
        signBg: '#ea580c',
        signFg: '#ffffff',
      });

      const repairRing = new THREE.Mesh(
        new THREE.RingGeometry(2.3, 2.8, 24),
        new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide }),
      );
      repairRing.rotation.x = -Math.PI / 2;
      repairRing.position.set(poi.x, gy + 0.08, poi.z + 7.5);
      scene.add(repairRing);
    } else if (poi.type === 'wholesale') {
      addBrazilianBuilding({
        x: poi.x,
        z: poi.z,
        w: 20,
        d: 15,
        h: 7.5,
        yaw: 0,
        wallColor: 0xf1f5f9,
        hasPitchedRoof: false,
        hasWaterTank: false,
        signText: 'ATACADÃO DO GÁS · ENVASE',
        signBg: '#1d4ed8',
        signFg: '#facc15',
      });

      // Giant industrial LPG storage sphere beside plant
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.5 }),
      );
      sphere.position.set(poi.x - 14, gy + 4.8, poi.z);
      sphere.castShadow = true;
      scene.add(sphere);
      circleColliders.push({ x: poi.x - 14, z: poi.z, radius: 4.3 });

      const buyRing = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 3.4, 24),
        new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide }),
      );
      buyRing.rotation.x = -Math.PI / 2;
      buyRing.position.set(poi.x, gy + 0.08, poi.z + 10);
      scene.add(buyRing);
    } else if (poi.type === 'speed_camera') {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 5.2, 8),
        darkIronMat,
      );
      pole.position.set(poi.x + 6.2, gy + 2.6, poi.z);
      pole.castShadow = true;
      scene.add(pole);

      const camBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.55, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }),
      );
      camBox.position.set(poi.x + 6.2, gy + 5.1, poi.z);
      scene.add(camBox);
    }
  });

  // 6. Concrete Utility Poles (Postes) & Overhead Electrical Wires
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.85 });
  const polePositions: THREE.Vector3[] = [];
  const avenueXs = [-240, -150, -50, 50, 150];
  const streetZs = [-260, -160, -60, 40, 140, 240];

  avenueXs.forEach((px) => {
    streetZs.forEach((pz) => {
      if (px === -240 && pz === 240) return;
      const wx = px + 6.2;
      const wz = pz + 6.2;
      const wy = groundHeightAt(wx, wz);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 7.2, 8), poleMat);
      pole.position.set(wx, wy + 3.6, wz);
      pole.castShadow = true;
      scene.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.12), poleMat);
      arm.position.set(wx - 0.5, wy + 6.9, wz);
      scene.add(arm);

      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), streetLampMat);
      bulb.position.set(wx - 1.1, wy + 6.75, wz);
      scene.add(bulb);

      polePositions.push(new THREE.Vector3(wx, wy + 6.8, wz));
      circleColliders.push({ x: wx, z: wz, radius: 0.26 });
    });
  });

  // Overhead power cables connecting adjacent poles (authentic Brazilian street silhouette!)
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.65 });
  for (let i = 0; i < polePositions.length; i++) {
    for (let j = i + 1; j < polePositions.length; j++) {
      const a = polePositions[i];
      const b = polePositions[j];
      const dist = a.distanceTo(b);
      if (dist > 85 && dist < 112) {
        const mid = a.clone().add(b).multiplyScalar(0.5);
        mid.y -= 1.35; // natural catenary sag
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const wireGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(8));
        scene.add(new THREE.Line(wireGeo, wireMat));
      }
    }
  }

  // 7. Instanced Tropical Trees (Ipê-Amarelo & Neighborhood Shade Trees)
  const treeCoords: { x: number; z: number; scale: number; isIpe: boolean }[] = [];
  for (let x = -340; x <= 320; x += 28) {
    for (let z = -320; z <= 300; z += 28) {
      // Skip if near any road or building
      const nearRoad = ROAD_SEGMENTS.some((s) => {
        const minX = Math.min(s.x1, s.x2) - s.width * 0.9;
        const maxX = Math.max(s.x1, s.x2) + s.width * 0.9;
        const minZ = Math.min(s.z1, s.z2) - s.width * 0.9;
        const maxZ = Math.max(s.z1, s.z2) + s.width * 0.9;
        return x >= minX && x <= maxX && z >= minZ && z <= maxZ;
      });
      const nearCollider = colliders.some(
        (c) => x >= c.minX - 5 && x <= c.maxX + 5 && z >= c.minZ - 5 && z <= c.maxZ + 5,
      );
      const nearPoi = WORLD_POIS.some((p) => Math.hypot(x - p.x, z - p.z) < 18);

      if (!nearRoad && !nearCollider && !nearPoi && Math.random() > 0.35) {
        treeCoords.push({
          x: x + (Math.random() - 0.5) * 8,
          z: z + (Math.random() - 0.5) * 8,
          scale: 0.85 + Math.random() * 0.45,
          isIpe: Math.random() > 0.68,
        });
      }
    }
  }

  if (treeCoords.length > 0) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 3.2, 7);
    trunkGeo.translate(0, 1.6, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
    trunkInst.castShadow = true;

    const crownGeo = new THREE.IcosahedronGeometry(2.15, 1);
    crownGeo.translate(0, 4.3, 0);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const crownInst = new THREE.InstancedMesh(crownGeo, crownMat, treeCoords.length);
    crownInst.castShadow = true;

    const dummy = new THREE.Object3D();
    const colGreen1 = new THREE.Color(0x2d6a4f);
    const colGreen2 = new THREE.Color(0x40916c);
    const colIpeYellow = new THREE.Color(0xfacc15);

    treeCoords.forEach((tc, i) => {
      const ty = groundHeightAt(tc.x, tc.z);
      dummy.position.set(tc.x, ty, tc.z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.setScalar(tc.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);
      crownInst.setMatrixAt(i, dummy.matrix);

      crownInst.setColorAt(
        i,
        tc.isIpe ? colIpeYellow : i % 2 === 0 ? colGreen1 : colGreen2,
      );
      circleColliders.push({ x: tc.x, z: tc.z, radius: 0.42 * tc.scale });
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownInst.computeBoundingSphere();

    scene.add(trunkInst);
    scene.add(crownInst);
  }

  // 8. 3D Floating Delivery Waypoint Beacon & GPS Route Ribbon
  const beaconGroup = new THREE.Group();
  const beaconCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 2.2, 16),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  );
  beaconCone.rotation.x = Math.PI;
  beaconCone.position.y = 4.5;
  beaconGroup.add(beaconCone);

  const beaconCyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 1.3, 16),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85 }),
  );
  beaconCyl.position.y = 6.2;
  beaconGroup.add(beaconCyl);

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.75, 28),
    new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide }),
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.14;
  beaconGroup.add(beaconRing);
  beaconGroup.visible = false;
  scene.add(beaconGroup);

  // GPS Route Ribbon (0.6m wide 3D path strip along terrain)
  const gpsSegments = 32;
  const gpsPositions = new Float32Array((gpsSegments + 1) * 2 * 3);
  const gpsIndices: number[] = [];
  for (let i = 0; i < gpsSegments; i++) {
    const b = i * 2;
    gpsIndices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const gpsGeo = new THREE.BufferGeometry();
  gpsGeo.setAttribute('position', new THREE.BufferAttribute(gpsPositions, 3));
  gpsGeo.setIndex(gpsIndices);

  const gpsLine = new THREE.Mesh(
    gpsGeo,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  ) as unknown as THREE.Line;
  gpsLine.visible = false;
  gpsLine.frustumCulled = false;
  scene.add(gpsLine);

  const updateGpsRoute = (
    fromX: number,
    fromZ: number,
    toX: number,
    toZ: number,
    active: boolean,
  ) => {
    beaconGroup.visible = active;
    gpsLine.visible = active;
    if (!active) return;

    const ty = groundHeightAt(toX, toZ);
    beaconGroup.position.set(toX, ty, toZ);

    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * 0.32;
    const nz = (dx / len) * 0.32;

    const pos = gpsGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= gpsSegments; i++) {
      const t = i / gpsSegments;
      const cx = THREE.MathUtils.lerp(fromX, toX, t);
      const cz = THREE.MathUtils.lerp(fromZ, toZ, t);
      const cy = groundHeightAt(cx, cz) + 0.16;
      pos.setXYZ(i * 2, cx - nx, cy, cz - nz);
      pos.setXYZ(i * 2 + 1, cx + nx, cy, cz + nz);
    }
    pos.needsUpdate = true;
  };

  // 9. Instanced 3D Rain Particles (650 streaks)
  const rainCount = 650;
  const rainGeo = new THREE.BoxGeometry(0.035, 1.35, 0.035);
  const rainMat = new THREE.MeshBasicMaterial({
    color: 0xcbd5e1,
    transparent: true,
    opacity: 0.55,
  });
  const rainInst = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainInst.frustumCulled = false;
  rainInst.visible = false;
  scene.add(rainInst);

  const rainOffsets = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainOffsets[i * 3] = (Math.random() - 0.5) * 65;
    rainOffsets[i * 3 + 1] = Math.random() * 28;
    rainOffsets[i * 3 + 2] = (Math.random() - 0.5) * 65;
  }

  // 10. Pooled Burst Particles (dust, collision sparks, cash sparkles)
  const maxParticles = 60;
  const partGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const partInst = new THREE.InstancedMesh(partGeo, partMat, maxParticles);
  partInst.frustumCulled = false;
  scene.add(partInst);

  const particles: {
    active: boolean;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    color: THREE.Color;
  }[] = [];
  for (let i = 0; i < maxParticles; i++) {
    particles.push({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.6,
      color: new THREE.Color(0xffffff),
    });
  }

  const pDummy = new THREE.Object3D();

  const spawnBurstParticles = (
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count = 12,
  ) => {
    let spawned = 0;
    for (let i = 0; i < maxParticles && spawned < count; i++) {
      const p = particles[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 0.6;
        p.y = y + Math.random() * 0.5;
        p.z = z + (Math.random() - 0.5) * 0.6;
        p.vx = (Math.random() - 0.5) * 7;
        p.vy = 2.5 + Math.random() * 5;
        p.vz = (Math.random() - 0.5) * 7;
        p.life = 0;
        p.maxLife = 0.45 + Math.random() * 0.35;
        p.color.setHex(colorHex);
        partInst.setColorAt(i, p.color);
        spawned++;
      }
    }
    if (partInst.instanceColor) partInst.instanceColor.needsUpdate = true;
  };

  const updateParticles = (dt: number) => {
    for (let i = 0; i < maxParticles; i++) {
      const p = particles[i];
      if (!p.active) {
        pDummy.position.set(0, -100, 0);
        pDummy.scale.setScalar(0.001);
        pDummy.updateMatrix();
        partInst.setMatrixAt(i, pDummy.matrix);
        continue;
      }
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.vy -= 14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const s = 1 - p.life / p.maxLife;
      pDummy.position.set(p.x, p.y, p.z);
      pDummy.rotation.set(p.life * 4, p.life * 3, 0);
      pDummy.scale.setScalar(s);
      pDummy.updateMatrix();
      partInst.setMatrixAt(i, pDummy.matrix);
    }
    partInst.instanceMatrix.needsUpdate = true;
  };

  const rDummy = new THREE.Object3D();
  let beaconTime = 0;

  const updateWeatherVisuals = (
    isRaining: boolean,
    nightFactor: number,
    dt: number,
    camPos: THREE.Vector3,
  ) => {
    beaconTime += dt;
    if (beaconGroup.visible) {
      beaconGroup.children[0].position.y = 4.3 + Math.sin(beaconTime * 4) * 0.35;
      beaconGroup.children[0].rotation.y = beaconTime * 2.2;
      beaconGroup.children[1].position.y = 6.0 + Math.sin(beaconTime * 4) * 0.35;
      beaconGroup.children[1].rotation.y = -beaconTime * 1.6;
      const ringScale = 1 + Math.sin(beaconTime * 4) * 0.12;
      beaconRing.scale.setScalar(ringScale);
    }

    // Wet asphalt sheen during rain
    const targetRoughness = isRaining ? 0.22 : 0.82;
    asphaltMat.roughness = THREE.MathUtils.lerp(asphaltMat.roughness, targetRoughness, dt * 1.5);
    asphaltMat.envMapIntensity = isRaining ? 1.8 : 0.65;

    // Warm window & streetlamp glow at night
    windowMat.emissiveIntensity = THREE.MathUtils.lerp(0.06, 1.35, nightFactor);
    streetLampMat.emissiveIntensity = THREE.MathUtils.lerp(0.1, 2.2, nightFactor);

    // Rain particle streaks
    rainInst.visible = isRaining;
    if (isRaining) {
      for (let i = 0; i < rainCount; i++) {
        let ry = rainOffsets[i * 3 + 1] - 26 * dt;
        if (ry < 0) ry = 26;
        rainOffsets[i * 3 + 1] = ry;

        rDummy.position.set(
          camPos.x + rainOffsets[i * 3],
          camPos.y - 6 + ry,
          camPos.z + rainOffsets[i * 3 + 2],
        );
        rDummy.updateMatrix();
        rainInst.setMatrixAt(i, rDummy.matrix);
      }
      rainInst.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    colliders,
    circleColliders,
    asphaltMat,
    dirtMat,
    windowMat,
    streetLampMat,
    beaconGroup,
    beaconRing,
    gpsLine,
    updateGpsRoute,
    updateWeatherVisuals,
    spawnBurstParticles,
    updateParticles,
  };
}
