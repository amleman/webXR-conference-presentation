# Imágenes de la presentación

Las imágenes son **opcionales**: si un archivo no está aquí, la figura se retira
sola en 2D y el panel satélite no aparece en XR. Nunca se ve una imagen rota.

Los nombres y las proporciones los declara `src/presentation/slides.ts` (campo
`media`), que es donde hay que tocar para añadir, quitar o recolocar alguna.

## Las que hay ahora

| Archivo                        | Slide | En XR (`placement`) | En 2D (`screen`) | Fuente |
| ------------------------------ | ----- | ------------------- | ---------------- | ------ |
| `meta-quest-3s.webp`           | 1     | derecha             | fondo, esquina   | prensa de Meta |
| `meta-xr-all-in-one-sdk.jpg`   | 2     | izquierda           | oculta           | assetstore.unity.com |
| `Unity-Meta-parntership.webp`  | 2     | derecha             | oculta           | uploadvr.com |
| `buildingblocks.png`           | 3     | izquierda           | en línea         | medium.com/antaeus-ar |
| `meta-xr-interaction-sdk.jpg`  | 3     | derecha             | en línea         | assetstore.unity.com |
| `meta-xr-core-sdk.jpg`         | 3     | **cenital**         | en línea         | assetstore.unity.com |

Las tres posiciones de `placement` (`left`, `right`, `overhead`) existen para que
en XR las imágenes rodeen al espectador en vez de apilarse dentro del panel.

`screen` es independiente y gobierna sólo la capa 2D: `inline` la pone en la tira
dentro del contenido, `corner` la usa como decorado de fondo en la esquina
inferior izquierda, y `none` la omite. Una imagen puede no aparecer en 2D y
seguir flotando en XR — que es el caso de las dos de la slide 2.

Una imagen marcada como `corner` debería tener **fondo negro puro**: la capa 2D la
compone con `mix-blend-mode: screen`, que vuelve el negro transparente y funde el
objeto con el fondo del deck sin recortes ni máscaras.

## Para añadir o cambiar una

1. Deja el archivo en esta carpeta.
2. Añade o edita su entrada en el array `media` de la slide, en
   `src/presentation/slides.ts`.
3. Pon el `aspect` real (ancho ÷ alto). Si no coincide, el satélite deforma la
   imagen — es el único campo que hay que medir.

Recomendaciones: de 1024 a 1600 px de ancho basta (el satélite mide 1,2 m y se
ve a unos 2,5 m); `.jpg`, `.png` y `.webp` funcionan en las dos capas.

## Derechos

Las capturas de documentación y de la Asset Store son material de terceros. El
campo `source` de cada entrada se imprime bajo la imagen en ambas capas, así que
la atribución sale sola. Aun así, revisa las condiciones de uso si la charla se
difunde públicamente.
