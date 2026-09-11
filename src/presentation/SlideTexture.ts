/**
 * SlideTexture — dibuja una slide sobre un `<canvas>` y la envuelve en una
 * `CanvasTexture` lista para un panel 3D.
 *
 * Las cinco texturas se pintan una sola vez al arrancar y después sólo se
 * intercambia `material.map`. Nada se repinta por frame: cambiar de slide en VR
 * cuesta una asignación de puntero, no un redibujado.
 *
 * El diseño reproduce la jerarquía del deck 2D (cápsula, título, subtítulo,
 * puntos, mockup, puntos de progreso) para que el espectador reconozca la misma
 * diapositiva al ponerse las gafas.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace } from '@iwsdk/core';
import type { Slide } from './slides.js';

/** Resolución de la textura. 16:10, suficiente para leer a 2 m sin aliasing. */
export const PANEL_TEXTURE_WIDTH = 1536;
export const PANEL_TEXTURE_HEIGHT = 960;

const INK = '#e6f6ff';
const MUTED = 'rgba(230, 246, 255, 0.55)';
const FAINT = 'rgba(230, 246, 255, 0.3)';

const DISPLAY_FONT = 'Orbitron, system-ui, sans-serif';
const BODY_FONT = 'Inter, system-ui, sans-serif';
const MONO_FONT = '"JetBrains Mono", ui-monospace, monospace';

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

/* -------------------------------------------------------------------------- */
/* Mockups simplificados                                                       */
/* -------------------------------------------------------------------------- */

