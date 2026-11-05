import React, { useEffect, useRef } from 'react';
import { ROAD_SEGMENTS, WORLD_POIS } from '../game/WorldLayout';
import { ActiveDeliveryPhase, DeliveryOrder } from '../types/game';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  trafficDots?: { x: number; z: number }[];
  activeOrder: DeliveryOrder | null;
  deliveryPhase: ActiveDeliveryPhase | null;
  customWaypoint: { x: number; z: number; label: string } | null;
  districtName: string;
}

export const Minimap: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  playerYaw,
  trafficDots = [],
  activeOrder,
  deliveryPhase,
  customWaypoint,
  districtName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 136;
    const half = size / 2;
    const scale = 0.36; // world meters -> radar pixels

    ctx.clearRect(0, 0, size, size);

    // Circular radar background
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    // Subtle concentric range rings
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    [24, 48].forEach((r) => {
      ctx.beginPath();
      ctx.arc(half, half, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    const toRadar = (wx: number, wz: number) => ({
      rx: half + (wx - playerX) * scale,
      ry: half + (wz - playerZ) * scale,
    });

    // Draw Roads
    ROAD_SEGMENTS.forEach((seg) => {
      const p1 = toRadar(seg.x1, seg.z1);
      const p2 = toRadar(seg.x2, seg.z2);
      ctx.strokeStyle =
        seg.surface === 'dirt'
          ? '#9a5b38'
          : seg.surface === 'alley'
            ? '#64748b'
            : '#334155';
      ctx.lineWidth = Math.max(2, seg.width * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.rx, p1.ry);
      ctx.lineTo(p2.rx, p2.ry);
      ctx.stroke();
    });

    // Draw POIs (Depot, Gas Stations, Workshops, Wholesale)
    WORLD_POIS.forEach((poi) => {
      if (poi.type === 'speed_camera') return;
      const { rx, ry } = toRadar(poi.x, poi.z);
      ctx.fillStyle =
        poi.type === 'depot'
          ? '#f97316'
          : poi.type === 'gas_station'
            ? '#22c55e'
            : poi.type === 'workshop'
              ? '#eab308'
              : '#3b82f6';
      ctx.beginPath();
      ctx.arc(rx, ry, 3.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Live AI Traffic Blips
    ctx.fillStyle = 'rgba(203, 213, 225, 0.72)';
    for (let i = 0; i < trafficDots.length; i++) {
      const td = trafficDots[i];
      const { rx, ry } = toRadar(td.x, td.z);
      ctx.beginPath();
      ctx.arc(rx, ry, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Active Target Route & Pin
    let targetX: number | null = null;
    let targetZ: number | null = null;
    let targetColor = '#ef4444';

    if (activeOrder) {
      if (deliveryPhase === 'TO_DEPOT') {
        targetX = -120;
        targetZ = 91;
        targetColor = '#06b6d4';
      } else {
        targetX = activeOrder.targetX;
        targetZ = activeOrder.targetZ;
        targetColor = '#ef4444';
      }
    } else if (customWaypoint) {
      targetX = customWaypoint.x;
      targetZ = customWaypoint.z;
      targetColor = '#38bdf8';
    }

    if (targetX !== null && targetZ !== null) {
      const tp = toRadar(targetX, targetZ);
      ctx.strokeStyle = targetColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(half, half);
      ctx.lineTo(tp.rx, tp.ry);
      ctx.stroke();
      ctx.setLineDash([]);

      // Clamp marker to radar edge if far away
      const dx = tp.rx - half;
      const dy = tp.ry - half;
      const dist = Math.hypot(dx, dy);
      const maxR = half - 8;
      const mx = dist > maxR ? half + (dx / dist) * maxR : tp.rx;
      const my = dist > maxR ? half + (dy / dist) * maxR : tp.ry;

      ctx.fillStyle = targetColor;
      ctx.beginPath();
      ctx.arc(mx, my, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw Player Directional Arrow at Center
    ctx.save();
    ctx.translate(half, half);
    // In Three.js: +Z is down on 2D map, +X is right. Forward vector is (sin(yaw), cos(yaw))
    const angle = Math.atan2(Math.sin(playerYaw), Math.cos(playerYaw));
    ctx.rotate(-angle + Math.PI);
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.8, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.8, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();

    // Outer metallic ring border
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.24)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(half, half, half - 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [playerX, playerZ, playerYaw, trafficDots, activeOrder, deliveryPhase, customWaypoint]);

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-16 h-16 xl:w-[136px] xl:h-[136px] rounded-full shadow-lg bg-slate-950/90">
        <canvas
          ref={canvasRef}
          width={136}
          height={136}
          className="w-full h-full block rounded-full"
        />
      </div>
      <div className="mt-1 xl:mt-1.5 px-2 xl:px-2.5 py-0.5 rounded bg-slate-950/90 border border-white/10 text-[10px] xl:text-[11px] font-semibold text-slate-200 tracking-wide whitespace-nowrap max-w-[84px] xl:max-w-none truncate">
        {districtName}
      </div>
    </div>
  );
};
