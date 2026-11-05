import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { MobileControls } from './components/MobileControls';
import { PauseModal } from './components/PauseModal';
import { SmartphoneOverlay } from './components/SmartphoneOverlay';
import { TitleScreen } from './components/TitleScreen';
import { GameEngine } from './game/GameEngine';
import { HudSnapshot, NotificationToast } from './types/game';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [hasSave, setHasSave] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const [levelUpBanner, setLevelUpBanner] = useState<{
    level: number;
    title: string;
    perk: string;
  } | null>(null);

  const manualTouchOverrideRef = useRef(false);
  const isTouchOrCompact = () => {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      Math.min(window.innerWidth, window.innerHeight) < 620
    );
  };

  const [showTouchControls, setShowTouchControls] = useState(isTouchOrCompact);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth && window.innerWidth < 640;
  });
  const [dismissRotateHint, setDismissRotateHint] = useState(false);

  const requestLandscapeMode = useCallback(async () => {
    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
      }
      const orient = screen.orientation as ScreenOrientation & {
        lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
      };
      if (orient?.lock) {
        await orient.lock('landscape');
      }
    } catch {
      // Orientation lock or fullscreen may be restricted by desktop/iframe policies
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await requestLandscapeMode();
      }
    } catch {
      // Ignore fullscreen toggle errors
    }
  }, [requestLandscapeMode]);

  useEffect(() => {
    const handleResize = () => {
      setIsPortraitMobile(
        window.innerHeight > window.innerWidth && window.innerWidth < 640,
      );
      if (manualTouchOverrideRef.current) return;
      setShowTouchControls(isTouchOrCompact());
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const pushToast = useCallback((toast: Omit<NotificationToast, 'id'>) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GameEngine(container, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onToast: pushToast,
      onLevelUp: (level, title, perk) => {
        setLevelUpBanner({ level, title, perk });
      },
    });

    engineRef.current = engine;
    setHasSave(engine.hasSavedGame());

    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if (e.code === 'Tab' || e.code === 'KeyP' || e.code === 'KeyM') {
        if (engineRef.current) {
          e.preventDefault();
          setPhoneOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcut);

    return () => {
      window.removeEventListener('keydown', handleGlobalShortcut);
      engine.dispose();
      engineRef.current = null;
    };
  }, [pushToast]);

  const engine = engineRef.current;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Isolated 3D WebGL Canvas Mount Container */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {/* Title Screen Overlay */}
      {hud?.mode === 'TITLE_MENU' && (
        <TitleScreen
          hasSave={hasSave}
          onStart={() => {
            if (isTouchOrCompact()) {
              requestLandscapeMode();
            }
            engine?.setMode('PLAYING');
          }}
          onNewCareer={() => {
            if (isTouchOrCompact()) {
              requestLandscapeMode();
            }
            engine?.resetCareer();
            setHasSave(true);
          }}
        />
      )}

      {/* Portrait Mobile Hint Banner */}
      {isPortraitMobile && !dismissRotateHint && hud?.mode === 'PLAYING' && (
        <div className="fixed top-20 inset-x-3 z-30 flex justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-xl bg-slate-950/95 border border-amber-400/60 px-3.5 py-2 shadow-xl flex items-center gap-2.5 text-xs text-slate-100">
            <span>Gire o celular para o modo horizontal</span>
            <button
              type="button"
              onClick={requestLandscapeMode}
              className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
            >
              Horizontal
            </button>
            <button
              type="button"
              onClick={() => setDismissRotateHint(true)}
              className="text-slate-400 hover:text-white px-1 cursor-pointer"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Active Gameplay HUD */}
      {hud && hud.mode === 'PLAYING' && (
        <>
          <GameHud
            hud={hud}
            phoneOpen={phoneOpen}
            showTouchControls={showTouchControls}
            isFullscreen={isFullscreen}
            toasts={toasts}
            levelUpBanner={levelUpBanner}
            onTogglePhone={() => setPhoneOpen((v) => !v)}
            onCycleCamera={() => engine?.cycleCameraMode()}
            onToggleMute={() => engine?.toggleMute()}
            onToggleMusic={() => engine?.toggleMusic()}
            onToggleFullscreen={toggleFullscreen}
            onPause={() => {
              setPhoneOpen(false);
              engine?.setMode('PAUSED');
            }}
            onInteract={() => engine?.triggerInteract()}
            onToggleVehicle={() => engine?.toggleVehicleMount()}
            onDismissLevelUp={() => setLevelUpBanner(null)}
          />

          {showTouchControls && !phoneOpen && (
            <MobileControls
              inVehicle={hud.inVehicle}
              interactionPrompt={hud.interactionPrompt}
              onJoystick={(jx, jy) => engine?.setTouchJoystick(jx, jy)}
              onPedals={(t, b, h) => engine?.setTouchPedals(t, b, h)}
              onInteract={() => engine?.triggerInteract()}
              onToggleVehicle={() => engine?.toggleVehicleMount()}
              onHorn={() => engine?.triggerHorn()}
            />
          )}

          {phoneOpen && engine && (
            <SmartphoneOverlay
              hud={hud}
              ownedIds={engine.getOwnedVehicleIds()}
              onClose={() => setPhoneOpen(false)}
              onAcceptOrder={(id) => {
                engine.acceptOrder(id);
                setPhoneOpen(false);
              }}
              onCancelOrder={() => engine.cancelActiveOrder()}
              onRefreshOrders={() => engine.refreshAvailableOrders()}
              onSetWaypoint={(x, z, label) => {
                engine.setCustomWaypoint(x, z, label);
                setPhoneOpen(false);
              }}
              onBuyStock={(qty) => engine.buyWholesaleStock(qty)}
              onUpgradeDepot={() => engine.upgradeDepot()}
              onHireEmployee={(id) => engine.hireEmployee(id)}
              onBuyBranch={(id) => engine.buyBranch(id)}
              onSelectOrBuyVehicle={(id) => engine.selectOrBuyVehicle(id)}
              onSellVehicle={(id) => engine.sellVehicle(id)}
              onCustomizeColor={(hex) => engine.customizeVehicleColor(hex)}
              onUpgradePart={(part) => engine.upgradeVehiclePart(part)}
              onRefuel={() => engine.refuelActiveVehicle(true)}
              onRepair={() => engine.repairActiveVehicle(true)}
            />
          )}
        </>
      )}

      {/* Pause Modal */}
      {hud && hud.mode === 'PAUSED' && engine && (
        <PauseModal
          muted={hud.muted}
          musicEnabled={hud.musicEnabled}
          weather={hud.weather}
          showTouchControls={showTouchControls}
          onResume={() => engine.setMode('PLAYING')}
          onToggleMute={() => engine.toggleMute()}
          onToggleMusic={() => engine.toggleMusic()}
          onToggleTouchControls={() => {
            manualTouchOverrideRef.current = true;
            setShowTouchControls((v) => !v);
          }}
          onSetTime={(h) => engine.setTimePreset(h)}
          onSetWeather={(w) => engine.setWeatherPreset(w)}
          onResetCareer={() => {
            engine.resetCareer();
            setHasSave(true);
          }}
        />
      )}
    </div>
  );
}
