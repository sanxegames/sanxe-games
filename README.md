# Sanxe Games

Minijuegos arcade de navegador con sátira política. Web estática publicada con GitHub Pages en https://sanxegames.es

## Estructura

- `index.html` + `assets/home.css` + `assets/home.js`: portada (estética arcade/CRT). Todo el arte se dibuja en canvas.
- `assets/commuter-sprites.js`: sprite del viajero, generado a partir de `king-kongestion/game.js`.
- `assets/fonts/`: Press Start 2P y VT323 (OFL), servidas en local.
- `assets/og.png`: imagen para compartir el enlace (1200x630).
- `king-kongestion/`: juego King Kongestion (HTML5 canvas, sin dependencias). Ver su propio README.
- `pastor-de-socios/`: juego Pastor de socios (HTML5 canvas, sin dependencias): `sprites.js` (arte por código), `audio.js` (efectos y música chiptune) y `game.js` (lógica). Enlazado desde la portada. Con `?debug`, `window.__ps` permite simular partidas.
- `flappy-falcon/`: juego Flappy Falcon (HTML5 canvas, sin dependencias): `audio.js` (efectos y música) y `game.js`; reutiliza `pastor-de-socios/sprites.js` para el perro. Con `?debug`, `window.__ff` permite simular vuelos.
- `me-gusta-la-fruta/`: juego Me gusta la fruta (HTML5 canvas, sin dependencias): `sprites.js` (frutas y tajo por ángulo), `audio.js` y `game.js`. Con `?debug`, `window.__mf` permite simular partidas.
- `rumbo-a-moncloa/`: juego Rumbo a la Moncloa (estilo Frogger con tres etapas: Galicia, Madrid y Bruselas; canvas sin dependencias): `audio.js` y `game.js`. Con `?debug`, `window.__rm` permite simular partidas.
- `bandera-xxl/`: juego Bandera XXL (apilador tipo Stack: pedestal, bandera creciente y vista final con zoom; canvas sin dependencias): `audio.js` y `game.js`. Con `?debug`, `window.__bx` permite simular partidas.

## Añadir un juego

1. Crea una carpeta nueva (`mi-juego/`) con su `index.html` y sus ficheros. Usa rutas relativas.
2. En `index.html` de la raíz, convierte una tarjeta "Próximamente" en tarjeta jugable (o añade otra) y añade la URL a `sitemap.xml`.
3. Haz push a `main`: GitHub Pages lo publica solo.

## Probar en local

```bash
python -m http.server 8000
```

Abre `http://localhost:8000/`. Con `?debug` en la URL, `window.__sg` expone `hero(n)`, `attract(n)` y `rain(n)` para avanzar las animaciones a mano (útil en entornos sin `requestAnimationFrame`).

## Extras de la portada

- Código Konami (↑↑↓↓←→←→BA) o 5 clics en el logo del pie: lluvia de barriles.
- Se respeta `prefers-reduced-motion`: sin animaciones, sin secuencia de arranque.
