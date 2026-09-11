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
import { REVEAL_INDEX, SLIDES, SLIDE_COUNT, type Slide } from './slides.js';

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

/* -------------------------------------------------------------------------- */
/* Mockups visuales                                                            */
/* -------------------------------------------------------------------------- */

/** Slide 2 — ventana de Unity: Inspector saturado, errores y build en curso. */
function unityConsoleMarkup(): string {
  return `
    <div class="w-full overflow-hidden rounded-xl border border-white/10 bg-[#2b2b2b] font-mono text-[11px] leading-relaxed shadow-2xl shadow-black/60 sm:text-xs">
      <div class="flex items-center gap-2 border-b border-black/40 bg-[#3c3c3c] px-3 py-2">
        <span class="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-[#febc2e]"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-[#28c840]"></span>
        <span class="ml-2 truncate text-white/60">Unity 2019.4.31f1 — VRProject — Android</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-[1.05fr_1fr]">
        <!-- Inspector abarrotado de scripts en C# -->
        <div class="border-b border-black/40 p-3 md:border-b-0 md:border-r">
          <div class="mb-2 text-[10px] uppercase tracking-widest text-white/40">Inspector</div>
          <div class="space-y-1.5 text-white/75">
            ${[
              'VRPlayerController.cs',
              'OVRCameraRigManager.cs',
              'TeleportLocomotionProvider.cs',
              'HandPoseBakerEditor.cs',
              'SceneStreamingBootstrap.cs',
              'AudioOcclusionBaker.cs',
              'AndroidManifestPatcher.cs',
            ]
              .map(
                (script) => `
              <div class="flex items-center gap-2 rounded-sm bg-white/[0.04] px-2 py-1">
                <span class="text-[#6cc6ff]">#</span>
                <span class="truncate">${script}</span>
                <span class="ml-auto shrink-0 text-white/25">Script</span>
              </div>`,
              )
              .join('')}
            <div class="pt-1 text-white/30 caret">+ 23 componentes más</div>
          </div>
        </div>

        <!-- Consola con errores de compilación -->
        <div class="p-3">
          <div class="mb-2 text-[10px] uppercase tracking-widest text-white/40">Console</div>
          <div class="space-y-1.5">
            <div class="rounded-sm border-l-2 border-[#ff5f57] bg-[#ff5f57]/10 px-2 py-1 text-[#ffb3ae]">
              CS0246: no se encontró el tipo <span class="text-white">OVRInput</span>
            </div>
            <div class="rounded-sm border-l-2 border-[#ff5f57] bg-[#ff5f57]/10 px-2 py-1 text-[#ffb3ae]">
              CS1061: <span class="text-white">XRRig</span> no contiene <span class="text-white">TrackingOrigin</span>
            </div>
            <div class="rounded-sm border-l-2 border-[#febc2e] bg-[#febc2e]/10 px-2 py-1 text-[#ffe0a3]">
              Shader variant stripping: 4.812 variantes
            </div>
            <div class="rounded-sm border-l-2 border-white/20 bg-white/[0.04] px-2 py-1 text-white/50">
              Gradle: resolviendo dependencias (3/17)
            </div>
          </div>

          <!-- Barra de progreso del build -->
          <div class="mt-4">
            <div class="mb-1.5 flex items-baseline justify-between text-[10px] text-white/50">
              <span>Building APK…</span>
              <span class="text-[#febc2e]">01:47:22 transcurrido</span>
            </div>
            <div class="build-bar h-2 w-full rounded-full bg-black/50"></div>
            <div class="mt-1.5 text-[10px] text-white/30">Compiling assembly-csharp.dll — 1.3 GB de salida</div>
          </div>
        </div>
      </div>
    </div>`;
}

