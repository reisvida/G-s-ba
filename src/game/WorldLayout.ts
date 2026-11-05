import { DistrictId, MissionType, WorldPOI } from '../types/game';

export interface RoadSegment {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  surface: 'asphalt' | 'dirt' | 'alley';
  hasSidewalk: boolean;
  speedLimit: number;
  district: DistrictId;
}

export interface CustomerHouse {
  id: string;
  name: string; // e.g., "Casa da Dona Maria" or "Restaurante Sabor Brasil"
  clientName: string;
  address: string;
  district: DistrictId;
  buildingType: 'casa' | 'sobrado' | 'comercio' | 'restaurante' | 'mansao';
  houseX: number;
  houseZ: number;
  yaw: number; // facing toward road
  dropX: number; // road-side dropoff point
  dropZ: number;
  wallColor: number;
  preferredMissionTypes: MissionType[];
  isNarrowAlley?: boolean;
}

export interface BuildingBlock {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  yaw: number;
  style: 'casa' | 'sobrado' | 'loja' | 'galpao' | 'predio' | 'mansao';
  wallColor: number;
  roofColor: number;
  hasWaterTank: boolean;
  signText?: string;
}

export interface SpeedBump {
  x: number;
  z: number;
  yaw: number;
  width: number;
}

export const WORLD_HALF_SIZE = 420;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Continuous heightfield for the entire open world.
 * Main urban grid is y = 0; Morro da Esperanca (NW quadrant) rises smoothly up to +12m;
 * outer perimeter hills frame the horizon naturally.
 */
export function groundHeightAt(x: number, z: number): number {
  // Morro da Esperanca hill (x < -150, z < 20)
  const hillWest = smoothstep(-152, -235, x);
  const hillNorth = smoothstep(25, -75, z);
  const hillSouthFade = 1 - smoothstep(-290, -370, z);
  const morroElevation = hillWest * hillNorth * hillSouthFade * 11.5;

  // Gentle outer horizon hills beyond playable road ring (|x| > 335 or |z| > 335)
  const outerX = smoothstep(335, 480, Math.abs(x));
  const outerZ = smoothstep(335, 480, Math.abs(z));
  const outerWave =
    (Math.sin(x * 0.018) * Math.cos(z * 0.018) * 0.5 + 0.5) * 16 + 6;
  const outerElevation = Math.max(outerX, outerZ) * outerWave;

  return morroElevation + outerElevation;
}

/**
 * Returns approximate terrain normal for vehicle pitch/roll alignment on slopes.
 */
export function groundNormalAt(
  x: number,
  z: number,
  out: { x: number; y: number; z: number },
): void {
  const eps = 1.2;
  const hL = groundHeightAt(x - eps, z);
  const hR = groundHeightAt(x + eps, z);
  const hD = groundHeightAt(x, z - eps);
  const hU = groundHeightAt(x, z + eps);
  const nx = hL - hR;
  const ny = 2 * eps;
  const nz = hD - hU;
  const len = Math.hypot(nx, ny, nz) || 1;
  out.x = nx / len;
  out.y = ny / len;
  out.z = nz / len;
}

export function getDistrictAt(x: number, z: number): DistrictId {
  if (x >= 205) return 'rodovia';
  if (x < -145 && z < 20) return 'morro';
  if (x >= 30 && z < -120) return 'jardim';
  if (x >= 45 && z >= 80) return 'industrial';
  if (x >= -145 && x < 145 && z >= -130 && z < 35) return 'centro';
  return 'vila_nova';
}

