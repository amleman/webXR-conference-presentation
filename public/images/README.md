# Imágenes de la presentación

Las imágenes son **opcionales**: si un archivo no está aquí, la figura se retira
sola en 2D y el panel satélite no aparece en XR. Nunca se ve una imagen rota.

Guarda cada archivo con **exactamente** el nombre de la primera columna. Los
nombres los declara `src/presentation/slides.ts` (campo `media`), que es donde
hay que tocar si quieres añadir, quitar o recolocar alguna.

| Archivo                        | Slide | Dónde flota en XR | Qué debería mostrar                          | Fuente sugerida |
| ------------------------------ | ----- | ----------------- | -------------------------------------------- | --------------- |
| `quest-3s.jpg`                 | 1     | derecha           | Meta Quest 3S, el visor blanco               | foto propia o prensa de Meta |
| `meta-unity-sdk.jpg`           | 2     | izquierda         | Meta XR SDK para Unity                       | <https://developers.meta.com/horizon/discover/programs/unity-sdk/> |
| `meta-unity-partnership.jpg`   | 2     | derecha           | Alianza multianual Meta + Unity              | <https://www.uploadvr.com/meta-extends-multi-year-partnership-with-unity/> |
| `building-blocks.jpg`          | 3     | izquierda         | Building Blocks del Meta XR SDK              | <https://medium.com/antaeus-ar/exploring-metas-building-blocks-d99fdd1b3ec3> |
| `interaction-sdk.jpg`          | 3     | derecha           | Meta XR Interaction SDK Essentials           | <https://assetstore.unity.com/publishers/25353> |

## Recomendaciones

- **Proporción ~16:10** (el valor por defecto de `aspect` es `1.6`). Si usas otra,
  ajústala en el campo `aspect` de esa entrada en `slides.ts`.
- **Ancho de 1024 a 1600 px** basta: el satélite mide 1,2 m y se ve a unos 2 m.
  Más resolución sólo engorda el repositorio.
- **JPG para fotos, PNG para capturas de interfaz** con texto fino.
- Si cambias la extensión, cambia también el `src` en `slides.ts`.

## Derechos

Las capturas de documentación y los artículos enlazados son material de terceros.
Cada entrada de `slides.ts` lleva un campo `source` que se imprime bajo la imagen
en las dos capas, así que la atribución sale sola. Aun así, comprueba las
condiciones de uso antes de publicar el repositorio si la charla se difunde.
