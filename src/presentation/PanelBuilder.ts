/**
 * PanelBuilder — geometría de los paneles flotantes y de sus botones.
 *
 * Un panel plano a 2 m se lee bien en el centro y se deforma en los bordes. Una
 * ligera curvatura cilíndrica centrada en el espectador corrige eso: cada punto
 * del panel queda a la misma distancia de los ojos.
 */

import {
  BufferAttribute,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Texture,
} from '@iwsdk/core';
import type { MediaPlacement } from './slides.js';

/** Tamaño del panel principal, en metros. Relación 16:10 como la textura. */
export const PANEL_WIDTH = 2.6;
export const PANEL_HEIGHT = 1.625;

/** Arco total del panel principal. ~20° basta para corregir sin distorsionar. */
export const PANEL_BEND_RADIANS = (20 * Math.PI) / 180;

/**
 * Dobla un plano alrededor de un eje vertical situado detrás de él.
 *
 * Se parte de `PlaneGeometry` en lugar de una sección de cilindro para conservar
 * las UV intactas: la textura de slide se mapea 1:1 sin estiramientos.
 *
 * @param width   Ancho de cuerda del panel, en metros.
 * @param height  Alto del panel, en metros.
 * @param bend    Arco total en radianes. `0` devuelve un plano.
 * @param segments Divisiones horizontales; 24 ya es visualmente continuo.
 */
export function createCurvedPanelGeometry(
  width: number,
  height: number,
  bend: number,
  segments = 24,
): BufferGeometry {
  const geometry = new PlaneGeometry(width, height, segments, 1);

  if (bend > 0.001) {
    const radius = width / bend;
    const position = geometry.attributes.position as BufferAttribute;

    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const angle = x / radius;
      // Los bordes avanzan hacia el espectador (+Z) y el centro se queda en 0.
      position.setX(i, radius * Math.sin(angle));
      position.setZ(i, radius - radius * Math.cos(angle));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Panel principal: superficie curva con la textura de la slide.
 *
 * `MeshBasicMaterial` a propósito — el panel es una pantalla, no un objeto
 * iluminado, y debe leerse con el mismo contraste desde cualquier ángulo. Por lo
 * mismo queda fuera de la niebla.
 */
export function createPanelMesh(texture: Texture): Mesh {
  const geometry = createCurvedPanelGeometry(
    PANEL_WIDTH,
    PANEL_HEIGHT,
    PANEL_BEND_RADIANS,
  );
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: FrontSide,
    fog: false,
    toneMapped: false,
  });

  const mesh = new Mesh(geometry, material);
  mesh.name = 'SlidePanel';
  return mesh;
}

/**
 * Botón de navegación: un rectángulo con la etiqueta ya horneada en la textura.
 *
 * El color del material multiplica la textura, así que el resaltado de hover se
 * consigue subiendo `material.color` sin repintar nada.
 */
export function createButtonMesh(
  texture: Texture,
  width: number,
  height: number,
): Mesh {
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });

  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.name = 'NavButton';
  // Se dibuja después del panel para que el borde luminoso no lo recorte.
  mesh.renderOrder = 2;
  return mesh;
}

/* -------------------------------------------------------------------------- */
/* Paneles satélite de imagen                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Dónde se planta el espectador. Los satélites se orientan hacia aquí en vez de
 * llevar rotaciones escritas a mano, que es lo que haría falta retocar cada vez
 * que se mueve uno de ellos.
 */
const VIEWER = new Vector3(0, 1.6, 0);

/**
 * Posiciones de los satélites alrededor del espectador.
 *
 * Están por delante y a los lados del panel principal, envolviéndolo: es la
 * diferencia visible entre esta capa y el deck 2D, donde las mismas imágenes
 * sólo pueden apilarse dentro del rectángulo de la pantalla.
 */
export const MEDIA_SLOTS: Record<MediaPlacement, Vector3> = {
  left: new Vector3(-2.2, 1.5, -1.1),
  right: new Vector3(2.2, 1.5, -1.1),
  overhead: new Vector3(0, 2.72, -2.05),
};

/** Ancho de un satélite, en metros. */
export const MEDIA_PANEL_WIDTH = 1.2;

/** Alto de la banda de pie de imagen, en metros. */
const MEDIA_CAPTION_HEIGHT = 0.19;

/** Aire entre la imagen y su pie, en metros. */
const MEDIA_CAPTION_GAP = 0.02;

export interface MediaPanel {
  /** Raíz posicionada y orientada hacia el espectador. */
  group: Group;
  /** Material del plano de imagen; su `map` se rellena al cargar la textura. */
  imageMaterial: MeshBasicMaterial;
  /** Materiales que participan en el fundido de materialización. */
  materials: MeshBasicMaterial[];
}

/**
 * Crea un satélite: plano de imagen con su pie debajo, ya orientado hacia el
 * espectador. Nace invisible; el sistema lo muestra cuando la textura carga y
 * la slide es la activa.
 */
export function createMediaPanel(
  captionTexture: Texture,
  placement: MediaPlacement,
  aspect: number,
): MediaPanel {
  const group = new Group();
  group.name = `MediaPanel:${placement}`;
  group.visible = false;

  const imageHeight = MEDIA_PANEL_WIDTH / aspect;

  const imageMaterial = new MeshBasicMaterial({
    transparent: true,
    side: FrontSide,
    fog: false,
    toneMapped: false,
  });
  const image = new Mesh(
    new PlaneGeometry(MEDIA_PANEL_WIDTH, imageHeight),
    imageMaterial,
  );
  image.position.y = (MEDIA_CAPTION_HEIGHT + MEDIA_CAPTION_GAP) / 2;
  group.add(image);

  const captionMaterial = new MeshBasicMaterial({
    map: captionTexture,
    transparent: true,
    side: FrontSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const caption = new Mesh(
    new PlaneGeometry(MEDIA_PANEL_WIDTH, MEDIA_CAPTION_HEIGHT),
    captionMaterial,
  );
  caption.position.y = -(imageHeight + MEDIA_CAPTION_GAP) / 2;
  caption.renderOrder = 2;
  group.add(caption);

  group.position.copy(MEDIA_SLOTS[placement]);
  group.lookAt(VIEWER);

  return { group, imageMaterial, materials: [imageMaterial, captionMaterial] };
}

/**
 * Carga una imagen de slide.
 *
 * Las imágenes son opcionales: viven en `public/images/` y puede que el archivo
 * todavía no esté ahí. Por eso se resuelve a `null` en vez de propagar el error,
 * y el satélite simplemente no aparece. Se usa `TextureLoader` directamente —y
 * no el manifiesto— precisamente porque estas cargas deben poder fallar sin
 * tumbar el arranque del mundo.
 */
export function loadOptionalTexture(url: string): Promise<Texture | null> {
  return new Promise((resolve) => {
    new TextureLoader().load(
      url,
      (texture) => resolve(texture),
      undefined,
      () => resolve(null),
    );
  });
}
