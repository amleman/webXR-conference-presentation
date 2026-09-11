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
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  type BufferGeometry,
  type Texture,
} from '@iwsdk/core';

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
