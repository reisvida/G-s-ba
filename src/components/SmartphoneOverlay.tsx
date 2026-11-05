import React, { useRef, useState } from 'react';
import {
  Building2,
  Car,
  CreditCard,
  Banknote,
  Fuel,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  ShoppingBag,
  Users,
  Wrench,
  X,
  Check,
  Lock,
} from 'lucide-react';
import {
  DEPOT_UPGRADE_TIERS,
  HudSnapshot,
  PhoneAppTab,
  VEHICLE_COLORS,
  VEHICLE_SPECS,
  VehicleTypeId,
} from '../types/game';
import { ROAD_SEGMENTS, WORLD_POIS } from '../game/WorldLayout';

interface SmartphoneOverlayProps {
  hud: HudSnapshot;
  ownedIds: VehicleTypeId[];
  onClose: () => void;
  onAcceptOrder: (id: string) => void;
  onCancelOrder: () => void;
  onRefreshOrders: () => void;
  onSetWaypoint: (x: number, z: number, label: string) => void;
  onBuyStock: (qty: number) => void;
  onUpgradeDepot: () => void;
  onHireEmployee: (id: string) => void;
  onBuyBranch: (id: string) => void;
  onSelectOrBuyVehicle: (id: VehicleTypeId) => void;
  onSellVehicle: (id: VehicleTypeId) => void;
  onCustomizeColor: (hex: number) => void;
  onUpgradePart: (part: 'engine' | 'cargo') => void;
  onRefuel: () => void;
  onRepair: () => void;
}

