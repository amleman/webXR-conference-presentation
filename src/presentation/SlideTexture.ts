/**
 * SlideTexture — dibuja una slide sobre un `<canvas>` y la envuelve en una
 * `CanvasTexture` lista para un panel 3D.
 *
 * Las texturas se pintan una sola vez al arrancar y después sólo se intercambia
 * `material.map`. Nada se repinta por frame: cambiar de slide en VR cuesta una
 * asignación de puntero, no un redibujado.
 *
 * Las slides de contenido se componen a dos columnas — texto a la izquierda,
 * mockup a la derecha — igual que el deck 2D, para que el espectador reconozca
 * la misma diapositiva al ponerse las gafas.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from '@iwsdk/core';
import { PRESENTER, type Slide } from './slides.js';

/** Resolución de la textura. 16:10, suficiente para leer a 2 m sin aliasing. */
export const PANEL_TEXTURE_WIDTH = 1536;
export const PANEL_TEXTURE_HEIGHT = 960;

const INK = '#e6f6ff';
const MUTED = 'rgba(230, 246, 255, 0.55)';
const FAINT = 'rgba(230, 246, 255, 0.3)';

const DISPLAY_FONT = 'Orbitron, system-ui, sans-serif';
const BODY_FONT = 'Inter, system-ui, sans-serif';
const MONO_FONT = '"JetBrains Mono", ui-monospace, monospace';

/** Márgenes y rejilla de dos columnas de las slides de contenido. */
const PAD_X = 64;
const TEXT_COL_WIDTH = 762;
const VISUAL_COL_X = 868;
const VISUAL_COL_WIDTH = PANEL_TEXTURE_WIDTH - PAD_X - VISUAL_COL_X;

/* -------------------------------------------------------------------------- */
/* Utilidades de dibujo                                                        */
/* -------------------------------------------------------------------------- */

/** `#rrggbb` → `r, g, b`, para componer `rgba()` con alfa variable. */
function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Rectángulo redondeado con fallback para motores sin `roundRect`. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Parte `text` en líneas que caben en `maxWidth` con la fuente activa. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(candidate).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') {
    lines.push(line);
  }
  return lines;
}

