# Imágenes de la presentación

Las imágenes son **opcionales**: si un archivo no está aquí, la figura se retira
sola en 2D y el panel satélite no aparece en XR. Nunca se ve una imagen rota.

Los nombres y las proporciones los declara `src/presentation/slides.ts` (campo
`media`), que es donde hay que tocar para añadir, quitar o recolocar alguna.

## Las que hay ahora

| Archivo                        | Slide | Dónde flota en XR | Fuente |
| ------------------------------ | ----- | ----------------- | ------ |
| `meta-quest-3s.webp`           | 1     | derecha           | prensa de Meta |
| `meta-xr-all-in-one-sdk.jpg`   | 2     | izquierda         | assetstore.unity.com |
| `Unity-Meta-parntership.webp`  | 2     | derecha           | uploadvr.com |
| `buildingblocks.png`           | 3     | izquierda         | medium.com/antaeus-ar |
| `meta-xr-interaction-sdk.jpg`  | 3     | derecha           | assetstore.unity.com |
| `meta-xr-core-sdk.jpg`         | 3     | **cenital**       | assetstore.unity.com |

Las tres posiciones (`left`, `right`, `overhead`) existen para que en XR las
imágenes rodeen al espectador en vez de apilarse dentro del panel.

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
