/**
 * Singularidad — el tótem del "futuro" a la derecha del panel.
 *
 * Malla de alambre, núcleo incandescente y anillo orbital. Hueca y aditiva:
 * exactamente lo contrario del monolito que tiene enfrente.
 */

import type { Object3D } from '@iwsdk/core';
import { createSingularity } from '../presentation/EnvironmentBuilder.js';

const singularity: Object3D = createSingularity();

export default singularity;
