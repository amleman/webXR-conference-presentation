/**
 * EnvironmentSystem — mantiene vivo el entorno que rodea a los paneles.
 *
 * Hace tres cosas y sólo tres: fija la atmósfera al arrancar, avanza el reloj
 * que alimenta los shaders del suelo y de las partículas, y hace flotar los dos
 * objetos decorativos.
 *
 * Todo el movimiento de las 600 partículas ocurre en la GPU. Este `update()` no
 * recorre partículas ni asigna memoria: escribe un `float` y toca dos objetos.
 */

import { createSystem, VisibilityState } from '@iwsdk/core';
import {
  applyAtmosphere,
  environmentUniforms,
} from '../presentation/EnvironmentBuilder.js';
import { FloatingDecor } from '../presentation/ecs-components.js';

export class EnvironmentSystem extends createSystem({
  decor: { required: [FloatingDecor] },
}) {
  init(): void {
    applyAtmosphere(this.scene);
  }

  update(delta: number, time: number): void {
    // Con la sesión desenfocada el compositor ya no presenta: no gastes GPU.
    if (this.visibilityState.peek() === VisibilityState.VisibleBlurred) {
      return;
    }

    environmentUniforms.uTime.value = time;

    for (const entity of this.queries.decor.entities) {
      const object = entity.object3D;
      if (object == null) {
        continue;
      }

      // La altura base se captura la primera vez, ya con la transformación de
      // la escena aplicada: así el balanceo oscila donde el compositor lo puso.
      let baseY = entity.getValue(FloatingDecor, 'baseY') ?? Number.NaN;
      if (Number.isNaN(baseY)) {
        baseY = object.position.y;
        entity.setValue(FloatingDecor, 'baseY', baseY);
      }

      const spinSpeed = entity.getValue(FloatingDecor, 'spinSpeed') ?? 0;
      const bobAmplitude = entity.getValue(FloatingDecor, 'bobAmplitude') ?? 0;
      const bobSpeed = entity.getValue(FloatingDecor, 'bobSpeed') ?? 0;
      const tiltSpeed = entity.getValue(FloatingDecor, 'tiltSpeed') ?? 0;

      object.rotation.y += spinSpeed * delta;
      object.rotation.z = Math.sin(time * tiltSpeed) * 0.14;
      object.position.y = baseY + Math.sin(time * bobSpeed) * bobAmplitude;
    }
  }
}
