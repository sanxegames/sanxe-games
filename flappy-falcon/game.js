"use strict";
/* Flappy Falcon — Sanxe Games.
   Un perro piloto, un avión oficial y un cielo lleno de nubarrones de titulares. Cada viaje acaba con un aterrizaje. */
(() => {
  const SPR = window.PS_SPR, AUD = window.FF_AUD, sfx = AUD.sfx, music = AUD.music;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, "0");
  const safe = (fn, fb = null) => { try { return fn(); } catch { return fb; } };
  const store = { get: k => safe(() => localStorage.getItem(k)), set: (k, v) => safe(() => localStorage.setItem(k, v)) };
  const DEBUG = /[?&]debug/.test(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  const canvas = $("#game"), ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = 800, H = 600, GROUND = 548, PX = 210, FIXED = 1 / 120, SC = 2;
  const GRAV = 1350, FLAP = 400, MAXFALL = 640, PLANE_BOTTOM = 26;
  const mk = SPR.mk;

  /* ------------------------------------------------------------- viajes */
  const TRIPS = [
    { name: "BRUSELAS", sub: "Cumbre urgente (de cuarenta minutos)", theme: "dawn", K: 6, speed: 150, gap: 205, spacing: 340, amp: 0, wind: false, shield: 0, turbo: 0, tip: "Toca (o ESPACIO) para dar gas y suelta para planear. Cruza los nubarrones de titulares y recoge votos." },
    { name: "NUEVA YORK", sub: "Asamblea general (con foto)", theme: "day", K: 8, speed: 162, gap: 195, spacing: 330, amp: 0, wind: false, shield: .12, turbo: 0, tip: "La inmunidad parlamentaria te salva de un choque. Cógela cuando la veas." },
    { name: "UNA ISLA", sub: "Reunión de trabajo (sin agenda)", theme: "dusk", K: 10, speed: 172, gap: 190, spacing: 322, amp: 26, wind: false, shield: .12, turbo: .1, tip: "Los nubarrones se mueven. Y el Decreto-Ley te da turbo y te vuelve invencible unos segundos." },
    { name: "LA CUMBRE", sub: "Foto de familia en la cima", theme: "night", K: 12, speed: 182, gap: 184, spacing: 316, amp: 34, wind: false, shield: .12, turbo: .1, tip: "" },
    { name: "TORMENTA PERFECTA", sub: "Turbulencias (y filtraciones)", theme: "storm", K: 12, speed: 188, gap: 182, spacing: 316, amp: 34, wind: true, shield: .14, turbo: .1, tip: "Cuidado con las rachas de viento: avisan con flechas antes de empujarte." },
    { name: "TOKIO", sub: "Gira de tres días en tres horas", theme: "dawn", K: 14, speed: 194, gap: 180, spacing: 312, amp: 40, wind: true, shield: .14, turbo: .1, tip: "" },
    { name: "RIO", sub: "Cumbre del clima (en jet privado)", theme: "day", K: 16, speed: 200, gap: 178, spacing: 308, amp: 46, wind: true, shield: .15, turbo: .1, tip: "" },
    { name: "REP. DOMINICANA", sub: "Reunión de trabajo con vistas al Caribe", theme: "dusk", K: 17, speed: 203, gap: 177, spacing: 306, amp: 48, wind: true, shield: .15, turbo: .1, tip: "" },
    { name: "VUELTA A CASA", sub: "Aterrizaje en la pista de siempre", theme: "night", K: 18, speed: 208, gap: 175, spacing: 303, amp: 52, wind: true, shield: .16, turbo: .12, tip: "" },
    { name: "VUELO SIN FIN", sub: "No hay destino: solo turbulencias", theme: "dawn", endless: true, K: Infinity, speed: 206, gap: 178, spacing: 306, amp: 46, wind: true, shield: .12, turbo: .08, tip: "Aquí no hay pista: cada nube superada te lleva a otra más difícil. Dura lo que dure tu pulso." }
  ];
  const THEMES = {
    dawn: { top: "#3a4a8a", bot: "#ffb98a", sun: "#ffe6a0", city: "#4a3f78", hill: "#6a5a8a", cloud: "#8c97b8", ground: "#2f6b3a", stars: false },
    day: { top: "#4aa8e8", bot: "#d4efff", sun: "#fff6c9", city: "#7fa3c8", hill: "#8fc2a0", cloud: "#9aa6c4", ground: "#3a8a46", stars: false },
    dusk: { top: "#2a1a4a", bot: "#ff7a5a", sun: "#ffb06a", city: "#3a2a5e", hill: "#5a3a6e", cloud: "#7a6f9a", ground: "#2b5a3a", stars: false },
    night: { top: "#0b1021", bot: "#3a4f8c", sun: "#f7f0d5", city: "#0c1430", hill: "#16204a", cloud: "#4c5780", ground: "#1f4a3a", stars: true },
    storm: { top: "#242b3d", bot: "#5c6a88", sun: null, city: "#1c2236", hill: "#2c3550", cloud: "#4a5472", ground: "#1b3f33", stars: false, rain: true }
  };
  const PA = [
    "Estimados pasajeros: el combustible ha sido declarado información reservada.",
    "Se ruega no preguntar por los motivos del viaje. Gracias.",
    "Turbulencias previstas. No son culpa del piloto, sino del anterior.",
    "El piloto agradece su confianza y recuerda que no ha prometido nada.",
    "Esta ruta ha sido aprobada por una comisión que no se ha reunido.",
    "Les informamos de que el aterrizaje será, en todo caso, «ajustado».",
    "Por razones de seguridad nacional, la ventanilla permanecerá cerrada.",
    "El perro piloto ruega que no se le moleste con preguntas incómodas."
  ];
  const DOG_LINES = ["¡Guau!", "¿Dónde dijimos que íbamos?", "Esto es una reunión de trabajo.", "¡Sin comentarios!", "Aguanta, que ya llegamos.", "Resistiré… con gasolina."];
  const HEADLINES = ["DIMITE YA", "CRISIS", "BULO", "TERTULIA", "GRITOS", "ENCUESTA", "MEMES", "TUITS", "DEBATE", "PRENSA", "PANCARTA", "FILTRADO"];
  const saveProg = () => store.set("ff-progress", JSON.stringify(prog));

  /* -------------------------------------------------------------- avión */
  function buildPlane(flame, gear, tie) {
    const [c, g] = mk(52, 30), R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const P = SPR.P;
    R("#8d98b8", 3, 4, 9, 2);                                         // estabilizador en T
    R(P.cream, 6, 5, 4, 11); R(P.cream, 5, 6, 1, 3); R(P.cream, 8, 13, 6, 2);
    R(P.red2, 6, 6, 4, 2); R(P.gold, 6, 8, 4, 2); R(P.cyan, 6, 10, 4, 2);
    R(P.cream, 8, 15, 34, 8); R(P.cream, 42, 16, 4, 6); R(P.cream, 46, 17, 2, 4); R(P.cream, 48, 18, 1, 2);
    R(P.creamS, 8, 22, 34, 1);
    R(P.red2, 8, 19, 38, 1); R(P.gold, 8, 20, 38, 1); R(P.cyan, 8, 21, 36, 1);
    [12, 16, 20, 24].forEach(x => { R("#2b3b78", x, 17, 2, 2); R("#6fa0ff", x, 17, 1, 1); });
    R("#8d98b8", 5, 16, 5, 4); R("#3a4660", 4, 17, 1, 2);
    R("#aab4d5", 20, 23, 14, 2); R("#8d98b8", 16, 25, 16, 1); R("#6b7799", 14, 26, 10, 1);
    if (gear) { R(P.ink, 34, 24, 1, 3); R("#2a2937", 33, 27, 3, 2); R(P.ink, 20, 25, 1, 2); R("#2a2937", 19, 27, 3, 2); }
    if (flame) { R("#ffd34e", 1, 17, 3, 3); R("#ff7a2e", 0, 18, 2, 1); }
    const d = SPR.dog.idle[0]; g.drawImage(d, 17, 0, 13, 12, 27, 3, 13, 12);
    R(P.ink, 30, 6, 5, 5); R(P.cyan, 31, 7, 3, 3); R("#fff", 31, 7, 1, 1); R(P.ink, 27, 8, 3, 1);
    R(P.red2, 26, 13, 4, 1); if (tie) { R(P.red, 22, 13, 5, 1); R(P.red, 20, 14, 3, 1); } else { R(P.red, 22, 14, 5, 1); R(P.red, 20, 13, 3, 1); }
    return SPR.outlined(c);
  }
  const planeCache = {};
  const planeSprite = (flame, gear, tie) => planeCache[`${flame}${gear}${tie}`] ||= buildPlane(flame, gear, tie);

  /* ------------------------------------------------------- nubarrones */
  function seeded(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function makeColumn(h, atTop, seed, base) {
    const w = 112, [c, g] = mk(w, Math.max(8, Math.ceil(h))), r = seeded(seed), puffs = [];
    const dir = atTop ? 1 : -1, tip = atTop ? h : 0;
    for (let y = tip - dir * 18; atTop ? y > -40 : y < h + 40; y -= dir * 24) puffs.push({ x: w / 2 + (r() - .5) * 20, y, r: 30 + r() * 10 });
    for (let i = 0; i < 3; i++) { puffs.push({ x: w / 2 - 34 + i * 34 + (r() - .5) * 6, y: tip - dir * (24 + r() * 8), r: 24 + r() * 6 }); }
    const pass = (col, dx, dy, k) => puffs.forEach(p => SPR.disc(g, col, p.x + dx, p.y + dy, p.r * k, p.r * k));
    pass(base.dark, 4, 5, 1); pass(base.mid, 0, 0, 1); pass(base.light, -6, -7, .66);
    return SPR.outlined(c, "#171c30");
  }
  const cloudPalette = th => th === THEMES.storm || th === THEMES.night ? { dark: "#272e4a", mid: "#46507a", light: "#6b78a8" } : { dark: "#4a5578", mid: "#7885ad", light: "#a9b6d8" };

  /* --------------------------------------------------------------- estado */
  const UI = {
    trip: $("#trip"), score: $("#score"), votes: $("#votes"), leg: $("#leg"), status: $("#game-status"),
    overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"),
    sound: $("#sound"), pause: $("#pause"), restart: $("#restart"), help: $("#game-help")
  };
  let state = "title", trip = TRIPS[0], tripN = 1, soundOn = store.get("ff-sound") !== "0";
  let plane, obstacles = [], pickups = [], particles = [], floats = [], bubbles = [], clouds = [], runway = null, tower = null, backdrop = null, stars = [], rain = [];
  let phase = "takeoff", t = 0, scrollX = 0, speed = 0, passed = 0, spawned = 0, score = 0, votes = 0, votesSeen = 0, votesGot = 0, tripScore0 = 0, streak = 0, phaseT = 0;
  let acc = 0, last = 0, shakeT = 0, shakeM = 0, flash = 0, thunderT = 0, gust = null, gustT = 0, paT = 0, paText = "", paCD = 0, bannerT = 0, tipT = 0, flapHeld = false, perfect = false, crashWhy = "", lastCy = 300, landMsgT = 0, quipCD = 6, tdTimer = 0;
  let prog = safe(() => JSON.parse(store.get("ff-progress")), null) || { unlocked: 1, stars: {}, best: 0 };

  function params() { if (!trip.endless) return trip; const p = passed; return { speed: Math.min(330, 172 + p * 2.6), gap: Math.max(124, 196 - p * 1.3), spacing: Math.max(246, 330 - p * 1.6), amp: Math.min(90, 8 + p * 1.7) }; }
  function endlessTick() {
    if (passed % 12 === 0) { const names = ["dawn", "day", "dusk", "night", "storm"]; trip.theme = names[(passed / 12) % 5]; trip.themeObj = THEMES[trip.theme]; buildBackdrop(); announce(`Escala ${passed}: el vuelo sin fin continúa.`); }
    if (passed % 10 === 0) { score += passed * 2; float(PX + 40, plane.y - 70, `ESCALA ${passed}`, "#3cff7a", 1.6); sfx.land(); }
  }
  const shake = (m, d = .25) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, d); };
  const float = (x, y, text, color, life = 1.3) => floats.push({ x, y, text, color, t: 0, life });
  function burst(x, y, color, n = 10, speed = 120, g = 200, life = .7) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283); particles.push({ x, y, vx: Math.cos(a) * rnd(.3, 1) * speed, vy: Math.sin(a) * rnd(.3, 1) * speed, t: 0, life: rnd(.4, life), color, g, s: 4 }); } }
  const say = (text, life = 2.2) => { bubbles = [{ text, t: 0, life }]; };
  const announce = text => { paText = text; paT = 4.2; sfx.pa(); };

  /* ------------------------------------------------------------ escenario */
  function buildBackdrop() {
    const th = trip.themeObj, [c, g] = mk(1200, 150), R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    for (let x = 0, i = 0; x < 1200; i++) { const bw = 22 + (i * 11) % 30, bh = 26 + (i * 17) % 80; R(th.city, x, 150 - bh, bw, bh); for (let wy = 150 - bh + 6; wy < 146; wy += 8) for (let wx = x + 4; wx < x + bw - 4; wx += 8) if ((wx * 5 + wy * 3 + i) % 7 < 2) R(th.stars || trip.theme === "dusk" ? "#ffd34e" : "rgba(255,255,255,.5)", wx, wy, 3, 3); x += bw + 3; }
    const cx = 620; R(th.city, cx - 90, 150 - 34, 180, 34); for (let i = 0; i < 14; i++) { const ww = 90 - i * 6; R(th.city, cx - ww / 2, 150 - 34 - 18 + i, ww, 1); } R(th.city, cx - 26, 150 - 62, 52, 28); for (let i = 0; i < 26; i++) { const half = Math.round(26 * Math.sqrt(1 - (i / 26) ** 2)); R(th.city, cx - half, 150 - 62 - i, half * 2, 1); } R("#c9d2e8", cx, 150 - 108, 1, 20);
    const [h2, g2] = mk(1200, 90); g2.fillStyle = th.hill; g2.beginPath(); g2.moveTo(0, 90); for (let x = 0; x <= 1200; x += 20) g2.lineTo(x, 40 + Math.sin(x * .012) * 18 + Math.sin(x * .031) * 10); g2.lineTo(1200, 90); g2.fill();
    backdrop = { city: c, hills: h2 };
    stars = th.stars ? Array.from({ length: 60 }, () => ({ x: rnd(0, W), y: rnd(0, 300), p: rnd(0, 6) })) : [];
    rain = th.rain ? Array.from({ length: 140 }, () => ({ x: rnd(0, W + 200), y: rnd(0, H), s: rnd(560, 800) })) : [];
    clouds = Array.from({ length: 9 }, () => ({ x: rnd(0, W), y: rnd(20, 330), w: rnd(60, 150), v: rnd(.12, .3) }));
  }
  function startTrip(n, fresh) {
    n = Math.min(n, TRIPS.length); tripN = n; trip = { ...TRIPS[n - 1] };
    trip.themeObj = THEMES[trip.theme];
    if (fresh) score = 0;
    obstacles = []; pickups = []; particles = []; floats = []; bubbles = [];
    plane = { y: GROUND - PLANE_BOTTOM, vy: 0, ang: 0, flapT: 0, shield: false, invuln: 0, turbo: 0, dead: false, tie: 0, trail: 0, hitT: 0 };
    runway = { x: PX - 150, len: 560, y: GROUND, takeoff: true }; tower = { x: PX - 230 };
    phase = "takeoff"; phaseT = 0; t = 0; scrollX = 0; speed = 0; passed = 0; spawned = 0; votes = 0; votesSeen = 0; votesGot = 0; tripScore0 = score; streak = 0; perfect = false; gust = null; gustT = rnd(6, 10);
    flash = 0; thunderT = rnd(4, 9); paT = 0; paCD = rnd(7, 11); bannerT = 3; tipT = trip.tip ? 6.5 : 0; lastCy = 300; quipCD = rnd(5, 9); flapHeld = false;
    buildBackdrop(); music.setLevel(n); music.setMode(0); updateHud();
  }
  function updateHud() { UI.trip.textContent = tripN; UI.score.textContent = pad(score, 5); UI.votes.textContent = pad(votes, 2); UI.leg.textContent = trip.endless ? `${passed}` : `${Math.min(passed, trip.K)}/${trip.K}`; }
  function setControls() { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; }
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };

  /* ----------------------------------------------------------- pantallas */
  const starsHtml = n => `<div class="stars" aria-label="${n} de 3 estrellas">${[0, 1, 2].map(i => `<i class="star ${i < n ? "on" : ""}"></i>`).join("")}</div>`;
  function showOverlay({ stamp = "SÁTIRA PIXELADA", title, text = "", extra = "", actions = [], help = false }) {
    UI.help.hidden = !help; UI.stamp.textContent = stamp; UI.title.textContent = title; UI.text.textContent = text; UI.text.hidden = !text;
    if (typeof extra === "string") UI.extra.innerHTML = extra; else { UI.extra.innerHTML = ""; UI.extra.appendChild(extra); }
    UI.actions.innerHTML = "";
    actions.forEach((a, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a.secondary ? " secondary" : ""); b.textContent = a.label; b.addEventListener("click", a.fn); UI.actions.appendChild(b); if (i === 0) requestAnimationFrame(() => b.focus()); });
    UI.overlay.classList.remove("hidden"); flapHeld = false;
  }
  const hideOverlay = () => UI.overlay.classList.add("hidden");
  const goHome = () => { location.href = "../"; };
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    const acts = [{ label: "EMPEZAR VIAJE", fn: () => playTrip(1, true) }];
    if (prog.unlocked > 1) acts.unshift({ label: `CONTINUAR: VIAJE ${Math.min(prog.unlocked, TRIPS.length)}`, fn: () => playTrip(Math.min(prog.unlocked, TRIPS.length), true) });
    acts.push({ label: "MAPA DE VIAJES", secondary: true, fn: () => mapScreen() }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome });
    showOverlay({ help: true, title: "FLAPPY FALCON", text: `Un perro piloto, un avión oficial y un cielo lleno de nubarrones de titulares. Cruza los huecos, recoge votos y, al final de cada viaje, aterriza con suavidad en una pista diminuta.${prog.best ? ` Récord: ${prog.best}.` : ""}`, actions: acts });
  }
  function mapScreen(from) {
    const wrap = document.createElement("div"); wrap.className = "map";
    const total = TRIPS.length;
    for (let n = 1; n <= total; n++) {
      const def = TRIPS[n - 1], open = n <= prog.unlocked, st = prog.stars[n] || 0;
      const b = document.createElement("button"); b.type = "button"; b.className = "tile" + (open ? "" : " locked"); b.disabled = !open;
      b.innerHTML = `<b>${n}</b><span>${def.name}</span>${open ? (def.endless ? `<em class="rec">${prog.endless || 0} ESCALAS</em>` : starsHtml(st)) : ""}`; b.addEventListener("click", () => playTrip(n, true)); wrap.appendChild(b);
    }
    showOverlay({ stamp: "ELIGE DESTINO", title: "MAPA DE VIAJES", extra: wrap, actions: [{ label: "VOLVER", secondary: true, fn: () => (from === "pause" ? pauseScreen() : titleScreen()) }] });
  }
  function playTrip(n, fresh) {
    state = "playing"; startTrip(n, fresh); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(n);
    UI.status.textContent = `Viaje ${n} a ${trip.name}. Despegando.`; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now();
  }
  function pauseScreen() {
    if (state !== "playing") return; state = "paused"; setControls(); music.pause(true);
    showOverlay({ help: true, stamp: "TURBULENCIAS", title: "PAUSA", text: "El avión espera en el aire. El Gobierno, también.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR VIAJE", secondary: true, fn: () => playTrip(tripN) }, { label: "MAPA", secondary: true, fn: () => mapScreen("pause") }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function landingHeadline(perf, vOk) {
    if (perf) return ["ATERRIZAJE PERFECTO", "El perro piloto no recuerda cómo lo hizo, pero se atribuye el mérito."];
    if (vOk) return ["TODOS LOS VOTOS A BORDO", "El Gobierno celebra una mayoría absoluta de papeletas flotantes."];
    return pick([["ATERRIZAJE CON APLAUSOS", "El avión llega puntual, aunque a otro aeropuerto."], ["TOMA DE CONTACTO", "Fuentes oficiales lo califican de «aterrizaje programático»."], ["VIAJE DE TRABAJO COMPLETADO", "La agenda: una foto, una sonrisa y un café."]]);
  }
  function tripComplete(vel) {
    const landBonus = perfect ? 150 : 100, voteBonus = votesGot * 20; score += landBonus + voteBonus;
    const allVotes = votesSeen > 0 && votesGot >= Math.ceil(votesSeen * .7), st = 1 + (allVotes ? 1 : 0) + (perfect ? 1 : 0);
    prog.stars[tripN] = Math.max(prog.stars[tripN] || 0, st); prog.unlocked = Math.min(TRIPS.length, Math.max(prog.unlocked, tripN + 1)); prog.best = Math.max(prog.best, score); saveProg();
    state = "tripclear"; setControls(); music.stop(); sfx.land(); sfx.applause(); if (perfect) sfx.perfect(); updateHud();
    const [h1, h2] = landingHeadline(perfect, allVotes);
    UI.status.textContent = `Aterrizaje en ${trip.name} con ${st} estrellas.`;
    showOverlay({ stamp: trip.name, title: "HAN ATERRIZADO", text: `Puntuación: ${score} (+${landBonus} aterrizaje, +${voteBonus} votos). Velocidad de toma: ${Math.round(vel)}.`, extra: `${starsHtml(st)}<p class="headline"><b>TITULAR</b>${h1}<small>${h2}</small></p>`, actions: [{ label: tripN + 1 >= TRIPS.length ? "VUELO SIN FIN" : "SIGUIENTE VIAJE", fn: () => playTrip(tripN + 1) }, { label: "REPETIR", secondary: true, fn: () => playTrip(tripN) }, { label: "MAPA", secondary: true, fn: () => mapScreen() }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function gameOver() {
    if (trip.endless) prog.endless = Math.max(prog.endless || 0, passed); prog.best = Math.max(prog.best, score); saveProg(); state = "lost"; setControls(); music.stop(); sfx.lose();
    const m = { nube: ["CHOQUE CON LA REALIDAD", "El Gobierno lo niega: «ha sido un contacto no deseado»."], suelo: ["ATERRIZAJE FORZOSO", "Fuentes oficiales hablan de «maniobra estratégica»."], duro: ["PISTA DE UN SOLO USO", "Se investigarán las causas en cuanto termine el verano."], fuera: ["SE QUEDÓ SIN PISTA", "El piloto asegura que quería aterrizar en el césped «por coherencia»."] }[crashWhy] || ["AVERÍA", "Se investigarán las causas."];
    UI.status.textContent = "El avión ha caído.";
    showOverlay({ stamp: trip.name, title: m[0], text: `Puntuación: ${score}. Récord: ${prog.best}. ${trip.endless ? `Escalas superadas: ${passed}. Récord de escalas: ${prog.endless || 0}.` : `Llegaste hasta el tramo ${passed} de ${trip.K}.`}`, extra: `<p class="headline"><b>ÚLTIMA HORA</b>${m[1]}</p>`, actions: [{ label: "REINTENTAR", fn: () => playTrip(tripN) }, { label: "MAPA", secondary: true, fn: () => mapScreen() }, { label: "INICIO", secondary: true, fn: titleScreen }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }

  /* ----------------------------------------------------------- simulación */
  function flap() {
    if (state !== "playing" || plane.dead) return;
    if (phase === "ready") { phase = "cruise"; phaseT = 0; plane.vy = -FLAP; plane.flapT = .14; sfx.flap(); return; }
    if (phase === "cruise" || phase === "approach") {
      plane.vy = phase === "approach" ? -285 : -FLAP; plane.flapT = .14; sfx.flap();
      particles.push({ x: PX - 30, y: plane.y + 4, vx: -90, vy: rnd(-20, 20), t: 0, life: .35, color: "#ffd34e", g: 0, s: 5 });
    }
  }
  function spawnObstacle() {
    const D = params(), amp = D.amp, g = D.gap, minC = g / 2 + 70 + amp, maxC = GROUND - g / 2 - 70 - amp;
    const cy = clamp(lastCy + rnd(-165, 165), minC, maxC), x = W + 70, seed = (tripN * 1000 + spawned * 37) | 0;
    const pal = cloudPalette(trip.themeObj), topH = cy - g / 2 + amp, botH = GROUND - (cy + g / 2) + amp;
    obstacles.push({ x, w: 112, cy, gap: g, amp, ph: rnd(0, 6.28), freq: rnd(.9, 1.5), top: makeColumn(topH, true, seed, pal), bot: makeColumn(botH, false, seed + 7, pal), topH, botH, passed: false, text: pick(HEADLINES), tilt: rnd(-.12, .12), zap: 0 });
    const mid = x - D.spacing / 2;
    if (spawned > 0) {
      [[.33, "vote"], [.66, "vote"]].forEach(([f, ty]) => { pickups.push({ type: ty, x: lerp(x - D.spacing, x, f), y: lerp(lastCy, cy, f) + rnd(-8, 8), t: rnd(0, 6) }); votesSeen++; });
      const r = Math.random(); if (r < trip.shield && !plane.shield) pickups.push({ type: "shield", x: mid, y: lerp(lastCy, cy, .5), t: 0 }); else if (r < trip.shield + trip.turbo) pickups.push({ type: "turbo", x: mid, y: lerp(lastCy, cy, .5), t: 0 });
    }
    pickups.push({ type: "vote", x: x + 56, y: cy, t: rnd(0, 6) }); votesSeen++;
    lastCy = cy; spawned++;
  }
  const gapTop = o => o.cy + Math.sin(t * o.freq + o.ph) * o.amp - o.gap / 2;
  function hitCircle(cx, cy, r, rx, ry, rw, rh) { const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh), dx = cx - nx, dy = cy - ny; return dx * dx + dy * dy < r * r; }
  function crash(why) {
    if (plane.dead) return; plane.dead = true; phase = "crash"; phaseT = 0; crashWhy = why; plane.vy = -240; sfx.crash(); shake(9, .5); burst(PX + 10, plane.y, "#ff7a2e", 22, 220, 260, 1); burst(PX + 10, plane.y, "#ffd34e", 14, 160, 200, .9); burst(PX + 10, plane.y, "#f7f0d5", 10, 120, 100, 1.1); music.setMode(0); music.stop();
  }
  function updatePlane(dt) {
    const appr = phase === "approach";
    plane.flapT = Math.max(0, plane.flapT - dt); plane.invuln = Math.max(0, plane.invuln - dt); plane.turbo = Math.max(0, plane.turbo - dt); plane.hitT = Math.max(0, plane.hitT - dt);
    let g = appr ? GRAV * .62 : GRAV; if (gust) g += gust.dir * 650;
    const above = GROUND - (plane.y + PLANE_BOTTOM), cap = appr ? Math.min(330, 70 + Math.max(0, above) * 2.6) : MAXFALL;
    plane.vy = Math.min(cap, plane.vy + g * dt); plane.y += plane.vy * dt;
    plane.ang = lerp(plane.ang, clamp(plane.vy * .075, -26, appr ? 28 : 52), Math.min(1, dt * 10));
    plane.tie += dt * 12; plane.trail -= dt;
    if (plane.trail <= 0) { plane.trail = plane.turbo > 0 ? .02 : .05; particles.push({ x: PX - 24, y: plane.y + 6, vx: -speed * .9, vy: rnd(-8, 8), t: 0, life: .5, color: plane.turbo > 0 ? "#ffb06a" : "rgba(255,255,255,.8)", g: 0, s: plane.turbo > 0 ? 6 : 4 }); }
    if (plane.y < 18) { plane.y = 18; if (plane.vy < 0) plane.vy = 0; }
  }
  function collectPickup(p) {
    p.t = 99;
    if (p.type === "vote") { votes++; votesGot++; score += 5; sfx.vote(); float(p.x, p.y - 20, "+1 VOTO", "#ffd34e", 1); burst(p.x, p.y, "#ffd34e", 6, 90, 0, .4); }
    else if (p.type === "shield") { plane.shield = true; sfx.shield(); float(p.x, p.y - 26, "¡INMUNIDAD PARLAMENTARIA!", "#31d7c7", 1.8); burst(p.x, p.y, "#31d7c7", 12, 140, 0, .6); announce("Les informamos de que el avión goza de inmunidad parlamentaria."); }
    else { plane.turbo = 3.2; sfx.turbo(); shake(3, .3); float(p.x, p.y - 26, "¡DECRETO LEY!", "#ff7a2e", 1.8); burst(p.x, p.y, "#ff7a2e", 14, 160, 0, .6); announce("Aprobado por decreto-ley: velocidad y puntos dobles."); }
    updateHud();
  }
  function update(dt) {
    if (state !== "playing") return;
    t += dt; phaseT += dt; bannerT = Math.max(0, bannerT - dt); tipT = Math.max(0, tipT - dt); paT = Math.max(0, paT - dt); shakeT = Math.max(0, shakeT - dt); landMsgT = Math.max(0, landMsgT - dt);
    const tur = plane.turbo > 0 ? 1.7 : 1;
    if (phase === "takeoff") { speed = params().speed * Math.min(1, phaseT / 1); }
    else if (phase === "cruise" || phase === "ready") speed = params().speed * tur;
    else if (phase === "approach") speed = lerp(speed, 125, Math.min(1, dt * .8));
    else if (phase === "rollout") speed = Math.max(0, speed - 120 * dt);
    else if (phase === "crash") speed = Math.max(0, speed - 200 * dt);
    scrollX += speed * dt;
    // --- fases
    if (phase === "takeoff") {
      plane.y = phaseT < .8 ? GROUND - PLANE_BOTTOM : lerp(GROUND - PLANE_BOTTOM, 330, Math.min(1, (phaseT - .8) / .9)); plane.ang = phaseT < .8 ? 0 : -14; plane.vy = 0; plane.tie += dt * 12;
      if (phaseT > .8 && phaseT < .85) { sfx.turbo(); }
      if (phaseT >= 1.7) { phase = "ready"; phaseT = 0; plane.vy = 0; plane.y = 330; plane.ang = -8; announce(`Despegue completado. Destino: ${trip.name}.`); }
    } else if (phase === "ready") { plane.y = 330 + Math.sin(t * 4) * 9; plane.ang = -6 + Math.sin(t * 4) * 3; plane.tie += dt * 12; plane.flapT = Math.max(0, plane.flapT - dt); }
    else if (phase === "cruise" || phase === "approach") updatePlane(dt);
    else if (phase === "crash") { plane.vy = Math.min(700, plane.vy + GRAV * dt); plane.y += plane.vy * dt; plane.ang += 340 * dt; if (plane.y > GROUND - 8) { plane.y = GROUND - 8; if (phaseT > .4 && state === "playing") { phase = "done"; setTimeout(() => state === "playing" && gameOver(), 450); } } if (Math.random() < .5) particles.push({ x: PX + rnd(-10, 20), y: plane.y + rnd(-6, 6), vx: -speed * .5 + rnd(-30, 30), vy: rnd(-60, -20), t: 0, life: .8, color: pick(["#3a3a4a", "#6b6b7b", "#ff7a2e"]), g: -20, s: 5 }); }
    else if (phase === "rollout") { plane.y = GROUND - PLANE_BOTTOM; plane.ang = lerp(plane.ang, 0, Math.min(1, dt * 8)); plane.vy = 0; if (speed < 1 && phaseT > .8 && state === "playing") { phase = "done"; tripComplete(tdVel()); } if (Math.random() < .6) particles.push({ x: PX - 8, y: GROUND - 2, vx: -speed * .6, vy: rnd(-40, -10), t: 0, life: .5, color: "#c9c2a8", g: 0, s: 4 }); }
    // --- obstáculos
    if (phase === "cruise" && spawned < trip.K && (obstacles.length === 0 ? phaseT > .3 : obstacles[obstacles.length - 1].x < W + 70 - params().spacing)) spawnObstacle();
    for (const o of obstacles) {
      o.x -= speed * dt;
      if (!o.passed && o.x + o.w < PX - 24 && !plane.dead) { o.passed = true; passed++; streak++; const pts = (plane.turbo > 0 ? 20 : 10); score += pts; sfx.ding(streak); float(PX + 40, plane.y - 40, `+${pts}`, "#f7f0d5", .9); if (trip.endless) endlessTick(); updateHud(); }
    }
    obstacles = obstacles.filter(o => o.x + o.w > -20);
    if (phase === "cruise" && passed >= trip.K && !plane.dead) { phase = "approach"; phaseT = 0; runway = { x: W + 900, len: 340, y: GROUND, takeoff: false }; tower = { x: runway.x - 120 }; music.setMode(2); announce("Aproximación final: sigan las luces de la pista."); sfx.warn(); landMsgT = 4; }
    for (const p of pickups) { p.x -= speed * dt; p.t += dt; }
    pickups = pickups.filter(p => p.x > -30 && p.t < 90);
    if (runway) { runway.x -= speed * dt; if (tower) tower.x -= speed * dt; if (runway.takeoff && runway.x + runway.len < -40) { runway = null; tower = null; } }
    // --- colisiones y recogidas
    if (!plane.dead && (phase === "cruise" || phase === "approach")) {
      const cs = [[PX + 16, plane.y + 2, 12], [PX - 10, plane.y + 3, 10], [PX + 36, plane.y + 3, 7]];
      let hit = false;
      for (const o of obstacles) { if (o.x > PX + 80 || o.x + o.w < PX - 60) continue; const gt = gapTop(o), gb = gt + o.gap; for (const [cx, cy, r] of cs) { if (hitCircle(cx, cy, r, o.x + 8, -20, o.w - 16, gt + 6) || hitCircle(cx, cy, r, o.x + 8, gb - 6, o.w - 16, 700)) { hit = true; o.zap = .25; break; } } }
      if (hit && plane.turbo <= 0 && plane.invuln <= 0) { if (plane.shield) { plane.shield = false; plane.invuln = 1.2; plane.hitT = .4; sfx.shieldHit(); shake(5, .25); burst(PX + 10, plane.y, "#31d7c7", 16, 200, 0, .6); float(PX + 20, plane.y - 40, "¡INMUNIDAD GASTADA!", "#31d7c7", 1.2); streak = 0; } else crash("nube"); }
      else if (hit && plane.turbo > 0) { burst(PX + 30, plane.y, "#f7f0d5", 4, 120, 100, .4); }
      for (const p of pickups) if (p.t < 90 && Math.hypot(p.x - (PX + 14), p.y - plane.y) < 32) collectPickup(p);
      if (phase === "cruise" && plane.y + 18 >= GROUND - 4) crash("suelo");
      if (phase === "approach") landingCheck();
    }
    if (phase === "cruise" || phase === "approach") {
      paCD -= dt; if (paCD <= 0 && paT <= 0 && phase === "cruise") { paCD = rnd(11, 16); announce(pick(PA)); }
      quipCD -= dt; if (quipCD <= 0) { quipCD = rnd(8, 14); say(pick(DOG_LINES)); }
      if (trip.wind) { gustT -= dt; if (!gust && gustT <= 0 && phase === "cruise") { gust = { dir: Math.random() < .5 ? -1 : 1, warn: 1.2, t: 0, on: false }; sfx.warn(); } if (gust) { gust.t += dt; if (!gust.on && gust.t > gust.warn) { gust.on = true; sfx.gust(); } if (gust.t > gust.warn + 1.5) { gust = null; gustT = trip.endless ? rnd(4.5, 8) : rnd(8, 13); } } }
    }
    for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; } particles = particles.filter(p => p.t < p.life);
    for (const f of floats) { f.t += dt; f.y -= 28 * dt; } floats = floats.filter(f => f.t < f.life);
    for (const b of bubbles) b.t += dt; bubbles = bubbles.filter(b => b.t < b.life);
    for (const c of clouds) { c.x -= (c.v * 60 + speed * .12) * dt; if (c.x < -c.w - 20) { c.x = W + 20; c.y = rnd(20, 330); } }
    for (const o of obstacles) o.zap = Math.max(0, o.zap - dt);
    if (rain.length) { for (const r of rain) { r.y += r.s * dt; r.x -= (r.s * .25 + speed * .5) * dt; if (r.y > H) { r.y = -10; r.x = rnd(0, W + 220); } } thunderT -= dt; if (thunderT <= 0) { thunderT = rnd(5, 11); flash = reduced ? 0 : .9; setTimeout(() => sfx.thunder(), 300); if (obstacles.length) pick(obstacles).zap = .35; } flash = Math.max(0, flash - dt * 2.2); }
    music.setMode(phase === "approach" ? 2 : (plane.turbo > 0 || passed >= trip.K * .6 || (trip.endless && passed >= 8)) ? 1 : 0);
  }
  let td = 0; const tdVel = () => td;
  function landingCheck() {
    if (!runway || plane.y + PLANE_BOTTOM < GROUND - 2) return;
    const on = runway.x <= PX + 30 && PX - 10 <= runway.x + runway.len, vel = plane.vy, ang = plane.ang;
    td = vel;
    if (!on) { crash(PX < runway.x ? "suelo" : "fuera"); return; }
    if (vel > 255 || ang > 34 || ang < -26) { crash("duro"); return; }
    perfect = vel <= 140 && PX - runway.x < runway.len * .42 && Math.abs(ang) < 16;
    phase = "rollout"; phaseT = 0; plane.y = GROUND - PLANE_BOTTOM; plane.vy = 0; sfx.touch(); shake(3, .2); burst(PX, GROUND - 2, "#c9c2a8", 14, 140, 120, .6);
    float(PX + 40, GROUND - 90, perfect ? "¡PERFECTO!" : "¡ATERRIZAJE!", perfect ? "#3cff7a" : "#ffd34e", 1.8);
    for (let i = 0; i < 18; i++) particles.push({ x: rnd(PX, PX + 220), y: GROUND - 40, vx: rnd(-40, 40), vy: rnd(-200, -90), t: 0, life: 1.4, color: pick(["#ff4d61", "#ffd34e", "#31d7c7", "#3cff7a", "#8fa8ff"]), g: 260, s: 5 });
  }

  /* ---------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  function outlinedText(txt, x, y, color, font, align = "center") { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814"; [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y); }
  function drawSky() {
    const th = trip.themeObj, gr = ctx.createLinearGradient(0, 0, 0, GROUND); gr.addColorStop(0, th.top); gr.addColorStop(1, th.bot); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    for (const s of stars) { ctx.fillStyle = `rgba(247,240,213,${(.4 + .6 * Math.abs(Math.sin(t * 1.4 + s.p))).toFixed(2)})`; ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); }
    if (th.sun) { const sx = 620, sy = trip.theme === "night" ? 90 : trip.theme === "day" ? 100 : 210; ctx.fillStyle = th.sun; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.beginPath(); ctx.arc(sx, sy, 56, 0, 7); ctx.fill(); }
    for (const c of clouds) { ctx.fillStyle = th.cloud === "#8c97b8" ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.14)"; const x = Math.round(c.x), y = Math.round(c.y); ctx.fillRect(x, y, c.w, 10); ctx.fillRect(x + 12, y - 8, c.w - 30, 10); ctx.fillRect(x + 6, y + 10, c.w - 14, 6); }
    const ho = -((scrollX * .18) % 1200); for (let i = 0; i < 2; i++) ctx.drawImage(backdrop.hills, Math.round(ho + i * 1200), GROUND - 90);
    const co = -((scrollX * .34) % 1200); for (let i = 0; i < 2; i++) ctx.drawImage(backdrop.city, Math.round(co + i * 1200), GROUND - 150);
  }
  function drawGround() {
    const th = trip.themeObj; ctx.fillStyle = th.ground; ctx.fillRect(0, GROUND, W, H - GROUND); ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0, GROUND + 14, W, H - GROUND);
    const off = scrollX % 64; ctx.fillStyle = "rgba(255,255,255,.1)"; for (let x = -off; x < W; x += 64) ctx.fillRect(Math.round(x), GROUND + 4, 28, 3); ctx.fillStyle = "rgba(0,0,0,.2)"; for (let x = -off * 1.4; x < W; x += 96) ctx.fillRect(Math.round(x), GROUND + 24, 40, 3);
  }
  function drawRunway() {
    if (!runway) return;
    const r = runway, x = Math.round(r.x), y = GROUND;
    ctx.fillStyle = "#050814"; ctx.fillRect(x - 3, y - 2, r.len + 6, 22); ctx.fillStyle = "#3a3f55"; ctx.fillRect(x, y, r.len, 18); ctx.fillStyle = "#2b2f3e"; ctx.fillRect(x, y + 12, r.len, 6);
    ctx.fillStyle = "#f7f0d5"; for (let i = 24; i < r.len - 30; i += 46) ctx.fillRect(x + i, y + 7, 26, 3);
    if (!r.takeoff) { ctx.fillStyle = "#f7f0d5"; for (let i = 0; i < 4; i++) ctx.fillRect(x + 18 + i * 9, y + 2, 4, 12); ctx.fillStyle = "#ff4d61"; ctx.fillRect(x + r.len - 6, y, 6, 18); ctx.fillStyle = "#c28a5a"; ctx.fillRect(x + r.len + 10, y, 80, 6); }
    for (let i = 0, k = 0; i <= r.len; i += 34, k++) { const on = Math.floor(t * 8 - k * .5) % 6 === 0; ctx.fillStyle = on ? "#fff6b0" : "#ffd34e"; ctx.fillRect(x + i, y - 5, 4, 5); ctx.fillStyle = on ? "rgba(255,246,176,.35)" : "rgba(255,211,78,.15)"; ctx.fillRect(x + i - 3, y - 9, 10, 8); }
    if (tower) { const tx = Math.round(tower.x); ctx.fillStyle = "#050814"; ctx.fillRect(tx - 2, y - 92, 26, 94); ctx.fillStyle = "#aab4d5"; ctx.fillRect(tx, y - 70, 22, 70); ctx.fillStyle = "#8d98b8"; ctx.fillRect(tx + 14, y - 70, 8, 70); ctx.fillStyle = "#050814"; ctx.fillRect(tx - 8, y - 96, 38, 28); ctx.fillStyle = "#31d7c7"; ctx.fillRect(tx - 6, y - 94, 34, 22); ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(tx - 6, y - 94, 34, 6); ctx.fillStyle = "#ff4d61"; ctx.fillRect(tx + 10, y - 104, 3, 8); const b = Math.floor(t * 3) % 2; ctx.fillStyle = b ? "#ff4d61" : "#7a1f31"; ctx.fillRect(tx + 8, y - 108, 7, 5); }
    if (!r.takeoff) {
      const px = x + 56, ideal = Math.max(8, (r.x + 70 - PX) * .2), h = GROUND - plane.y - PLANE_BOTTOM, diff = h - ideal, whites = diff > 34 ? 4 : diff > 12 ? 3 : diff > -12 ? 2 : diff > -34 ? 1 : 0;
      for (let i = 0; i < 4; i++) { ctx.fillStyle = "#050814"; ctx.fillRect(px + i * 16 - 2, y - 40, 14, 14); ctx.fillStyle = i < whites ? "#ffffff" : "#ff4d61"; ctx.fillRect(px + i * 16, y - 38, 10, 10); ctx.fillStyle = i < whites ? "rgba(255,255,255,.3)" : "rgba(255,77,97,.3)"; ctx.fillRect(px + i * 16 - 3, y - 41, 16, 16); }
      ctx.fillStyle = "#c9d2e8"; ctx.fillRect(x + r.len + 20, y - 54, 3, 54); ctx.fillStyle = Math.floor(t * 4) % 2 ? "#ff7a2e" : "#f7f0d5"; ctx.fillRect(x + r.len + 23, y - 54, 22, 8); ctx.fillStyle = "#f7f0d5"; ctx.fillRect(x + r.len + 31, y - 54, 5, 8);
    }
  }
  function drawObstacle(o) {
    const gt = gapTop(o), gb = gt + o.gap, x = Math.round(o.x);
    ctx.drawImage(o.top, x - 1, Math.round(gt - o.top.height + 1)); ctx.drawImage(o.bot, x - 1, Math.round(gb - 1));
    if (o.zap > 0) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(190,220,255,${(o.zap * 2).toFixed(2)})`; ctx.fillRect(x, gt - o.top.height, o.w, o.top.height); ctx.fillRect(x, gb, o.w, o.bot.height); ctx.restore(); ctx.strokeStyle = "#f7f0d5"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 56, gt); ctx.lineTo(x + 48, gt - 18); ctx.lineTo(x + 64, gt - 30); ctx.lineTo(x + 54, gt - 52); ctx.stroke(); }
    const paper = (py, up) => { ctx.save(); ctx.translate(x + 56, py); ctx.rotate(o.tilt + Math.sin(t * 2 + o.ph) * .05); ctx.fillStyle = "#050814"; ctx.fillRect(-48, -14, 96, 28); ctx.fillStyle = "#f7f0d5"; ctx.fillRect(-45, -11, 90, 22); ctx.fillStyle = "#101629"; ctx.font = `8px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillText(o.text, 0, 4); ctx.fillStyle = "#ff4d61"; ctx.fillRect(-45, -11, 90, 3); ctx.restore(); void up; };
    paper(gt - 22, true); paper(gb + 24, false);
  }
  function drawPickup(p) {
    const bob = Math.sin(p.t * 5) * 4, x = Math.round(p.x), y = Math.round(p.y + bob);
    if (p.type === "vote") { ctx.fillStyle = "#050814"; ctx.fillRect(x - 9, y - 11, 18, 22); ctx.fillStyle = "#f7f0d5"; ctx.fillRect(x - 7, y - 9, 14, 18); ctx.fillStyle = "#ff4d61"; ctx.fillRect(x - 7, y - 9, 14, 3); ctx.fillStyle = "#101629"; ctx.fillRect(x - 4, y - 2, 8, 2); ctx.fillRect(x - 4, y + 2, 6, 2); ctx.fillStyle = "#31d7c7"; ctx.fillRect(x - 2, y + 5, 4, 3); }
    else { const col = p.type === "shield" ? "49,215,199" : "255,122,46"; ctx.fillStyle = `rgba(${col},${(.2 + .12 * Math.sin(p.t * 6)).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill(); ctx.fillStyle = "#050814"; ctx.beginPath(); ctx.arc(x, y, 19, 0, 7); ctx.fill(); ctx.fillStyle = p.type === "shield" ? "#31d7c7" : "#ff7a2e"; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill(); ctx.fillStyle = "#f7f0d5"; if (p.type === "shield") { ctx.fillRect(x - 8, y - 8, 16, 11); ctx.fillRect(x - 6, y + 3, 12, 4); ctx.fillRect(x - 3, y + 7, 6, 3); ctx.fillStyle = "#101629"; ctx.fillRect(x - 2, y - 5, 4, 8); } else { ctx.fillRect(x - 3, y - 11, 6, 12); ctx.fillRect(x - 8, y - 2, 16, 4); ctx.fillRect(x - 3, y + 1, 6, 10); } outlinedText(p.type === "shield" ? "INMUNIDAD" : "DECRETO", x, y + 34, "#f7f0d5", `7px ${FONT_PX}`); }
  }
  function drawPlane() {
    const gear = phase === "takeoff" || phase === "approach" || phase === "rollout", flame = plane.flapT > 0 || plane.turbo > 0 || phase === "takeoff", spr = planeSprite(flame ? 1 : 0, gear ? 1 : 0, Math.floor(plane.tie) % 2), w = spr.width * SC, h = spr.height * SC;
    const h2 = Math.max(0, GROUND - plane.y - PLANE_BOTTOM); ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(PX + 12, GROUND + 4, Math.max(14, 44 - h2 * .08), 6, 0, 0, 7); ctx.fill();
    if (plane.turbo > 0) { ctx.fillStyle = "rgba(255,122,46,.25)"; ctx.beginPath(); ctx.arc(PX + 10, plane.y, 60 + Math.sin(t * 30) * 4, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.4)"; for (let i = 0; i < 5; i++) ctx.fillRect(PX - 70 - i * 30 - (t * 600) % 30, plane.y - 24 + i * 12, 40, 3); }
    if (plane.invuln > 0 && Math.floor(t * 20) % 2) return;
    ctx.save(); ctx.translate(Math.round(PX + 10), Math.round(plane.y)); ctx.rotate(plane.ang * Math.PI / 180); if (plane.dead) ctx.globalAlpha = .95;
    ctx.drawImage(spr, Math.round(-26 * SC + 10), Math.round(-15 * SC), w, h);
    if (plane.shield || plane.hitT > 0) { ctx.strokeStyle = `rgba(49,215,199,${(.55 + .25 * Math.sin(t * 8)).toFixed(2)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(8, 2, 58, 30, 0, 0, 7); ctx.stroke(); ctx.fillStyle = "rgba(49,215,199,.15)"; ctx.fill(); }
    ctx.restore();
  }
  function drawEffects() {
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    for (const f of floats) { ctx.globalAlpha = clamp(1.7 - f.t / f.life * 1.7 + .2, 0, 1); outlinedText(f.text, f.x, f.y, f.color, `9px ${FONT_PX}`); } ctx.globalAlpha = 1;
    if (gust) { const a = gust.on ? .5 : (Math.floor(gust.t * 8) % 2 ? .9 : .3); ctx.globalAlpha = a; ctx.fillStyle = "#f7f0d5"; for (let i = 0; i < 5; i++) { const y = gust.dir < 0 ? 80 + i * 90 : 520 - i * 90; ctx.fillRect(W - 80, y, 36, 5); ctx.fillRect(W - 54, y + (gust.dir < 0 ? -8 : 8), 5, 5); } ctx.globalAlpha = 1; if (!gust.on) outlinedText(gust.dir < 0 ? "RACHA ASCENDENTE" : "RACHA DESCENDENTE", W / 2, 140, "#ff7a2e", `9px ${FONT_PX}`); else if (gust.on) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const y = ((t * 300 * gust.dir + i * 60) % 560 + 560) % 560; ctx.beginPath(); ctx.moveTo(100 + i * 60, y); ctx.lineTo(100 + i * 60, y + 24 * gust.dir); ctx.stroke(); } } }
    if (rain.length) { ctx.strokeStyle = "rgba(190,210,255,.45)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (const r of rain) { ctx.moveTo(Math.round(r.x), Math.round(r.y)); ctx.lineTo(Math.round(r.x - 8), Math.round(r.y + 16)); } ctx.stroke(); if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${(flash * .5).toFixed(2)})`; ctx.fillRect(0, 0, W, H); } }
  }
  function drawBubble() {
    const b = bubbles[0]; if (!b || plane.dead) return; ctx.font = `22px ${FONT_T}`; const w = Math.ceil(ctx.measureText(b.text).width) + 18, h = 28, x = clamp(Math.round(PX + 20 - w / 2), 8, W - w - 8), y = Math.round(plane.y - 82);
    ctx.globalAlpha = clamp(Math.min(b.t / .12, (b.life - b.t) / .25, 1), 0, 1); ctx.fillStyle = "#050814"; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.fillStyle = "#f7f0d5"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#050814"; ctx.beginPath(); ctx.moveTo(PX + 12, y + h + 3); ctx.lineTo(PX + 26, y + h + 3); ctx.lineTo(PX + 22, y + h + 13); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#f7f0d5"; ctx.beginPath(); ctx.moveTo(PX + 14, y + h); ctx.lineTo(PX + 24, y + h); ctx.lineTo(PX + 22, y + h + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#101629"; ctx.textAlign = "left"; ctx.fillText(b.text, x + 9, y + 21); ctx.globalAlpha = 1;
  }
  function drawHud() {
    // mapa de ruta: Madrid -> destino
    const x0 = 70, x1 = W - 70, y = 26; ctx.fillStyle = "rgba(5,8,20,.55)"; ctx.fillRect(x0 - 56, 8, x1 - x0 + 112, 38);
    if (trip.endless) { outlinedText(`ESCALA ${passed}`, W / 2, 34, "#3cff7a", `12px ${FONT_PX}`); ctx.font = `7px ${FONT_PX}`; ctx.textAlign = "left"; ctx.fillStyle = "#aab4d5"; ctx.fillText("VUELO SIN FIN", x0 - 50, 40); ctx.textAlign = "right"; ctx.fillText(`RECORD ${prog.endless || 0}`, x1 + 50, 40); } else {
    ctx.font = `7px ${FONT_PX}`; ctx.textAlign = "left"; ctx.fillStyle = "#aab4d5"; ctx.fillText("MADRID", x0 - 50, 40); ctx.textAlign = "right"; ctx.fillText(trip.name.length > 14 ? "FIN" : trip.name, x1 + 50, 40);
    ctx.fillStyle = "#27345b"; for (let x = x0; x < x1; x += 12) ctx.fillRect(x, y, 6, 3);
    const k = clamp((passed + (phase === "rollout" || phase === "done" ? 1 : 0)) / trip.K, 0, 1), px = lerp(x0, x1, k);
    ctx.fillStyle = "#ffd34e"; for (let x = x0; x < px; x += 12) ctx.fillRect(x, y, 6, 3);
    ctx.fillStyle = "#f7f0d5"; ctx.fillRect(Math.round(px) - 7, y - 4, 14, 5); ctx.fillRect(Math.round(px) - 2, y - 8, 4, 12); ctx.fillStyle = "#ff4d61"; ctx.fillRect(Math.round(px) - 7, y - 1, 5, 2); }
    if (plane.turbo > 0) { ctx.fillStyle = "#050814"; ctx.fillRect(W - 128, 54, 116, 12); ctx.fillStyle = "#ff7a2e"; ctx.fillRect(W - 126, 56, Math.round(112 * plane.turbo / 3.2), 8); outlinedText("DECRETO LEY", W - 70, 80, "#ff7a2e", `7px ${FONT_PX}`); }
    if (plane.shield) outlinedText("INMUNIDAD", 70, 66, "#31d7c7", `7px ${FONT_PX}`);
  }
  function render() {
    ctx.save(); if (shakeT > 0) ctx.translate(Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM)));
    drawSky(); drawGround(); drawRunway();
    for (const o of obstacles) drawObstacle(o); for (const p of pickups) drawPickup(p);
    drawPlane(); drawEffects(); drawBubble(); ctx.restore();
    drawHud();
    if (paT > 0) { ctx.globalAlpha = clamp(Math.min(paT / .3, (4.2 - paT) / .2, 1), 0, 1); ctx.font = `21px ${FONT_T}`; const w = Math.min(740, Math.ceil(ctx.measureText(paText).width) + 28), x = Math.round((W - w) / 2), y = 88; ctx.fillStyle = "#050814"; ctx.fillRect(x - 3, y - 3, w + 6, 36); ctx.fillStyle = "#17213c"; ctx.fillRect(x, y, w, 30); ctx.fillStyle = "#ffd34e"; ctx.fillRect(x, y, 6, 30); ctx.fillStyle = "#f7f0d5"; ctx.textAlign = "left"; ctx.fillText(paText, x + 16, y + 22, w - 28); ctx.globalAlpha = 1; }
    if (bannerT > 0) { ctx.globalAlpha = clamp(bannerT / .5, 0, 1); outlinedText(`VIAJE ${tripN}`, W / 2, 210, "#ffd34e", `22px ${FONT_PX}`); outlinedText(`DESTINO: ${trip.name}`, W / 2, 246, "#f7f0d5", `12px ${FONT_PX}`); ctx.font = `22px ${FONT_T}`; ctx.fillStyle = "#050814"; ctx.fillText(trip.sub, W / 2 + 1, 281); ctx.fillStyle = "#aab4d5"; ctx.fillText(trip.sub, W / 2, 280); ctx.globalAlpha = 1; }
    if (tipT > 0 && bannerT <= 0 && trip.tip) drawTip(trip.tip, clamp(tipT / .4, 0, 1));
    if (phase === "ready" && bannerT <= 0 && Math.floor(t * 2.5) % 2) outlinedText("TOCA PARA DAR GAS", W / 2, 230, "#3cff7a", `14px ${FONT_PX}`);
    if (landMsgT > 0 && Math.floor(landMsgT * 4) % 2) outlinedText("APROXIMACION: SIGUE LAS LUCES", W / 2, 150, "#3cff7a", `10px ${FONT_PX}`);
  }
  function drawTip(txt, a) {
    ctx.globalAlpha = a; ctx.font = `21px ${FONT_T}`; const words = txt.split(" "), lines = [""]; for (const w of words) { const s = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (ctx.measureText(s).width > 600) lines.push(w); else lines[lines.length - 1] = s; }
    const h = 12 + lines.length * 24, y = 120; ctx.fillStyle = "#050814"; ctx.fillRect(82, y - 3, 636, h + 6); ctx.fillStyle = "#17213c"; ctx.fillRect(85, y, 630, h); ctx.fillStyle = "#31d7c7"; ctx.fillRect(85, y, 6, h); ctx.fillStyle = "#f7f0d5"; ctx.textAlign = "left"; lines.forEach((l, i) => ctx.fillText(l, 104, y + 24 + i * 24)); ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------------- bucle */
  function frame(now) {
    if (!last) last = now; const dt = clamp((now - last) / 1000, 0, .1); last = now;
    if (state === "playing") { acc += dt; let n = 0; while (acc >= FIXED && n++ < 12) { update(FIXED); acc -= FIXED; } if (n >= 12) acc = 0; }
    render(); requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------------------- entrada */
  addEventListener("keydown", e => {
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "playing") pauseScreen(); else if (state === "paused") resume(); return; }
    if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) { if (state === "playing" || state === "paused") playTrip(tripN); return; }
    if (["Space", "ArrowUp", "KeyW"].includes(e.code) && state === "playing") { e.preventDefault(); if (!e.repeat) flap(); }
  });
  canvas.addEventListener("pointerdown", e => { if (state === "playing") { e.preventDefault(); flap(); } });
  const flapBtn = $(".touch .up"); if (flapBtn) flapBtn.addEventListener("pointerdown", e => { e.preventDefault(); flapBtn.classList.add("on"); flap(); }), ["pointerup", "pointercancel", "pointerleave"].forEach(ev => flapBtn.addEventListener(ev, () => flapBtn.classList.remove("on")));
  addEventListener("blur", () => { if (state === "playing") pauseScreen(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseScreen(); });
  UI.pause.addEventListener("click", () => state === "paused" ? resume() : pauseScreen());
  UI.restart.addEventListener("click", () => { if (state !== "title") playTrip(tripN); });
  UI.sound.addEventListener("click", () => { soundOn = !soundOn; store.set("ff-sound", soundOn ? "1" : "0"); AUD.setOn(soundOn); paintSound(); if (soundOn) { sfx.vote(); if (state === "playing") music.start(tripN); } });

  /* ------------------------------------------------------------------ inicio */
  AUD.setOn(soundOn); paintSound(); startTrip(1, true); titleScreen();
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('22px "VT323"')]).catch(() => {});
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, phase, trip: tripN, passed, K: trip.K, score, votes, y: Math.round(plane.y), vy: Math.round(plane.vy), dead: plane.dead, shield: plane.shield, turbo: +plane.turbo.toFixed(1), obstacles: obstacles.length, runwayX: runway ? Math.round(runway.x) : null, speed: Math.round(speed) });
    window.__ff = {
      step: (n = 1, dt = FIXED, draw = true) => { for (let i = 0; i < n; i++) update(dt); if (draw) render(); return snap(); }, snap,
      trip: n => { playTrip(n, true); render(); return snap(); }, flap, obs: () => obstacles.map(o => ({ x: Math.round(o.x), gt: Math.round(gapTop(o)), gap: o.gap })), pk: () => pickups.map(p => ({ t: p.type, x: Math.round(p.x), y: Math.round(p.y) })),
      setY: y => { plane.y = y; plane.vy = 0; }, give: type => collectPickup({ type, x: PX, y: plane.y, t: 0 }), render, map: () => mapScreen(), title: () => titleScreen(), plane: () => ({ y: plane.y, vy: plane.vy, ang: plane.ang }),
      runway: () => runway && { x: runway.x, len: runway.len }, goApproach: () => { passed = trip.K; phase = "cruise"; obstacles = []; spawned = trip.K; update(FIXED); return snap(); }
    };
  }
})();