/** Slide 3 — diagrama de flujo: URL → Navegador → Experiencia inmersiva. */
function webxrFlowMarkup(): string {
  const steps = [
    { icon: '🔗', label: 'URL / QR', note: 'un enlace' },
    { icon: '🌐', label: 'Navegador', note: 'sin instalar' },
    { icon: '🕶️', label: 'Inmersión', note: 'en 1 segundo' },
  ];
  const arrow = `
    <div class="flex items-center justify-center text-cyan-300/70 sm:rotate-0" aria-hidden="true">
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
            <div class="font-display mt-2 text-sm text-cyan-200">${step.label}</div>
            <div class="mt-0.5 text-xs text-white/45">${step.note}</div>
          </div>`,
          )
          .join('')}
      </div>
      <div class="mt-4 text-center text-xs text-white/40">
        Sin APK. Sin tienda. Sin revisión. El mismo enlace en
        <span class="text-cyan-300">Quest 3</span> y en
        <span class="text-cyan-300">Vision Pro</span>.
      </div>
    </div>`;
}

/** Slide 4 — tres pilares de la creación asistida por IA. */
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
    case 'unity-console':
      return unityConsoleMarkup();
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

  /** Conecta listeners y suscribe el render a las señales. Idempotente por uso. */
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
      <article class="slide-enter w-full max-w-5xl" data-slide="${slide.id}">
        ${slide.kind === 'content' ? this.contentMarkup(slide, rgb) : this.heroMarkup(slide, rgb)}
      </article>`;

    this.footer.innerHTML = `
      <div class="flex items-center gap-2">
        <button class="btn" data-action="prev" ${canGoPrev.value ? '' : 'disabled'} aria-label="Slide anterior">
          <span aria-hidden="true">←</span><span class="hidden sm:inline">Anterior</span>
        </button>
        ${
          index < SLIDE_COUNT - 1
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
            aria-label="Ir a ${s.title}"
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
        ${this.vrButtonMarkup(index, /* hero */ false)}
      </div>`;
  }

  /** Portada y revelación: tipografía grande y centrada. */
  private heroMarkup(slide: Slide, rgb: string): string {
    const isReveal = slide.kind === 'reveal';
    return `
      <div class="stagger flex flex-col items-center text-center">
        <div class="rounded-full border px-4 py-1.5 text-[11px] font-semibold tracking-[0.3em]"
             style="border-color:rgba(${rgb},0.4); color:${slide.accent.hex}; background:rgba(${rgb},0.08)">
          ${isReveal ? 'PLOT TWIST' : 'PRESENTACIÓN INTERACTIVA'}
        </div>

        <h1 class="font-display mt-6 text-3xl leading-tight sm:text-5xl lg:text-6xl"
            style="text-shadow:0 0 48px rgba(${rgb},0.45)">
          ${slide.title}
        </h1>

        ${
          slide.subtitle
            ? `<p class="mt-5 max-w-2xl text-base text-white/55 sm:text-xl">${slide.subtitle}</p>`
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
            : `<div class="mt-10 flex flex-wrap items-center justify-center gap-3">
                 <button class="btn btn-vr" data-action="next">
                   Siguiente <span aria-hidden="true">→</span>
                 </button>
                 ${this.vrButtonMarkup(0, /* hero */ false, /* showFallback */ false)}
               </div>`
        }
      </div>`;
  }

  /** Slides de contenido: título + puntos clave a la izquierda, mockup a la derecha. */
  private contentMarkup(slide: Slide, rgb: string): string {
    const bullets = (slide.bullets ?? [])
      .map(
        (b) => `
        <li class="flex items-start gap-3">
          <span class="mt-0.5 shrink-0 text-lg" aria-hidden="true">${b.icon}</span>
          <span class="text-sm leading-relaxed text-white/70 sm:text-base">${b.text}</span>
        </li>`,
      )
      .join('');

    return `
      <div class="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
        <div class="stagger">
          <h2 class="font-display text-2xl leading-snug sm:text-3xl lg:text-4xl"
              style="text-shadow:0 0 40px rgba(${rgb},0.35)">
            ${slide.title}
          </h2>
          ${slide.subtitle ? `<p class="mt-3 text-sm text-white/45 sm:text-base">${slide.subtitle}</p>` : ''}
          <ul class="mt-6 space-y-3.5">${bullets}</ul>
        </div>
        <div class="stagger">${visualMarkup(slide)}</div>
      </div>`;
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
