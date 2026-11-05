import React from 'react';
import {
  CloudRain,
  Gamepad2,
  Moon,
  Play,
  RotateCcw,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  Music,
} from 'lucide-react';
import { WeatherType } from '../types/game';

interface PauseModalProps {
  muted: boolean;
  musicEnabled: boolean;
  weather: WeatherType;
  showTouchControls: boolean;
  onResume: () => void;
  onToggleMute: () => void;
  onToggleMusic: () => void;
  onToggleTouchControls: () => void;
  onSetTime: (hour: number) => void;
  onSetWeather: (w: WeatherType) => void;
  onResetCareer: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  muted,
  musicEnabled,
  weather,
  showTouchControls,
  onResume,
  onToggleMute,
  onToggleMusic,
  onToggleTouchControls,
  onSetTime,
  onSetWeather,
  onResetCareer,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 p-4 sm:p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide text-white">
              Jogo Pausado
            </h2>
            <p className="text-xs text-slate-400">
              Progresso salvo automaticamente no navegador
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Continuar</span>
          </button>
        </div>

        {/* Audio & Controls */}
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Áudio e Controles
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onToggleMute}
                className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  !muted
                    ? 'bg-slate-800 border-slate-600 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>{muted ? 'Mudo' : 'Som Ativo'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleMusic}
                className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  musicEnabled
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>Música</span>
              </button>

              <button
                type="button"
                onClick={onToggleTouchControls}
                className={`px-3 py-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                  showTouchControls
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Touch</span>
              </button>
            </div>
          </div>

          {/* Time of Day & Weather Environment */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2">
              Período do Dia e Clima
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              <button
                type="button"
                onClick={() => onSetTime(9)}
                className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex flex-col items-center gap-1 cursor-pointer"
              >
                <Sun className="w-4 h-4 text-amber-300" />
                <span>Manhã</span>
              </button>
              <button
                type="button"
                onClick={() => onSetTime(14.5)}
                className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex flex-col items-center gap-1 cursor-pointer"
              >
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Tarde</span>
              </button>
              <button
                type="button"
                onClick={() => onSetTime(18.1)}
                className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex flex-col items-center gap-1 cursor-pointer"
              >
                <Sunset className="w-4 h-4 text-orange-400" />
                <span>Entardecer</span>
              </button>
              <button
                type="button"
                onClick={() => onSetTime(22.5)}
                className="px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex flex-col items-center gap-1 cursor-pointer"
              >
                <Moon className="w-4 h-4 text-sky-300" />
                <span>Noite</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['ensolarado', 'nublado', 'chuva'] as WeatherType[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => onSetWeather(w)}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold capitalize flex items-center justify-center gap-1.5 cursor-pointer ${
                    weather === w
                      ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {w === 'chuva' && <CloudRain className="w-3.5 h-3.5" />}
                  <span>{w}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Controls Quick Reference */}
          <div className="rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs text-slate-300 space-y-1">
            <div className="font-semibold text-white mb-1">Atalhos do Teclado</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Dirigir / Andar</span>
              <span className="font-mono-tabular text-amber-300">W A S D / Setas</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Interagir / Entrar / Carregar</span>
              <span className="font-mono-tabular text-amber-300">E</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Freio de Mão / Pular</span>
              <span className="font-mono-tabular text-amber-300">Espaço</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Correr a pé / Turbo Moto</span>
              <span className="font-mono-tabular text-amber-300">Shift</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Buzina / Câmera / Celular</span>
              <span className="font-mono-tabular text-amber-300">H / C / Tab</span>
            </div>
          </div>

          {/* Reset Career */}
          <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
            <button
              type="button"
              onClick={onResetCareer}
              className="px-3.5 py-2 rounded-lg bg-red-950/70 hover:bg-red-900/80 border border-red-800/70 text-red-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar Carreira</span>
            </button>

            <button
              type="button"
              onClick={onResume}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Pressione Esc para voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