/** Ventana de Unity: inspector saturado, errores y barra de build. */
function drawUnityConsole(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = '#2b2b2b';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();

  // Barra de título
  ctx.fillStyle = '#3c3c3c';
  roundRect(ctx, x, y, w, 40, 14);
  ctx.fill();
  ctx.fillRect(x, y + 26, w, 14);

  const dots = ['#ff5f57', '#febc2e', '#28c840'];
  dots.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 24 + i * 22, y + 20, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `18px ${MONO_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('Unity 2019.4 — VRProject — Android', x + 100, y + 26);

  // Columna izquierda: scripts en C#
  const padX = x + 22;
  let rowY = y + 62;
  ctx.font = `17px ${MONO_FONT}`;
  const scripts = [
    'VRPlayerController.cs',
    'OVRCameraRigManager.cs',
    'TeleportLocomotion.cs',
    'HandPoseBakerEditor.cs',
    'AndroidManifestPatcher.cs',
  ];
  for (const script of scripts) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, padX, rowY, w * 0.44, 30, 5);
    ctx.fill();
    ctx.fillStyle = '#6cc6ff';
    ctx.fillText('#', padX + 12, rowY + 21);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(script, padX + 32, rowY + 21);
    rowY += 36;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('+ 23 componentes más', padX + 12, rowY + 20);

  // Columna derecha: consola de errores
  const colX = x + w * 0.5;
  const colW = w * 0.5 - 24;
  let errY = y + 62;
  const logs: Array<[string, string, string]> = [
    ['#ff5f57', 'rgba(255,95,87,0.12)', 'CS0246: no se encontró OVRInput'],
    ['#ff5f57', 'rgba(255,95,87,0.12)', 'CS1061: XRRig sin TrackingOrigin'],
    ['#febc2e', 'rgba(254,188,46,0.12)', 'Shader stripping: 4.812 variantes'],
  ];
  for (const [accent, bg, label] of logs) {
    ctx.fillStyle = bg;
    roundRect(ctx, colX, errY, colW, 34, 5);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(colX, errY, 3, 34);
    ctx.fillStyle = 'rgba(255,220,215,0.9)';
    ctx.font = `16px ${MONO_FONT}`;
    ctx.fillText(label, colX + 14, errY + 23);
    errY += 42;
  }

  // Barra de progreso "Building APK…"
  const barY = errY + 26;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `16px ${MONO_FONT}`;
  ctx.fillText('Building APK…', colX, barY);
  ctx.fillStyle = '#febc2e';
  ctx.textAlign = 'right';
  ctx.fillText('01:47:22', colX + colW, barY);
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, colX, barY + 12, colW, 10, 5);
  ctx.fill();
  ctx.fillStyle = '#febc2e';
  roundRect(ctx, colX, barY + 12, colW * 0.42, 10, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = `14px ${MONO_FONT}`;
  ctx.fillText('1.3 GB de salida', colX, barY + 44);
}

/** Diagrama URL → Navegador → Inmersión. */
function drawWebxrFlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): void {
  const steps: Array<[string, string]> = [
    ['🔗', 'URL / QR'],
    ['🌐', 'Navegador'],
    ['🕶️', 'Inmersión'],
  ];
  const gap = 44;
  const boxW = (w - gap * 2) / 3;
  const boxH = Math.min(h - 60, 190);
  const boxY = y + (h - boxH) / 2 - 16;

  steps.forEach(([icon, label], i) => {
    const boxX = x + i * (boxW + gap);

    ctx.fillStyle = `rgba(${rgb(accent)}, 0.07)`;
    roundRect(ctx, boxX, boxY, boxW, boxH, 14);
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb(accent)}, 0.35)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '54px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(icon, boxX + boxW / 2, boxY + 82);
    ctx.font = `600 24px ${DISPLAY_FONT}`;
    ctx.fillStyle = accent;
    ctx.fillText(label, boxX + boxW / 2, boxY + 136);

    // Flecha hacia el siguiente paso
    if (i < steps.length - 1) {
      ctx.fillStyle = `rgba(${rgb(accent)}, 0.7)`;
      ctx.font = '38px system-ui, sans-serif';
      ctx.fillText('→', boxX + boxW + gap / 2, boxY + boxH / 2 + 14);
    }
  });

  ctx.textAlign = 'center';
  ctx.font = `18px ${BODY_FONT}`;
  ctx.fillStyle = FAINT;
  ctx.fillText(
    'Sin APK. Sin tienda. El mismo enlace en Quest 3 y en Vision Pro.',
    x + w / 2,
    boxY + boxH + 44,
  );
}

/** Tres tarjetas con los pilares de la creación asistida por IA. */
function drawAiPillars(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
): void {
  const cards: Array<[string, string, string]> = [
    ['✨', 'Prompt → Escena', 'Geometría y layout desde texto'],
    ['☁️', 'Assets en la nube', 'LODs y compresión automáticos'],
    ['💬', 'NPCs vivos', 'Diálogo en tiempo real'],
  ];
  const gap = 26;
  const cardW = (w - gap * 2) / 3;
  const cardH = Math.min(h - 40, 220);
  const cardY = y + (h - cardH) / 2;

  cards.forEach(([icon, title, body], i) => {
    const cardX = x + i * (cardW + gap);

    ctx.fillStyle = `rgba(${rgb(accent)}, 0.08)`;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb(accent)}, 0.3)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(icon, cardX + 24, cardY + 68);

    ctx.font = `600 23px ${DISPLAY_FONT}`;
    ctx.fillStyle = accent;
    ctx.fillText(title, cardX + 24, cardY + 116);

    ctx.font = `18px ${BODY_FONT}`;
    ctx.fillStyle = MUTED;
    drawWrapped(ctx, body, cardX + 24, cardY + 152, cardW - 48, 26);
  });
}

/* -------------------------------------------------------------------------- */
/* Pintado de la slide completa                                                */
/* -------------------------------------------------------------------------- */

function paintSlide(
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

  // Fondo: cristal oscuro con una veladura del color de acento arriba.
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

  // Borde luminoso
  ctx.strokeStyle = `rgba(${channels}, 0.55)`;
  ctx.lineWidth = 4;
  roundRect(ctx, 2, 2, W - 4, H - 4, 34);
  ctx.stroke();

  const padX = 72;
  const contentW = W - padX * 2;

  // Cápsula superior con el kicker
  ctx.font = `700 20px ${DISPLAY_FONT}`;
  const kicker = slide.accent.kicker;
  const kickerW = ctx.measureText(kicker).width + 48;
  ctx.fillStyle = `rgba(${channels}, 0.14)`;
  roundRect(ctx, padX, 56, kickerW, 44, 22);
  ctx.fill();
  ctx.strokeStyle = `rgba(${channels}, 0.45)`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.fillText(kicker, padX + 24, 85);

  // Contador de slide, alineado a la derecha
  ctx.font = `18px ${MONO_FONT}`;
  ctx.fillStyle = FAINT;
  ctx.textAlign = 'right';
  ctx.fillText(
    `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
    W - padX,
    85,
  );

  const centered = slide.kind !== 'content';
  const titleX = centered ? W / 2 : padX;
  const titleAlign: CanvasTextAlign = centered ? 'center' : 'left';

  const titleFont = `800 ${centered ? 66 : 52}px ${DISPLAY_FONT}`;
  const subtitleFont = `${centered ? 32 : 26}px ${BODY_FONT}`;
  const titleLineHeight = centered ? 82 : 68;
  const subtitleLineHeight = centered ? 46 : 38;
  const titleMaxWidth = centered ? contentW - 120 : contentW;
  const subtitleMaxWidth = centered ? contentW - 240 : contentW;

  // Las slides sin puntos ni mockup (portada y revelación) son puro texto: se
  // mide el bloque entero antes de pintarlo para centrarlo de verdad en el
  // panel, en lugar de anclarlo a una Y fija y dejar un hueco debajo.
  let cursorY: number;
  if (centered) {
    ctx.font = titleFont;
    const titleLines = wrapText(ctx, slide.title, titleMaxWidth).length;
    ctx.font = subtitleFont;
    const subtitleLines =
      slide.subtitle == null
        ? 0
        : wrapText(ctx, slide.subtitle, subtitleMaxWidth).length;

    const blockHeight =
      titleLines * titleLineHeight +
      (subtitleLines > 0 ? 30 + subtitleLines * subtitleLineHeight : 0);
    // Centro óptico ligeramente alto: debajo viven los puntos de progreso y,
    // en la revelación, la llamada a la acción.
    cursorY = (H * 0.92 - blockHeight) / 2 + titleLineHeight * 0.78;
  } else {
    cursorY = 190;
  }

  // Título
  ctx.shadowColor = `rgba(${channels}, 0.55)`;
  ctx.shadowBlur = 34;
  ctx.fillStyle = INK;
  ctx.font = titleFont;
  cursorY = drawWrapped(
    ctx,
    slide.title,
    titleX,
    cursorY,
    titleMaxWidth,
    titleLineHeight,
    titleAlign,
  );
  ctx.shadowBlur = 0;

  // Subtítulo
  if (slide.subtitle != null) {
    ctx.font = subtitleFont;
    ctx.fillStyle = MUTED;
    cursorY = drawWrapped(
      ctx,
      slide.subtitle,
      titleX,
      cursorY + (centered ? 30 : 18),
      subtitleMaxWidth,
      subtitleLineHeight,
      titleAlign,
    );
  }

  // Puntos clave
  if (slide.bullets != null && slide.bullets.length > 0) {
    cursorY += 34;
    for (const bullet of slide.bullets) {
      ctx.textAlign = 'left';
      ctx.font = '30px system-ui, sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText(bullet.icon, padX, cursorY);

      ctx.font = `26px ${BODY_FONT}`;
      ctx.fillStyle = 'rgba(230, 246, 255, 0.78)';
      cursorY = drawWrapped(ctx, bullet.text, padX + 52, cursorY, contentW - 52, 36);
      cursorY += 18;
    }
  }

  // Mockup visual, ocupando la banda inferior libre
  const visualTop = Math.max(cursorY + 16, H - 330);
  const visualH = H - visualTop - 108;
  if (visualH > 120) {
    switch (slide.visual) {
      case 'unity-console':
        drawUnityConsole(ctx, padX, visualTop, contentW, visualH);
        break;
      case 'webxr-flow':
        drawWebxrFlow(ctx, padX, visualTop, contentW, visualH, accent);
        break;
      case 'ai-pillars':
        drawAiPillars(ctx, padX, visualTop, contentW, visualH, accent);
        break;
      default:
        break;
    }
  }

  // Llamada a la acción de la slide de revelación
  if (slide.kind === 'reveal') {
    ctx.textAlign = 'center';
    ctx.font = `20px ${BODY_FONT}`;
    ctx.fillStyle = MUTED;
    drawWrapped(
      ctx,
      'Estás dentro. Estos paneles son geometría, no diapositivas.',
      W / 2,
      H - 190,
      contentW - 200,
      32,
      'center',
    );
  }

  // Puntos de progreso: el mismo indicador que el deck 2D, pero horneado
  // en la textura para no gastar geometría extra.
  const dotY = H - 54;
  const dotGap = 30;
  const startX = W / 2 - ((total - 1) * dotGap) / 2;
  for (let i = 0; i < total; i += 1) {
    const active = i === index;
    ctx.beginPath();
    if (active) {
      roundRect(ctx, startX + i * dotGap - 13, dotY - 6, 32, 12, 6);
      ctx.fillStyle = accent;
    } else {
      ctx.arc(startX + i * dotGap, dotY, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(230, 246, 255, 0.22)';
    }
    ctx.fill();
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
