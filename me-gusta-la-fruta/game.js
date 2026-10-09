"use strict";
/* Me gusta la fruta — Sanxe Games.
   Corta fruta, esquiva los impuestos y aguanta la rueda de prensa. */
(() => {
  const SPR = window.MF_SPR, AUD = window.MF_AUD, sfx = AUD.sfx, music = AUD.music;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, "0");
  const safe = (fn, fb = null) => { try { return fn(); } catch { return fb; } };
  const store = { get: k => safe(() => localStorage.getItem(k)), set: (k, v) => safe(() => localStorage.setItem(k, v)) };
  const DEBUG = /[?&]debug/.test(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = $("#game"), ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = 800, H = 600, G = 1100, SC = 2, FIXED = 1 / 120, COUNTER = 548, KILOS_PER_ROUND = 25;
  const KINDS = SPR.KINDS;

  const UI = {
    kilos: $("#kilos"), round: $("#round"), stat: $("#stat"), statLabel: $("#stat-label"), best: $("#best"), status: $("#game-status"),
    overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"),
    sound: $("#sound"), pause: $("#pause"), restart: $("#restart"), help: $("#game-help")
  };
  let state = "title", mode = "classic", soundOn = store.get("mf-sound") !== "0";
  let items = [], launches = [], pieces = [], particles = [], stains = [], floats = [], bubbles = [], blade = [], bg = null, counterImg = null;
  let kilos = 0, round = 1, lives = 3, timeLeft = 60, t = 0, acc = 0, last = 0, waveT = 1, powerT = 12, shakeT = 0, shakeM = 0, flashT = 0, bannerT = 0, bannerText = "", mood = "idle", moodT = 0, quipT = 6, idleQuip = 8;
  let slowT = 0, libertadT = 0, prensaT = 0, strokeCount = 0, strokeT = 0, strokeFruit = 0, bestStreak = 0, missed = 0, bombsHit = 0, comboMax = 0, sliced = 0, cause = "";
  let pointer = { down: false, x: 400, y: 300, lx: 0, ly: 0, lt: 0 }, kb = { on: false, x: 400, y: 300, keys: new Set() };
  const bestKey = () => "mf-best-" + mode;
  let best = +store.get(bestKey()) || 0;

  const LINES = {
    idle: ["¡Me gusta la fruta!", "¿Y usted, qué fruta prefiere?", "¡Fruta con libertad!", "La fruta no se sube de precio sola.", "¿Alguna pregunta? ¡Sobre fruta!"],
    combo: ["¡Esto sí es una rueda de prensa!", "¡Fruta para todos!", "¡Menudo corte de mangas… y de manzanas!"],
    bomb: ["¡Impuestos no, por favor!", "¡Eso es una subida fiscal!", "¡Quién ha traído un impuesto aquí!"],
    miss: ["¡Se pudre la fruta!", "¡Esa se nos escapa!", "¡Que alguien recoja eso!"],
    cana: ["¡Una cañita y a pensar!", "¡Con una caña todo va más lento!"],
    libertad: ["¡LIBERTAD!", "¡Libertad, sin impuestos!"],
    prensa: ["¡Rueda de prensa! ¡Fruta, fruta!", "¡Preguntas? ¡Aquí hay muchas!"],
    round: ["¡Subimos de ronda!", "¡Más fruta, más libertad!"]
  };

  /* Tildes en mayúsculas de la fuente pixel (ver .ac en style.css); el texto original queda para lectores de pantalla */
  const ACC = { "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ñ": "N", "Ü": "U" }, ACC_RE = /[ÁÉÍÓÚÑÜ]/;
  function fixAccents(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) if (ACC_RE.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const p = n.parentElement; if (!p || p.closest(".sr-only,[aria-hidden='true'],script,style,.ac")) continue;
      if (!getComputedStyle(p).fontFamily.includes("Press Start")) continue;
      const text = n.nodeValue, sr = document.createElement("span"), vis = document.createElement("span"); sr.className = "sr-only"; sr.textContent = text; vis.setAttribute("aria-hidden", "true");
      let buf = "";
      for (const ch of text) { if (ACC[ch]) { if (buf) { vis.append(buf); buf = ""; } const sp = document.createElement("span"); sp.className = "ac" + (ch === "Ñ" ? " n" : ch === "Ü" ? " u" : ""); sp.textContent = ACC[ch]; vis.append(sp); } else buf += ch; }
      if (buf) vis.append(buf); n.replaceWith(sr, vis);
    }
  }

  /* --------------------------------------------------------------- fondo */
  function buildBg() {
    const [c, g] = SPR.mk(W, H), R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const phases = [["#ffcf8a", "#ff8a5a", "#3a2a3e", "#4b3550"], ["#ff9a5a", "#b8456a", "#2e2240", "#3e2e55"], ["#1d2a55", "#0b1021", "#171e3a", "#222b50"], ["#2b1a55", "#0f0b2a", "#1d1445", "#2c1f66"]], p = phases[(round - 1) % phases.length];
    R(p[2], 0, 0, W, H); for (let y = 0; y < H; y += 20) for (let x = (y / 20 % 2) * 20; x < W; x += 40) R(p[3], x, y, 38, 18);
    // ventana al fondo
    const gx = 260, gy = 70, gw = 280, gh = 190, sky = g.createLinearGradient(0, gy, 0, gy + gh); sky.addColorStop(0, p[0]); sky.addColorStop(1, p[1]); g.fillStyle = sky; g.fillRect(gx, gy, gw, gh);
    for (let x = gx, i = 0; x < gx + gw; i++) { const bw = 16 + (i * 7) % 18, bh = 24 + (i * 13) % 56; R(round % 4 >= 2 ? "#0c1430" : "#4a3f78", x, gy + gh - bh, Math.min(bw, gx + gw - x), bh); for (let wy = gy + gh - bh + 5; wy < gy + gh - 4; wy += 8) for (let wx = x + 3; wx < x + bw - 3; wx += 7) if ((wx * 3 + wy) % 5 < 2) R("#ffd34e", wx, wy, 3, 3); x += bw + 2; }
    R("#2a1c14", gx - 8, gy - 8, gw + 16, 8); R("#2a1c14", gx - 8, gy + gh, gw + 16, 8); R("#2a1c14", gx - 8, gy - 8, 8, gh + 16); R("#2a1c14", gx + gw, gy - 8, 8, gh + 16); R("#2a1c14", gx + gw / 2 - 3, gy, 6, gh);
    // toldo
    for (let x = 0; x < W; x += 40) { R(x % 80 ? "#f7f0d5" : "#d9465b", x, 0, 40, 38); } for (let x = 0; x < W; x += 40) { g.fillStyle = x % 80 ? "#f7f0d5" : "#d9465b"; g.beginPath(); g.arc(x + 20, 38, 20, 0, Math.PI); g.fill(); } R("rgba(0,0,0,.25)", 0, 0, W, 6);
    // estantes con cajas de fruta
    const shelf = (y, kinds) => { R("#2a1c14", 0, y, W, 10); R("#4a3223", 0, y, W, 4); for (let x = 12, i = 0; x < W - 60; x += 86, i++) { if (x > gx - 70 && x < gx + gw + 30 && y < gy + gh + 20) continue; R("#6b4423", x, y - 34, 74, 34); R("#8a5a3b", x, y - 34, 74, 5); R("#4a2e1b", x + 2, y - 4, 70, 4); const k = kinds[i % kinds.length]; g.globalAlpha = .9; for (let j = 0; j < 3; j++) g.drawImage(SPR.fruit(k), x + 6 + j * 22, y - 50 - (j % 2) * 3, 24, 24); g.globalAlpha = 1; } };
    shelf(300, ["apple", "orange", "banana", "grapes", "strawberry"]); shelf(420, ["melon", "pineapple", "orange", "apple"]);
    // luces
    for (let i = 0; i < 14; i++) { const x = 20 + i * 58, y = 44 + Math.sin(i * 1.3) * 5; R("#222", x, y, 2, 2); R(["#ff4d61", "#ffd34e", "#31d7c7", "#3cff7a"][i % 4], x - 2, y + 2, 6, 6); }
    if (round % 4 >= 2) { g.fillStyle = "rgba(0,0,20,.28)"; g.fillRect(0, 0, W, H); }
    bg = c;
    // mostrador (se dibuja por delante de las frutas)
    const [m, mg] = SPR.mk(W, H - COUNTER + 14), MR = (col, x, y, w, h) => { mg.fillStyle = col; mg.fillRect(x, y, w, h); };
    MR("#3a2414", 0, 14, W, 60); MR("#6b4423", 0, 14, W, 8); MR("#8a5a3b", 0, 14, W, 3); for (let x = 0; x < W; x += 64) MR("#2a1a0e", x, 22, 3, 52);
    MR("#050814", 0, 12, W, 3);
    mg.font = '8px "Press Start 2P", monospace'; mg.textAlign = "center";
    [["MANZANA 1€", 130], ["NARANJA 1€", 330], ["MELON 2€", 530], ["LIBERTAD GRATIS", 700]].forEach(([txt, x]) => { const w = Math.ceil(mg.measureText(txt).width) + 14; MR("#050814", x - w / 2 - 2, 30, w + 4, 22); MR("#f7f0d5", x - w / 2, 32, w, 18); MR("#d9465b", x - w / 2, 32, w, 3); mg.fillStyle = "#101629"; mg.fillText(txt, x, 46); });
    counterImg = m;
  }

  /* ---------------------------------------------------------- efectos */
  const shake = (m, d = .25) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, d); };
  const float = (x, y, text, color, life = 1.2) => floats.push({ x, y, text, color, t: 0, life });
  const say = (text, life = 2.6) => { bubbles = [{ text, t: 0, life }]; };
  const setMood = (m, d = .7) => { mood = m; moodT = d; };
  function splat(x, y, color) {
    stains.push({ x, y, color, t: 0, life: 6, sq: Array.from({ length: 12 }, () => ({ dx: rnd(-26, 26), dy: rnd(-22, 22), s: pick([4, 6, 8, 10]) })) });
    if (stains.length > 28) stains.shift();
  }
  function juice(x, y, color, n = 14, sp = 260) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: rnd(.4, .9), color, s: pick([3, 4, 5, 6]) }); } }

  /* ------------------------------------------------------------- partida */
  const lifeText = () => "♥".repeat(Math.max(0, lives)) + "·".repeat(Math.max(0, 3 - lives));
  function updateHud() {
    UI.kilos.textContent = pad(kilos, 3); UI.round.textContent = round; UI.best.textContent = pad(best, 3);
    if (mode === "classic") { UI.statLabel.textContent = "VIDAS"; UI.stat.textContent = lifeText(); } else { UI.statLabel.textContent = "TIEMPO"; UI.stat.textContent = pad(Math.ceil(timeLeft), 2); }
  }
  function setControls() { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; }
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };
  function reset(m) {
    mode = m; best = +store.get(bestKey()) || 0;
    items = []; launches = []; pieces = []; particles = []; stains = []; floats = []; bubbles = []; blade = [];
    kilos = 0; round = 1; lives = 3; timeLeft = 60; t = 0; waveT = 1.2; powerT = rnd(14, 20); shakeT = 0; flashT = 0; bannerT = 2.4; bannerText = m === "classic" ? "A POR LA FRUTA" : "RUEDA DE PRENSA: 60 SEGUNDOS"; mood = "idle"; moodT = 0; quipT = 4; idleQuip = rnd(7, 11);
    slowT = 0; libertadT = 0; prensaT = 0; strokeCount = 0; strokeT = 0; bestStreak = 0; missed = 0; bombsHit = 0; comboMax = 0; sliced = 0; cause = "";
    buildBg(); updateHud(); music.setSlow(false); music.setLevel(1);
  }

  /* ---------------------------------------------------------- pantallas */
  function showOverlay({ stamp = "SÁTIRA PIXELADA", title, text = "", extra = "", actions = [], help = false }) {
    UI.help.hidden = !help; UI.stamp.textContent = stamp; UI.title.textContent = title; UI.text.textContent = text; UI.text.hidden = !text;
    if (typeof extra === "string") UI.extra.innerHTML = extra; else { UI.extra.innerHTML = ""; UI.extra.appendChild(extra); }
    UI.actions.innerHTML = "";
    actions.forEach((a, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a.secondary ? " secondary" : ""); b.textContent = a.label; b.addEventListener("click", a.fn); UI.actions.appendChild(b); if (i === 0) requestAnimationFrame(() => b.focus()); });
    UI.overlay.classList.remove("hidden"); pointer.down = false; fixAccents(UI.overlay);
  }
  const hideOverlay = () => UI.overlay.classList.add("hidden");
  const goHome = () => { location.href = "../"; };
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    const b1 = +store.get("mf-best-classic") || 0, b2 = +store.get("mf-best-time") || 0;
    showOverlay({ help: true, title: "ME GUSTA LA FRUTA", text: `La presidenta ha montado una frutería. Corta toda la fruta que vuele, esquiva los impuestos (las bombas con un %) y no dejes que se pudra nada.${b1 || b2 ? ` Récords: clásico ${b1}, contrarreloj ${b2}.` : ""}`, actions: [{ label: "CLÁSICO: 3 VIDAS", fn: () => play("classic") }, { label: "CONTRARRELOJ: 60 S", fn: () => play("time") }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function play(m) {
    state = "playing"; reset(m); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(1);
    UI.status.textContent = m === "classic" ? "Modo clásico: tres vidas." : "Contrarreloj: sesenta segundos."; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now();
  }
  function pauseScreen() { if (state !== "playing") return; state = "paused"; setControls(); music.pause(true); showOverlay({ help: true, stamp: "RESPIRO", title: "PAUSA", text: "La fruta espera en el aire. Por una vez.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR", secondary: true, fn: () => play(mode) }, { label: "CAMBIAR DE MODO", secondary: true, fn: titleScreen }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] }); }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function gameOver() {
    state = "over"; setControls(); music.stop(); sfx.over(); const newBest = kilos > best; if (newBest) { best = kilos; store.set(bestKey(), String(best)); updateHud(); }
    let h;
    if (cause === "impuestos") h = ["SUBIDA DE IMPUESTOS", "La frutería cierra: ahora cada pieza lleva IVA, tasa de reposición y un impuesto a la fruta anterior."];
    else if (cause === "tiempo") h = ["SE ACABÓ LA RUEDA DE PRENSA", "Preguntas sobre la fruta: ninguna. Respuestas: todas."];
    else h = ["SE PUDRIÓ LA FRUTA", "El Gobierno atribuye la podredumbre a la fruta del anterior."];
    const tier = kilos >= 150 ? "FRUTERO MAYOR DEL REINO" : kilos >= 80 ? "FRUTERO DE GUARDIA" : kilos >= 40 ? "APRENDIZ DE MERCADO" : kilos >= 15 ? "CATADOR" : "FRUTA VERDE";
    UI.status.textContent = `Fin de la partida con ${kilos} kilos.`;
    showOverlay({ stamp: mode === "classic" ? "CLÁSICO" : "CONTRARRELOJ", title: h[0], text: `${kilos} kilos${newBest ? " (¡récord!)" : `. Récord: ${best}`}. Rango: ${tier}.`, extra: `<p class="headline"><b>ÚLTIMA HORA</b>${h[1]}<small>Mejor combo: ${comboMax} · Piezas cortadas: ${sliced} · Impuestos tocados: ${bombsHit}</small></p>`, actions: [{ label: "OTRA VEZ", fn: () => play(mode) }, { label: "CAMBIAR DE MODO", secondary: true, fn: titleScreen }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }

  /* ------------------------------------------------------------ lanzamientos */
  function makeItem(kind, type, x0, tx, apex) {
    const y0 = H + 48, vy = -Math.sqrt(2 * G * (y0 - apex)), tA = -vy / G, vx = (tx - x0) / tA;
    return { kind, type, x: x0, y: y0, vx, vy, rot: rnd(0, 6.28), vr: rnd(-4, 4) * (kind === "fruit" ? 1 : .5), r: kind === "fruit" ? (type === "melon" ? 30 : 26) : 27, alive: true, age: 0 };
  }
  function queue(item, delay = 0) { launches.push({ t: delay, item }); }
  const canBomb = () => libertadT <= 0 && prensaT <= 0 && items.filter(i => i.kind === "bomb").length < 2;
  function bombChance() { return mode === "classic" ? Math.min(.32, .05 + .026 * round) : Math.min(.16, .04 + .012 * round); }
  function pickItem(x0, tx, apex, delay) {
    if (canBomb() && Math.random() < bombChance()) queue(makeItem("bomb", "bomb", x0, tx, apex), delay);
    else queue(makeItem("fruit", pick(KINDS), x0, tx, apex), delay);
  }
  function spawnWave() {
    const n = 1 + Math.floor(rnd(0, 1 + round / 2.2)), pat = Math.random();
    if (pat < .34 || n === 1) { for (let i = 0; i < Math.min(n, 2); i++) { const x0 = rnd(120, W - 120); pickItem(x0, clamp(x0 + rnd(-150, 150), 90, W - 90), rnd(110, 300), i * .22); } }
    else if (pat < .6) { const c = rnd(220, W - 220), m = Math.min(7, 2 + Math.floor(round / 3)); for (let i = 0; i < m; i++) pickItem(c + (i - (m - 1) / 2) * 24, c + (i - (m - 1) / 2) * 92, rnd(130, 260), i * .06); }
    else if (pat < .8) { const side = Math.random() < .5 ? -30 : W + 30; for (let i = 0; i < Math.min(5, n + 1); i++) pickItem(side, side < 0 ? rnd(220, 520) : rnd(280, 580), rnd(200, 360), i * .26); }
    else { for (let i = 0; i < Math.min(4, n + 1); i++) { const x0 = rnd(110, W - 110); pickItem(x0, clamp(x0 + rnd(-80, 80), 90, W - 90), rnd(100, 260), i * .17); } }
    sfx.whoosh();
  }
  function spawnPower() {
    const type = pick(["cana", "libertad", "prensa"]), x0 = rnd(200, W - 200);
    queue({ ...makeItem("power", type, x0, clamp(x0 + rnd(-100, 100), 120, W - 120), rnd(150, 280)), r: 30 }, 0); sfx.whoosh();
  }
  function frenzy() { for (let i = 0; i < 10; i++) { const x0 = rnd(100, W - 100); queue(makeItem("fruit", pick(KINDS), x0, clamp(x0 + rnd(-140, 140), 90, W - 90), rnd(110, 320)), i * .26); } }

  /* ------------------------------------------------------------------ tajo */
  function segDist(x1, y1, x2, y2, cx, cy) { const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy; let u = l2 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0; u = clamp(u, 0, 1); return Math.hypot(cx - (x1 + u * dx), cy - (y1 + u * dy)); }
  function sliceAt(x1, y1, x2, y2) {
    if (state !== "playing") return;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    for (const it of items) {
      if (!it.alive || it.y > COUNTER + 30) continue;
      if (segDist(x1, y1, x2, y2, it.x, it.y) > it.r) continue;
      it.alive = false;
      if (it.kind === "fruit") cutFruit(it, ang);
      else if (it.kind === "bomb") hitBomb(it);
      else takePower(it);
    }
  }
  function cutFruit(it, ang) {
    sliced++; strokeCount++; strokeT = .35; strokeFruit++;
    const mult = libertadT > 0 ? 2 : 1, spr = SPR.fruit(it.type), [a, b] = SPR.halves(spr, ang, SPR.FLESH[it.type]), nx = -Math.sin(ang), ny = Math.cos(ang);
    [[a, 1], [b, -1]].forEach(([img, s]) => pieces.push({ img, x: it.x, y: it.y, vx: it.vx * .6 + nx * s * rnd(110, 200), vy: it.vy * .5 + ny * s * rnd(110, 200) - 60, rot: it.rot, vr: it.vr + s * rnd(1, 4), t: 0 }));
    juice(it.x, it.y, SPR.JUICE[it.type], 14); splat(it.x, it.y, SPR.JUICE[it.type]); sfx.slice(strokeCount); sfx.splat(strokeCount);
    kilos += mult; float(it.x, it.y - 30, mult > 1 ? "+2" : "+1", "#f7f0d5", .8); setMood("joy", .6);
    if (strokeCount >= 3) { const bonus = strokeCount - 2; kilos += bonus * mult; comboMax = Math.max(comboMax, strokeCount); float(it.x, it.y - 56, `COMBO x${strokeCount}`, "#3cff7a", 1.3); sfx.combo(strokeCount); if (strokeCount === 3) say(pick(LINES.combo)); }
    checkRound(); updateHud();
  }
  function hitBomb(it) {
    bombsHit++; juice(it.x, it.y, "#ffd34e", 18, 330); juice(it.x, it.y, "#ff7a2e", 18, 280); shake(8, .5); flashT = .35; sfx.bomb(); setMood("shock", 1.2); say(pick(LINES.bomb));
    float(it.x, it.y - 30, "¡IMPUESTO!", "#ff4d61", 1.5);
    if (mode === "classic") { lives--; if (lives <= 0) { cause = "impuestos"; updateHud(); gameOver(); return; } } else { timeLeft = Math.max(0, timeLeft - 4); float(W / 2, 200, "-4 S", "#ff4d61", 1.3); }
    strokeCount = 0; updateHud();
  }
  function takePower(it) {
    juice(it.x, it.y, "#ffd34e", 16, 240); sfx[it.type === "prensa" ? "prensa" : it.type](); shake(3, .3);
    if (it.type === "cana") { slowT = 6; music.setSlow(true); float(it.x, it.y - 30, "CAÑA: TODO MÁS LENTO", "#ffb347", 1.8); say(pick(LINES.cana)); }
    else if (it.type === "libertad") { libertadT = 8; items.forEach(i => { if (i.kind === "bomb") i.alive = false; }); float(it.x, it.y - 30, "¡LIBERTAD! PUNTOS x2", "#ffd34e", 1.8); say(pick(LINES.libertad)); bannerText = "¡LIBERTAD!"; bannerT = 1.6; }
    else { prensaT = 6; frenzy(); float(it.x, it.y - 30, "¡RUEDA DE PRENSA!", "#31d7c7", 1.8); say(pick(LINES.prensa)); bannerText = "¡RUEDA DE PRENSA!"; bannerT = 1.6; }
    setMood("joy", 1);
  }
  function checkRound() { const r = 1 + Math.floor(kilos / KILOS_PER_ROUND); if (r > round) { round = r; bannerText = `RONDA ${round}`; bannerT = 1.8; sfx.round(); say(pick(LINES.round)); music.setLevel(round); buildBg(); updateHud(); } }
  function loseLife() {
    missed++; sfx.miss(); setMood("shock", .8); say(pick(LINES.miss), 2);
    if (mode === "classic") { lives--; updateHud(); if (lives <= 0) { cause = "podrida"; gameOver(); } }
  }

  /* ------------------------------------------------------------ simulación */
  function update(rdt) {
    if (state !== "playing") return;
    const ts = slowT > 0 ? .42 : 1, dt = rdt * ts;
    t += rdt; bannerT = Math.max(0, bannerT - rdt); shakeT = Math.max(0, shakeT - rdt); flashT = Math.max(0, flashT - rdt); moodT = Math.max(0, moodT - rdt); if (moodT === 0) mood = "idle";
    slowT = Math.max(0, slowT - rdt); if (slowT === 0) music.setSlow(false); libertadT = Math.max(0, libertadT - rdt); prensaT = Math.max(0, prensaT - rdt);
    if (mode === "time") { timeLeft -= rdt; const s = Math.ceil(timeLeft); if (s !== Math.ceil(timeLeft + rdt)) { UI.stat.textContent = pad(s, 2); if (s <= 10 && s > 0) sfx.tick(); } if (timeLeft <= 0) { timeLeft = 0; cause = "tiempo"; updateHud(); gameOver(); return; } }
    // cuchilla con teclado
    if (kb.on && kb.keys.size) { const sp = 560 * rdt, ox = kb.x, oy = kb.y; if (kb.keys.has("ArrowLeft")) kb.x -= sp; if (kb.keys.has("ArrowRight")) kb.x += sp; if (kb.keys.has("ArrowUp")) kb.y -= sp; if (kb.keys.has("ArrowDown")) kb.y += sp; kb.x = clamp(kb.x, 0, W); kb.y = clamp(kb.y, 0, H); if (kb.keys.has("Space") && (ox !== kb.x || oy !== kb.y)) { blade.push({ x: kb.x, y: kb.y, t }); sliceAt(ox, oy, kb.x, kb.y); } }
    strokeT = Math.max(0, strokeT - rdt); if (strokeT === 0 && !pointer.down) { strokeCount = 0; }
    if (strokeT === 0 && pointer.down) strokeCount = 0;
    // generación de oleadas
    waveT -= dt; if (waveT <= 0) { spawnWave(); waveT = prensaT > 0 ? .7 : Math.max(.42, 1.7 - round * .1) * rnd(.85, 1.15); }
    powerT -= dt; if (powerT <= 0) { spawnPower(); powerT = rnd(20, 28); }
    for (const l of launches) l.t -= dt; for (const l of launches) if (l.t <= 0) items.push(l.item); launches = launches.filter(l => l.t > 0);
    for (const it of items) { it.age += dt; it.vy += G * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt; if (it.alive && it.vy > 0 && it.y > H + 60) { it.alive = false; if (it.kind === "fruit") loseLife(); } }
    items = items.filter(i => i.alive || false);
    for (const p of pieces) { p.t += dt; p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; } pieces = pieces.filter(p => p.y < H + 80 && p.t < 3);
    for (const p of particles) { p.t += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; } particles = particles.filter(p => p.t < p.life);
    for (const s of stains) s.t += rdt; stains = stains.filter(s => s.t < s.life);
    for (const f of floats) { f.t += rdt; f.y -= 34 * rdt; } floats = floats.filter(f => f.t < f.life);
    for (const b of bubbles) b.t += rdt; bubbles = bubbles.filter(b => b.t < b.life);
    blade = blade.filter(b => t - b.t < .16);
    quipT -= rdt; if (quipT <= 0 && !bubbles.length) { quipT = idleQuip; say(pick(LINES.idle)); }
  }

  /* ---------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  function outlinedText(txt, x, y, color, font, align = "center") { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814"; [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y); }
  function drawSprite(img, x, y, rot, sc = SC) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(rot); ctx.drawImage(img, Math.round(-img.width * sc / 2), Math.round(-img.height * sc / 2), img.width * sc, img.height * sc); ctx.restore(); }
  const HEART = ["..##.##..", ".#######.", ".#######.", "..#####..", "...###...", "....#...."];
  function drawHeart(x, y, on) { HEART.forEach((row, j) => { for (let i = 0; i < 9; i++) if (row[i] === "#") { ctx.fillStyle = on ? (j < 2 && i < 4 ? "#ff8f99" : "#ff4d61") : "#2a2f4a"; ctx.fillRect(x + i * 3, y + j * 3, 3, 3); } }); }
  function drawMascot() {
    const bob = Math.sin(t * 3) * 2 + (mood === "joy" ? Math.abs(Math.sin(t * 14)) * -6 : 0), spr = SPR.mascot(mood === "idle" ? "idle" : mood, 0), sc = 3, w = spr.width * sc, h = spr.height * sc;
    ctx.save(); ctx.translate(86, COUNTER + 18 + bob); if (mood === "shock") ctx.rotate(Math.sin(t * 40) * .04); ctx.drawImage(spr, -w / 2, -h, w, h); ctx.restore();
  }
  function drawBubble() {
    const b = bubbles[0]; if (!b) return; ctx.font = `22px ${FONT_T}`; const w = Math.ceil(ctx.measureText(b.text).width) + 20, h = 28, x = clamp(30, 8, W - w - 8), y = 330;
    ctx.globalAlpha = clamp(Math.min(b.t / .12, (b.life - b.t) / .25, 1), 0, 1); ctx.fillStyle = "#050814"; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.fillStyle = "#f7f0d5"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#050814"; ctx.beginPath(); ctx.moveTo(x + 24, y + h + 3); ctx.lineTo(x + 52, y + h + 3); ctx.lineTo(x + 40, y + h + 18); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#f7f0d5"; ctx.beginPath(); ctx.moveTo(x + 28, y + h); ctx.lineTo(x + 48, y + h); ctx.lineTo(x + 40, y + h + 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#101629"; ctx.textAlign = "left"; ctx.fillText(b.text, x + 10, y + 21); ctx.globalAlpha = 1;
  }
  function render() {
    ctx.save(); if (shakeT > 0) ctx.translate(Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM)));
    ctx.drawImage(bg, 0, 0);
    for (const s of stains) { ctx.globalAlpha = clamp(1 - s.t / s.life, 0, 1) * .55; ctx.fillStyle = s.color; s.sq.forEach(q => ctx.fillRect(Math.round(s.x + q.dx), Math.round(s.y + q.dy), q.s, q.s)); } ctx.globalAlpha = 1;
    if (libertadT > 0) { ctx.fillStyle = `rgba(255,211,78,${(.1 + .06 * Math.sin(t * 8)).toFixed(2)})`; ctx.fillRect(0, 0, W, H); }
    drawMascot();
    for (const p of pieces) drawSprite(p.img, p.x, p.y, p.rot);
    for (const it of items) {
      if (it.kind === "fruit") drawSprite(SPR.fruit(it.type), it.x, it.y, it.rot);
      else if (it.kind === "bomb") drawSprite(SPR.bomb(Math.floor(t * 12) % 2), it.x, it.y, it.rot * .3);
      else { ctx.fillStyle = `rgba(255,211,78,${(.22 + .12 * Math.sin(t * 8)).toFixed(2)})`; ctx.beginPath(); ctx.arc(it.x, it.y, 40, 0, 7); ctx.fill(); drawSprite(SPR.power(it.type), it.x, it.y, Math.sin(t * 4) * .2); }
    }
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    ctx.drawImage(counterImg, 0, COUNTER - 14);
    ctx.restore();
    // tajo
    if (blade.length > 1) { for (let i = 1; i < blade.length; i++) { const a = blade[i - 1], b = blade[i], age = clamp(1 - (t - b.t) / .16, 0, 1); ctx.strokeStyle = `rgba(49,215,199,${(age * .6).toFixed(2)})`; ctx.lineWidth = 9 * age + 2; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.strokeStyle = `rgba(255,255,255,${age.toFixed(2)})`; ctx.lineWidth = 4 * age + 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
    if (kb.on) { ctx.strokeStyle = "#ffd34e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(kb.x, kb.y, 12, 0, 7); ctx.moveTo(kb.x - 18, kb.y); ctx.lineTo(kb.x + 18, kb.y); ctx.moveTo(kb.x, kb.y - 18); ctx.lineTo(kb.x, kb.y + 18); ctx.stroke(); }
    drawBubble();
    for (const f of floats) { ctx.globalAlpha = clamp(1.7 - f.t / f.life * 1.7 + .2, 0, 1); outlinedText(f.text, f.x, f.y, f.color, `24px ${FONT_T}`); } ctx.globalAlpha = 1;
    // estado superior
    if (mode === "classic") for (let i = 0; i < 3; i++) drawHeart(14 + i * 34, 12, i < lives);
    if (slowT > 0) { ctx.fillStyle = "rgba(255,179,71,.14)"; ctx.fillRect(0, 0, W, H); outlinedText(`CAÑA ${slowT.toFixed(1)}`, W - 14, 30, "#ffb347", `22px ${FONT_T}`, "right"); }
    if (libertadT > 0) outlinedText(`LIBERTAD x2 ${libertadT.toFixed(1)}`, W - 14, slowT > 0 ? 54 : 30, "#ffd34e", `22px ${FONT_T}`, "right");
    if (prensaT > 0) outlinedText(`RUEDA DE PRENSA ${prensaT.toFixed(1)}`, W - 14, 30 + (slowT > 0 ? 24 : 0) + (libertadT > 0 ? 24 : 0), "#31d7c7", `22px ${FONT_T}`, "right");
    if (flashT > 0) { ctx.fillStyle = `rgba(255,240,200,${(flashT * 2).toFixed(2)})`; ctx.fillRect(0, 0, W, H); }
    if (bannerT > 0) { ctx.globalAlpha = clamp(bannerT / .5, 0, 1); outlinedText(bannerText, W / 2, 190, "#ffd34e", `${bannerText.length > 16 ? 14 : 22}px ${FONT_PX}`); ctx.globalAlpha = 1; }
  }

  /* ----------------------------------------------------------------- bucle */
  function frame(now) {
    if (!last) last = now; const dt = clamp((now - last) / 1000, 0, .1); last = now;
    if (state === "playing") { acc += dt; let n = 0; while (acc >= FIXED && n++ < 12) { update(FIXED); acc -= FIXED; } if (n >= 12) acc = 0; }
    render(); requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------------------- entrada */
  const toLogical = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
  canvas.addEventListener("pointerdown", e => { if (state !== "playing") return; e.preventDefault(); safe(() => canvas.setPointerCapture(e.pointerId)); const p = toLogical(e); pointer = { down: true, x: p.x, y: p.y, lx: p.x, ly: p.y, lt: performance.now() }; blade.push({ x: p.x, y: p.y, t }); strokeCount = 0; kb.on = false; });
  canvas.addEventListener("pointermove", e => {
    if (!pointer.down || state !== "playing") return; const p = toLogical(e), now = performance.now(), len = Math.hypot(p.x - pointer.lx, p.y - pointer.ly), dtp = Math.max(1, now - pointer.lt);
    if (len >= 4) { blade.push({ x: p.x, y: p.y, t }); if (len / dtp * 1000 > 220) sliceAt(pointer.lx, pointer.ly, p.x, p.y); pointer.lx = p.x; pointer.ly = p.y; pointer.lt = now; }
  });
  ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { pointer.down = false; strokeCount = 0; }));
  addEventListener("keydown", e => {
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "playing") pauseScreen(); else if (state === "paused") resume(); return; }
    if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) { if (state === "playing" || state === "paused") play(mode); return; }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code) && state === "playing") { e.preventDefault(); if (!kb.on) { kb.on = true; kb.x = pointer.x; kb.y = pointer.y; } kb.keys.add(e.code); }
  });
  addEventListener("keyup", e => kb.keys.delete(e.code));
  addEventListener("blur", () => { kb.keys.clear(); pointer.down = false; if (state === "playing") pauseScreen(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseScreen(); });
  UI.pause.addEventListener("click", () => state === "paused" ? resume() : pauseScreen());
  UI.restart.addEventListener("click", () => { if (state !== "title") play(mode); });
  UI.sound.addEventListener("click", () => { soundOn = !soundOn; store.set("mf-sound", soundOn ? "1" : "0"); AUD.setOn(soundOn); paintSound(); if (soundOn) { sfx.combo(3); if (state === "playing") music.start(round); } });

  /* ------------------------------------------------------------------ inicio */
  AUD.setOn(soundOn); paintSound(); reset("classic"); titleScreen(); fixAccents(document.querySelector(".cabinet header")); fixAccents(document.querySelector(".hud"));
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('22px "VT323"')]).then(() => buildBg()).catch(() => {});
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, mode, kilos, round, lives, time: Math.round(timeLeft), items: items.length, pieces: pieces.length, slow: +slowT.toFixed(1), lib: +libertadT.toFixed(1), prensa: +prensaT.toFixed(1), missed, bombs: bombsHit, combo: comboMax });
    window.__mf = {
      step: (n = 1, dt = FIXED, draw = true) => { for (let i = 0; i < n; i++) update(dt); if (draw) render(); return snap(); }, snap, play, title: titleScreen,
      swipe: pts => { for (let i = 1; i < pts.length; i++) { blade.push({ x: pts[i].x, y: pts[i].y, t }); sliceAt(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y); } return snap(); },
      items: () => items.map(i => ({ k: i.kind, ty: i.type, x: Math.round(i.x), y: Math.round(i.y), vy: Math.round(i.vy) })),
      spawn: (kind, type, x, y, vx, vy) => { items.push({ kind, type, x, y, vx, vy, rot: 0, vr: 0, r: kind === "fruit" ? 26 : 28, alive: true, age: 0 }); }, wave: spawnWave, power: spawnPower, render, setRound: n => { round = n; buildBg(); }, over: () => { cause = "podrida"; gameOver(); }
    };
  }
})();
