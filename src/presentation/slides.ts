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
  | 'unity-editor'
  | 'building-blocks'
  | 'webxr-flow'
  | 'ai-pillars'
  | 'dev-terminal';

/**
 * Dónde vive una imagen cuando la presentación está en XR.
 *
 * En 2D todas caen en una tira bajo el contenido, porque la pantalla es un
 * rectángulo y no hay más sitio. En XR se despegan del panel y flotan alrededor
 * del espectador: ahí está el argumento de que los límites de una presentación
 * inmersiva ya no son un cuadro 16:9.
 */
export type MediaPlacement = 'left' | 'right' | 'overhead';

/**
 * Cómo aparece una imagen en el deck 2D. Independiente de `placement`, que sólo
 * gobierna XR.
 *
 * Una pantalla no es un espacio: apilar figuras dentro del marco estira la
 * diapositiva hacia abajo y le quita la proporción. Por eso el 2D puede llevar
 * una imagen al fondo (`corner`) u omitirla (`none`) mientras en XR esa misma
 * imagen sigue flotando junto al espectador.
 */
export type MediaScreenMode = 'inline' | 'corner' | 'none';

export interface SlideMedia {
  /** Nombre del archivo dentro de `public/images/`, sin barra inicial. */
  src: string;
  /** Pie de imagen. También es el texto alternativo en 2D. */
  caption: string;
  /** Origen de la imagen, para la línea de atribución. */
  source?: string;
  /** Proporción ancho/alto. Reserva el espacio antes de que cargue. */
  aspect?: number;
  /** Dónde flota en XR. */
  placement: MediaPlacement;
  /** Cómo se muestra en el deck 2D. Por defecto, `'inline'`. */
  screen?: MediaScreenMode;
}

/** Acento cromático de la slide; se usa en CSS y en la textura 3D. */
export interface SlideAccent {
  /** Color principal, en hexadecimal CSS (`#rrggbb`). */
  hex: string;
  /** Etiqueta corta mostrada en la cápsula superior ("EL WALKTHROUGH", …). */
  kicker: string;
}

export interface SlideBullet {
  /** Glifo corto a la izquierda del punto. Ninguna dependencia de iconos. */
  icon: string;
  /** Enunciado del punto. */
  text: string;
  /** Desarrollo del punto, una línea por idea. Opcional. */
  detail?: string[];
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
  media?: SlideMedia[];
}

export const ACCENT_CYAN = '#22d3ee';
export const ACCENT_AMBER = '#fbbf24';
export const ACCENT_MAGENTA = '#e879f9';
export const ACCENT_VIOLET = '#a78bfa';
export const ACCENT_EMERALD = '#34d399';

/** Quién presenta. Aparece en la portada, en las dos capas. */
export const PRESENTER = {
  name: 'Anthony Alemán',
  role: 'VR / MR Expert',
  year: '2026',
} as const;

