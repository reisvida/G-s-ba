import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  dirtMap: THREE.CanvasTexture;
  sidewalkMap: THREE.CanvasTexture;
  roofTileMap: THREE.CanvasTexture;
  brickMap: THREE.CanvasTexture;
  speedBumpMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  createSignTexture: (text: string, bgHex: string, fgHex: string) => THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const created: THREE.CanvasTexture[] = [];

  const register = (tex: THREE.CanvasTexture, isColor = true) => {
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    created.push(tex);
    return tex;
  };

  // 1. Brazilian Asphalt Road Texture (with yellow double center lines & white edge lines)
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#2b2f38';
  actx.fillRect(0, 0, 512, 512);
  // Subtle aggregate grain
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 34 + Math.floor(Math.random() * 24);
    actx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    actx.fillRect(x, y, 2, 2);
  }
  // White shoulder stripes
  actx.fillStyle = '#d8dee9';
  actx.fillRect(18, 0, 8, 512);
  actx.fillRect(486, 0, 8, 512);
  // Dashed yellow Brazilian center line
  actx.fillStyle = '#f59e0b';
  for (let y = 16; y < 512; y += 64) {
    actx.fillRect(251, y, 10, 36);
  }
  const asphaltMap = register(new THREE.CanvasTexture(asphaltCanvas));
  asphaltMap.wrapS = THREE.RepeatWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;

  // 2. Red-Ochre Dirt Road (Estrada de Terra)
  const dirtCanvas = document.createElement('canvas');
  dirtCanvas.width = 256;
  dirtCanvas.height = 256;
  const dctx = dirtCanvas.getContext('2d')!;
  dctx.fillStyle = '#8d5332';
  dctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    dctx.fillStyle = Math.random() > 0.5 ? '#754124' : '#a6653e';
    dctx.fillRect(x, y, 3, 3);
  }
  // Tire ruts
  dctx.fillStyle = 'rgba(70, 35, 18, 0.32)';
  dctx.fillRect(58, 0, 28, 256);
  dctx.fillRect(170, 0, 28, 256);
  const dirtMap = register(new THREE.CanvasTexture(dirtCanvas));
  dirtMap.wrapS = THREE.RepeatWrapping;
  dirtMap.wrapT = THREE.RepeatWrapping;

  // 3. Concrete Sidewalk Pavers (Calçada)
  const swCanvas = document.createElement('canvas');
  swCanvas.width = 256;
  swCanvas.height = 256;
  const sctx = swCanvas.getContext('2d')!;
  sctx.fillStyle = '#b6bcc6';
  sctx.fillRect(0, 0, 256, 256);
  sctx.strokeStyle = '#8b93a1';
  sctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    sctx.beginPath();
    sctx.moveTo(i, 0);
    sctx.lineTo(i, 256);
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(0, i);
    sctx.lineTo(256, i);
    sctx.stroke();
  }
  const sidewalkMap = register(new THREE.CanvasTexture(swCanvas));
  sidewalkMap.wrapS = THREE.RepeatWrapping;
  sidewalkMap.wrapT = THREE.RepeatWrapping;

  // 4. Terracotta Colonial Roof Tiles (Telha Colonial)
  const roofCanvas = document.createElement('canvas');
  roofCanvas.width = 256;
  roofCanvas.height = 256;
  const rctx = roofCanvas.getContext('2d')!;
  rctx.fillStyle = '#a84724';
  rctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    rctx.fillStyle = '#853316';
    rctx.fillRect(x, 0, 4, 256);
    rctx.fillStyle = '#c45b33';
    rctx.fillRect(x + 5, 0, 6, 256);
  }
  for (let y = 0; y < 256; y += 32) {
    rctx.fillStyle = 'rgba(40,12,4,0.28)';
    rctx.fillRect(0, y, 256, 4);
  }
  const roofTileMap = register(new THREE.CanvasTexture(roofCanvas));
  roofTileMap.wrapS = THREE.RepeatWrapping;
  roofTileMap.wrapT = THREE.RepeatWrapping;

  // 5. Exposed Brazilian Ceramic Brick (Tijolo Baiano)
  const brickCanvas = document.createElement('canvas');
  brickCanvas.width = 256;
  brickCanvas.height = 256;
  const bctx = brickCanvas.getContext('2d')!;
  bctx.fillStyle = '#9e5338';
  bctx.fillRect(0, 0, 256, 256);
  bctx.fillStyle = '#7c746d'; // mortar
  for (let y = 0; y < 256; y += 24) {
    bctx.fillRect(0, y, 256, 3);
    const offset = (y / 24) % 2 === 0 ? 0 : 24;
    for (let x = offset; x < 256; x += 48) {
      bctx.fillRect(x, y, 3, 24);
    }
  }
  const brickMap = register(new THREE.CanvasTexture(brickCanvas));
  brickMap.wrapS = THREE.RepeatWrapping;
  brickMap.wrapT = THREE.RepeatWrapping;

  // 6. Yellow/Black Speed Bump Stripes (Lombada)
  const sbCanvas = document.createElement('canvas');
  sbCanvas.width = 256;
  sbCanvas.height = 64;
  const sbctx = sbCanvas.getContext('2d')!;
  sbctx.fillStyle = '#eab308';
  sbctx.fillRect(0, 0, 256, 64);
  sbctx.fillStyle = '#18181b';
  for (let x = -32; x < 288; x += 48) {
    sbctx.beginPath();
    sbctx.moveTo(x, 0);
    sbctx.lineTo(x + 24, 0);
    sbctx.lineTo(x + 42, 64);
    sbctx.lineTo(x + 18, 64);
    sbctx.closePath();
    sbctx.fill();
  }
  const speedBumpMap = register(new THREE.CanvasTexture(sbCanvas));
  speedBumpMap.wrapS = THREE.RepeatWrapping;
  speedBumpMap.wrapT = THREE.ClampToEdgeWrapping;

  // 7. Radial Soft Contact Shadow Texture
  const csCanvas = document.createElement('canvas');
  csCanvas.width = 128;
  csCanvas.height = 128;
  const csctx = csCanvas.getContext('2d')!;
  const grad = csctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.68)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  csctx.fillStyle = grad;
  csctx.fillRect(0, 0, 128, 128);
  const contactShadowMap = register(new THREE.CanvasTexture(csCanvas));

  // 8. Shop & Depot Signboard Generator
  const createSignTexture = (text: string, bgHex: string, fgHex: string) => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = fgHex;
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = fgHex;
    ctx.font = '800 38px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 66, 468);
    return register(new THREE.CanvasTexture(c));
  };

  return {
    asphaltMap,
    dirtMap,
    sidewalkMap,
    roofTileMap,
    brickMap,
    speedBumpMap,
    contactShadowMap,
    createSignTexture,
    dispose: () => {
      created.forEach((t) => t.dispose());
    },
  };
}