export const ROAD_SEGMENTS: RoadSegment[] = [
  // North-South Avenues
  {
    id: 'ns_terra_oeste',
    x1: -310,
    z1: -260,
    x2: -310,
    z2: 140,
    width: 6.5,
    surface: 'dirt',
    hasSidewalk: false,
    speedLimit: 45,
    district: 'morro',
  },
  {
    id: 'ns_serra',
    x1: -240,
    z1: -260,
    x2: -240,
    z2: 140,
    width: 8.5,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 40,
    district: 'morro',
  },
  // Narrow Alley (Beco) in Morro
  {
    id: 'ns_beco_esperanca',
    x1: -200,
    z1: -260,
    x2: -200,
    z2: -60,
    width: 3.3,
    surface: 'alley',
    hasSidewalk: false,
    speedLimit: 25,
    district: 'morro',
  },
  {
    id: 'ns_sao_jorge',
    x1: -150,
    z1: -260,
    x2: -150,
    z2: 240,
    width: 10,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'vila_nova',
  },
  {
    id: 'ns_deposito_acesso',
    x1: -114,
    z1: 40,
    x2: -114,
    z2: 88,
    width: 7,
    surface: 'asphalt',
    hasSidewalk: false,
    speedLimit: 35,
    district: 'vila_nova',
  },
  {
    id: 'ns_brasil',
    x1: -50,
    z1: -260,
    x2: -50,
    z2: 240,
    width: 11,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'centro',
  },
  {
    id: 'ns_paulista',
    x1: 50,
    z1: -260,
    x2: 50,
    z2: 240,
    width: 11,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'centro',
  },
  {
    id: 'ns_industrial',
    x1: 150,
    z1: -260,
    x2: 150,
    z2: 240,
    width: 11,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 60,
    district: 'industrial',
  },
  {
    id: 'ns_rodovia',
    x1: 240,
    z1: -320,
    x2: 240,
    z2: 300,
    width: 15,
    surface: 'asphalt',
    hasSidewalk: false,
    speedLimit: 90,
    district: 'rodovia',
  },

  // East-West Streets
  {
    id: 'ew_ipes',
    x1: -310,
    z1: -260,
    x2: 240,
    z2: -260,
    width: 10,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'jardim',
  },
  {
    id: 'ew_comercio_norte',
    x1: -240,
    z1: -160,
    x2: 240,
    z2: -160,
    width: 10,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'centro',
  },
  // Narrow Alley (Viela) in Morro
  {
    id: 'ew_viela_ladeira',
    x1: -240,
    z1: -110,
    x2: -150,
    z2: -110,
    width: 3.3,
    surface: 'alley',
    hasSidewalk: false,
    speedLimit: 25,
    district: 'morro',
  },
  {
    id: 'ew_central',
    x1: -310,
    z1: -60,
    x2: 240,
    z2: -60,
    width: 11,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'centro',
  },
  {
    id: 'ew_flores',
    x1: -240,
    z1: 40,
    x2: 240,
    z2: 40,
    width: 10,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'vila_nova',
  },
  {
    id: 'ew_paz',
    x1: -310,
    z1: 140,
    x2: 240,
    z2: 140,
    width: 10,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 50,
    district: 'vila_nova',
  },
  {
    id: 'ew_logistica',
    x1: -150,
    z1: 240,
    x2: 240,
    z2: 240,
    width: 12,
    surface: 'asphalt',
    hasSidewalk: true,
    speedLimit: 60,
    district: 'industrial',
  },
];

