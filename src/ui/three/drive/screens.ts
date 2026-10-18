import * as THREE from 'three';

/*
 * Pantallas del carro dibujadas en canvas (sin imágenes que descargar): la pantalla central del
 * cuadro (reposo y placa de sala), la del radio y la de los celulares de los pasajeros.
 * Usan las fuentes del sitio (Anybody y Doto); si aún no han cargado se dibujan con la de
 * respaldo y se redibujan cuando llegan.
 */

const WIDE = '"Anybody Variable", "Anybody", ui-sans-serif, sans-serif';
const DOT = '"Doto Variable", "Doto", ui-monospace, monospace';

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string; fontStretch?: string };

function ctx(c: HTMLCanvasElement): Ctx {
  return c.getContext('2d') as Ctx;
}

/** Ajusta el tamaño de letra para que el texto quepa en maxW. */
function fit(g: Ctx, text: string, weight: number, family: string, maxW: number, start: number): number {
  let s = start;
  g.font = `${weight} ${s}px ${family}`;
  while (g.measureText(text).width > maxW && s > 8) {
    s -= 1;
    g.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function screenBg(g: Ctx, w: number, h: number) {
  const bg = g.createRadialGradient(w / 2, h * 0.42, 8, w / 2, h / 2, w * 0.75);
  bg.addColorStop(0, '#07303b');
  bg.addColorStop(1, '#010507');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
}

/** Pantalla del cuadro en reposo: la marca (arco con aguja) y CARBEAT. */
export function drawStandby(c: HTMLCanvasElement) {
  const W = (c.width = 512);
  const H = (c.height = 320);
  const g = ctx(c);
  screenBg(g, W, H);
  g.save();
  g.translate(W / 2, 150);
  g.lineCap = 'round';
  g.strokeStyle = '#22d3ee';
  g.shadowColor = '#22d3ee';
  g.shadowBlur = 18;
  g.lineWidth = 9;
  g.beginPath();
  g.arc(0, 0, 70, Math.PI * 0.8, Math.PI * 2.2);
  g.stroke();
  g.shadowBlur = 8;
  g.shadowColor = '#ff5a36';
  g.strokeStyle = '#ff5a36';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(44, -42);
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = '#e2f4f9';
  g.beginPath();
  g.arc(0, 0, 9, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = '10px';
  fit(g, 'CARBEAT', 800, WIDE, W - 120, 52);
  g.fillStyle = '#e2f4f9';
  g.shadowColor = '#22d3ee';
  g.shadowBlur = 14;
  g.fillText('CARBEAT', W / 2 + 5, 284);
  g.shadowBlur = 0;
}

/** Pantalla del cuadro con la placa de la sala: lo primero que se le dicta a un pasajero. */
export function drawPlate(c: HTMLCanvasElement, code = 'VIBE-7KQ3') {
  const W = (c.width = 512);
  const H = (c.height = 320);
  const g = ctx(c);
  screenBg(g, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) g.letterSpacing = '7px';
  g.font = `700 21px ${WIDE}`;
  g.fillStyle = 'rgba(103,232,249,0.8)';
  g.fillText('CARBEAT · SALA ABIERTA', W / 2 + 3, 58);

  // Placa con tornillos, como el componente Plate de la interfaz
  roundRect(g, 34, 84, W - 68, 140, 20);
  g.fillStyle = 'rgba(3,18,24,0.95)';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#22d3ee';
  g.shadowColor = '#22d3ee';
  g.shadowBlur = 20;
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(34,211,238,0.45)';
  for (const x of [56, W - 56]) {
    g.beginPath();
    g.arc(x, 154, 6, 0, Math.PI * 2);
    g.fill();
  }
  if ('letterSpacing' in g) g.letterSpacing = '6px';
  if ('fontStretch' in g) g.fontStretch = 'semi-expanded';
  const size = fit(g, code, 820, WIDE, W - 150, 96);
  g.fillStyle = '#ecfdff';
  g.shadowColor = '#22d3ee';
  g.shadowBlur = 24;
  g.fillText(code, W / 2 + 3, 154 + size * 0.36);
  g.shadowBlur = 0;
  if ('fontStretch' in g) g.fontStretch = 'normal';

  if ('letterSpacing' in g) g.letterSpacing = '2px';
  fit(g, 'DICTA LA PLACA O ESCANEA EL QR', 900, DOT, W - 60, 30);
  g.fillStyle = 'rgba(207,250,254,0.92)';
  g.shadowColor = '#22d3ee';
  g.shadowBlur = 8;
  g.fillText('DICTA LA PLACA O ESCANEA EL QR', W / 2, 282);
  g.shadowBlur = 0;
}

/** Placa trasera del carro: el código de la sala. */
export function drawRearPlate(c: HTMLCanvasElement, code = 'VIBE-7KQ3') {
  const W = (c.width = 512);
  const H = (c.height = 128);
  const g = ctx(c);
  g.fillStyle = '#071219';
  roundRect(g, 0, 0, W, H, 18);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#22d3ee';
  roundRect(g, 5, 5, W - 10, H - 10, 14);
  g.stroke();
  g.textAlign = 'center';
  if ('letterSpacing' in g) g.letterSpacing = '8px';
  const size = fit(g, code, 820, WIDE, W - 70, 84);
  g.fillStyle = '#ecfdff';
  g.fillText(code, W / 2 + 4, H / 2 + size * 0.36);
}

/** Pantalla del radio: lo que suena (barras de portada y título, sin datos inventados). */
export function drawConsole(c: HTMLCanvasElement) {
  const W = (c.width = 384);
  const H = (c.height = 240);
  const g = ctx(c);
  screenBg(g, W, H);
  const cover = g.createLinearGradient(22, 26, 112, 116);
  cover.addColorStop(0, '#0e7490');
  cover.addColorStop(1, '#073042');
  g.fillStyle = cover;
  roundRect(g, 22, 26, 90, 90, 10);
  g.fill();
  g.fillStyle = 'rgba(207,250,254,0.85)';
  g.beginPath();
  g.arc(67, 71, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#073042';
  g.beginPath();
  g.arc(67, 71, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#cffafe';
  roundRect(g, 128, 38, 190, 14, 7);
  g.fill();
  g.fillStyle = '#4fa3b3';
  roundRect(g, 128, 64, 130, 10, 5);
  g.fill();
  g.fillStyle = '#22d3ee';
  roundRect(g, 128, 92, 48, 18, 9);
  g.fill();
  g.fillStyle = '#123a46';
  for (let i = 0; i < 3; i++) {
    roundRect(g, 22, 140 + i * 26, W - 44, 16, 6);
    g.fill();
  }
  g.fillStyle = '#22d3ee';
  g.fillRect(22, 222, 210, 4);
  g.fillStyle = '#123a46';
  g.fillRect(232, 222, W - 254, 4);
}

/** Pantalla de un celular de pasajero: buscador, cola y la tecla de votar. */
export function drawPhone(c: HTMLCanvasElement) {
  const W = (c.width = 160);
  const H = (c.height = 320);
  const g = ctx(c);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#062833');
  bg.addColorStop(1, '#020a0e');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(207,250,254,0.5)';
  roundRect(g, 60, 12, 40, 6, 3);
  g.fill();
  g.strokeStyle = 'rgba(34,211,238,0.8)';
  g.lineWidth = 3;
  roundRect(g, 14, 32, W - 28, 30, 15);
  g.stroke();
  for (let i = 0; i < 4; i++) {
    const y = 80 + i * 44;
    g.fillStyle = i === 0 ? '#22d3ee' : '#0f4250';
    roundRect(g, 14, y, 30, 30, 6);
    g.fill();
    g.fillStyle = i === 0 ? '#cffafe' : '#2a6878';
    roundRect(g, 52, y + 5, 70, 8, 4);
    g.fill();
    g.fillStyle = '#1b5464';
    roundRect(g, 52, y + 18, 48, 6, 3);
    g.fill();
  }
  // Tecla de votar
  g.fillStyle = '#22d3ee';
  roundRect(g, 30, 262, W - 60, 40, 20);
  g.fill();
  g.fillStyle = '#022129';
  g.beginPath();
  g.moveTo(W / 2, 270);
  g.lineTo(W / 2 + 14, 290);
  g.lineTo(W / 2 - 14, 290);
  g.closePath();
  g.fill();
}

/** Textura de canvas que se redibuja cuando llegan las fuentes del sitio. */
export function canvasTexture(draw: (c: HTMLCanvasElement) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  draw(c);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts) {
    Promise.all([fonts.load(`800 80px ${WIDE}`), fonts.load(`900 30px ${DOT}`)])
      .then(() => {
        draw(c);
        tex.needsUpdate = true;
      })
      .catch(() => {});
  }
  return tex;
}
