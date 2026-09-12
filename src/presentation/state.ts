/**
 * Estado compartido de la presentación.
 *
 * Es el único punto donde vive "en qué slide estamos". El deck 2D y el sistema
 * ECS que construye los paneles 3D se suscriben aquí; ninguno de los dos escribe
 * en el otro. Por eso pasar de slide con el teclado, con un clic del ratón o con
 * el gatillo de un mando de Quest produce exactamente el mismo efecto en ambas
 * capas.
 *
 * Deliberadamente libre de dependencias de `World`, DOM y Three: sólo señales.
 */

import { computed, signal } from '@iwsdk/core';
import { SLIDE_COUNT } from './slides.js';

/** Índice de la slide activa, en `[0, SLIDE_COUNT - 1]`. */
export const slideIndex = signal(0);

/** `true` mientras una sesión XR inmersiva está presentando. */
export const isImmersive = signal(false);

/** `true` si el navegador anunció soporte para `immersive-vr`. */
export const xrSupported = signal(false);

/** Dirección del último cambio: `1` hacia delante, `-1` hacia atrás. */
export const lastDirection = signal<1 | -1>(1);

// Ambas leen `.value`, no `.peek()`: un `computed` que espía la señal en vez de
// leerla no registra la dependencia, se evalúa una sola vez y se queda cacheado
// para siempre — que es exactamente cómo el botón "Anterior" nació deshabilitado.
export const canGoPrev = computed(() => slideIndex.value > 0);
export const canGoNext = computed(() => slideIndex.value < SLIDE_COUNT - 1);

/** Salta a una slide concreta. Índices fuera de rango se ignoran en silencio. */
export function goTo(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= SLIDE_COUNT) {
    return;
  }
  const current = slideIndex.peek();
  if (index === current) {
    return;
  }
  lastDirection.value = index > current ? 1 : -1;
  slideIndex.value = index;
}

/** Avanza una slide. Se detiene en la última (no hay wrap-around). */
export function next(): void {
  goTo(slideIndex.peek() + 1);
}

/** Retrocede una slide. Se detiene en la primera. */
export function prev(): void {
  goTo(slideIndex.peek() - 1);
}

/**
 * Consulta al navegador si puede abrir una sesión `immersive-vr` y publica el
 * resultado en {@link xrSupported}. Se llama una vez al arrancar.
 */
export async function detectXRSupport(): Promise<boolean> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (xr?.isSessionSupported == null) {
    xrSupported.value = false;
    return false;
  }
  try {
    const supported = await xr.isSessionSupported('immersive-vr');
    xrSupported.value = supported;
    return supported;
  } catch {
    // Algunos navegadores lanzan en contextos no seguros en lugar de responder.
    xrSupported.value = false;
    return false;
  }
}