/** Dibuja líneas envueltas y devuelve la Y del final del bloque. */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'left',
): number {
  ctx.textAlign = align;
  let cursorY = y;
  for (const line of wrapText(ctx, text, maxWidth)) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

/** Etiqueta de sección en mayúsculas, usada dentro de los mockups. */
function drawSectionLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
): void {
  ctx.textAlign = 'left';
  ctx.font = `11px ${MONO_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText(label.toUpperCase(), x, y);
}

/* -------------------------------------------------------------------------- */
/* Mockups                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ventana del Editor de Unity, apilada en vertical para la columna derecha:
 * Hierarchy con el rig, navegador de Assets con prefabs y `.obj`, y la consola
 * compilando y desplegando el APK por ADB.
 */
function drawUnityEditor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = '#383838';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- Barra de título -----------------------------------------------------
  ctx.fillStyle = '#4a4a4a';
  roundRect(ctx, x, y, w, 40, 14);
  ctx.fill();
  ctx.fillRect(x, y + 26, w, 14);

  ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 22 + i * 20, y + 20, 5.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.textAlign = 'left';
  ctx.font = `15px ${MONO_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Unity 6.3 LTS — VRProject', x + 90, y + 26);

  // Plataforma de destino: Meta Quest, no un "Android" genérico.
  ctx.font = `13px ${MONO_FONT}`;
  const badge = 'Meta Quest';
  const badgeW = ctx.measureText(badge).width + 20;
  ctx.fillStyle = '#2c2c2c';
  roundRect(ctx, x + w - badgeW - 14, y + 10, badgeW, 21, 5);
  ctx.fill();
  ctx.fillStyle = '#6cc6ff';
  ctx.fillText(badge, x + w - badgeW - 4, y + 25);

  const padX = x + 16;
  const innerW = w - 32;
  let cursor = y + 62;

  // --- Hierarchy -----------------------------------------------------------
  ctx.fillStyle = '#2b2b2b';
  roundRect(ctx, padX, cursor - 16, innerW, 208, 7);
  ctx.fill();
  drawSectionLabel(ctx, 'Hierarchy', padX + 10, cursor);
  cursor += 16;

  const hierarchy: Array<[number, string, string]> = [
    [0, 'VRScene', ''],
    [1, 'OVRCameraRig', 'prefab'],
    [2, 'TrackingSpace', ''],
    [2, 'LeftHandAnchor', ''],
    [1, 'OVRInteraction', 'prefab'],
    [1, 'PassthroughLayer', ''],
    [1, 'Table_LP', 'obj'],
  ];
  ctx.font = `14px ${MONO_FONT}`;
  for (const [depth, name, tag] of hierarchy) {
    const rowX = padX + 12 + depth * 15;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText(depth > 0 ? '└' : '▾', rowX, cursor + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(name, rowX + 18, cursor + 12);

    if (tag !== '') {
      const tagColor = tag === 'prefab' ? '#6cc6ff' : '#c9a2ff';
      ctx.font = `11px ${MONO_FONT}`;
      const tagW = ctx.measureText(tag).width + 14;
      ctx.fillStyle = `${tagColor}33`;
      roundRect(ctx, padX + innerW - tagW - 12, cursor + 1, tagW, 16, 4);
      ctx.fill();
      ctx.fillStyle = tagColor;
      ctx.fillText(tag, padX + innerW - tagW - 5, cursor + 13);
      ctx.font = `14px ${MONO_FONT}`;
    }
    cursor += 25;
  }

  // --- Project / Assets ----------------------------------------------------
  cursor += 26;
  ctx.fillStyle = '#2b2b2b';
  roundRect(ctx, padX, cursor - 16, innerW, 140, 7);
  ctx.fill();
  drawSectionLabel(ctx, 'Project — Assets', padX + 10, cursor);
  cursor += 18;

  const assets: Array<[string, string, string]> = [
    ['📁', 'Assets / Prefabs', ''],
    ['🟦', 'HandGrabInteractable', '.prefab'],
    ['📁', 'Assets / Models', ''],
    ['🔺', 'Table_LP', '.obj'],
  ];
  for (const [icon, name, ext] of assets) {
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(icon, padX + 12, cursor + 12);
    ctx.font = `14px ${MONO_FONT}`;
    ctx.fillStyle = ext === '' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.78)';
    ctx.fillText(name, padX + 36, cursor + 12);
    if (ext !== '') {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.textAlign = 'right';
      ctx.fillText(ext, padX + innerW - 12, cursor + 12);
      ctx.textAlign = 'left';
    }
    cursor += 27;
  }

  // --- Consola + build -----------------------------------------------------
  cursor += 26;
  const consoleH = y + h - cursor - 2;
  ctx.fillStyle = '#232323';
  roundRect(ctx, padX, cursor - 16, innerW, Math.max(consoleH, 60), 7);
  ctx.fill();
  drawSectionLabel(ctx, 'Console', padX + 10, cursor);

  ctx.font = `13px ${MONO_FONT}`;
  ctx.fillStyle = '#febc2e';
  ctx.textAlign = 'right';
  ctx.fillText('Building APK…  01:47:22', padX + innerW - 12, cursor);
  ctx.textAlign = 'left';
  cursor += 16;

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, padX + 12, cursor, innerW - 24, 8, 4);
  ctx.fill();
  ctx.fillStyle = '#febc2e';
  roundRect(ctx, padX + 12, cursor, (innerW - 24) * 0.42, 8, 4);
  ctx.fill();
  cursor += 28;

  ctx.font = `13px ${MONO_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('baking lightmaps (3/7)', padX + 12, cursor);
  cursor += 22;
  ctx.fillStyle = '#8ee6a0';
  ctx.fillText('adb install -r VRProject.apk', padX + 12, cursor);
}

/** Building Blocks: módulos que se arrastran, y el recordatorio de lo manual. */
function drawBuildingBlocks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): void {
  const channels = rgb(accent);

  const blocks: Array<[string, string]> = [
    ['📷', 'Camera Rig'],
    ['👁️', 'Passthrough'],
    ['✋', 'Hand Tracking'],
    ['🎮', 'Controllers'],
    ['🤏', 'Grab Interaction'],
    ['👉', 'Poke Interaction'],
  ];

  const gap = 12;
  const cols = 2;
  const rows = Math.ceil(blocks.length / cols);
  const cellW = (w - 40 - gap) / cols;
  const cellH = 58;
  const noteH = 86;

  // La caja se dimensiona por su contenido y se centra en la banda disponible:
  // estirarla hasta el borde inferior dejaba un vacío bajo el texto.
  const boxH = 50 + rows * cellH + (rows - 1) * gap + 22 + noteH + 20;
  const boxY = y + Math.max((h - boxH) / 2, 0);

  ctx.fillStyle = `rgba(${channels}, 0.05)`;
  roundRect(ctx, x, boxY, w, boxH, 14);
  ctx.fill();
  ctx.strokeStyle = `rgba(${channels}, 0.25)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = `12px ${MONO_FONT}`;
  ctx.fillStyle = `rgba(${channels}, 0.7)`;
  ctx.fillText('BUILDING BLOCKS · ARRASTRAR Y SOLTAR', x + 20, boxY + 32);

  const gridTop = boxY + 50;

  blocks.forEach(([icon, label], i) => {
    const cx = x + 20 + (i % cols) * (cellW + gap);
    const cy = gridTop + Math.floor(i / cols) * (cellH + gap);

    ctx.fillStyle = 'rgba(27, 21, 9, 0.75)';
    roundRect(ctx, cx, cy, cellW, cellH, 10);
    ctx.fill();
    ctx.strokeStyle = `rgba(${channels}, 0.3)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '26px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(icon, cx + 16, cy + 38);
    ctx.font = `16px ${BODY_FONT}`;
    ctx.fillStyle = 'rgba(255, 240, 210, 0.85)';
    ctx.fillText(label, cx + 54, cy + 36);
  });

  // El remate: lo que el SDK no automatiza.
  const noteTop = gridTop + rows * cellH + (rows - 1) * gap + 22;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  roundRect(ctx, x + 20, noteTop, w - 40, noteH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '24px system-ui, sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText('🛠️', x + 36, noteTop + 36);
  ctx.font = `16px ${BODY_FONT}`;
  ctx.fillStyle = MUTED;
  drawWrapped(
    ctx,
    '…y a partir de aquí, todo a mano: prefabs objeto por objeto, colliders, luces y lightmaps horneados.',
    x + 72,
    noteTop + 30,
    w - 96,
    23,
  );
}

/**
 * Terminal de desarrollo con IWSDK.
 *
 * Contrapunto deliberado del Editor de Unity de la slide 2: allí la consola
 * marca "Building APK… 01:47:22"; aquí marca "ready in 412 ms" y
 * "hmr update — 18 ms".
 */
function drawDevTerminal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): void {
  const channels = rgb(accent);
  const boxH = Math.min(h, 430);
  const boxY = y + Math.max((h - boxH) / 2, 0);

  ctx.fillStyle = '#0b1016';
  roundRect(ctx, x, boxY, w, boxH, 14);
  ctx.fill();
  ctx.strokeStyle = `rgba(${channels}, 0.3)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- Barra de título -----------------------------------------------------
  ctx.fillStyle = '#141b23';
  roundRect(ctx, x, boxY, w, 40, 14);
  ctx.fill();
  ctx.fillRect(x, boxY + 26, w, 14);

  ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 22 + i * 20, boxY + 20, 5.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.textAlign = 'left';
  ctx.font = `15px ${MONO_FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('zsh — presentacion-coecys', x + 90, boxY + 26);

  ctx.font = `13px ${MONO_FONT}`;
  const badgeW = ctx.measureText('HMR').width + 20;
  ctx.fillStyle = `rgba(${channels}, 0.18)`;
  roundRect(ctx, x + w - badgeW - 14, boxY + 10, badgeW, 21, 5);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillText('HMR', x + w - badgeW - 4, boxY + 25);

  // --- Cuerpo --------------------------------------------------------------
  // Cada línea es una lista de tramos [texto, color]; se pintan seguidos para
  // conservar el coloreado de una terminal real sin medir a mano cada columna.
  const dim = 'rgba(255,255,255,0.42)';
  const faint = 'rgba(255,255,255,0.25)';
  const bright = 'rgba(255,255,255,0.9)';
  const cyan = '#67e8f9';
  const violet = '#c4b5fd';

  const lines: Array<Array<[string, string]> | null> = [
    [['➜ ', accent], ['~/proyectos ', faint], ['npm create iwsdk@latest mi-experiencia', bright]],
    [['✔ ', accent], ['Plantilla creada · cero dependencias nativas', dim]],
    [['➜ ', accent], ['~/proyectos ', faint], ['npm run dev', bright]],
    null,
    [['VITE v7.1.4', violet], ['  ready in 412 ms', accent]],
    [['➜ Local:   ', faint], ['https://localhost:8081/', cyan]],
    [['➜ Network: ', faint], ['https://192.168.1.42:8081/', cyan]],
    [['           abre este enlace en el Quest ↑', faint]],
    null,
    [['[vite] ', accent], ['hmr update ', bright], ['/src/scene.ts  ', dim], ['18 ms', accent]],
    [['[vite] ', accent], ['hmr update ', bright], ['/src/systems/panel.ts  ', dim], ['11 ms', accent]],
    [['sin APK · sin ADB · sin reinstalar', faint]],
  ];

  ctx.font = `15px ${MONO_FONT}`;
  let cursor = boxY + 72;
  for (const line of lines) {
    if (line == null) {
      // Separador: un filete tenue en lugar de una línea en blanco.
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 18, cursor - 6, w - 36, 1);
      cursor += 18;
      continue;
    }
    let penX = x + 18;
    for (const [text, color] of line) {
      ctx.fillStyle = color;
      ctx.fillText(text, penX, cursor);
      penX += ctx.measureText(text).width;
    }
    cursor += 27;
  }
}

/** Flujo URL → Navegador → Inmersión, apilado para la columna derecha. */
function drawWebxrFlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): void {
  const channels = rgb(accent);
  const steps: Array<[string, string, string]> = [
    ['🔗', 'URL / QR', 'un enlace'],
    ['🌐', 'Navegador', 'sin instalar'],
    ['🕶️', 'Inmersión', 'en 1 segundo'],
  ];

  const arrowH = 34;
  const boxH = Math.min((h - 60 - arrowH * 2) / 3, 108);
  let cursor = y + 10;

  steps.forEach(([icon, label, note], i) => {
    if (i > 0) {
      ctx.textAlign = 'center';
      ctx.font = '28px system-ui, sans-serif';
      ctx.fillStyle = `rgba(${channels}, 0.65)`;
      ctx.fillText('↓', x + w / 2, cursor + 24);
      cursor += arrowH;
    }

    ctx.fillStyle = `rgba(${channels}, 0.07)`;
    roundRect(ctx, x, cursor, w, boxH, 12);
    ctx.fill();
    ctx.strokeStyle = `rgba(${channels}, 0.35)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '38px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(icon, x + 26, cursor + boxH / 2 + 13);

    ctx.font = `600 22px ${DISPLAY_FONT}`;
    ctx.fillStyle = accent;
    ctx.fillText(label, x + 88, cursor + boxH / 2 - 4);
    ctx.font = `16px ${BODY_FONT}`;
    ctx.fillStyle = FAINT;
    ctx.fillText(note, x + 88, cursor + boxH / 2 + 22);

    cursor += boxH;
  });

  ctx.textAlign = 'center';
  ctx.font = `15px ${BODY_FONT}`;
  ctx.fillStyle = FAINT;
  drawWrapped(
    ctx,
    'Sin APK. Sin ADB. Sin tienda.',
    x + w / 2,
    cursor + 32,
    w,
    21,
    'center',
  );
}

