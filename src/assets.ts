/**
 * Catálogo de assets compartido por el runtime y el editor.
 *
 * ATENCIÓN: este módulo se evalúa dos veces, en dos realms de JavaScript
 * distintos. Debe ser determinista y sin efectos secundarios — nada de `World`,
 * DOM, temporizadores ni dependencias de identidad de objetos entre realms.
 *
 * Todos los prototipos de esta presentación son procedurales y viven en
 * `src/scene-assets/`. No hay descargas de modelos: la escena entera pesa lo que
 * pesa el bundle, que es parte del argumento de la charla.
 */

import { defineAssets } from '@iwsdk/core';
import cyberFloor from './scene-assets/cyber-floor.scene-asset.js';
import legacyMonolith from './scene-assets/legacy-monolith.scene-asset.js';
import particleField from './scene-assets/particle-field.scene-asset.js';
import singularity from './scene-assets/singularity.scene-asset.js';

export default defineAssets({
  'cyber-floor': cyberFloor,
  'particle-field': particleField,
  'legacy-monolith': legacyMonolith,
  singularity: singularity,
});
