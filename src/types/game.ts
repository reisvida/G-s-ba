export type GameStateMode = 'TITLE_MENU' | 'PLAYING' | 'PAUSED';

export type DistrictId =
  | 'vila_nova'
  | 'centro'
  | 'morro'
  | 'rodovia'
  | 'industrial'
  | 'jardim';

export type VehicleTypeId =
  | 'moto_simples'
  | 'moto_carga'
  | 'fiorino'
  | 'kombi'
  | 'caminhao_pequeno'
  | 'caminhao_dist';

export type MissionType =
  | 'padrao'
  | 'urgente'
  | 'distante'
  | 'viela'
  | 'chuva'
  | 'multiplos'
  | 'vip'
  | 'restaurante'
  | 'emergencia';

export type PaymentMethod = 'dinheiro' | 'cartao';

export type WeatherType = 'ensolarado' | 'nublado' | 'chuva';

export type RandomEventType =
  | 'none'
  | 'transito_intenso'
  | 'chuva_forte'
  | 'cliente_impaciente'
  | 'pico_pedidos';

export type ActiveDeliveryPhase =
  | 'TO_DEPOT'
  | 'LOADING_ANIM'
  | 'TO_CUSTOMER'
  | 'UNLOADING_ANIM'
  | 'RINGING_ANIM'
  | 'PAYING_ANIM';

export type CameraMode = 'chase_far' | 'chase_close' | 'hood' | 'top_down';

export type PhoneAppTab = 'pedidos' | 'mapa' | 'empresa' | 'garagem';

export interface VehicleColorOption {
  id: string;
  name: string;
  hex: number;
  css: string;
}

export interface VehicleSpec {
  id: VehicleTypeId;
  name: string;
  subtitle: string;
  category: 'Motocicleta' | 'Utilitário' | 'Caminhão';
  price: number;
  unlockLevel: number;
  maxSpeedKmh: number;
  acceleration: number; // m/s^2
  braking: number;
  turnSpeed: number; // rad/s
  fuelConsumption: number; // % per km
  cargoCapacity: number; // max P13 cylinders
  isMoto: boolean;
  length: number;
  width: number;
  height: number;
  wheelRadius: number;
  defaultColor: number;
}

export interface OwnedVehicleState {
  typeId: VehicleTypeId;
  colorHex: number;
  engineLevel: number; // 1..3
  cargoLevel: number; // 1..3 (+1 or +2 capacity)
  fuel: number; // 0..100
  health: number; // 0..100
  x: number;
  y: number;
  z: number;
  yaw: number;
  loadedCylinders: number;
}

export interface DeliveryOrder {
  id: string;
  clientName: string;
  address: string;
  district: DistrictId;
  districtName: string;
  missionType: MissionType;
  missionLabel: string;
  productLabel: string;
  cylindersRequired: number;
  reward: number;
  xpReward: number;
  timeLimitSec: number;
  timeRemainingSec: number;
  paymentMethod: PaymentMethod;
  targetX: number;
  targetZ: number;
  distanceMeters: number;
  unlockLevel: number;
  isNarrowAlley?: boolean;
}

export interface EmployeeDriver {
  id: string;
  name: string;
  role: string;
  vehicleLabel: string;
  hireCost: number;
  dailyNetProfit: number;
  hired: boolean;
}

export interface BranchDepot {
  id: string;
  name: string;
  district: DistrictId;
  districtName: string;
  x: number;
  z: number;
  price: number;
  dailyIncome: number;
  owned: boolean;
}

export interface CompanyState {
  depotLevel: number; // 1..4
  stockFull: number;
  stockEmpty: number;
  maxStock: number;
  employees: EmployeeDriver[];
  branches: BranchDepot[];
  totalDeliveriesCompleted: number;
  totalRevenue: number;
  lastCycleProfit: number;
}

