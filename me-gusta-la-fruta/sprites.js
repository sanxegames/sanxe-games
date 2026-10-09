"use strict";
/* Me gusta la fruta — arte en píxel dibujado por código.
   Frutas de 32x32, contorno oscuro y tajo por ángulo: cada fruta se parte en dos mitades con su pulpa. */
(() => {
  const INK = "#0d0a14";
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return [c, g]; };
  function disc(g, c, cx, cy, rx, ry = rx) {
    g.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry; if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1); }
  }
  const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  function outlined(src, color = INK) {
    const w = src.width, h = src.height, [t, tg] = mk(w, h);
    tg.drawImage(src, 0, 0); tg.globalCompositeOperation = "source-in"; tg.fillStyle = color; tg.fillRect(0, 0, w, h);
    const [c, g] = mk(w + 2, h + 2);
    [[0, 1], [2, 1], [1, 0], [1, 2]].forEach(([dx, dy]) => g.drawImage(t, dx, dy)); g.drawImage(src, 1, 1); return c;
  }

  /* ------------------------------------------------------------- frutas */
  const DRAW = {
    apple(g) { disc(g, "#a82333", 16, 18, 13, 12); disc(g, "#e03d4d", 15, 17, 12, 11); disc(g, "#ff7c88", 10, 12, 3, 2.5); R(g, "#8c1d2a", 15, 6, 3, 2); R(g, "#6b4423", 15, 2, 2, 5); disc(g, "#3fae5a", 21, 5, 4, 2.2); R(g, "#2a7a40", 19, 5, 4, 1); },
    orange(g) { disc(g, "#c7621c", 16, 16, 14.5); disc(g, "#ff9a2e", 15, 15, 13.5); [[8, 10], [14, 7], [20, 11], [11, 17], [19, 18], [15, 23], [23, 22], [7, 22]].forEach(([x, y]) => R(g, "#e0821f", x, y, 2, 1)); disc(g, "#ffc16a", 10, 10, 3.2, 2.5); disc(g, "#3fae5a", 16, 2, 3, 1.5); },
    melon(g) { disc(g, "#175a30", 16, 16, 15); disc(g, "#3fae5a", 16, 16, 14); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x + .5 - 16, y + .5 - 16); if (d < 14 && ((x + (y >> 2)) % 7) < 2) R(g, "#1f7a3c", x, y, 1, 1); } disc(g, "#8fe0a0", 9, 9, 3.5, 2.5); },
    banana(g) {
      for (let i = 0; i <= 40; i++) { const t = i / 40, a = Math.PI * (.12 + t * .76), x = 16 + 12.5 * Math.cos(Math.PI - a), y = 8 + 17 * Math.sin(a) * .95; disc(g, "#d9a21e", x, y + 1.5, 3.4); }
      for (let i = 0; i <= 40; i++) { const t = i / 40, a = Math.PI * (.12 + t * .76), x = 16 + 12.5 * Math.cos(Math.PI - a), y = 8 + 17 * Math.sin(a) * .95; disc(g, "#ffe066", x, y, 3.4); }
      R(g, "#6b4423", 3, 9, 3, 3); R(g, "#6b4423", 26, 10, 3, 3);
    },
    strawberry(g) { disc(g, "#b81e3a", 16, 16, 11, 11); disc(g, "#e8334f", 15, 15, 10, 10); disc(g, "#b81e3a", 16, 24, 7, 6); disc(g, "#e8334f", 15, 23, 6, 5); disc(g, "#b81e3a", 16, 28, 3, 2); [[10, 12], [16, 10], [21, 13], [12, 18], [19, 19], [15, 24], [9, 20], [22, 22], [16, 15]].forEach(([x, y]) => R(g, "#ffe066", x, y, 1, 2)); R(g, "#2f9a4a", 9, 4, 14, 3); [[10, 2], [14, 1], [18, 1], [21, 2], [12, 7], [19, 7]].forEach(([x, y]) => R(g, "#3fae5a", x, y, 2, 3)); },
    grapes(g) { [[11, 11], [17, 10], [22, 12], [14, 16], [20, 17], [11, 19], [17, 22], [23, 22], [14, 26]].forEach(([x, y]) => { disc(g, "#5a2fb0", x, y + 1, 4.8); disc(g, "#7a4bd6", x - .5, y, 4.5); disc(g, "#b79cff", x - 2, y - 2, 1.4); }); R(g, "#6b4423", 15, 2, 2, 5); disc(g, "#3fae5a", 21, 5, 4, 2.2); },
    pineapple(g) { disc(g, "#b8731a", 16, 20, 9.5, 11.5); disc(g, "#f0b32a", 15.5, 19.5, 9, 11); for (let y = 8; y < 32; y++) for (let x = 6; x < 26; x++) { if (Math.hypot((x + .5 - 16) / 9, (y + .5 - 20) / 11) < 1 && ((x + y) % 6 === 0 || (x - y + 40) % 6 === 0)) R(g, "#c27d1c", x, y, 1, 1); } [[12, 3, 2, 8], [15, 0, 2, 10], [18, 3, 2, 8], [9, 6, 2, 6], [21, 6, 2, 6]].forEach(([x, y, w, h]) => R(g, "#3fae5a", x, y, w, h)); R(g, "#2a7a40", 15, 4, 2, 6); disc(g, "#ffe27a", 12, 15, 2, 2.5); }
  };
  const FLESH = { apple: "#fff5d2", orange: "#ffc247", melon: "#ff5a6e", banana: "#fff3b0", strawberry: "#ff9aa6", grapes: "#d9c6ff", pineapple: "#fff29c" };
  const JUICE = { apple: "#e03d4d", orange: "#ff9a2e", melon: "#ff3a55", banana: "#ffe066", strawberry: "#e8334f", grapes: "#7a4bd6", pineapple: "#f0b32a" };
  const KINDS = Object.keys(DRAW);

  const cache = {};
  function fruit(kind) {
    if (cache[kind]) return cache[kind];
    const [c, g] = mk(32, 32); DRAW[kind](g); return (cache[kind] = outlined(c));
  }
  /* Bomba "impuesto": negra, con mecha y un % dorado. */
  function bomb(spark) {
    const k = "bomb" + spark; if (cache[k]) return cache[k];
    const [c, g] = mk(32, 32); disc(g, "#0a0a12", 16, 19, 12.5); disc(g, "#26263a", 15, 18, 11.5); disc(g, "#4a4a66", 10, 12, 3, 2.5);
    R(g, "#6b4423", 15, 4, 3, 6); R(g, "#c9c2a8", 14, 3, 5, 2);
    g.fillStyle = "#ffd34e"; R(g, "#ffd34e", 11, 15, 3, 3); R(g, "#ffd34e", 19, 22, 3, 3); for (let i = 0; i < 12; i++) R(g, "#ffd34e", 21 - i, 14 + i, 2, 1);
    if (spark) { R(g, "#ff7a2e", 13, 0, 7, 3); R(g, "#fff6b0", 15, 1, 3, 1); R(g, "#ff4d61", 12, 2, 2, 1); }
    return (cache[k] = outlined(c));
  }
  /* Objetos especiales */
  function power(type) {
    const k = "p" + type; if (cache[k]) return cache[k];
    const [c, g] = mk(32, 32);
    if (type === "cana") {
      R(g, "#c9c2a8", 22, 11, 6, 3); R(g, "#c9c2a8", 26, 11, 2, 11); R(g, "#c9c2a8", 22, 20, 6, 2);
      R(g, "#e8eef8", 7, 7, 16, 21); R(g, "#ffb347", 8, 11, 14, 16); R(g, "#ffd37a", 8, 11, 4, 16); R(g, "#d9892a", 8, 24, 14, 3);
      R(g, "#fffdf0", 6, 3, 18, 7); R(g, "#fffdf0", 9, 1, 5, 4); R(g, "#fffdf0", 16, 1, 6, 4); [[11, 15], [16, 19], [13, 22], [18, 14]].forEach(([x, y]) => R(g, "#fff3c4", x, y, 1, 1));
    } else if (type === "libertad") {
      disc(g, "#b8860b", 16, 16, 14.5); disc(g, "#ffd34e", 16, 15.5, 13.5); disc(g, "#fff2a8", 11, 10, 3.5, 2.5);
      const star = ["....###....", "....###....", "...#####...", "###########", ".#########.", "..#######..", "..#######..", ".####.####.", ".###...###.", "##.......##", "#.........#"];
      star.forEach((row, y) => { for (let x = 0; x < 11; x++) if (row[x] === "#") R(g, "#d9465b", 10 + x, 10 + y, 1, 1); });
    } else {
      disc(g, "#b8860b", 16, 16, 14.5); disc(g, "#31d7c7", 16, 15.5, 13.5); disc(g, "#d9fbf7", 11, 10, 3.5, 2.5);
      R(g, "#101629", 14, 7, 5, 11); R(g, "#101629", 11, 17, 11, 2); R(g, "#101629", 15, 19, 3, 5); R(g, "#101629", 12, 24, 9, 2); R(g, "#aab4d5", 15, 8, 3, 2);
    }
    return (cache[k] = outlined(c));
  }

  /* Tajo: parte el sprite por una recta que pasa por el centro con el ángulo dado (radianes). */
  const halfCache = {};
  function halves(src, angle, flesh) {
    const q = Math.round(((angle % Math.PI) + Math.PI) % Math.PI / (Math.PI / 12)) % 12, key = src._id + "|" + q + "|" + flesh;
    if (halfCache[key]) return halfCache[key];
    const w = src.width, h = src.height, a = q * Math.PI / 12, nx = -Math.sin(a), ny = Math.cos(a), cx = w / 2, cy = h / 2;
    const sg = src.getContext("2d").getImageData(0, 0, w, h).data, out = [];
    for (const side of [1, -1]) {
      const [c, g] = mk(w, h), id = g.createImageData(w, h), d = id.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, dist = (x + .5 - cx) * nx + (y + .5 - cy) * ny;
        if (sg[i + 3] < 40 || dist * side < 0) continue;
        const near = dist * side < 1.6;
        if (near) { const f = flesh; d[i] = parseInt(f.slice(1, 3), 16); d[i + 1] = parseInt(f.slice(3, 5), 16); d[i + 2] = parseInt(f.slice(5, 7), 16); d[i + 3] = 255; }
        else { d[i] = sg[i]; d[i + 1] = sg[i + 1]; d[i + 2] = sg[i + 2]; d[i + 3] = sg[i + 3]; }
      }
      g.putImageData(id, 0, 0); out.push(c);
    }
    return (halfCache[key] = out);
  }
  let idc = 0; const tag = c => (c._id = c._id || ++idc, c);
  const fruitT = k => tag(fruit(k));

  /* ---------------------------------------------------------- la presidenta */
  function mascot(mood, bob) {
    const k = "m" + mood + bob; if (cache[k]) return cache[k];
    const [c, g] = mk(40, 46), skin = "#f2b184", skin2 = "#d99468", hair = "#3a2418", hair2 = "#5a3a26";
    R(g, "#d9465b", 4, 30, 32, 16); R(g, "#b53347", 4, 30, 5, 16); R(g, "#f7f0d5", 15, 29, 10, 8); R(g, "#d9d2bc", 15, 29, 10, 2);
    R(g, "#ffd34e", 8, 35, 3, 3); R(g, "#ffd34e", 29, 36, 2, 2);
    R(g, skin, 16, 24, 8, 7);
    disc(g, hair, 20, 15, 13, 14); disc(g, skin, 20, 17, 10, 11); disc(g, hair2, 20, 8, 12, 5);
    R(g, hair, 6, 12, 4, 20); R(g, hair, 30, 12, 4, 20); R(g, hair, 8, 28, 3, 3); R(g, hair, 29, 28, 3, 3);
    R(g, skin2, 17, 21, 2, 1);
    const eye = (x, y, big) => { R(g, "#fff", x, y, big ? 4 : 3, big ? 4 : 3); R(g, INK, x + 1, y + 1, 2, big ? 3 : 2); };
    if (mood === "shock") { eye(13, 14, true); eye(23, 14, true); R(g, INK, 18, 23, 4, 4); R(g, "#ff6b7d", 19, 24, 2, 2); R(g, hair, 12, 12, 5, 1); R(g, hair, 23, 12, 5, 1); }
    else if (mood === "joy") { R(g, INK, 13, 15, 4, 1); R(g, INK, 12, 16, 1, 1); R(g, INK, 17, 16, 1, 1); R(g, INK, 23, 15, 4, 1); R(g, INK, 22, 16, 1, 1); R(g, INK, 27, 16, 1, 1); R(g, INK, 14, 22, 12, 1); R(g, "#fff", 15, 23, 10, 3); R(g, "#ff6b7d", 17, 25, 6, 2); R(g, "#ff8f99", 11, 20, 3, 2); R(g, "#ff8f99", 26, 20, 3, 2); }
    else { eye(13, 15, false); eye(24, 15, false); R(g, INK, 16, 23, 8, 1); R(g, INK, 15, 22, 1, 1); R(g, INK, 24, 22, 1, 1); R(g, "#ff8f99", 11, 20, 3, 2); R(g, "#ff8f99", 26, 20, 3, 2); }
    R(g, "#c9302f", 16, 26, 8, 1);
    const o = outlined(g.canvas ? g.canvas : c); return (cache[k] = o);
  }

  window.MF_SPR = { mk, disc, outlined, fruit: fruitT, bomb, power, halves, mascot, KINDS, FLESH, JUICE };
})();
