/**
 * EnvironmentBuilder — el mundo que rodea a los paneles.
 *
 * Fabrica geometría pura de Three: suelo con rejilla cyber, campo de partículas,
 * y los dos objetos decorativos que flanquean la presentación. No toca `World`,
 * ni el DOM, ni temporizadores, porque `src/assets.ts` lo importa y ese módulo se
 * evalúa dos veces, en dos realms distintos (runtime y editor).
 *
 * Toda la animación vive en shaders alimentados por {@link environmentUniforms}.
 * El sistema de entorno sólo escribe `uTime` una vez por frame: cero trabajo de
 * CPU por partícula, que es lo que permite sostener los 72–90 fps de Quest.
 */

import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Fog,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  Sphere,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from '@iwsdk/core';

/* -------------------------------------------------------------------------- */
/* Paleta y uniformes compartidos                                              */
/* -------------------------------------------------------------------------- */

export const PALETTE = {
  void: '#04070f',
  floor: '#061019',
  cyan: '#22d3ee',
  violet: '#a78bfa',
  magenta: '#e879f9',
  amber: '#fbbf24',
} as const;

/**
 * Reloj compartido por todos los materiales animados del entorno.
 *
 * Es un objeto literal sin identidad cruzada entre realms: en el runtime, el
 * sistema de entorno y los materiales comparten esta misma instancia; en el
 * editor simplemente se queda en 0 y la vista previa es estática.
 */
export const environmentUniforms = {
  uTime: { value: 0 },
};

/** Radios de desvanecimiento de la rejilla, en metros. */
const GRID_FADE_START = 7;
const GRID_FADE_END = 27;

/**
 * PRNG sembrado (mulberry32).
 *
 * `Math.random()` está prohibido aquí: el manifiesto de assets se evalúa en el
 * runtime y en el editor por separado, y una nube de partículas distinta en cada
 * realm rompería bounds y hashes. Con semilla fija, ambos realms producen el
 * mismo campo.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/* Suelo: rejilla cyber                                                        */
/* -------------------------------------------------------------------------- */

const GRID_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const GRID_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform vec3 uLineColor;
  uniform vec3 uFogColor;
  uniform float uTime;
  uniform float uFadeStart;
  uniform float uFadeEnd;

  varying vec3 vWorldPos;

  // Línea de rejilla con grosor constante en pantalla: la derivada compensa
  // la perspectiva, así que no se agranda cerca ni parpadea lejos.
  float gridLine(vec2 p, float size, float width) {
    vec2 coord = p / size;
    vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
    return 1.0 - smoothstep(0.0, width, min(grid.x, grid.y));
  }

  void main() {
    vec2 p = vWorldPos.xz;
    float dist = length(p);

    float minor = gridLine(p, 0.5, 1.0);
    float major = gridLine(p, 2.5, 1.5);
    float lines = clamp(minor * 0.32 + major * 0.95, 0.0, 1.0);

    // Onda concéntrica lenta que recorre la rejilla hacia fuera.
    float pulse = 0.55 + 0.45 * sin(dist * 0.55 - uTime * 1.1);

    float fade = 1.0 - smoothstep(uFadeStart, uFadeEnd, dist);
    vec3 color = mix(uBaseColor, uLineColor, lines * pulse * fade);
    color = mix(uFogColor, color, fade);

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Suelo infinito aparente: un plano grande cuya rejilla se apaga con la
 * distancia hasta fundirse con el color de niebla.
 *
 * Es también la superficie caminable: la escena le cuelga `LocomotionEnvironment`,
 * sin la cual el jugador atravesaría el mundo.
 */
export function createCyberGridFloor(size = 70): Mesh {
  const geometry = new PlaneGeometry(size, size, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new ShaderMaterial({
    uniforms: {
      uTime: environmentUniforms.uTime,
      uBaseColor: { value: new Color(PALETTE.floor) },
      uLineColor: { value: new Color(PALETTE.cyan) },
      uFogColor: { value: new Color(PALETTE.void) },
      uFadeStart: { value: GRID_FADE_START },
      uFadeEnd: { value: GRID_FADE_END },
    },
    vertexShader: GRID_VERTEX_SHADER,
    fragmentShader: GRID_FRAGMENT_SHADER,
    side: DoubleSide,
    fog: false,
  });

  const floor = new Mesh(geometry, material);
  floor.name = 'CyberGridFloor';
  floor.receiveShadow = false;
  return floor;
}

/* -------------------------------------------------------------------------- */
/* Partículas flotantes                                                        */
/* -------------------------------------------------------------------------- */

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uHeight;

  attribute float aSeed;
  attribute float aScale;

  varying float vAlpha;

  void main() {
    vec3 p = position;

    // Ascenso lento con reinicio por módulo: la columna nunca se vacía y no
    // hace falta reescribir el buffer desde la CPU.
    p.y = mod(p.y + uTime * (0.035 + aSeed * 0.055), uHeight);

    // Deriva lateral desfasada por semilla, para que no vayan en bloque.
    float phase = aSeed * 6.2831853;
    p.x += sin(uTime * 0.22 + phase) * 0.28;
    p.z += cos(uTime * 0.18 + phase) * 0.28;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = uSize * aScale / max(-mvPosition.z, 0.1);

    // Nace y muere con desvanecido, para que el reinicio no se vea.
    float t = p.y / uHeight;
    vAlpha = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.7, 1.0, t));
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float alpha = (1.0 - smoothstep(0.1, 0.5, d)) * vAlpha;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(uColor, alpha);
    #include <colorspace_fragment>
  }