export interface ProgressionLevel {
  level: number;
  title: string;
  minXp: number;
  rewardMultiplier: number;
  unlockedDistricts: DistrictId[];
  perkDescription: string;
}

export interface WorldPOI {
  id: string;
  type: 'depot' | 'branch' | 'gas_station' | 'workshop' | 'wholesale' | 'speed_camera';
  name: string;
  district: DistrictId;
  x: number;
  z: number;
  radius: number;
}

export interface InteractionPrompt {
  id: string;
  label: string;
  sublabel?: string;
  actionType:
    | 'enter_vehicle'
    | 'exit_vehicle'
    | 'load_cylinder'
    | 'deliver_cylinder'
    | 'refuel'
    | 'repair'
    | 'wholesale_buy';
  cost?: number;
}

export interface NotificationToast {
  id: number;
  title: string;
  detail: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}

export interface HudSnapshot {
  mode: GameStateMode;
  money: number;
  xp: number;
  level: number;
  levelTitle: string;
  nextLevelXp: number | null;
  currentDistrict: DistrictId;
  currentDistrictName: string;
  inVehicle: boolean;
  activeVehicleId: VehicleTypeId;
  activeVehicleName: string;
  speedKmh: number;
  fuel: number;
  health: number;
  loadedCylinders: number;
  maxCargoCapacity: number;
  carryingOnFoot: boolean;
  gameTimeMinutes: number; // 0..1440
  dayCount: number;
  weather: WeatherType;
  activeEvent: RandomEventType;
  activeEventLabel: string;
  activeOrder: DeliveryOrder | null;
  deliveryPhase: ActiveDeliveryPhase | null;
  deliveryDistanceMeters: number;
  availableOrders: DeliveryOrder[];
  interactionPrompt: InteractionPrompt | null;
  customWaypoint: { x: number; z: number; label: string } | null;
  cameraMode: CameraMode;
  muted: boolean;
  musicEnabled: boolean;
  company: CompanyState;
  ownedVehicles: Record<VehicleTypeId, OwnedVehicleState>;
  playerPos: { x: number; z: number; yaw: number };
  trafficDots: { x: number; z: number }[];
  lastDeliverySummary: {
    clientName: string;
    basePay: number;
    tip: number;
    stars: number;
    paymentMethod: PaymentMethod;
    xpEarned: number;
  } | null;
}

export const VEHICLE_COLORS: VehicleColorOption[] = [
  { id: 'vermelho', name: 'Vermelho Brasil', hex: 0xd92b2b, css: '#d92b2b' },
  { id: 'azul', name: 'Azul Chama', hex: 0x1d6fe8, css: '#1d6fe8' },
  { id: 'amarelo', name: 'Amarelo Gás', hex: 0xeab308, css: '#eab308' },
  { id: 'verde', name: 'Verde Bandeira', hex: 0x16a34a, css: '#16a34a' },
  { id: 'preto', name: 'Preto Fosco', hex: 0x1e293b, css: '#1e293b' },
  { id: 'branco', name: 'Branco Ártico', hex: 0xf1f5f9, css: '#f1f5f9' },
];

