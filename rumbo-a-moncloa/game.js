"use strict";
/* Rumbo a la Moncloa — Sanxe Games.
   Frogger satírico: el candidato gallego de pelo plateado ganó las elecciones (137 escaños), cruza la carretera de las encuestas y el río de los
   titulares, esquiva a los reporteros y consigue a los cinco socios que faltan. Tres etapas: Galicia, Madrid y Bruselas. */
(() => {
  const AUD = window.RM_AUD, sfx = AUD.sfx, music = AUD.music;
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
  const W = 800, H = 600, T = 50, COLS = 16, FIXED = 1 / 120;
  const GOAL_ROW = 0, MEDIAN = 5, START_ROW = 10;
  const DOORS = [1, 4, 7, 10, 13], DOOR_W = 2, SEATS = [8, 8, 8, 8, 7], BASE = 137, GOAL = 176;
  const SOCIOS = [
    { n: "EL DE LA BANDERA", s: "BANDERA", ask: "Quiero una bandera en cada rotonda", col: "#3cff7a" },
    { n: "EL VASCO", s: "EL VASCO", ask: "Un concierto... económico", col: "#ff4d61" },
    { n: "EL CATALÁN", s: "EL CATALÁN", ask: "Una mesa. De negociación. Con mantel", col: "#ffd34e" },
    { n: "EL CANARIO", s: "CANARIO", ask: "Una palmera de interés general", col: "#31d7c7" },
    { n: "EL NAVARRO", s: "NAVARRO", ask: "Un San Fermín por decreto", col: "#ff8a3d" }
  ];
  const THEMES = [
    { name: "GALICIA", sub: "Orvallo, empanada y mayoría absoluta... en las encuestas", water: ["#14636f", "#177483"], hi: "rgba(160,235,230,.16)", median: ["#4a7550", "#5f9460", "#3a5c40"], road: "#262f33", curb: "#59695f", rain: true },
    { name: "MADRID", sub: "Gran Vía, ruido y tertulia a todas horas", water: ["#1a4a8a", "#1d5192"], hi: "rgba(255,255,255,.12)", median: ["#5a5f78", "#6d7391", "#44485f"], road: "#2b2f3e", curb: "#6d7391", rain: false },
    { name: "BRUSELAS", sub: "Aquí se pacta hasta el aparcamiento", water: ["#232f72", "#2b3a86"], hi: "rgba(255,230,120,.14)", median: ["#4a5a88", "#6477ad", "#37436a"], road: "#2c3050", curb: "#5b6a9a", rain: false }
  ];
  const DEATHS = {
    coche: ["¡Atropellado por una encuesta!", "¡Eso era un autobús de campaña!", "¡Se lo llevó el camión del pulpo!", "¡Otro sondeo que no vio venir!"],
    agua: ["¡Ahogado en un titular!", "¡Se hundió la tertulia!", "¡Cayó al río de las opiniones!", "¡Ni el albariño le salvó!"],
    tiempo: ["¡Se acabó el plazo de investidura!", "¡Demasiado lento: «depende» no es un plan!"],
    pared: ["¡Esa no era una puerta!", "¡Hay que entrar por la puerta, no por la pared!"],
    baron: ["¡El barón no te dejaba pasar!", "¡Fuego amigo desde Génova!"],
    cerrada: ["¡Ese socio ya es tuyo!", "¡Puerta ocupada!"],
    fuera: ["¡Arrastrado fuera del mapa!"],
    micro: ["¡Una pregunta incómoda!", "«¿Con quién va a pactar?» ¡KO!", "¡Un micrófono y se acabó la calma!"]
  };
  const QUIPS = ["¡Tengo un plan! Depende...", "Gané las elecciones. Lo dicen las encuestas.", "Faltan escaños…", "¿La escalera sube o baja? Según.", "La lista más votada gobierna, ¿no?", "En Ourense esto se arregla con un pulpo.", "Hay que mantener la calma.", "Sin socios no hay Gobierno.", "Yo soy un hombre tranquilo.", "Ni sí, ni no: todo lo contrario."];
  const TICKER = ["ÚLTIMA HORA: el candidato dice que gana. Las encuestas también.", "EL PARTIDO ASEGURA QUE LA ESCALERA SUBE... O BAJA", "UN SOCIO PIDE UNA PALMERA Y NADIE SABE POR QUÉ", "SE BUSCAN ESCAÑOS: SE VALORA EXPERIENCIA EN CARRETERA", "LA TERTULIA CONCLUYE QUE «DEPENDE»", "ORVALLO EN GALICIA: LAS ENCUESTAS SIGUEN SECAS", "GÉNOVA INFORMA: 137 ES UN NÚMERO MUY BONITO", "EL TRÁFICO DE SONDEOS ES DENSO EN LA M-176"];

  const UI = { seats: $("#seats"), round: $("#round"), lives: $("#lives"), score: $("#score"), status: $("#game-status"), overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"), sound: $("#sound"), pause: $("#pause"), restart: $("#restart"), help: $("#game-help") };
  let state = "title", soundOn = store.get("rm-sound") !== "0", best = +store.get("rm-best") || 0, bestRound = +store.get("rm-best-round") || 1;
  let lanes = [], doors = [], reporters = [], pl, pickup = null, particles = [], floats = [], bubble = null, bgs = [], input = null, theme = 0;
  let t = 0, acc = 0, last = 0, round = 1, lives = 3, score = 0, seats = BASE, clock = 30, clockMax = 30, evT = 5, shakeT = 0, shakeM = 0, bannerT = 0, bannerText = "", bannerSub = "", slowT = 0, clearT = 0, breakT = 0, deathMsg = "", stats = { doors: 0, deaths: 0, gaviotas: 0, pulpos: 0 }, quipT = 8, maxRow = START_ROW, streak = 0, flashT = 0, flashCol = "#fff", thunderT = 12;

  /* -------------------------------------------------------------- carriles */
  function makeLanes(r) {
    const k = 1 + Math.min(1.2, (r - 1) * .11);
    const specs = [
      { row: 9, dir: 1, speed: 78, kind: "road", type: "pulpo", w: 2, gap: 5.4 },
      { row: 8, dir: -1, speed: 118, kind: "road", type: "oficial", w: 1.6, gap: 6.2 },
      { row: 7, dir: 1, speed: 64, kind: "road", type: "sondeo", w: 1.5, gap: 4.4 },
      { row: 6, dir: -1, speed: 92, kind: "road", type: "bus", w: 3, gap: 7.4 },
      { row: 4, dir: 1, speed: 56, kind: "river", type: "tert", w: 3, gap: 5.2, dive: true },
      { row: 3, dir: -1, speed: 72, kind: "river", type: "editorial", w: 4, gap: 7.6 },
      { row: 2, dir: 1, speed: 96, kind: "river", type: "titular", w: 2, gap: 5.0 },
      { row: 1, dir: -1, speed: 62, kind: "river", type: "tert", w: 2, gap: 4.6, dive: true }
    ];
    return specs.map(s => {
      const gap = s.gap * T, wpx = s.w * T, n = Math.ceil((W + wpx + 320) / gap) + 1, off = rnd(0, gap), objs = [];
      for (let i = 0; i < n; i++) objs.push({ x: i * gap + off - wpx - 120, ph: rnd(0, 1), txt: s.type === "sondeo" ? (20 + Math.floor(Math.random() * 30)) + "," + Math.floor(Math.random() * 10) + "%" : "", head: pick(["TERTULIA", "DEBATE", "OPINION"]), flash: pick(["URGENTE", "BOMBAZO", "EXCLUSIVA"]), col: pick(["#1b5fd1", "#d9465b", "#2b9a5a", "#ffb347"]) });
      return { ...s, speed: s.speed * k, wpx, gap, total: n * gap, objs, cy: s.row * T + T / 2 };
    });
  }
  const surfaced = (lane, o) => !lane.dive || ((t * .35 + o.ph) % 1) < .72;
  function makeReporters(r) {
    const n = Math.min(3, 1 + Math.floor((r - 1) / 2)), sp = 40 + Math.min(60, r * 7), out = [];
    for (let i = 0; i < n; i++) out.push({ x: ((i + .5) / n) * W + rnd(-60, 60), dir: i % 2 ? -1 : 1, speed: sp * rnd(.9, 1.15) });
    return out;
  }
  function moveWorld(ldt) {
    for (const l of lanes) for (const o of l.objs) { o.x += l.dir * l.speed * ldt; if (l.dir > 0 && o.x > W + 120) o.x -= l.total; else if (l.dir < 0 && o.x < -l.wpx - 120) o.x += l.total; }
    for (const r of reporters) { r.x += r.dir * r.speed * ldt; if (r.x < 24) { r.x = 24; r.dir = 1; } else if (r.x > W - 24) { r.x = W - 24; r.dir = -1; } }
  }

  /* --------------------------------------------------------------- partida */
  function resetDoors() { doors = DOORS.map(() => ({ filled: false, ev: null })); }
  function newPlayer() { return { x: 7 * T + T / 2, y: START_ROW * T + T / 2, row: START_ROW, hop: null, dead: false, deadT: 0, kind: "", frame: 0, facing: 1, dir: "up" }; }
  function respawn() { pl = newPlayer(); clock = clockMax; maxRow = START_ROW; deathMsg = ""; }
  function updateHud() { UI.seats.textContent = seats; UI.round.textContent = round; UI.lives.textContent = lives; UI.score.textContent = pad(score, 5); }
  const setControls = () => { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; };
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };
  function startRound() {
    theme = (round - 1) % THEMES.length; lanes = makeLanes(round); reporters = makeReporters(round); resetDoors(); pickup = null; clockMax = Math.max(20, 32 - round * 1.5); evT = 4; slowT = 0; clearT = 0; thunderT = rnd(8, 14);
    respawn(); updateHud(); music.setTheme(theme); music.setLevel(round);
    bannerT = 3; bannerText = `ETAPA ${round}: ${THEMES[theme].name}`; bannerSub = THEMES[theme].sub;
  }
  function reset() { round = 1; lives = 3; score = 0; seats = BASE; streak = 0; stats = { doors: 0, deaths: 0, gaviotas: 0, pulpos: 0 }; particles = []; floats = []; bubble = null; breakT = 0; startRound(); }

  /* ---------------------------------------------------------------- pantallas */
  function showOverlay({ stamp = "SÁTIRA PIXELADA", title, text = "", extra = "", actions = [], help = false }) {
    UI.help.hidden = !help; UI.stamp.textContent = stamp; UI.title.textContent = title; UI.text.textContent = text; UI.text.hidden = !text;
    if (typeof extra === "string") UI.extra.innerHTML = extra; else { UI.extra.innerHTML = ""; UI.extra.appendChild(extra); }
    UI.actions.innerHTML = "";
    actions.forEach((a, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a.secondary ? " secondary" : ""); b.textContent = a.label; b.addEventListener("click", a.fn); UI.actions.appendChild(b); if (i === 0) requestAnimationFrame(() => b.focus()); });
    UI.overlay.classList.remove("hidden"); fixAccents(UI.overlay);
  }
  const hideOverlay = () => UI.overlay.classList.add("hidden");
  const goHome = () => { location.href = "../"; };
  function fichaNode() {
    const box = document.createElement("div"); box.className = "ficha";
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 80; cv.setAttribute("aria-hidden", "true"); const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    g.fillStyle = "#16224a"; g.fillRect(0, 0, 64, 80); g.fillStyle = "#1d2d63"; g.fillRect(0, 54, 64, 26); g.fillStyle = "#2b6cff"; g.fillRect(0, 0, 64, 6);
    for (let i = 0; i < 5; i++) { g.fillStyle = "#f7f0d5"; g.fillRect(5 + i * 12, 2, 6, 2); }
    g.save(); g.translate(32, 44); g.scale(1.7, 1.7); drawCandidate(g, { dir: "down", step: 0, hopK: -1 }); g.restore();
    box.appendChild(cv);
    const dl = document.createElement("dl");
    [["CANDIDATO", "EL GALLEGO"], ["PELO", "PLATA, SIEMPRE EN SU SITIO"], ["LEMA", "«DEPENDE»"], ["SUPERPODER", "GANAR ENCUESTAS"], ["DEBILIDAD", "LA ESCALERA: ¿SUBE O BAJA?"]].forEach(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
    box.appendChild(dl); return box;
  }
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    showOverlay({ help: true, stamp: "CAMPAÑA DE LA LISTA MÁS VOTADA", title: "RUMBO A LA MONCLOA", text: `Ganó las elecciones con 137 escaños. Para gobernar faltan 39: cruza la carretera de las encuestas, salta por el río de los titulares y llama a cinco puertas.${best ? ` Récord: ${best}.` : ""}`, extra: fichaNode(), actions: [{ label: "EMPEZAR LA CAMPAÑA", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function play() { state = "playing"; reset(); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(1); UI.status.textContent = "Cruza hasta las puertas del palacio."; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now(); }
  function pauseScreen() { if (state !== "playing") return; state = "paused"; setControls(); music.pause(true); showOverlay({ help: true, stamp: "TRÁFICO DETENIDO", title: "PAUSA", text: "Por una vez, los coches esperan al candidato.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR", secondary: true, fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] }); }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function gameOver() {
    state = "over"; setControls(); music.stop(); sfx.over(); const nb = score > best; if (nb) { best = score; store.set("rm-best", String(best)); } if (round > bestRound) { bestRound = round; store.set("rm-best-round", String(bestRound)); }
    const heads = [["GANÓ LAS ELECCIONES, PERDIÓ EL GOBIERNO", "Tuvo la lista más votada, pero no pasó de la carretera."], ["SIN SOCIOS NO HAY MONCLOA", `Se quedó en ${seats} escaños, a ${GOAL - seats} del sueño.`], ["INVESTIDURA FALLIDA", "El candidato dice que «el resultado es una victoria moral»."], ["EL GALLEGO SE QUEDA A MEDIO CAMINO", "Preguntado por si sube o baja, responde: «Depende»."]];
    const h = seats >= 168 ? ["A UN PASO DE LA MONCLOA", `${seats} escaños: a ${GOAL - seats} de gobernar. Culpa, dice, «del tráfico».`] : pick(heads);
    UI.status.textContent = `Fin de la campaña con ${score} puntos.`;
    showOverlay({ stamp: `ETAPA ${round}: ${THEMES[theme].name}`, title: h[0], text: `${score} puntos${nb ? " (¡récord!)" : `. Récord: ${best}`}. Socios conseguidos: ${stats.doors}. Caídas: ${stats.deaths}.`, extra: `<p class="headline"><b>ÚLTIMA HORA</b>${h[1]}<small>Mejor ronda: ${bestRound} · Gaviotas cazadas: ${stats.gaviotas} · Pulpos: ${stats.pulpos}</small></p>`, actions: [{ label: "OTRA CAMPAÑA", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }

  /* ------------------------------------------------------------------ efectos */
  const shake = (m, d = .3) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, d); };
  const float = (x, y, text, color, life = 1.3) => floats.push({ x, y, text, color, t: 0, life });
  const say = (text, life = 2.2) => { bubble = { text, t: 0, life }; };
  function burst(x, y, color, n = 10, sp = 180) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: rnd(.4, .9), color, s: pick([3, 4, 5, 6]), g: 520 }); } }
  const flash = (c = "#fff", d = .18) => { if (!reduced) { flashT = d; flashCol = c; } };

  /* ------------------------------------------------------------------ movimiento */
  const snapX = x => clamp((Math.floor(x / T) + .5) * T, T / 2, W - T / 2);
  function hop(dir) {
    if (state !== "playing" || breakT > 0 || !pl || pl.dead || pl.hop) return;
    let tx = pl.x, ty = pl.y, row = pl.row;
    if (dir === "up") { row = pl.row - 1; if (row < GOAL_ROW) return; ty = row * T + T / 2; }
    else if (dir === "down") { row = pl.row + 1; if (row > START_ROW) return; ty = row * T + T / 2; }
    else if (dir === "left") { tx = pl.x - T; if (tx < T / 2 - 4) return; pl.facing = -1; }
    else if (dir === "right") { tx = pl.x + T; if (tx > W - T / 2 + 4) return; pl.facing = 1; }
    if ((dir === "up" || dir === "down") && !(row >= 1 && row <= 4)) tx = snapX(pl.x);
    pl.dir = dir; pl.hop = { t: 0, dur: .12, fx: pl.x, fy: pl.y, tx, ty, row }; sfx.hop();
  }
  function laneAt(row) { return lanes.find(l => l.row === row); }
  function carHit(px, py) {
    const row = Math.floor(py / T), lane = laneAt(row);
    if (!lane || lane.kind !== "road" || clearT > 0) return false;
    for (const o of lane.objs) if (px + 12 > o.x + 6 && px - 12 < o.x + lane.wpx - 6) return true;
    return false;
  }
  function kill(kind) {
    if (pl.dead) return; pl.dead = true; pl.deadT = 0; pl.kind = kind; pl.hop = null; lives--; streak = 0; stats.deaths++; deathMsg = pick(DEATHS[kind] || ["¡Ay!"]);
    if (kind === "coche") { sfx.squash(); shake(7, .45); burst(pl.x, pl.y, "#f7f0d5", 10); burst(pl.x, pl.y, "#ff4d61", 8); burst(pl.x, pl.y, "#dfe3ee", 6, 120); flash("#ff4d61", .16); }
    else if (kind === "agua") { sfx.splash(); burst(pl.x, pl.y, "#8fc8ff", 16, 220); }
    else if (kind === "micro") { sfx.micro(); shake(4, .3); burst(pl.x, pl.y, "#f7f0d5", 10); burst(pl.x, pl.y, "#ffd34e", 6, 120); }
    else { sfx.baron(); shake(4, .3); burst(pl.x, pl.y, "#ffd34e", 10); }
    say(deathMsg, 2.4); updateHud();
  }
  function land() {
    const row = pl.row;
    if (row < maxRow) { maxRow = row; score += 10; sfx.forward(); updateHud(); }
    if (row === MEDIAN) { if (!pl.seenMedian) { pl.seenMedian = true; if (Math.random() < .35) say(pick(["Un respiro. Y una empanada.", "Aquí no llueve... tanto.", "¡Que no me pille un micrófono!"])); } if (pickup) { const pc = pickup.col * T + T / 2; if (Math.abs(pl.x - pc) < T * .6) takePickup(); } }
    if (row === GOAL_ROW) reachGoal();
  }
  function reachGoal() {
    let di = -1;
    DOORS.forEach((c, i) => { if (pl.x > c * T + 8 && pl.x < (c + DOOR_W) * T - 8) di = i; });
    if (di < 0) { kill("pared"); return; }
    const d = doors[di];
    if (d.filled) { kill("cerrada"); return; }
    if (d.ev && d.ev.type === "baron" && d.ev.t > d.ev.warn) { kill("baron"); return; }
    d.filled = true; stats.doors++; seats += SEATS[di]; streak++; const mult = Math.min(3, streak), bonus = (50 + Math.floor(clock) * 2) * mult; score += bonus;
    const dx = (DOORS[di] + DOOR_W / 2) * T, gav = d.ev && d.ev.type === "gaviota", so = SOCIOS[di];
    if (gav) { score += 200; stats.gaviotas++; sfx.gaviota(); float(dx, 150, "+200 ¡LA GAVIOTA!", "#f7f0d5", 1.6); }
    d.ev = null; sfx.socio(); float(dx, 112, `${so.n}: +${SEATS[di]} ESCAÑOS`, so.col, 1.9); float(dx, 138, `«${so.ask}»`, "#f7f0d5", 2.2); if (mult > 1) float(dx, 164, `RACHA x${mult}`, "#ffd34e", 1.5);
    burst(dx, 25, "#ffd34e", 14); burst(dx, 25, so.col, 8, 140); shake(3, .25); flash("#ffd34e", .12); updateHud();
    if (!pickup && Math.random() < .6) { const r = Math.random(); pickup = { type: r < .28 ? "derogar" : r < .56 ? "encuesta" : r < .8 ? "empanada" : "pulpo", col: Math.floor(rnd(1, COLS - 1)), t: 0 }; }
    if (doors.every(x => x.filled)) roundDone(); else respawn();
  }
  function roundDone() {
    sfx.round(); score += 1000; bannerText = "¡176 ESCAÑOS!"; bannerSub = `Investidura conseguida. Etapa ${round + 1}: ${THEMES[round % THEMES.length].name}.`; bannerT = 3; breakT = 3; lives = Math.min(5, lives + 1);
    float(W / 2, 200, "+1000 · +1 VIDA", "#ffd34e", 2); say("¡Presidente! ...al menos hasta la próxima ronda.", 3); updateHud(); flash("#ffd34e", .35);
    pl.dead = false; pl.hop = null;
  }
  function takePickup() {
    const ty = pickup.type; burst(pl.x, pl.y, "#ffd34e", 12);
    if (ty === "derogar") { sfx.pickup(); clearT = 5; sfx.derogar(); float(pl.x, pl.y - 30, "¡DEROGAR! TRÁFICO FUERA", "#ffd34e", 1.6); say("¡Todo derogado!"); }
    else if (ty === "encuesta") { sfx.pickup(); slowT = 7; float(pl.x, pl.y - 30, "ENCUESTA FAVORABLE: TODO MÁS LENTO", "#31d7c7", 1.8); say("¡Las encuestas me sonríen!"); }
    else if (ty === "empanada") { sfx.empanada(); clock = Math.min(clockMax + 6, clock + 8); float(pl.x, pl.y - 30, "EMPANADA: +8 SEGUNDOS", "#ffb347", 1.7); say("Una empanada y a seguir."); }
    else { sfx.pulpo(); lives = Math.min(5, lives + 1); stats.pulpos++; updateHud(); float(pl.x, pl.y - 30, "¡PULPO A FEIRA! +1 VIDA", "#ff8a3d", 1.9); say("¡Pulpo a feira! Mejor que un pacto."); }
    pickup = null;
  }

  /* ------------------------------------------------------------- simulación */
  function update(dt) {
    if (state !== "playing") return;
    t += dt; bannerT = Math.max(0, bannerT - dt); shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt); slowT = Math.max(0, slowT - dt); clearT = Math.max(0, clearT - dt);
    const ts = slowT > 0 ? .5 : 1, ldt = dt * ts;
    moveWorld(ldt);
    if (THEMES[theme].rain) { thunderT -= dt; if (thunderT <= 0) { thunderT = rnd(10, 18); flash("#cfe6ff", .22); sfx.thunder(); } }
    if (breakT > 0) { breakT -= dt; if (breakT <= 0) { round++; startRound(); } }
    else if (pl) {
      if (pl.dead) { pl.deadT += dt; if (pl.deadT > 1.1) { if (lives <= 0) { gameOver(); return; } respawn(); } }
      else {
        clock -= dt; if (clock <= 0) { clock = 0; kill("tiempo"); }
        else if (clock < 6 && Math.floor(clock) !== Math.floor(clock + dt)) sfx.tick();
        if (pl.hop) { const h = pl.hop; h.t += dt; const k = clamp(h.t / h.dur, 0, 1); pl.x = h.fx + (h.tx - h.fx) * k; pl.y = h.fy + (h.ty - h.fy) * k - Math.sin(k * Math.PI) * 10; if (k >= 1) { pl.x = h.tx; pl.y = h.ty; pl.row = h.row; pl.hop = null; land(); if (pl.dead) return; } }
        if (!pl.dead) {
          const row = Math.floor(clamp(pl.y, 0, H - 1) / T);
          if (row >= 6 && row <= 9 && carHit(pl.x, pl.y)) { kill("coche"); }
          else if (!pl.hop && pl.row >= 1 && pl.row <= 4) {
            const lane = laneAt(pl.row); let ride = false;
            for (const o of lane.objs) if (surfaced(lane, o) && pl.x > o.x + 6 && pl.x < o.x + lane.wpx - 6) { ride = true; break; }
            if (ride) { pl.x += lane.dir * lane.speed * ldt; if (pl.x < -4 || pl.x > W + 4) kill("fuera"); } else kill("agua");
          } else if (!pl.hop && pl.row === MEDIAN) { for (const r of reporters) if (Math.abs(pl.x - r.x) < 28) { kill("micro"); break; } }
        }
        // eventos en las puertas
        evT -= dt; if (evT <= 0) { evT = rnd(5, 9) / (1 + round * .08); const free = doors.map((d, i) => i).filter(i => !doors[i].filled && !doors[i].ev); if (free.length) { const i = pick(free), baron = Math.random() < .55; doors[i].ev = { type: baron ? "baron" : "gaviota", t: 0, warn: baron ? 1 : 0, life: baron ? 5 : 7 }; if (baron) sfx.warn(); } }
        for (const d of doors) if (d.ev) { d.ev.t += dt; if (d.ev.t > d.ev.life) d.ev = null; }
        if (pickup) { pickup.t += dt; if (pickup.t > 14) pickup = null; }
        quipT -= dt; if (quipT <= 0 && !bubble) { quipT = rnd(9, 15); say(pick(QUIPS)); }
      }
    }
    stepFx(dt);
  }
  function stepFx(dt) {
    for (const p of particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } particles = particles.filter(p => p.t < p.life);
    for (const f of floats) { f.t += dt; f.y -= 30 * dt; } floats = floats.filter(f => f.t < f.life);
    if (bubble) { bubble.t += dt; if (bubble.t > bubble.life) bubble = null; }
  }
  function idle(dt) { t += dt; moveWorld(dt * .6); stepFx(dt); }

  /* ----------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function outlinedText(txt, x, y, color, font, align = "center") { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814"; [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y); }

  /* El candidato: pelo plateado, gafas finas, traje azul marino, corbata azul. dir: up | down | left | right. */
  function drawCandidate(g, { dir = "up", step = 0, hopK = -1 }) {
    const B = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    const air = hopK >= 0, k = air ? Math.sin(hopK * Math.PI) : 0, lo = air ? 2 + Math.round(k * 2) : 0;
    const SUIT = "#17306b", SUIT_D = "#10234e", SKIN = "#efc3a0", SKIN_D = "#d89d7c", HAIR = "#dfe3ee", HAIR_D = "#aab4cf", FRAME = "#2a3047";
    const side = dir === "left" || dir === "right";
    g.save(); if (dir === "left") g.scale(-1, 1);
    B("#050814", -13, -25, 26, 48);                                              // contorno
    // piernas
    const l1 = air ? 6 + lo : 6 + (step ? 2 : 0), l2 = air ? 6 + lo : 6 + (step ? 0 : 2);
    B("#101a3a", -8, 14, 6, l1); B("#101a3a", 2, 14, 6, l2); B("#050814", -9, 14 + l1, 8, 3); B("#050814", 1, 14 + l2, 8, 3);
    if (side) {
      B(SUIT, -8, -5, 16, 20); B(SUIT_D, -8, -5, 4, 20); B("#f7f0d5", 4, -5, 3, 8); B("#2b6cff", 5, -3, 2, 9);
      B(SUIT, -3 + (air ? 3 : step ? -2 : 2), -3, 6, 13); B(SKIN_D, -3 + (air ? 3 : step ? -2 : 2), 10, 6, 4);
      B(SKIN, -6, -22, 14, 16); B(HAIR, -8, -25, 17, 8); B(HAIR, -8, -20, 4, 9); B(HAIR_D, -8, -19, 2, 8); B("#fff", -2, -25, 6, 2);
      B(FRAME, 1, -15, 7, 4); B("#a9d4ff", 2, -14, 5, 2); B("#101629", 5, -14, 1, 2); B(SKIN_D, 8, -11, 2, 3); B("#b5655a", 2, -8, 5, 1);
    } else if (dir === "up") {
      B(SUIT, -10, -5, 20, 20); B(SUIT_D, -1, -5, 2, 20);
      B(SUIT, -14 - (air ? 2 : 0), -4, 5, 13 + (air ? 3 : 0)); B(SUIT, 9 + (air ? 2 : 0), -4, 5, 13 + (air ? 3 : 0)); B(SKIN_D, -14 - (air ? 2 : 0), 9 + (air ? 3 : 0), 5, 4); B(SKIN_D, 9 + (air ? 2 : 0), 9 + (air ? 3 : 0), 5, 4);
      B(HAIR, -9, -25, 18, 20); B(HAIR_D, -9, -14, 3, 8); B(HAIR_D, 6, -14, 3, 8); B("#fff", -5, -24, 7, 2); B(SKIN_D, -9, -10, 2, 4); B(SKIN_D, 7, -10, 2, 4); B(HAIR_D, -6, -9, 12, 3);
    } else {
      B(SUIT, -10, -5, 20, 20); B(SUIT_D, -10, -5, 5, 20); B(SUIT_D, 5, -5, 5, 20);
      B("#f7f0d5", -3, -5, 6, 8); B("#2b6cff", -1, -3, 3, 11); B("#7fa6ff", -1, -3, 1, 10); B("#ffd34e", -8, 0, 2, 2);
      B(SUIT, -14 - (air ? 2 : 0), -4, 5, 13 + (air ? 3 : 0)); B(SUIT, 9 + (air ? 2 : 0), -4, 5, 13 + (air ? 3 : 0)); B(SKIN, -14 - (air ? 2 : 0), 9 + (air ? 3 : 0), 5, 4); B(SKIN, 9 + (air ? 2 : 0), 9 + (air ? 3 : 0), 5, 4);
      B(SKIN, -8, -21, 16, 16); B(HAIR, -9, -25, 18, 8); B(HAIR, -9, -20, 3, 8); B(HAIR, 6, -20, 3, 8); B(HAIR_D, -9, -19, 1, 7); B("#fff", -5, -25, 7, 2);
      B(FRAME, -7, -15, 6, 4); B(FRAME, 1, -15, 6, 4); B("#a9d4ff", -6, -14, 4, 2); B("#a9d4ff", 2, -14, 4, 2); B(FRAME, -1, -14, 2, 1); B("#101629", -4, -14, 1, 2); B("#101629", 4, -14, 1, 2);
      B(HAIR_D, -7, -17, 5, 1); B(HAIR_D, 2, -17, 5, 1); B(SKIN_D, -1, -11, 2, 2); B("#b5655a", -3, -8, 6, 1); B("#b5655a", -4, -9, 1, 1); B("#b5655a", 3, -9, 1, 1);
    }
    g.restore();
  }

  function facadeFlag(x, kind) {
    R("#c9d2e8", x - 1, 4, 2, 24); R("#ffd34e", x - 2, 2, 4, 3);
    for (let i = 0; i < 9; i++) {
      const y = 6 + Math.round(Math.sin(t * 4 + i * .7) * 1.4), px = x + 1 + i * 2;
      if (kind === "gal") { R("#f7f0d5", px, y, 2, 12); const d = Math.round((i / 8) * 10); R("#2b6cff", px, y + d - 1, 2, 3); }
      else { R("#c8323f", px, y, 2, 3); R("#ffd34e", px, y + 3, 2, 6); R("#c8323f", px, y + 9, 2, 3); }
    }
  }
  function buildBg(ti) {
    const th = THEMES[ti], c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), B = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    B("#0b1021", 0, 0, W, H);
    B("#232d5e", 0, 0, W, T); B("#2c3870", 0, 0, W, 4); B("#ffd34e", 0, 4, W, 2);                      // fachada del palacio
    for (let x = 0; x < W; x += 20) { B("#2c3870", x, 6, 2, T - 6); } for (let x = 0; x < W; x += 50) B("#1b2450", x, 24, 50, 1);
    DOORS.forEach(cc => { const x = cc * T; B("#050814", x + 4, 8, DOOR_W * T - 8, T - 8); B("#0e1633", x + 8, 12, DOOR_W * T - 16, T - 12); B("#c9d2e8", x + 2, 6, 3, T - 6); B("#c9d2e8", x + DOOR_W * T - 5, 6, 3, T - 6); B("#c9d2e8", x + 2, 6, DOOR_W * T - 4, 3); B("#ffd34e", x + DOOR_W * T / 2 - 3, 6, 6, 3); });
    for (let r = 1; r <= 4; r++) { B(th.water[r % 2], 0, r * T, W, T); B("rgba(0,0,0,.18)", 0, r * T, W, 2); }
    for (let x = 0; x < W; x += T) { B(th.median[0], x, MEDIAN * T, T, T); B(th.median[1], x, MEDIAN * T, T, 3); B(th.median[2], x + T - 2, MEDIAN * T, 2, T); B(th.median[2], x, MEDIAN * T + T - 2, T, 2); }
    // decoración de la mediana
    for (let x = 100, i = 0; x < W; x += 200, i++) {
      const y = MEDIAN * T;
      if (ti === 0) { if (i % 2) { B("#6b4423", x - 6, y + 28, 4, 12); B("#6b4423", x + 14, y + 28, 4, 12); B("#a8703a", x - 8, y + 12, 30, 18); B("#8a5a3b", x - 8, y + 12, 30, 3); B("#c98a4b", x - 10, y + 6, 34, 8); B("#6b4423", x + 5, y + 2, 3, 6); B("#6b4423", x + 3, y + 3, 7, 2); for (let k = 0; k < 5; k++) B("#6b4423", x - 4 + k * 6, y + 16, 2, 12); } else { B("#2e6b35", x, y + 18, 24, 18); B("#4a9a8f", x + 2, y + 14, 8, 8); B("#c86ab0", x + 12, y + 12, 8, 8); B("#4a7fd0", x + 6, y + 8, 8, 8); B("#3d8a46", x - 2, y + 28, 28, 8); } }
      else if (ti === 1) { if (i % 2) { B("#6b4423", x + 2, y + 14, 20, 16); B("#8a5a3b", x + 4, y + 16, 16, 12); B("#6b4423", x + 14, y + 8, 8, 8); B("#050814", x + 19, y + 11, 2, 2); B("#6b4423", x + 3, y + 30, 5, 6); B("#6b4423", x + 16, y + 30, 5, 6); B("#2b9a5a", x - 4, y + 4, 12, 12); B("#d9465b", x + 1, y + 8, 3, 3); } else { B("#3a3f56", x + 9, y + 6, 3, 28); B("#ffe38a", x + 4, y + 2, 14, 6); B("rgba(255,227,138,.22)", x, y + 8, 22, 26); } }
      else { if (i % 2) { B("#0b2a8a", x - 2, y + 8, 30, 20); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; B("#ffd34e", x + 13 + Math.cos(a) * 8, y + 17 + Math.sin(a) * 6, 2, 2); } B("#6b4423", x + 12, y + 28, 3, 10); } else { B("#e8b04a", x + 2, y + 14, 22, 20); for (let k = 0; k < 4; k++) { B("#c98a2a", x + 2, y + 14 + k * 5, 22, 1); B("#c98a2a", x + 2 + k * 6, y + 14, 1, 20); } B("#f7f0d5", x + 6, y + 10, 8, 6); B("#d9465b", x + 8, y + 8, 4, 3); } }
    }
    for (let r = 6; r <= 9; r++) { B(th.road, 0, r * T, W, T); if (r > 6) for (let x = 6; x < W; x += 56) B("#8d98b8", x, r * T - 1, 30, 3); }
    B("#050814", 0, 6 * T, W, 2); B("#050814", 0, 10 * T - 2, W, 2);
    for (let r = 10; r <= 11; r++) { for (let x = 0; x < W; x += T) { B(r === 10 ? th.curb : "#3a3f58", x, r * T, T, T); B("#2c3048", x, r * T + T - 2, T, 2); B("#2c3048", x + T - 2, r * T, 2, T); } }
    // sede de Génova y marquesina de noticias
    B("#17213c", 218, 11 * T + 4, 190, 42); B("#2c3870", 218, 11 * T + 4, 190, 4); B("#050814", 218, 11 * T + 4, 190, 1);
    B("#f7f0d5", 228, 11 * T + 16, 14, 4); B("#f7f0d5", 224, 11 * T + 20, 8, 3); B("#f7f0d5", 238, 11 * T + 20, 8, 3); B("#2b6cff", 232, 11 * T + 24, 6, 3);
    g.font = '24px "VT323", monospace'; g.textAlign = "left"; g.fillStyle = "#f7f0d5"; g.fillText("GÉNOVA 13", 254, 11 * T + 34);
    B("#050814", 418, 11 * T + 4, 374, 42); B("#10182f", 421, 11 * T + 7, 368, 36); B("#d9465b", 421, 11 * T + 7, 64, 36);
    g.font = '22px "VT323", monospace'; g.textAlign = "center"; g.fillStyle = "#fff"; g.fillText("EN VIVO", 453, 11 * T + 32);
    return c;
  }
  const bgFor = ti => bgs[ti] || (bgs[ti] = buildBg(ti));

  function vehicle(l, o) {
    const x = o.x, w = l.wpx, cy = l.cy, ghost = clearT > 0;
    ctx.save(); ctx.globalAlpha = ghost ? .22 : 1; ctx.translate(x, cy); if (l.dir < 0) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    const h = 38, y0 = -h / 2 + 2, spin = Math.floor(t * 14) % 2;
    const label = (txt, lx, ly, col) => { ctx.save(); ctx.translate(lx, ly); if (l.dir < 0) ctx.scale(-1, 1); ctx.font = `7px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); };
    const wheel = (wx, wy) => { R("#050814", wx, wy, 14, 7); R("#3a3f58", wx + 4, wy + 2, 6, 3); if (spin) R("#8d98b8", wx + 6, wy + 2, 2, 3); };
    const beam = (by) => { if (ghost) return; R("rgba(255,240,170,.16)", w, by, 30, 10); R("rgba(255,240,170,.1)", w + 30, by - 2, 18, 14); };
    if (l.type === "bus") { R("#050814", 0, y0 - 2, w, h + 4); R(o.col, 2, y0, w - 4, h); R("rgba(255,255,255,.2)", 2, y0, w - 4, 5); for (let i = 0; i < 5; i++) { R("#101629", 14 + i * 26, y0 + 5, 20, 12); R("#6fa0ff", 15 + i * 26, y0 + 6, 6, 3); } R("#f7f0d5", 8, y0 + 22, w - 16, 10); R("#2b6cff", 12, y0 + 24, 8, 2); R("#2b6cff", 16, y0 + 26, 4, 2); label("VOTA YA", w / 2 + 6, y0 + 30, "#101629"); R("#ffd34e", w - 6, y0 + 24, 5, 6); wheel(14, y0 + h - 3); wheel(w - 40, y0 + h - 3); beam(y0 + 22); }
    else if (l.type === "sondeo") { R("#050814", 0, y0 + 6, w, h - 6); R("#ff8a3d", 2, y0 + 8, w - 4, h - 12); R("#050814", 14, y0 - 4, w - 30, 14); R("#f7f0d5", 16, y0 - 2, w - 34, 10); label(o.txt, w / 2 - 4, y0 + 6, "#101629"); R("#101629", 14, y0 + 12, 16, 9); R("#101629", w - 34, y0 + 12, 16, 9); R("#ffd34e", w - 5, y0 + 20, 4, 5); wheel(8, y0 + h - 3); wheel(w - 24, y0 + h - 3); beam(y0 + 18); }
    else if (l.type === "oficial") { R("#050814", 0, y0 + 8, w, h - 8); R("#14141c", 2, y0 + 10, w - 4, h - 14); R("#ffd34e", 2, y0 + 22, w - 4, 3); R("#2a3350", 18, y0 + 2, w - 36, 12); R("#4a5a88", 20, y0 + 4, 14, 8); R("#ff4d61", w - 18, y0 + 14, 14, 3); R("#ffd34e", w - 18, y0 + 17, 14, 3); R("#f7f0d5", w - 5, y0 + 24, 4, 5); wheel(6, y0 + h - 3); wheel(w - 22, y0 + h - 3); beam(y0 + 22); }
    else {      // camión del pulpo
      R("#050814", 0, y0 - 4, w, h + 4); R("#f7f0d5", 2, y0 - 2, w - 28, h); R("#d9d2b2", 2, y0 + 28, w - 28, 6);
      R("#ff8a3d", 14, y0 + 2, 26, 16); R("#ff8a3d", 10, y0 + 8, 6, 6); R("#ff8a3d", 38, y0 + 8, 6, 6); R("#050814", 20, y0 + 8, 3, 3); R("#050814", 31, y0 + 8, 3, 3);
      for (let i = 0; i < 4; i++) { R("#ff8a3d", 12 + i * 8, y0 + 18, 4, 7 + (i + spin) % 2 * 2); }
      R("#1b5fd1", w - 26, y0 + 4, 24, h - 8); R("#6fa0ff", w - 22, y0 + 8, 14, 10); R("#d9465b", w - 26, y0 + 26, 24, 4);
      label("A FEIRA", 26, y0 + 36 - 2, "#d9465b"); R("#ffd34e", w - 4, y0 + 24, 3, 6); wheel(8, y0 + h - 5); wheel(w - 36, y0 + h - 5); beam(y0 + 24);
    }
    ctx.restore();
  }
  function floater(l, o) {
    const x = Math.round(o.x), w = l.wpx, cy = l.cy;
    if (l.type === "tert") {
      const ph = (t * .35 + o.ph) % 1, warn = ph > .6 && ph <= .72, dive = ph > .72;
      if (dive) { ctx.fillStyle = "rgba(255,255,255,.25)"; for (let i = 0; i < w / T; i++) { ctx.fillRect(x + i * T + 12, cy - 6 + Math.sin(t * 6 + i) * 3, 22, 3); } return; }
      ctx.globalAlpha = warn && Math.floor(t * 10) % 2 ? .45 : 1;
      R("#050814", x, cy - 20, w, 40); R("#8a5a3b", x + 3, cy - 17, w - 6, 34); R("#6b4423", x + 3, cy + 6, w - 6, 11);
      for (let i = 0; i < Math.round(w / T); i++) { const hx = x + i * T + T / 2; R("#f2b184", hx - 8, cy - 14, 16, 14); R(["#1b5fd1", "#d9465b", "#2b9a5a"][i % 3], hx - 7, cy, 14, 8); R("#101629", hx - 4, cy - 10, 3, 3); R("#101629", hx + 2, cy - 10, 3, 3); R("#aab4d5", hx + 8, cy - 4, 4, 8); }
      ctx.globalAlpha = 1;
    } else {
      R("#050814", x, cy - 20, w, 40); R("#f1e8c8", x + 3, cy - 17, w - 6, 34); R("#d9d2b2", x + 3, cy + 10, w - 6, 7);
      ctx.font = `${l.type === "editorial" ? 9 : 8}px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillStyle = "#101629"; ctx.fillText(l.type === "editorial" ? o.head : o.flash, x + w / 2, cy - 4);
      R("#8d8870", x + 10, cy + 2, w - 20, 2); R("#8d8870", x + 10, cy + 7, w - 34, 2); R("#d9465b", x + 3, cy - 17, w - 6, 4);
    }
  }
  function reporter(r) {
    const x = Math.round(r.x), y = MEDIAN * T + T / 2, d = r.dir, wob = Math.floor(t * 8) % 2;
    ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(x, y + 20, 12, 4, 0, 0, 7); ctx.fill();
    R("#050814", x - 12, y - 22, 24, 44); R("#6a4a2a", x - 9, y - 4, 18, 18); R("#8a6a3a", x - 9, y - 4, 18, 4); R("#2b2f3e", x - 8, y + 14, 6, 6 + wob); R("#2b2f3e", x + 2, y + 14, 6, 6 + (1 - wob));
    R("#f2b184", x - 7, y - 19, 14, 14); R("#2b2f3e", x - 8, y - 22, 16, 6); R("#101629", x - 4 + d, y - 14, 3, 3); R("#101629", x + 2 + d, y - 14, 3, 3); R("#7a3f3a", x - 3, y - 8, 6, 2);
    const mx = x + d * 14; R("#8a5a3b", x + d * 6 - (d < 0 ? 2 : 0), y, 8, 5); R("#aab4d5", mx - 2, y - 8, 5, 12); R("#050814", mx - 3, y - 12, 7, 6); R("#d9465b", mx - 2, y - 11, 5, 4);
    if (Math.floor(t * 5) % 2) R("#f7f0d5", x - 3, y - 30, 6, 4);
  }
  function drawPlayer() {
    if (!pl) return; const x = pl.x, y = pl.y;
    if (pl.dead) {
      const k = clamp(pl.deadT / .4, 0, 1);
      if (pl.kind === "coche") { R("#050814", x - 20, y + 4, 40, 10); R("#17306b", x - 18, y + 5, 36, 6); R("#efc3a0", x - 8, y + 2, 16, 6); R("#dfe3ee", x - 12, y + 1, 24, 3); R("#2b6cff", x - 4, y + 6, 8, 2); R("#a9d4ff", x - 6, y + 3, 4, 2); R("#a9d4ff", x + 2, y + 3, 4, 2); }
      else if (pl.kind === "agua") { ctx.strokeStyle = `rgba(255,255,255,${(1 - k).toFixed(2)})`; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + 8, 10 + i * 10 + k * 20, 5 + i * 4 + k * 8, 0, 0, 7); ctx.stroke(); } R("#dfe3ee", x - 7, y - 4 + k * 12, 14, 8 * (1 - k)); R("#a9d4ff", x - 5, y + k * 10, 10, 3 * (1 - k)); }
      else if (pl.kind === "micro") { R("#17306b", x - 10, y - 4, 20, 22); R("#dfe3ee", x - 9, y - 22, 18, 8); for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; R("#050814", x + Math.cos(a) * 22 - 3, y - 6 + Math.sin(a) * 14 - 5, 7, 10); R("#d9465b", x + Math.cos(a) * 22 - 2, y - 6 + Math.sin(a) * 14 - 4, 5, 4); } }
      else { for (let i = 0; i < 6; i++) R("#ffd34e", x + Math.cos(i + t * 5) * 22 * k, y - 10 + Math.sin(i + t * 5) * 14 * k, 5, 5); R("#17306b", x - 10, y - 4, 20, 22); R("#dfe3ee", x - 9, y - 22, 18, 8); }
      return;
    }
    const hk = pl.hop ? clamp(pl.hop.t / pl.hop.dur, 0, 1) : -1, by = hk >= 0 ? -Math.sin(hk * Math.PI) * 5 : Math.sin(t * 3) * .8, st = Math.floor(t * 4) % 2;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y + by));
    ctx.fillStyle = "rgba(0,0,0,.32)"; ctx.beginPath(); ctx.ellipse(0, 22 - by, 14 - (hk >= 0 ? Math.sin(hk * Math.PI) * 3 : 0), 5, 0, 0, 7); ctx.fill();
    const sy = hk >= 0 ? 1 + Math.sin(hk * Math.PI) * .08 : 1; ctx.scale(1 / sy, sy);
    drawCandidate(ctx, { dir: pl.dir, step: st, hopK: hk });
    ctx.restore();
  }
  function drawDoors() {
    doors.forEach((d, i) => {
      const x = DOORS[i] * T, cx = x + DOOR_W * T / 2, so = SOCIOS[i];
      if (d.filled) { R("#0e3a22", x + 8, 12, DOOR_W * T - 16, T - 12); R("#efc3a0", cx - 18, 20, 12, 12); R("#dfe3ee", cx - 19, 17, 14, 4); R("#17306b", cx - 20, 32, 16, 12); R("#e8e0c0", cx + 6, 20, 12, 12); R(so.col, cx + 4, 32, 16, 12); R(so.col, cx - 3, 26, 6, 6); }
      else { ctx.font = `18px ${FONT_T}`; ctx.textAlign = "center"; ctx.fillStyle = "rgba(201,210,232,.55)"; ctx.fillText(so.s, cx, 39); }
      if (d.ev && d.ev.type === "baron") { const warn = d.ev.t < d.ev.warn; if (!warn || Math.floor(t * 8) % 2) { R("#7a1f31", x + 8, 12, DOOR_W * T - 16, T - 12); R("#f2b184", cx - 10, 18, 20, 18); R("#101629", cx - 7, 22, 5, 3); R("#101629", cx + 2, 22, 5, 3); R("#101629", cx - 8, 20, 8, 2); R("#101629", cx, 20, 8, 2); R("#101629", cx - 5, 30, 10, 3); R("#ff4d61", cx - 4, 36, 8, 10); } if (warn) outlinedText("!", cx, 9, "#ff4d61", `14px ${FONT_PX}`); }
      if (d.ev && d.ev.type === "gaviota") { const fy = 22 + Math.sin(t * 6) * 3, fl = Math.sin(t * 14) * 4; R("#f7f0d5", cx - 10, fy, 20, 8); R("#2b6cff", cx - 10, fy + 6, 20, 2); R("#f7f0d5", cx - 18, fy - 4 + fl, 10, 4); R("#f7f0d5", cx + 8, fy - 4 + fl, 10, 4); R("#ffb347", cx + 10, fy + 2, 7, 3); R("#101629", cx + 4, fy + 1, 2, 2); }
    });
  }
  function pickupIcon(type, x, y) {
    if (type === "derogar") { R("#f7f0d5", x - 12, y - 14, 24, 28); R("#d9465b", x - 9, y - 4, 18, 3); for (let i = 0; i < 4; i++) { R("#101629", x - 9 + i * 5, y - 11, 3, 3); R("#8d8870", x - 9, y + 2 + i * 3, 18, 2); } }
    else if (type === "encuesta") { R("#31d7c7", x - 12, y - 14, 24, 28); R("#101629", x - 9, y + 6, 4, 6); R("#101629", x - 3, y, 4, 12); R("#101629", x + 3, y - 8, 4, 20); R("#ffd34e", x - 9, y - 10, 6, 3); }
    else if (type === "empanada") { R("#c98a2a", x - 12, y - 10, 24, 20); R("#e8b04a", x - 10, y - 8, 20, 16); R("#c98a2a", x - 10, y - 2, 20, 2); R("#c98a2a", x - 3, y - 8, 2, 16); R("#f7f0d5", x - 7, y - 6, 3, 2); R("#f7f0d5", x + 3, y + 3, 3, 2); }
    else { R("#ff8a3d", x - 11, y - 14, 22, 18); R("#ff8a3d", x - 14, y - 6, 6, 8); R("#ff8a3d", x + 8, y - 6, 6, 8); R("#050814", x - 6, y - 8, 3, 4); R("#050814", x + 3, y - 8, 3, 4); R("#f7f0d5", x - 5, y - 8, 1, 1); for (let i = 0; i < 4; i++) R("#ff8a3d", x - 11 + i * 6, y + 4, 4, 9 + (i + Math.floor(t * 4)) % 2 * 2); }
  }
  function drawPickup() {
    if (!pickup) return; const x = pickup.col * T + T / 2, y = MEDIAN * T + T / 2 + Math.sin(t * 5) * 3, blink = pickup.t > 10 && Math.floor(t * 6) % 2;
    if (blink) return; ctx.fillStyle = `rgba(255,211,78,${(.25 + .12 * Math.sin(t * 6)).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fill();
    R("#050814", x - 14, y - 16, 28, 32); pickupIcon(pickup.type, x, y);
    outlinedText({ derogar: "DEROGAR", encuesta: "ENCUESTA", empanada: "EMPANADA", pulpo: "PULPO" }[pickup.type], x, y + 30, "#f7f0d5", `7px ${FONT_PX}`);
  }
  function drawWeather() {
    const th = THEMES[theme];
    if (th.rain && !reduced) { ctx.strokeStyle = "rgba(180,215,255,.28)"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 90; i++) { const sy = ((i * 53 + t * 380 * (.8 + (i % 5) * .08)) % (H + 30)) - 15, sx = ((i * 97 + 31) % W) - sy * .18; const x = ((sx % W) + W) % W; ctx.moveTo(x, sy); ctx.lineTo(x - 2, sy + 9); } ctx.stroke(); }
    if (theme === 2 && !reduced) { for (let i = 0; i < 14; i++) { const sy = ((i * 71 + t * 30) % H), sx = (i * 131 + Math.sin(t + i) * 12) % W; R("rgba(255,211,78,.35)", sx, sy, 2, 2); } }
  }
  function drawTicker() {
    const y0 = 11 * T + 7, txt = TICKER.join("   ★   ") + "   ★   "; ctx.save(); ctx.beginPath(); ctx.rect(490, y0, 298, 36); ctx.clip();
    ctx.font = `20px ${FONT_T}`; ctx.textAlign = "left"; ctx.fillStyle = "#ffd34e"; const w = ctx.measureText(txt).width, off = (t * 70) % w; ctx.fillText(txt, 496 - off, y0 + 24); ctx.fillText(txt, 496 - off + w, y0 + 24); ctx.restore();
  }
  function render() {
    ctx.save(); if (shakeT > 0) ctx.translate(Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM)));
    const th = THEMES[theme]; ctx.drawImage(bgFor(theme), 0, 0);
    facadeFlag(175, "es"); facadeFlag(325, "es"); facadeFlag(475, "gal"); facadeFlag(625, "es");
    for (let r = 1; r <= 4; r++) { ctx.fillStyle = th.hi; for (let x = -((t * 20 * (r % 2 ? 1 : -1)) % 80); x < W; x += 80) ctx.fillRect(Math.round(x), r * T + 10 + Math.round(Math.sin(t * 2 + x) * 2), 36, 3); }
    for (const l of lanes) if (l.kind === "river") for (const o of l.objs) { if (o.x < W && o.x + l.wpx > 0) floater(l, o); }
    for (const l of lanes) if (l.kind === "road") for (const o of l.objs) { if (o.x < W && o.x + l.wpx > 0) vehicle(l, o); }
    for (const r of reporters) reporter(r);
    drawDoors(); drawPickup(); drawPlayer(); drawTicker();
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    drawWeather();
    ctx.restore();
    if (flashT > 0) { ctx.globalAlpha = clamp(flashT * 2.2, 0, .5); ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    for (const f of floats) { ctx.globalAlpha = clamp(1.7 - f.t / f.life * 1.7 + .2, 0, 1); ctx.font = `22px ${FONT_T}`; const hw = ctx.measureText(f.text).width / 2 + 10; outlinedText(f.text, clamp(f.x, hw, W - hw), f.y, f.color, `22px ${FONT_T}`); } ctx.globalAlpha = 1;
    // barra de plazo
    const k = clamp(clock / clockMax, 0, 1); R("#050814", 8, H - 22, 204, 14); R("#17213c", 10, H - 20, 200, 10); R(k < .25 ? "#ff4d61" : "#ffd34e", 10, H - 20, 200 * k, 10); outlinedText("PLAZO", 112, H - 26, "#aab4d5", `7px ${FONT_PX}`);
    if (streak > 0) outlinedText(`RACHA x${Math.min(3, streak)}`, 14, H - 46, "#ffd34e", `20px ${FONT_T}`, "left");
    if (slowT > 0) outlinedText(`ENCUESTA ${slowT.toFixed(1)}`, W - 12, 80, "#31d7c7", `20px ${FONT_T}`, "right");
    if (clearT > 0) outlinedText(`DEROGADO ${clearT.toFixed(1)}`, W - 12, slowT > 0 ? 104 : 80, "#ffd34e", `20px ${FONT_T}`, "right");
    if (bubble && pl) { ctx.font = `22px ${FONT_T}`; const w = Math.ceil(ctx.measureText(bubble.text).width) + 20, h = 28, bx = clamp(Math.round(pl.x - w / 2), 8, W - w - 8), by = Math.round(clamp(pl.y - 72, 6, H - 80)); ctx.globalAlpha = clamp(Math.min(bubble.t / .12, (bubble.life - bubble.t) / .25, 1), 0, 1); R("#050814", bx - 3, by - 3, w + 6, h + 6); R("#f7f0d5", bx, by, w, h); ctx.fillStyle = "#050814"; ctx.beginPath(); ctx.moveTo(pl.x - 6, by + h + 3); ctx.lineTo(pl.x + 6, by + h + 3); ctx.lineTo(pl.x, by + h + 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#f7f0d5"; ctx.beginPath(); ctx.moveTo(pl.x - 4, by + h); ctx.lineTo(pl.x + 4, by + h); ctx.lineTo(pl.x, by + h + 7); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#101629"; ctx.textAlign = "left"; ctx.fillText(bubble.text, bx + 10, by + 21); ctx.globalAlpha = 1; }
    if (bannerT > 0) { ctx.globalAlpha = clamp(bannerT / .5, 0, 1); outlinedText(bannerText, W / 2, 300, "#ffd34e", `${bannerText.length > 14 ? 18 : 24}px ${FONT_PX}`); outlinedText(bannerSub, W / 2, 336, "#f7f0d5", `24px ${FONT_T}`); ctx.globalAlpha = 1; }
  }

  /* ---------------------------------------------------- tildes de la fuente pixel */
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

  /* ----------------------------------------------------------------- bucle */
  function frame(now) {
    if (!last) last = now; const dt = clamp((now - last) / 1000, 0, .1); last = now;
    if (state === "playing") { acc += dt; let n = 0; while (acc >= FIXED && n++ < 12) { update(FIXED); acc -= FIXED; } if (n >= 12) acc = 0; }
    else if (state === "title" || state === "over") idle(dt);
    render(); requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------------------- entrada */
  const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  addEventListener("keydown", e => {
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "playing") pauseScreen(); else if (state === "paused") resume(); return; }
    if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) { if (state === "playing" || state === "paused") play(); return; }
    const d = KEYMAP[e.code]; if (d && state === "playing") { e.preventDefault(); if (!e.repeat) hop(d); }
  });
  canvas.addEventListener("pointerdown", e => { if (state !== "playing") return; e.preventDefault(); input = { x: e.clientX, y: e.clientY }; safe(() => canvas.setPointerCapture(e.pointerId)); });
  canvas.addEventListener("pointerup", e => {
    if (!input || state !== "playing") { input = null; return; } const dx = e.clientX - input.x, dy = e.clientY - input.y; input = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) { hop("up"); return; }
    hop(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  canvas.addEventListener("pointercancel", () => { input = null; });
  document.querySelectorAll(".dpad button").forEach(b => b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("on"); hop(b.dataset.dir); setTimeout(() => b.classList.remove("on"), 120); }));
  addEventListener("blur", () => { if (state === "playing") pauseScreen(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseScreen(); });
  UI.pause.addEventListener("click", () => state === "paused" ? resume() : pauseScreen());
  UI.restart.addEventListener("click", () => { if (state !== "title") play(); });
  UI.sound.addEventListener("click", () => { soundOn = !soundOn; store.set("rm-sound", soundOn ? "1" : "0"); AUD.setOn(soundOn); paintSound(); if (soundOn) { sfx.socio(); if (state === "playing") music.start(round); } });

  /* ------------------------------------------------------------------ inicio */
  AUD.setOn(soundOn); paintSound(); reset(); titleScreen(); fixAccents(document.querySelector(".cabinet header")); fixAccents(document.querySelector(".hud"));
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('22px "VT323"')]).then(() => { bgs = []; }).catch(() => {});
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, round, lives, score, seats, row: pl && pl.row, x: pl && Math.round(pl.x), dead: pl && pl.dead, kind: pl && pl.kind, clock: Math.round(clock), doors: doors.filter(d => d.filled).length, slow: +slowT.toFixed(1), clear: +clearT.toFixed(1), brk: +breakT.toFixed(1), theme, streak });
    const futureX = (lane, o, dt) => { let x = o.x + lane.dir * lane.speed * dt; const span = lane.total; x = ((x + lane.wpx + 120) % span + span) % span - lane.wpx - 120; return x; };
    const refl = (x0, v, dt) => { const a = 24, L = W - 48; let p = x0 - a + v * dt; p = ((p % (2 * L)) + 2 * L) % (2 * L); return a + (p > L ? 2 * L - p : p); };
    window.__rm = {
      step: (n = 1, dt = FIXED, draw = true) => { for (let i = 0; i < n; i++) update(dt); if (draw) render(); return snap(); }, snap, play, hop, title: titleScreen,
      teleport: (col, row) => { pl.x = col * T + T / 2; pl.y = row * T + T / 2; pl.row = row; pl.hop = null; }, doors: () => doors.map(d => ({ f: d.filled, ev: d.ev && d.ev.type })), setBreak: n => { breakT = n; }, render, over: () => { lives = 0; gameOver(); },
      lanes: () => lanes.map(l => ({ row: l.row, kind: l.kind, type: l.type, n: l.objs.length })), spawnPickup: type => { pickup = { type, col: 7, t: 0 }; }, reporters: () => reporters.map(r => ({ x: Math.round(r.x), dir: r.dir })),
      setRound: r => { round = r; startRound(); }, setTheme: i => { round = i + 1; startRound(); }, say, ficha: fichaNode,
      /* ¿es seguro estar en (x,row) dentro de dt segundos? (solo para el piloto de pruebas) */
      safe: (x, row, dt) => { const lane = laneAt(row); if (row === START_ROW) return true; if (row === MEDIAN) return !reporters.some(r => Math.abs(x - refl(r.x, r.dir * r.speed * (slowT > 0 ? .5 : 1), dt)) < 36); if (!lane) return false; if (lane.kind === "road") return !lane.objs.some(o => { const ox = futureX(lane, o, dt); return x + 12 > ox + 6 && x - 12 < ox + lane.wpx - 6; }); return lane.objs.some(o => { const ox = futureX(lane, o, dt); const ph = ((t + dt) * .35 + o.ph) % 1; return (!lane.dive || ph < .66) && x > ox + 10 && x < ox + lane.wpx - 10; }); },
      laneSpeed: row => { const l = laneAt(row); return l ? l.dir * l.speed : 0; }
    };
  }
})();
