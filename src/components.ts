/**
 * Manifiesto de componentes de la aplicación.
 *
 * El runtime y el editor importan este mismo módulo: un componente que no esté
 * aquí no se puede autorar en escenas ni aparece en el inspector.
 */

import { defineComponents } from '@iwsdk/core';
import { FloatingDecor, NavButton } from './presentation/ecs-components.js';

export default defineComponents([NavButton, FloatingDecor]);