export const VEHICLE_SPECS: Record<VehicleTypeId, VehicleSpec> = {
  moto_simples: {
    id: 'moto_simples',
    name: 'Moto CG 125 Carga',
    subtitle: 'Ágil nas vielas e econômica',
    category: 'Motocicleta',
    price: 0,
    unlockLevel: 1,
    maxSpeedKmh: 76,
    acceleration: 14.5,
    braking: 22,
    turnSpeed: 2.75,
    fuelConsumption: 2.4,
    cargoCapacity: 2,
    isMoto: true,
    length: 2.05,
    width: 0.78,
    height: 1.15,
    wheelRadius: 0.32,
    defaultColor: 0x1e293b,
  },
  moto_carga: {
    id: 'moto_carga',
    name: 'Moto Titan 160 Pro',
    subtitle: 'Bagageiro reforçado para 4 botijões',
    category: 'Motocicleta',
    price: 2600,
    unlockLevel: 1,
    maxSpeedKmh: 92,
    acceleration: 17.5,
    braking: 25,
    turnSpeed: 2.65,
    fuelConsumption: 2.9,
    cargoCapacity: 4,
    isMoto: true,
    length: 2.15,
    width: 0.86,
    height: 1.2,
    wheelRadius: 0.34,
    defaultColor: 0x1d6fe8,
  },
  fiorino: {
    id: 'fiorino',
    name: 'Fiorino Furgão 1.4',
    subtitle: 'Proteção contra chuva e 8 botijões',
    category: 'Utilitário',
    price: 7800,
    unlockLevel: 2,
    maxSpeedKmh: 106,
    acceleration: 13.5,
    braking: 21,
    turnSpeed: 2.15,
    fuelConsumption: 5.5,
    cargoCapacity: 8,
    isMoto: false,
    length: 4.1,
    width: 1.72,
    height: 1.9,
    wheelRadius: 0.34,
    defaultColor: 0xf1f5f9,
  },
  kombi: {
    id: 'kombi',
    name: 'Kombi Clássica Gás',
    subtitle: 'Ícone das ruas brasileiras · 12 botijões',
    category: 'Utilitário',
    price: 13500,
    unlockLevel: 2,
    maxSpeedKmh: 96,
    acceleration: 11.8,
    braking: 19,
    turnSpeed: 2.0,
    fuelConsumption: 6.8,
    cargoCapacity: 12,
    isMoto: false,
    length: 4.45,
    width: 1.82,
    height: 2.08,
    wheelRadius: 0.36,
    defaultColor: 0xeab308,
  },
  caminhao_pequeno: {
    id: 'caminhao_pequeno',
    name: 'Caminhão VUC 3/4 Gaiola',
    subtitle: 'Carroceria gradeada para 24 botijões',
    category: 'Caminhão',
    price: 26000,
    unlockLevel: 3,
    maxSpeedKmh: 90,
    acceleration: 9.8,
    braking: 17,
    turnSpeed: 1.72,
    fuelConsumption: 9.2,
    cargoCapacity: 24,
    isMoto: false,
    length: 5.6,
    width: 2.15,
    height: 2.55,
    wheelRadius: 0.44,
    defaultColor: 0xd92b2b,
  },
  caminhao_dist: {
    id: 'caminhao_dist',
    name: 'Truck Distribuidor 1620',
    subtitle: 'Frota pesada · 45 botijões por viagem',
    category: 'Caminhão',
    price: 52000,
    unlockLevel: 4,
    maxSpeedKmh: 86,
    acceleration: 8.5,
    braking: 15.5,
    turnSpeed: 1.5,
    fuelConsumption: 12.5,
    cargoCapacity: 45,
    isMoto: false,
    length: 7.2,
    width: 2.42,
    height: 2.95,
    wheelRadius: 0.5,
    defaultColor: 0x1d6fe8,
  },
};

export const PROGRESSION_LEVELS: ProgressionLevel[] = [
  {
    level: 1,
    title: 'Entregador Iniciante',
    minXp: 0,
    rewardMultiplier: 1.0,
    unlockedDistricts: ['vila_nova', 'centro'],
    perkDescription: 'Acesso a Vila Nova, Centro Comercial e Motocicletas de entrega.',
  },
  {
    level: 2,
    title: 'Entregador Profissional',
    minXp: 240,
    rewardMultiplier: 1.15,
    unlockedDistricts: ['vila_nova', 'centro', 'morro'],
    perkDescription: 'Desbloqueia Morro da Esperança, Fiorino, Kombi e bônus de chuva.',
  },
  {
    level: 3,
    title: 'Dono de Pequeno Depósito',
    minXp: 650,
    rewardMultiplier: 1.3,
    unlockedDistricts: ['vila_nova', 'centro', 'morro', 'rodovia', 'industrial'],
    perkDescription: 'Desbloqueia Distrito Industrial, Caminhão VUC e contratação de motoristas.',
  },
  {
    level: 4,
    title: 'Empresário de Distribuição',
    minXp: 1400,
    rewardMultiplier: 1.5,
    unlockedDistricts: ['vila_nova', 'centro', 'morro', 'rodovia', 'industrial', 'jardim'],
    perkDescription: 'Desbloqueia Jardim Imperial (VIP), Truck 1620 e filiais regionais.',
  },
  {
    level: 5,
    title: 'Magnata do Gás',
    minXp: 2800,
    rewardMultiplier: 1.75,
    unlockedDistricts: ['vila_nova', 'centro', 'morro', 'rodovia', 'industrial', 'jardim'],
    perkDescription: 'Contratos de emergência, lucro máximo da distribuidora e frota completa.',
  },
];