export const WORLD_POIS: WorldPOI[] = [
  {
    id: 'poi_depot_main',
    type: 'depot',
    name: 'Depósito São Jorge (Matriz)',
    district: 'vila_nova',
    x: -124,
    z: 88,
    radius: 13,
  },
  {
    id: 'poi_gas_vila',
    type: 'gas_station',
    name: 'Posto PetroBrasil Vila Nova',
    district: 'vila_nova',
    x: -24,
    z: 66,
    radius: 11,
  },
  {
    id: 'poi_gas_rodovia',
    type: 'gas_station',
    name: 'Auto Posto Rodovia BR-116',
    district: 'rodovia',
    x: 214,
    z: -105,
    radius: 12,
  },
  {
    id: 'poi_workshop_vila',
    type: 'workshop',
    name: 'Oficina Mecânica do Beto',
    district: 'vila_nova',
    x: -124,
    z: 164,
    radius: 10,
  },
  {
    id: 'poi_workshop_ind',
    type: 'workshop',
    name: 'Centro Automotivo Diesel',
    district: 'industrial',
    x: 78,
    z: 166,
    radius: 11,
  },
  {
    id: 'poi_wholesale',
    type: 'wholesale',
    name: 'Atacadão do Gás (Envase)',
    district: 'industrial',
    x: 184,
    z: 196,
    radius: 14,
  },
  {
    id: 'poi_radar_1',
    type: 'speed_camera',
    name: 'Radar Av. Brasil (50 km/h)',
    district: 'centro',
    x: -50,
    z: -10,
    radius: 9,
  },
  {
    id: 'poi_radar_2',
    type: 'speed_camera',
    name: 'Radar Av. Central (50 km/h)',
    district: 'centro',
    x: 0,
    z: -60,
    radius: 9,
  },
];

