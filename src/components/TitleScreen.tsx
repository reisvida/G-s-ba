import React from 'react';
import { Play, RotateCcw } from 'lucide-react';

interface TitleScreenProps {
  hasSave: boolean;
  onStart: () => void;
  onNewCareer: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSave,
  onStart,
  onNewCareer,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-8 xl:p-14 overflow-y-auto">
      {/* Subtle left & bottom scrims for crisp typography contrast over live 3D world */}
      <div
        className="fixed inset-y-0 left-0 w-full md:w-[76%] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(9, 14, 28, 0.94) 0%, rgba(9, 14, 28, 0.78) 50%, rgba(9, 14, 28, 0.34) 78%, rgba(9, 14, 28, 0) 100%)',
        }}
      />
      <div
        className="fixed inset-x-0 bottom-0 h-14 pointer-events-none"
        style={{
          background:
            'linear-gradient(0deg, rgba(9, 14, 28, 0.85) 0%, rgba(9, 14, 28, 0) 100%)',
        }}
      />

      {/* Top quiet brand identifier (no navbar, no pills) */}
      <div className="relative z-10 flex items-center gap-3 text-xs font-medium tracking-wide text-amber-400">
        <span>Edição Mundo Aberto 3D</span>
        <span aria-hidden="true" className="text-slate-500">·</span>
        <span className="text-slate-300">Cidade Brasileira</span>
      </div>

      {/* Main Title Lockup & Primary Action */}
      <div className="relative z-10 max-w-xl my-auto py-2 pointer-events-auto">
        {/* Bespoke inline SVG Title Lockup with P13 Gas Cylinder & Flame Emblem */}
        <svg
          viewBox="0 0 540 165"
          className="w-full max-w-[300px] sm:max-w-[390px] xl:max-w-[490px] h-auto mb-2.5 sm:mb-4 xl:mb-5 drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)]"
          role="img"
          aria-label="Gás Delivery Simulator"
        >
          <defs>
            <linearGradient id="cylBlue" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#1d6fe8" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
            <linearGradient id="flameGold" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="60%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
          </defs>

          {/* Stylized P13 Blue Gas Cylinder Emblem on Left */}
          <g transform="translate(8, 12)">
            {/* Top Collar */}
            <path
              d="M28 16 H64 L60 32 H32 Z"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            {/* Brass Valve */}
            <rect x="42" y="6" width="8" height="12" rx="2" fill="#f59e0b" />
            <rect x="37" y="4" width="18" height="5" rx="2" fill="#fbbf24" />
            {/* Main Rounded Steel Body */}
            <rect
              x="14"
              y="30"
              width="64"
              height="88"
              rx="24"
              fill="url(#cylBlue)"
              stroke="#7dd3fc"
              strokeWidth="2.5"
            />
            {/* Base Ring */}
            <rect
              x="22"
              y="114"
              width="48"
              height="10"
              rx="3"
              fill="#0f172a"
              stroke="#38bdf8"
              strokeWidth="2"
            />
            {/* Gas Flame Core */}
            <path
              d="M46 52 C56 64 60 74 56 84 C53 91 40 91 36 84 C32 75 39 63 46 52 Z"
              fill="url(#flameGold)"
            />
            <path
              d="M46 66 C51 73 52 79 49 83 C47 86 44 86 42 83 C40 79 42 72 46 66 Z"
              fill="#ffffff"
              opacity="0.9"
            />
          </g>

          {/* Bold Condensed Display Typography */}
          <text
            x="104"
            y="72"
            fill="#f8fafc"
            fontFamily="'Barlow Condensed', sans-serif"
            fontWeight="800"
            fontSize="68"
            letterSpacing="1"
          >
            GÁS DELIVERY
          </text>
          <text
            x="106"
            y="124"
            fill="#f59e0b"
            fontFamily="'Barlow Condensed', sans-serif"
            fontWeight="800"
            fontSize="46"
            letterSpacing="5"
          >
            SIMULATOR
          </text>
          {/* Road Horizon Stripe */}
          <rect x="106" y="138" width="240" height="4" rx="2" fill="#38bdf8" />
          <rect x="354" y="138" width="52" height="4" rx="2" fill="#f59e0b" />
          <rect x="414" y="138" width="24" height="4" rx="2" fill="#f8fafc" />
        </svg>

        <p className="text-slate-200 text-xs sm:text-sm xl:text-lg leading-relaxed max-w-md mb-3.5 sm:mb-5 xl:mb-7">
          Comece com uma moto simples e um botijão P13, explore bairros, morros e rodovias sem telas de carregamento e construa a maior distribuidora de gás da cidade.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2.5 px-5 py-2.5 sm:px-7 sm:py-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:translate-y-px text-slate-950 font-bold text-sm sm:text-base tracking-wide shadow-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
            <span>{hasSave ? 'Continuar Carreira' : 'Iniciar Jogo'}</span>
          </button>

          {hasSave && (
            <button
              type="button"
              onClick={onNewCareer}
              className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Novo Jogo</span>
            </button>
          )}
        </div>
      </div>

      {/* Single flat control-hint line at bottom */}
      <div className="relative z-10 text-[11px] sm:text-xs xl:text-sm text-slate-300 font-medium">
        WASD Mover · Mouse Câmera · E Interagir / Entrar · Espaço Freio de Mão · H Buzina · Esc Pausar
      </div>
    </div>
  );
};
