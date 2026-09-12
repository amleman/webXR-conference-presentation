/**
 * Deck2D — capa de diapositivas tradicional (DOM + Tailwind).
 *
 * Es lo único que el espectador ve al abrir el enlace: un sitio de slides
 * normal. No sabe nada de Three.js ni del ECS; sólo lee {@link slideIndex} y
 * llama a las acciones que le inyecta el sistema de presentación.
 *
 * Todo el marcado se genera a partir de `SLIDES`, así que el contenido nunca
 * puede divergir del de los paneles 3D.
 */

import { effect } from '@iwsdk/core';
import {
  canGoNext,
  canGoPrev,
  goTo,
  isImmersive,
  next,
  prev,
  slideIndex,
  xrSupported,
} from './state.js';
import {
  mediaUrl,
  PRESENTER,
  REVEAL_INDEX,
  SLIDES,
  SLIDE_COUNT,
  type Slide,
} from './slides.js';

/** Acciones que el deck delega en el sistema dueño del `World`. */
export interface DeckActions {
  enterVR: () => void;
  exitVR: () => void;
}

/** Convierte `#rrggbb` en `r, g, b` para interpolar en `rgba()`. */
function rgbChannels(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Escapa texto de contenido antes de inyectarlo como HTML. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* -------------------------------------------------------------------------- */
/* Mockups visuales                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Slide 2 — ventana del Editor de Unity.
 *
 * Reproduce el encuadre real que ve alguien montando un proyecto para Quest:
 * Hierarchy con el rig, Inspector cargado de componentes, el navegador de
 * Assets con prefabs y mallas `.obj`, y la consola compilando el APK.
 */
function unityEditorMarkup(): string {
  const hierarchy = [
    ['0', 'VRScene', 'scene'],
    ['1', 'OVRCameraRig', 'prefab'],
    ['2', 'TrackingSpace', ''],
    ['3', 'CenterEyeAnchor', ''],
    ['3', 'LeftHandAnchor', ''],
    ['3', 'RightHandAnchor', ''],
    ['1', 'OVRInteraction', 'prefab'],
    ['1', 'PassthroughLayer', ''],
    ['1', 'Environment', ''],
    ['2', 'Table_LP', 'obj'],
  ];

  const assets = [
    ['📁', 'Assets / Prefabs', ''],
    ['🟦', 'HandGrabInteractable', '.prefab'],
    ['🟦', 'BuildingBlock_Passthrough', '.prefab'],
    ['📁', 'Assets / Models', ''],
    ['🔺', 'Table_LP', '.obj'],
    ['🔺', 'Shelf_LP', '.obj'],
    ['📁', 'Assets / Materials', ''],
    ['🎨', 'Wood_URP', '.mat'],
  ];

  const row = ([depth, name, tag]: string[]) => `
    <div class="flex items-center gap-1.5 rounded-sm px-1.5 py-[3px] hover:bg-white/[0.06]"
         style="padding-left:${6 + Number(depth) * 11}px">
      <span class="text-white/25">${Number(depth) > 0 ? '└' : '▾'}</span>
      <span class="truncate text-white/75">${name}</span>
      ${
        tag === ''
          ? ''
          : `<span class="ml-auto shrink-0 rounded-sm px-1 text-[9px] ${
              tag === 'prefab'
                ? 'bg-[#6cc6ff]/20 text-[#6cc6ff]'
                : tag === 'obj'
                  ? 'bg-[#c9a2ff]/20 text-[#c9a2ff]'
                  : 'bg-white/10 text-white/40'
            }">${tag}</span>`
      }
    </div>`;

  return `
    <div class="w-full overflow-hidden rounded-xl border border-white/10 bg-[#383838] font-mono text-[10px] leading-relaxed shadow-2xl shadow-black/60 sm:text-[11px]">
      <!-- Barra de título -->
      <div class="flex items-center gap-2 border-b border-black/50 bg-[#4a4a4a] px-3 py-2">
        <span class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-[#febc2e]"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-[#28c840]"></span>
        <span class="ml-2 truncate text-white/65">Unity 6.3 LTS — VRProject</span>
        <span class="ml-auto shrink-0 rounded bg-[#2c2c2c] px-2 py-0.5 text-[#6cc6ff]">Meta Quest</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-[1.05fr_1fr]">
        <!-- Hierarchy -->
        <div class="border-b border-black/40 bg-[#2b2b2b] p-2 sm:border-b-0 sm:border-r">
          <div class="mb-1.5 px-1 text-[9px] uppercase tracking-widest text-white/40">Hierarchy</div>
          ${hierarchy.map(row).join('')}
        </div>

        <!-- Inspector -->
        <div class="bg-[#2b2b2b] p-2">
          <div class="mb-1.5 px-1 text-[9px] uppercase tracking-widest text-white/40">Inspector — OVRCameraRig</div>
          <div class="space-y-1">
            ${[
              'OVR Manager (Script)',
              'OVR Camera Rig (Script)',
              'Hand Grab Interactor',
              'Locomotion Provider',
              'Rigidbody · Box Collider',
            ]
              .map(
                (c) => `
              <div class="flex items-center gap-2 rounded-sm bg-white/[0.05] px-2 py-1">
                <span class="text-[#6cc6ff]">#</span>
                <span class="truncate text-white/75">${c}</span>
              </div>`,
              )
              .join('')}
            <div class="px-2 pt-0.5 text-white/30 caret">+ 18 componentes más</div>
          </div>
        </div>
      </div>

      <!-- Project / Assets -->
      <div class="border-t border-black/40 bg-[#2b2b2b] p-2">
        <div class="mb-1.5 px-1 text-[9px] uppercase tracking-widest text-white/40">Project</div>
        <div class="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
          ${assets
            .map(
              ([icon, name, ext]) => `
            <div class="flex items-center gap-1.5 truncate px-1 py-[2px]">
              <span>${icon}</span>
              <span class="truncate ${ext === '' ? 'text-white/45' : 'text-white/75'}">${name}</span>
              <span class="shrink-0 text-white/25">${ext}</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>

      <!-- Console + build -->
      <div class="border-t border-black/40 bg-[#232323] p-2.5">
        <div class="mb-1.5 flex items-baseline justify-between">
          <span class="text-[9px] uppercase tracking-widest text-white/40">Console</span>
          <span class="text-[#febc2e]">Building APK…  01:47:22</span>
        </div>
        <div class="build-bar mb-1.5 h-1.5 w-full rounded-full bg-black/60"></div>
        <div class="space-y-1">
          <div class="truncate text-white/45">Compiling assembly-csharp.dll · baking lightmaps (3/7)</div>
          <div class="truncate text-[#8ee6a0]">adb install -r VRProject.apk → Meta Quest 3</div>
        </div>
      </div>
    </div>`;
}

/** Slide 3 — Building Blocks: módulos que se arrastran, mundo que se monta a mano. */
function buildingBlocksMarkup(): string {
  const blocks = [
    ['📷', 'Camera Rig'],
    ['👁️', 'Passthrough'],
    ['✋', 'Hand Tracking'],
    ['🎮', 'Controllers'],
    ['🤏', 'Grab Interaction'],
    ['👉', 'Poke Interaction'],
  ];

  return `
    <div class="w-full rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5">
      <div class="mb-3 text-[10px] uppercase tracking-widest text-amber-200/60">
        Building Blocks · arrastrar y soltar
      </div>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        ${blocks
          .map(
            ([icon, label]) => `
          <div class="flex items-center gap-2 rounded-lg border border-amber-400/25 bg-[#1b1509]/70 px-3 py-2.5">
            <span class="text-lg">${icon}</span>
            <span class="truncate text-xs text-amber-100/80">${label}</span>
          </div>`,
          )
          .join('')}
      </div>
      <div class="mt-4 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <span class="text-lg">🛠️</span>
        <span class="text-xs leading-relaxed text-white/50">
          …y a partir de aquí, <span class="text-white/80">todo a mano</span>: prefabs objeto por
          objeto, colliders, iluminación y lightmaps horneados.
        </span>
      </div>
    </div>`;
}

/** Slide 4 — diagrama de flujo: URL → Navegador → Experiencia inmersiva. */
function webxrFlowMarkup(): string {
  const steps = [
    { icon: '🔗', label: 'URL / QR', note: 'un enlace' },
    { icon: '🌐', label: 'Navegador', note: 'sin instalar' },
    { icon: '🕶️', label: 'Inmersión', note: 'en 1 segundo' },
  ];
  const arrow = `
    <div class="flex items-center justify-center text-cyan-300/70" aria-hidden="true">
      <span class="hidden text-2xl sm:inline">→</span>
      <span class="text-2xl sm:hidden">↓</span>
    </div>`;

  return `
    <div class="w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-5 sm:p-6">
      <div class="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        ${steps
          .map(
            (step, i) => `
          ${i > 0 ? arrow : ''}
          <div class="rounded-lg border border-cyan-400/25 bg-[#071620]/80 px-4 py-4 text-center">
            <div class="text-2xl">${step.icon}</div>
            <div class="font-display mt-2 whitespace-nowrap text-sm text-cyan-200">${step.label}</div>
            <div class="mt-0.5 text-xs text-white/45">${step.note}</div>
          </div>`,
          )
          .join('')}
      </div>
      <div class="mt-4 text-center text-xs text-white/40">
        Sin APK. Sin ADB. Sin tienda. El mismo enlace en
        <span class="text-cyan-300">Quest 3</span> y en
        <span class="text-cyan-300">Vision Pro</span>.
      </div>
    </div>`;
}

/** Slide 5 — tres pilares de la creación asistida por agentes. */
function aiPillarsMarkup(): string {
  const pillars = [
    { icon: '✨', title: 'Prompt → Escena', body: 'Geometría, materiales y layout generados desde texto.' },
    { icon: '☁️', title: 'Assets en la nube', body: 'Decimación, LODs y compresión automáticas antes de servir.' },
    { icon: '💬', title: 'NPCs vivos', body: 'Diálogo y comportamiento en tiempo real dentro del entorno.' },
  ];
  return `
    <div class="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
      ${pillars
        .map(
          (p) => `
        <div class="rounded-xl border border-violet-400/20 bg-violet-400/[0.05] p-4">
          <div class="text-2xl">${p.icon}</div>
          <div class="font-display mt-2 text-sm text-violet-200">${p.title}</div>
          <div class="mt-1.5 text-xs leading-relaxed text-white/50">${p.body}</div>
        </div>`,
        )
        .join('')}
    </div>`;
}

function visualMarkup(slide: Slide): string {
  switch (slide.visual) {
    case 'unity-editor':
      return unityEditorMarkup();
    case 'building-blocks':
      return buildingBlocksMarkup();
    case 'webxr-flow':
      return webxrFlowMarkup();
    case 'ai-pillars':
      return aiPillarsMarkup();
    default:
      return '';
  }
}

/* -------------------------------------------------------------------------- */
/* Deck                                                                        */
/* -------------------------------------------------------------------------- */

export class Deck2D {
  private readonly root: HTMLElement;
  private readonly header: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly actions: DeckActions;
  private readonly disposers: Array<() => void> = [];

  /** Coordenada X del `touchstart` en curso, para detectar swipes. */
  private touchStartX = 0;

  constructor(actions: DeckActions) {
    this.actions = actions;
    this.root = document.getElementById('deck-2d') as HTMLElement;
    this.header = document.getElementById('deck-header') as HTMLElement;
    this.stage = document.getElementById('slide-stage') as HTMLElement;
    this.footer = document.getElementById('deck-footer') as HTMLElement;
  }

  /** Conecta listeners y suscribe el render a las señales. */
  mount(): void {
    this.bindKeyboard();
    this.bindTouch();
    this.bindDelegatedClicks();

    // Un único `effect` cubre slide activa, soporte XR y estado inmersivo.
    this.disposers.push(
      effect(() => {
        const index = slideIndex.value;
        const immersive = isImmersive.value;
        // Leídas para que el efecto se re-ejecute cuando cambien.
        void xrSupported.value;
        void canGoNext.value;
        void canGoPrev.value;

        this.root.hidden = immersive;
        if (!immersive) {
          this.render(index);
        }
      }),
    );
  }

  /** Retira listeners y suscripciones. */
  dispose(): void {
    while (this.disposers.length > 0) {
      this.disposers.pop()?.();
    }
  }

  /* ---------------------------------------------------------------------- */

  private render(index: number): void {
    const slide = SLIDES[index];
    const rgb = rgbChannels(slide.accent.hex);

    this.header.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="font-display text-xs tracking-[0.28em] text-white/45">COECYS</span>
        <span class="h-4 w-px bg-white/15"></span>
        <span class="font-display text-xs tracking-[0.22em]" style="color:${slide.accent.hex}">
          ${slide.accent.kicker}
        </span>
      </div>
      <div class="flex items-center gap-3 text-xs text-white/35">
        <span class="font-mono">${String(index + 1).padStart(2, '0')} / ${String(SLIDE_COUNT).padStart(2, '0')}</span>
        ${
          xrSupported.value
            ? `<span class="hidden items-center gap-1.5 sm:inline-flex">
                 <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> WebXR disponible
               </span>`
            : `<span class="hidden sm:inline">Modo 2D</span>`
        }
      </div>`;

    this.stage.innerHTML = `
      <article class="slide-enter w-full max-w-6xl" data-slide="${slide.id}">
        ${slide.kind === 'content' ? this.contentMarkup(slide, rgb) : this.heroMarkup(slide, rgb)}
      </article>`;

    this.footer.innerHTML = `
      <div class="flex items-center gap-2">
        <button class="btn" data-action="prev" ${canGoPrev.value ? '' : 'disabled'} aria-label="Slide anterior">
          <span aria-hidden="true">←</span><span class="hidden sm:inline">Anterior</span>
        </button>
        ${
          canGoNext.value
            ? `<button class="btn" data-action="next" aria-label="Siguiente slide">
                 <span class="hidden sm:inline">Siguiente</span><span aria-hidden="true">→</span>
               </button>`
            : ''
        }
      </div>

      <div class="flex items-center gap-2" role="tablist" aria-label="Diapositivas">
        ${SLIDES.map(
          (s, i) => `
          <button
            role="tab"
            aria-selected="${i === index}"
            aria-label="Ir a ${esc(s.title)}"
            data-action="goto"
            data-index="${i}"
            class="h-1.5 rounded-full transition-all ${
              i === index ? 'w-7' : 'w-1.5 bg-white/20 hover:bg-white/40'
            }"
            style="${i === index ? `background:${s.accent.hex}; box-shadow:0 0 12px rgba(${rgbChannels(s.accent.hex)},0.8)` : ''}"
          ></button>`,
        ).join('')}
      </div>

      <div class="flex items-center gap-2">
        ${this.vrButtonMarkup(index, /* hero */ false, index !== REVEAL_INDEX)}
      </div>`;

    this.bindMediaFallbacks();
  }

  /** Portada y revelación: tipografía grande y centrada. */
  private heroMarkup(slide: Slide, rgb: string): string {
    const isReveal = slide.kind === 'reveal';
    return `
      <div class="stagger flex flex-col items-center text-center">
        <div class="rounded-full border px-4 py-1.5 text-[11px] font-semibold tracking-[0.3em]"
             style="border-color:rgba(${rgb},0.4); color:${slide.accent.hex}; background:rgba(${rgb},0.08)">
          ${isReveal ? 'PLOT TWIST' : 'CONFERENCIA'}
        </div>

        <h1 class="font-display mt-6 max-w-4xl text-2xl leading-tight sm:text-4xl lg:text-5xl"
            style="text-shadow:0 0 48px rgba(${rgb},0.45)">
          ${esc(slide.title)}
        </h1>

        ${
          slide.subtitle
            ? `<p class="mt-5 max-w-2xl text-sm text-white/55 sm:text-lg">${esc(slide.subtitle)}</p>`
            : ''
        }

        ${
          isReveal
            ? `<div class="mt-10 flex flex-col items-center gap-4">
                 ${this.vrButtonMarkup(REVEAL_INDEX, /* hero */ true)}
                 <p class="max-w-md text-xs leading-relaxed text-white/35">
                   Los paneles que acabas de leer existen también como geometría en un entorno 3D.
                   Ponte las gafas y se materializan a tu alrededor, en la misma slide en la que estás.
                 </p>
               </div>`
            : `${this.presenterMarkup(rgb)}
               ${this.mediaMarkup(slide, /* compact */ true)}
               <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
                 <button class="btn btn-vr" data-action="next">
                   Comenzar <span aria-hidden="true">→</span>
                 </button>
                 ${this.vrButtonMarkup(0, /* hero */ false, /* showFallback */ false)}
               </div>`
        }
      </div>`;
  }

  /** Firma del ponente en la portada. */
  private presenterMarkup(rgb: string): string {
    return `
      <div class="mt-9 flex flex-col items-center gap-1.5">
        <div class="h-px w-16" style="background:linear-gradient(90deg,transparent,rgba(${rgb},0.7),transparent)"></div>
        <p class="mt-2 text-xs uppercase tracking-[0.24em] text-white/35">Presentado por</p>
        <p class="font-display text-lg text-white/90 sm:text-xl">${PRESENTER.name}</p>
        <p class="text-xs tracking-[0.18em] text-white/45">
          ${PRESENTER.role} <span class="mx-1.5 text-white/20">·</span> ${PRESENTER.year}
        </p>
      </div>`;
  }

  /** Slides de contenido: título + puntos a la izquierda, mockup a la derecha. */
  private contentMarkup(slide: Slide, rgb: string): string {
    const bullets = (slide.bullets ?? [])
      .map(
        (b) => `
        <li class="flex items-start gap-3">
          <span class="mt-0.5 shrink-0 text-base" aria-hidden="true">${b.icon}</span>
          <div class="min-w-0">
            <p class="text-sm font-medium leading-snug text-white/85 sm:text-[15px]">${esc(b.text)}</p>
            ${
              b.detail == null
                ? ''
                : `<ul class="mt-1.5 space-y-1">
                     ${b.detail
                       .map(
                         (d) => `
                       <li class="flex gap-2 text-[12px] leading-relaxed text-white/50 sm:text-[13px]">
                         <span class="shrink-0" style="color:rgba(${rgb},0.6)">—</span>
                         <span>${esc(d)}</span>
                       </li>`,
                       )
                       .join('')}
                   </ul>`
            }
          </div>
        </li>`,
      )
      .join('');

    return `
      <div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div class="stagger">
          <h2 class="font-display text-xl leading-snug sm:text-2xl lg:text-3xl"
              style="text-shadow:0 0 40px rgba(${rgb},0.35)">
            ${esc(slide.title)}
          </h2>
          ${slide.subtitle ? `<p class="mt-2.5 text-sm text-white/45">${esc(slide.subtitle)}</p>` : ''}
          <ul class="mt-5 space-y-4">${bullets}</ul>
        </div>
        <div class="stagger space-y-3">
          ${visualMarkup(slide)}
          ${this.mediaMarkup(slide, /* compact */ false)}
        </div>
      </div>`;
  }

  /**
   * Tira de imágenes.
   *
   * En 2D todas caen aquí, en fila, porque la pantalla es un rectángulo. En XR
   * estas mismas imágenes se despegan y flotan alrededor del espectador — la
   * diferencia entre ambas capas es justo el argumento de la charla.
   */
  private mediaMarkup(slide: Slide, compact: boolean): string {
    const media = slide.media ?? [];
    if (media.length === 0) {
      return '';
    }

    const figures = media
      .map(
        (m) => `
      <figure class="media-figure min-w-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
        <img
          src="${mediaUrl(m.src)}"
          alt="${esc(m.caption)}"
          loading="lazy"
          class="block w-full object-cover ${compact ? 'max-h-44' : 'max-h-32'}"
          style="aspect-ratio:${m.aspect ?? 1.6}"
        />
        <figcaption class="px-2.5 py-1.5 text-left text-[11px] leading-tight text-white/45">
          ${esc(m.caption)}
          ${m.source ? `<span class="block text-[10px] text-white/25">${esc(m.source)}</span>` : ''}
        </figcaption>
      </figure>`,
      )
      .join('');

    return `<div class="${compact ? 'mt-8 w-full max-w-lg' : ''} flex gap-3">${figures}</div>`;
  }

  /**
   * Las imágenes son opcionales: si un archivo no está en `public/images/`, la
   * figura se retira en silencio en vez de dejar el icono de imagen rota.
   */
  private bindMediaFallbacks(): void {
    for (const img of this.stage.querySelectorAll<HTMLImageElement>('.media-figure img')) {
      img.addEventListener(
        'error',
        () => {
          img.closest('figure')?.remove();
        },
        { once: true },
      );
    }
  }

  /**
   * Botón de entrada a VR.
   *
   * Sin soporte `immersive-vr` se sustituye por una nota que explica el
   * requisito — parte del mensaje de la charla es que hace falta un navegador,
   * no una instalación. `showFallback` evita repetir esa nota: sólo la imprime
   * quien es el sitio natural para ella en cada slide.
   */
  private vrButtonMarkup(
    index: number,
    hero: boolean,
    showFallback = true,
  ): string {
    const label = hero
      ? 'PONTELAS · ENTRAR A VR AHORA'
      : index === 0
        ? 'Entrar en VR'
        : 'Ver en VR';

    if (!xrSupported.value) {
      return showFallback
        ? `<span class="text-right text-[11px] leading-tight text-white/30 sm:text-xs">
             🕶️ Ábrelo en Meta Quest<br class="hidden sm:block" /> para el modo inmersivo
           </span>`
        : '';
    }

    return `
      <button class="btn btn-vr ${hero ? 'btn-vr-hero font-display' : ''}" data-action="enter-vr">
        <span aria-hidden="true">🕶️</span> ${label}
      </button>`;
  }

  /* ---------------------------------------------------------------------- */

  /** Un solo listener en la raíz cubre todos los botones re-renderizados. */
  private bindDelegatedClicks(): void {
    const onClick = (event: Event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (target == null) {
        return;
      }
      switch (target.dataset.action) {
        case 'next':
          next();
          break;
        case 'prev':
          prev();
          break;
        case 'goto':
          goTo(Number(target.dataset.index));
          break;
        case 'enter-vr':
          this.actions.enterVR();
          break;
        case 'exit-vr':
          this.actions.exitVR();
          break;
      }
    };
    this.root.addEventListener('click', onClick);
    this.disposers.push(() => this.root.removeEventListener('click', onClick));
  }

  private bindKeyboard(): void {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          event.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault();
          prev();
          break;
        case 'Home':
          event.preventDefault();
          goTo(0);
          break;
        case 'End':
          event.preventDefault();
          goTo(SLIDE_COUNT - 1);
          break;
        case 'v':
        case 'V':
          if (xrSupported.peek()) {
            this.actions.enterVR();
          }
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    this.disposers.push(() => window.removeEventListener('keydown', onKey));
  }

  /** Swipe horizontal en móvil; umbral generoso para no competir con el scroll. */
  private bindTouch(): void {
    const onStart = (event: TouchEvent) => {
      this.touchStartX = event.changedTouches[0]?.clientX ?? 0;
    };
    const onEnd = (event: TouchEvent) => {
      const delta = (event.changedTouches[0]?.clientX ?? 0) - this.touchStartX;
      if (Math.abs(delta) < 70) {
        return;
      }
      if (delta < 0) {
        next();
      } else {
        prev();
      }
    };
    this.root.addEventListener('touchstart', onStart, { passive: true });
    this.root.addEventListener('touchend', onEnd, { passive: true });
    this.disposers.push(
      () => this.root.removeEventListener('touchstart', onStart),
      () => this.root.removeEventListener('touchend', onEnd),
    );
  }
}
