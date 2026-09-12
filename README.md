# WebXR + Agentes de IA

> Destronando la Complejidad del Desarrollo VR Tradicional
> — _una mirada evolutiva de la creación en motores 3D al desarrollo asistido en
> la web inmersiva._

Presentación híbrida **2D / WebXR** de **Anthony Alemán** (VR / MR Expert, 2026).
Se abre como un sitio de diapositivas normal y, en cualquier momento, se
convierte en paneles flotantes dentro de un entorno inmersivo. Construida con
[IWSDK](https://github.com/meta-quest/immersive-web-sdk) (Three.js debajo), Vite
y Tailwind.

Funciona en el navegador de Meta Quest 3, en Apple Vision Pro y, como deck
convencional, en cualquier PC o móvil.

## La idea

El espectador cree estar viendo un PowerPoint web. En la última diapositiva
descubre que lleva todo el rato dentro de una aplicación WebXR: el botón
**PONTELAS** cambia la capa de render, no la página.

Las dos capas comparten un único estado, así que la diapositiva activa nunca se
desincroniza: pasar de slide con el teclado, con el ratón, con el mando de Quest
o volver de VR a 2D deja siempre al espectador en el mismo punto.

## El guion

| #   | Slide                                                        | Qué sostiene                                            |
| --- | ------------------------------------------------------------ | ------------------------------------------------------- |
| 1   | Portada                                                      | Título, ponente y año                                   |
| 2   | El Walkthrough Tradicional: Entorno y Flujo en Unity          | Setup, el dilema del testing loop, el coste en tiempo    |
| 3   | Meta XR SDK, Fortalezas de Unity y Construcción de Mundos     | Building Blocks, Interaction SDK, la artesanía que queda |
| 4   | WebXR: Inmersión Instantánea, Sin Instalación                 | La URL como experiencia; se acaba el APK y el ADB        |
| 5   | Agentes de IA: el World Building deja de ser Artesanal        | Prompt → escena, assets en la nube, NPCs vivos           |
| 6   | Plot twist                                                   | La revelación y el salto a inmersivo                     |

Todo el texto vive en [`src/presentation/slides.ts`](src/presentation/slides.ts).
Es la fuente de verdad única: editar una slide ahí la cambia en las dos capas.

## Imágenes

Las imágenes son **opcionales** y viven en
[`public/images/`](public/images/README.md), que documenta qué archivo va en qué
slide y de dónde sacarlo. Si un archivo no está, la figura desaparece sola en 2D
y el panel no aparece en XR — nunca se ve una imagen rota.

En XR estas imágenes **se despegan del panel** y flotan a los lados del
espectador. Es el argumento de la charla hecho geometría: en 2D sólo pueden
apilarse dentro del rectángulo de la pantalla; en inmersivo, los límites de una
presentación dejan de ser un cuadro 16:9.

## Arranque

```bash
npm install
npm run dev
```

`npm run dev` levanta el servidor gestionado de IWSDK (no uses `vite` a secas).
Para probar en el visor, abre la URL de red que imprime el comando desde el
navegador de Quest — WebXR exige HTTPS, y el servidor ya lo sirve así.

| Comando             | Qué hace                                       |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo + navegador gestionado  |
| `npm run typecheck` | `tsc --noEmit` — hazlo antes de probar nada     |
| `npm run build`     | Compila a `dist/`                              |
| `npm run preview`   | Sirve `dist/` localmente                       |

## Publicar en GitHub Pages

El flujo de trabajo está en
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), pero **no basta
con hacer push**: hay que decirle al repositorio que Pages se sirve desde
Actions.

1. **Settings → Pages → Source**: `GitHub Actions`.
   Si sigue en `Deploy from a branch`, GitHub publica la raíz del repositorio sin
   compilar. El navegador recibe entonces un `index.html` que apunta a
   `/src/index.ts`, no sabe ejecutar TypeScript, y la página no carga.
