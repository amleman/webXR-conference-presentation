/**
 * Monolito heredado — el tótem del "pasado" a la izquierda del panel.
 *
 * Losas apiladas, opacas y metálicas con aristas ámbar: la silueta del APK
 * monolítico que había que compilar, firmar y subir a una tienda.
 */

import type { Object3D } from '@iwsdk/core';
import { createLegacyMonolith } from '../presentation/EnvironmentBuilder.js';

const legacyMonolith: Object3D = createLegacyMonolith();

export default legacyMonolith;