`;

/**
 * Campo de motas luminosas dentro de un cilindro alrededor del espectador.
 *
 * Los puntos se distribuyen con radio proporcional a `sqrt(random)` para que la
 * densidad sea uniforme por área en lugar de acumularse en el centro.
 */
export function createParticleField(
  count = 600,
  radius = 12,
  height = 7,
): Points {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const random = seededRandom(0x5eed1);

  for (let i = 0; i < count; i += 1) {
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(random()) * radius;
    positions[i * 3 + 0] = Math.cos(angle) * r;
    positions[i * 3 + 1] = random() * height;
    positions[i * 3 + 2] = Math.sin(angle) * r;
    seeds[i] = random();
    scales[i] = 0.5 + random() * 1.3;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  geometry.setAttribute('aScale', new BufferAttribute(scales, 1));
  // El shader desplaza los puntos, así que los bounds derivados del buffer
  // mentirían: se fijan a mano, generosos, para que nada quede fuera.
  geometry.boundingSphere = new Sphere(
    new Vector3(0, height / 2, 0),
    radius * 1.6,
  );

  const material = new ShaderMaterial({
    uniforms: {
      uTime: environmentUniforms.uTime,
      uSize: { value: 34 },
      uHeight: { value: height },
      uColor: { value: new Color(PALETTE.cyan) },
    },
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });

  const points = new Points(geometry, material);
  points.name = 'ParticleField';
  points.frustumCulled = false;
  return points;
}

/* -------------------------------------------------------------------------- */
/* Objetos decorativos: la evolución de la tecnología                          */
/* -------------------------------------------------------------------------- */

/**
 * Izquierda — "el pasado": un monolito de losas apiladas, pesado y opaco, con
 * aristas ámbar. La forma cita el APK monolítico de la era Unity.
 */
export function createLegacyMonolith(): Group {
  const group = new Group();
  group.name = 'LegacyMonolith';

  const slabMaterial = new MeshStandardMaterial({
    color: new Color('#161c26'),
    metalness: 0.85,
    roughness: 0.42,
  });
  const edgeMaterial = new LineBasicMaterial({
    color: new Color(PALETTE.amber),
    transparent: true,
    opacity: 0.75,
  });

  // Cuatro losas decrecientes, giradas progresivamente: una pila de builds.
  const slabs: Array<[number, number, number, number]> = [
    // [ancho, alto, profundidad, y]
    [0.56, 0.16, 0.56, -0.33],
    [0.48, 0.2, 0.48, -0.1],
    [0.4, 0.24, 0.4, 0.16],
    [0.3, 0.18, 0.3, 0.4],
  ];

  slabs.forEach(([w, h, d, y], i) => {
    const geometry = new BoxGeometry(w, h, d);
    const slab = new Mesh(geometry, slabMaterial);
    slab.position.y = y;
    slab.rotation.y = i * 0.22;
    group.add(slab);

    // Las aristas ámbar son lo único que brilla en esta pieza: el resto absorbe.
    const edges = new LineSegments(new EdgesGeometry(geometry), edgeMaterial);
    edges.position.copy(slab.position);
    edges.rotation.copy(slab.rotation);
    group.add(edges);
  });

  return group;
}

/**
 * Derecha — "el futuro": una singularidad ligera. Icosaedro en alambre, núcleo
 * incandescente y un anillo inclinado. Todo hueco, todo aditivo: lo contrario
 * del monolito.
 */
export function createSingularity(): Group {
  const group = new Group();
  group.name = 'Singularity';

  const shell = new LineSegments(
    new EdgesGeometry(new IcosahedronGeometry(0.42, 1)),
    new LineBasicMaterial({
      color: new Color(PALETTE.cyan),
      transparent: true,
      opacity: 0.8,
    }),
  );
  group.add(shell);

  const core = new Mesh(
    new SphereGeometry(0.13, 20, 14),
    new MeshBasicMaterial({ color: new Color(PALETTE.magenta), fog: false }),
  );
  group.add(core);

  // Halo interior: esfera algo mayor renderizada por dentro, aditiva.
  const halo = new Mesh(
    new SphereGeometry(0.24, 20, 14),
    new MeshBasicMaterial({
      color: new Color(PALETTE.violet),
      transparent: true,
      opacity: 0.22,
      side: BackSide,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  group.add(halo);

  const ring = new Mesh(
    new TorusGeometry(0.62, 0.006, 8, 90),
    new MeshBasicMaterial({
      color: new Color(PALETTE.violet),
      transparent: true,
      opacity: 0.55,
      fog: false,
    }),
  );
  ring.rotation.set(Math.PI / 2.4, 0, Math.PI / 7);
  group.add(ring);

  return group;
}

/* -------------------------------------------------------------------------- */
/* Atmósfera                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Fija niebla y color de fondo. Se llama desde un sistema (no desde el manifiesto
 * de assets) porque necesita la `Scene` viva.
 *
 * La niebla es lineal y empieza lejos: los paneles están a 2 m y deben quedar
 * intactos, mientras que los objetos decorativos y el suelo sí se difuminan.
 */
export function applyAtmosphere(scene: Scene): void {
  const voidColor = new Color(PALETTE.void);
  scene.background = voidColor;
  scene.fog = new Fog(voidColor, 5, 26);
}
