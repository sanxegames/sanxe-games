# King Kongestion — Sanxe Games

Prototipo jugable de plataformas verticales con estética arcade pixelada original. Es una obra ficticia, humorística y satírica, sin afiliación política.

El antagonista se anima con fotogramas en pixel-art con transparencia real, guardados en `assets/boss-anim/` (y una imagen fija de respaldo en `assets/boss-static.png`).

## Ejecutar

Abre `index.html` en un navegador moderno. También puedes servir la carpeta con cualquier servidor estático, por ejemplo:

```powershell
python -m http.server 8080
```

Después visita `http://localhost:8080`.

## Controles

- Flechas o WASD: mover y subir/bajar escaleras.
- Espacio: saltar.
- P: pausar o continuar.
- R: reiniciar la partida.
- En pantallas táctiles aparecen controles en pantalla.

Objetivo: alcanzar el tren que espera en la plataforma superior, evitando o saltando los barriles. Hay tres vidas y la puntuación premia la rapidez y los saltos.