export const SLIDES: readonly Slide[] = [
  {
    id: 'portada',
    kind: 'cover',
    title: 'WebXR + Agentes de IA: Destronando la Complejidad del Desarrollo VR Tradicional',
    subtitle:
      'Una mirada evolutiva de la creación en motores 3D al desarrollo asistido en la web inmersiva.',
    visual: 'none',
    accent: { hex: ACCENT_CYAN, kicker: 'PORTADA' },
    media: [
      {
        src: 'meta-quest-3s.webp',
        caption: 'Meta Quest 3S',
        aspect: 1.5,
        placement: 'right',
        screen: 'corner',
      },
    ],
  },

  {
    id: 'walkthrough',
    kind: 'content',
    title: 'El Walkthrough Tradicional: Entorno y Flujo de Desarrollo en Unity',
    subtitle: 'Qué hace falta, de verdad, para montar un proyecto VR desde cero.',
    bullets: [
      {
        icon: '⚙️',
        text: 'El setup inicial',
        detail: [
          'Proyecto Unity con Android Build Support, requisito de los visores standalone como Meta Quest',
          'Instalación e integración del Meta XR SDK y las dependencias de OpenXR',
        ],
      },
      {
        icon: '🔁',
        text: 'El dilema de la prueba e iteración (testing loop)',
        detail: [
          'Opción A — Quest Link / Air Link: se itera directamente en el Editor vía ADB, pero exige una estación con GPU dedicada compatible',
          'Opción B — sin GPU de gama alta: cada ajuste obliga a compilar, generar el APK y desplegarlo al visor por ADB',
        ],
      },
      {
        icon: '⏱️',
        text: 'El impacto en el tiempo',
        detail: [
          'Compilar → Generar APK → Transferir → Probar suma minutos u horas al flujo diario, sólo en pruebas de concepto',
        ],
      },
    ],
    visual: 'unity-editor',
    accent: { hex: ACCENT_AMBER, kicker: 'EL WALKTHROUGH' },
    media: [
      {
        src: 'meta-xr-all-in-one-sdk.jpg',
        caption: 'Meta XR All-in-One SDK',
        source: 'assetstore.unity.com',
        aspect: 1.5,
        placement: 'left',
        screen: 'none',
      },
      {
        src: 'Unity-Meta-parntership.webp',
        caption: 'Meta y Unity, alianza multianual',
        source: 'uploadvr.com',
        aspect: 1.903,
        placement: 'right',
        screen: 'none',
      },
    ],
  },

  {
    id: 'meta-xr-sdk',
    kind: 'content',
    title: 'Meta XR SDK, Fortalezas de Unity y Construcción de Mundos',
    subtitle: 'El SDK moderno quita fricción; el mundo se sigue montando a mano.',
    bullets: [
      {
        icon: '🧱',
        text: 'La evolución del Meta XR SDK',
        detail: [
          'Building Blocks: módulos preconfigurados para arrastrar e integrar rigs de cámara, Passthrough, tracking de manos y controladores',
          'Interaction SDK: agarres, poke, gestos y físicas de interacción sin programar la física desde cero',
        ],
      },
      {
        icon: '🛠️',
        text: 'La artesanía del World Building',
        detail: [
          'Pese a las facilidades del SDK, el entorno sigue siendo 100 % manual: diagramar escenas, colocar prefabs objeto por objeto, ajustar colliders, iluminar y hornear lightmaps',
        ],
      },
      {
        icon: '💪',
        text: 'Las grandes fortalezas de Unity',
        detail: [
          'Control total sobre física, shaders y rendimiento gráfico profundo (URP / HDRP)',
          'Ecosistema maduro con la Asset Store y capacidad de escalar a experiencias AAA masivas',
        ],
      },
    ],
    visual: 'building-blocks',
    accent: { hex: ACCENT_AMBER, kicker: 'EL SDK MODERNO' },
    media: [
      {
        src: 'buildingblocks.png',
        caption: 'Building Blocks del Meta XR SDK',
        source: 'medium.com/antaeus-ar',
        aspect: 1.855,
        placement: 'left',
      },
      {
        src: 'meta-xr-interaction-sdk.jpg',
        caption: 'Meta XR Interaction SDK Essentials',
        source: 'assetstore.unity.com',
        aspect: 1.5,
        placement: 'right',
      },
      {
        src: 'meta-xr-core-sdk.jpg',
        caption: 'Meta XR Core SDK',
        source: 'assetstore.unity.com',
        aspect: 1.5,
        placement: 'overhead',
      },
    ],
  },

  {
    id: 'webxr',
    kind: 'content',
    title: 'WebXR: Inmersión Instantánea, Sin Instalación',
    subtitle: 'La experiencia es una URL. Ahí se acaba el ciclo de APK y ADB.',
    bullets: [
      { icon: '⚡', text: 'Cero descargas y cero instalaciones para el espectador' },
      { icon: '🔗', text: 'Acceso mediante un enlace web o un código QR' },
      {
        icon: '🔃',
        text: 'Iteración con recarga en caliente: sin compilar, sin APK, sin transferir',
      },
      { icon: '🕶️', text: 'El mismo enlace en Meta Quest y en Apple Vision Pro' },
      { icon: '🧩', text: 'IWSDK y frameworks ligeros sobre WebXR y Three.js' },
    ],
    visual: 'webxr-flow',
    accent: { hex: ACCENT_CYAN, kicker: 'LA WEB INMERSIVA' },
  },

  {
    id: 'agentes',
    kind: 'content',
    title: 'Agentes de IA: el World Building deja de ser Artesanal',
    subtitle: 'El prompt sustituye al pipeline manual, no al criterio.',
    bullets: [
      { icon: '✨', text: 'Generación de escenas WebXR completas mediante prompts de texto' },
      { icon: '☁️', text: 'Optimización automática de assets 3D en la nube: decimación, LODs y compresión' },
      { icon: '💬', text: 'NPCs conversacionales en tiempo real dentro de la propia escena' },
      { icon: '🤖', text: 'El agente escribe la escena, los componentes y los sistemas; tú diriges' },
    ],
    visual: 'ai-pillars',
    accent: { hex: ACCENT_VIOLET, kicker: 'LOS AGENTES' },
  },

  {
    id: 'iwsdk',
    kind: 'content',
    title: 'Configuración y Desarrollo con IWSDK',
    subtitle: 'Del motor pesado al stack web estándar.',
    bullets: [
      {
        icon: '⌨️',
        text: 'Inicialización ligera desde la terminal',
        detail: [
          'Node.js y paquetes npm: `npm create iwsdk` sobre Vite',
          'Integra el ecosistema de la web: Three.js y la WebXR API',
        ],
      },
      {
        icon: '⚡',
        text: 'Cero tiempo de compilación (HMR)',
        detail: [
          'Servidor local con `npm run dev` y Hot Module Replacement',
          'Cambias una línea en VS Code y se refleja en milisegundos en el visor, sin compilar APKs',
        ],
      },
      {
        icon: '🔍',
        text: 'Depuración e inspección directa',
        detail: [
          'Chrome DevTools para depurar la escena e inspeccionar elementos',
          'Emulación de controladores en el navegador de la PC, antes de ponértelas',
        ],
      },
      {
        icon: '🧭',
        text: 'Abstracción espacial nativa',
        detail: [
          'Capas de interfaz espacial, gestión de manos y rayos de selección',
          'Rendimiento optimizado para navegadores como Meta Quest Browser',
        ],
      },
    ],
    visual: 'dev-terminal',
    accent: { hex: ACCENT_EMERALD, kicker: 'EL STACK WEB' },
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

/** Ruta pública de una imagen de slide, válida en dev y en subcarpetas. */
export function mediaUrl(src: string): string {
  return `${import.meta.env.BASE_URL}images/${src}`;
}
