"use strict";
/* Bandera XXL — Sanxe Games.
   Apilador satírico: el Jinete de la plaza quiere izar la bandera más grande del país. Cuadra cada bloque del pedestal sobre el anterior:
   lo que sobresale se cae (y el Ayuntamiento multa), los perfectos recuperan anchura y, a la sexta racha, el caballo echa a galopar. */
(() => {
  const AUD = window.BX_AUD, sfx = AUD.sfx, music = AUD.music;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, "0");
  const euros = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const safe = (fn, fb = null) => { try { return fn(); } catch { return fb; } };
  const store = { get: k => safe(() => localStorage.getItem(k)), set: (k, v) => safe(() => localStorage.setItem(k, v)) };
  const DEBUG = /[?&]debug/.test(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = $("#game"), ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = 800, H = 600, FIXED = 1 / 120;
  const BH = 22, BASE_W = 200, START_W = 190, MAX_W = 230, METERS = 2.2, STAGE_N = 15, GROUND_Y = 500, GALLOP_AT = 6;
  const STAGES = [
    { name: "LA ROTONDA", sub: "Empieza la obra. Sin licencia, pero con ganas.", sky: ["#6bb7ff", "#cfeeff"] },
    { name: "LA PLAZA", sub: "Ya se ve desde el Ayuntamiento.", sky: ["#ff8a5a", "#ffd9a0"] },
    { name: "LA CIUDAD", sub: "De noche también se iza.", sky: ["#0b1030", "#27345b"] },
    { name: "LA ESTRATOSFERA", sub: "Los aviones piden paso.", sky: ["#05030f", "#1a0f3a"] },
    { name: "LA LUNA", sub: "Que se vea desde la Tierra.", sky: ["#02020a", "#0c0c24"] }
  ];
  const LANDMARKS = [[9, "UNA FAROLA MUNICIPAL", "FAROLA"], [21, "EL EDIFICIO DEL AYUNTAMIENTO", "AYUNTAMIENTO"], [50, "LA BANDERA DE LA PLAZA DE COLÓN", "PLAZA DE COLÓN"], [100, "LA TORRE DE LA CATEDRAL", "CATEDRAL"], [157, "LA TORRE PICASSO", "TORRE PICASSO"], [330, "LA TORRE EIFFEL", "TORRE EIFFEL"], [828, "EL BURJ KHALIFA", "BURJ KHALIFA"]];
  const PERFECT_SAY = ["¡Así se iza!", "¡Ni un milímetro de más!", "Eso es construir país. Y rotonda.", "¡Perfecto! Y sin permisos.", "¡Más bandera, más pedestal!", "Esto no lo discute ni la Agenda 2030."];
  const CUT_SAY = ["Eso estaba torcido. Culpa del Ayuntamiento.", "Un trozo menos, una bandera más grande.", "¡Chiringuito! Se me ha caído un chiringuito.", "Si no cuadra, que cuadre el Ayuntamiento.", "Pérdida de hormigón: culpa de la Agenda 2030.", "Torcido, pero con orgullo."];
  const MILE_SAY = { 3: "Todo gran país empieza por una rotonda.", 6: "¿Más grande? Siempre más grande.", 10: "Esto ya es una rotonda con vistas.", 15: "Que se vea desde Bruselas. Y que se enteren.", 20: "Que la sombra de la bandera tape el Ayuntamiento.", 25: "Mi bandera no cabe en el mapa.", 30: "¿Límite de altura? No consta.", 40: "Los aviones ya me saludan.", 50: "Cinco pisos más y llego a la Luna.", 60: "¡La Luna! Primera rotonda lunar." };
  const IDLE_SAY = ["La bandera pide pedestal.", "¡Que no falte hormigón!", "Más bandera, menos chiringuitos.", "Si no cabe en la rotonda, es que es pequeña.", "¿Una bandera más grande que la del vecino? Siempre.", "A mí que me pongan un cordón... pero de mástiles.", "Esa rotonda era mía."];
  const GALLOP_SAY = ["¡A galope tendido!", "¡Reconquistando la plaza!", "¡Arre, que nos vamos!"];
  const TICKER = ["ÚLTIMA HORA: EL AYUNTAMIENTO ABRE EXPEDIENTE A UNA BANDERA POR EXCESO DE BANDERA", "SE DISPARA LA VENTA DE MÁSTILES: AGOTADOS EN TODA LA PROVINCIA", "UN VECINO DENUNCIA QUE LA SOMBRA DE LA BANDERA LE TAPA EL SOL (Y LA TERRAZA)", "EL JINETE PIDE UNA ROTONDA PARA SU CABALLO", "FUENTES MUNICIPALES: «ESO NO LLEVA LICENCIA»", "LA FAROLA DE LA ROTONDA SOLICITA LA BAJA POR ESTRÉS", "LOS CHIRINGUITOS TIEMBLAN: NADIE SABE CUÁLES SON", "ENCUESTA: EL 100 % DE LAS ROTONDAS QUIERE BANDERA (NO SE LES HA PREGUNTADO)", "EL CABALLO NEGARÁ HABER OPINADO SOBRE LA AGENDA 2030"];
  const ADS = ["BANDERAS 2x1: SOLO HOY", "SE ALQUILA ROTONDA", "OBRA SIN LICENCIA, CON CARIÑO", "MÁS MÁSTIL POR MENOS", "AQUÍ PODRÍA IR SU BANDERA", "CHIRINGUITO: CAÑAS A 1 €"];
  const INSPECT = ["EXPEDIENTE", "¡SIN PERMISO!", "MULTA", "NO LLEVA LICENCIA"];

  const UI = { alt: $("#alt"), perf: $("#perf"), fine: $("#fine"), best: $("#best"), status: $("#game-status"), overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"), sound: $("#sound"), pause: $("#pause"), restart: $("#restart"), help: $("#game-help"), drop: $("#drop") };
  let state = "title", soundOn = store.get("bx-sound") !== "0", bestM = +store.get("bx-best") || 0;
  let blocks = [], slab = null, pieces = [], particles = [], floats = [], bubble = null, banner = null, drones = [];
  let t = 0, acc = 0, last = 0, n = 0, score = 0, combo = 0, bestCombo = 0, gust = 0, gallop = 0, fines = 0, cuts = 0, camY = 0, prog = 0, shakeT = 0, shakeM = 0, flashT = 0, flashCol = "#fff", quipT = 6, endT = 0, spawnDir = 1, perfects = 0, droneT = 12, landIdx = 0, hint = 1;
  const alt = () => Math.floor(n * METERS);

  /* ------------------------------------------------------------ escenario fijo */
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const SKYLINE = Array.from({ length: 22 }, (_, i) => ({ x: i * 40 - 20 + rng() * 14, w: 30 + rng() * 26, h: 50 + rng() * 120, win: rng() }));
  const STARS = Array.from({ length: 80 }, () => ({ x: rng() * W, y: rng() * H, r: rng() < .2 ? 2 : 1, ph: rng() * 6 }));
  const CLOUDS = Array.from({ length: 9 }, () => ({ x: rng() * W, y: rng() * 900, s: .8 + rng() * 1.4, v: 6 + rng() * 10 }));
  const CROWD = Array.from({ length: 13 }, (_, i) => ({ x: 24 + i * 58 + rng() * 18, c: ["#c8323f", "#2b6cff", "#3cff7a", "#ffd34e", "#dfe3ee"][i % 5], f: rng() < .55, h: rng() < .5 }));
  let adIdx = 0, planeX = -400, planeAd = ADS[0];

  /* --------------------------------------------------------------- partida */
  function speedNow() { const w = slab ? slab.w : START_W; let v = Math.min(370, 150 + n * 7) * (w < 50 ? .82 : 1); if (gust > 0) v *= 1.22 + .12 * Math.sin(t * 3); if (gallop > 0) v *= .55; return v; }
  function newSlab() { const top = blocks[blocks.length - 1], w = top.w; spawnDir = -spawnDir; slab = { x: spawnDir > 0 ? 30 : W - 30 - w, w, dir: spawnDir, idx: blocks.length }; }
  const colorFor = i => i === 0 ? "#8d98b8" : (i % 2 ? "#c8323f" : "#ffd34e");
  function reset() {
    blocks = [{ x: (W - BASE_W) / 2, w: BASE_W, col: colorFor(0) }]; pieces = []; particles = []; floats = []; drones = []; bubble = null; banner = null; n = 0; score = 0; combo = 0; bestCombo = 0; perfects = 0; gust = 0; gallop = 0; fines = 0; cuts = 0; camY = 0; prog = 0; endT = 0; spawnDir = 1; quipT = 6; droneT = rnd(10, 16); landIdx = 0; hint = 1; planeX = -500; adIdx = 0; planeAd = ADS[0];
    slab = { x: 30, w: START_W, dir: 1, idx: 1 };
    showBanner("LA ROTONDA", STAGES[0].sub); updateHud();
  }
  function updateHud() { UI.alt.textContent = alt(); UI.perf.textContent = combo; UI.fine.textContent = euros(fines); UI.best.textContent = Math.max(bestM, alt()); }
  const setControls = () => { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; UI.drop.disabled = state !== "playing"; };
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };

  /* ---------------------------------------------------------------- pantallas */
  function showOverlay({ stamp = "SÁTIRA PIXELADA", title, text = "", extra = "", actions = [], help = false, side = false }) {
    UI.overlay.classList.toggle("side", side);
    UI.help.hidden = !help; UI.stamp.textContent = stamp; UI.title.textContent = title; UI.text.textContent = text; UI.text.hidden = !text;
    if (typeof extra === "string") UI.extra.innerHTML = extra; else { UI.extra.innerHTML = ""; UI.extra.appendChild(extra); }
    UI.actions.innerHTML = "";
    actions.forEach((a, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a.secondary ? " secondary" : ""); b.textContent = a.label; b.addEventListener("click", a.fn); UI.actions.appendChild(b); if (i === 0) requestAnimationFrame(() => b.focus()); });
    UI.overlay.classList.remove("hidden"); fixAccents(UI.overlay);
  }
  const hideOverlay = () => UI.overlay.classList.add("hidden");
  const goHome = () => { location.href = "../"; };
  function posterNode() {
    const box = document.createElement("div"); box.className = "ficha";
    const cv = document.createElement("canvas"); cv.width = 176; cv.height = 104; cv.setAttribute("aria-hidden", "true"); const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    g.fillStyle = "#c8323f"; g.fillRect(0, 0, 176, 104); g.fillStyle = "#ffd34e"; g.fillRect(0, 26, 176, 52);
    g.fillStyle = "rgba(0,0,0,.12)"; for (let i = 0; i < 12; i++) g.fillRect(i * 16, 0, 8, 104);
    g.fillStyle = "#6bb7ff"; g.fillRect(0, 0, 0, 0);
    g.fillStyle = "#8a8f9e"; g.fillRect(0, 88, 176, 16); g.fillStyle = "#5a5f78"; g.fillRect(0, 88, 176, 2);
    g.save(); g.translate(88, 90); g.scale(1.55, 1.55); drawHorse(g, 0, false); g.restore();
    g.strokeStyle = "#050814"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 173, 101);
    box.appendChild(cv);
    const dl = document.createElement("dl");
    [["CANDIDATO", "EL JINETE"], ["MONTURA", "UN CABALLO CON OPINIONES"], ["LEMA", "«MÁS BANDERA»"], ["ENEMIGO", "LOS CHIRINGUITOS (NO SABE CUÁLES)"], ["SUPERPODER", "SACAR UNA BANDERA DE LA MANGA"], ["DEBILIDAD", "LAS ROTONDAS MUNICIPALES"]].forEach(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
    box.appendChild(dl); return box;
  }
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    showOverlay({ help: true, stamp: "OBRA PÚBLICA, SIN LICENCIA", title: "BANDERA XXL", text: `«Si no cabe en la rotonda, es que es pequeña.» Apila el pedestal bloque a bloque: lo que sobresale, se cae... y el Ayuntamiento multa.${bestM ? ` Récord: ${bestM} m.` : ""}`, extra: posterNode(), actions: [{ label: "EMPEZAR LA OBRA", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function play() { state = "playing"; reset(); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(0); UI.status.textContent = "Suelta cada bloque justo encima del anterior."; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now(); }
  function pauseScreen() { if (state !== "playing") return; state = "paused"; setControls(); music.pause(true); showOverlay({ help: true, stamp: "OBRA PARADA", title: "PAUSA", text: "El Ayuntamiento aprovecha para inspeccionar el pedestal.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR", secondary: true, fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] }); }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function showOver() {
    state = "over"; setControls(); music.stop(); const m = alt(), nb = m > bestM; if (nb) { bestM = m; store.set("bx-best", String(bestM)); sfx.best(); } else sfx.over(); updateHud(); setTimeout(() => sfx.sello(), 350);
    const passed = LANDMARKS.filter(([h]) => m >= h).pop(), total = fines + 5000;
    const sub = passed ? `MÁS ALTA QUE ${passed[1]}` : "ALTURA INSUFICIENTE PARA EL ORGULLO";
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    UI.status.textContent = `Fin de la obra: ${m} metros. Multa total: ${euros(total)} euros.`;
    showOverlay({
      side: true, stamp: `${m} METROS · ${STAGES[Math.min(4, Math.floor(n / STAGE_N))].name}`, title: sub, text: "",
      extra: `<div class="acta"><b>AYUNTAMIENTO · EXPEDIENTE Nº ${2000 + n}/XXL</b><dl>${row("OBRA", "BANDERA XXL SIN LICENCIA")}${row("ALTURA", `${m} m${nb ? " (¡RÉCORD!)" : ` · RÉCORD ${bestM} m`}`)}${row("BLOQUES", `${n} (${cuts} TORCIDOS)`)}${row("PERFECTOS", `${perfects} · RACHA ${bestCombo}`)}${row("MULTAS", `${euros(fines)} €`)}${row("CAÍDA", "5.000 €")}${row("TOTAL", `<u>${euros(total)} €</u>`)}${row("PAGA", "EL AYUNTAMIENTO (O SEA, USTED)")}</dl><i class="sello">SIN LICENCIA</i></div>`,
      actions: [{ label: "OTRA OBRA", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }]
    });
  }

  /* ------------------------------------------------------------------ efectos */
  const shake = (m, d = .25) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, d); };
  const flash = (c = "#fff", d = .14) => { if (!reduced) { flashT = d; flashCol = c; } };
  const say = (text, life = 2.4) => { bubble = { text, t: 0, life }; };
  const showBanner = (text, sub, life = 2.8) => { banner = { text, sub, t: 0, life }; };
  const float = (x, y, text, color, life = 1.2) => floats.push({ x, y, text, color, t: 0, life });
  function burst(x, y, colors, k = 12, sp = 220) { for (let i = 0; i < k; i++) { const a = rnd(-3.14, 0), v = rnd(.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(.5, 1), color: pick(colors), s: pick([3, 4, 5]), g: 600 }); } }

  /* ------------------------------------------------------------------ jugada */
  function drop() {
    if (state !== "playing" || !slab) return;
    hint = 0; const top = blocks[blocks.length - 1], tol = clamp(speedNow() * .03, 6, 12);
    const left = Math.max(slab.x, top.x), right = Math.min(slab.x + slab.w, top.x + top.w), ov = right - left, y = -(blocks.length) * BH - BH / 2;
    sfx.drop();
    if (ov <= 4) {    // fallo total
      pieces.push({ x: slab.x, w: slab.w, y: -(blocks.length) * BH, vy: 0, vx: slab.dir * 40, rot: 0, vr: slab.dir * 1.6, col: colorFor(blocks.length) }); slab = null; sfx.fall(); shake(5, .4); combo = 0; gallop = 0; startEnding(); return;
    }
    let b;
    if (Math.abs(slab.x - top.x) <= tol) {   // perfecto
      combo++; perfects++; bestCombo = Math.max(bestCombo, combo); b = { x: top.x, w: slab.w, col: colorFor(blocks.length) };
      const gain = 10 + Math.min(combo, 8) * 10; if (combo >= 3 && b.w < MAX_W) { const nw = Math.min(MAX_W, b.w + 12); b.x -= (nw - b.w) / 2; b.w = nw; sfx.widen(); float(W / 2, y - 60, "¡PEDESTAL MÁS ANCHO!", "#3cff7a", 1.3); }
      score += gain; sfx.perfect(combo); float(b.x + b.w / 2, y - 14, `PERFECTO +${gain}`, "#ffd34e", 1.1); burst(b.x + b.w / 2, y, ["#c8323f", "#ffd34e", "#f7f0d5"], 14); flash("#ffd34e", .1); shake(2, .12);
      if (combo > 0 && combo % GALLOP_AT === 0) { gallop = 3; sfx.galope(); showBanner("¡A PASO DE CABALLO!", "Tres bloques a cámara lenta.", 2.2); say(pick(GALLOP_SAY), 2); flash("#ffffff", .2); }
      else if (combo === 1 || combo % 3 === 0) say(pick(PERFECT_SAY), 1.8);
    } else {                                  // recorte y multa
      const cutW = slab.w - ov; b = { x: left, w: ov, col: colorFor(blocks.length) }; const goLeft = slab.x < top.x, fine = Math.round(cutW * 12);
      pieces.push({ x: goLeft ? slab.x : right, w: cutW, y: -(blocks.length) * BH, vy: 0, vx: (goLeft ? -1 : 1) * 60, rot: 0, vr: (goLeft ? -1 : 1) * 1.8, col: colorFor(blocks.length) });
      sfx.cut(); score += 10; combo = 0; cuts++; fines += fine; shake(3, .18); burst(left + ov / 2, y, ["#8d98b8", "#f7f0d5"], 6, 120); float(goLeft ? slab.x : right, y - 30, `MULTA -${euros(fine)} €`, "#ff4d61", 1.2); if (cutW > 60 && Math.random() < .5) say(pick(CUT_SAY), 2.2);
    }
    if (gallop > 0) gallop--;
    blocks.push(b); n++;
    const st = Math.floor(n / STAGE_N); if (st > Math.floor((n - 1) / STAGE_N) && st <= 4) { sfx.stage(); showBanner(STAGES[st].name, STAGES[st].sub); flash("#ffffff", .25); music.setLevel(st); }
    const m = alt(); while (landIdx < LANDMARKS.length && m >= LANDMARKS[landIdx][0]) { sfx.hito(); float(W / 2, -n * BH - 100, `¡MÁS ALTA QUE ${LANDMARKS[landIdx][1]}!`, "#3cff7a", 2.2); landIdx++; }
    if (MILE_SAY[n]) say(MILE_SAY[n], 2.6);
    if (n >= 8 && n % 10 === 8 && gust <= 0) { gust = 4; showBanner("¡RÁFAGA DE AGENDA 2030!", "Dicen que es el viento. Yo sospecho."); sfx.gust(); }
    else if (gust > 0 && (--gust) === 0) say("Ya amainó. Sigo sospechando.", 1.8);
    updateHud(); newSlab();
  }
  function startEnding() { state = "ending"; endT = 0; setControls(); music.stop(); }

  /* ------------------------------------------------------------- simulación */
  function stepFx(dt) {
    for (const p of particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } particles = particles.filter(p => p.t < p.life);
    for (const f of floats) { f.t += dt; f.y -= 28 * dt; } floats = floats.filter(f => f.t < f.life);
    for (const p of pieces) { p.vy += 900 * dt; p.y += p.vy * dt; p.x += p.vx * dt; p.rot += p.vr * dt; } pieces = pieces.filter(p => p.y < 900);
    for (const d of drones) { d.x += d.v * dt; d.t += dt; if (!d.fined && d.x > d.fineAt) { d.fined = true; } } drones = drones.filter(d => d.x < W + 200);
    if (bubble) { bubble.t += dt; if (bubble.t > bubble.life) bubble = null; }
    if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; }
    shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt);
    planeX += 62 * dt; if (planeX > W + 700) { planeX = -520; adIdx = (adIdx + 1) % ADS.length; planeAd = ADS[adIdx]; }
  }
  const camTarget = () => Math.max(0, blocks.length * BH - 200);
  function update(dt) {
    t += dt; stepFx(dt);
    prog += (clamp(n / STAGE_N, 0, 4) - prog) * Math.min(1, dt * 1.8);
    if (state === "playing") {
      camY += (camTarget() - camY) * Math.min(1, dt * 6);
      if (slab) { const v = speedNow(); slab.x += slab.dir * v * dt; const lo = 30, hi = W - 30 - slab.w; if (slab.x < lo) { slab.x = lo; slab.dir = 1; } else if (slab.x > hi) { slab.x = hi; slab.dir = -1; } }
      quipT -= dt; if (quipT <= 0 && !bubble) { quipT = rnd(9, 14); say(pick(IDLE_SAY)); }
      droneT -= dt; if (droneT <= 0 && n >= 3) { droneT = rnd(16, 24); const f = pick(INSPECT); drones.push({ x: -80, y: 120 + rnd(0, 60), v: 95, t: 0, text: f, fineAt: 300, fined: false }); sfx.sirena(); }
    } else if (state === "ending") {
      endT += dt; camY += (camTarget() - camY) * Math.min(1, dt * 6);
      if (endT > 2.6) showOver();
    }
  }
  const sway = idx => { const amp = Math.min(4, n * .07), rel = idx / Math.max(1, blocks.length); return reduced ? 0 : Math.round(Math.sin(t * .9 + idx * .05) * amp * rel); };

  /* ----------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function outlinedText(txt, x, y, color, font, align = "center") { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814"; [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y); }
  const hx = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, f) => { const A = hx(a), B = hx(b); return "#" + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * f).toString(16).padStart(2, "0")).join(""); };
  const gr = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  /* El Jinete: pelo oscuro, barba larga y negra, bigote, chaqueta verde de campo. mood 0 normal, 1 hablando */
  function drawBeard(g, mood = 0) {
    const B = (c, x, y, w, h) => gr(g, c, x, y, w, h);
    B("#050814", -15, 3, 30, 22); B("#050814", -13, -28, 26, 32);                    // contorno
    B("#2d6a3a", -14, 8, 28, 16); B("#1f4a29", -14, 8, 6, 16); B("#1f4a29", 8, 8, 6, 16); B("#3d8a4b", -8, 10, 2, 12); B("#f7f0d5", -4, 8, 8, 4); B("#8d98b8", -2, 12, 4, 2);
    B("#1f4a29", -13, 5, 26, 5); B("#c8323f", 8, 13, 5, 1); B("#ffd34e", 8, 14, 5, 2); B("#c8323f", 8, 16, 5, 1);   // cuello de pana y banderita en la solapa
    B("#efc3a0", -9, -20, 18, 8); B("#efc3a0", -10, -14, 20, 8); B("#efc3a0", -12, -16, 3, 5); B("#efc3a0", 9, -16, 3, 5); B("#d89d7c", -12, -15, 1, 3); B("#d89d7c", 11, -15, 1, 3);
    B("#2a1c14", -11, -29, 22, 10); B("#2a1c14", -12, -22, 4, 9); B("#2a1c14", 8, -22, 4, 9); B("#4a3326", -6, -29, 12, 2); B("#4a3326", -9, -26, 5, 1); B("#4a3326", 4, -27, 5, 1);
    B("#1a120e", -9, -18, 7, 3); B("#1a120e", 2, -18, 7, 3);                          // cejas gruesas
    B("#f7f0d5", -8, -14, 6, 3); B("#f7f0d5", 2, -14, 6, 3); B("#101629", -5, -14, 3, 3); B("#101629", 4, -14, 3, 3); B("#8d98b8", -9, -11, 8, 1); B("#8d98b8", 1, -11, 8, 1);
    B("#d89d7c", -1, -11, 3, 4);                                                      // nariz
    B("#1a120e", -12, -9, 24, 5); B("#1a120e", -11, -4, 22, 6); B("#1a120e", -9, 2, 18, 5); B("#1a120e", -6, 7, 12, 3);   // barba larga
    B("#3a2a22", -9, -2, 2, 1); B("#3a2a22", 6, 0, 2, 1); B("#3a2a22", -4, 5, 2, 1); B("#3a2a22", -10, -7, 2, 1);
    B("#2a1c14", -7, -8, 14, 3);                                                      // bigote
    if (mood) { B("#7a3f3a", -3, -4, 6, 3); B("#f7f0d5", -2, -4, 4, 1); } else B("#3a1f1a", -3, -4, 6, 1);
  }
  /* El caballo: con manta rojigualda y el Jinete a lomos, con bandera en mano. origen: pezuñas, centro. */
  function drawHorse(g, tt, gal) {
    const B = (c, x, y, w, h) => gr(g, c, x, y, w, h), bob = Math.round(Math.sin(tt * (gal ? 14 : 2.2)) * (gal ? 2 : 1)), step = gal ? Math.floor(tt * 10) % 2 : 0;
    B("rgba(0,0,0,.3)", -34, -2, 68, 4);
    B("#050814", -30, -34 + bob, 50, 24); B("#050814", 10, -52 + bob, 18, 20); B("#050814", 22, -50 + bob, 18, 12);
    B("#8a5a3b", -29, -33 + bob, 48, 21); B("#a8703a", -29, -33 + bob, 48, 5); B("#6b4423", -29, -17 + bob, 48, 5);
    B("#8a5a3b", 11, -51 + bob, 16, 19); B("#a8703a", 21, -49 + bob, 18, 10); B("#6b4423", 33, -45 + bob, 6, 5); B("#050814", 35, -48 + bob, 2, 2); B("#f7f0d5", 28, -47 + bob, 2, 2); B("#101629", 29, -47 + bob, 1, 2);
    B("#3a2418", 8, -52 + bob, 5, 20); B("#3a2418", 14, -55 + bob, 6, 5); B("#6b4423", 16, -55 + bob, 3, 4);
    const tail = Math.round(Math.sin(tt * (gal ? 12 : 3)) * 3); B("#3a2418", -35 + tail, -32 + bob, 7, 20);
    const lg = [[-26, 0], [-18, step], [8, 1 - step], [15, 0]]; lg.forEach(([lx, o]) => { B("#050814", lx - 1, -13 + bob, 8, 14 - o * 3); B("#6b4423", lx, -12 + bob, 6, 12 - o * 3); B("#2a1c14", lx, -2 - o * 3, 6, 2); });
    B("#c8323f", -18, -35 + bob, 28, 4); B("#ffd34e", -18, -31 + bob, 28, 5); B("#c8323f", -18, -26 + bob, 28, 4); B("#050814", -18, -22 + bob, 28, 1);   // manta
    g.save(); g.translate(-3, -50 + bob); g.scale(.85, .85); drawBeard(g, gal ? 1 : 0); g.restore();
    B("#d8dce8", 8, -86 + bob, 2, 34); B("#ffd34e", 7, -88 + bob, 4, 3);
    for (let i = 0; i < 10; i++) { const w = Math.round(Math.sin(tt * 6 - i * .5) * 2); B("#c8323f", 10 + i * 2, -85 + bob + w, 2, 3); B("#ffd34e", 10 + i * 2, -82 + bob + w, 2, 5); B("#c8323f", 10 + i * 2, -77 + bob + w, 2, 3); }
  }
  function drawBackground() {
    const p = clamp(prog, 0, 4), i = Math.min(3, Math.floor(p)), f = p - i, a = STAGES[i].sky, b = STAGES[Math.min(4, i + 1)].sky;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, mix(a[0], b[0], f)); g.addColorStop(1, mix(a[1], b[1], f)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const night = clamp((p - 1.4) / .9, 0, 1);
    if (night > 0) { for (const s of STARS) { ctx.globalAlpha = night * (.5 + .5 * Math.sin(t * 2 + s.ph)); R("#f7f0d5", s.x, s.y, s.r, s.r); } ctx.globalAlpha = 1; }
    if (p < 1.6) { ctx.globalAlpha = clamp(1.6 - p, 0, 1) * (p < 1 ? 1 : .8); ctx.fillStyle = p < 1 ? "#fff3a8" : "#ffb347"; ctx.beginPath(); ctx.arc(140, 130 + camY * .12 + clamp(p - .8, 0, 1) * 80, 36, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    if (p > 2.6) { const k = clamp((p - 2.6) / 1.6, 0, 1), r = 40 + k * 110, mx = 600 - k * 80, my = 190 + k * 40; ctx.fillStyle = "#d8dce8"; ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill(); ctx.fillStyle = "#aab4cf"; [[-.3, -.2, .2], [.35, .1, .15], [-.1, .4, .12], [.1, -.45, .1]].forEach(([dx, dy, rr]) => { ctx.beginPath(); ctx.arc(mx + dx * r, my + dy * r, rr * r, 0, 7); ctx.fill(); }); }
    const cl = clamp(1 - (p - 2.6) / 1.2, 0, 1);
    if (cl > 0) for (const c of CLOUDS) { const y = (((c.y + camY * .25) % 900) + 900) % 900 - 100, x = ((c.x + t * c.v) % (W + 200)) - 100; ctx.globalAlpha = cl * .85; const col = p > 1.2 ? "#4a3a6a" : "#ffffff"; R(col, x, y, 60 * c.s, 14 * c.s); R(col, x + 12 * c.s, y - 8 * c.s, 34 * c.s, 12 * c.s); ctx.globalAlpha = 1; }
    if (p < 2.4) {
      const by = GROUND_Y + camY * .55, col = mix(mix("#4a6a96", "#6a3f5a", clamp(p, 0, 1)), "#141c3a", clamp(p - 1, 0, 1)); ctx.globalAlpha = clamp(2.4 - p, 0, 1);
      for (const bd of SKYLINE) { R(col, bd.x, by - bd.h, bd.w, bd.h + 80); if (bd.win > .3) for (let wy = by - bd.h + 10; wy < by - 6; wy += 14) for (let wx = bd.x + 5; wx < bd.x + bd.w - 6; wx += 10) R(p > 1.3 && (wx + wy) % 3 ? "#ffd34e" : mix(col, "#ffffff", .15), wx, wy, 4, 6); }
      ctx.globalAlpha = 1;
    }
    if (p > .5 && p < 2.6) {     // globo aerostático rojigualdo
      const bx = 620 + Math.sin(t * .2) * 40, by = 300 + camY * .3 + Math.sin(t * .5) * 6; ctx.globalAlpha = clamp(Math.min(p - .5, 2.6 - p), 0, 1);
      R("#c8323f", bx - 22, by - 34, 44, 12); R("#ffd34e", bx - 26, by - 22, 52, 16); R("#c8323f", bx - 22, by - 6, 44, 12); R("#8a5a3b", bx - 8, by + 14, 16, 10); R("#050814", bx - 12, by + 6, 1, 8); R("#050814", bx + 11, by + 6, 1, 8); ctx.globalAlpha = 1;
    }
    if (p > .8 && p < 3.4) {     // avioneta con pancarta
      const px = planeX, py = 150 + Math.sin(t * .3) * 8, bw = 14 + planeAd.length * 9;
      ctx.globalAlpha = clamp(Math.min(p - .8, 3.4 - p) * 2, 0, 1);
      R("#e8e8f0", px, py, 34, 6); R("#e8e8f0", px + 10, py - 7, 14, 6); R("#c8323f", px + 28, py - 4, 6, 4); R("#e8e8f0", px - 8, py - 4, 8, 4); R("#8d98b8", px + 34, py + 1, 1, 14 * 0 + 4);
      R("#f7f0d5", px - 18 - bw, py - 8, bw, 18); R("#c8323f", px - 18 - bw, py - 8, bw, 2); R("#c8323f", px - 18 - bw, py + 8, bw, 2); R("#8d98b8", px - 18, py + 1, 10, 1);
      ctx.font = `17px ${FONT_T}`; ctx.textAlign = "center"; ctx.fillStyle = "#101629"; ctx.fillText(planeAd, px - 18 - bw / 2, py + 6); ctx.globalAlpha = 1;
    }
    if (p > 3) { const sx = ((t * 40 + 100) % (W + 200)) - 100, sy = 90 + sx * .15; R("#aab4cf", sx, sy, 10, 5); R("#31d7c7", sx - 8, sy, 6, 5); R("#31d7c7", sx + 12, sy, 6, 5); }
  }
  function drawGround() {
    R("#8a8f9e", -W * 2, 0, W * 5, 140); for (let x = -W * 2; x < W * 3; x += 50) for (let yy = 0; yy < 140; yy += 28) if (((x / 50 | 0) + (yy / 28 | 0)) % 2) R("#7a7f90", x, yy, 50, 28);
    R("#5a5f78", -W * 2, 0, W * 5, 4); R("#3a3f58", -W * 2, 4, W * 5, 2);
    // señal de rotonda y farola
    R("#8d98b8", 706, -52, 3, 52); R("#050814", 692, -78, 31, 30); R("#2b6cff", 694, -76, 27, 26); ctx.strokeStyle = "#f7f0d5"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(707, -63, 7, .4, 5.7); ctx.stroke(); R("#c8323f", 704, -66, 7, 2); R("#ffd34e", 704, -64, 7, 3); R("#c8323f", 704, -61, 7, 2);
    R("#3a3f58", 76, -60, 4, 60); R("#3a3f58", 70, -62, 16, 3); R("#ffe38a", 66, -58, 10, 4);
    for (const c of CROWD) { const bob = Math.round(Math.sin(t * 3 + c.x) * 1.5); R("#050814", c.x - 4, 8 + bob, 10, 18); R(c.c, c.x - 3, 10 + bob, 8, 10); R("#efc3a0", c.x - 2, 4 + bob, 6, 6); if (c.h) R("#3a2418", c.x - 2, 3 + bob, 6, 2); if (c.f) { R("#8d98b8", c.x + 6, -6 + bob, 1, 16); R("#c8323f", c.x + 7, -6 + bob, 7, 2); R("#ffd34e", c.x + 7, -4 + bob, 7, 3); R("#c8323f", c.x + 7, -1 + bob, 7, 2); } }
    ctx.save(); ctx.translate(170, 10); ctx.scale(1.35, 1.35); drawHorse(ctx, t, gallop > 0); ctx.restore();
  }
  function drawBlock(b, idx, ghost) {
    const sx = sway(idx), x = b.x + sx, y = -(idx + 1) * BH, st = Math.min(4, Math.floor(idx / STAGE_N));
    ctx.globalAlpha = ghost ? .92 : 1;
    R("#050814", x - 2, y - 1, b.w + 4, BH + 2); R(b.col, x, y, b.w, BH - 1);
    R("rgba(255,255,255,.35)", x, y, b.w, 3); R("rgba(0,0,0,.28)", x, y + BH - 5, b.w, 4);
    if (idx === 0) { R("#5a5f78", x, y + 4, b.w, 2); R("#f7f0d5", x + b.w / 2 - 22, y + 8, 44, 8); }
    else if (st === 0) { for (let k = 10; k < b.w - 8; k += 26) { R("rgba(0,0,0,.18)", x + k, y + 7, 12, 6); R("rgba(255,255,255,.2)", x + k, y + 7, 12, 1); } R("rgba(0,0,0,.35)", x + 3, y + 4, 2, 2); R("rgba(0,0,0,.35)", x + b.w - 5, y + 4, 2, 2); }
    else if (st === 1) { R("rgba(255,255,255,.28)", x + 2, y + 5, b.w - 4, 2); for (let k = 6; k < b.w - 6; k += 18) R("rgba(255,255,255,.3)", x + k, y + 8, 3, BH - 12); R("rgba(0,0,0,.2)", x, y + 10, b.w, 1); }
    else if (st === 2) { R("#31d7c7", x + 2, y + 5, b.w - 4, 2); R("#ff4db8", x + 2, y + BH - 8, b.w - 4, 1); for (let k = 8; k < b.w - 8; k += 22) R("rgba(255,255,255,.4)", x + k, y + 9, 8, 3); }
    else if (st === 3) { ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < b.w; k += 14) { ctx.moveTo(x + k, y + BH - 5); ctx.lineTo(x + k + 7, y + 4); ctx.lineTo(x + k + 14, y + BH - 5); } ctx.stroke(); }
    else { for (let k = 0; k < b.w; k += 11) R("rgba(0,0,0,.25)", x + ((k * 7 + idx * 13) % b.w), y + 4 + (k * 3) % 11, 3, 2); R("rgba(255,255,255,.18)", x + 6, y + 8, b.w - 12, 1); }
    ctx.globalAlpha = 1;
  }
  function drawFlag(px, py) {
    const ph = 64 + Math.min(60, n * 1.1), fw = 56 + Math.min(120, n * 2.4), fh = 36 + Math.min(84, n * 1.6), top = py - ph, wind = (gust > 0 ? 1 : .35) + (gallop > 0 ? .3 : 0), cols = Math.ceil(fw / 3);
    R("#050814", px - 2, top - 2, 5, ph + 2); R("#d8dce8", px - 1, top, 3, ph); R("#ffd34e", px - 3, top - 5, 7, 6);
    for (let i = 0; i < cols; i++) {
      const u = i / cols, w = Math.sin(t * (5 + wind * 5) - u * 6) * (1.5 + u * (3 + wind * 6)), x = px + 2 + i * 3, y0 = top + 3 + w, shade = Math.cos(t * (5 + wind * 5) - u * 6) > .3;
      R(shade ? "#a8232f" : "#c8323f", x, y0, 3, fh * .25 + .5); R(shade ? "#e0b030" : "#ffd34e", x, y0 + fh * .25, 3, fh * .5 + .5); R(shade ? "#a8232f" : "#c8323f", x, y0 + fh * .75, 3, fh * .25 + .5);
      if (fw >= 84 && i >= 3 && i < 8) { const cy = y0 + fh * .5, k = i - 3; R("#7a4a22", x, cy - 8, 3, 16); if (k > 0 && k < 4) { R(k % 2 ? "#c8323f" : "#2b3a86", x, cy - 5, 3, 6); R("#ffd34e", x, cy + 1, 3, 3); } R("#ffd34e", x, cy - 10, 3, 2); }
    }
    R("rgba(5,8,20,.5)", px + 2, top + 3, fw, 1);
  }
  function drawDrone(d) {
    const x = Math.round(d.x), y = Math.round(d.y + Math.sin(d.t * 4) * 4), r = Math.floor(d.t * 30) % 2;
    R("#050814", x - 16, y - 8, 32, 14); R("#8d98b8", x - 14, y - 6, 28, 10); R("#c8323f", x - 4, y - 6, 8, 3); R("#31d7c7", x + 10, y - 4, 3, 3);
    R("#050814", x - 22, y - 12, 14, 3); R("#050814", x + 8, y - 12, 14, 3); R(r ? "#aab4cf" : "#5a5f78", x - 22, y - 13, 14, 1); R(r ? "#5a5f78" : "#aab4cf", x + 8, y - 13, 14, 1);
    R("#8d98b8", x - 1, y + 4, 2, 10); R("#050814", x - 14, y + 14, 28, 24); R("#f7f0d5", x - 12, y + 16, 24, 20); R("#c8323f", x - 12, y + 16, 24, 3);
    ctx.font = `14px ${FONT_T}`; ctx.textAlign = "center"; ctx.fillStyle = "#101629"; ctx.fillText(d.text.length > 10 ? "AYTO." : d.text, x, y + 31);
    if (d.text.length > 10) outlinedText(d.text, x, y - 20, "#ffd34e", `18px ${FONT_T}`);
  }
  function drawHud() {
    // altímetro lateral con hitos
    const x = 772, y0 = 100, y1 = 470, m = alt(); let prev = 0, nxt = null, pn = "SUELO"; for (const [h, , sn] of LANDMARKS) { if (m >= h) { prev = h; pn = sn; } else { nxt = [h, sn]; break; } }
    const frac = nxt ? clamp((m - prev) / (nxt[0] - prev), 0, 1) : 1;
    R("rgba(5,8,20,.55)", x - 12, y0 - 40, 36, y1 - y0 + 70); R("#050814", x - 4, y0, 16, y1 - y0); R("#17213c", x - 2, y0 + 2, 12, y1 - y0 - 4);
    const fh = (y1 - y0 - 4) * frac; R(frac >= 1 ? "#3cff7a" : "#ffd34e", x - 2, y1 - 2 - fh, 12, fh);
    for (let k = 0; k < 5; k++) R("#050814", x - 4, y0 + k * (y1 - y0) / 5, 16, 1);
    R("#d8dce8", x + 4, y1 - 2 - fh - 8, 1, 10); R("#c8323f", x + 5, y1 - 2 - fh - 8, 7, 2); R("#ffd34e", x + 5, y1 - 2 - fh - 6, 7, 3);
    ctx.font = `16px ${FONT_T}`; ctx.textAlign = "right"; ctx.fillStyle = "#050814"; ctx.fillText(nxt ? `${nxt[0]} m` : "∞", x + 21, y0 - 24); ctx.fillStyle = "#ffd34e"; ctx.fillText(nxt ? `${nxt[0]} m` : "∞", x + 20, y0 - 25);
    ctx.font = `15px ${FONT_T}`; ctx.fillStyle = "#f7f0d5"; ctx.fillText(nxt ? nxt[1] : "SIN LÍMITE", x + 20, y0 - 9);
    ctx.fillStyle = "#aab4cf"; ctx.fillText(pn === "SUELO" ? "0 m" : `${prev} m`, x + 20, y1 + 16);
    // racha
    const bx = 14, by = 536; ctx.font = `16px ${FONT_T}`; ctx.textAlign = "left"; outlinedText("RACHA", bx, by - 6, "#f7f0d5", `18px ${FONT_T}`, "left");
    for (let k = 0; k < GALLOP_AT; k++) { const on = k < combo % GALLOP_AT || (combo > 0 && combo % GALLOP_AT === 0 && gallop > 0); R("#050814", bx + k * 16, by, 14, 14); R(on ? (k < 3 ? "#ffd34e" : "#31d7c7") : "#17213c", bx + k * 16 + 2, by + 2, 10, 10); }
    if (gallop > 0) outlinedText(`GALOPE x${gallop}`, bx + 110, by + 12, "#31d7c7", `18px ${FONT_T}`, "left");
    // teletipo
    const ty = H - 26; R("rgba(5,8,20,.82)", 0, ty, W, 26); R("#d9465b", 0, ty, 104, 26); outlinedText("ÚLTIMA HORA", 52, ty + 19, "#fff", `17px ${FONT_T}`);
    ctx.save(); ctx.beginPath(); ctx.rect(110, ty, W - 110, 26); ctx.clip(); const txt = TICKER.join("   ★   ") + "   ★   "; ctx.font = `19px ${FONT_T}`; ctx.textAlign = "left"; ctx.fillStyle = "#ffd34e"; const tw = ctx.measureText(txt).width, off = (t * 60) % tw; ctx.fillText(txt, 118 - off, ty + 19); ctx.fillText(txt, 118 - off + tw, ty + 19); ctx.restore();
  }
  function render() {
    const sh = shakeT > 0 ? [Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM))] : [0, 0];
    drawBackground();
    const topPx = blocks.length * BH + 64 + Math.min(60, n * 1.1) + 70, sFit = clamp(470 / topPx, .12, 1);
    const e = state === "ending" ? (() => { const k = clamp((endT - .9) / 1.5, 0, 1); return k * k * (3 - 2 * k); })() : state === "over" ? 1 : 0;
    const s = lerp(1, sFit, e), gy = lerp(GROUND_Y + camY, 560, e), ox = lerp(W / 2, 250, e);
    ctx.save(); ctx.translate(sh[0], sh[1]); ctx.translate(ox, gy); ctx.scale(s, s); ctx.translate(-W / 2, 0);
    drawGround();
    for (let i = 0; i < blocks.length; i++) drawBlock(blocks[i], i);
    for (const p of pieces) { ctx.save(); ctx.translate(p.x + p.w / 2, p.y + BH / 2); ctx.rotate(p.rot); ctx.globalAlpha = clamp(1.3 - p.y / 800, 0, 1); R("#050814", -p.w / 2 - 2, -BH / 2 - 1, p.w + 4, BH + 2); R(p.col, -p.w / 2, -BH / 2, p.w, BH - 1); ctx.restore(); }
    let fx, fy;
    if (slab && state === "playing") { drawBlock({ x: slab.x, w: slab.w, col: colorFor(slab.idx) }, slab.idx, true); fx = slab.x + slab.w / 2 + sway(slab.idx); fy = -(slab.idx + 1) * BH; }
    else { const tb = blocks[blocks.length - 1]; fx = tb.x + tb.w / 2 + sway(blocks.length - 1); fy = -blocks.length * BH; }
    drawFlag(fx, fy);
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); R(p.color, p.x, p.y, p.s, p.s); } ctx.globalAlpha = 1;
    for (const f of floats) { ctx.globalAlpha = clamp(1.7 - f.t / f.life * 1.7 + .2, 0, 1); outlinedText(f.text, f.x, f.y - 20, f.color, `${Math.round(22 / s)}px ${FONT_T}`); } ctx.globalAlpha = 1;
    ctx.restore();
    for (const d of drones) drawDrone(d);
    if (e > .4) {
      ctx.globalAlpha = clamp((e - .4) / .6, 0, 1); const m = alt(); let shown = 0;
      for (const [h, name] of LANDMARKS) { if (h > m * 1.25 && shown >= 1) break; const y = gy - (h / METERS) * BH * s; if (y < 4) break; if (h > m) shown++; ctx.strokeStyle = h <= m ? "rgba(60,255,122,.8)" : "rgba(255,255,255,.45)"; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]); outlinedText(`${h} m · ${name}`, 10, y - 6, h <= m ? "#3cff7a" : "#f7f0d5", `18px ${FONT_T}`, "left"); }
      ctx.globalAlpha = 1;
    }
    if (flashT > 0) { ctx.globalAlpha = clamp(flashT * 2.4, 0, .45); ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (gust > 0 && state === "playing" && !reduced) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 12; i++) { const y = ((i * 97 + t * 90) % 520) + 60, x = ((i * 211 + t * 700) % (W + 200)) - 100; ctx.moveTo(x, y); ctx.lineTo(x + 50, y); } ctx.stroke(); }
    if (state === "playing" || state === "paused" || state === "title") drawHud();
    if (state === "playing" || state === "paused" || state === "title" || (state === "ending" && endT < .9)) {
      ctx.save(); ctx.translate(40, 52); const sp = bubble ? 1 : 0, bob = bubble ? Math.round(Math.sin(t * 14) * 1) : 0; ctx.translate(0, bob); ctx.scale(1.3, 1.3); R("#0b1126", -17, -33, 34, 62); drawBeard(ctx, sp); ctx.restore();
      outlinedText("EL JINETE", 40, 100, "#ffd34e", `16px ${FONT_T}`);
      if (bubble) { ctx.font = `22px ${FONT_T}`; const w = Math.ceil(ctx.measureText(bubble.text).width) + 20, h = 28, bx = 72, by = 24; ctx.globalAlpha = clamp(Math.min(bubble.t / .12, (bubble.life - bubble.t) / .25, 1), 0, 1); R("#050814", bx - 3, by - 3, w + 6, h + 6); R("#f7f0d5", bx, by, w, h); ctx.fillStyle = "#f7f0d5"; ctx.beginPath(); ctx.moveTo(bx, by + 8); ctx.lineTo(bx - 8, by + 14); ctx.lineTo(bx, by + 18); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#101629"; ctx.textAlign = "left"; ctx.fillText(bubble.text, bx + 10, by + 21); ctx.globalAlpha = 1; }
    }
    if (banner) { ctx.globalAlpha = clamp(Math.min(banner.t / .2, (banner.life - banner.t) / .5, 1), 0, 1); outlinedText(banner.text, W / 2, 190, "#ffd34e", `${banner.text.length > 14 ? 18 : 24}px ${FONT_PX}`); outlinedText(banner.sub, W / 2, 224, "#f7f0d5", `24px ${FONT_T}`); ctx.globalAlpha = 1; }
    if (state === "playing" && hint && t % 1.2 < .8) outlinedText(UI.drop && matchMedia("(hover:none)").matches ? "TOCA PARA SOLTAR" : "PULSA ESPACIO PARA SOLTAR", W / 2, 140, "#f7f0d5", `22px ${FONT_T}`);
  }

  /* ---------------------------------------------------- tildes de la fuente pixel */
  const ACC = { "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ñ": "N", "Ü": "U" }, ACC_RE = /[ÁÉÍÓÚÑÜ]/;
  function fixAccents(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) if (ACC_RE.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    for (const nd of nodes) {
      const p = nd.parentElement; if (!p || p.closest(".sr-only,[aria-hidden='true'],script,style,.ac")) continue;
      if (!getComputedStyle(p).fontFamily.includes("Press Start")) continue;
      const text = nd.nodeValue, sr = document.createElement("span"), vis = document.createElement("span"); sr.className = "sr-only"; sr.textContent = text; vis.setAttribute("aria-hidden", "true");
      let buf = "";
      for (const ch of text) { if (ACC[ch]) { if (buf) { vis.append(buf); buf = ""; } const sp = document.createElement("span"); sp.className = "ac" + (ch === "Ñ" ? " n" : ch === "Ü" ? " u" : ""); sp.textContent = ACC[ch]; vis.append(sp); } else buf += ch; }
      if (buf) vis.append(buf); nd.replaceWith(sr, vis);
    }
  }

  /* ----------------------------------------------------------------- bucle */
  function frame(now) {
    if (!last) last = now; const dt = clamp((now - last) / 1000, 0, .1); last = now;
    if (state !== "paused") { acc += dt; let k = 0; while (acc >= FIXED && k++ < 12) { update(FIXED); acc -= FIXED; } if (k >= 12) acc = 0; }
    render(); requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------------------- entrada */
  addEventListener("keydown", e => {
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "playing") pauseScreen(); else if (state === "paused") resume(); return; }
    if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) { if (state === "playing" || state === "paused" || state === "ending") play(); return; }
    if ((e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") && state === "playing") { e.preventDefault(); if (!e.repeat) drop(); }
  });
  canvas.addEventListener("pointerdown", e => { if (state !== "playing") return; e.preventDefault(); drop(); });
  UI.drop.addEventListener("pointerdown", e => { e.preventDefault(); UI.drop.classList.add("on"); drop(); setTimeout(() => UI.drop.classList.remove("on"), 120); });
  addEventListener("blur", () => { if (state === "playing") pauseScreen(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseScreen(); });
  UI.pause.addEventListener("click", () => state === "paused" ? resume() : pauseScreen());
  UI.restart.addEventListener("click", () => { if (state !== "title") play(); });
  UI.sound.addEventListener("click", () => { soundOn = !soundOn; store.set("bx-sound", soundOn ? "1" : "0"); AUD.setOn(soundOn); paintSound(); if (soundOn) { sfx.widen(); if (state === "playing") music.start(0); } });

  /* ------------------------------------------------------------------ inicio */
  AUD.setOn(soundOn); paintSound(); reset(); titleScreen(); fixAccents(document.querySelector(".cabinet header")); fixAccents(document.querySelector(".hud"));
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, n, alt: alt(), score, combo, best: bestM, gust, gallop, fines, cuts, w: slab ? Math.round(slab.w) : 0 });
    window.__bx = {
      step: (k = 1, dt = FIXED, draw = true) => { for (let i = 0; i < k; i++) update(dt); if (draw) render(); return snap(); }, snap, play, drop, title: titleScreen, render, over: () => { state = "playing"; slab && (slab.x = -9999); drop(); },
      slab: () => slab && { x: Math.round(slab.x), w: Math.round(slab.w), dir: slab.dir }, top: () => { const b = blocks[blocks.length - 1]; return { x: Math.round(b.x), w: Math.round(b.w) }; }, setN: k => { while (n < k) { blocks.push({ x: (W - START_W) / 2, w: START_W, col: colorFor(blocks.length) }); n++; } camY = camTarget(); prog = n / STAGE_N; landIdx = LANDMARKS.filter(([h]) => alt() >= h).length; updateHud(); newSlab(); }, say, setCombo: k => { combo = k; }, drone: () => { drones.push({ x: -80, y: 140, v: 95, t: 0, text: "EXPEDIENTE", fineAt: 300, fined: false }); }, poster: posterNode
    };
  }
})();