export const CUSTOMER_HOUSES: CustomerHouse[] = [
  // Vila Nova (Starter neighborhood - Lv 1)
  {
    id: 'cust_maria',
    name: 'Casa da Dona Maria',
    clientName: 'Dona Maria Aparecida',
    address: 'Rua das Flores, 118 · Vila Nova',
    district: 'vila_nova',
    buildingType: 'casa',
    houseX: -95,
    houseZ: 22,
    yaw: 0,
    dropX: -95,
    dropZ: 33,
    wallColor: 0xf4a261,
    preferredMissionTypes: ['padrao', 'urgente'],
  },
  {
    id: 'cust_ze',
    name: 'Mercadinho do Zé',
    clientName: 'José Ferreira',
    address: 'Av. Brasil, 240 · Vila Nova',
    district: 'vila_nova',
    buildingType: 'comercio',
    houseX: -72,
    houseZ: 92,
    yaw: Math.PI / 2,
    dropX: -58,
    dropZ: 92,
    wallColor: 0x38bdf8,
    preferredMissionTypes: ['padrao', 'multiplos'],
  },
  {
    id: 'cust_paula',
    name: 'Sobrado da Paula',
    clientName: 'Paula Oliveira',
    address: 'Rua da Paz, 84 · Vila Nova',
    district: 'vila_nova',
    buildingType: 'sobrado',
    houseX: -90,
    houseZ: 122,
    yaw: 0,
    dropX: -90,
    dropZ: 133,
    wallColor: 0xe9c46a,
    preferredMissionTypes: ['padrao', 'urgente'],
  },
  {
    id: 'cust_joao',
    name: 'Casa do Seu João',
    clientName: 'João Batista',
    address: 'Av. São Jorge, 310 · Vila Nova',
    district: 'vila_nova',
    buildingType: 'casa',
    houseX: -170,
    houseZ: 95,
    yaw: Math.PI / 2,
    dropX: -158,
    dropZ: 95,
    wallColor: 0x90be6d,
    preferredMissionTypes: ['padrao', 'chuva'],
  },
  {
    id: 'cust_padaria_vila',
    name: 'Padaria Pão Quente',
    clientName: 'Antônio Padeiro',
    address: 'Rua das Flores, 305 · Vila Nova',
    district: 'vila_nova',
    buildingType: 'restaurante',
    houseX: 8,
    houseZ: 22,
    yaw: 0,
    dropX: 8,
    dropZ: 33,
    wallColor: 0xf97316,
    preferredMissionTypes: ['restaurante', 'multiplos', 'emergencia'],
  },

  // Centro Comercial (Lv 1)
  {
    id: 'cust_sabor_brasil',
    name: 'Restaurante Sabor Brasil',
    clientName: 'Chef Rodrigo',
    address: 'Av. Central, 450 · Centro',
    district: 'centro',
    buildingType: 'restaurante',
    houseX: -5,
    houseZ: -78,
    yaw: 0,
    dropX: -5,
    dropZ: -67,
    wallColor: 0xd92b2b,
    preferredMissionTypes: ['restaurante', 'multiplos', 'urgente'],
  },
  {
    id: 'cust_lanchonete',
    name: 'Lanchonete Praça Sul',
    clientName: 'Camila Santos',
    address: 'Av. Paulista Sul, 190 · Centro',
    district: 'centro',
    buildingType: 'comercio',
    houseX: 30,
    houseZ: -15,
    yaw: Math.PI / 2,
    dropX: 42,
    dropZ: -15,
    wallColor: 0xfacc15,
    preferredMissionTypes: ['padrao', 'urgente'],
  },
  {
    id: 'cust_clinica',
    name: 'Clínica Popular Vida',
    clientName: 'Dra. Helena',
    address: 'Rua do Comércio, 112 · Centro',
    district: 'centro',
    buildingType: 'sobrado',
    houseX: -95,
    houseZ: -142,
    yaw: Math.PI,
    dropX: -95,
    dropZ: -153,
    wallColor: 0xf8fafc,
    preferredMissionTypes: ['emergencia', 'urgente'],
  },
  {
    id: 'cust_churrascaria',
    name: 'Churrascaria Gaúcha',
    clientName: 'Marcos Churrasqueiro',
    address: 'Av. Central, 720 · Centro',
    district: 'centro',
    buildingType: 'restaurante',
    houseX: 98,
    houseZ: -78,
    yaw: 0,
    dropX: 98,
    dropZ: -67,
    wallColor: 0xb45309,
    preferredMissionTypes: ['restaurante', 'multiplos'],
  },

  // Morro da Esperança (Lv 2 - Steep hills, narrow alleys & dirt roads)
  {
    id: 'cust_beco_1',
    name: 'Casa da Tia Neide',
    clientName: 'Tia Neide',
    address: 'Beco da Esperança, 18 · Morro',
    district: 'morro',
    buildingType: 'casa',
    houseX: -214,
    houseZ: -145,
    yaw: Math.PI / 2,
    dropX: -201,
    dropZ: -145,
    wallColor: 0xf43f5e,
    preferredMissionTypes: ['viela', 'padrao'],
    isNarrowAlley: true,
  },
  {
    id: 'cust_beco_2',
    name: 'Bar do Mirante',
    clientName: 'Chico do Morro',
    address: 'Viela da Ladeira, 42 · Morro',
    district: 'morro',
    buildingType: 'comercio',
    houseX: -178,
    houseZ: -124,
    yaw: 0,
    dropX: -178,
    dropZ: -111,
    wallColor: 0x0ea5e9,
    preferredMissionTypes: ['viela', 'urgente'],
    isNarrowAlley: true,
  },
  {
    id: 'cust_morro_topo',
    name: 'Residência Alto da Serra',
    clientName: 'Fernanda Lima',
    address: 'Rua da Serra, 510 · Morro',
    district: 'morro',
    buildingType: 'sobrado',
    houseX: -258,
    houseZ: -195,
    yaw: Math.PI / 2,
    dropX: -245,
    dropZ: -195,
    wallColor: 0xf59e0b,
    preferredMissionTypes: ['distante', 'chuva'],
  },
  {
    id: 'cust_terra_sitio',
    name: 'Chácara Pedra Branca',
    clientName: 'Seu Benedito',
    address: 'Estrada da Pedreira, km 2 · Morro',
    district: 'morro',
    buildingType: 'casa',
    houseX: -328,
    houseZ: -120,
    yaw: Math.PI / 2,
    dropX: -314,
    dropZ: -120,
    wallColor: 0x84cc16,
    preferredMissionTypes: ['distante', 'chuva'],
  },

  // Distrito Industrial & Rodovia (Lv 3)
  {
    id: 'cust_fabrica_doces',
    name: 'Fábrica de Doces Mineira',
    clientName: 'Gerente Roberto',
    address: 'Av. Industrial, 890 · Dist. Industrial',
    district: 'industrial',
    buildingType: 'comercio',
    houseX: 128,
    houseZ: 105,
    yaw: Math.PI / 2,
    dropX: 143,
    dropZ: 105,
    wallColor: 0x64748b,
    preferredMissionTypes: ['multiplos', 'distante'],
  },
  {
    id: 'cust_rest_rodovia',
    name: 'Parada do Caminhoneiro',
    clientName: 'Dona Lúcia',
    address: 'Rodovia BR-116, km 14 · Rodovia',
    district: 'rodovia',
    buildingType: 'restaurante',
    houseX: 215,
    houseZ: 15,
    yaw: Math.PI / 2,
    dropX: 230,
    dropZ: 15,
    wallColor: 0xea580c,
    preferredMissionTypes: ['restaurante', 'multiplos', 'distante'],
  },
  {
    id: 'cust_lavanderia',
    name: 'Lavanderia Industrial Sul',
    clientName: 'Sérgio Mendes',
    address: 'Av. Logística, 400 · Dist. Industrial',
    district: 'industrial',
    buildingType: 'comercio',
    houseX: 95,
    houseZ: 258,
    yaw: Math.PI,
    dropX: 95,
    dropZ: 246,
    wallColor: 0x3b82f6,
    preferredMissionTypes: ['multiplos', 'emergencia'],
  },

  // Jardim Imperial (Lv 4 - VIP Mansions & Upscale Restaurants)
  {
    id: 'cust_vip_1',
    name: 'Mansão Villa Toscana',
    clientName: 'Dr. Henrique Alencar',
    address: 'Av. dos Ipês, 1200 · Jardim Imperial',
    district: 'jardim',
    buildingType: 'mansao',
    houseX: 95,
    houseZ: -282,
    yaw: 0,
    dropX: 95,
    dropZ: -267,
    wallColor: 0xfef3c7,
    preferredMissionTypes: ['vip', 'urgente'],
  },
  {
    id: 'cust_vip_2',
    name: 'Condomínio Sol Nascente',
    clientName: 'Síndica Patrícia',
    address: 'Av. Paulista Sul, 980 · Jardim Imperial',
    district: 'jardim',
    buildingType: 'mansao',
    houseX: 26,
    houseZ: -210,
    yaw: Math.PI / 2,
    dropX: 42,
    dropZ: -210,
    wallColor: 0xe2e8f0,
    preferredMissionTypes: ['vip', 'multiplos'],
  },
  {
    id: 'cust_vip_bistro',
    name: 'Bistrô Imperial Gourmet',
    clientName: 'Chef Laurent',
    address: 'Rua do Comércio, 850 · Jardim Imperial',
    district: 'jardim',
    buildingType: 'restaurante',
    houseX: 110,
    houseZ: -178,
    yaw: 0,
    dropX: 110,
    dropZ: -167,
    wallColor: 0x1e293b,
    preferredMissionTypes: ['vip', 'restaurante', 'multiplos'],
  },
];

