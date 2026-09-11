/**
 * Declaraciones de componentes de la presentación.
 *
 * Módulo deliberadamente libre de sistemas, DOM y renderer: el editor lo importa
 * para construir su inspector, y los sistemas lo importan a él (nunca al revés).
 * Todo lo que se declare aquí debe aparecer en `src/components.ts`.
 */

import { createComponent, Types } from '@iwsdk/core';

/** Acciones que puede disparar un botón 3D. Coincide con `NavAction`. */
export const NAV_ACTIONS = ['prev', 'next', 'exit'] as const;
export type NavAction = (typeof NAV_ACTIONS)[number];

/**
 * Botón de navegación de los paneles 3D.
 *
 * Se combina con `RayInteractable`; el sistema de presentación reacciona a la
 * aparición de `Pressed` y lee este campo para saber qué hacer.
 */
export const NavButton = createComponent('NavButton', {
  action: {
    type: Types.String,
    default: 'next',
    label: 'Acción',
    help: "Una de: 'prev', 'next', 'exit'.",
  },
});

/**
 * Objeto decorativo que flota y gira: los dos tótems que representan el pasado
 * y el futuro de la tecnología.
 *
 * `baseY` la escribe el sistema en cuanto la entidad califica, tomándola de la
 * posición autorada en la escena; así el balanceo oscila alrededor de donde el
 * compositor puso el objeto, no alrededor de cero.
 */
export const FloatingDecor = createComponent('FloatingDecor', {
  spinSpeed: {
    type: Types.Float32,
    default: 0.25,
    label: 'Giro (rad/s)',
    step: 0.05,
    min: -3,
    max: 3,
  },
  bobAmplitude: {
    type: Types.Float32,
    default: 0.08,
    label: 'Amplitud de flotación (m)',
    step: 0.01,
    min: 0,
    max: 0.5,
  },
  bobSpeed: {
    type: Types.Float32,
    default: 0.7,
    label: 'Velocidad de flotación',
    step: 0.05,
    min: 0,
    max: 4,
  },
  tiltSpeed: {
    type: Types.Float32,
    default: 0.12,
    label: 'Cabeceo (rad/s)',
    step: 0.02,
    min: -2,
    max: 2,
  },
  baseY: {
    type: Types.Float32,
    default: Number.NaN,
    label: 'Altura base (m)',
    help: 'Se captura automáticamente de la escena en el primer frame.',
  },
});
