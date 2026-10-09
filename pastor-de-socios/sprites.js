"use strict";
/* Pastor de socios — sprites dibujados por código.
   Reglas de 16 bits: paleta fija, píxeles enteros, contorno oscuro y poses a 10 fps (se eligen fuera, en game.js). */
(() => {
  const P = {
    ink: "#0d0a14", dog: "#1b1a26", dog2: "#2e2d42", cream: "#f7f0d5", creamS: "#c9c2a8", red: "#d9465b", red2: "#ff4d61", tongue: "#ff6b7d",
    wool: "#f7f0d5", woolS: "#c9c2a8", woolX: "#f5c4c4", woolXS: "#d98f8f", head: "#3b3a4d", head2: "#55546b", leg: "#2a2937",
    wolf: "#6c7086", wolfD: "#3d4057", wolfL: "#a3a7bd", eye: "#ffd34e", gold: "#ffd34e", gold2: "#d9992a", brown: "#8a5a3b", brown2: "#5c3a24",
    cyan: "#31d7c7", cyan2: "#0e8f86", white: "#ffffff"
  };
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g]; };
  function disc(g, c, cx, cy, rx, ry) {
    g.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
    }
  }
  function outlined(src, color = P.ink) {
    const w = src.width, h = src.height, [t, tg] = mk(w, h);
    tg.drawImage(src, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = color; tg.fillRect(0, 0, w, h);
    const [c, g] = mk(w + 2, h + 2);
    [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(([dx, dy]) => g.drawImage(t, dx, dy));
    g.drawImage(src, 1, 1); return c;
  }

  /* ---------------------------------------------------------------- perro */
  function drawDog(p) {
    const [c, g] = mk(28, 20), bob = p.bob | 0;
    const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y + bob, w, h); };
    const legs = [[7, P.dog], [10, P.dog2], [14, P.dog2], [17, P.dog]];
    const offs = p.leg < 0 ? [0, 0, 0, 0] : [[-2, 1, 2, -1], [0, 0, 0, 0], [2, -1, -2, 1], [0, 0, 0, 0]][p.leg];
    legs.forEach(([x, col], i) => {
      const dx = offs[i], h = dx < 0 ? 4 : 5;
      g.fillStyle = col; g.fillRect(x + dx, 13, 2, h);
      g.fillStyle = P.cream; g.fillRect(x + dx, 12 + h, 2, 1);
    });
    const t = p.tail;
    R(P.dog, 4, 8 - t * 2, 3, 2); R(P.dog, 3, 9 - t * 2 + (t === 0 ? 1 : 0), 1, 2); R(P.cream, 2, 10 - t * 3, 1, 1);
    R(P.dog, 6, 6, 13, 7); R(P.dog2, 8, 6, 9, 2); R(P.cream, 8, 11, 9, 2);
    R(P.dog, 17, 4, 4, 9); R(P.cream, 18, 8, 3, 5);
    R(P.dog, 19, 2, 6, 6); R(P.dog2, 19, 3, 2, 5);
    if (p.ear) { R(P.dog, 19, 1, 2, 1); R(P.dog2, 18, 2, 1, 3); } else { R(P.dog, 20, 0, 2, 2); }
    R(P.cream, 22, 2, 2, 5); R(P.cream, 24, 5, 4, 3); R(P.dog, 27, 5, 1, 2);
    R("#fff", 21, 4, 1, 1);
    if (p.mouth) { R(P.dog, 24, 8, 3, 1); R(P.tongue, 25, 9, 2, 1); }
    R(P.red, 19, 9, 2, 3); R(P.red2, 19, 8, 2, 1);
    return outlined(c);
  }
  const dog = {
    idle: [0, 1, 2, 1].map(t => drawDog({ tail: t, leg: -1 })),
    run: [0, 1, 2, 3].map(k => drawDog({ tail: 2, leg: k, bob: k % 2 ? -1 : 0, ear: k % 2 })),
    bark: [drawDog({ tail: 2, leg: -1, mouth: true, bob: -1 })]
  };

  /* ---------------------------------------------------------------- socios */
  function drawSheep(color, mode, step) {
    const [c, g] = mk(26, 18), stress = mode === "panic", graze = mode === "graze";
    const wl = stress ? P.woolX : P.wool, ws = stress ? P.woolXS : P.woolS, lift = step ? 1 : 0;
    [[6, 0], [9, 1], [15, 1], [18, 0]].forEach(([x, odd]) => { g.fillStyle = P.leg; g.fillRect(x, 13, 2, (odd ^ lift) ? 4 : 5); });
    const blobs = [[12.5, 7.5, 9.5, 6], [6, 5, 4, 3.5], [11, 3.5, 4, 3.5], [17, 4, 4, 3.5], [20, 7, 3.5, 3.8], [5, 9, 3.5, 3.8]];
    blobs.forEach(b => disc(g, ws, b[0], b[1] + 1, b[2], b[3]));
    blobs.forEach(b => disc(g, wl, b[0], b[1], b[2], b[3]));
    const hy = graze ? 11 : 8;
    disc(g, P.head, 22, hy, 3.3, 3.6); g.fillStyle = P.head2; g.fillRect(19, hy - 3, 2, 3);
    g.fillStyle = color; g.fillRect(18, 10, 3, 2); g.fillRect(16, 11, 2, 3);
    if (stress) { g.fillStyle = "#fff"; g.fillRect(22, hy - 2, 2, 2); g.fillStyle = P.ink; g.fillRect(23, hy - 1, 1, 1); g.fillRect(24, hy + 2, 2, 1); }
    else if (graze) { g.fillStyle = P.ink; g.fillRect(23, hy - 1, 1, 1); g.fillRect(25, hy + 1, 1, 1); g.fillStyle = "#6fcf6f"; g.fillRect(24, hy + 3, 3, 1); }
    else { g.fillStyle = "#fff"; g.fillRect(23, hy - 1, 1, 1); g.fillStyle = P.ink; g.fillRect(25, hy + 1, 1, 1); }
    return outlined(c);
  }
  const sheepCache = {};
  const sheep = (color, mode, step = 0) => sheepCache[`${color}${mode}${step}`] ||= drawSheep(color, mode, step);

  /* ------------------------------------------------------------------ lobo */
  function drawWolf(p) {
    const [c, g] = mk(34, 22), bob = p.bob | 0;
    const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y + bob, w, h); };
    const offs = [[-3, 2, 3, -2], [0, 0, 0, 0], [3, -2, -3, 2], [0, 0, 0, 0]][p.leg];
    [[8, P.wolfD], [11, P.wolf], [19, P.wolf], [22, P.wolfD]].forEach(([x, col], i) => { const dx = offs[i]; g.fillStyle = col; g.fillRect(x + dx, 15, 2, 6); g.fillStyle = P.wolfD; g.fillRect(x + dx, 20, 2, 1); });
    R(P.wolf, 1, 5 - (p.scared ? 0 : 1), 5, 4); R(P.wolfL, 0, 4 - (p.scared ? 0 : 1), 2, 3);
    R(P.wolf, 5, 8, 18, 8); R(P.wolfD, 7, 8, 12, 2); R(P.wolfL, 9, 14, 11, 2);
    R(P.wolf, 21, 5, 5, 10); R(P.wolf, 24, 3, 6, 6); R(P.wolfD, p.scared ? 24 : 25, p.scared ? 3 : 0, 2, 3);
    R(P.wolf, 29, 5, 5, 4); R(P.ink, 33, 5, 1, 2);
    R(P.eye, 27, 4, 1, 1);
    if (p.mouth) { R(P.wolfD, 29, 9, 4, 1); R("#fff", 30, 8, 1, 1); R("#fff", 32, 8, 1, 1); }
    R("#fff", 20, 11, 4, 4); R(P.red2, 20, 11, 4, 1); R(P.ink, 21, 13, 2, 1);
    return outlined(c);
  }
  const wolf = { run: [0, 1, 2, 3].map(k => drawWolf({ leg: k, bob: k % 2 ? -1 : 0 })), scared: [0, 2].map(k => drawWolf({ leg: k, scared: true, mouth: true })) };

  /* ---------------------------------------------------------------- objetos */
  function drawPickup(kind) {
    const [c, g] = mk(16, 16);
    if (kind === "time") {
      disc(g, P.ink, 8, 8, 7.2, 7.2); disc(g, P.gold, 8, 8, 6, 6); disc(g, "#fff6c9", 8, 8, 4.6, 4.6);
      g.fillStyle = P.ink; g.fillRect(8, 4, 1, 5); g.fillRect(8, 8, 3, 1); g.fillStyle = P.red2; g.fillRect(8, 3, 1, 1);
    } else if (kind === "lure") {
      g.fillStyle = P.ink; g.fillRect(2, 5, 12, 9); g.fillRect(5, 2, 6, 4);
      g.fillStyle = P.brown; g.fillRect(3, 6, 10, 7); g.fillStyle = P.brown2; g.fillRect(3, 10, 10, 1);
      g.fillStyle = P.gold; g.fillRect(7, 9, 2, 3); g.fillStyle = P.brown2; g.fillRect(6, 3, 4, 1); g.fillRect(6, 3, 1, 3); g.fillRect(9, 3, 1, 3);
    } else {
      disc(g, P.ink, 6.5, 6.5, 6.2, 6.2); disc(g, P.cyan, 6.5, 6.5, 5, 5); disc(g, "#d9fbf7", 6.5, 6.5, 3.4, 3.4);
      g.fillStyle = P.ink; for (let i = 0; i < 6; i++) g.fillRect(10 + i, 10 + i, 2, 2); g.fillStyle = P.brown; for (let i = 0; i < 4; i++) g.fillRect(11 + i, 11 + i, 1, 1);
    }
    return outlined(c);
  }
  const pickups = { time: drawPickup("time"), lure: drawPickup("lure"), freeze: drawPickup("freeze") };

  window.PS_SPR = { P, mk, disc, outlined, dog, sheep, wolf, pickups };
})();
