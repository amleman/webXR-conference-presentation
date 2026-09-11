/**
 * Campo de partículas flotantes — prototipo de asset procedural.
 *
 * Todo el movimiento ocurre en el vertex shader a partir de `uTime`, así que
 * este prototipo es estático y determinista: lo que exige el manifiesto.
 */

import type { Object3D } from '@iwsdk/core';
import { createParticleField } from '../presentation/EnvironmentBuilder.js';

const particleField: Object3D = createParticleField(600, 12, 7);

export default particleField;