export const SPEED_BUMPS: SpeedBump[] = [
  { x: -105, z: 40, yaw: 0, width: 9.5 },
  { x: -50, z: 85, yaw: Math.PI / 2, width: 10.5 },
  { x: -50, z: -25, yaw: Math.PI / 2, width: 10.5 },
  { x: 0, z: -60, yaw: 0, width: 10.5 },
  { x: -150, z: -15, yaw: Math.PI / 2, width: 9.5 },
  { x: 95, z: 40, yaw: 0, width: 9.5 },
];

/**
 * Ambient filler buildings across all 6 neighborhoods so every street feels like a living Brazilian city.
 */
export const AMBIENT_BUILDINGS: BuildingBlock[] = [
  // Vila Nova houses
  { x: -120, z: 22, width: 11, depth: 10, height: 4.4, yaw: 0, style: 'casa', wallColor: 0xfde68a, roofColor: 0xb45309, hasWaterTank: true },
  { x: -72, z: 22, width: 12, depth: 10, height: 6.8, yaw: 0, style: 'sobrado', wallColor: 0xfdba74, roofColor: 0x9a3412, hasWaterTank: true },
  { x: -24, z: 22, width: 11, depth: 10, height: 4.5, yaw: 0, style: 'casa', wallColor: 0xbae6fd, roofColor: 0xb45309, hasWaterTank: true },
  { x: -172, z: 62, width: 11, depth: 10, height: 4.6, yaw: Math.PI / 2, style: 'casa', wallColor: 0xfecaca, roofColor: 0x9a3412, hasWaterTank: true },
  { x: -172, z: 120, width: 12, depth: 11, height: 6.5, yaw: Math.PI / 2, style: 'sobrado', wallColor: 0xd9f99d, roofColor: 0xb45309, hasWaterTank: true },
  { x: -72, z: 62, width: 11, depth: 10, height: 4.4, yaw: Math.PI / 2, style: 'casa', wallColor: 0xfed7aa, roofColor: 0x9a3412, hasWaterTank: true },
  { x: -24, z: 115, width: 12, depth: 11, height: 6.8, yaw: -Math.PI / 2, style: 'sobrado', wallColor: 0xe2e8f0, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: -95, z: 162, width: 12, depth: 10, height: 4.6, yaw: Math.PI, style: 'casa', wallColor: 0xfef08a, roofColor: 0xb45309, hasWaterTank: true },
  { x: -25, z: 162, width: 13, depth: 11, height: 7.2, yaw: Math.PI, style: 'sobrado', wallColor: 0xcbd5e1, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: 18, z: 92, width: 12, depth: 11, height: 4.8, yaw: -Math.PI / 2, style: 'casa', wallColor: 0xfca5a5, roofColor: 0x9a3412, hasWaterTank: true },

  // Centro Comercial buildings & shops
  { x: -120, z: -80, width: 14, depth: 12, height: 10.5, yaw: 0, style: 'loja', wallColor: 0xf8fafc, roofColor: 0x475569, hasWaterTank: true, signText: 'FARMÁCIA POPULAR' },
  { x: -85, z: -80, width: 14, depth: 12, height: 13.0, yaw: 0, style: 'predio', wallColor: 0xe2e8f0, roofColor: 0x334155, hasWaterTank: true },
  { x: -25, z: -80, width: 13, depth: 12, height: 9.5, yaw: 0, style: 'loja', wallColor: 0xfef3c7, roofColor: 0x475569, hasWaterTank: true, signText: 'CASA DAS FERRAGENS' },
  { x: 25, z: -80, width: 14, depth: 12, height: 14.5, yaw: 0, style: 'predio', wallColor: 0xcbd5e1, roofColor: 0x334155, hasWaterTank: true },
  { x: 72, z: -80, width: 13, depth: 12, height: 9.0, yaw: 0, style: 'loja', wallColor: 0xdbeafe, roofColor: 0x475569, hasWaterTank: true, signText: 'SUPERMERCADO CENTRAL' },
  { x: -120, z: -38, width: 14, depth: 12, height: 11.5, yaw: Math.PI, style: 'predio', wallColor: 0xf1f5f9, roofColor: 0x334155, hasWaterTank: true },
  { x: -80, z: -38, width: 13, depth: 11, height: 8.5, yaw: Math.PI, style: 'loja', wallColor: 0xfde68a, roofColor: 0x475569, hasWaterTank: true, signText: 'LOJA DO POVO' },
  { x: -20, z: -38, width: 14, depth: 12, height: 12.5, yaw: Math.PI, style: 'predio', wallColor: 0xe2e8f0, roofColor: 0x334155, hasWaterTank: true },
  { x: 75, z: -15, width: 14, depth: 12, height: 11.0, yaw: -Math.PI / 2, style: 'predio', wallColor: 0xf8fafc, roofColor: 0x334155, hasWaterTank: true },
  { x: 125, z: -80, width: 14, depth: 12, height: 10.0, yaw: 0, style: 'loja', wallColor: 0xfecdd3, roofColor: 0x475569, hasWaterTank: true, signText: 'AÇOUGUE BOI BOM' },

  // Morro da Esperança terraced brick houses
  { x: -174, z: -82, width: 9.5, depth: 8.5, height: 5.5, yaw: Math.PI / 2, style: 'casa', wallColor: 0xc26d4a, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: -174, z: -155, width: 9.5, depth: 8.5, height: 6.2, yaw: Math.PI / 2, style: 'sobrado', wallColor: 0xf59e0b, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: -174, z: -205, width: 9.5, depth: 8.5, height: 5.2, yaw: Math.PI / 2, style: 'casa', wallColor: 0x38bdf8, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: -222, z: -82, width: 9.5, depth: 8.5, height: 5.8, yaw: -Math.PI / 2, style: 'casa', wallColor: 0xfb7185, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: -222, z: -185, width: 9.5, depth: 8.5, height: 6.5, yaw: -Math.PI / 2, style: 'sobrado', wallColor: 0xc26d4a, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: -222, z: -225, width: 9.5, depth: 8.5, height: 5.0, yaw: -Math.PI / 2, style: 'casa', wallColor: 0xfacc15, roofColor: 0x7c2d12, hasWaterTank: true },
  { x: -260, z: -95, width: 10, depth: 9, height: 5.4, yaw: Math.PI / 2, style: 'casa', wallColor: 0xc26d4a, roofColor: 0x9a3412, hasWaterTank: true },
  { x: -260, z: -145, width: 10, depth: 9, height: 6.2, yaw: Math.PI / 2, style: 'sobrado', wallColor: 0x4ade80, roofColor: 0x9a3412, hasWaterTank: true },
  { x: -260, z: -235, width: 10, depth: 9, height: 5.2, yaw: Math.PI / 2, style: 'casa', wallColor: 0xfdba74, roofColor: 0x9a3412, hasWaterTank: true },

  // Distrito Industrial warehouses
  { x: 95, z: 75, width: 22, depth: 16, height: 8.5, yaw: 0, style: 'galpao', wallColor: 0xe2e8f0, roofColor: 0xea580c, hasWaterTank: false, signText: 'TRANSPORTADORA BRASIL' },
  { x: 185, z: 85, width: 24, depth: 18, height: 9.5, yaw: -Math.PI / 2, style: 'galpao', wallColor: 0xcbd5e1, roofColor: 0x1d4ed8, hasWaterTank: false, signText: 'LOGÍSTICA SUL' },
  { x: 25, z: 195, width: 20, depth: 15, height: 8.0, yaw: Math.PI / 2, style: 'galpao', wallColor: 0xf1f5f9, roofColor: 0xd97706, hasWaterTank: false, signText: 'METALÚRGICA FORTE' },

  // Jardim Imperial mansions
  { x: 20, z: -282, width: 16, depth: 13, height: 7.5, yaw: 0, style: 'mansao', wallColor: 0xf8fafc, roofColor: 0x7c2d12, hasWaterTank: false },
  { x: 185, z: -282, width: 16, depth: 13, height: 7.8, yaw: 0, style: 'mansao', wallColor: 0xfef9c3, roofColor: 0x9a3412, hasWaterTank: false },
  { x: 185, z: -205, width: 15, depth: 13, height: 7.4, yaw: -Math.PI / 2, style: 'mansao', wallColor: 0xf1f5f9, roofColor: 0x7c2d12, hasWaterTank: false },
];