2. `git push` a `main` o `master`.

`vite.config.ts` usa `base: './'`, así que la build funciona igual en la raíz del
dominio y bajo `usuario.github.io/repositorio/`. El flujo añade `.nojekyll` para
que Pages no filtre la carpeta `assets/`.

## Controles

| Dónde        | Acción                                                                   |
| ------------ | ------------------------------------------------------------------------ |
| Teclado      | `←` `→` · `Espacio` · `Inicio` / `Fin` · `V` para entrar en VR             |
| Ratón/táctil | Botones, puntos de progreso, deslizar horizontalmente                    |
| Mando Quest  | Apuntar y gatillo sobre los botones 3D; `A`/`X` avanza, `B`/`Y` retrocede |

Dentro de VR se puede caminar por la rejilla: el suelo lleva
`LocomotionEnvironment`.

## Arquitectura

```
index.html                      Cáscara del deck 2D + Tailwind (CDN) + tipografías
iwsdk.config.json               Autoridad del proyecto: escena, assets, componentes, XR
public/scenes/main.*.json       Composición de la escena (sólo IDs del manifiesto)
public/images/                  Imágenes opcionales de las slides

src/index.ts                    World.create() + registro explícito de sistemas
src/assets.ts                   defineAssets() — catálogo compartido runtime/editor
src/components.ts               defineComponents() — manifiesto de componentes

src/presentation/
  slides.ts                     CONTENIDO — fuente de verdad única de ambas capas
  state.ts                      Señales compartidas: slide activa, XR, soporte
  Deck2D.ts                     Capa DOM: diapositivas, mockups, navegación
  SlideTexture.ts               Pinta cada slide en un canvas → CanvasTexture
  PanelBuilder.ts               Paneles curvos, botones y satélites de imagen
  EnvironmentBuilder.ts         Rejilla cyber, niebla, partículas, objetos decorativos
  ecs-components.ts             Declaraciones de componentes (sin sistemas ni DOM)

src/scene-assets/*.scene-asset.ts   Prototipos procedurales referenciados por la escena
src/systems/
  PresentationSystem.ts         Puente entre las dos capas; construye los paneles 3D
  EnvironmentSystem.ts          Atmósfera, reloj de shaders y flotación decorativa
```

### Decisiones que conviene conocer antes de tocar el código

- **`slides.ts` es el contenido.** Añadir una diapositiva ahí la hace aparecer en
  las dos capas. Ningún renderer guarda copia del texto.
- **Las texturas se pintan una vez al arrancar.** Cambiar de slide en VR es
  reasignar `material.map`, no repintar un canvas.
- **Las partículas y la rejilla se animan enteras en la GPU.** El `update()` del
  entorno escribe un `float` (`uTime`) por frame; no recorre partículas.
- **Las señales derivadas leen `.value`, nunca `.peek()`.** Un `computed` que
  espía la señal no registra la dependencia y se queda cacheado para siempre —
  así es como el botón "Anterior" nació permanentemente deshabilitado.
- **`src/assets.ts` se evalúa dos veces, en dos realms** (runtime y editor). Por
  eso `EnvironmentBuilder` usa un PRNG sembrado en vez de `Math.random()`: una
  nube de partículas distinta en cada realm rompería bounds y hashes.
- **Los paneles usan `MeshBasicMaterial` y quedan fuera de la niebla.** Son
  pantallas, no objetos iluminados: deben leerse igual desde cualquier ángulo.
- **`xr.offer` está en `"none"` a propósito.** Con `"always"`, el navegador de
  Quest ofrecería la sesión inmersiva por su cuenta y destriparía el final.
- **Three.js se importa siempre desde `@iwsdk/core`**, nunca desde `three`:
  importarlo directo crea una instancia duplicada.

Hay más contexto de proyecto en [`CLAUDE.md`](CLAUDE.md) y en `.claude/rules/`.