export const SmartphoneOverlay: React.FC<SmartphoneOverlayProps> = ({
  hud,
  ownedIds,
  onClose,
  onAcceptOrder,
  onCancelOrder,
  onRefreshOrders,
  onSetWaypoint,
  onBuyStock,
  onUpgradeDepot,
  onHireEmployee,
  onBuyBranch,
  onSelectOrBuyVehicle,
  onSellVehicle,
  onCustomizeColor,
  onUpgradePart,
  onRefuel,
  onRepair,
}) => {
  const [tab, setTab] = useState<PhoneAppTab>('pedidos');
  const mapSvgRef = useRef<SVGSVGElement | null>(null);

  const activeVeh = hud.ownedVehicles[hud.activeVehicleId];
  const activeSpec = VEHICLE_SPECS[hud.activeVehicleId];

  const nextDepotTier = DEPOT_UPGRADE_TIERS.find(
    (t) => t.level === hud.company.depotLevel + 1,
  );

  const passivePerCycle =
    hud.company.employees
      .filter((e) => e.hired)
      .reduce((s, e) => s + e.dailyNetProfit, 0) +
    hud.company.branches
      .filter((b) => b.owned)
      .reduce((s, b) => s + b.dailyIncome, 0);

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = mapSvgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const nz = (e.clientY - rect.top) / rect.height;
    // Map viewBox covers -360..320 in X (680m) and -340..320 in Z (660m)
    const wx = Math.round(-360 + nx * 680);
    const wz = Math.round(-340 + nz * 660);
    onSetWaypoint(wx, wz, `Marcador GPS (${wx}, ${wz})`);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-full sm:w-[390px] xl:w-[410px] p-2 xl:p-4 xl:pt-20 pointer-events-none flex items-end justify-end">
      <div className="pointer-events-auto w-full h-[calc(100vh-1rem)] xl:h-[calc(100vh-6rem)] max-h-[650px] rounded-2xl bg-slate-950 border-2 border-slate-700 shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Smartphone Status Header */}
        <div className="px-3.5 py-2 xl:px-4 xl:py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="text-xs font-bold text-amber-400 tracking-wide">
              ChamaGás OS
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              Saldo: <span className="text-emerald-400 font-bold">R$ {hud.money.toLocaleString('pt-BR')}</span> · Estoque: <span className="text-sky-300 font-semibold">{hud.company.stockFull}/{hud.company.maxStock}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar celular"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* App Navigation Tabs */}
        <div className="grid grid-cols-4 bg-slate-900/70 border-b border-slate-800 p-1 gap-1 shrink-0">
          {[
            { id: 'pedidos' as PhoneAppTab, label: 'Pedidos', icon: Package },
            { id: 'mapa' as PhoneAppTab, label: 'Mapa', icon: MapPin },
            { id: 'empresa' as PhoneAppTab, label: 'Empresa', icon: Building2 },
            { id: 'garagem' as PhoneAppTab, label: 'Garagem', icon: Car },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`py-1.5 xl:py-2 px-1 rounded-lg text-xs font-semibold flex flex-col items-center gap-0.5 xl:gap-1 transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* App Content Body */}
        <div className="flex-1 overflow-y-auto phone-scroll p-4 space-y-4">
          {/* 1. PEDIDOS APP */}
          {tab === 'pedidos' && (
            <>
              {hud.activeOrder && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">
                      Entrega em Andamento
                    </span>
                    <span className="font-mono-tabular text-xs font-bold text-white">
                      {Math.ceil(hud.activeOrder.timeRemainingSec)}s
                    </span>
                  </div>
                  <div className="font-bold text-sm text-white">
                    {hud.activeOrder.clientName}
                  </div>
                  <div className="text-xs text-slate-300">
                    {hud.activeOrder.address}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                    <span>
                      {hud.activeOrder.productLabel} ·{' '}
                      {hud.activeOrder.paymentMethod === 'dinheiro'
                        ? 'Dinheiro'
                        : 'Cartão'}
                    </span>
                    <span className="font-mono-tabular font-bold text-emerald-400">
                      R$ {hud.activeOrder.reward}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-200 pt-1">
                    {hud.deliveryPhase === 'TO_DEPOT'
                      ? 'Passo 1: Vá ao Depósito (marcador ciano) e pressione E para carregar o botijão.'
                      : 'Passo 2: Siga até o cliente (marcador vermelho) e pressione E para entregar.'}
                  </div>
                  <button
                    type="button"
                    onClick={onCancelOrder}
                    className="w-full mt-1 py-1.5 rounded-lg bg-slate-900 hover:bg-red-950 border border-slate-700 text-xs font-semibold text-red-300 cursor-pointer"
                  >
                    Cancelar Entrega
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  Pedidos Disponíveis ({hud.availableOrders.length})
                </h3>
                <button
                  type="button"
                  onClick={onRefreshOrders}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {hud.availableOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold text-amber-400">
                          {ord.missionLabel} · {ord.districtName}
                        </div>
                        <div className="font-bold text-sm text-white">
                          {ord.clientName}
                        </div>
                      </div>
                      <div className="text-right font-mono-tabular">
                        <div className="text-sm font-bold text-emerald-400">
                          R$ {ord.reward}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          +{ord.xpReward} XP
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300">{ord.address}</div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/80">
                      <span className="font-mono-tabular">
                        {ord.productLabel} · {ord.distanceMeters}m
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {ord.paymentMethod === 'dinheiro' ? (
                          <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                        )}
                        {ord.paymentMethod === 'dinheiro' ? 'Dinheiro' : 'Cartão'}
                      </span>
                    </div>

                    {ord.isNarrowAlley && (
                      <div className="text-[11px] text-amber-300">
                        Aviso: Endereço em viela estreita (recomendado moto).
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={Boolean(hud.activeOrder)}
                      onClick={() => onAcceptOrder(ord.id)}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                        hud.activeOrder
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                      }`}
                    >
                      {hud.activeOrder ? 'Conclua a entrega atual primeiro' : 'Aceitar Pedido'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 2. MAPA APP */}
          {tab === 'mapa' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Mapa da Cidade</h3>
                  <p className="text-[11px] text-slate-400">
                    Toque no mapa para marcar rota GPS
                  </p>
                </div>
                <span className="text-xs font-semibold text-amber-400">
                  {hud.currentDistrictName}
                </span>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                <svg
                  ref={mapSvgRef}
                  viewBox="-360 -340 680 660"
                  onClick={handleMapClick}
                  className="w-full h-[270px] cursor-crosshair block"
                >
                  <rect x="-360" y="-340" width="680" height="660" fill="#0f172a" />

                  {/* District Subtle Regions */}
                  <rect x="-340" y="-290" width="185" height="300" fill="#1e293b" opacity="0.45" />
                  <rect x="-150" y="-130" width="295" height="165" fill="#1e293b" opacity="0.35" />
                  <rect x="45" y="-290" width="180" height="165" fill="#1e293b" opacity="0.35" />

                  {/* Roads */}
                  {ROAD_SEGMENTS.map((seg) => (
                    <line
                      key={seg.id}
                      x1={seg.x1}
                      y1={seg.z1}
                      x2={seg.x2}
                      y2={seg.z2}
                      stroke={
                        seg.surface === 'dirt'
                          ? '#9a5b38'
                          : seg.surface === 'alley'
                            ? '#64748b'
                            : '#475569'
                      }
                      strokeWidth={Math.max(4, seg.width)}
                      strokeLinecap="round"
                    />
                  ))}

                  {/* Neighborhood Labels */}
                  <text x="-250" y="-210" fill="#94a3b8" fontSize="18" fontWeight="700">
                    MORRO
                  </text>
                  <text x="-45" y="-85" fill="#94a3b8" fontSize="18" fontWeight="700">
                    CENTRO
                  </text>
                  <text x="-115" y="185" fill="#94a3b8" fontSize="18" fontWeight="700">
                    VILA NOVA
                  </text>
                  <text x="85" y="-225" fill="#94a3b8" fontSize="18" fontWeight="700">
                    JARDIM VIP
                  </text>
                  <text x="80" y="175" fill="#94a3b8" fontSize="18" fontWeight="700">
                    INDUSTRIAL
                  </text>

                  {/* POIs */}
                  {WORLD_POIS.filter((p) => p.type !== 'speed_camera').map((p) => (
                    <circle
                      key={p.id}
                      cx={p.x}
                      cy={p.z}
                      r={10}
                      fill={
                        p.type === 'depot'
                          ? '#f97316'
                          : p.type === 'gas_station'
                            ? '#22c55e'
                            : p.type === 'workshop'
                              ? '#eab308'
                              : '#3b82f6'
                      }
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                  ))}

                  {/* Active Target or Custom Waypoint */}
                  {hud.activeOrder && (
                    <circle
                      cx={
                        hud.deliveryPhase === 'TO_DEPOT'
                          ? -120
                          : hud.activeOrder.targetX
                      }
                      cy={
                        hud.deliveryPhase === 'TO_DEPOT'
                          ? 91
                          : hud.activeOrder.targetZ
                      }
                      r={14}
                      fill={hud.deliveryPhase === 'TO_DEPOT' ? '#06b6d4' : '#ef4444'}
                      stroke="#ffffff"
                      strokeWidth="3"
                    />
                  )}
                  {hud.customWaypoint && !hud.activeOrder && (
                    <circle
                      cx={hud.customWaypoint.x}
                      cy={hud.customWaypoint.z}
                      r={13}
                      fill="#38bdf8"
                      stroke="#ffffff"
                      strokeWidth="3"
                    />
                  )}

                  {/* Player Position */}
                  <circle
                    cx={hud.playerPos.x}
                    cy={hud.playerPos.z}
                    r={11}
                    fill="#facc15"
                    stroke="#0f172a"
                    strokeWidth="3"
                  />
                </svg>
              </div>

              {/* Legend & Quick GPS Shortcuts */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onSetWaypoint(-120, 91, 'Depósito São Jorge')}
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-2 text-left cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-orange-400 shrink-0" />
                  <span>Depósito Matriz</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetWaypoint(-24, 66, 'Posto PetroBrasil')}
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-2 text-left cursor-pointer"
                >
                  <Fuel className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Posto Combustível</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetWaypoint(-124, 164, 'Oficina do Beto')}
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-2 text-left cursor-pointer"
                >
                  <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Oficina Mecânica</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetWaypoint(184, 196, 'Atacadão do Gás')}
                  className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center gap-2 text-left cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>Atacadão (Envase)</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. EMPRESA & BANCO APP */}
          {tab === 'empresa' && (
            <div className="space-y-4">
              {/* Financial Summary */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5">
                <div className="text-xs text-slate-400">Caixa da Distribuidora</div>
                <div className="font-mono-tabular text-2xl font-extrabold text-emerald-400 mt-0.5">
                  R$ {hud.money.toLocaleString('pt-BR')}
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-slate-400">Entregas</div>
                    <div className="font-mono-tabular font-bold text-white">
                      {hud.company.totalDeliveriesCompleted}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Receita Total</div>
                    <div className="font-mono-tabular font-bold text-white">
                      R$ {hud.company.totalRevenue.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Renda Passiva</div>
                    <div className="font-mono-tabular font-bold text-amber-400">
                      +R$ {passivePerCycle}/ciclo
                    </div>
                  </div>
                </div>
              </div>

              {/* Depot Stock & Expansion */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Estoque do Depósito (Nível {hud.company.depotLevel})
                  </span>
                  <span className="font-mono-tabular text-xs font-bold text-sky-400">
                    {hud.company.stockFull} / {hud.company.maxStock} cheios
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500"
                    style={{
                      width: `${Math.min(100, (hud.company.stockFull / hud.company.maxStock) * 100)}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onBuyStock(5)}
                    className="py-2 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                  >
                    +5 Botijões (R$ 310)
                  </button>
                  <button
                    type="button"
                    onClick={() => onBuyStock(15)}
                    className="py-2 px-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer"
                  >
                    +15 Botijões (R$ 930)
                  </button>
                </div>

                {nextDepotTier && (
                  <button
                    type="button"
                    onClick={onUpgradeDepot}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Expandir para {nextDepotTier.name} ({nextDepotTier.maxStock} un) · R${' '}
                    {nextDepotTier.upgradeCost.toLocaleString('pt-BR')}
                  </button>
                )}
              </div>

              {/* Hire Drivers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <span>Entregadores (Entregas Automáticas)</span>
                  </span>
                  {hud.level < 3 && (
                    <span className="text-[11px] text-amber-400">Requer Nível 3</span>
                  )}
                </div>

                {hud.company.employees.map((emp) => (
                  <div
                    key={emp.id}
                    className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{emp.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {emp.vehicleLabel} · +R$ {emp.dailyNetProfit}/ciclo
                      </div>
                    </div>
                    {emp.hired ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Ativo
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onHireEmployee(emp.id)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shrink-0"
                      >
                        R$ {emp.hireCost}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Buy Regional Branches */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-white">
                  Expansão de Território (Filiais)
                </div>
                {hud.company.branches.map((br) => (
                  <div
                    key={br.id}
                    className="rounded-lg bg-slate-900 border border-slate-800 p-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{br.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {br.districtName} · +R$ {br.dailyIncome}/ciclo
                      </div>
                    </div>
                    {br.owned ? (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Própria
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onBuyBranch(br.id)}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold cursor-pointer shrink-0"
                      >
                        R$ {br.price.toLocaleString('pt-BR')}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. GARAGEM & PERSONALIZAÇÃO APP */}
          {tab === 'garagem' && (
            <div className="space-y-4">
              {/* Active Vehicle Customization & Maintenance */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-amber-400 font-semibold">
                      Veículo Atual
                    </div>
                    <div className="text-sm font-bold text-white">
                      {activeSpec.name}
                    </div>
                  </div>
                  <div className="text-right font-mono-tabular text-xs">
                    <div className="text-slate-300">
                      Carga: {hud.loadedCylinders}/{hud.maxCargoCapacity}
                    </div>
                    <div className="text-slate-400">
                      Comb: {hud.fuel}% · Lat: {hud.health}%
                    </div>
                  </div>
                </div>

                {/* Quick Roadside Service */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onRefuel}
                    className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Fuel className="w-3.5 h-3.5" />
                    <span>Abastecer</span>
                  </button>
                  <button
                    type="button"
                    onClick={onRepair}
                    className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Reparar</span>
                  </button>
                </div>

                {/* Paint Color Swatches */}
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1.5">
                    Pintura (R$ 120)
                  </div>
                  <div className="flex items-center gap-2">
                    {VEHICLE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        title={c.name}
                        onClick={() => onCustomizeColor(c.hex)}
                        className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
                          activeVeh.colorHex === c.hex
                            ? 'border-white scale-110'
                            : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c.css }}
                      />
                    ))}
                  </div>
                </div>

                {/* Performance Upgrades */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={activeVeh.engineLevel >= 3}
                    onClick={() => onUpgradePart('engine')}
                    className="py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
                  >
                    {activeVeh.engineLevel >= 3
                      ? 'Motor Máximo (Nv.3)'
                      : `Motor Nv.${activeVeh.engineLevel + 1} (R$ ${
                          activeVeh.engineLevel === 1 ? 650 : 1450
                        })`}
                  </button>
                  <button
                    type="button"
                    disabled={activeVeh.cargoLevel >= 3}
                    onClick={() => onUpgradePart('cargo')}
                    className="py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white cursor-pointer"
                  >
                    {activeVeh.cargoLevel >= 3
                      ? 'Carga Máxima (Nv.3)'
                      : `Suporte +1 (R$ ${
                          activeVeh.cargoLevel === 1 ? 650 : 1450
                        })`}
                  </button>
                </div>
              </div>

              {/* Fleet Dealership Catalog (All 6 Vehicles) */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-white">
                  Concessionária & Frota (6 Veículos)
                </div>

                {(Object.keys(VEHICLE_SPECS) as VehicleTypeId[]).map((id) => {
                  const spec = VEHICLE_SPECS[id];
                  const isOwned = ownedIds.includes(id);
                  const isSelected = hud.activeVehicleId === id;
                  const unlocked = hud.level >= spec.unlockLevel;

                  return (
                    <div
                      key={id}
                      className={`rounded-xl border p-3 space-y-2 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500'
                          : 'bg-slate-900 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-semibold text-sky-400">
                            {spec.category} · Nível {spec.unlockLevel}
                          </div>
                          <div className="text-sm font-bold text-white">
                            {spec.name}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {spec.subtitle}
                          </div>
                        </div>
                        <div className="text-right font-mono-tabular">
                          {isOwned ? (
                            <span className="text-xs font-bold text-emerald-400">
                              Na Garagem
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-amber-400">
                              R$ {spec.price.toLocaleString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-300 font-mono-tabular bg-slate-950/60 rounded-lg p-2">
                        <div>Vel: {spec.maxSpeedKmh} km/h</div>
                        <div>Carga: {spec.cargoCapacity} bot.</div>
                        <div>Cons: {spec.fuelConsumption}%</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!unlocked ? (
                          <div className="w-full py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Desbloqueia no Nível {spec.unlockLevel}</span>
                          </div>
                        ) : isSelected ? (
                          <div className="w-full py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold text-center">
                            Em Uso Agora
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onSelectOrBuyVehicle(id)}
                              className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
                            >
                              {isOwned
                                ? 'Dirigir Veículo'
                                : `Comprar (R$ ${spec.price.toLocaleString('pt-BR')})`}
                            </button>
                            {isOwned && id !== 'moto_simples' && (
                              <button
                                type="button"
                                onClick={() => onSellVehicle(id)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-red-300 text-xs font-semibold cursor-pointer"
                              >
                                Vender
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
