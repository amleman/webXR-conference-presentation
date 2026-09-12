/**
 * PresentationSystem — el puente entre las dos capas.
 *
 * Construye el equipo de paneles 3D, monta el deck 2D y conecta ambos al mismo
 * estado. Ninguna de las dos capas conoce a la otra: las dos leen `slideIndex` y
 * las dos llaman a `next()` / `prev()`. Por eso pasar de diapositiva con el
 * teclado, con un clic o con el gatillo del mando produce el mismo resultado, y
 * quitarse las gafas devuelve al espectador exactamente a la slide en la que
 * estaba.
 */

import {
  createSystem,
  Group,
  Hovered,
  InputComponent,
  MeshBasicMaterial,
  Pressed,
  RayInteractable,
  SRGBColorSpace,
  VisibilityState,
  type Entity,
  type Mesh,
} from '@iwsdk/core';
import { Deck2D } from '../presentation/Deck2D.js';
import { PALETTE } from '../presentation/EnvironmentBuilder.js';
import {
  NavButton,
  type NavAction,
} from '../presentation/ecs-components.js';
import {
  createButtonMesh,
  createMediaPanel,
  createPanelMesh,
  loadOptionalTexture,
  type MediaPanel,
} from '../presentation/PanelBuilder.js';
import { mediaUrl, SLIDES, SLIDE_COUNT } from '../presentation/slides.js';
import {
  createButtonTexture,
  createMediaFrameTexture,
  createSlideTexture,
  type SlideTextureHandle,
} from '../presentation/SlideTexture.js';
import {
  detectXRSupport,
  isImmersive,
  next,
  prev,
  slideIndex,
} from '../presentation/state.js';

/** Colocación pedida: 1,5 m de altura, 2 m al frente del espectador. */
const PANEL_Y = 1.5;
const PANEL_Z = -2;

/** Fila de botones, por debajo del panel e inclinada hacia la mirada. */
const NAV_Y = 0.56;
const NAV_Z = -1.9;
const NAV_TILT = -0.32;
const NAV_BUTTON_WIDTH = 0.52;
const NAV_BUTTON_HEIGHT = 0.16;

/** Duración de la materialización de los paneles al entrar en VR, en segundos. */
const REVEAL_DURATION = 0.7;

interface NavButtonSpec {
  action: NavAction;
  label: string;
  accent: string;
  x: number;
}

const NAV_BUTTONS: readonly NavButtonSpec[] = [
  { action: 'prev', label: '‹  ANTERIOR', accent: PALETTE.cyan, x: -0.8 },
  { action: 'next', label: 'SIGUIENTE  ›', accent: PALETTE.cyan, x: 0 },
  { action: 'exit', label: 'SALIR', accent: PALETTE.magenta, x: 0.8 },
];

