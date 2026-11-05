import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ActiveDeliveryPhase,
  CameraMode,
  CompanyState,
  DeliveryOrder,
  DistrictId,
  GameStateMode,
  HudSnapshot,
  INITIAL_BRANCHES,
  INITIAL_EMPLOYEES,
  InteractionPrompt,
  MissionType,
  NotificationToast,
  OwnedVehicleState,
  PaymentMethod,
  PROGRESSION_LEVELS,
  RandomEventType,
  DEPOT_UPGRADE_TIERS,
  VEHICLE_SPECS,
  VehicleTypeId,
  WeatherType,
  DISTRICT_NAMES,
} from '../types/game';
import { AudioEngine } from './AudioEngine';
import {
  ArticulatedCharacter,
  createCustomerNpc,
  createPlayerCharacter,
  createTrafficVehicleMesh,
  createVehicleMesh,
  VehicleInstance,
} from './Models';
import { createProceduralTextures, ProceduralTextureSet } from './ProceduralTextures';
import { BuiltWorld, buildOpenWorld } from './WorldBuilder';
import {
  CUSTOMER_HOUSES,
  getDistrictAt,
  groundHeightAt,
  groundNormalAt,
  ROAD_SEGMENTS,
  WORLD_HALF_SIZE,
  WORLD_POIS,
} from './WorldLayout';

const SAVE_STORAGE_KEY = 'gas_delivery_sim_save_v1';

// Pre-allocated math helpers (Zero GC in render loop)
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _tmpVec = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _slopeQuat = new THREE.Quaternion();
const _yawQuat = new THREE.Quaternion();
const _finalQuat = new THREE.Quaternion();
const _normalOut = { x: 0, y: 1, z: 0 };

interface TrafficEdge {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  dirX: number;
  dirZ: number;
  len: number;
  width: number;
  speedLimitMs: number;
  fromNode: string;
  toNode: string;
  isDepotSpur: boolean;
}

interface TrafficAgent {
  mesh: THREE.Group;
  wheels: THREE.Mesh[];
  taillightMat: THREE.MeshStandardMaterial;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  maxSpeed: number;
  edgeIndex: number;
  t: number;
  length: number;
  width: number;
  stunTimer: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onToast: (toast: Omit<NotificationToast, 'id'>) => void;
  onLevelUp: (newLevel: number, title: string, perk: string) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private textures: ProceduralTextureSet;
  private world: BuiltWorld;
  public audio: AudioEngine;

  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private lastTickTime = performance.now();

  // Lighting rig
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;

  // Game Mode & Progression State
  private mode: GameStateMode = 'TITLE_MENU';
  private money = 350;
  private xp = 0;
  private level = 1;
  private gameTimeMinutes = 870; // 14:30 afternoon
  private dayCount = 1;
  private weather: WeatherType = 'ensolarado';
  private weatherTimer = 95;
  private activeEvent: RandomEventType = 'none';
  private activeEventTimer = 0;

  // Player & Vehicle State
  private inVehicle = true;
  private activeVehicleId: VehicleTypeId = 'moto_simples';
  private ownedVehicles: Record<VehicleTypeId, OwnedVehicleState>;
  private vehicleMeshes: Partial<Record<VehicleTypeId, VehicleInstance>> = {};
  private playerChar: ArticulatedCharacter;
  private customerNpc: ReturnType<typeof createCustomerNpc>;

  private playerX = -114;
  private playerZ = 88;
  private playerYaw = Math.PI; // facing north out the depot driveway onto Rua das Flores
  private playerVy = 0;
  private playerOnGround = true;
  private carryingOnFoot = false;

  // Vehicle Dynamics
  private speedMs = 0;
  private steerAngle = 0;
  private wheelSpin = 0;
  private leanAngle = 0;
  private hitstopTimer = 0;
  private cameraShake = 0;
  private fineCooldown = 0;

  // Camera Orbit & Presets
  private cameraMode: CameraMode = 'chase_far';
  private camYawOffset = 0;
  private camPitch = 0.14;
  private camZoom = 1.0;
  private camManualTimer = 0;
  private snapCameraNextFrame = true;
  private isPointerDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private titleOrbitAngle = 0.45;

  // Input State (Continuous held vs Edge-triggered justPressed)
  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private touchJoyX = 0;
  private touchJoyY = 0;
  private touchThrottle = false;
  private touchBrake = false;
  private touchHandbrake = false;

  // Delivery & Mission State
  private availableOrders: DeliveryOrder[] = [];
  private activeOrder: DeliveryOrder | null = null;
  private deliveryPhase: ActiveDeliveryPhase | null = null;
  private animTimer = 0;
  private wasInVehicleBeforeAnim = false;
  private customWaypoint: { x: number; z: number; label: string } | null = null;
  private lastDeliverySummary: HudSnapshot['lastDeliverySummary'] = null;

  // Company & Fleet State
  private company: CompanyState;
  private companyCycleTimer = 0;

  // Traffic Graph & Agents
  private trafficEdges: TrafficEdge[] = [];
  private outgoingEdgesByNode = new Map<string, number[]>();
  private trafficAgents: TrafficAgent[] = [];

  // Sync timers
  private hudSyncTimer = 0;
  private saveTimer = 0;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.audio = new AudioEngine();