export const DISTRICT_NAMES: Record<DistrictId, string> = {
  vila_nova: 'Vila Nova',
  centro: 'Centro Comercial',
  morro: 'Morro da Esperança',
  rodovia: 'Rodovia BR-116',
  industrial: 'Distrito Industrial',
  jardim: 'Jardim Imperial',
};

export const DEPOT_UPGRADE_TIERS = [
  { level: 1, name: 'Depósito Pequeno', maxStock: 10, upgradeCost: 0 },
  { level: 2, name: 'Depósito Médio', maxStock: 28, upgradeCost: 1800 },
  { level: 3, name: 'Depósito Grande', maxStock: 65, upgradeCost: 5500 },
  { level: 4, name: 'Mega Centro Logístico', maxStock: 150, upgradeCost: 14000 },
];

export const INITIAL_EMPLOYEES: EmployeeDriver[] = [
  {
    id: 'emp_lucas',
    name: 'Lucas Silva',
    role: 'Motoboy de Bairro',
    vehicleLabel: 'CG 125 Carga',
    hireCost: 950,
    dailyNetProfit: 180,
    hired: false,
  },
  {
    id: 'emp_carla',
    name: 'Carla Mendes',
    role: 'Entregadora Express',
    vehicleLabel: 'Titan 160 Pro',
    hireCost: 1650,
    dailyNetProfit: 310,
    hired: false,
  },
  {
    id: 'emp_rafael',
    name: 'Rafael Costa',
    role: 'Motorista Utilitário',
    vehicleLabel: 'Fiorino Furgão',
    hireCost: 3400,
    dailyNetProfit: 580,
    hired: false,
  },
  {
    id: 'emp_marcos',
    name: 'Marcos Oliveira',
    role: 'Motorista de Rota',
    vehicleLabel: 'Kombi Gás',
    hireCost: 5200,
    dailyNetProfit: 860,
    hired: false,
  },
  {
    id: 'emp_thiago',
    name: 'Thiago Ferreira',
    role: 'Condutor Pesado',
    vehicleLabel: 'Caminhão VUC',
    hireCost: 9500,
    dailyNetProfit: 1450,
    hired: false,
  },
];

export const INITIAL_BRANCHES: BranchDepot[] = [
  {
    id: 'branch_centro',
    name: 'Filial Centro Comercial',
    district: 'centro',
    districtName: 'Centro Comercial',
    x: 72,
    z: -32,
    price: 4200,
    dailyIncome: 420,
    owned: false,
  },
  {
    id: 'branch_morro',
    name: 'Ponto Morro da Esperança',
    district: 'morro',
    districtName: 'Morro da Esperança',
    x: -176,
    z: -110,
    price: 6800,
    dailyIncome: 690,
    owned: false,
  },
  {
    id: 'branch_industrial',
    name: 'Hub Distrito Industrial',
    district: 'industrial',
    districtName: 'Distrito Industrial',
    x: 112,
    z: 190,
    price: 12500,
    dailyIncome: 1280,
    owned: false,
  },
];