export class PresentationSystem extends createSystem({
  navPressed: { required: [NavButton, Pressed] },
  navHovered: { required: [NavButton, Hovered] },
}) {
  private deck!: Deck2D;
  private rig!: Group;
  private panelMaterial!: MeshBasicMaterial;
  private slideTextures: SlideTextureHandle[] = [];
  /** Materiales cuya opacidad participa en la animación de materialización. */
  private fadeMaterials: MeshBasicMaterial[] = [];
  /** Satélites de imagen, con la slide a la que pertenecen. */
  private mediaPanels: Array<{
    slide: number;
    panel: MediaPanel;
    /** `false` mientras la imagen no haya cargado, o si el archivo no existe. */
    ready: boolean;
  }> = [];
  /** Progreso 0→1 de la aparición de los paneles al entrar en XR. */
  private reveal = 0;

  init(): void {
    // El resultado se publica en la señal `xrSupported`; no bloquea el arranque.
    void detectXRSupport();

    this.buildPanelRig();
    this.mountDeck();
    this.bindSlideSync();
    this.bindVisibility();
    this.bindNavButtons();
    this.repaintWhenFontsLoad();
  }

  update(delta: number): void {
    if (this.visibilityState.peek() === VisibilityState.VisibleBlurred) {
      return;
    }

    this.stepReveal(delta);
    this.pollControllerButtons();
  }

  /* ---------------------------------------------------------------------- */
  /* Construcción                                                            */
  /* ---------------------------------------------------------------------- */

  /** Panel curvo + fila de botones, todo colgando de una única entidad raíz. */
  private buildPanelRig(): void {
    this.slideTextures = SLIDES.map((slide, index) =>
      createSlideTexture(slide, index, SLIDE_COUNT),
    );

    this.rig = new Group();
    this.rig.name = 'PresentationRig';
    const rigEntity = this.world.createTransformEntity(this.rig);

    const panel = createPanelMesh(this.slideTextures[0].texture);
    panel.position.set(0, PANEL_Y, PANEL_Z);
    this.panelMaterial = panel.material as MeshBasicMaterial;
    this.fadeMaterials.push(this.panelMaterial);
    this.rig.add(panel);

    for (const spec of NAV_BUTTONS) {
      this.createNavButton(spec, rigEntity);
    }

    this.buildMediaPanels();

    this.cleanupFuncs.push(() => {
      rigEntity.dispose();
      for (const handle of this.slideTextures) {
        handle.texture.dispose();
      }
      this.slideTextures.length = 0;
    });
  }

  /** Un botón = una entidad con `RayInteractable`, para que el puntero lo vea. */
  private createNavButton(spec: NavButtonSpec, parent: Entity): void {
    const texture = createButtonTexture(spec.label, spec.accent);
    const mesh: Mesh = createButtonMesh(
      texture,
      NAV_BUTTON_WIDTH,
      NAV_BUTTON_HEIGHT,
    );
    mesh.position.set(spec.x, NAV_Y, NAV_Z);
    mesh.rotation.x = NAV_TILT;

    const material = mesh.material as MeshBasicMaterial;
    this.fadeMaterials.push(material);

    this.world
      .createTransformEntity(mesh, { parent })
      .addComponent(RayInteractable)
      .addComponent(NavButton, { action: spec.action });

    this.cleanupFuncs.push(() => texture.dispose());
  }

  /**
   * Satélites de imagen: las figuras que en el deck 2D tienen que apilarse
   * dentro del rectángulo de la pantalla aquí se despegan y flotan alrededor del
   * espectador. Es el argumento de la charla hecho geometría.
   *
   * Se construyen todos por adelantado y se ocultan; mostrar una slide es
   * conmutar `visible`, no crear objetos.
   */
  private buildMediaPanels(): void {
    SLIDES.forEach((slide, index) => {
      for (const media of slide.media ?? []) {
        const captionTexture = createMediaFrameTexture(
          media.caption,
          media.source,
          slide.accent.hex,
        );
        const panel = createMediaPanel(
          captionTexture,
          media.placement,
          media.aspect ?? 1.6,
        );
        this.rig.add(panel.group);
        this.fadeMaterials.push(...panel.materials);

        const record = { slide: index, panel, ready: false };
        this.mediaPanels.push(record);

        void loadOptionalTexture(mediaUrl(media.src)).then((texture) => {
          // `null` significa que el archivo no está en `public/images/`. El
          // satélite se queda oculto y nadie ve una textura rota.
          if (texture == null) {
            return;
          }
          texture.colorSpace = SRGBColorSpace;
          panel.imageMaterial.map = texture;
          panel.imageMaterial.needsUpdate = true;
          record.ready = true;
          this.syncMediaVisibility();
        });

        this.cleanupFuncs.push(() => {
          captionTexture.dispose();
          panel.imageMaterial.map?.dispose();
        });
      }
    });
  }

  /** Deja visibles sólo los satélites cargados de la slide activa. */
  private syncMediaVisibility(): void {
    const active = slideIndex.peek();
    for (const record of this.mediaPanels) {
      record.panel.group.visible = record.ready && record.slide === active;
    }
  }

  private mountDeck(): void {
    this.deck = new Deck2D({
      // `launchXR` exige un gesto del usuario: el clic del botón lo es.
      enterVR: () => this.world.launchXR(),
      exitVR: () => this.world.exitXR(),
    });
    this.deck.mount();
    this.cleanupFuncs.push(() => this.deck.dispose());
  }

  /* ---------------------------------------------------------------------- */
  /* Sincronización                                                          */
  /* ---------------------------------------------------------------------- */

  /**
   * Cambiar de slide en 3D es sustituir un puntero de textura. Las cinco están
   * pintadas desde el arranque, así que no hay ni repintado ni subida a GPU en
   * el momento del cambio.
   */
  private bindSlideSync(): void {
    this.cleanupFuncs.push(
      slideIndex.subscribe((index) => {
        const handle = this.slideTextures[index];
        if (handle == null || this.panelMaterial == null) {
          return;
        }
        this.panelMaterial.map = handle.texture;
        this.panelMaterial.needsUpdate = true;
        this.syncMediaVisibility();
      }),
    );
  }

  /**
   * Publica el estado inmersivo. Deck2D se oculta solo al verlo, y `reveal`
   * vuelve a cero para que los paneles se materialicen en cada entrada.
   */
  private bindVisibility(): void {
    this.cleanupFuncs.push(
      this.visibilityState.subscribe((state) => {
        const immersive = state !== VisibilityState.NonImmersive;
        if (immersive && !isImmersive.peek()) {
          this.reveal = 0;
        }
        isImmersive.value = immersive;
      }),
    );
  }

  /** Pulsación y resalte de los botones 3D, ambos por suscripción a la query. */
  private bindNavButtons(): void {
    this.queries.navPressed.subscribe('qualify', (entity) => {
      switch (entity.getValue(NavButton, 'action') as NavAction | null) {
        case 'prev':
          prev();
          break;
        case 'next':
          next();
          break;
        case 'exit':
          this.world.exitXR();
          break;
        default:
          break;
      }
    });

    // El color multiplica la textura: resaltar no cuesta ni un repintado.
    this.queries.navHovered.subscribe('qualify', (entity) => {
      PresentationSystem.tintButton(entity, 1.6);
    });
    this.queries.navHovered.subscribe('disqualify', (entity) => {
      PresentationSystem.tintButton(entity, 1);
    });
  }

  private static tintButton(entity: Entity, brightness: number): void {
    const mesh = entity.object3D as Mesh | undefined;
    const material = mesh?.material as MeshBasicMaterial | undefined;
    material?.color.setScalar(brightness);
  }

  /**
   * Orbitron e Inter llegan por CDN después del primer pintado. Se repintan las
   * texturas una sola vez cuando el navegador confirma que ya están, para no
   * dejar la tipografía de respaldo horneada en el panel.
   */
  private repaintWhenFontsLoad(): void {
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (cancelled) {
        return;
      }
      for (const handle of this.slideTextures) {
        handle.repaint();
      }
    });
    this.cleanupFuncs.push(() => {
      cancelled = true;
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                   */
  /* ---------------------------------------------------------------------- */

  /**
   * Materialización de los paneles al entrar en VR: escala y opacidad suben
   * juntas durante {@link REVEAL_DURATION}. Sale por la primera rama en cuanto
   * termina, así que no cuesta nada el resto de la sesión.
   */
  private stepReveal(delta: number): void {
    if (!isImmersive.peek() || this.reveal >= 1) {
      return;
    }

    this.reveal = Math.min(1, this.reveal + delta / REVEAL_DURATION);
    // Suavizado cúbico de salida: rápido al principio, se posa al final.
    const eased = 1 - Math.pow(1 - this.reveal, 3);

    this.rig.scale.setScalar(0.88 + 0.12 * eased);
    for (const material of this.fadeMaterials) {
      material.opacity = eased;
    }
  }

  /**
   * Navegación sin apuntar: A/X avanzan, B/Y retroceden.
   *
   * Se usan botones de cara y no el joystick a propósito — los thumbsticks ya
   * pertenecen a la locomoción, y un presentador que camina no debería cambiar
   * de diapositiva sin querer.
   */
  private pollControllerButtons(): void {
    if (!isImmersive.peek()) {
      return;
    }

    const right = this.input.xr.gamepads.right;
    const left = this.input.xr.gamepads.left;

    if (
      right?.getButtonDown(InputComponent.A_Button) === true ||
      left?.getButtonDown(InputComponent.X_Button) === true
    ) {
      next();
      return;
    }

    if (
      right?.getButtonDown(InputComponent.B_Button) === true ||
      left?.getButtonDown(InputComponent.Y_Button) === true
    ) {
      prev();
    }
  }
}
