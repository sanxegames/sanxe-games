"use strict";
/* Rumbo a la Moncloa — Sanxe Games.
   Frogger satírico: gana las elecciones (137 escaños), cruza la carretera y el río, y consigue a los cinco socios que faltan. */
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
  const SOCIOS = ["EL REGIONAL", "EL BISAGRA", "EL INDEPENDIENTE", "EL DE LA ESQUINA", "EL ÚLTIMO SOCIO"];
  const DEATHS = {
    coche: ["¡Atropellado por una encuesta!", "¡Eso era un autobús de campaña!", "¡Otro sondeo que no vio venir!"],
    agua: ["¡Ahogado en un titular!", "¡Se hundió la tertulia!", "¡Cayó al río de las opiniones!"],
    tiempo: ["¡Se acabó el plazo de investidura!", "¡Demasiado lento para la Moncloa!"],
    pared: ["¡Esa no era una puerta!", "¡Hay que entrar por la puerta, no por la pared!"],
    baron: ["¡El barón no te dejaba pasar!", "¡Fuego amigo del partido!"],
    cerrada: ["¡Ese socio ya es tuyo!", "¡Puerta ocupada!"],
    fuera: ["¡Arrastrado fuera del mapa!"]
  };
  const QUIPS = ["¡Tengo un plan!", "¡Hay que ganar las elecciones!", "Faltan escaños…", "¡Sin socios no hay Gobierno!", "La lista más votada, ¿no?", "¡Sigo aquí!", "Esto lo arreglo yo."];

  const UI = { seats: $("#seats"), round: $("#round"), lives: $("#lives"), score: $("#score"), status: $("#game-status"), overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"), sound: $("#sound"), pause: $("#pause"), restart: $("#restart"), help: $("#game-help") };
  let state = "title", soundOn = store.get("rm-sound") !== "0", best = +store.get("rm-best") || 0, bestRound = +store.get("rm-best-round") || 1;
  let lanes = [], doors = [], pl, pickup = null, particles = [], floats = [], bubble = null, bg = null, input = null;
  let t = 0, acc = 0, last = 0, round = 1, lives = 3, score = 0, seats = BASE, clock = 30, clockMax = 30, evT = 5, shakeT = 0, shakeM = 0, bannerT = 0, bannerText = "", bannerSub = "", slowT = 0, clearT = 0, breakT = 0, deathMsg = "", stats = { doors: 0, deaths: 0, gaviotas: 0 }, quipT = 8, maxRow = START_ROW;

  /* -------------------------------------------------------------- carriles */
  function makeLanes(r) {
    const k = 1 + Math.min(1.2, (r - 1) * .11);
    const specs = [
      { row: 9, dir: 1, speed: 78, kind: "road", type: "van", w: 2, gap: 5.4 },
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
      for (let i = 0; i < n; i++) objs.push({ x: i * gap + off - wpx - 120, ph: rnd(0, 1), txt: s.type === "sondeo" ? (20 + Math.floor(Math.random() * 30)) + "," + Math.floor(Math.random() * 10) + "%" : "", head: pick(["TERTULIA", "DEBATE", "OPINION"]), col: pick(["#1b5fd1", "#d9465b", "#2b9a5a", "#ffb347"]) });
      return { ...s, speed: s.speed * k, wpx, gap, total: n * gap, objs, cy: s.row * T + T / 2 };
    });
  }
  const surfaced = (lane, o) => !lane.dive || ((t * .35 + o.ph) % 1) < .72;

  /* --------------------------------------------------------------- partida */
  function resetDoors() { doors = DOORS.map(() => ({ filled: false, ev: null })); }
  function newPlayer() { return { x: 7 * T + T / 2, y: START_ROW * T + T / 2, row: START_ROW, hop: null, dead: false, deadT: 0, kind: "", frame: 0, facing: 1 }; }
  function respawn() { pl = newPlayer(); clock = clockMax; maxRow = START_ROW; deathMsg = ""; }
  function updateHud() { UI.seats.textContent = seats; UI.round.textContent = round; UI.lives.textContent = lives; UI.score.textContent = pad(score, 5); }
  const setControls = () => { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; };
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };
  function startRound() { lanes = makeLanes(round); resetDoors(); pickup = null; clockMax = Math.max(20, 32 - round * 1.5); evT = 4; slowT = 0; clearT = 0; respawn(); updateHud(); music.setLevel(round); }
  function reset() { round = 1; lives = 3; score = 0; seats = BASE; stats = { doors: 0, deaths: 0, gaviotas: 0 }; particles = []; floats = []; bubble = null; breakT = 0; bannerT = 2.6; bannerText = "RUMBO A LA MONCLOA"; bannerSub = "Ganaste las elecciones: faltan 39 escaños"; startRound(); }

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
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    showOverlay({ help: true, title: "RUMBO A LA MONCLOA", text: `Ganaste las elecciones con 137 escaños, pero el Gobierno no se forma solo. Cruza la carretera de las encuestas, salta por el río de los titulares y consigue a los cinco socios que faltan: 176 escaños, ni uno menos.${best ? ` Récord: ${best}.` : ""}`, actions: [{ label: "EMPEZAR LA CAMPAÑA", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function play() { state = "playing"; reset(); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(1); UI.status.textContent = "Cruza hasta las puertas del palacio."; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now(); }
  function pauseScreen() { if (state !== "playing") return; state = "paused"; setControls(); music.pause(true); showOverlay({ help: true, stamp: "TRÁFICO DETENIDO", title: "PAUSA", text: "Por una vez, los coches esperan al candidato.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR", secondary: true, fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] }); }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function gameOver() {
    state = "over"; setControls(); music.stop(); sfx.over(); const nb = score > best; if (nb) { best = score; store.set("rm-best", String(best)); } if (round > bestRound) { bestRound = round; store.set("rm-best-round", String(bestRound)); }
    const heads = [["GANÓ LAS ELECCIONES, PERDIÓ EL GOBIERNO", "Tuvo la lista más votada, pero no pasó de la carretera."], ["SIN SOCIOS NO HAY MONCLOA", `Se quedó en ${seats} escaños, a ${GOAL - seats} del sueño.`], ["INVESTIDURA FALLIDA", "El candidato dice que «el resultado es una victoria moral»."]];
    const h = seats >= 168 ? ["A UN PASO DE LA MONCLOA", `${seats} escaños: a ${GOAL - seats} de gobernar. Culpa, dice, «del tráfico».`] : pick(heads);
    UI.status.textContent = `Fin de la campaña con ${score} puntos.`;
    showOverlay({ stamp: `RONDA ${round}`, title: h[0], text: `${score} puntos${nb ? " (¡récord!)" : `. Récord: ${best}`}. Socios conseguidos: ${stats.doors}. Caídas: ${stats.deaths}.`, extra: `<p class="headline"><b>ÚLTIMA HORA</b>${h[1]}<small>Mejor ronda: ${bestRound} · Gaviotas cazadas: ${stats.gaviotas}</small></p>`, actions: [{ label: "OTRA CAMPAÑA", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }

  /* ------------------------------------------------------------------ efectos */
  const shake = (m, d = .3) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, d); };
  const float = (x, y, text, color, life = 1.3) => floats.push({ x, y, text, color, t: 0, life });
  const say = (text, life = 2.2) => { bubble = { text, t: 0, life }; };
  function burst(x, y, color, n = 10, sp = 180) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), v = rnd(.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: rnd(.4, .9), color, s: pick([3, 4, 5, 6]), g: 520 }); } }

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
    pl.hop = { t: 0, dur: .12, fx: pl.x, fy: pl.y, tx, ty, row }; sfx.hop();
  }
  function laneAt(row) { return lanes.find(l => l.row === row); }
  function carHit(px, py) {
    const row = Math.floor(py / T), lane = laneAt(row);
    if (!lane || lane.kind !== "road" || clearT > 0) return false;
    for (const o of lane.objs) if (px + 12 > o.x + 6 && px - 12 < o.x + lane.wpx - 6) return true;
    return false;
  }
  function kill(kind) {
    if (pl.dead) return; pl.dead = true; pl.deadT = 0; pl.kind = kind; pl.hop = null; lives--; stats.deaths++; deathMsg = pick(DEATHS[kind] || ["¡Ay!"]);
    if (kind === "coche") { sfx.squash(); shake(7, .45); burst(pl.x, pl.y, "#f7f0d5", 10); burst(pl.x, pl.y, "#ff4d61", 8); }
    else if (kind === "agua") { sfx.splash(); burst(pl.x, pl.y, "#8fc8ff", 16, 220); }
    else { sfx.baron(); shake(4, .3); burst(pl.x, pl.y, "#ffd34e", 10); }
    say(deathMsg, 2.4); updateHud();
  }
  function land() {
    const row = pl.row;
    if (row < maxRow) { maxRow = row; score += 10; sfx.forward(); updateHud(); }
    if (row === MEDIAN && pickup) { const pc = pickup.col * T + T / 2; if (Math.abs(pl.x - pc) < T * .6) takePickup(); }
    if (row === GOAL_ROW) reachGoal();
  }
  function reachGoal() {
    let di = -1;
    DOORS.forEach((c, i) => { if (pl.x > c * T + 8 && pl.x < (c + DOOR_W) * T - 8) di = i; });
    if (di < 0) { kill("pared"); return; }
    const d = doors[di];
    if (d.filled) { kill("cerrada"); return; }
    if (d.ev && d.ev.type === "baron" && d.ev.t > d.ev.warn) { kill("baron"); return; }
    d.filled = true; stats.doors++; seats += SEATS[di]; const bonus = 50 + Math.floor(clock) * 2; score += bonus;
    const dx = (DOORS[di] + DOOR_W / 2) * T, gav = d.ev && d.ev.type === "gaviota";
    if (gav) { score += 200; stats.gaviotas++; sfx.gaviota(); float(dx, 90, "+200 GAVIOTA", "#f7f0d5", 1.6); }
    d.ev = null; sfx.socio(); float(dx, 60, `${SOCIOS[di]}: +${SEATS[di]} ESCAÑOS`, "#3cff7a", 1.8); burst(dx, 25, "#ffd34e", 14); shake(3, .25); updateHud();
    if (!pickup && Math.random() < .5) { pickup = { type: Math.random() < .5 ? "derogar" : "encuesta", col: Math.floor(rnd(1, COLS - 1)), t: 0 }; }
    if (doors.every(x => x.filled)) roundDone(); else respawn();
  }
  function roundDone() {
    sfx.round(); score += 1000; bannerText = "¡176 ESCAÑOS!"; bannerSub = `Investidura conseguida. Ronda ${round + 1}: los socios piden más.`; bannerT = 3; breakT = 3; lives = Math.min(5, lives + 1);
    float(W / 2, 200, "+1000 · +1 VIDA", "#ffd34e", 2); say("¡Presidente! ...al menos hasta la próxima ronda.", 3); updateHud();
    pl.dead = false; pl.hop = null;
  }
  function takePickup() {
    sfx.pickup(); if (pickup.type === "derogar") { clearT = 5; sfx.derogar(); float(pl.x, pl.y - 30, "¡DEROGAR! TRÁFICO FUERA", "#ffd34e", 1.6); say("¡Todo derogado!"); } else { slowT = 7; float(pl.x, pl.y - 30, "ENCUESTA FAVORABLE: TODO MÁS LENTO", "#31d7c7", 1.8); say("¡Las encuestas me sonríen!"); }
    burst(pl.x, pl.y, "#ffd34e", 12); pickup = null;
  }

  /* ------------------------------------------------------------- simulación */
  function update(dt) {
    if (state !== "playing") return;
    t += dt; bannerT = Math.max(0, bannerT - dt); shakeT = Math.max(0, shakeT - dt); slowT = Math.max(0, slowT - dt); clearT = Math.max(0, clearT - dt);
    const ts = slowT > 0 ? .5 : 1, ldt = dt * ts;
    for (const l of lanes) for (const o of l.objs) { o.x += l.dir * l.speed * ldt; if (l.dir > 0 && o.x > W + 120) o.x -= l.total; else if (l.dir < 0 && o.x < -l.wpx - 120) o.x += l.total; }
    if (breakT > 0) { breakT -= dt; if (breakT <= 0) { round++; startRound(); bannerT = 2.2; bannerText = `RONDA ${round}`; bannerSub = "La carretera se pone peor"; } }
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
          }
        }
        // eventos en las puertas
        evT -= dt; if (evT <= 0) { evT = rnd(5, 9) / (1 + round * .08); const free = doors.map((d, i) => i).filter(i => !doors[i].filled && !doors[i].ev); if (free.length) { const i = pick(free), baron = Math.random() < .55; doors[i].ev = { type: baron ? "baron" : "gaviota", t: 0, warn: baron ? 1 : 0, life: baron ? 5 : 7 }; if (baron) sfx.warn(); } }
        for (const d of doors) if (d.ev) { d.ev.t += dt; if (d.ev.t > d.ev.life) d.ev = null; }
        if (pickup) { pickup.t += dt; if (pickup.t > 14) pickup = null; }
        quipT -= dt; if (quipT <= 0 && !bubble) { quipT = rnd(9, 15); say(pick(QUIPS)); }
      }
    }
    for (const p of particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } particles = particles.filter(p => p.t < p.life);
    for (const f of floats) { f.t += dt; f.y -= 30 * dt; } floats = floats.filter(f => f.t < f.life);
    if (bubble) { bubble.t += dt; if (bubble.t > bubble.life) bubble = null; }
  }

  /* ----------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function outlinedText(txt, x, y, color, font, align = "center") { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814"; [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y); }
  function buildBg() {
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), B = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    B("#0b1021", 0, 0, W, H);
    B("#1c2650", 0, 0, W, T);                                                    // fachada
    for (let x = 0; x < W; x += 20) { B("#27345b", x, 0, 2, T); }
    DOORS.forEach(cc => { const x = cc * T; B("#050814", x + 4, 8, DOOR_W * T - 8, T - 8); B("#0e1633", x + 8, 12, DOOR_W * T - 16, T - 12); B("#c9d2e8", x + 2, 6, 3, T - 6); B("#c9d2e8", x + DOOR_W * T - 5, 6, 3, T - 6); B("#c9d2e8", x + 2, 6, DOOR_W * T - 4, 3); });
    for (let i = 0; i < 4; i++) { const fx = 3 * T + i * 3 * T - 2; B("#c9d2e8", fx, 0, 2, 7); B(["#ff4d61", "#ffd34e", "#31d7c7", "#3cff7a"][i], fx + 2, 0, 8, 5); }
    for (let r = 1; r <= 4; r++) { B(r % 2 ? "#1a4a8a" : "#1d5192", 0, r * T, W, T); }
    for (let x = 0; x < W; x += T) { B("#5a5f78", x, MEDIAN * T, T, T); B("#6d7391", x, MEDIAN * T, T, 3); B("#44485f", x + T - 2, MEDIAN * T, 2, T); }
    for (let x = 100; x < W; x += 200) { B("#2b9a5a", x, MEDIAN * T + 14, 22, 22); B("#1f7a44", x, MEDIAN * T + 28, 22, 8); B("#3fae5a", x + 4, MEDIAN * T + 8, 14, 10); }
    for (let r = 6; r <= 9; r++) { B("#2b2f3e", 0, r * T, W, T); if (r > 6) for (let x = 6; x < W; x += 56) B("#8d98b8", x, r * T - 1, 30, 3); }
    B("#050814", 0, 6 * T, W, 2); B("#050814", 0, 10 * T - 2, W, 2);
    for (let r = 10; r <= 11; r++) { for (let x = 0; x < W; x += T) { B(r === 10 ? "#6d7391" : "#4a4f6a", x, r * T, T, T); B("#44485f", x, r * T + T - 2, T, 2); B("#44485f", x + T - 2, r * T, 2, T); } }
    B("#17213c", 220, 11 * T + 4, 360, 42); B("#27345b", 220, 11 * T + 4, 360, 4); B("#c9d2e8", 232, 11 * T + 12, 12, 24); B("#c9d2e8", 270, 11 * T + 12, 12, 24); B("#ffd34e", 310, 11 * T + 14, 20, 16);
    g.font = '22px "VT323", monospace'; g.textAlign = "center"; g.fillStyle = "#f7f0d5"; g.fillText("SEDE · GÉNOVA 13", 470, 11 * T + 34);
    bg = c;
  }
  function vehicle(l, o) {
    const x = o.x, w = l.wpx, cy = l.cy, ghost = clearT > 0;
    ctx.save(); ctx.globalAlpha = ghost ? .22 : 1; ctx.translate(x, cy); if (l.dir < 0) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    const h = 38, y0 = -h / 2 + 2;
    const label = (txt, lx, ly, col) => { ctx.save(); ctx.translate(lx, ly); if (l.dir < 0) ctx.scale(-1, 1); ctx.font = `7px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); };
    if (l.type === "bus") { R("#050814", 0, y0 - 2, w, h + 4); R(o.col, 2, y0, w - 4, h); R("rgba(255,255,255,.2)", 2, y0, w - 4, 5); for (let i = 0; i < 5; i++) { R("#101629", 14 + i * 26, y0 + 5, 20, 12); R("#6fa0ff", 15 + i * 26, y0 + 6, 6, 3); } R("#f7f0d5", 8, y0 + 22, w - 16, 10); label("VOTA YA", w / 2, y0 + 30, "#101629"); R("#ffd34e", w - 6, y0 + 24, 5, 6); R("#050814", 14, y0 + h - 2, 20, 6); R("#050814", w - 40, y0 + h - 2, 20, 6); }
    else if (l.type === "sondeo") { R("#050814", 0, y0 + 6, w, h - 6); R("#ff8a3d", 2, y0 + 8, w - 4, h - 12); R("#050814", 14, y0 - 4, w - 30, 14); R("#f7f0d5", 16, y0 - 2, w - 34, 10); label(o.txt, w / 2 - 4, y0 + 6, "#101629"); R("#101629", 14, y0 + 12, 16, 9); R("#101629", w - 34, y0 + 12, 16, 9); R("#ffd34e", w - 5, y0 + 20, 4, 5); R("#050814", 10, y0 + h - 4, 14, 6); R("#050814", w - 26, y0 + h - 4, 14, 6); }
    else if (l.type === "oficial") { R("#050814", 0, y0 + 8, w, h - 8); R("#14141c", 2, y0 + 10, w - 4, h - 14); R("#ffd34e", 2, y0 + 22, w - 4, 3); R("#2a3350", 18, y0 + 2, w - 36, 12); R("#4a5a88", 20, y0 + 4, 14, 8); R("#ff4d61", w - 18, y0 + 14, 14, 3); R("#ffd34e", w - 18, y0 + 17, 14, 3); R("#f7f0d5", w - 5, y0 + 24, 4, 5); R("#050814", 8, y0 + h - 4, 14, 6); R("#050814", w - 24, y0 + h - 4, 14, 6); }
    else { R("#050814", 0, y0, w, h); R("#f7f0d5", 2, y0 + 2, w - 4, h - 4); R("#d9465b", 2, y0 + 22, w - 4, 5); R("#101629", w - 30, y0 + 6, 24, 12); R("#6fa0ff", w - 28, y0 + 7, 7, 3); R("#8d98b8", 14, y0 - 8, 16, 8); R("#8d98b8", 28, y0 - 12, 10, 16); label("MITIN", 28, y0 + 18, "#101629"); R("#ffd34e", w - 5, y0 + 24, 4, 6); R("#050814", 10, y0 + h - 4, 14, 6); R("#050814", w - 30, y0 + h - 4, 14, 6); }
    ctx.restore();
  }
  function floater(l, o) {
    const x = Math.round(o.x), w = l.wpx, cy = l.cy;
    if (l.type === "tert") {
      const sf = surfaced(l, o), ph = (t * .35 + o.ph) % 1, warn = ph > .6 && ph <= .72, dive = ph > .72;
      if (dive) { ctx.fillStyle = "rgba(255,255,255,.25)"; for (let i = 0; i < w / T; i++) { ctx.fillRect(x + i * T + 12, cy - 6 + Math.sin(t * 6 + i) * 3, 22, 3); } return; }
      ctx.globalAlpha = warn && Math.floor(t * 10) % 2 ? .45 : 1;
      R("#050814", x, cy - 20, w, 40); R("#8a5a3b", x + 3, cy - 17, w - 6, 34); R("#6b4423", x + 3, cy + 6, w - 6, 11);
      for (let i = 0; i < Math.round(w / T); i++) { const hx = x + i * T + T / 2; R("#f2b184", hx - 8, cy - 14, 16, 14); R(["#1b5fd1", "#d9465b", "#2b9a5a"][i % 3], hx - 7, cy, 14, 8); R("#101629", hx - 4, cy - 10, 3, 3); R("#101629", hx + 2, cy - 10, 3, 3); R("#aab4d5", hx + 8, cy - 4, 4, 8); }
      ctx.globalAlpha = 1; void sf;
    } else {
      R("#050814", x, cy - 20, w, 40); R("#f1e8c8", x + 3, cy - 17, w - 6, 34); R("#d9d2b2", x + 3, cy + 10, w - 6, 7);
      ctx.font = `${l.type === "editorial" ? 9 : 8}px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillStyle = "#101629"; ctx.fillText(l.type === "editorial" ? o.head : "URGENTE", x + w / 2, cy - 4);
      R("#8d8870", x + 10, cy + 2, w - 20, 2); R("#8d8870", x + 10, cy + 7, w - 34, 2); R("#d9465b", x + 3, cy - 17, w - 6, 4);
    }
  }
  function drawPlayer() {
    if (!pl) return; const x = pl.x, y = pl.y;
    if (pl.dead) {
      const k = clamp(pl.deadT / .4, 0, 1);
      if (pl.kind === "coche") { R("#050814", x - 20, y + 4, 40, 10); R("#1b3a8a", x - 18, y + 5, 36, 6); R("#f2b184", x - 8, y + 2, 16, 6); R("#ff4d61", x - 4, y + 6, 8, 2); R("#8a5a3b", x + 12, y + 6, 10, 6); }
      else if (pl.kind === "agua") { ctx.strokeStyle = `rgba(255,255,255,${(1 - k).toFixed(2)})`; ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + 8, 10 + i * 10 + k * 20, 5 + i * 4 + k * 8, 0, 0, 7); ctx.stroke(); } R("#f2b184", x - 6, y - 4 + k * 12, 12, 10 * (1 - k)); }
      else { for (let i = 0; i < 6; i++) R("#ffd34e", x + Math.cos(i + t * 5) * 22 * k, y - 10 + Math.sin(i + t * 5) * 14 * k, 5, 5); R("#1b3a8a", x - 10, y - 4, 20, 22); }
      return;
    }
    const up = pl.hop ? 1 : 0, fr = Math.floor(t * 4) % 2, by = -Math.sin(Math.min(1, pl.hop ? pl.hop.t / pl.hop.dur : 0) * Math.PI) * 4;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y + by)); ctx.fillStyle = "rgba(0,0,0,.3)"; ctx.beginPath(); ctx.ellipse(0, 20 - by, 14, 5, 0, 0, 7); ctx.fill();
    R("#050814", -13, -22, 26, 44);
    R("#1b3a8a", -10, -6, 20, 20); R("#f7f0d5", -3, -6, 6, 8); R("#3b82f6", -1, -4, 3, 11);
    R("#1b3a8a", -14 + (up ? -2 : 0), -4, 5, 12 + (up ? 3 : 0)); R("#1b3a8a", 9 + (up ? 2 : 0), -4, 5, 12 + (up ? 3 : 0));
    R("#14141c", -9, 14, 7, 6 + (up ? 2 : fr)); R("#14141c", 2, 14, 7, 6 + (up ? fr : 2));
    R("#f2b184", -8, -20, 16, 15); R("#8d98b8", -9, -22, 18, 6); R("#8d98b8", -9, -18, 3, 6); R("#8d98b8", 6, -18, 3, 6);
    R("#101629", -5, -14, 3, 3); R("#101629", 2, -14, 3, 3); R("#c0614f", -3, -8, 6, 2);
    R("#8a5a3b", pl.facing > 0 ? 10 : -20, 6, 10, 8); R("#d9992a", pl.facing > 0 ? 13 : -17, 8, 4, 3);
    ctx.restore();
  }
  function drawDoors() {
    doors.forEach((d, i) => {
      const x = DOORS[i] * T, cx = x + DOOR_W * T / 2;
      if (d.filled) { R("#0e3a22", x + 8, 12, DOOR_W * T - 16, T - 12); R("#f2b184", cx - 18, 20, 12, 12); R("#1b3a8a", cx - 20, 32, 16, 12); R("#e8e0c0", cx + 6, 20, 12, 12); R("#8a5a3b", cx + 4, 32, 16, 12); R("#3cff7a", cx - 3, 28, 6, 6); }
      if (d.ev && d.ev.type === "baron") { const warn = d.ev.t < d.ev.warn; if (!warn || Math.floor(t * 8) % 2) { R("#7a1f31", x + 8, 12, DOOR_W * T - 16, T - 12); R("#f2b184", cx - 10, 18, 20, 18); R("#101629", cx - 7, 22, 5, 3); R("#101629", cx + 2, 22, 5, 3); R("#101629", cx - 8, 20, 8, 2); R("#101629", cx, 20, 8, 2); R("#101629", cx - 5, 30, 10, 3); R("#ff4d61", cx - 4, 36, 8, 10); } if (warn) outlinedText("!", cx, 9, "#ff4d61", `14px ${FONT_PX}`); }
      if (d.ev && d.ev.type === "gaviota") { const fy = 22 + Math.sin(t * 6) * 3; R("#f7f0d5", cx - 10, fy, 20, 8); R("#f7f0d5", cx - 18, fy - 4 + Math.sin(t * 14) * 4, 10, 4); R("#f7f0d5", cx + 8, fy - 4 + Math.sin(t * 14) * 4, 10, 4); R("#ffb347", cx + 10, fy + 2, 7, 3); R("#101629", cx + 4, fy + 1, 2, 2); }
    });
  }
  function drawPickup() {
    if (!pickup) return; const x = pickup.col * T + T / 2, y = MEDIAN * T + T / 2 + Math.sin(t * 5) * 3, blink = pickup.t > 10 && Math.floor(t * 6) % 2;
    if (blink) return; ctx.fillStyle = `rgba(255,211,78,${(.25 + .12 * Math.sin(t * 6)).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fill();
    R("#050814", x - 14, y - 16, 28, 32); R(pickup.type === "derogar" ? "#f7f0d5" : "#31d7c7", x - 12, y - 14, 24, 28);
    if (pickup.type === "derogar") { R("#d9465b", x - 9, y - 4, 18, 3); for (let i = 0; i < 4; i++) { R("#101629", x - 9 + i * 5, y - 11, 3, 3); R("#8d8870", x - 9, y + 2 + i * 3, 18, 2); } }
    else { R("#101629", x - 9, y + 6, 4, 6); R("#101629", x - 3, y, 4, 12); R("#101629", x + 3, y - 8, 4, 20); R("#ffd34e", x - 9, y - 10, 6, 3); }
    outlinedText(pickup.type === "derogar" ? "DEROGAR" : "ENCUESTA", x, y + 30, "#f7f0d5", `7px ${FONT_PX}`);
  }
  function render() {
    ctx.save(); if (shakeT > 0) ctx.translate(Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM)));
    ctx.drawImage(bg, 0, 0);
    for (let r = 1; r <= 4; r++) { ctx.fillStyle = "rgba(255,255,255,.12)"; for (let x = -((t * 20 * (r % 2 ? 1 : -1)) % 80); x < W; x += 80) ctx.fillRect(Math.round(x), r * T + 10 + Math.round(Math.sin(t * 2 + x) * 2), 36, 3); }
    for (const l of lanes) if (l.kind === "river") for (const o of l.objs) { if (o.x < W && o.x + l.wpx > 0) floater(l, o); }
    for (const l of lanes) if (l.kind === "road") for (const o of l.objs) { if (o.x < W && o.x + l.wpx > 0) vehicle(l, o); }
    drawDoors(); drawPickup(); drawPlayer();
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    ctx.restore();
    for (const f of floats) { ctx.globalAlpha = clamp(1.7 - f.t / f.life * 1.7 + .2, 0, 1); outlinedText(f.text, f.x, f.y, f.color, `22px ${FONT_T}`); } ctx.globalAlpha = 1;
    // barra de plazo
    const k = clamp(clock / clockMax, 0, 1); R("#050814", 8, H - 22, 204, 14); R("#17213c", 10, H - 20, 200, 10); R(k < .25 ? "#ff4d61" : "#ffd34e", 10, H - 20, 200 * k, 10); outlinedText("PLAZO", 112, H - 26, "#aab4d5", `7px ${FONT_PX}`);
    if (slowT > 0) outlinedText(`ENCUESTA ${slowT.toFixed(1)}`, W - 12, 80, "#31d7c7", `20px ${FONT_T}`, "right");
    if (clearT > 0) outlinedText(`DEROGADO ${clearT.toFixed(1)}`, W - 12, slowT > 0 ? 104 : 80, "#ffd34e", `20px ${FONT_T}`, "right");
    if (bubble && pl) { ctx.font = `22px ${FONT_T}`; const w = Math.ceil(ctx.measureText(bubble.text).width) + 20, h = 28, bx = clamp(Math.round(pl.x - w / 2), 8, W - w - 8), by = Math.round(clamp(pl.y - 72, 6, H - 80)); ctx.globalAlpha = clamp(Math.min(bubble.t / .12, (bubble.life - bubble.t) / .25, 1), 0, 1); R("#050814", bx - 3, by - 3, w + 6, h + 6); R("#f7f0d5", bx, by, w, h); ctx.fillStyle = "#050814"; ctx.beginPath(); ctx.moveTo(pl.x - 6, by + h + 3); ctx.lineTo(pl.x + 6, by + h + 3); ctx.lineTo(pl.x, by + h + 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#f7f0d5"; ctx.beginPath(); ctx.moveTo(pl.x - 4, by + h); ctx.lineTo(pl.x + 4, by + h); ctx.lineTo(pl.x, by + h + 7); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#101629"; ctx.textAlign = "left"; ctx.fillText(bubble.text, bx + 10, by + 21); ctx.globalAlpha = 1; }
    if (bannerT > 0) { ctx.globalAlpha = clamp(bannerT / .5, 0, 1); outlinedText(bannerText, W / 2, 300, "#ffd34e", `${bannerText.length > 14 ? 18 : 24}px ${FONT_PX}`); ctx.font = `24px ${FONT_T}`; ctx.fillStyle = "#050814"; ctx.fillText(bannerSub, W / 2 + 1, 335); ctx.fillStyle = "#f7f0d5"; ctx.fillText(bannerSub, W / 2, 334); ctx.globalAlpha = 1; }
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
  AUD.setOn(soundOn); paintSound(); buildBg(); reset(); titleScreen(); fixAccents(document.querySelector(".cabinet header")); fixAccents(document.querySelector(".hud"));
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('22px "VT323"')]).then(() => buildBg()).catch(() => {});
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, round, lives, score, seats, row: pl && pl.row, x: pl && Math.round(pl.x), dead: pl && pl.dead, kind: pl && pl.kind, clock: Math.round(clock), doors: doors.filter(d => d.filled).length, slow: +slowT.toFixed(1), clear: +clearT.toFixed(1), brk: +breakT.toFixed(1) });
    const futureX = (lane, o, dt) => { let x = o.x + lane.dir * lane.speed * dt; const span = lane.total; x = ((x + lane.wpx + 120) % span + span) % span - lane.wpx - 120; return x; };
    window.__rm = {
      step: (n = 1, dt = FIXED, draw = true) => { for (let i = 0; i < n; i++) update(dt); if (draw) render(); return snap(); }, snap, play, hop, title: titleScreen,
      teleport: (col, row) => { pl.x = col * T + T / 2; pl.y = row * T + T / 2; pl.row = row; pl.hop = null; }, doors: () => doors.map(d => ({ f: d.filled, ev: d.ev && d.ev.type })), setBreak: n => { breakT = n; }, render, over: () => { lives = 0; gameOver(); },
      lanes: () => lanes.map(l => ({ row: l.row, kind: l.kind, type: l.type, n: l.objs.length })), spawnPickup: type => { pickup = { type, col: 7, t: 0 }; },
      /* ¿es seguro estar en (x,row) dentro de dt segundos? (solo para el piloto de pruebas) */
      safe: (x, row, dt) => { const lane = laneAt(row); if (row === START_ROW || row === MEDIAN) return true; if (!lane) return false; if (lane.kind === "road") return !lane.objs.some(o => { const ox = futureX(lane, o, dt); return x + 12 > ox + 6 && x - 12 < ox + lane.wpx - 6; }); return lane.objs.some(o => { const ox = futureX(lane, o, dt); const ph = ((t + dt) * .35 + o.ph) % 1; return (!lane.dive || ph < .66) && x > ox + 10 && x < ox + lane.wpx - 10; }); },
      laneSpeed: row => { const l = laneAt(row); return l ? l.dir * l.speed : 0; }
    };
  }
})();