/** Tres pilares de la creación asistida por agentes, apilados. */
function drawAiPillars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): void {
  const channels = rgb(accent);
  const cards: Array<[string, string, string]> = [
    ['✨', 'Prompt → Escena', 'Geometría y layout desde texto'],
    ['☁️', 'Assets en la nube', 'LODs y compresión automáticos'],
    ['💬', 'NPCs vivos', 'Diálogo en tiempo real'],
  ];

  const gap = 16;
  const cardH = Math.min((h - gap * 2) / 3, 128);
  let cursor = y + (h - (cardH * 3 + gap * 2)) / 2;

  for (const [icon, title, body] of cards) {
    ctx.fillStyle = `rgba(${channels}, 0.08)`;
    roundRect(ctx, x, cursor, w, cardH, 14);
    ctx.fill();
    ctx.strokeStyle = `rgba(${channels}, 0.3)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '34px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(icon, x + 24, cursor + cardH / 2 + 12);

    ctx.font = `600 21px ${DISPLAY_FONT}`;
    ctx.fillStyle = accent;
    ctx.fillText(title, x + 78, cursor + cardH / 2 - 6);
    ctx.font = `16px ${BODY_FONT}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(body, x + 78, cursor + cardH / 2 + 22);

    cursor += cardH + gap;
  }
}

