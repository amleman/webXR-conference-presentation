/**
 * Suelo de rejilla cyber — prototipo de asset procedural.
 *
 * La escena lo coloca en el origen y le añade `LocomotionEnvironment`, que es lo
 * que convierte esta superficie en suelo caminable. Sin ese componente el
 * jugador atraviesa el mundo sin ningún aviso.
 */

import type { Object3D } from '@iwsdk/core';
import { createCyberGridFloor } from '../presentation/EnvironmentBuilder.js';

const cyberFloor: Object3D = createCyberGridFloor(70);

export default cyberFloor;
