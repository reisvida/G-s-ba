import React from 'react';
import {
  Camera,
  Cloud,
  CloudRain,
  DoorOpen,
  Fuel,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Smartphone,
  Sun,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { HudSnapshot, NotificationToast } from '../types/game';
import { Minimap } from './Minimap';

interface GameHudProps {
  hud: HudSnapshot;
  phoneOpen: boolean;
  showTouchControls: boolean;
  isFullscreen: boolean;
  toasts: NotificationToast[];
  levelUpBanner: { level: number; title: string; perk: string } | null;
  onTogglePhone: () => void;
  onCycleCamera: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleFullscreen: () => void;
  onPause: () => void;
  onInteract: () => void;
  onToggleVehicle: () => void;
  onDismissLevelUp: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  phoneOpen,
  showTouchControls,
  isFullscreen,
  toasts,
  levelUpBanner,
  onTogglePhone,
  onCycleCamera,
  onToggleMute,
  onToggleMusic,
  onToggleFullscreen,
  onPause,
  onInteract,
  onToggleVehicle,
  onDismissLevelUp,
}) => {
  const hours = Math.floor(hud.gameTimeMinutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = (hud.gameTimeMinutes % 60).toString().padStart(2, '0');

  const xpProgress = hud.nextLevelXp
    ? Math.min(100, Math.round((hud.xp / hud.nextLevelXp) * 100))
    : 100;

  const totalCarried = hud.loadedCylinders + (hud.carryingOnFoot ? 1 : 0);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 xl:p-5">
      {/* TOP PERIMETER ROW */}
      <div className="flex items-start justify-between gap-2 xl:gap-4">
        {/* Top-Left: Minimap + Cash + Level + Time/Weather */}
        <div className="flex items-start gap-2 xl:gap-3.5 pointer-events-auto min-w-0">
          <Minimap
            playerX={hud.playerPos.x}
            playerZ={hud.playerPos.z}
            playerYaw={hud.playerPos.yaw}
            trafficDots={hud.trafficDots}
            activeOrder={hud.activeOrder}
            deliveryPhase={hud.deliveryPhase}
            customWaypoint={hud.customWaypoint}
            districtName={hud.currentDistrictName}
          />

          <div className="rounded-xl bg-slate-950/90 border border-white/15 px-2.5 xl:px-3.5 py-1.5 xl:py-2.5 shadow-lg space-y-1 xl:space-y-1.5 w-[116px] xl:w-auto xl:min-w-[168px]">
            {/* Cash Readout */}
            <div className="font-mono-tabular text-base xl:text-2xl font-extrabold text-emerald-400 leading-none">
              R$ {hud.money.toLocaleString('pt-BR')}
            </div>

            {/* Level & XP Bar */}
            <div>
              <div className="flex items-center justify-between text-[10px] xl:text-[11px] font-semibold text-slate-200">
                <span className="truncate">Nv. {hud.level} · {hud.levelTitle}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 mt-1 overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
            </div>

            {/* Clock & Weather */}
            <div className="flex items-center gap-1.5 xl:gap-2 text-[10px] xl:text-[11px] text-slate-300 font-mono-tabular pt-0.5">
              <span>D{hud.dayCount} · {hours}:{mins}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 capitalize font-sans truncate">
                {hud.weather === 'chuva' ? (
                  <CloudRain className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-sky-400 shrink-0" />
                ) : hud.weather === 'nublado' ? (
                  <Cloud className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-slate-400 shrink-0" />
                ) : (
                  <Sun className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-amber-400 shrink-0" />
                )}
                <span className="hidden xl:inline">{hud.weather}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Top-Center: Active Delivery Objective Strip */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          {hud.activeOrder ? (
            <div className="rounded-xl bg-slate-950/90 border border-amber-500/40 px-3 py-1.5 xl:px-5 xl:py-2.5 shadow-lg flex items-center gap-3 xl:gap-6">
              <div>
                <div className="text-[9px] xl:text-[10px] font-bold tracking-wider text-amber-400">
                  {hud.deliveryPhase === 'TO_DEPOT'
                    ? 'RETIRAR NO DEPÓSITO'
                    : 'ENTREGAR PARA'}
                </div>
                <div className="text-xs xl:text-sm font-bold text-white truncate max-w-[130px] xl:max-w-none">
                  {hud.deliveryPhase === 'TO_DEPOT'
                    ? 'Depósito São Jorge'
                    : hud.activeOrder.clientName}
                </div>
                <div className="hidden xl:block text-[11px] text-slate-300">
                  {hud.deliveryPhase === 'TO_DEPOT'
                    ? `Carregue ${hud.activeOrder.cylindersRequired} botijão(ões)`
                    : hud.activeOrder.address}
                </div>
              </div>

              <div className="h-7 xl:h-8 w-px bg-slate-800" />

              <div className="text-center font-mono-tabular">
                <div className="text-[9px] xl:text-[10px] font-bold text-slate-400">BOTIJÕES</div>
                <div className="font-display text-lg xl:text-2xl font-extrabold text-sky-400 leading-none">
                  {totalCarried}/{hud.activeOrder.cylindersRequired}
                </div>
              </div>

              <div className="text-center font-mono-tabular">
                <div className="text-[9px] xl:text-[10px] font-bold text-slate-400">DISTÂNCIA</div>
                <div className="font-display text-lg xl:text-2xl font-extrabold text-white leading-none">
                  {hud.deliveryDistanceMeters}m
                </div>
              </div>

              <div className="text-center font-mono-tabular">
                <div className="text-[9px] xl:text-[10px] font-bold text-slate-400">TEMPO</div>
                <div
                  className={`font-display text-lg xl:text-2xl font-extrabold leading-none ${
                    hud.activeOrder.timeRemainingSec < 20
                      ? 'text-red-400'
                      : 'text-amber-400'
                  }`}
                >
                  {String(Math.ceil(hud.activeOrder.timeRemainingSec)).padStart(3, '0')}s
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-950/85 border border-white/10 px-3.5 py-1.5 text-[11px] xl:text-xs text-slate-300">
              {hud.customWaypoint
                ? `Rota GPS: ${hud.customWaypoint.label}`
                : 'Sem entrega ativa · Abra o Celular para aceitar pedidos'}
            </div>
          )}

          {showTouchControls && (
            <div className="rounded-lg bg-slate-950/85 border border-white/15 px-3 py-0.5 flex items-center gap-2.5 font-mono-tabular text-[11px]">
              <span className="font-bold text-white">
                {String(hud.speedKmh).padStart(2, '0')} <span className="text-[10px] text-amber-400">KM/H</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="font-bold text-sky-400">
                {hud.loadedCylinders}/{hud.maxCargoCapacity} <span className="text-[10px] text-slate-400">BOT</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className={`font-bold ${hud.fuel < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                Comb. {hud.fuel}%
              </span>
            </div>
          )}

          {hud.activeEvent !== 'none' && (
            <div className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold shadow">
              {hud.activeEventLabel}
            </div>
          )}
        </div>

        {/* Top-Right: Smartphone, Camera, Audio, Fullscreen & Pause Buttons */}
        <div className="flex items-center gap-1.5 xl:gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            onClick={onTogglePhone}
            aria-label="Celular"
            className={`relative h-9 xl:h-11 px-2.5 xl:px-3.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 xl:gap-2 shadow-lg transition-colors cursor-pointer ${
              phoneOpen
                ? 'bg-amber-500 border-amber-300 text-slate-950'
                : 'bg-slate-950/90 hover:bg-slate-900 border-white/15 text-white'
            }`}
          >
            <Smartphone className="w-4 h-4 shrink-0" />
            <span className="hidden xl:inline">Celular</span>
            {hud.availableOrders.length > 0 && !phoneOpen && (
              <span className="font-mono-tabular px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold leading-none">
                {hud.availableOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onCycleCamera}
            title="Alternar Câmera (C)"
            aria-label="Alternar Câmera"
            className="hidden sm:flex w-9 h-9 xl:w-11 xl:h-11 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-slate-200 items-center justify-center shadow-lg cursor-pointer"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            title="Música Ambiente"
            aria-label="Música Ambiente"
            className={`hidden xl:flex w-11 h-11 rounded-xl border items-center justify-center shadow-lg cursor-pointer ${
              hud.musicEnabled
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-slate-950/90 hover:bg-slate-900 border-white/15 text-slate-400'
            }`}
          >
            <Music className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title="Silenciar / Ativar Som"
            aria-label="Silenciar ou Ativar Som"
            className="w-9 h-9 xl:w-11 xl:h-11 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-slate-200 flex items-center justify-center shadow-lg cursor-pointer"
          >
            {hud.muted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title="Tela Cheia / Horizontal"
            aria-label="Tela Cheia"
            className="hidden sm:flex w-9 h-9 xl:w-11 xl:h-11 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-slate-200 items-center justify-center shadow-lg cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-amber-400" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onPause}
            title="Pausar (Esc)"
            aria-label="Pausar"
            className="w-9 h-9 xl:w-11 xl:h-11 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-slate-200 flex items-center justify-center shadow-lg cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Portrait-only Mobile Compact Mission & Telemetry Strips (< md) */}
      <div className="md:hidden flex flex-col items-center gap-1.5 mt-1.5">
        {hud.activeOrder && (
          <div className="rounded-lg bg-slate-950/90 border border-amber-500/40 px-3 py-1 flex items-center gap-2.5 text-xs font-mono-tabular">
            <span className="font-sans font-bold text-amber-400 truncate max-w-[120px]">
              {hud.deliveryPhase === 'TO_DEPOT'
                ? 'Ir ao Depósito'
                : hud.activeOrder.clientName}
            </span>
            <span className="text-sky-400 font-bold">
              {totalCarried}/{hud.activeOrder.cylindersRequired} bot.
            </span>
            <span className="text-white">{hud.deliveryDistanceMeters}m</span>
            <span className="text-amber-300">
              {Math.ceil(hud.activeOrder.timeRemainingSec)}s
            </span>
          </div>
        )}
        {showTouchControls && (
          <div className="rounded-lg bg-slate-950/85 border border-white/15 px-3 py-1 flex items-center gap-2.5 font-mono-tabular text-[11px]">
            <span className="font-bold text-white">
              {String(hud.speedKmh).padStart(2, '0')} <span className="text-[10px] text-amber-400">KM/H</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="font-bold text-sky-400">
              {hud.loadedCylinders}/{hud.maxCargoCapacity} <span className="text-[10px] text-slate-400">BOT</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className={`font-bold ${hud.fuel < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
              Comb. {hud.fuel}%
            </span>
          </div>
        )}
      </div>

      {/* CENTER-BOTTOM CONTEXTUAL INTERACTION PROMPT (Desktop / Keyboard) */}
      <div className="flex flex-col items-center gap-2 mt-auto mb-2">
        {!showTouchControls && !phoneOpen && hud.interactionPrompt && (
          <button
            type="button"
            onClick={onInteract}
            className="pointer-events-auto rounded-xl bg-slate-950/95 hover:bg-slate-900 border-2 border-amber-400 px-4 py-2.5 shadow-2xl flex items-center gap-3 cursor-pointer"
          >
            <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-mono-tabular font-extrabold text-xs flex items-center justify-center shrink-0">
              E
            </span>
            <div className="text-left">
              <div className="text-xs xl:text-sm font-bold text-white">
                {hud.interactionPrompt.label}
              </div>
              {hud.interactionPrompt.sublabel && (
                <div className="text-[11px] text-slate-300">
                  {hud.interactionPrompt.sublabel}
                </div>
              )}
            </div>
          </button>
        )}
      </div>

      {/* BOTTOM PERIMETER ROW */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left Toast Stack */}
        <div className={`flex flex-col gap-1.5 max-w-xs ${showTouchControls ? 'mb-28 xl:mb-32' : ''}`}>
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg px-3.5 py-2.5 shadow-lg border text-xs ${
                t.tone === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100'
                  : t.tone === 'danger'
                    ? 'bg-red-950/95 border-red-500/60 text-red-100'
                    : t.tone === 'warning'
                      ? 'bg-amber-950/95 border-amber-500/60 text-amber-100'
                      : 'bg-slate-950/95 border-slate-700 text-slate-100'
              }`}
            >
              <div className="font-bold">{t.title}</div>
              <div className="text-[11px] opacity-90 mt-0.5">{t.detail}</div>
            </div>
          ))}
        </div>

        {/* Bottom-Right Vehicle Telemetry & Cargo Cluster */}
        {!showTouchControls && (
          <div className="hidden lg:flex items-end gap-3 pointer-events-auto">
            <button
              type="button"
              onClick={onToggleVehicle}
              className="h-11 px-3.5 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <DoorOpen className="w-4 h-4 text-sky-400" />
              <span>{hud.inVehicle ? 'Descer (E)' : 'Subir (E)'}</span>
            </button>

            <div className="rounded-xl bg-slate-950/90 border border-white/15 px-4 py-2.5 shadow-lg flex items-center gap-5">
              <div>
                <div className="text-[10px] font-bold text-slate-400">BOTIJÕES</div>
                <div className="font-display text-2xl font-extrabold text-sky-400 tabular-nums leading-none mt-0.5">
                  {hud.loadedCylinders}
                  <span className="text-sm text-slate-400 font-semibold">
                    /{hud.maxCargoCapacity}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[115px]">
                  {hud.activeVehicleName}
                </div>
              </div>

              <div className="h-9 w-px bg-slate-800" />

              <div className="space-y-1.5 min-w-[92px] font-mono-tabular text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Fuel className="w-3.5 h-3.5 text-emerald-400" />
                    Comb.
                  </span>
                  <span
                    className={`font-bold ${
                      hud.fuel < 20 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {hud.fuel}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-slate-300">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    Lataria
                  </span>
                  <span
                    className={`font-bold ${
                      hud.health < 35 ? 'text-red-400' : 'text-amber-300'
                    }`}
                  >
                    {hud.health}%
                  </span>
                </div>
              </div>

              <div className="h-9 w-px bg-slate-800" />

              <div className="text-right min-w-[68px]">
                <div className="font-display text-4xl font-extrabold text-white tabular-nums leading-none">
                  {String(hud.speedKmh).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-bold text-amber-400 tracking-wider">
                  KM/H
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LEVEL UP CELEBRATION MODAL */}
      {levelUpBanner && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 pointer-events-auto">
          <div className="max-w-sm w-full rounded-2xl bg-slate-900 border-2 border-amber-400 p-6 text-center shadow-2xl space-y-3">
            <div className="text-xs font-bold text-amber-400 tracking-wider">
              PROGRESSÃO DE CARREIRA
            </div>
            <h3 className="font-display text-3xl font-extrabold text-white">
              Nível {levelUpBanner.level}: {levelUpBanner.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {levelUpBanner.perk}
            </p>
            <button
              type="button"
              onClick={onDismissLevelUp}
              className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Continuar Entregas
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