function drawVisual(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  switch (slide.visual) {
    case 'unity-editor':
      drawUnityEditor(ctx, x, y, w, h);
      break;
    case 'building-blocks':
      drawBuildingBlocks(ctx, x, y, w, h, slide.accent.hex);
      break;
    case 'webxr-flow':
      drawWebxrFlow(ctx, x, y, w, h, slide.accent.hex);
      break;
    case 'ai-pillars':
      drawAiPillars(ctx, x, y, w, h, slide.accent.hex);
      break;
    case 'dev-terminal':
      drawDevTerminal(ctx, x, y, w, h, slide.accent.hex);
      break;
    default:
      break;
  }
}

/* -------------------------------------------------------------------------- */
/* Chrome común del panel                                                      */
/* -------------------------------------------------------------------------- */

/** Fondo, borde luminoso, cápsula del kicker y contador. */
function drawPanelChrome(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  index: number,
  total: number,
): void {
  const W = PANEL_TEXTURE_WIDTH;
  const H = PANEL_TEXTURE_HEIGHT;
  const accent = slide.accent.hex;
  const channels = rgb(accent);

  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, 'rgba(8, 16, 30, 0.97)');
  bg.addColorStop(1, 'rgba(3, 6, 14, 0.97)');
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fillStyle = bg;
  ctx.fill();

  const wash = ctx.createRadialGradient(W * 0.5, -H * 0.2, 0, W * 0.5, -H * 0.2, H * 1.1);
  wash.addColorStop(0, `rgba(${channels}, 0.22)`);
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = wash;
  ctx.fill();

  ctx.strokeStyle = `rgba(${channels}, 0.55)`;
  ctx.lineWidth = 4;
  roundRect(ctx, 2, 2, W - 4, H - 4, 34);
  ctx.stroke();

  // Cápsula con el kicker
  ctx.font = `700 19px ${DISPLAY_FONT}`;
  const kicker = slide.accent.kicker;
  const kickerW = ctx.measureText(kicker).width + 44;
  ctx.fillStyle = `rgba(${channels}, 0.14)`;
  roundRect(ctx, PAD_X, 52, kickerW, 42, 21);
  ctx.fill();
  ctx.strokeStyle = `rgba(${channels}, 0.45)`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.fillText(kicker, PAD_X + 22, 79);

  // Contador
  ctx.font = `17px ${MONO_FONT}`;
  ctx.fillStyle = FAINT;
  ctx.textAlign = 'right';
  ctx.fillText(
    `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
    W - PAD_X,
    79,
  );

  // Puntos de progreso, horneados para no gastar geometría extra.
  const dotY = H - 46;
  const dotGap = 28;
  const startX = W / 2 - ((total - 1) * dotGap) / 2;
  for (let i = 0; i < total; i += 1) {
    ctx.beginPath();
    if (i === index) {
      roundRect(ctx, startX + i * dotGap - 12, dotY - 6, 30, 11, 5.5);
      ctx.fillStyle = accent;
    } else {
      ctx.arc(startX + i * dotGap, dotY, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230, 246, 255, 0.22)';
    }
    ctx.fill();
  }
}

/* -------------------------------------------------------------------------- */
/* Composición de la slide                                                     */
/* -------------------------------------------------------------------------- */

/** Portada y revelación: bloque de texto medido y centrado en el panel. */
function paintHeroSlide(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  index: number,
  total: number,
): void {
  const W = PANEL_TEXTURE_WIDTH;
  const H = PANEL_TEXTURE_HEIGHT;
  const accent = slide.accent.hex;
  const channels = rgb(accent);

  drawPanelChrome(ctx, slide, index, total);

  const isCover = slide.kind === 'cover';
  const titleFont = `800 ${isCover ? 50 : 62}px ${DISPLAY_FONT}`;
  const titleLineHeight = isCover ? 64 : 78;
  const titleMaxWidth = W - PAD_X * 2 - 120;
  const subtitleFont = `${isCover ? 25 : 30}px ${BODY_FONT}`;
  const subtitleLineHeight = isCover ? 38 : 44;
  const subtitleMaxWidth = W - PAD_X * 2 - 300;

  // Se mide el bloque completo antes de pintar, para centrarlo de verdad en
  // lugar de anclarlo a una Y fija y dejar un hueco debajo.
  ctx.font = titleFont;
  const titleLines = wrapText(ctx, slide.title, titleMaxWidth).length;
  ctx.font = subtitleFont;
  const subtitleLines =
    slide.subtitle == null ? 0 : wrapText(ctx, slide.subtitle, subtitleMaxWidth).length;

  const presenterHeight = isCover ? 132 : 0;
  const blockHeight =
    titleLines * titleLineHeight +
    (subtitleLines > 0 ? 28 + subtitleLines * subtitleLineHeight : 0) +
    presenterHeight;

  let cursorY = (H * 0.9 - blockHeight) / 2 + titleLineHeight * 0.78;

  ctx.shadowColor = `rgba(${channels}, 0.55)`;
  ctx.shadowBlur = 34;
  ctx.fillStyle = INK;
  ctx.font = titleFont;
  cursorY = drawWrapped(
    ctx,
    slide.title,
    W / 2,
    cursorY,
    titleMaxWidth,
    titleLineHeight,
    'center',
  );
  ctx.shadowBlur = 0;

  if (slide.subtitle != null) {
    ctx.font = subtitleFont;
    ctx.fillStyle = MUTED;
    cursorY = drawWrapped(
      ctx,
      slide.subtitle,
      W / 2,
      cursorY + 28,
      subtitleMaxWidth,
      subtitleLineHeight,
      'center',
    );
  }

  if (isCover) {
    // Firma del ponente, separada por un filete degradado.
    const ruleY = cursorY + 26;
    const rule = ctx.createLinearGradient(W / 2 - 90, 0, W / 2 + 90, 0);
    rule.addColorStop(0, 'rgba(0,0,0,0)');
    rule.addColorStop(0.5, `rgba(${channels}, 0.75)`);
    rule.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rule;
    ctx.fillRect(W / 2 - 90, ruleY, 180, 2);

    ctx.textAlign = 'center';
    ctx.font = `14px ${BODY_FONT}`;
    ctx.fillStyle = FAINT;
    ctx.fillText('P R E S E N T A D O   P O R', W / 2, ruleY + 34);

    ctx.font = `700 34px ${DISPLAY_FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(PRESENTER.name, W / 2, ruleY + 78);

    ctx.font = `18px ${BODY_FONT}`;
    ctx.fillStyle = MUTED;
    ctx.fillText(`${PRESENTER.role}  ·  ${PRESENTER.year}`, W / 2, ruleY + 110);
  }

  if (slide.kind === 'reveal') {
    ctx.textAlign = 'center';
    ctx.font = `19px ${BODY_FONT}`;
    ctx.fillStyle = MUTED;
    drawWrapped(
      ctx,
      'Estás dentro. Estos paneles son geometría, no diapositivas.',
      W / 2,
      H - 140,
      W - PAD_X * 2 - 200,
      30,
      'center',
    );
  }
}