    // 1. Software WebGL Detection (Three.js Skill Standard)
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // WebGL context loss safety
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    // 3. Scene, Camera & Studio Environment Reflections
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x93c5fd, 0.0022);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x7dd3fc);

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.25, 680);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    // 4. Balanced Warm/Cool 3-Point Outdoor Lighting Rig
    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x78553a, 0.75);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    this.sunLight.position.set(90, 140, 80);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const d = 85;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 360;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 5. Procedural Textures & Open World
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.world = buildOpenWorld(this.scene, this.textures);

    // 6. Initialize State & Load Autosave if available
    this.ownedVehicles = this.createDefaultVehicles();
    this.company = this.createDefaultCompany();
    this.loadFromStorage();

    // 7. Create Articulated Player, Customer NPC & Active Vehicle Mesh
    this.playerChar = createPlayerCharacter();
    this.scene.add(this.playerChar.root);

    this.customerNpc = createCustomerNpc();
    this.customerNpc.root.visible = false;
    this.scene.add(this.customerNpc.root);

    this.ensureVehicleMesh(this.activeVehicleId);
    this.syncVehicleVisuals();

    // 8. Spawn AI Traffic & Company Fleet
    this.spawnTrafficAgents();

    // 9. Populate Initial Orders & Starter Mission
    this.refreshAvailableOrders();
    if (!this.activeOrder && this.availableOrders.length > 0) {
      // Auto-assign a friendly starter delivery on new career so the player has an immediate objective!
      if (this.company.totalDeliveriesCompleted === 0 && this.xp === 0) {
        const starter = this.availableOrders[0];
        this.acceptOrder(starter.id, true);
      }
    }

    // 10. Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 11. Bind Events, Render Immediate Frame & Start Loop
    this.bindEvents();
    this.updateTitleShowcase(0);
    this.renderer.render(this.scene, this.camera);
    this.pushHudSnapshot();
    this.tick();
  }

  private createDefaultVehicles(): Record<VehicleTypeId, OwnedVehicleState> {
    const result = {} as Record<VehicleTypeId, OwnedVehicleState>;
    (Object.keys(VEHICLE_SPECS) as VehicleTypeId[]).forEach((id) => {
      const spec = VEHICLE_SPECS[id];
      result[id] = {
        typeId: id,
        colorHex: spec.defaultColor,
        engineLevel: 1,
        cargoLevel: 1,
        fuel: 100,
        health: 100,
        x: -114,
        y: 0,
        z: 88,
        yaw: Math.PI,
        loadedCylinders: id === 'moto_simples' ? 1 : 0,
      };
    });
    return result;
  }

  private createDefaultCompany(): CompanyState {
    return {
      depotLevel: 1,
      stockFull: 8,
      stockEmpty: 2,
      maxStock: DEPOT_UPGRADE_TIERS[0].maxStock,
      employees: INITIAL_EMPLOYEES.map((e) => ({ ...e })),
      branches: INITIAL_BRANCHES.map((b) => ({ ...b })),
      totalDeliveriesCompleted: 0,
      totalRevenue: 0,
      lastCycleProfit: 0,
    };
  }

  public hasSavedGame(): boolean {
    try {
      return Boolean(localStorage.getItem(SAVE_STORAGE_KEY));
    } catch {
      return false;
    }
  }

  private saveToStorage(): void {
    try {
      const payload = {
        money: this.money,
        xp: this.xp,
        level: this.level,
        gameTimeMinutes: this.gameTimeMinutes,
        dayCount: this.dayCount,
        inVehicle: this.inVehicle,
        activeVehicleId: this.activeVehicleId,
        playerX: this.playerX,
        playerZ: this.playerZ,
        playerYaw: this.playerYaw,
        ownedVehicles: this.ownedVehicles,
        ownedIds: this.getOwnedVehicleIds(),
        company: this.company,
      };
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota/storage restrictions
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') this.money = data.money;
      if (typeof data.xp === 'number') this.xp = data.xp;
      if (typeof data.level === 'number') this.level = data.level;
      if (typeof data.gameTimeMinutes === 'number') this.gameTimeMinutes = data.gameTimeMinutes;
      if (typeof data.dayCount === 'number') this.dayCount = data.dayCount;
      if (typeof data.inVehicle === 'boolean') this.inVehicle = data.inVehicle;
      if (data.activeVehicleId && VEHICLE_SPECS[data.activeVehicleId as VehicleTypeId]) {
        this.activeVehicleId = data.activeVehicleId;
      }
      if (typeof data.playerX === 'number') this.playerX = data.playerX;
      if (typeof data.playerZ === 'number') this.playerZ = data.playerZ;
      if (typeof data.playerYaw === 'number') this.playerYaw = data.playerYaw;
      if (Array.isArray(data.ownedIds)) {
        data.ownedIds.forEach((id: VehicleTypeId) => {
          if (VEHICLE_SPECS[id]) this.ownedSet.add(id);
        });
      }
      if (data.ownedVehicles) {
        (Object.keys(VEHICLE_SPECS) as VehicleTypeId[]).forEach((id) => {
          if (data.ownedVehicles[id]) {
            this.ownedVehicles[id] = {
              ...this.ownedVehicles[id],
              ...data.ownedVehicles[id],
            };
          }
        });
      }
      if (data.company) {
        this.company = {
          ...this.company,
          ...data.company,
          employees: INITIAL_EMPLOYEES.map((def) => {
            const saved = data.company.employees?.find((e: { id: string }) => e.id === def.id);
            return saved ? { ...def, hired: Boolean(saved.hired) } : { ...def };
          }),
          branches: INITIAL_BRANCHES.map((def) => {
            const saved = data.company.branches?.find((b: { id: string }) => b.id === def.id);
            return saved ? { ...def, owned: Boolean(saved.owned) } : { ...def };
          }),
        };
      }
    } catch {
      // Ignore corrupt save
    }
  }

  public resetCareer(): void {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // Ignore
    }
    this.money = 350;
    this.xp = 0;
    this.level = 1;
    this.gameTimeMinutes = 870;
    this.dayCount = 1;
    this.weather = 'ensolarado';
    this.activeEvent = 'none';
    this.inVehicle = true;
    this.activeVehicleId = 'moto_simples';
    this.ownedSet = new Set<VehicleTypeId>(['moto_simples']);
    this.ownedVehicles = this.createDefaultVehicles();
    this.company = this.createDefaultCompany();
    this.playerX = -114;
    this.playerZ = 88;
    this.playerYaw = Math.PI;
    this.speedMs = 0;
    this.carryingOnFoot = false;
    this.activeOrder = null;
    this.deliveryPhase = null;
    this.lastDeliverySummary = null;

    // Remove non-starter vehicle meshes
    (Object.keys(this.vehicleMeshes) as VehicleTypeId[]).forEach((id) => {
      if (id !== 'moto_simples' && this.vehicleMeshes[id]) {
        this.scene.remove(this.vehicleMeshes[id]!.root);
        delete this.vehicleMeshes[id];
      }
    });
    this.ensureVehicleMesh('moto_simples');
    this.syncVehicleVisuals();
    this.refreshAvailableOrders();
    if (this.availableOrders.length > 0) {
      this.acceptOrder(this.availableOrders[0].id, true);
    }
    this.mode = 'PLAYING';
    this.snapCameraNextFrame = true;
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  private ensureVehicleMesh(typeId: VehicleTypeId): VehicleInstance {
    if (!this.vehicleMeshes[typeId]) {
      const vState = this.ownedVehicles[typeId];
      const inst = createVehicleMesh(typeId, vState.colorHex, vState.cargoLevel, this.textures);
      this.scene.add(inst.root);
      this.vehicleMeshes[typeId] = inst;
    }
    return this.vehicleMeshes[typeId]!;
  }

  private getMaxCargoCapacity(typeId: VehicleTypeId): number {
    const spec = VEHICLE_SPECS[typeId];
    const vState = this.ownedVehicles[typeId];
    const bonus = vState.cargoLevel === 2 ? 1 : vState.cargoLevel === 3 ? 2 : 0;
    return spec.cargoCapacity + bonus;
  }

  private syncVehicleVisuals(): void {
    // Only show the currently selected active vehicle in the world (and hide others cleanly)
    (Object.keys(this.vehicleMeshes) as VehicleTypeId[]).forEach((id) => {
      const inst = this.vehicleMeshes[id];
      if (!inst) return;
      inst.root.visible = id === this.activeVehicleId;
    });

    const vState = this.ownedVehicles[this.activeVehicleId];
    const inst = this.ensureVehicleMesh(this.activeVehicleId);
    inst.root.visible = true;
    inst.bodyPaintMat.color.setHex(vState.colorHex);

    // Update visible 3D P13 blue gas cylinders mounted on the vehicle!
    inst.cylinderMeshes.forEach((cm, idx) => {
      cm.visible = idx < vState.loadedCylinders;
    });
  }

  private buildTrafficNetwork(): void {
    const asphaltSegs = ROAD_SEGMENTS.filter((s) => s.surface === 'asphalt');
    this.trafficEdges = [];
    this.outgoingEdgesByNode.clear();

    const nodeKey = (x: number, z: number) => `${Math.round(x)}_${Math.round(z)}`;
    const addEdge = (edge: TrafficEdge) => {
      const idx = this.trafficEdges.length;
      this.trafficEdges.push(edge);
      const list = this.outgoingEdgesByNode.get(edge.fromNode) || [];
      list.push(idx);
      this.outgoingEdgesByNode.set(edge.fromNode, list);
    };

    asphaltSegs.forEach((seg) => {
      const isVertical = Math.abs(seg.x2 - seg.x1) < 0.5;
      const splitTs = new Set<number>([0, 1]);

      asphaltSegs.forEach((other) => {
        if (other.id === seg.id) return;
        const otherVert = Math.abs(other.x2 - other.x1) < 0.5;
        if (isVertical === otherVert) return;

        if (isVertical) {
          const minX = Math.min(other.x1, other.x2);
          const maxX = Math.max(other.x1, other.x2);
          const minZ = Math.min(seg.z1, seg.z2);
          const maxZ = Math.max(seg.z1, seg.z2);
          if (seg.x1 >= minX - 0.5 && seg.x1 <= maxX + 0.5 && other.z1 >= minZ - 0.5 && other.z1 <= maxZ + 0.5) {
            const t = (other.z1 - seg.z1) / (seg.z2 - seg.z1);
            if (t > 0.001 && t < 0.999) splitTs.add(Number(t.toFixed(5)));
          }
        } else {
          const minZ = Math.min(other.z1, other.z2);
          const maxZ = Math.max(other.z1, other.z2);
          const minX = Math.min(seg.x1, seg.x2);
          const maxX = Math.max(seg.x1, seg.x2);
          if (seg.z1 >= minZ - 0.5 && seg.z1 <= maxZ + 0.5 && other.x1 >= minX - 0.5 && other.x1 <= maxX + 0.5) {
            const t = (other.x1 - seg.x1) / (seg.x2 - seg.x1);
            if (t > 0.001 && t < 0.999) splitTs.add(Number(t.toFixed(5)));
          }
        }
      });

      const sorted = Array.from(splitTs).sort((a, b) => a - b);
      const isDepotSpur = seg.id === 'ns_deposito_acesso';

      for (let i = 0; i < sorted.length - 1; i++) {
        const t1 = sorted[i];
        const t2 = sorted[i + 1];
        if (t2 - t1 < 0.002) continue;

        const ax = THREE.MathUtils.lerp(seg.x1, seg.x2, t1);
        const az = THREE.MathUtils.lerp(seg.z1, seg.z2, t1);
        const bx = THREE.MathUtils.lerp(seg.x1, seg.x2, t2);
        const bz = THREE.MathUtils.lerp(seg.z1, seg.z2, t2);
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz);
        if (len < 6) continue;

        const dirX = dx / len;
        const dirZ = dz / len;
        const speedLimitMs = seg.speedLimit / 3.6;

        addEdge({
          x1: ax,
          z1: az,
          x2: bx,
          z2: bz,
          dirX,
          dirZ,
          len,
          width: seg.width,
          speedLimitMs,
          fromNode: nodeKey(ax, az),
          toNode: nodeKey(bx, bz),
          isDepotSpur,
        });

        addEdge({
          x1: bx,
          z1: bz,
          x2: ax,
          z2: az,
          dirX: -dirX,
          dirZ: -dirZ,
          len,
          width: seg.width,
          speedLimitMs,
          fromNode: nodeKey(bx, bz),
          toNode: nodeKey(ax, az),
          isDepotSpur,
        });
      }
    });
  }

  private spawnTrafficAgents(): void {
    this.buildTrafficNetwork();

    const variants: ('hatch' | 'sedan' | 'suv' | 'pickup' | 'van' | 'bus')[] = [
      'hatch',
      'sedan',
      'suv',
      'pickup',
      'hatch',
      'van',
      'sedan',
      'bus',
    ];
    const cityEdgeIndices = this.trafficEdges
      .map((e, idx) => ({ e, idx }))
      .filter((item) => !item.e.isDepotSpur)
      .map((item) => item.idx);

    if (cityEdgeIndices.length === 0) return;

    const totalVehicles = 32;
    for (let i = 0; i < totalVehicles; i++) {
      const edgeIndex = cityEdgeIndices[(i * 3) % cityEdgeIndices.length];
      const edge = this.trafficEdges[edgeIndex];
      const variant = variants[i % variants.length];
      const built = createTrafficVehicleMesh(variant);
      this.scene.add(built.root);

      const t = 0.15 + ((i * 0.23) % 0.72);
      const rightX = -edge.dirZ;
      const rightZ = edge.dirX;
      const laneOffset = edge.width * 0.24;
      const x = edge.x1 + (edge.x2 - edge.x1) * t + rightX * laneOffset;
      const z = edge.z1 + (edge.z2 - edge.z1) * t + rightZ * laneOffset;
      const yaw = Math.atan2(edge.dirX, edge.dirZ);

      built.root.position.set(x, groundHeightAt(x, z), z);
      built.root.rotation.set(0, yaw, 0);

      const baseCruising =
        variant === 'bus'
          ? Math.min(edge.speedLimitMs, 11.2)
          : Math.min(edge.speedLimitMs, 13.5 + (i % 4) * 1.3);

      this.trafficAgents.push({
        mesh: built.root,
        wheels: built.wheels,
        taillightMat: built.taillightMat,
        x,
        z,
        yaw,
        speed: baseCruising * 0.65,
        maxSpeed: baseCruising,
        edgeIndex,
        t,
        length: built.length,
        width: built.width,
        stunTimer: 0,
      });
    }
  }

  // --- Public Controls for React UI ---

  public setMode(newMode: GameStateMode): void {
    this.audio.unlock();
    const prevMode = this.mode;
    this.mode = newMode;
    this.heldKeys.clear();
    if (newMode === 'PLAYING') {
      this.lastTickTime = performance.now();
      if (prevMode === 'TITLE_MENU') {
        this.snapCameraNextFrame = true;
      }
    }
    this.pushHudSnapshot();
  }

  public cycleCameraMode(): void {
    const order: CameraMode[] = ['chase_far', 'chase_close', 'hood', 'top_down'];
    const nextIdx = (order.indexOf(this.cameraMode) + 1) % order.length;
    this.cameraMode = order[nextIdx];
    this.camYawOffset = 0;
    this.pushHudSnapshot();
  }

  public toggleMute(): void {
    this.audio.setMuted(!this.audio.muted);
    this.pushHudSnapshot();
  }

  public toggleMusic(): void {
    this.audio.setMusicEnabled(!this.audio.musicEnabled);
    this.pushHudSnapshot();
  }

  public setTimePreset(hour: number): void {
    this.gameTimeMinutes = hour * 60;
    this.pushHudSnapshot();
  }

  public setWeatherPreset(w: WeatherType): void {
    this.weather = w;
    this.weatherTimer = 110;
    this.pushHudSnapshot();
  }

  public setTouchJoystick(jx: number, jy: number): void {
    this.touchJoyX = jx;
    this.touchJoyY = jy;
  }

  public setTouchPedals(throttle: boolean, brake: boolean, handbrake: boolean): void {
    this.touchThrottle = throttle;
    this.touchBrake = brake;
    this.touchHandbrake = handbrake;
  }

  public triggerInteract(): void {
    this.audio.unlock();
    this.justPressedKeys.add('KeyE');
  }

  public triggerHorn(): void {
    this.audio.unlock();
    const spec = VEHICLE_SPECS[this.activeVehicleId];
    this.audio.playHorn(spec.isMoto);
    // Nearby traffic yields slightly when honked at
    this.trafficAgents.forEach((ag) => {
      if (Math.hypot(ag.x - this.playerX, ag.z - this.playerZ) < 24) {
        ag.speed *= 0.45;
      }
    });
  }

  public toggleVehicleMount(): void {
    this.audio.unlock();
    if (this.deliveryPhase && this.deliveryPhase !== 'TO_DEPOT' && this.deliveryPhase !== 'TO_CUSTOMER') {
      return;
    }
    const vState = this.ownedVehicles[this.activeVehicleId];
    if (this.inVehicle) {
      // Dismount beside vehicle
      this.inVehicle = false;
      this.speedMs = 0;
      const sideAngle = vState.yaw + Math.PI / 2;
      this.playerX = vState.x + Math.sin(sideAngle) * 1.45;
      this.playerZ = vState.z + Math.cos(sideAngle) * 1.45;
      this.playerYaw = vState.yaw;
      this.camYawOffset = 0;
      this.pushHudSnapshot();
    } else {
      const dist = Math.hypot(this.playerX - vState.x, this.playerZ - vState.z);
      if (dist <= 4.2) {
        // If carrying cylinder on foot, load it onto vehicle as we mount!
        if (this.carryingOnFoot) {
          const maxCap = this.getMaxCargoCapacity(this.activeVehicleId);
          if (vState.loadedCylinders < maxCap) {
            vState.loadedCylinders++;
            this.carryingOnFoot = false;
            this.audio.playCylinderClank();
          }
        }
        this.inVehicle = true;
        this.playerX = vState.x;
        this.playerZ = vState.z;
        this.playerYaw = vState.yaw;
        this.camYawOffset = 0;
        this.pushHudSnapshot();
      } else {
        this.callbacks.onToast({
          title: 'Veículo distante',
          detail: 'Aproxime-se do seu veículo para embarcar.',
          tone: 'warning',
        });
      }
    }
  }

  // --- Orders & Missions ---

  public refreshAvailableOrders(): void {
    const unlockedHouses = CUSTOMER_HOUSES.filter((h) => {
      const reqLv =
        h.district === 'jardim'
          ? 4
          : h.district === 'industrial' || h.district === 'rodovia'
            ? 3
            : h.district === 'morro'
              ? 2
              : 1;
      return reqLv <= this.level;
    });

    const pool = unlockedHouses.length >= 4 ? unlockedHouses : CUSTOMER_HOUSES.slice(0, 6);
    const orders: DeliveryOrder[] = [];
    const maxCap = this.getMaxCargoCapacity(this.activeVehicleId);

    for (let i = 0; i < 6; i++) {
      const house = pool[(i * 3 + Math.floor(Math.random() * pool.length)) % pool.length];
      const distMeters = Math.round(Math.hypot(house.dropX - this.playerX, house.dropZ - this.playerZ));
      const mType: MissionType =
        i === 0 && this.company.totalDeliveriesCompleted === 0
          ? 'padrao'
          : house.preferredMissionTypes[i % house.preferredMissionTypes.length];

      let cylindersRequired = 1;
      if (mType === 'multiplos' || mType === 'restaurante') {
        cylindersRequired = Math.min(Math.max(2, maxCap), 2 + Math.floor(Math.random() * 3));
      }

      const isUrgent = mType === 'urgente' || mType === 'emergencia' || this.activeEvent === 'cliente_impaciente';
      const isVip = mType === 'vip';
      const rainBonus = this.weather === 'chuva' ? 1.35 : 1.0;
      const lvMult = PROGRESSION_LEVELS[this.level - 1].rewardMultiplier;

      const basePerCyl = isVip ? 68 : mType === 'emergencia' ? 75 : mType === 'restaurante' ? 52 : 42;
      const distBonus = Math.round(distMeters * 0.14);
      const reward = Math.round(
        (cylindersRequired * basePerCyl + distBonus) *
          (isUrgent ? 1.35 : 1.0) *
          rainBonus *
          lvMult,
      );

      const timeLimitSec = Math.round(
        Math.max(65, (distMeters / 8.5 + 48) * (isUrgent ? 0.75 : 1.15)),
      );

      const missionLabels: Record<MissionType, string> = {
        padrao: 'Entrega Residencial',
        urgente: 'Entrega Urgente',
        distante: 'Bairro Distante',
        viela: 'Rua Estreita / Viela',
        chuva: 'Entrega na Chuva',
        multiplos: 'Múltiplos Botijões',
        vip: 'Cliente VIP',
        restaurante: 'Reabastecimento Comercial',
        emergencia: 'Emergência Sem Gás',
      };

      const paymentMethod: PaymentMethod = Math.random() > 0.42 ? 'dinheiro' : 'cartao';

      orders.push({
        id: `ord_${Date.now()}_${i}_${Math.floor(Math.random() * 999)}`,
        clientName: house.clientName,
        address: house.address,
        district: house.district,
        districtName: DISTRICT_NAMES[house.district],
        missionType: mType,
        missionLabel: missionLabels[mType],
        productLabel:
          cylindersRequired === 1
            ? '1x Botijão P13 (13kg)'
            : `${cylindersRequired}x Botijões P13`,
        cylindersRequired,
        reward,
        xpReward: Math.round(45 + cylindersRequired * 22 + distMeters * 0.08),
        timeLimitSec,
        timeRemainingSec: timeLimitSec,
        paymentMethod,
        targetX: house.dropX,
        targetZ: house.dropZ,
        distanceMeters: distMeters,
        unlockLevel: 1,
        isNarrowAlley: house.isNarrowAlley,
      });
    }

    this.availableOrders = orders;
    this.pushHudSnapshot();
  }

  public acceptOrder(orderId: string, silent = false): void {
    this.audio.unlock();
    const found = this.availableOrders.find((o) => o.id === orderId);
    if (!found) return;

    this.activeOrder = { ...found };
    this.customWaypoint = null;
    this.availableOrders = this.availableOrders.filter((o) => o.id !== orderId);

    const vState = this.ownedVehicles[this.activeVehicleId];
    const totalCarried = vState.loadedCylinders + (this.carryingOnFoot ? 1 : 0);

    if (totalCarried >= found.cylindersRequired) {
      this.deliveryPhase = 'TO_CUSTOMER';
      if (!silent) {
        this.callbacks.onToast({
          title: `Pedido aceito: ${found.clientName}`,
          detail: `Você já tem botijões carregados! Siga para ${found.address}.`,
          tone: 'success',
        });
      }
    } else {
      this.deliveryPhase = 'TO_DEPOT';
      if (!silent) {
        this.callbacks.onToast({
          title: `Pedido aceito: ${found.clientName}`,
          detail: `Retire ${found.cylindersRequired} botijão(ões) no Depósito e entregue em ${found.districtName}.`,
          tone: 'info',
        });
      }
    }
    this.pushHudSnapshot();
  }

  public cancelActiveOrder(): void {
    if (!this.activeOrder) return;
    this.activeOrder = null;
    this.deliveryPhase = null;
    this.customerNpc.root.visible = false;
    this.callbacks.onToast({
      title: 'Entrega cancelada',
      detail: 'Escolha um novo pedido no celular.',
      tone: 'warning',
    });
    this.pushHudSnapshot();
  }

  public setCustomWaypoint(x: number, z: number, label: string): void {
    this.customWaypoint = { x, z, label };
    this.pushHudSnapshot();
  }

  // --- Smartphone Company, Garage & Service Actions ---

  public buyWholesaleStock(qty: number): void {
    this.audio.unlock();
    const costPerUnit = 62;
    const space = this.company.maxStock - this.company.stockFull;
    const actualQty = Math.min(qty, space);
    if (actualQty <= 0) {
      this.callbacks.onToast({
        title: 'Estoque do depósito cheio',
        detail: 'Expanda o depósito na aba Empresa para armazenar mais botijões.',
        tone: 'warning',
      });
      return;
    }
    const totalCost = actualQty * costPerUnit;
    if (this.money < totalCost) {
      this.callbacks.onToast({
        title: 'Dinheiro insuficiente',
        detail: `Necessário R$ ${totalCost} para comprar ${actualQty} botijões.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= totalCost;
    this.company.stockFull += actualQty;
    this.company.stockEmpty = Math.max(0, this.company.stockEmpty - actualQty);
    this.audio.playPayment(false);
    this.callbacks.onToast({
      title: `+${actualQty} Botijões no estoque`,
      detail: `Investimento de R$ ${totalCost} (R$ ${costPerUnit}/un).`,
      tone: 'success',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public upgradeDepot(): void {
    this.audio.unlock();
    const nextTier = DEPOT_UPGRADE_TIERS.find((t) => t.level === this.company.depotLevel + 1);
    if (!nextTier) return;
    if (this.money < nextTier.upgradeCost) {
      this.callbacks.onToast({
        title: 'Saldo insuficiente',
        detail: `Necessário R$ ${nextTier.upgradeCost} para expandir para ${nextTier.name}.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= nextTier.upgradeCost;
    this.company.depotLevel = nextTier.level;
    this.company.maxStock = nextTier.maxStock;
    this.audio.playLevelUp();
    this.callbacks.onToast({
      title: `Depósito expandido: ${nextTier.name}`,
      detail: `Capacidade de estoque aumentada para ${nextTier.maxStock} botijões!`,
      tone: 'success',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public hireEmployee(empId: string): void {
    this.audio.unlock();
    if (this.level < 3) {
      this.callbacks.onToast({
        title: 'Nível 3 necessário',
        detail: 'Alcance o Nível 3 (Dono de Pequeno Depósito) para contratar entregadores.',
        tone: 'warning',
      });
      return;
    }
    const emp = this.company.employees.find((e) => e.id === empId);
    if (!emp || emp.hired) return;
    if (this.money < emp.hireCost) {
      this.callbacks.onToast({
        title: 'Saldo insuficiente',
        detail: `Contratação custa R$ ${emp.hireCost}.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= emp.hireCost;
    emp.hired = true;
    this.audio.playPayment(true);
    this.callbacks.onToast({
      title: `${emp.name} contratado!`,
      detail: `Entregas automáticas gerando +R$ ${emp.dailyNetProfit}/ciclo.`,
      tone: 'success',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public buyBranch(branchId: string): void {
    this.audio.unlock();
    const br = this.company.branches.find((b) => b.id === branchId);
    if (!br || br.owned) return;
    if (this.money < br.price) {
      this.callbacks.onToast({
        title: 'Saldo insuficiente',
        detail: `A filial custa R$ ${br.price}.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= br.price;
    br.owned = true;
    this.audio.playLevelUp();
    this.callbacks.onToast({
      title: `${br.name} adquirida!`,
      detail: `Novo ponto de retirada e +R$ ${br.dailyIncome}/ciclo de lucro passivo.`,
      tone: 'success',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public selectOrBuyVehicle(typeId: VehicleTypeId): void {
    this.audio.unlock();
    const spec = VEHICLE_SPECS[typeId];
    const vState = this.ownedVehicles[typeId];
    const isUnlocked = this.level >= spec.unlockLevel;

    if (!isUnlocked) {
      this.callbacks.onToast({
        title: `Requer Nível ${spec.unlockLevel}`,
        detail: `Suba de nível realizando entregas para desbloquear ${spec.name}.`,
        tone: 'warning',
      });
      return;
    }

    // Check if already owned (moto_simples is always owned; others owned if price === 0 or purchased)
    const alreadyOwned = this.isVehicleOwned(typeId);
    if (!alreadyOwned) {
      if (this.money < spec.price) {
        this.callbacks.onToast({
          title: 'Dinheiro insuficiente',
          detail: `${spec.name} custa R$ ${spec.price.toLocaleString('pt-BR')}.`,
          tone: 'danger',
        });
        return;
      }
      this.money -= spec.price;
      this.markVehicleOwned(typeId, true);
      this.audio.playLevelUp();
      this.callbacks.onToast({
        title: `Novo veículo: ${spec.name}!`,
        detail: `Capacidade para ${spec.cargoCapacity} botijões de gás.`,
        tone: 'success',
      });
    }

    // Switch active vehicle at current position
    const prevState = this.ownedVehicles[this.activeVehicleId];
    vState.x = prevState.x;
    vState.z = prevState.z;
    vState.yaw = prevState.yaw;
    // Transfer loaded cylinders up to new capacity
    const maxCap = this.getMaxCargoCapacity(typeId);
    const transferred = Math.min(prevState.loadedCylinders, maxCap);
    const leftover = prevState.loadedCylinders - transferred;
    if (leftover > 0) {
      this.company.stockFull = Math.min(this.company.maxStock, this.company.stockFull + leftover);
    }
    prevState.loadedCylinders = 0;
    vState.loadedCylinders = transferred;

    this.activeVehicleId = typeId;
    this.inVehicle = true;
    this.speedMs = 0;
    this.ensureVehicleMesh(typeId);
    this.syncVehicleVisuals();
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  private ownedSet = new Set<VehicleTypeId>(['moto_simples']);

  private isVehicleOwned(typeId: VehicleTypeId): boolean {
    if (typeId === 'moto_simples') return true;
    const v = this.ownedVehicles[typeId];
    return this.ownedSet.has(typeId) || v.engineLevel > 1 || v.cargoLevel > 1 || v.loadedCylinders > 0;
  }

  private markVehicleOwned(typeId: VehicleTypeId, owned: boolean): void {
    if (owned) this.ownedSet.add(typeId);
    else this.ownedSet.delete(typeId);
  }

  public sellVehicle(typeId: VehicleTypeId): void {
    this.audio.unlock();
    if (typeId === 'moto_simples') {
      this.callbacks.onToast({
        title: 'Veículo inicial',
        detail: 'A Moto CG 125 inicial não pode ser vendida.',
        tone: 'warning',
      });
      return;
    }
    if (!this.isVehicleOwned(typeId)) return;

    const spec = VEHICLE_SPECS[typeId];
    const refund = Math.round(spec.price * 0.7);
    this.money += refund;
    this.markVehicleOwned(typeId, false);
    this.ownedVehicles[typeId].engineLevel = 1;
    this.ownedVehicles[typeId].cargoLevel = 1;

    if (this.activeVehicleId === typeId) {
      this.selectOrBuyVehicle('moto_simples');
    }
    this.audio.playPayment(false);
    this.callbacks.onToast({
      title: `Veículo vendido (+R$ ${refund})`,
      detail: `${spec.name} vendido por 70% do valor.`,
      tone: 'info',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public customizeVehicleColor(colorHex: number): void {
    this.audio.unlock();
    const cost = 120;
    const vState = this.ownedVehicles[this.activeVehicleId];
    if (vState.colorHex === colorHex) return;
    if (this.money < cost) {
      this.callbacks.onToast({
        title: 'Saldo insuficiente',
        detail: `Pintura personalizada custa R$ ${cost}.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= cost;
    vState.colorHex = colorHex;
    this.syncVehicleVisuals();
    this.audio.playPayment(true);
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public upgradeVehiclePart(part: 'engine' | 'cargo'): void {
    this.audio.unlock();
    const vState = this.ownedVehicles[this.activeVehicleId];
    const currentLv = part === 'engine' ? vState.engineLevel : vState.cargoLevel;
    if (currentLv >= 3) return;
    const cost = currentLv === 1 ? 650 : 1450;
    if (this.money < cost) {
      this.callbacks.onToast({
        title: 'Saldo insuficiente',
        detail: `Melhoria custa R$ ${cost}.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= cost;
    if (part === 'engine') vState.engineLevel++;
    else vState.cargoLevel++;
    this.audio.playLevelUp();
    this.callbacks.onToast({
      title: part === 'engine' ? 'Motor Tunado!' : 'Bagageiro Ampliado!',
      detail:
        part === 'engine'
          ? 'Velocidade máxima e aceleração aumentadas em +12%.'
          : 'Capacidade de botijões aumentada em +1 unidade.',
      tone: 'success',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public refuelActiveVehicle(roadside = false): void {
    this.audio.unlock();
    const vState = this.ownedVehicles[this.activeVehicleId];
    const missing = Math.max(0, 100 - vState.fuel);
    if (missing < 2) {
      this.callbacks.onToast({
        title: 'Tanque cheio',
        detail: 'Seu veículo já está com 100% de combustível.',
        tone: 'info',
      });
      return;
    }
    const cost = Math.max(15, Math.round(missing * (roadside ? 1.4 : 0.75)));
    if (this.money < cost) {
      this.callbacks.onToast({
        title: 'Saldo insuficiente',
        detail: `Abastecimento custa R$ ${cost}.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= cost;
    vState.fuel = 100;
    this.audio.playPayment(true);
    this.callbacks.onToast({
      title: 'Veículo abastecido (100%)',
      detail: `Pago R$ ${cost} no combustível.`,
      tone: 'success',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  public repairActiveVehicle(mobileService = false): void {
    this.audio.unlock();
    const vState = this.ownedVehicles[this.activeVehicleId];
    const missing = Math.max(0, 100 - vState.health);
    if (missing < 2) {
      this.callbacks.onToast({
        title: 'Veículo em perfeito estado',
        detail: 'Lataria e mecânica já estão em 100%.',
        tone: 'info',
      });
      return;
    }
    const cost = Math.max(25, Math.round(missing * (mobileService ? 2.2 : 1.3)));
    if (this.money < cost) {
      this.callbacks.onToast({
        title: 'Saldo insuficiente',
        detail: `Manutenção custa R$ ${cost}.`,
        tone: 'danger',
      });
      return;
    }
    this.money -= cost;
    vState.health = 100;
    this.audio.playCylinderClank();
    this.callbacks.onToast({
      title: 'Manutenção concluída (100%)',
      detail: `Reparo realizado por R$ ${cost}.`,
      tone: 'success',
    });
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  // --- Input & Event Listeners ---

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
        e.code,
      )
    ) {
      e.preventDefault();
    }
    this.audio.unlock();
    if (!this.heldKeys.has(e.code)) {
      this.justPressedKeys.add(e.code);
    }
    this.heldKeys.add(e.code);

    if (e.code === 'Escape') {
      if (this.mode === 'PLAYING') this.setMode('PAUSED');
      else if (this.mode === 'PAUSED') this.setMode('PLAYING');
    } else if (e.code === 'Enter' && this.mode === 'TITLE_MENU') {
      this.setMode('PLAYING');
    } else if (this.mode === 'PLAYING') {
      if (e.code === 'KeyH') this.triggerHorn();
      if (e.code === 'KeyC') this.cycleCameraMode();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onBlur = () => {
    this.heldKeys.clear();
    this.touchThrottle = false;
    this.touchBrake = false;
    this.touchHandbrake = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.target !== this.renderer.domElement) return;
    this.audio.unlock();
    this.isPointerDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isPointerDragging || this.mode !== 'PLAYING') return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    this.camYawOffset -= dx * 0.0072;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.005, -0.22, 0.88);
    this.camManualTimer = 2.4;
  };

  private onPointerUp = () => {
    this.isPointerDragging = false;
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onWheel = (e: WheelEvent) => {
    if (this.mode !== 'PLAYING') return;
    this.camZoom = THREE.MathUtils.clamp(this.camZoom + e.deltaY * 0.0008, 0.65, 1.65);
  };

  private onResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    if (this.isSoftwareGl) {
      window.clearTimeout(this.frameId);
      this.frameId = window.setTimeout(this.tick, 40);
    }
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true });
  }

  // --- Main Simulation Tick ---

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTickTime) / 1000);
    this.lastTickTime = now;
    const dt = Math.min(rawDt, 0.05);

    if (this.mode === 'TITLE_MENU') {
      this.updateTitleShowcase(dt);
    } else if (this.mode === 'PLAYING') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.stepSimulation(dt);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.justPressedKeys.clear();

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    const startMs = performance.now();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED && performance.now() - startMs < 400) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateTitleShowcase(dt: number): void {
    this.titleOrbitAngle += dt * 0.14;
    const vState = this.ownedVehicles[this.activeVehicleId];
    const vInst = this.ensureVehicleMesh(this.activeVehicleId);
    const gy = groundHeightAt(vState.x, vState.z);
    vInst.root.position.set(vState.x, gy, vState.z);
    vInst.root.rotation.set(0, vState.yaw, 0);

    // Pose rider seated on vehicle
    this.poseCharacterInVehicle(vInst, 0);

    // Scenic camera framing Depósito São Jorge & Rider on right half while keeping left side clean for Title Lockup
    const sway = Math.sin(this.titleOrbitAngle) * 1.4;
    this.camera.position.set(vState.x + 8.5, gy + 3.4, vState.z - 8.5 + sway);
    this.camera.lookAt(vState.x - 4.2, gy + 1.6, vState.z + 0.5);

    this.updateTraffic(dt);
    this.updateDayNightAndWeather(dt * 0.25);
  }

  private stepSimulation(dt: number): void {
    // 1. Day/Night, Weather & Random Events
    this.updateDayNightAndWeather(dt);
    this.updateRandomEvents(dt);
    this.updateCompanyEconomy(dt);

    // 2. Active Delivery Timer
    if (this.activeOrder) {
      this.activeOrder.timeRemainingSec = Math.max(
        0,
        this.activeOrder.timeRemainingSec - dt,
      );
    }

    // 3. Delivery & Loading 3D Choreography Animations
    if (
      this.deliveryPhase === 'LOADING_ANIM' ||
      this.deliveryPhase === 'UNLOADING_ANIM' ||
      this.deliveryPhase === 'RINGING_ANIM' ||
      this.deliveryPhase === 'PAYING_ANIM'
    ) {
      this.updateDeliveryAnimation(dt);
    } else {
      // 4. Normal Player Movement (Vehicle or On-Foot)
      if (this.inVehicle) {
        this.updateVehiclePhysics(dt);
      } else {
        this.updateOnFootPhysics(dt);
      }
      this.checkInteractions();
    }

    // 5. Traffic & Particles
    this.updateTraffic(dt);
    this.world.updateParticles(dt);

    // 6. GPS Waypoint & 3D Beacon
    this.updateActiveWaypoint();

    // 7. Smooth Damped Third-Person Camera
    this.updateFollowCamera(dt);

    // 8. Periodic HUD sync & Autosave
    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.pushHudSnapshot();
    }

    this.saveTimer += dt;
    if (this.saveTimer >= 5.0) {
      this.saveTimer = 0;
      this.saveToStorage();
    }
  }

  private updateVehiclePhysics(dt: number): void {
    const spec = VEHICLE_SPECS[this.activeVehicleId];
    const vState = this.ownedVehicles[this.activeVehicleId];
    const vInst = this.ensureVehicleMesh(this.activeVehicleId);

    // Gather throttle, brake, steering from keyboard + virtual touch
    const forwardInput =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') || this.touchThrottle ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') || this.touchBrake ? 1 : 0);

    const steerInput =
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0) -
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0) -
      this.touchJoyX;

    const handbrake = this.heldKeys.has('Space') || this.touchHandbrake;
    const boost = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');

    // Engine & Fuel multipliers
    const engineMult = 1 + (vState.engineLevel - 1) * 0.12;
    const fuelMult = vState.fuel <= 0.5 ? 0.25 : 1.0;
    const maxSpeedMs = (spec.maxSpeedKmh / 3.6) * engineMult * fuelMult * (boost && spec.isMoto ? 1.08 : 1.0);
    const accel = spec.acceleration * engineMult * fuelMult;

    // Surface grip (rain & dirt road reduce traction)
    const isDirt = vState.x < -275;
    const grip = this.weather === 'chuva' ? 0.78 : isDirt ? 0.85 : 1.0;

    // Longitudinal speed update
    if (handbrake) {
      const decel = spec.braking * 1.45 * grip * dt;
      if (Math.abs(this.speedMs) <= decel) this.speedMs = 0;
      else this.speedMs -= Math.sign(this.speedMs) * decel;
    } else if (forwardInput > 0) {
      this.speedMs = Math.min(maxSpeedMs, this.speedMs + accel * dt);
    } else if (forwardInput < 0) {
      if (this.speedMs > 0.5) {
        this.speedMs = Math.max(0, this.speedMs - spec.braking * grip * dt);
      } else {
        this.speedMs = Math.max(-maxSpeedMs * 0.38, this.speedMs - accel * 0.65 * dt);
      }
    } else {
      // Natural rolling drag
      const drag = 4.2 * dt;
      if (Math.abs(this.speedMs) <= drag) this.speedMs = 0;
      else this.speedMs -= Math.sign(this.speedMs) * drag;
    }

    // Steering & Motorcycle lean
    const targetSteer = THREE.MathUtils.clamp(steerInput, -1, 1);
    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, targetSteer, 10, dt);

    const speedFactor = Math.min(1, Math.abs(this.speedMs) / 5.5);
    const reverseSign = this.speedMs < -0.2 ? -1 : 1;
    vState.yaw += this.steerAngle * spec.turnSpeed * speedFactor * reverseSign * grip * dt;

    // Move along forward vector (+Z in vehicle local space)
    const fx = Math.sin(vState.yaw);
    const fz = Math.cos(vState.yaw);
    const vx = fx * this.speedMs;
    const vz = fz * this.speedMs;
    const nextX = vState.x + vx * dt;
    const nextZ = vState.z + vz * dt;

    // Multi-circle hull collision resolution with tangential wall sliding
    const halfHullLen = spec.isMoto ? 0.55 : spec.length * 0.34;
    const hullRadius = spec.isMoto ? 0.44 : spec.width * 0.48;
    const resolved = this.resolveWorldCollisions(
      nextX,
      nextZ,
      vState.yaw,
      halfHullLen,
      hullRadius,
      spec.isMoto,
    );

    if (resolved.hit) {
      const vn = vx * resolved.nx + vz * resolved.nz;
      const impactKmh = Math.abs(vn) * 3.6;

      if (vn < 0) {
        const restitution = impactKmh > 32 ? 0.26 : 0.12;
        const newVx = vx - (1 + restitution) * vn * resolved.nx;
        const newVz = vz - (1 + restitution) * vn * resolved.nz;

        // Preserve 90% of tangential speed along wall while deflecting slightly off corners
        const projectedForward = (newVx * fx + newVz * fz) * 0.9;
        this.speedMs = projectedForward;

        const cross = fx * resolved.nz - fz * resolved.nx;
        vState.yaw += cross * Math.min(0.16, Math.abs(vn) * 0.014);
      } else {
        this.speedMs *= 0.82;
      }

      if (impactKmh > 18) {
        const dmg = Math.min(18, Math.round((impactKmh - 15) * 0.24));
        vState.health = Math.max(10, vState.health - dmg);
        this.hitstopTimer = 0.035;
        this.cameraShake = Math.min(0.42, impactKmh * 0.0075);
        this.audio.playCollision(impactKmh / 75);
        this.world.spawnBurstParticles(
          resolved.hitX,
          groundHeightAt(resolved.hitX, resolved.hitZ) + 0.8,
          resolved.hitZ,
          0xfbbf24,
          10,
        );
      }
    }

    vState.x = THREE.MathUtils.clamp(resolved.x, -WORLD_HALF_SIZE + 12, WORLD_HALF_SIZE - 12);
    vState.z = THREE.MathUtils.clamp(resolved.z, -WORLD_HALF_SIZE + 12, WORLD_HALF_SIZE - 12);
    vState.y = groundHeightAt(vState.x, vState.z);

    // Fuel consumption
    const distMoved = Math.hypot(vx * dt, vz * dt);
    if (distMoved > 0.01) {
      const fuelBurn = (distMoved / 1000) * spec.fuelConsumption;
      vState.fuel = Math.max(0, vState.fuel - fuelBurn);
    }

    // Speed camera check
    if (this.fineCooldown > 0) this.fineCooldown -= dt;
    const speedKmh = Math.abs(this.speedMs) * 3.6;
    if (speedKmh > 60 && this.fineCooldown <= 0) {
      const nearRadar = WORLD_POIS.find(
        (p) =>
          p.type === 'speed_camera' &&
          Math.hypot(vState.x - p.x, vState.z - p.z) < p.radius,
      );
      if (nearRadar) {
        this.fineCooldown = 12;
        const fine = 95;
        this.money = Math.max(0, this.money - fine);
        this.audio.playFineAlert();
        this.world.spawnBurstParticles(nearRadar.x, groundHeightAt(nearRadar.x, nearRadar.z) + 4.8, nearRadar.z, 0xffffff, 14);
        this.callbacks.onToast({
          title: `Multa de Radar (-R$ ${fine})`,
          detail: `Velocidade de ${Math.round(speedKmh)} km/h acima do limite de 50 km/h!`,
          tone: 'danger',
        });
      }
    }

    // Sync player coordinates to vehicle
    this.playerX = vState.x;
    this.playerZ = vState.z;
    this.playerYaw = vState.yaw;

    // Align vehicle mesh with terrain normal + yaw + motorcycle lean
    groundNormalAt(vState.x, vState.z, _normalOut);
    _tmpVec.set(_normalOut.x, _normalOut.y, _normalOut.z);
    _slopeQuat.setFromUnitVectors(_upVec, _tmpVec);
    _yawQuat.setFromAxisAngle(_upVec, vState.yaw);
    _finalQuat.multiplyQuaternions(_slopeQuat, _yawQuat);

    vInst.root.position.set(vState.x, vState.y, vState.z);
    vInst.root.quaternion.copy(_finalQuat);

    // Motorcycle bank lean on turns
    const targetLean = spec.isMoto ? -this.steerAngle * speedFactor * 0.34 : -this.steerAngle * speedFactor * 0.05;
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, 9, dt);
    vInst.root.rotateZ(this.leanAngle);

    // Spin wheels & steer front wheels
    this.wheelSpin += (this.speedMs * dt) / spec.wheelRadius;
    vInst.wheels.forEach((w) => {
      w.rotation.x = this.wheelSpin;
    });
    vInst.frontSteerWheels.forEach((fw) => {
      fw.rotation.y = this.steerAngle * 0.42;
    });

    // Pose rider seated in/on vehicle
    this.poseCharacterInVehicle(vInst, this.steerAngle);

    // Update engine audio
    this.audio.updateEngine(
      true,
      this.activeVehicleId,
      Math.abs(this.speedMs) / maxSpeedMs,
      this.weather === 'chuva',
    );
  }

  private poseCharacterInVehicle(vInst: VehicleInstance, steer: number): void {
    const spec = VEHICLE_SPECS[this.activeVehicleId];
    this.playerChar.root.visible = spec.isMoto || this.cameraMode !== 'hood';
    this.playerChar.carriedCylinder.visible = false;

    // Transform seat anchor from vehicle local space into world space
    _tmpVec.copy(vInst.riderSeatAnchor);
    if (spec.isMoto) {
      _tmpVec.y -= 0.72; // Adjust so hips sit cleanly on saddle
    } else {
      _tmpVec.y -= 0.78;
    }
    vInst.root.localToWorld(_tmpVec);

    this.playerChar.root.position.copy(_tmpVec);
    this.playerChar.root.quaternion.copy(vInst.root.quaternion);

    // Arms reach forward to handlebars / steering wheel
    this.playerChar.leftArm.rotation.set(-1.15, -steer * 0.25, 0.12);
    this.playerChar.rightArm.rotation.set(-1.15, -steer * 0.25, -0.12);
    this.playerChar.leftLeg.rotation.set(-0.65, 0, 0.22);
    this.playerChar.rightLeg.rotation.set(-0.65, 0, -0.22);
  }

  private updateOnFootPhysics(dt: number): void {
    const forward =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0) -
      this.touchJoyY;

    const strafe =
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0) -
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0) +
      this.touchJoyX;

    const sprinting =
      (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight')) &&
      !this.carryingOnFoot;

    const moveSpeed = this.carryingOnFoot ? 4.2 : sprinting ? 8.2 : 5.2;

    // True GTA camera-relative horizontal basis via getWorldDirection
    this.camera.getWorldDirection(_camDir);
    _camDir.y = 0;
    if (_camDir.lengthSq() < 0.0001) {
      _camDir.set(0, 0, -1);
    } else {
      _camDir.normalize();
    }
    const camForwardX = _camDir.x;
    const camForwardZ = _camDir.z;
    const camRightX = -camForwardZ;
    const camRightZ = camForwardX;

    let mx = camForwardX * forward + camRightX * strafe;
    let mz = camForwardZ * forward + camRightZ * strafe;
    const mag = Math.hypot(mx, mz);

    if (mag > 0.08) {
      mx /= mag;
      mz /= mag;
      const targetYaw = Math.atan2(mx, mz);
      // Shortest angle interpolation
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, dt * 13);

      const nextX = this.playerX + mx * moveSpeed * dt;
      const nextZ = this.playerZ + mz * moveSpeed * dt;
      const resolved = this.resolveWorldCollisions(nextX, nextZ, this.playerYaw, 0, 0.44, true);
      this.playerX = THREE.MathUtils.clamp(resolved.x, -WORLD_HALF_SIZE + 10, WORLD_HALF_SIZE - 10);
      this.playerZ = THREE.MathUtils.clamp(resolved.z, -WORLD_HALF_SIZE + 10, WORLD_HALF_SIZE - 10);
    }

    // Jump & gravity
    const gy = groundHeightAt(this.playerX, this.playerZ);
    if (this.heldKeys.has('Space') && this.playerOnGround) {
      this.playerVy = 6.2;
      this.playerOnGround = false;
    }
    this.playerVy -= 18 * dt;
    let py = this.playerChar.root.position.y + this.playerVy * dt;
    if (py <= gy) {
      py = gy;
      this.playerVy = 0;
      this.playerOnGround = true;
    }

    this.playerChar.root.visible = true;
    this.playerChar.root.position.set(this.playerX, py, this.playerZ);
    this.playerChar.root.rotation.set(0, this.playerYaw, 0);
    this.playerChar.carriedCylinder.visible = this.carryingOnFoot;

    // Procedural walking/running limb swing
    const walkCycle = performance.now() * (sprinting ? 0.014 : 0.009);
    const swing = mag > 0.08 ? Math.sin(walkCycle) * (sprinting ? 0.75 : 0.5) : 0;
    this.playerChar.leftLeg.rotation.set(swing, 0, 0);
    this.playerChar.rightLeg.rotation.set(-swing, 0, 0);

    if (this.carryingOnFoot) {
      // Arms raised forward holding the P13 cylinder!
      this.playerChar.leftArm.rotation.set(-1.35, 0.18, 0);
      this.playerChar.rightArm.rotation.set(-1.35, -0.18, 0);
    } else {
      this.playerChar.leftArm.rotation.set(-swing * 0.85, 0, 0.08);
      this.playerChar.rightArm.rotation.set(swing * 0.85, 0, -0.08);
    }

    this.audio.updateEngine(false, this.activeVehicleId, 0, this.weather === 'chuva');
  }

  private resolveWorldCollisions(
    x: number,
    z: number,
    yaw: number,
    halfLen: number,
    radius: number,
    canEnterAlley: boolean,
  ): { x: number; z: number; hit: boolean; nx: number; nz: number; hitX: number; hitZ: number } {
    let rx = x;
    let rz = z;
    let hit = false;
    let accumNx = 0;
    let accumNz = 0;
    let hitX = x;
    let hitZ = z;

    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const sampleOffsets = halfLen > 0.05 ? [-halfLen, 0, halfLen] : [0];

    for (let s = 0; s < sampleOffsets.length; s++) {
      const off = sampleOffsets[s];
      const sx = rx + fx * off;
      const sz = rz + fz * off;

      // 1. Building & Yard Wall AABBs
      for (let i = 0; i < this.world.colliders.length; i++) {
        const c = this.world.colliders[i];
        if (
          sx + radius < c.minX ||
          sx - radius > c.maxX ||
          sz + radius < c.minZ ||
          sz - radius > c.maxZ
        ) {
          continue;
        }
        const closestX = Math.max(c.minX, Math.min(sx, c.maxX));
        const closestZ = Math.max(c.minZ, Math.min(sz, c.maxZ));
        let dx = sx - closestX;
        let dz = sz - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          hit = true;
          let dist = Math.sqrt(distSq);
          if (dist < 0.0001) {
            // Inside AABB fallback: push toward nearest face
            const dLeft = Math.abs(sx - c.minX);
            const dRight = Math.abs(c.maxX - sx);
            const dTop = Math.abs(sz - c.minZ);
            const dBot = Math.abs(c.maxZ - sz);
            const m = Math.min(dLeft, dRight, dTop, dBot);
            if (m === dLeft) { dx = -1; dz = 0; }
            else if (m === dRight) { dx = 1; dz = 0; }
            else if (m === dTop) { dx = 0; dz = -1; }
            else { dx = 0; dz = 1; }
            dist = 0;
          } else {
            dx /= dist;
            dz /= dist;
          }
          const overlap = radius - dist;
          rx += dx * overlap;
          rz += dz * overlap;
          accumNx += dx;
          accumNz += dz;
          hitX = closestX;
          hitZ = closestZ;
        }
      }

      // 2. Cylindrical World Props (Utility Poles, Tree Trunks, LPG Sphere, Canopy Pillars)
      for (let i = 0; i < this.world.circleColliders.length; i++) {
        const cc = this.world.circleColliders[i];
        const minDist = radius + cc.radius;
        const dx = sx - cc.x;
        const dz = sz - cc.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
          hit = true;
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = minDist - dist;
          rx += nx * overlap;
          rz += nz * overlap;
          accumNx += nx;
          accumNz += nz;
          hitX = cc.x + nx * cc.radius;
          hitZ = cc.z + nz * cc.radius;
        }
      }

      // 3. Narrow Alley restriction for wide 4-wheeled vehicles
      if (!canEnterAlley) {
        if (sx + radius > -204 && sx - radius < -196 && sz > -256 && sz < -64) {
          hit = true;
          const pushLeft = sx < -200;
          const nx = pushLeft ? -1 : 1;
          rx += pushLeft ? -204 - (sx + radius) : -196 - (sx - radius);
          accumNx += nx;
          hitX = pushLeft ? -204 : -196;
          hitZ = sz;
        }
        if (sz + radius > -114 && sz - radius < -106 && sx > -236 && sx < -154) {
          hit = true;
          const pushTop = sz < -110;
          const nz = pushTop ? -1 : 1;
          rz += pushTop ? -114 - (sz + radius) : -106 - (sz - radius);
          accumNz += nz;
          hitX = sx;
          hitZ = pushTop ? -114 : -106;
        }
      }

      // 4. Multi-circle AI Traffic Vehicle collisions with knockback impulse
      for (let i = 0; i < this.trafficAgents.length; i++) {
        const ag = this.trafficAgents[i];
        const agRadius = ag.width * 0.48;
        const minDist = radius + agRadius;
        if (
          Math.abs(sx - ag.x) > ag.length * 0.55 + minDist ||
          Math.abs(sz - ag.z) > ag.length * 0.55 + minDist
        ) {
          continue;
        }

        const agFx = Math.sin(ag.yaw);
        const agFz = Math.cos(ag.yaw);
        const agHalfLen = ag.length * 0.28;

        for (let k = -1; k <= 1; k += 2) {
          const ax = ag.x + agFx * agHalfLen * k;
          const az = ag.z + agFz * agHalfLen * k;
          const dx = sx - ax;
          const dz = sz - az;
          const distSq = dx * dx + dz * dz;
          if (distSq < minDist * minDist) {
            hit = true;
            const dist = Math.sqrt(distSq) || 0.001;
            const nx = dx / dist;
            const nz = dz / dist;
            const overlap = minDist - dist;
            rx += nx * overlap * 0.72;
            rz += nz * overlap * 0.72;
            ag.x -= nx * overlap * 0.28;
            ag.z -= nz * overlap * 0.28;
            ag.speed *= 0.25;
            ag.stunTimer = 1.8;
            accumNx += nx;
            accumNz += nz;
            hitX = ax + nx * agRadius;
            hitZ = az + nz * agRadius;
          }
        }
      }
    }

    const nLen = Math.hypot(accumNx, accumNz) || 1;
    return {
      x: rx,
      z: rz,
      hit,
      nx: accumNx / nLen,
      nz: accumNz / nLen,
      hitX,
      hitZ,
    };
  }

  private getCurrentInteractionPrompt(): InteractionPrompt | null {
    const vState = this.ownedVehicles[this.activeVehicleId];
    const maxCap = this.getMaxCargoCapacity(this.activeVehicleId);

    // 1. Check Active Delivery Dropoff
    if (
      this.activeOrder &&
      this.deliveryPhase === 'TO_CUSTOMER' &&
      Math.hypot(this.playerX - this.activeOrder.targetX, this.playerZ - this.activeOrder.targetZ) < 9.5
    ) {
      const totalCyl = vState.loadedCylinders + (this.carryingOnFoot ? 1 : 0);
      if (totalCyl >= this.activeOrder.cylindersRequired) {
        return {
          id: 'deliver',
          label: `Entregar ${this.activeOrder.cylindersRequired}x Botijão para ${this.activeOrder.clientName}`,
          sublabel: 'Descarregar, tocar campainha e receber pagamento',
          actionType: 'deliver_cylinder',
        };
      }
    }

    // 2. Check Depot / Owned Branch Loading Bay
    const nearDepot = WORLD_POIS.find(
      (p) => p.type === 'depot' && Math.hypot(this.playerX - p.x, this.playerZ - p.z) < p.radius + 4,
    );
    const nearOwnedBranch = this.company.branches.find(
      (b) => b.owned && Math.hypot(this.playerX - b.x, this.playerZ - b.z) < 15,
    );

    if (nearDepot || nearOwnedBranch) {
      const totalCarried = vState.loadedCylinders + (this.carryingOnFoot ? 1 : 0);
      const needed = this.activeOrder
        ? Math.max(0, this.activeOrder.cylindersRequired - totalCarried)
        : Math.max(0, maxCap - vState.loadedCylinders);

      if (needed > 0 && this.company.stockFull > 0) {
        return {
          id: 'load_depot',
          label: `Carregar Botijão de Gás (${this.company.stockFull} em estoque)`,
          sublabel: this.inVehicle
            ? 'Prender botijão no suporte do veículo'
            : 'Pegar botijão para levar ao veículo',
          actionType: 'load_cylinder',
        };
      }
    }

    // 3. Check Gas Station Refuel
    const nearGas = WORLD_POIS.find(
      (p) => p.type === 'gas_station' && Math.hypot(this.playerX - p.x, this.playerZ - p.z) < p.radius,
    );
    if (nearGas && vState.fuel < 98) {
      const cost = Math.max(15, Math.round((100 - vState.fuel) * 0.75));
      return {
        id: 'refuel',
        label: `Abastecer Veículo (R$ ${cost})`,
        sublabel: nearGas.name,
        actionType: 'refuel',
        cost,
      };
    }

    // 4. Check Mechanic Workshop Repair
    const nearWorkshop = WORLD_POIS.find(
      (p) => p.type === 'workshop' && Math.hypot(this.playerX - p.x, this.playerZ - p.z) < p.radius + 2,
    );
    if (nearWorkshop && vState.health < 98) {
      const cost = Math.max(25, Math.round((100 - vState.health) * 1.3));
      return {
        id: 'repair',
        label: `Consertar Veículo (R$ ${cost})`,
        sublabel: nearWorkshop.name,
        actionType: 'repair',
        cost,
      };
    }

    // 5. Check Wholesale Plant (Atacadão do Gás)
    const nearWholesale = WORLD_POIS.find(
      (p) => p.type === 'wholesale' && Math.hypot(this.playerX - p.x, this.playerZ - p.z) < p.radius + 3,
    );
    if (nearWholesale && this.company.stockFull < this.company.maxStock) {
      return {
        id: 'wholesale',
        label: 'Comprar Lote +5 Botijões (R$ 310)',
        sublabel: 'Atacadão do Gás — Preço de fábrica',
        actionType: 'wholesale_buy',
        cost: 310,
      };
    }

    // 6. On foot near vehicle -> Enter vehicle
    if (!this.inVehicle && Math.hypot(this.playerX - vState.x, this.playerZ - vState.z) < 3.8) {
      return {
        id: 'enter_veh',
        label: this.carryingOnFoot
          ? `Prender Botijão e Subir (${VEHICLE_SPECS[this.activeVehicleId].name})`
          : `Subir / Entrar (${VEHICLE_SPECS[this.activeVehicleId].name})`,
        actionType: 'enter_vehicle',
      };
    }

    return null;
  }

  private checkInteractions(): void {
    if (!this.justPressedKeys.has('KeyE')) return;

    const prompt = this.getCurrentInteractionPrompt();
    if (!prompt) {
      // Default E behavior: dismount/mount vehicle
      this.toggleVehicleMount();
      return;
    }

    const vState = this.ownedVehicles[this.activeVehicleId];
    const maxCap = this.getMaxCargoCapacity(this.activeVehicleId);

    switch (prompt.actionType) {
      case 'deliver_cylinder': {
        this.wasInVehicleBeforeAnim = this.inVehicle;
        this.inVehicle = false;
        this.speedMs = 0;
        this.deliveryPhase = 'UNLOADING_ANIM';
        this.animTimer = 0;
        this.audio.playCylinderClank();
        break;
      }
      case 'load_cylinder': {
        if (this.inVehicle) {
          // Animated loading sequence onto vehicle rack!
          this.wasInVehicleBeforeAnim = true;
          this.inVehicle = false;
          this.speedMs = 0;
          this.deliveryPhase = 'LOADING_ANIM';
          this.animTimer = 0;
          this.audio.playCylinderClank();
        } else {
          // On foot: pick up 1 cylinder in hands (or if already carrying, load onto vehicle if nearby)
          if (!this.carryingOnFoot && this.company.stockFull > 0) {
            this.carryingOnFoot = true;
            this.company.stockFull--;
            this.audio.playCylinderClank();
            this.callbacks.onToast({
              title: 'Botijão P13 nos braços',
              detail: 'Leve até o seu veículo e pressione E para prender no suporte.',
              tone: 'info',
            });
          } else if (this.carryingOnFoot && vState.loadedCylinders < maxCap) {
            this.carryingOnFoot = false;
            vState.loadedCylinders++;
            this.audio.playCylinderClank();
            this.syncVehicleVisuals();
          }
        }
        break;
      }
      case 'refuel':
        this.refuelActiveVehicle(false);
        break;
      case 'repair':
        this.repairActiveVehicle(false);
        break;
      case 'wholesale_buy':
        this.buyWholesaleStock(5);
        break;
      case 'enter_vehicle':
        this.toggleVehicleMount();
        break;
    }
    this.pushHudSnapshot();
  }

  /**
   * 3D Choreography for Loading Cylinder onto Vehicle & Customer Doorbell Delivery
   */
  private updateDeliveryAnimation(dt: number): void {
    this.animTimer += dt;
    const vState = this.ownedVehicles[this.activeVehicleId];
    const vInst = this.ensureVehicleMesh(this.activeVehicleId);
    const maxCap = this.getMaxCargoCapacity(this.activeVehicleId);

    this.playerChar.root.visible = true;

    if (this.deliveryPhase === 'LOADING_ANIM') {
      // Position character beside vehicle rack lifting cylinder
      const sideX = vState.x + Math.sin(vState.yaw + Math.PI / 2) * 1.15;
      const sideZ = vState.z + Math.cos(vState.yaw + Math.PI / 2) * 1.15;
      const gy = groundHeightAt(sideX, sideZ);
      this.playerChar.root.position.set(sideX, gy, sideZ);
      this.playerChar.root.lookAt(vState.x, gy, vState.z);
      this.playerChar.carriedCylinder.visible = true;
      const lift = Math.sin(Math.min(1, this.animTimer / 1.1) * Math.PI);
      this.playerChar.carriedCylinder.position.set(0, 0.95 + lift * 0.45, 0.36);
      this.playerChar.leftArm.rotation.set(-1.5 - lift * 0.5, 0.15, 0);
      this.playerChar.rightArm.rotation.set(-1.5 - lift * 0.5, -0.15, 0);

      if (this.animTimer >= 1.15) {
        const needed = this.activeOrder
          ? Math.min(maxCap - vState.loadedCylinders, this.activeOrder.cylindersRequired - vState.loadedCylinders)
          : maxCap - vState.loadedCylinders;
        const loadCount = Math.max(1, Math.min(needed, this.company.stockFull));
        this.company.stockFull -= loadCount;
        vState.loadedCylinders += loadCount;
        this.syncVehicleVisuals();
        this.audio.playCylinderClank();
        this.world.spawnBurstParticles(vState.x, gy + 1.1, vState.z, 0x38bdf8, 12);

        this.playerChar.carriedCylinder.visible = false;
        this.playerChar.carriedCylinder.position.set(0, 0.92, 0.36);
        this.inVehicle = this.wasInVehicleBeforeAnim;
        this.deliveryPhase = this.activeOrder ? 'TO_CUSTOMER' : null;
        this.saveToStorage();
        this.pushHudSnapshot();
      }
      return;
    }

    if (!this.activeOrder) {
      this.deliveryPhase = null;
      return;
    }

    const house = CUSTOMER_HOUSES.find(
      (h) =>
        Math.abs(h.dropX - this.activeOrder!.targetX) < 2 &&
        Math.abs(h.dropZ - this.activeOrder!.targetZ) < 2,
    );
    const gateX = house ? THREE.MathUtils.lerp(house.dropX, house.houseX, 0.45) : this.activeOrder.targetX;
    const gateZ = house ? THREE.MathUtils.lerp(house.dropZ, house.houseZ, 0.45) : this.activeOrder.targetZ;
    const gy = groundHeightAt(gateX, gateZ);

    if (this.deliveryPhase === 'UNLOADING_ANIM') {
      // Character carries P13 cylinder from vehicle to customer's front gate
      const t = Math.min(1, this.animTimer / 0.85);
      const px = THREE.MathUtils.lerp(vState.x, gateX, t);
      const pz = THREE.MathUtils.lerp(vState.z, gateZ, t);
      this.playerChar.root.position.set(px, groundHeightAt(px, pz), pz);
      this.playerChar.root.lookAt(gateX, gy, gateZ);
      this.playerChar.carriedCylinder.visible = true;
      this.playerChar.leftArm.rotation.set(-1.35, 0.18, 0);
      this.playerChar.rightArm.rotation.set(-1.35, -0.18, 0);
      this.playerChar.leftLeg.rotation.set(Math.sin(t * 14) * 0.45, 0, 0);
      this.playerChar.rightLeg.rotation.set(-Math.sin(t * 14) * 0.45, 0, 0);

      if (this.animTimer >= 0.85) {
        this.deliveryPhase = 'RINGING_ANIM';
        this.animTimer = 0;
        this.audio.playDoorbell();

        // Spawn Customer NPC walking out of house!
        this.customerNpc.root.visible = true;
        this.customerNpc.propCash.visible = false;
        this.customerNpc.propCard.visible = false;
        const startX = house ? house.houseX : gateX;
        const startZ = house ? house.houseZ : gateZ;
        this.customerNpc.root.position.set(startX, groundHeightAt(startX, startZ), startZ);
      }
    } else if (this.deliveryPhase === 'RINGING_ANIM') {
      // Player rings doorbell while Customer NPC walks to the gate
      const t = Math.min(1, this.animTimer / 0.9);
      this.playerChar.carriedCylinder.visible = false;
      this.playerChar.rightArm.rotation.set(-1.45, 0, 0);
      this.playerChar.leftLeg.rotation.set(0, 0, 0);
      this.playerChar.rightLeg.rotation.set(0, 0, 0);

      const startX = house ? house.houseX : gateX;
      const startZ = house ? house.houseZ : gateZ;
      const npcX = THREE.MathUtils.lerp(startX, gateX, t * 0.82);
      const npcZ = THREE.MathUtils.lerp(startZ, gateZ, t * 0.82);
      this.customerNpc.root.position.set(npcX, groundHeightAt(npcX, npcZ), npcZ);
      this.customerNpc.root.lookAt(this.playerChar.root.position.x, gy, this.playerChar.root.position.z);
      this.customerNpc.leftLeg.rotation.set(Math.sin(t * 12) * 0.4, 0, 0);
      this.customerNpc.rightLeg.rotation.set(-Math.sin(t * 12) * 0.4, 0, 0);

      if (this.animTimer >= 0.9) {
        this.deliveryPhase = 'PAYING_ANIM';
        this.animTimer = 0;
        const isCard = this.activeOrder.paymentMethod === 'cartao';
        this.customerNpc.propCash.visible = !isCard;
        this.customerNpc.propCard.visible = isCard;
        this.customerNpc.rightArm.rotation.set(-1.25, 0, 0);
        this.audio.playPayment(isCard);
        this.world.spawnBurstParticles(gateX, gy + 1.4, gateZ, 0x22c55e, 18);
      }
    } else if (this.deliveryPhase === 'PAYING_ANIM') {
      this.customerNpc.leftLeg.rotation.set(0, 0, 0);
      this.customerNpc.rightLeg.rotation.set(0, 0, 0);
      this.playerChar.rightArm.rotation.set(-1.1, 0, 0);

      if (this.animTimer >= 0.95) {
        this.completeActiveDelivery();
      }
    }

    // Keep vehicle grounded
    vInst.root.position.set(vState.x, vState.y, vState.z);
  }

  private completeActiveDelivery(): void {
    const ord = this.activeOrder;
    if (!ord) return;

    const vState = this.ownedVehicles[this.activeVehicleId];
    let rem = ord.cylindersRequired;
    if (this.carryingOnFoot) {
      this.carryingOnFoot = false;
      rem--;
    }
    vState.loadedCylinders = Math.max(0, vState.loadedCylinders - rem);
    this.company.stockEmpty = Math.min(
      this.company.maxStock,
      this.company.stockEmpty + ord.cylindersRequired,
    );
    this.syncVehicleVisuals();

    // Calculate service quality stars (1..5) & speed/condition tip
    const timeRatio = ord.timeRemainingSec / Math.max(1, ord.timeLimitSec);
    let stars = 3;
    if (timeRatio > 0.45 && vState.health >= 85) stars = 5;
    else if (timeRatio > 0.2 && vState.health >= 65) stars = 4;
    else if (ord.timeRemainingSec <= 0) stars = 2;

    const tip = stars === 5 ? Math.round(ord.reward * 0.22) : stars === 4 ? Math.round(ord.reward * 0.1) : 0;
    const totalPay = ord.reward + tip;

    this.money += totalPay;
    this.company.totalDeliveriesCompleted++;
    this.company.totalRevenue += totalPay;

    this.lastDeliverySummary = {
      clientName: ord.clientName,
      basePay: ord.reward,
      tip,
      stars,
      paymentMethod: ord.paymentMethod,
      xpEarned: ord.xpReward,
    };

    this.addXp(ord.xpReward);

    this.callbacks.onToast({
      title: `Entrega concluída! +R$ ${totalPay} (${stars}★)`,
      detail: `${ord.clientName} pagou via ${ord.paymentMethod === 'dinheiro' ? 'Dinheiro' : 'Cartão'}${tip > 0 ? ` (+R$ ${tip} gorjeta!)` : ''}.`,
      tone: 'success',
    });

    this.customerNpc.root.visible = false;
    this.activeOrder = null;
    this.deliveryPhase = null;
    this.inVehicle = this.wasInVehicleBeforeAnim;
    this.playerX = vState.x;
    this.playerZ = vState.z;

    this.refreshAvailableOrders();
    this.saveToStorage();
    this.pushHudSnapshot();
  }

  private addXp(amount: number): void {
    this.xp += amount;
    for (let i = PROGRESSION_LEVELS.length - 1; i >= 0; i--) {
      const lv = PROGRESSION_LEVELS[i];
      if (this.xp >= lv.minXp && this.level < lv.level) {
        this.level = lv.level;
        this.audio.playLevelUp();
        this.callbacks.onLevelUp(lv.level, lv.title, lv.perkDescription);
        break;
      }
    }
  }

  private updateCompanyEconomy(dt: number): void {
    const hiredEmps = this.company.employees.filter((e) => e.hired);
    const ownedBranches = this.company.branches.filter((b) => b.owned);
    if (hiredEmps.length === 0 && ownedBranches.length === 0) return;

    this.companyCycleTimer += dt;
    if (this.companyCycleTimer >= 25) {
      this.companyCycleTimer = 0;
      const empProfit = hiredEmps.reduce((sum, e) => sum + e.dailyNetProfit, 0);
      const branchProfit = ownedBranches.reduce((sum, b) => sum + b.dailyIncome, 0);
      const total = empProfit + branchProfit;
      if (total > 0) {
        this.money += total;
        this.company.lastCycleProfit = total;
        this.company.totalRevenue += total;
        this.company.totalDeliveriesCompleted += hiredEmps.length;
        this.callbacks.onToast({
          title: `Lucro da Distribuidora: +R$ ${total}`,
          detail: `${hiredEmps.length} motorista(s) e ${ownedBranches.length} filial(is) em operação.`,
          tone: 'success',
        });
      }
    }
  }

  private updateRandomEvents(dt: number): void {
    if (this.activeEventTimer > 0) {
      this.activeEventTimer -= dt;
      if (this.activeEventTimer <= 0) {
        this.activeEvent = 'none';
      }
      return;
    }

    // Trigger occasional dynamic Brazilian city events every ~75s
    if (Math.random() < dt * 0.012 && this.company.totalDeliveriesCompleted >= 1) {
      const roll = Math.random();
      if (roll < 0.35) {
        this.activeEvent = 'chuva_forte';
        this.weather = 'chuva';
        this.weatherTimer = 65;
        this.activeEventTimer = 65;
        this.callbacks.onToast({
          title: 'Evento: Chuva Forte na Cidade!',
          detail: 'Pistas escorregadias, mas todas as entregas pagam +35% de bônus!',
          tone: 'warning',
        });
      } else if (roll < 0.7) {
        this.activeEvent = 'transito_intenso';
        this.activeEventTimer = 55;
        this.callbacks.onToast({
          title: 'Evento: Horário de Pico!',
          detail: 'Trânsito intenso nas avenidas principais — use vielas ou buzine!',
          tone: 'info',
        });
      } else {
        this.activeEvent = 'pico_pedidos';
        this.activeEventTimer = 50;
        this.refreshAvailableOrders();
        this.callbacks.onToast({
          title: 'Evento: Alta Demanda de Gás!',
          detail: 'Novos pedidos urgentes chegaram no seu celular!',
          tone: 'success',
        });
      }
    }
  }

  private updateDayNightAndWeather(dt: number): void {
    // Advance game clock (~5 game minutes per real second)
    this.gameTimeMinutes += dt * 5.0;
    if (this.gameTimeMinutes >= 1440) {
      this.gameTimeMinutes -= 1440;
      this.dayCount++;
    }

    // Weather cycle
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      this.weatherTimer = 85 + Math.random() * 55;
      const r = Math.random();
      this.weather = r < 0.58 ? 'ensolarado' : r < 0.82 ? 'nublado' : 'chuva';
    }

    // Sun & Sky interpolation
    const hour = this.gameTimeMinutes / 60;
    const sunAngle = ((hour - 6) / 24) * Math.PI * 2;
    const sunY = Math.sin(sunAngle) * 145;
    const sunX = Math.cos(sunAngle) * 120;

    this.sunLight.position.set(this.playerX + sunX, Math.max(18, sunY), this.playerZ + 65);
    this.sunLight.target.position.set(this.playerX, 0, this.playerZ);

    // Night factor: 0 = full day, 1 = midnight
    const nightFactor = THREE.MathUtils.clamp(1 - (sunY + 15) / 55, 0, 1);
    const sunsetFactor = Math.exp(-Math.pow((sunY - 12) / 24, 2));

    const daySky = this.weather === 'chuva' ? 0x64748b : this.weather === 'nublado' ? 0x94a3b8 : 0x7dd3fc;
    const nightSky = 0x0b132b;
    const sunsetSky = 0xf97316;

    const skyCol = new THREE.Color(daySky)
      .lerp(new THREE.Color(sunsetSky), sunsetFactor * 0.55)
      .lerp(new THREE.Color(nightSky), nightFactor);

    (this.scene.background as THREE.Color).copy(skyCol);
    this.fog.color.copy(skyCol);
    this.fog.density = this.weather === 'chuva' ? 0.0042 : 0.0021;

    this.sunLight.intensity = THREE.MathUtils.lerp(
      this.weather === 'chuva' ? 0.95 : 1.85,
      0.32,
      nightFactor,
    );
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.75, 0.35, nightFactor);

    // Vehicle headlights at dusk/night or rain
    const vInst = this.vehicleMeshes[this.activeVehicleId];
    if (vInst) {
      const lightsOn = nightFactor > 0.35 || this.weather === 'chuva';
      vInst.headlightBeam.intensity = lightsOn ? 3.5 : 0;
    }

    this.world.updateWeatherVisuals(
      this.weather === 'chuva',
      nightFactor,
      dt,
      this.camera.position,
    );
  }

  private updateTraffic(dt: number): void {
    if (this.trafficEdges.length === 0) return;
    const rushMult = this.activeEvent === 'transito_intenso' ? 0.72 : 1.0;
    const blinkOn = Math.sin(performance.now() * 0.018) > 0;

    for (let i = 0; i < this.trafficAgents.length; i++) {
      const ag = this.trafficAgents[i];
      const edge = this.trafficEdges[ag.edgeIndex];

      if (ag.stunTimer > 0) {
        ag.stunTimer = Math.max(0, ag.stunTimer - dt);
      }

      let targetSpeed = ag.stunTimer > 0 ? 0 : ag.maxSpeed * rushMult;

      // 1. Check distance to player if player is ahead in this lane or crossing path
      const toPlayerX = this.playerX - ag.x;
      const toPlayerZ = this.playerZ - ag.z;
      const distToPlayer = Math.hypot(toPlayerX, toPlayerZ);
      if (distToPlayer < 18) {
        const fwdDot = (toPlayerX * edge.dirX + toPlayerZ * edge.dirZ) / (distToPlayer || 1);
        const lateral = Math.abs(-toPlayerX * edge.dirZ + toPlayerZ * edge.dirX);
        if (fwdDot > 0.25 && lateral < ag.width * 1.45) {
          if (distToPlayer < 9.5) targetSpeed = 0;
          else targetSpeed = Math.min(targetSpeed, ag.maxSpeed * 0.35);
        }
      }

      // 2. Car-following AI: maintain safe gap behind slower/stopped traffic ahead
      for (let j = 0; j < this.trafficAgents.length; j++) {
        if (i === j) continue;
        const other = this.trafficAgents[j];
        const dx = other.x - ag.x;
        const dz = other.z - ag.z;
        const d = Math.hypot(dx, dz);
        if (d < 13.5) {
          const fwdDot = (dx * edge.dirX + dz * edge.dirZ) / (d || 1);
          const lateral = Math.abs(-dx * edge.dirZ + dz * edge.dirX);
          if (fwdDot > 0.55 && lateral < ag.width * 1.05) {
            const minGap = (ag.length + other.length) * 0.5 + 3.2;
            if (d < minGap) {
              targetSpeed = 0;
            } else {
              targetSpeed = Math.min(targetSpeed, other.speed * 0.9);
            }
          }
        }
      }

      const accelRate = targetSpeed < ag.speed ? 7.5 : 3.6;
      ag.speed = THREE.MathUtils.damp(ag.speed, targetSpeed, accelRate, dt);
      ag.t += (ag.speed * dt) / edge.len;

      // Intersection navigation when reaching the end of current road segment
      if (ag.t >= 1) {
        const candidates = this.outgoingEdgesByNode.get(edge.toNode);
        let nextIdx = ag.edgeIndex;
        if (candidates && candidates.length > 0) {
          const nonUturn = candidates.filter((idx) => {
            const cand = this.trafficEdges[idx];
            const dot = cand.dirX * edge.dirX + cand.dirZ * edge.dirZ;
            return !cand.isDepotSpur && dot > -0.7;
          });
          const pool = nonUturn.length > 0 ? nonUturn : candidates;
          // Weight straight continuation higher than 90-deg turns
          const weighted: number[] = [];
          pool.forEach((idx) => {
            const cand = this.trafficEdges[idx];
            const dot = cand.dirX * edge.dirX + cand.dirZ * edge.dirZ;
            const w = dot > 0.7 ? 3 : 2;
            for (let k = 0; k < w; k++) weighted.push(idx);
          });
          nextIdx = weighted[Math.floor(Math.random() * weighted.length)];
        }
        ag.edgeIndex = nextIdx;
        ag.t = 0;
      }

      const curEdge = this.trafficEdges[ag.edgeIndex];
      const rightX = -curEdge.dirZ;
      const rightZ = curEdge.dirX;
      const laneOffset = curEdge.width * 0.24;

      ag.x = curEdge.x1 + (curEdge.x2 - curEdge.x1) * ag.t + rightX * laneOffset;
      ag.z = curEdge.z1 + (curEdge.z2 - curEdge.z1) * ag.t + rightZ * laneOffset;

      // Smoothly interpolate vehicle heading into turns at intersections
      const targetYaw = Math.atan2(curEdge.dirX, curEdge.dirZ);
      let yawDiff = targetYaw - ag.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      ag.yaw += yawDiff * Math.min(1, dt * 8.5);

      const gy = groundHeightAt(ag.x, ag.z);
      ag.mesh.position.set(ag.x, gy, ag.z);
      ag.mesh.rotation.set(0, ag.yaw, 0);

      // Dynamic brake & hazard lights
      if (ag.stunTimer > 0) {
        ag.taillightMat.emissiveIntensity = blinkOn ? 2.6 : 0.2;
      } else if (targetSpeed < ag.speed - 0.6 || ag.speed < 0.8) {
        ag.taillightMat.emissiveIntensity = 2.3;
      } else {
        ag.taillightMat.emissiveIntensity = 0.45;
      }

      ag.wheels.forEach((w) => {
        w.rotation.x += ag.speed * dt * 2.2;
      });
    }
  }

  private updateActiveWaypoint(): void {
    const vState = this.ownedVehicles[this.activeVehicleId];
    const totalCarried = vState.loadedCylinders + (this.carryingOnFoot ? 1 : 0);

    if (this.activeOrder) {
      if (totalCarried >= this.activeOrder.cylindersRequired) {
        if (this.deliveryPhase === 'TO_DEPOT') {
          this.deliveryPhase = 'TO_CUSTOMER';
        }
        this.world.updateGpsRoute(
          this.playerX,
          this.playerZ,
          this.activeOrder.targetX,
          this.activeOrder.targetZ,
          true,
        );
      } else {
        if (this.deliveryPhase === 'TO_CUSTOMER') {
          this.deliveryPhase = 'TO_DEPOT';
        }
        // Guide to nearest owned depot (Matriz or owned branch)
        let bestX = -120;
        let bestZ = 91;
        let bestD = Math.hypot(this.playerX - bestX, this.playerZ - bestZ);
        this.company.branches.forEach((b) => {
          if (b.owned) {
            const d = Math.hypot(this.playerX - b.x, this.playerZ - b.z);
            if (d < bestD) {
              bestD = d;
              bestX = b.x;
              bestZ = b.z;
            }
          }
        });
        this.world.updateGpsRoute(this.playerX, this.playerZ, bestX, bestZ, true);
      }
    } else if (this.customWaypoint) {
      const d = Math.hypot(
        this.playerX - this.customWaypoint.x,
        this.playerZ - this.customWaypoint.z,
      );
      if (d < 8) {
        this.customWaypoint = null;
        this.world.updateGpsRoute(0, 0, 0, 0, false);
      } else {
        this.world.updateGpsRoute(
          this.playerX,
          this.playerZ,
          this.customWaypoint.x,
          this.customWaypoint.z,
          true,
        );
      }
    } else {
      this.world.updateGpsRoute(0, 0, 0, 0, false);
    }
  }

  private clampCameraToWorld(
    pivotX: number,
    pivotY: number,
    pivotZ: number,
    desired: THREE.Vector3,
  ): void {
    // Ray-march 6 steps from pivot to desired camera position so camera never clips inside buildings or terrain
    for (let step = 1; step <= 6; step++) {
      const t = step / 6;
      const cx = THREE.MathUtils.lerp(pivotX, desired.x, t);
      const cz = THREE.MathUtils.lerp(pivotZ, desired.z, t);

      for (let i = 0; i < this.world.colliders.length; i++) {
        const c = this.world.colliders[i];
        if (
          cx > c.minX - 0.45 &&
          cx < c.maxX + 0.45 &&
          cz > c.minZ - 0.45 &&
          cz < c.maxZ + 0.45
        ) {
          const safeT = Math.max(0.22, (step - 1) / 6);
          desired.x = THREE.MathUtils.lerp(pivotX, desired.x, safeT);
          desired.z = THREE.MathUtils.lerp(pivotZ, desired.z, safeT);
          desired.y = THREE.MathUtils.lerp(pivotY, desired.y, safeT);
          return;
        }
      }
    }
    const groundAtCam = groundHeightAt(desired.x, desired.z);
    if (desired.y < groundAtCam + 0.75) {
      desired.y = groundAtCam + 0.75;
    }
  }

  private updateFollowCamera(dt: number): void {
    if (this.camManualTimer > 0) {
      this.camManualTimer -= dt;
    } else if (this.inVehicle) {
      // GTA vehicle camera auto-aligns behind vehicle when driving forward, or swings rear on reverse
      if (this.speedMs > 2.0) {
        this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, 0, 3.6, dt);
      } else if (this.speedMs < -2.2) {
        this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, Math.PI, 2.6, dt);
      }
    }
    // Note: When on foot (!this.inVehicle), GTA camera keeps free 360° orbit angle around the character!

    const py = groundHeightAt(this.playerX, this.playerZ);
    const spec = VEHICLE_SPECS[this.activeVehicleId];
    const baseHeight = this.inVehicle ? spec.height : 1.5;

    const sprintingOnFoot =
      !this.inVehicle &&
      !this.carryingOnFoot &&
      (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight'));

    // Dynamic GTA FOV widening with speed / sprint
    const speedRatio = Math.min(1, Math.abs(this.speedMs) / 28);
    const targetFov =
      this.cameraMode === 'hood'
        ? 66
        : !this.inVehicle
          ? sprintingOnFoot
            ? 63
            : 58
          : 56 + speedRatio * 11;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();
    }

    if (this.cameraMode === 'hood' && this.inVehicle) {
      const lookYaw = this.playerYaw + this.camYawOffset;
      _camDesired.set(
        this.playerX + Math.sin(this.playerYaw) * 0.45,
        py + baseHeight + 0.35,
        this.playerZ + Math.cos(this.playerYaw) * 0.45,
      );
      _camTarget.set(
        _camDesired.x + Math.sin(lookYaw) * 18,
        _camDesired.y - 0.5,
        _camDesired.z + Math.cos(lookYaw) * 18,
      );
      this.camera.position.lerp(_camDesired, Math.min(1, dt * 18));
      this.camera.lookAt(_camTarget);
      return;
    }

    if (!this.inVehicle) {
      // GTA Over-the-Right-Shoulder Character Camera
      const orbitYaw = this.playerYaw + Math.PI + this.camYawOffset;
      const rightX = -Math.cos(orbitYaw);
      const rightZ = Math.sin(orbitYaw);

      const dist = (sprintingOnFoot ? 4.35 : 3.75) * this.camZoom;
      const height = 1.48 * this.camZoom;
      const shoulderOffset = 0.56;

      const desiredX = this.playerX + Math.sin(orbitYaw) * dist + rightX * shoulderOffset;
      const desiredZ = this.playerZ + Math.cos(orbitYaw) * dist + rightZ * shoulderOffset;
      const desiredY = py + height + Math.sin(this.camPitch) * 2.15;

      _camDesired.set(desiredX, desiredY, desiredZ);
      this.clampCameraToWorld(this.playerX, py + 1.35, this.playerZ, _camDesired);

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 11, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 9, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 11, dt);

      _camTarget.set(
        this.playerX + rightX * 0.44 - Math.sin(orbitYaw) * 1.65,
        py + 1.24,
        this.playerZ + rightZ * 0.44 - Math.cos(orbitYaw) * 1.65,
      );
      this.camera.lookAt(_camTarget);
      return;
    }

    // GTA Dynamic Vehicle Chase Camera with cornering lateral swing & speed pullback
    let dist = (spec.isMoto ? 5.65 : 6.1 + spec.length * 0.48) * this.camZoom;
    let height = (spec.isMoto ? 2.15 : 2.35 + spec.height * 0.45) * this.camZoom;

    if (this.cameraMode === 'chase_close') {
      dist = (spec.isMoto ? 3.9 : 4.5 + spec.length * 0.35) * this.camZoom;
      height = (spec.isMoto ? 1.68 : 1.88 + spec.height * 0.35) * this.camZoom;
    } else if (this.cameraMode === 'top_down') {
      dist = 16.5 * this.camZoom;
      height = 22.0 * this.camZoom;
    }

    dist += speedRatio * 1.15;

    const orbitYaw = this.playerYaw + Math.PI + this.camYawOffset;
    const rightX = -Math.cos(orbitYaw);
    const rightZ = Math.sin(orbitYaw);
    const cornerSwing =
      this.cameraMode === 'top_down' ? 0 : -this.steerAngle * speedRatio * 0.85;

    const desiredX = this.playerX + Math.sin(orbitYaw) * dist + rightX * cornerSwing;
    const desiredZ = this.playerZ + Math.cos(orbitYaw) * dist + rightZ * cornerSwing;
    const desiredY = py + height + Math.sin(this.camPitch) * 2.05;

    _camDesired.set(desiredX, desiredY, desiredZ);
    this.clampCameraToWorld(this.playerX, py + baseHeight * 0.8, this.playerZ, _camDesired);

    if (this.snapCameraNextFrame) {
      this.camera.position.copy(_camDesired);
      this.snapCameraNextFrame = false;
    } else {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camDesired.x, 9.5, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camDesired.y, 7.5, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camDesired.z, 9.5, dt);
    }

    // Camera impact shake decay
    if (this.cameraShake > 0.002) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 12, dt);
    }

    _camTarget.set(
      this.playerX + Math.sin(this.playerYaw) * 2.6,
      py + baseHeight * 0.78,
      this.playerZ + Math.cos(this.playerYaw) * 2.6,
    );
    this.camera.lookAt(_camTarget);
  }

  private pushHudSnapshot(): void {
    const vState = this.ownedVehicles[this.activeVehicleId];
    const spec = VEHICLE_SPECS[this.activeVehicleId];
    const lvInfo = PROGRESSION_LEVELS[this.level - 1];
    const nextLv = PROGRESSION_LEVELS[this.level] || null;
    const district = getDistrictAt(this.playerX, this.playerZ);

    let deliveryDistanceMeters = 0;
    if (this.activeOrder) {
      const tx =
        this.deliveryPhase === 'TO_DEPOT' ? -120 : this.activeOrder.targetX;
      const tz =
        this.deliveryPhase === 'TO_DEPOT' ? 91 : this.activeOrder.targetZ;
      deliveryDistanceMeters = Math.round(
        Math.hypot(this.playerX - tx, this.playerZ - tz),
      );
    }

    const eventLabels: Record<RandomEventType, string> = {
      none: '',
      transito_intenso: 'Trânsito Intenso',
      chuva_forte: 'Chuva Forte (+35% Bônus)',
      cliente_impaciente: 'Cliente Impaciente',
      pico_pedidos: 'Alta Demanda de Pedidos',
    };

    // Clone ownedVehicles shallowly so React sees clean state
    const vehiclesCopy = {} as Record<VehicleTypeId, OwnedVehicleState>;
    (Object.keys(this.ownedVehicles) as VehicleTypeId[]).forEach((k) => {
      vehiclesCopy[k] = { ...this.ownedVehicles[k] };
    });

    this.callbacks.onHudUpdate({
      mode: this.mode,
      money: Math.round(this.money),
      xp: Math.round(this.xp),
      level: this.level,
      levelTitle: lvInfo.title,
      nextLevelXp: nextLv ? nextLv.minXp : null,
      currentDistrict: district,
      currentDistrictName: DISTRICT_NAMES[district],
      inVehicle: this.inVehicle,
      activeVehicleId: this.activeVehicleId,
      activeVehicleName: spec.name,
      speedKmh: Math.round(Math.abs(this.speedMs) * 3.6),
      fuel: Math.round(vState.fuel),
      health: Math.round(vState.health),
      loadedCylinders: vState.loadedCylinders,
      maxCargoCapacity: this.getMaxCargoCapacity(this.activeVehicleId),
      carryingOnFoot: this.carryingOnFoot,
      gameTimeMinutes: Math.floor(this.gameTimeMinutes),
      dayCount: this.dayCount,
      weather: this.weather,
      activeEvent: this.activeEvent,
      activeEventLabel: eventLabels[this.activeEvent],
      activeOrder: this.activeOrder ? { ...this.activeOrder } : null,
      deliveryPhase: this.deliveryPhase,
      deliveryDistanceMeters,
      availableOrders: this.availableOrders,
      interactionPrompt: this.getCurrentInteractionPrompt(),
      customWaypoint: this.customWaypoint,
      cameraMode: this.cameraMode,
      muted: this.audio.muted,
      musicEnabled: this.audio.musicEnabled,
      company: {
        ...this.company,
        employees: this.company.employees.map((e) => ({ ...e })),
        branches: this.company.branches.map((b) => ({ ...b })),
      },
      ownedVehicles: vehiclesCopy,
      playerPos: { x: this.playerX, z: this.playerZ, yaw: this.playerYaw },
      trafficDots: this.trafficAgents
        .filter((ag) => Math.hypot(ag.x - this.playerX, ag.z - this.playerZ) < 190)
        .map((ag) => ({ x: Math.round(ag.x), z: Math.round(ag.z) })),
      lastDeliverySummary: this.lastDeliverySummary,
    });
  }

  public getOwnedVehicleIds(): VehicleTypeId[] {
    return (Object.keys(VEHICLE_SPECS) as VehicleTypeId[]).filter((id) =>
      this.isVehicleOwned(id),
    );
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('wheel', this.onWheel);

    this.audio.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
