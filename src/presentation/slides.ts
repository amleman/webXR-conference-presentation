/**
 * Contenido de la presentación — fuente de verdad única.
 *
 * Tanto el deck 2D (DOM) como los paneles 3D (CanvasTexture) se derivan de este
 * mismo arreglo. Añadir una slide aquí la hace aparecer en ambas capas sin tocar
 * ningún renderer: eso es lo que mantiene los dos mundos imposibles de
 * desincronizar.
 */

/** Mockups visuales que cada capa sabe dibujar a su manera. */
export type SlideVisual =
  | 'none'
  | 'unity-console'
  | 'webxr-flow'
  | 'ai-pillars';

/** Acento cromático de la slide; se usa en CSS y en el shader/texture 3D. */
export interface SlideAccent {
  /** Color principal, en hexadecimal CSS (`#rrggbb`). */
  hex: string;
  /** Etiqueta corta mostrada en la cápsula superior ("EL PASADO", …). */
  kicker: string;
}

export interface SlideBullet {
  /** Glifo corto a la izquierda del punto. Ninguna dependencia de iconos. */
  icon: string;
  /** Frase principal del punto. */
  text: string;
}

export interface Slide {
  /** Identificador estable; también se usa como sufijo de entidad en 3D. */
  id: string;
  /** `cover` y `reveal` reciben tratamiento tipográfico centrado. */
  kind: 'cover' | 'content' | 'reveal';
  title: string;
  subtitle?: string;
  bullets?: SlideBullet[];
  visual: SlideVisual;
  accent: SlideAccent;
}

export const ACCENT_CYAN = '#22d3ee';
export const ACCENT_AMBER = '#fbbf24';
export const ACCENT_MAGENTA = '#e879f9';
export const ACCENT_VIOLET = '#a78bfa';

export const SLIDES: readonly Slide[] = [
  {
    id: 'portada',
    kind: 'cover',
    title: 'De la Compilación al Prompt',
    subtitle: 'La Evolución del Desarrollo VR de Unity a WebXR e IA',
    visual: 'none',
    accent: { hex: ACCENT_CYAN, kicker: 'PORTADA' },
  },
  {
    id: 'pasado',
    kind: 'content',
    title: 'El Pasado: Motores Pesados y Barreras de Entrada',
    subtitle: 'Cuando publicar una idea costaba una tarde entera de builds.',
    bullets: [
      { icon: '⏳', text: 'Tiempos de compilación de horas por cada iteración' },
      { icon: '🧱', text: 'SDKs nativos pesados y acoplados al dispositivo' },
      { icon: '📦', text: 'Archivos APK de gigabytes que el usuario debía instalar' },
      { icon: '🔒', text: 'Tiendas cerradas: revisión, permisos y meses de espera' },
    ],
    visual: 'unity-console',
    accent: { hex: ACCENT_AMBER, kicker: 'EL PASADO' },
  },
  {
    id: 'presente',
    kind: 'content',
    title: 'El Presente: Inmersión Instantánea sin Instalación',
    subtitle: 'La experiencia es una URL. Nada más.',
    bullets: [
      { icon: '⚡', text: 'Cero descargas y cero instalaciones para el espectador' },
      { icon: '🔗', text: 'Acceso mediante un enlace web o un código QR' },
      { icon: '🕶️', text: 'Interoperabilidad entre Meta Quest y Apple Vision Pro' },
      { icon: '🧩', text: 'IWSDK y frameworks ligeros sobre WebXR y Three.js' },
    ],
    visual: 'webxr-flow',
    accent: { hex: ACCENT_CYAN, kicker: 'EL PRESENTE' },
  },
  {
    id: 'futuro',
    kind: 'content',
    title: 'El Futuro: Creación de Entornos Asistida por IA',
    subtitle: 'El prompt sustituye al pipeline.',
    bullets: [
      { icon: '✨', text: 'Generación de escenas WebXR mediante prompts de texto' },
      { icon: '☁️', text: 'Optimización automática de assets 3D en la nube' },
      { icon: '💬', text: 'NPCs conversacionales en tiempo real dentro de la escena' },
    ],
    visual: 'ai-pillars',
    accent: { hex: ACCENT_VIOLET, kicker: 'EL FUTURO' },
  },
  {
    id: 'revelacion',
    kind: 'reveal',
    title: 'Esta presentación no es un PowerPoint',
    subtitle: 'Es una aplicación WebXR nativa corriendo en tiempo real.',
    visual: 'none',
    accent: { hex: ACCENT_MAGENTA, kicker: 'PLOT TWIST' },
  },
] as const;

export const SLIDE_COUNT = SLIDES.length;

/** Índice de la slide de revelación; el CTA inmersivo se resalta ahí. */
export const REVEAL_INDEX = SLIDES.findIndex((s) => s.kind === 'reveal');
