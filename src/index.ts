/**
 * Punto de entrada.
 *
 * `virtual:iwsdk-project` es un módulo virtual generado a partir de
 * `iwsdk.config.json`: trae la escena activa, el manifiesto de assets, el de
 * componentes y toda la configuración de XR. Se pasa entero a `World.create()`;
 * nunca se construye ese objeto a mano.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { EnvironmentSystem } from './systems/EnvironmentSystem.js';
import { PresentationSystem } from './systems/PresentationSystem.js';

World.create(
  document.getElementById('scene-container') as HTMLDivElement,
  projectOptions,
).then((world) => {
  world.registerSystem(EnvironmentSystem);
  world.registerSystem(PresentationSystem);
});
