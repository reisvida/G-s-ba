import React, { useRef, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  DoorOpen,
  Hand,
  OctagonAlert,
  Volume2,
} from 'lucide-react';
import { InteractionPrompt } from '../types/game';

interface MobileControlsProps {
  inVehicle: boolean;
  interactionPrompt: InteractionPrompt | null;
  onJoystick: (jx: number, jy: number) => void;
  onPedals: (throttle: boolean, brake: boolean, handbrake: boolean) => void;
  onInteract: () => void;
  onToggleVehicle: () => void;
  onHorn: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  inVehicle,
  interactionPrompt,
  onJoystick,
  onPedals,
  onInteract,
  onToggleVehicle,
  onHorn,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [throttle, setThrottle] = useState(false);
  const [brake, setBrake] = useState(false);
  const [handbrake, setHandbrake] = useState(false);

  const updateJoystickFromTouch = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.38;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onJoystick(dx / maxR, dy / maxR);
  };

  const resetJoystick = () => {
    setKnob({ x: 0, y: 0 });
    onJoystick(0, 0);
  };

  const handlePedalChange = (
    nextT: boolean,
    nextB: boolean,
    nextH: boolean,
  ) => {
    setThrottle(nextT);
    setBrake(nextB);
    setHandbrake(nextH);
    onPedals(nextT, nextB, nextH);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 pointer-events-none px-3 pb-3 sm:p-6 flex items-end justify-between gap-2">
      {/* Left Thumb Virtual Joystick */}
      <div
        ref={padRef}
        className="pointer-events-auto relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-950/80 border-2 border-white/20 flex items-center justify-center touch-none shrink-0"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updateJoystickFromTouch(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') {
            updateJoystickFromTouch(e.clientX, e.clientY);
          }
        }}
        onPointerUp={resetJoystick}
        onPointerCancel={resetJoystick}
      >
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-400/90 border-2 border-white shadow-md pointer-events-none"
          style={{
            transform: `translate(${knob.x}px, ${knob.y}px)`,
          }}
        />
      </div>

      {/* Right Action & Driving Cluster */}
      <div className="pointer-events-auto flex flex-col items-end gap-2 touch-none">
        {/* Contextual Interact & Mount/Dismount Row */}
        <div className="flex items-center gap-2">
          {interactionPrompt && (
            <button
              type="button"
              onClick={onInteract}
              className="h-10 px-3 rounded-xl bg-amber-500 active:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg border border-amber-300"
            >
              <Hand className="w-4 h-4 shrink-0" />
              <span className="max-w-[165px] truncate">{interactionPrompt.label}</span>
            </button>
          )}

          {inVehicle && (
            <button
              type="button"
              onClick={onHorn}
              aria-label="Buzina"
              className="w-10 h-10 rounded-full bg-slate-900/90 active:bg-slate-800 border border-white/20 text-amber-400 flex items-center justify-center shadow"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleVehicle}
            aria-label="Entrar ou sair do veículo"
            className="h-10 px-3 rounded-xl bg-slate-900/90 active:bg-slate-800 border border-white/20 text-slate-100 text-xs font-semibold flex items-center gap-1.5 shadow"
          >
            <DoorOpen className="w-4 h-4 text-sky-400" />
            <span>{inVehicle ? 'Descer' : 'Subir'}</span>
          </button>
        </div>

        {/* Driving Pedals (Accelerate, Brake, Handbrake) */}
        {inVehicle && (
          <div className="flex items-end gap-2">
            <button
              type="button"
              aria-label="Freio de mão"
              onPointerDown={() => handlePedalChange(throttle, brake, true)}
              onPointerUp={() => handlePedalChange(throttle, brake, false)}
              onPointerCancel={() => handlePedalChange(throttle, brake, false)}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center shadow transition-transform ${
                handbrake
                  ? 'bg-amber-500 border-white text-slate-950 scale-95'
                  : 'bg-slate-900/90 border-white/25 text-amber-400'
              }`}
            >
              <OctagonAlert className="w-5 h-5" />
            </button>

            <button
              type="button"
              aria-label="Frear ou Ré"
              onPointerDown={() => handlePedalChange(throttle, true, handbrake)}
              onPointerUp={() => handlePedalChange(throttle, false, handbrake)}
              onPointerCancel={() => handlePedalChange(throttle, false, handbrake)}
              className={`w-13 h-13 sm:w-15 sm:h-15 rounded-full border-2 flex flex-col items-center justify-center shadow transition-transform ${
                brake
                  ? 'bg-red-600 border-white text-white scale-95'
                  : 'bg-slate-900/90 border-white/25 text-red-400'
              }`}
            >
              <ArrowDownCircle className="w-5 h-5" />
              <span className="text-[9px] font-bold">FREIO</span>
            </button>

            <button
              type="button"
              aria-label="Acelerar"
              onPointerDown={() => handlePedalChange(true, brake, handbrake)}
              onPointerUp={() => handlePedalChange(false, brake, handbrake)}
              onPointerCancel={() => handlePedalChange(false, brake, handbrake)}
              className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full border-2 flex flex-col items-center justify-center shadow-lg transition-transform ${
                throttle
                  ? 'bg-emerald-500 border-white text-slate-950 scale-95'
                  : 'bg-slate-900/90 border-emerald-400/60 text-emerald-400'
              }`}
            >
              <ArrowUpCircle className="w-6 h-6" />
              <span className="text-[9px] font-bold">ACEL</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