/** Slides de contenido: texto a la izquierda, mockup a la derecha. */
function paintContentSlide(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  index: number,
  total: number,
): void {
  const accent = slide.accent.hex;
  const channels = rgb(accent);

  drawPanelChrome(ctx, slide, index, total);

  // --- Columna de texto ----------------------------------------------------
  let cursorY = 168;

  ctx.shadowColor = `rgba(${channels}, 0.5)`;
  ctx.shadowBlur = 30;
  ctx.fillStyle = INK;
  ctx.font = `800 38px ${DISPLAY_FONT}`;
  cursorY = drawWrapped(ctx, slide.title, PAD_X, cursorY, TEXT_COL_WIDTH, 50);
  ctx.shadowBlur = 0;

  if (slide.subtitle != null) {
    ctx.font = `21px ${BODY_FONT}`;
    ctx.fillStyle = MUTED;
    cursorY = drawWrapped(ctx, slide.subtitle, PAD_X, cursorY + 16, TEXT_COL_WIDTH, 29);
  }

  cursorY += 34;
  for (const bullet of slide.bullets ?? []) {
    ctx.textAlign = 'left';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(bullet.icon, PAD_X, cursorY);

    ctx.font = `600 23px ${BODY_FONT}`;
    ctx.fillStyle = 'rgba(230, 246, 255, 0.88)';
    cursorY = drawWrapped(
      ctx,
      bullet.text,
      PAD_X + 42,
      cursorY,
      TEXT_COL_WIDTH - 42,
      31,
    );

    // Desarrollo del punto, con guion del color de acento.
    if (bullet.detail != null) {
      cursorY += 6;
      for (const line of bullet.detail) {
        ctx.font = `18px ${BODY_FONT}`;
        ctx.fillStyle = `rgba(${channels}, 0.65)`;
        ctx.fillText('—', PAD_X + 46, cursorY + 12);
        ctx.fillStyle = 'rgba(230, 246, 255, 0.52)';
        cursorY = drawWrapped(
          ctx,
          line.replace(/`/g, ''),
          PAD_X + 72,
          cursorY + 12,
          TEXT_COL_WIDTH - 72,
          25,
        );
        cursorY += 4;
      }
    }
    cursorY += 20;
  }

  // --- Columna del mockup --------------------------------------------------
  const visualTop = 160;
  const visualHeight = PANEL_TEXTURE_HEIGHT - visualTop - 96;
  drawVisual(ctx, slide, VISUAL_COL_X, visualTop, VISUAL_COL_WIDTH, visualHeight);
}

function paintSlide(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  index: number,
  total: number,
): void {
  if (slide.kind === 'content') {
    paintContentSlide(ctx, slide, index, total);
  } else {
    paintHeroSlide(ctx, slide, index, total);
  }
}

/* -------------------------------------------------------------------------- */
/* Fábrica pública                                                             */
/* -------------------------------------------------------------------------- */

/** Una textura de slide junto con el medio para repintarla. */
export interface SlideTextureHandle {
  texture: CanvasTexture;
  /** Vuelve a pintar el canvas y marca la textura como sucia. */
  repaint: () => void;
}

/**
 * Crea la textura de una slide.
 *
 * Se pinta de inmediato con las fuentes disponibles y se repinta una sola vez
 * cuando `document.fonts` termina de cargar Orbitron/Inter, para no quedarse con
 * la tipografía de respaldo horneada en la textura.
 */
export function createSlideTexture(
  slide: Slide,
  index: number,
  total: number,
): SlideTextureHandle {
  const canvas = document.createElement('canvas');
  canvas.width = PANEL_TEXTURE_WIDTH;
  canvas.height = PANEL_TEXTURE_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('No se pudo obtener un contexto 2D para la textura de slide');
  }

  paintSlide(ctx, slide, index, total);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  // Los paneles se leen a menudo en ángulo; la anisotropía evita el "barrido".
  texture.anisotropy = 4;

  const repaint = () => {
    paintSlide(ctx, slide, index, total);
    texture.needsUpdate = true;
  };

  return { texture, repaint };
}

/** Textura sencilla para un botón: cápsula redondeada con etiqueta centrada. */
export function createButtonTexture(
  label: string,
  accent: string,
  width = 512,
  height = 160,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('No se pudo obtener un contexto 2D para la textura de botón');
  }

  const channels = rgb(accent);
  ctx.clearRect(0, 0, width, height);

  roundRect(ctx, 6, 6, width - 12, height - 12, (height - 12) / 2);
  ctx.fillStyle = `rgba(${channels}, 0.16)`;
  ctx.fill();
  ctx.strokeStyle = `rgba(${channels}, 0.75)`;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 46px ${DISPLAY_FONT}`;
  ctx.fillStyle = INK;
  ctx.shadowColor = `rgba(${channels}, 0.8)`;
  ctx.shadowBlur = 18;
  ctx.fillText(label, width / 2, height / 2 + 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Marco de una imagen satélite: borde luminoso y pie con el texto.
 *
 * La imagen en sí es una textura aparte sobre otro plano; esto es sólo el
 * cristal que la sostiene, para que flote con el mismo lenguaje visual que los
 * paneles de slide.
 */
export function createMediaFrameTexture(
  caption: string,
  source: string | undefined,
  accent: string,
  width = 768,
  height = 128,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('No se pudo obtener un contexto 2D para el pie de imagen');
  }

  const channels = rgb(accent);
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(6, 12, 22, 0.88)';
  roundRect(ctx, 0, 0, width, height, 16);
  ctx.fill();
  ctx.strokeStyle = `rgba(${channels}, 0.45)`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 34px ${BODY_FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText(caption, 28, source == null ? height / 2 + 12 : 54);

  if (source != null) {
    ctx.font = `24px ${MONO_FONT}`;
    ctx.fillStyle = FAINT;
    ctx.fillText(source, 28, 92);
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/**
 * Insignia de estado del modo de entrada ("MANOS" / "MANDOS").
 *
 * Más sobria que un botón: sin resplandor y con menos contraste, porque informa
 * y no invita a pulsarla. Existe para que el público vea el cambio cuando el
 * presentador suelta los mandos y sigue navegando con las manos.
 */
export function createStatusTexture(
  label: string,
  accent: string,
  width = 512,
  height = 132,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx == null) {
    throw new Error('No se pudo obtener un contexto 2D para la insignia de estado');
  }

  const channels = rgb(accent);
  ctx.clearRect(0, 0, width, height);

  roundRect(ctx, 4, 4, width - 8, height - 8, (height - 8) / 2);
  ctx.fillStyle = 'rgba(6, 12, 22, 0.72)';
  ctx.fill();
  ctx.strokeStyle = `rgba(${channels}, 0.4)`;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 40px ${DISPLAY_FONT}`;
  ctx.fillStyle = `rgba(${channels}, 0.95)`;
  ctx.fillText(label, width / 2, height / 2 + 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}
