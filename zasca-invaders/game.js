"use strict";
/* Zasca Invaders — Sanxe Games.
   Shooter satírico: el Tribuno defiende su atril del hemiciclo a base de zascas. Cada disparo gasta turno de palabra (acertar lo recarga);
   si se agota, la Presidencia le retira la palabra. Cinco actos con jefe final, ovnis tertulianos y mejoras (hilo, interrupción, pregunta a la mesa). */
(() => {
  const AUD = window.ZI_AUD, sfx = AUD.sfx, music = AUD.music;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[(Math.random() * a.length) | 0];
  const pad = (n, l) => String(Math.max(0, Math.floor(n))).padStart(l, "0");
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const safe = (fn, fb = null) => { try { return fn(); } catch { return fb; } };
  const store = { get: k => safe(() => localStorage.getItem(k)), set: (k, v) => safe(() => localStorage.setItem(k, v)) };
  const DEBUG = /[?&]debug/.test(location.search);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = $("#game"), ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = 800, H = 600, FIXED = 1 / 120, PY = 556, GAPX = 54, GAPY = 40, INVADE_Y = 466;
  const BENCH = [
    { n: "IZQUIERDA", tie: "#d9465b", suit: "#3a2a3e", pts: 10, hair: "#2a1c14", kind: "excusa" },
    { n: "DERECHA", tie: "#2b6cff", suit: "#26304a", pts: 20, hair: "#8a8f9e", kind: "bulo" },
    { n: "CENTRO", tie: "#ffb347", suit: "#3a3a2a", pts: 30, hair: "#5a3a22", kind: "orden" },
    { n: "MIXTO", tie: "#c792ea", suit: "#2a2a44", pts: 40, hair: "#d8dce8", kind: "bulo" }
  ];
  const ROWS = [3, 2, 1, 0, 1];
  const STAGES = [
    { name: "PLENO DEL CONGRESO", sub: "Silencio, señorías. Empieza el espectáculo." },
    { name: "ENTREVISTA DE TELEVISIÓN", sub: "Tres minutos, cinco interrupciones." },
    { name: "HILO DE TUITS", sub: "Ni un carácter de más. Ni de menos." },
    { name: "DEBATE ELECTORAL", sub: "Cronómetro en marcha y nadie escucha." },
    { name: "SESIÓN DE CONTROL", sub: "Preguntas al Gobierno. Respuestas, ninguna." }
  ];
  const BOSSES = [
    { name: "EL MODERADOR DEL MARTILLO", pat: "martillo", hp: 34, suit: "#3a2418", tie: "#ffd34e", hair: "#d8dce8", prop: "gavel", say: "¡Silencio, señorías!" },
    { name: "EL PRESENTADOR QUE INTERRUMPE", pat: "interrumpe", hp: 40, suit: "#17306b", tie: "#ff4d61", hair: "#2a1c14", prop: "mic", say: "¡Pero déjeme terminar!" },
    { name: "EL EJÉRCITO DE TROLES", pat: "bots", hp: 44, suit: "#1d3b2a", tie: "#3cff7a", hair: "#101629", prop: "phone", say: "RT si estás de acuerdo." },
    { name: "EL ENCUESTADOR OFICIAL", pat: "encuesta", hp: 48, suit: "#5a2a5e", tie: "#31d7c7", hair: "#8a8f9e", prop: "chart", say: "Margen de error: usted." },
    { name: "LA MESA DEL CONGRESO", pat: "mesa", hp: 62, suit: "#7a1f31", tie: "#ffd34e", hair: "#d8dce8", prop: "gavel", say: "Se levanta la sesión (de usted)." }
  ];
  const HIT_SAY = ["Eso lo dirá usted.", "Pregúntele a su portavoz.", "¡Rectifique!", "Ya lo dije en un hilo.", "Mi tuit era claro, su cerebro no.", "Zasca.", "Un tuit borrado a tiempo vale por dos.", "Y encima con faltas de ortografía.", "Dígalo en la tribuna, no en el pasillo."];
  const QUOTES = ["En 18 meses dejo el escaño. Palabra de Tribuno.", "Nos vemos en el infierno.", "¿Alguien tiene unas esposas?", "Con interrupciones, hemos hablado tres minutos de cinco."];
  const LOCK_SAY = ["Con interrupciones, hemos hablado tres minutos de cinco.", "Me han cortado el micro. Qué casualidad.", "Esto es censura (con cronómetro).", "Tres minutos de cinco. Otra vez."];
  const BOSS_SAY = ["Señor Moderador: hoy el martillo lo traigo yo.", "¿Alguien tiene unas esposas?", "No es un bulo, es un hilo.", "Margen de error: lo que tarde en irme (18 meses).", "Nos vemos en el infierno."];
  const COMBO_SAY = { 8: "Esto no es un zasca, es un hilo.", 16: "En 18 meses lo dejo. Pero hoy no.", 24: "Hoy no me interrumpe ni el Moderador." };
  const POWER_SAY = { hilo: "Esto lo tuiteo ya.", interrup: "Bulo time: que nadie se mueva.", mesa: "Esto lo pacto yo, con quien sea.", escano: "Otros 18 meses de escaño." };
  const pickQuip = () => Math.random() < .4 ? pick(QUOTES) : pick(HIT_SAY);
  const HURT_SAY = ["Eso es un bulo.", "Me lo han sacado de contexto.", "Cancelado, pero con likes.", "Ni me enteré de la pregunta."];
  const POWERS = {
    hilo: { name: "TUIT VIRAL", sub: "Disparo triple", col: "#2b9cf0" },
    interrup: { name: "BULO TIME", sub: "Todos congelados", col: "#ffd34e" },
    mesa: { name: "PACTO", sub: "Los de abajo se van a pactar", col: "#c792ea" },
    escano: { name: "UN ESCAÑO MÁS", sub: "+1 vida", col: "#3cff7a" }
  };

  const UI = { score: $("#score"), stage: $("#stage"), wave: $("#wave"), lives: $("#lives"), best: $("#best"), status: $("#game-status"), overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"), sound: $("#sound"), pause: $("#pause"), restart: $("#restart"), help: $("#game-help") };
  let state = "title", soundOn = store.get("zi-sound") !== "0", best = +store.get("zi-best") || 0;
  let pl, shots = [], ebul = [], shields = [], enemies = [], form = null, boss = null, ufo = null, powerups = [], particles = [], floats = [], hammers = [], bots = [], bubble = null, banner = null, bgs = [];
  let volId = 0, volleys = new Map(), waveWait = 0, t = 0, acc = 0, last = 0, score = 0, stage = 1, waveN = 1, loop = 0, ufoT = 12, fireT = 1, introT = 0, shakeT = 0, shakeM = 0, flashT = 0, flashCol = "#fff", combo = 0, missStreak = 0, lastKillT = -9, freezeT = 0, tripleT = 0, quipT = 6, bossT = 0, patT = 0, patIdx = 0, cause = "";
  let stats = { shots: 0, hits: 0, maxCombo: 0, waves: 0, bosses: 0, ufos: 0 };
  const keys = { left: false, right: false, fire: false };
  const lvl = () => (stage - 1) * 3 + (waveN - 1) + loop * 15;

  /* ------------------------------------------------------------ escudos (escaños) */
  const SW = 16, SH = 9, CELL = 4;
  function makeShield(x) { const cells = new Uint8Array(SW * SH).fill(1); for (let r = 0; r < SH; r++) for (let c = 0; c < SW; c++) { if (r >= 6 && c >= 5 && c <= 10) cells[r * SW + c] = 0; if (r < 2 && (c < 2 || c >= 14)) cells[r * SW + c] = 0; } return { x, y: 452, cells }; }
  function shieldHit(sh, bx, by, bw, bh, radius = 7) {
    const x0 = Math.floor((bx - bw / 2 - sh.x) / CELL), x1 = Math.floor((bx + bw / 2 - sh.x) / CELL), y0 = Math.floor((by - bh / 2 - sh.y) / CELL), y1 = Math.floor((by + bh / 2 - sh.y) / CELL); let hit = false;
    for (let r = Math.max(0, y0); r <= Math.min(SH - 1, y1); r++) for (let c = Math.max(0, x0); c <= Math.min(SW - 1, x1); c++) if (sh.cells[r * SW + c]) { hit = true; break; }
    if (!hit) return false;
    for (let r = 0; r < SH; r++) for (let c = 0; c < SW; c++) { const cx = sh.x + c * CELL + 2, cy = sh.y + r * CELL + 2; if ((cx - bx) ** 2 + (cy - by) ** 2 <= radius * radius) sh.cells[r * SW + c] = 0; }
    return true;
  }

  /* --------------------------------------------------------------- partida */
  function reset() {
    pl = { x: W / 2, vx: 0, lives: 3, inv: 0, mic: 100, lock: 0, cd: 0, idle: 0, pose: 0 };
    waveWait = 0; shots = []; ebul = []; enemies = []; boss = null; ufo = null; powerups = []; particles = []; floats = []; hammers = []; bots = []; bubble = null; banner = null; form = null;
    shields = [0, 1, 2, 3].map(i => makeShield(88 + i * 186));
    score = 0; stage = 1; waveN = 1; loop = 0; combo = 0; missStreak = 0; volleys.clear(); freezeT = 0; tripleT = 0; ufoT = rnd(10, 16); introT = 0; cause = ""; quipT = 6; lastKillT = -9;
    stats = { shots: 0, hits: 0, maxCombo: 0, waves: 0, bosses: 0, ufos: 0 };
    startWave(true); waveWait = 0; if (state === "title" && form) form.oy = form.targetY; placeEnemies(); updateHud();
  }
  function updateHud() { UI.score.textContent = pad(score, 5); UI.stage.textContent = stage + (loop ? "+" : ""); UI.wave.textContent = waveN === 3 ? "J" : waveN; UI.lives.textContent = pl.lives; UI.best.textContent = pad(Math.max(best, score), 5); }
  const setControls = () => { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; };
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };

  function startWave(first) {
    shots = []; ebul = []; hammers = []; bots = []; boss = null; enemies = [];
    if (waveN === 3) { const cfg = BOSSES[(stage - 1) % 5], hp = Math.round(cfg.hp * (1 + loop * .35)); boss = { ...cfg, hp, max: hp, x: W / 2, y: -120, ty: 100, dir: 1, flash: 0, t: 0 }; patT = 2.4; patIdx = 0; introT = 2.6; banner = { text: "¡JEFE!", sub: cfg.name, t: 0, life: 2.6 }; sfx.boss(); music.setBoss(true); setTimeout(() => { if (state === "playing" && boss) say(BOSS_SAY[(stage - 1) % 5], 3); }, 1300); }
    else {
      music.setBoss(false); const n = lvl(), rows = Math.min(5, 3 + Math.floor(n / 3)), cols = Math.min(10, 7 + Math.floor(n / 4));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const b = ROWS[r % ROWS.length]; enemies.push({ r, c, b, alive: true, hp: stage >= 3 && r === 0 ? 2 : 1, x: 0, y: 0, flash: 0 }); }
      form = { ox: (W - (cols - 1) * GAPX) / 2, oy: -150, dir: 1, total: enemies.length, anim: 0, animT: 0, cols, rows, targetY: 64 };
      introT = 2.2; banner = { text: waveN === 1 ? `ACTO ${stage}` : `OLA ${waveN}`, sub: waveN === 1 ? STAGES[(stage - 1) % 5].name : "Más portavoces, más ruido.", t: 0, life: 2.4 }; if (!first) sfx.wave();
    }
    fireT = 1.4; updateHud();
  }

  /* ---------------------------------------------------------------- pantallas */
  function showOverlay({ stamp = "SÁTIRA PIXELADA", title, text = "", extra = "", actions = [], help = false, board = null }) {
    UI.help.hidden = !help; UI.stamp.textContent = stamp; UI.title.textContent = title; UI.text.textContent = text; UI.text.hidden = !text;
    if (typeof extra === "string") UI.extra.innerHTML = extra; else { UI.extra.innerHTML = ""; UI.extra.appendChild(extra); }
    UI.actions.innerHTML = "";
    actions.forEach((a, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a.secondary ? " secondary" : ""); b.textContent = a.label; b.addEventListener("click", a.fn); UI.actions.appendChild(b); if (i === 0) requestAnimationFrame(() => b.focus()); });
    if (board && window.SGS) SGS.attach(UI.extra, board);
    UI.overlay.classList.remove("hidden"); fixAccents(UI.overlay);
  }
  const hideOverlay = () => UI.overlay.classList.add("hidden");
  const goHome = () => { location.href = "../"; };
  function posterNode() {
    const box = document.createElement("div"); box.className = "ficha";
    const cv = document.createElement("canvas"); cv.width = 176; cv.height = 104; cv.setAttribute("aria-hidden", "true"); const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    const bg = buildBg(0); g.drawImage(bg, 0, 120, 800, 300, 0, 0, 176, 104);
    g.fillStyle = "rgba(5,8,20,.35)"; g.fillRect(0, 0, 176, 104); g.fillStyle = "#6b4423"; g.fillRect(0, 92, 176, 12);
    for (let i = 0; i < 5; i++) { g.save(); g.translate(22 + i * 33, 40 + (i % 2) * 6); g.scale(.9, .9); drawPerson(g, { suit: BENCH[ROWS[i % 4]].suit, tie: BENCH[ROWS[i % 4]].tie, hair: BENCH[ROWS[i % 4]].hair, frame: i % 2, skin: "#d8a37c" }); g.restore(); }
    g.save(); g.translate(88, 100); g.scale(1.5, 1.5); drawTribuno(g, 1, 0); g.restore();
    g.strokeStyle = "#050814"; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 173, 101);
    box.appendChild(cv);
    const dl = document.createElement("dl");
    [["CANDIDATO", "RUFIÁN, EL TRIBUNO"], ["ARMA", "EL TUIT AFILADO"], ["LEMA", "«ESO LO DIRÁ USTED»"], ["SUPERPODER", "BORRAR TUITS A TIEMPO"], ["PUNTO DÉBIL", "SU TURNO DE PALABRA"], ["ENEMIGO", "TODO EL HEMICICLO (Y LA TERTULIA)"]].forEach(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
    box.appendChild(dl); return box;
  }
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    showOverlay({ help: true, stamp: "SESIÓN PLENARIA · TURNO ABIERTO", title: "ZASCA INVADERS", text: `Eres Rufián, el Tribuno, y el hemiciclo avanza hacia tu atril. Lanza zascas para frenar a los portavoces, pero ojo: cada disparo gasta tu turno de palabra y solo acertar lo recarga.${best ? ` Récord: ${fmt(best)} likes.` : ""}`, extra: posterNode(), actions: [{ label: "TOMAR LA PALABRA", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function play() { if (window.SGS) SGS.begin("zasca-invaders"); state = "playing"; reset(); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(0); UI.status.textContent = "Defiende el atril lanzando zascas."; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now(); }
  function pauseScreen() { if (state !== "playing") return; state = "paused"; setControls(); music.pause(true); keys.left = keys.right = keys.fire = false; showOverlay({ help: true, stamp: "SESIÓN SUSPENDIDA", title: "PAUSA", text: "La Presidencia decreta un receso. Nadie lo respeta.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR", secondary: true, fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] }); }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function gameOver(why) {
    state = "over"; cause = why; setControls(); music.stop(); keys.left = keys.right = keys.fire = false; const nb = score > best; if (nb) { best = score; store.set("zi-best", String(best)); setTimeout(() => sfx.best(), 600); } else sfx.over(); updateHud();
    const acc2 = stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0, row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    const head = why === "invasion" ? ["SE HAN TOMADO EL ATRIL", "El hemiciclo ocupa la tribuna. Los asesores lo llaman «reordenación del debate»."] : why === "rebote" ? ["AUTOGOL: EL ZASCA REBOTÓ", "Fuentes del entorno aseguran que «el tuit estaba bien, el mundo no»."] : pick([["EN 18 MESES SE IBA... Y AQUÍ SIGUE", "La sesión se levanta. El escaño, no."], ["CANCELADO EN DIRECTO", "El Tribuno dice que borrará el tuit. Del otro."], ["SE ACABÓ EL TURNO DE PALABRA", "La Presidencia agradece su intervención. Y su silencio."], ["ELIMINADO POR UN BULO", "El bulo ya tiene 40.000 retuits. La rectificación, tres."]]);
    UI.status.textContent = `Fin de la sesión con ${score} likes.`;
    showOverlay({
      board: { game: "zasca-invaders", score, unit: "likes", reason: why === "invasion" ? 3 : why === "rebote" ? 4 : why === "bulo" ? 1 : pick([0, 2, 5]), lv: stage + loop * 5 }, stamp: `ACTO ${stage}${loop ? "+" : ""} · ${waveN === 3 ? "JEFE" : "OLA " + waveN}`, title: head[0], text: "",
      extra: `<div class="acta"><b>DIARIO DE SESIONES · INTERVENCIÓN Nº ${4000 + stats.shots}</b><dl>${row("LIKES", `<u>${fmt(score)}${nb ? " · ¡RÉCORD!" : ` · RÉCORD ${fmt(best)}`}</u>`)}${row("ZASCAS", `${stats.shots} LANZADOS`)}${row("PUNTERÍA", `${acc2} % DE ACIERTOS`)}${row("MEJOR RACHA", `x${stats.maxCombo}`)}${row("OLAS", `${stats.waves} SUPERADAS · ${stats.bosses} JEFES`)}${row("TERTULIANOS", `${stats.ufos} CAZADOS`)}${row("VEREDICTO", head[1].toUpperCase())}</dl><i class="sello">${nb ? "RÉCORD" : "SE LEVANTA LA SESIÓN"}</i></div>`,
      actions: [{ label: "OTRA SESIÓN", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }]
    });
  }

  /* ------------------------------------------------------------------ efectos */
  const shake = (m, d = .25) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, d); };
  const flash = (c = "#fff", d = .14) => { if (!reduced) { flashT = d; flashCol = c; } };
  const float = (x, y, text, color, life = 1.1, size = 22, heart = false) => floats.push({ x, y, text, color, t: 0, life, size, heart });
  const say = (text, life = 2.2) => { bubble = { text, t: 0, life }; };
  function burst(x, y, colors, k = 10, sp = 200) { for (let i = 0; i < k; i++) { const a = rnd(0, 6.283), v = rnd(.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, t: 0, life: rnd(.35, .8), color: pick(colors), s: pick([3, 4, 5]), g: 420 }); } }
  const multNow = () => Math.min(5, 1 + Math.floor(combo / 4));
  function addScore(base, x, y) { const m = multNow(), g = base * m; score += g; float(x, y, `+${g}${m > 1 ? ` x${m}` : ""}`, m > 1 ? "#ffd34e" : "#f7f0d5", .9); updateHud(); }

  /* ------------------------------------------------------------------ acciones */
  function fire() {
    if (state !== "playing" || pl.lock > 0 || pl.cd > 0) return; if (pl.mic < 7) return;
    pl.cd = .22; pl.mic = Math.max(0, pl.mic - 7); pl.idle = 0; pl.pose = .18; stats.shots++; sfx.shoot();
    const y = PY - 54, v = ++volId; volleys.set(v, { hit: false, counted: false }); if (tripleT > 0) [-1, 0, 1].forEach(d => shots.push({ x: pl.x + d * 6, y, vx: d * 80, vy: -560, hit: false, v })); else shots.push({ x: pl.x, y, vx: 0, vy: -580, hit: false, v });
    if (pl.mic <= 0) { pl.lock = 2.2; sfx.lock(); banner = { text: "PALABRA RETIRADA", sub: "Se le ha acabado el tiempo, señoría.", t: 0, life: 2 }; say(pick(LOCK_SAY), 2); }
  }
  function playerHit(kind) {
    if (pl.inv > 0 || state !== "playing") return; pl.lives--; pl.inv = 1.9; combo = 0; sfx.hurt(); shake(7, .4); flash("#ff4d61", .18); burst(pl.x, PY - 30, ["#ff4d61", "#f7f0d5", "#ffd34e"], 14); updateHud();
    if (pl.lives <= 0) { gameOver(kind === "rebote" ? "rebote" : kind === "boss" ? "boss" : "bulo"); return; } if (Math.random() < .6) say(pick(HURT_SAY), 2);
  }
  function applyPower(type, x, y) {
    sfx.power(); const P = POWERS[type]; if (POWER_SAY[type]) say(POWER_SAY[type], 2); if (type !== "escano") float(x, y - 20, P.name, P.col, 1.5);
    if (type === "hilo") tripleT = 9; else if (type === "interrup") { freezeT = 4; sfx.freeze(); flash("#bde8ff", .2); }
    else if (type === "escano") { pl.lives = Math.min(5, pl.lives + 1); updateHud(); float(x, y - 40, "+1", "#3cff7a", 1.8, 56, true); float(x, y - 8, "UN ESCAÑO MÁS", "#3cff7a", 1.5, 20); burst(x, y, ["#3cff7a", "#f7f0d5", "#ffffff"], 18, 190); }
    else { sfx.bomb(); shake(9, .5); flash("#ffffff", .3); ebul = []; hammers = []; if (boss) { boss.hp -= 12; boss.flash = .3; if (boss.hp <= 0) bossDown(); } const rowsAlive = [...new Set(enemies.filter(e => e.alive).map(e => e.r))].sort((a, b) => b - a).slice(0, 2); for (const e of enemies) if (e.alive && rowsAlive.includes(e.r)) killEnemy(e, true); bots = []; }
  }
  function dropPower(x, y, force) { if (!force && Math.random() > .07) return; powerups.push({ x, y, type: pick(["hilo", "hilo", "interrup", "mesa", "escano"]), vy: 90 }); }
  function killEnemy(e, silent) {
    e.hp--; e.flash = .12; if (e.hp > 0) { sfx.hit(1); return false; } e.alive = false; const b = BENCH[e.b]; sfx.kill(); burst(e.x, e.y, [b.tie, "#f7f0d5", "#ffd34e"], 9, 170);
    if (t - lastKillT < .35 && !silent) { score += 50; float(e.x, e.y - 30, "¡VIRAL! +50", "#31d7c7", 1); } lastKillT = t;
    if (COMBO_SAY[combo]) say(COMBO_SAY[combo], 2.2); addScore(b.pts, e.x, e.y - 14); dropPower(e.x, e.y); if (Math.random() < .14 && !bubble && !silent) say(pickQuip(), 2); return true;
  }
  function bossDown() {
    if (!boss) return; stats.bosses++; sfx.bossDown(); shake(10, .7); flash("#ffffff", .4); burst(boss.x, boss.y, ["#ffd34e", "#ff4d61", "#f7f0d5", "#31d7c7"], 40, 320); score += 1000 * (loop + 1); float(boss.x, boss.y - 40, `¡JEFE FUERA! +${1000 * (loop + 1)}`, "#ffd34e", 2); dropPower(boss.x, boss.y, true);
    boss = null; ebul = []; hammers = []; bots = []; say(pick(["En 18 meses lo dejo. Pero primero, otro hilo.", "Nos vemos en el infierno.", "Y ahora, si me permiten, un hilo."]), 2.6); updateHud(); waveCleared();
  }
  function waveCleared() {
    stats.waves++; score += 200; if (waveN === 3) { stage++; waveN = 1; if (stage > 5) { stage = 1; loop++; } pl.lives = Math.min(5, pl.lives + 1); } else waveN++;
    banner = { text: "¡OLA SUPERADA!", sub: waveN === 1 ? `Siguiente: ${STAGES[(stage - 1) % 5].name}` : "El hemiciclo recarga.", t: 0, life: 2 }; updateHud(); waveWait = 1.9;
  }
  function placeEnemies() { if (!form) return; for (const e of enemies) { e.x = form.ox + e.c * GAPX; e.y = form.oy + e.r * GAPY; } }
  const hit = (ax, ay, aw, ah, bx, by, bw, bh) => Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;

  /* ------------------------------------------------------------- simulación */
  function enemyFire() {
    const alive = enemies.filter(e => e.alive); if (!alive.length) return; const bottoms = new Map(); for (const e of alive) { const c = bottoms.get(e.c); if (!c || e.r > c.r) bottoms.set(e.c, e); } const e = pick([...bottoms.values()]), b = BENCH[e.b], n = lvl();
    const aim = n >= 4 ? clamp((pl.x - e.x) * .18, -70, 70) : 0; ebul.push({ x: e.x, y: e.y + 12, vx: aim, vy: Math.min(330, 190 + n * 6), kind: b.kind, w: 12, h: 14 }); sfx.enemyShot();
  }
  function update(dt) {
    t += dt; if (state !== "playing") return;
    shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt); if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; } if (bubble) { bubble.t += dt; if (bubble.t > bubble.life) bubble = null; }
    freezeT = Math.max(0, freezeT - dt); tripleT = Math.max(0, tripleT - dt); pl.inv = Math.max(0, pl.inv - dt); pl.cd = Math.max(0, pl.cd - dt); pl.pose = Math.max(0, pl.pose - dt);
    // jugador
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0); pl.vx += (dir * 330 - pl.vx) * Math.min(1, dt * 14); pl.x = clamp(pl.x + pl.vx * dt, 28, W - 28);
    if (pl.lock > 0) { pl.lock -= dt; if (pl.lock <= 0) { pl.mic = 35; } } else { pl.idle += dt; if (pl.idle > .45) pl.mic = Math.min(100, pl.mic + 6 * dt); }
    if (keys.fire) fire();
    // formación
    if (form && enemies.length) {
      if (form.oy < form.targetY) form.oy = Math.min(form.targetY, form.oy + 150 * dt);
      const ready = form.oy >= form.targetY - .5, alive = enemies.filter(e => e.alive);
      if (ready && freezeT <= 0 && alive.length) {
        const n = lvl(), speed = Math.min(110, 26 + n * 5) * (1 + (1 - alive.length / form.total) * 2.4); form.ox += form.dir * speed * dt;
        const minC = Math.min(...alive.map(e => e.c)), maxC = Math.max(...alive.map(e => e.c));
        if (form.dir > 0 && form.ox + maxC * GAPX + 18 > W - 16) { form.dir = -1; form.oy += 16; } else if (form.dir < 0 && form.ox + minC * GAPX - 18 < 16) { form.dir = 1; form.oy += 16; }
        form.animT += dt * (1 + speed / 40); if (form.animT > .5) { form.animT = 0; form.anim ^= 1; }
        fireT -= dt; if (fireT <= 0) { fireT = Math.max(.42, 1.45 - .07 * n) * rnd(.6, 1.3); enemyFire(); }
        ufoT -= dt; if (ufoT <= 0 && !ufo) { ufoT = rnd(16, 26); const d = Math.random() < .5 ? 1 : -1; ufo = { x: d > 0 ? -30 : W + 30, y: 36, vx: d * 120, face: 0 }; sfx.ufo(); }
      }
      for (const e of enemies) { e.x = form.ox + e.c * GAPX; e.y = form.oy + e.r * GAPY; e.flash = Math.max(0, e.flash - dt); if (e.alive && e.y + 14 >= INVADE_Y) { gameOver("invasion"); return; } }
      for (const e of alive) if (e.y > 400) for (const sh of shields) shieldHit(sh, e.x, e.y + 8, 24, 22, 9);
      if (ready && !alive.length) { waveCleared(); form = null; }
    }
    if (waveWait > 0) { waveWait -= dt; if (waveWait <= 0) startWave(); }
    updateBoss(dt);
    // ovni
    if (ufo) { ufo.x += ufo.vx * dt; ufo.face += dt * 10; if (Math.floor(t * 6) % 6 === 0 && Math.random() < .02) sfx.ufo(); if ((ufo.vx > 0 && ufo.x > W + 40) || (ufo.vx < 0 && ufo.x < -40)) ufo = null; }
    // disparos del jugador
    for (const s of shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; if (s.hit) continue; const V = volleys.get(s.v);
      if (ufo && hit(s.x, s.y, 12, 10, ufo.x, ufo.y, 40, 26)) { s.hit = true; if (V) V.hit = true; stats.hits++; stats.ufos++; sfx.ufoHit(); const pts = pick([100, 150, 200, 300]); addScore(pts, ufo.x, ufo.y); burst(ufo.x, ufo.y, ["#31d7c7", "#f7f0d5", "#ffd34e"], 16, 220); pl.mic = Math.min(100, pl.mic + 25); dropPower(ufo.x, ufo.y, Math.random() < .6); combo++; stats.maxCombo = Math.max(stats.maxCombo, combo); say("Y la tertulia, enmudecida.", 2); ufo = null; continue; }
      if (boss && boss.y > -20 && hit(s.x, s.y, 12, 10, boss.x, boss.y, 92, 92)) { s.hit = true; if (V) V.hit = true; stats.hits++; boss.hp--; boss.flash = .12; sfx.hit(combo); combo++; stats.maxCombo = Math.max(stats.maxCombo, combo); pl.mic = Math.min(100, pl.mic + 6); addScore(5, s.x, s.y); burst(s.x, s.y, ["#f7f0d5", "#ffd34e"], 4, 120); if (boss.hp <= 0) bossDown(); continue; }
      for (const e of enemies) if (e.alive && hit(s.x, s.y, 12, 10, e.x, e.y, 26, 28)) { s.hit = true; if (V) V.hit = true; stats.hits++; combo++; stats.maxCombo = Math.max(stats.maxCombo, combo); missStreak = 0; pl.mic = Math.min(100, pl.mic + 14); if (killEnemy(e)) { } else sfx.hit(combo); break; }
      for (const b of bots) if (!s.hit && b.alive && hit(s.x, s.y, 12, 10, b.x, b.y, 20, 20)) { s.hit = true; if (V) V.hit = true; b.alive = false; stats.hits++; combo++; stats.maxCombo = Math.max(stats.maxCombo, combo); pl.mic = Math.min(100, pl.mic + 8); sfx.kill(); burst(b.x, b.y, ["#3cff7a", "#f7f0d5"], 6, 150); addScore(30, b.x, b.y); }
      if (!s.hit && s.y < -12) { s.hit = true; if (V && (V.hit || V.counted)) continue; if (V) V.counted = true; combo = 0; missStreak++; if (missStreak >= 5 && missStreak < 8) float(pl.x, PY - 96, `¡AUTOGOL EN ${8 - missStreak}!`, "#ffb347", 1.1, 22); if (missStreak >= 8) { missStreak = 0; ebul.push({ x: pl.x, y: 18, vx: 0, vy: 300, kind: "rebote", w: 16, h: 14 }); banner = { text: "¡AUTOGOL!", sub: "Tu zasca vuelve con intereses.", t: 0, life: 1.6 }; sfx.lock(); } }
    }
    shots = shots.filter(s => !s.hit); if (!shots.length) volleys.clear(); bots = bots.filter(b => b.alive);
    // disparos enemigos
    const slow = freezeT > 0 ? .4 : 1;
    for (const b of ebul) {
      b.x += b.vx * dt * slow; b.y += b.vy * dt * slow; b.dead = b.dead || b.y > H + 20 || b.x < -20 || b.x > W + 20;
      if (!b.dead && b.y > 430) for (const sh of shields) if (shieldHit(sh, b.x, b.y, b.w, b.h, 8)) { b.dead = true; burst(b.x, b.y, ["#8a5a3b", "#a8703a"], 5, 100); break; }
      if (!b.dead && hit(b.x, b.y, b.w, b.h, pl.x, PY - 26, 24, 46)) { b.dead = true; playerHit(b.kind); }
    }
    ebul = ebul.filter(b => !b.dead);
    // powerups
    for (const p of powerups) { p.y += p.vy * dt; if (hit(p.x, p.y, 30, 30, pl.x, PY - 26, 28, 46)) { p.dead = true; applyPower(p.type, p.x, p.y); } if (p.y > H + 20) p.dead = true; } powerups = powerups.filter(p => !p.dead);
    // quips
    quipT -= dt; if (quipT <= 0 && !bubble) { quipT = rnd(7, 12); say(pickQuip()); }
    for (const p of particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } particles = particles.filter(p => p.t < p.life);
    for (const f of floats) { f.t += dt; f.y -= 28 * dt; } floats = floats.filter(f => f.t < f.life);
  }

  /* ------------------------------------------------------------------- jefes */
  function updateBoss(dt) {
    if (!boss) return; boss.t += dt; boss.flash = Math.max(0, boss.flash - dt);
    if (boss.y < boss.ty) { boss.y = Math.min(boss.ty, boss.y + 120 * dt); return; }
    const k = freezeT > 0 ? .25 : 1, sp = (boss.pat === "interrumpe" ? 150 : boss.pat === "mesa" ? 110 : 70) * k;
    boss.x += boss.dir * sp * dt; if (boss.x < 110) { boss.x = 110; boss.dir = 1; } else if (boss.x > W - 110) { boss.x = W - 110; boss.dir = -1; }
    if (freezeT > 0) return; patT -= dt; const pat = boss.pat === "mesa" ? (Math.floor(boss.t / 6) % 2 ? "interrumpe" : "martillo") : boss.pat, f = 1 + loop * .15, n = lvl();
    if (patT <= 0) {
      if (pat === "martillo") { patT = 2.3 / f; const xs = [pl.x, rnd(60, W - 60), rnd(60, W - 60)]; const warn = Math.max(.6, 1 - .06 * (stage - 1) - .08 * loop); xs.forEach(x => hammers.push({ x, t: 0, warn, dur: .38 })); if (Math.random() < .6) ebul.push({ x: boss.x, y: boss.y + 40, vx: clamp((pl.x - boss.x) * .3, -90, 90), vy: 220, kind: "orden", w: 14, h: 14 }); }
      else if (pat === "interrumpe") { patT = 1.15 / f; sfx.enemyShot(); [-1, 0, 1].forEach(d => ebul.push({ x: boss.x, y: boss.y + 44, vx: d * 80 + clamp((pl.x - boss.x) * .25, -70, 70), vy: 240 + n * 2, kind: "orden", w: 14, h: 14 })); }
      else if (pat === "bots") { patT = 3 / f; const x0 = rnd(80, W - 200); for (let i = 0; i < 6; i++) bots.push({ x: x0 + i * 22, y: -20 - i * 26, t0: i * .4, alive: true, vy: 105 }); ebul.push({ x: boss.x, y: boss.y + 44, vx: clamp((pl.x - boss.x) * .3, -80, 80), vy: 230, kind: "bulo", w: 12, h: 14 }); sfx.enemyShot(); }
      else if (pat === "encuesta") { patT = 2.3 / f; const gap = rnd(90, W - 90); for (let c = 0; c < 9; c++) { const x = 44 + c * 88; if (Math.abs(x - gap) < 80) continue; ebul.push({ x, y: boss.y + 50, vx: 0, vy: 150, kind: "barra", w: 36, h: 28 + (c % 3) * 14 }); } if (Math.random() < .7) ebul.push({ x: boss.x, y: boss.y + 44, vx: clamp((pl.x - boss.x) * .3, -80, 80), vy: 230, kind: "excusa", w: 12, h: 14 }); sfx.gavel(); }
    }
    for (const b of bots) { b.t0 += dt; b.y += b.vy * dt * (freezeT > 0 ? .25 : 1); b.x += Math.sin(b.t0 * 3) * 70 * dt; if (b.y > H + 20) b.alive = false; if (b.alive && hit(b.x, b.y, 20, 20, pl.x, PY - 26, 24, 46)) { b.alive = false; playerHit("bulo"); } }
    for (const h of hammers) { h.t += dt; if (h.t > h.warn && h.t - dt <= h.warn) sfx.gavel(); if (h.t > h.warn && h.t < h.warn + h.dur && hit(h.x, 340, 40, 460, pl.x, PY - 26, 24, 46)) playerHit("boss"); } hammers = hammers.filter(h => h.t < h.warn + h.dur);
    if (hit(boss.x, boss.y, 90, 90, pl.x, PY - 26, 24, 46)) playerHit("boss");
  }

  /* ----------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const gr = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function outlinedText(txt, x, y, color, font, align = "center") { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814"; [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y); }
  /* Persona genérica (portavoces y jefes): origen en el centro del busto. */
  function drawPerson(g, o) {
    const B = (c, x, y, w, h) => gr(g, c, x, y, w, h), skin = o.skin || "#efc3a0", fr = o.frame;
    B("#050814", -13, -17, 26, 32); B(o.suit, -11, -1, 22, 14); B("#f7f0d5", -3, -1, 6, 8); B(o.tie, -1, -1, 2, 10);
    if (fr) { B(o.suit, -15, -10, 4, 12); B(o.suit, 11, -10, 4, 12); B(skin, -15, -13, 4, 4); B(skin, 11, -13, 4, 4); if (o.prop !== "gavel") B("#f7f0d5", 10, -21, 8, 8); } else { B(o.suit, -14, 0, 4, 12); B(o.suit, 10, 0, 4, 12); B(skin, -14, 11, 4, 3); B(skin, 10, 11, 4, 3); }
    B(skin, -7, -15, 14, 14); B(o.hair, -8, -17, 16, 5); B(o.hair, -8, -13, 3, 5); B(o.hair, 5, -13, 3, 5);
    B("#101629", -4, -10, 2, 2); B("#101629", 2, -10, 2, 2); if (o.glasses) { B("#2a3047", -5, -11, 4, 1); B("#2a3047", 1, -11, 4, 1); }
    if (fr) { B("#7a3f3a", -3, -5, 6, 4); B("#f7f0d5", -2, -5, 4, 1); } else B("#a35a4a", -3, -4, 6, 1);
    if (o.sash) { B("#ffd34e", -11, 0, 22, 3); B("#c8323f", -11, 3, 22, 1); }
    if (o.prop === "gavel") { B("#6b4423", 12, -22, 3, 14); B("#8a5a3b", 8, -26, 11, 6); }
    else if (o.prop === "mic") { B("#050814", -3, -3, 6, 2); B("#aab4d5", -9, -8, 2, 8); B("#050814", -10, -11, 4, 4); }
    else if (o.prop === "phone") { B("#050814", 11, -10, 8, 12); B("#31d7c7", 12, -9, 6, 9); }
    else if (o.prop === "chart") { B("#f7f0d5", 10, -18, 12, 14); B("#c8323f", 12, -8, 2, 3); B("#2b6cff", 15, -11, 2, 6); B("#ffd34e", 18, -9, 2, 4); }
  }
  /* El Tribuno tras su atril: pelo oscuro peinado hacia atrás, barba corta, traje, móvil en mano. */
  function drawTribuno(g, firing, t) {
    const B = (c, x, y, w, h) => gr(g, c, x, y, w, h), br = Math.round(Math.sin(t * 3) * .6);
    B("rgba(0,0,0,.3)", -20, -2, 40, 4);
    B("#050814", -14, -52 + br, 28, 40); B("#050814", -19, -26, 38, 28);
    B("#2a2f3e", -12, -34 + br, 24, 14); B("#f7f0d5", -3, -34 + br, 6, 8); B("#c8323f", -1, -34 + br, 2, 9);
    B("#efc3a0", -8, -50 + br, 16, 14); B("#1a1410", -9, -53 + br, 18, 7); B("#1a1410", -9, -49 + br, 3, 6); B("#2a2420", -4, -53 + br, 9, 2);
    B("#2a1c14", -8, -41 + br, 16, 6); B("#2a1c14", -6, -37 + br, 12, 2); B("#f7f0d5", -5, -46 + br, 4, 3); B("#f7f0d5", 1, -46 + br, 4, 3); B("#101629", -4, -46 + br, 2, 3); B("#101629", 2, -46 + br, 2, 3); B("#1a1410", -6, -49 + br, 5, 1); B("#1a1410", 1, -49 + br, 5, 1);
    if (firing) { B("#efc3a0", 12, -42 + br, 5, 4); B("#2a2f3e", 10, -36 + br, 6, 12); B("#050814", 14, -52 + br, 7, 12); B("#31d7c7", 15, -51 + br, 5, 9); B("#f7f0d5", 16, -50 + br, 3, 1); } else { B("#2a2f3e", -15, -33 + br, 5, 10); B("#2a2f3e", 10, -33 + br, 5, 10); }
    B("#6b4423", -18, -24, 36, 24); B("#8a5a3b", -18, -24, 36, 4); B("#4a2f1a", -18, -4, 36, 4); B("#ffd34e", -7, -15, 14, 5); B("#050814", -5, -14, 10, 3);
    B("#050814", -3, -32 + 8, 2, 8); B("#aab4d5", -2, -31 + 8, 1, 7); B("#050814", -6, -36 + 8, 8, 4); B("#d9465b", -5, -35 + 8, 6, 2);
  }
  function drawZasca(x, y, vx) { const a = Math.atan2(-1, vx / 580); ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(Math.sin(t * 20 + x) * .05 + (vx / 580) * .6); R("#050814", -8, -7, 16, 12); R("#f7f0d5", -7, -6, 14, 10); R("#2b6cff", -5, -4, 10, 2); R("#2b6cff", -5, 0, 7, 2); R("#050814", -2, 4, 5, 4); R("#f7f0d5", -1, 4, 3, 3); ctx.restore(); void a; }
  function drawEBullet(b) {
    const x = Math.round(b.x), y = Math.round(b.y);
    if (b.kind === "excusa") { R("#050814", x - 7, y - 9, 14, 18); R("#f2e8a0", x - 6, y - 8, 12, 16); R("#8d8870", x - 4, y - 5, 8, 1); R("#8d8870", x - 4, y - 2, 8, 1); R("#8d8870", x - 4, y + 1, 5, 1); R("#c8323f", x - 6, y - 8, 12, 2); }
    else if (b.kind === "bulo") { R("#050814", x - 8, y - 8, 16, 14); R("#3cff7a", x - 7, y - 7, 14, 12); R("#050814", x - 1, y - 5, 2, 5); R("#050814", x - 1, y + 2, 2, 2); R("#3cff7a", x - 2, y + 6, 4, 3); }
    else if (b.kind === "orden") { R("#050814", x - 8, y - 8, 16, 16); R("#ffd34e", x - 7, y - 7, 14, 14); R("#6b4423", x - 1, y - 5, 2, 10); R("#6b4423", x - 5, y - 6, 10, 4); }
    else if (b.kind === "rebote") { R("#050814", x - 10, y - 9, 20, 16); R("#ff4d61", x - 9, y - 8, 18, 14); R("#f7f0d5", x - 6, y - 5, 12, 2); R("#f7f0d5", x - 6, y - 1, 8, 2); R("#ff4d61", x - 2, y + 6, 5, 4); }
    else { R("#050814", x - b.w / 2 - 2, y - b.h / 2 - 2, b.w + 4, b.h + 4); R("#31d7c7", x - b.w / 2, y - b.h / 2, b.w, b.h); R("rgba(255,255,255,.3)", x - b.w / 2, y - b.h / 2, b.w, 3); R("#17213c", x - b.w / 2 + 4, y + b.h / 2 - 8, b.w - 8, 3); }
  }
  function drawUfo(u) {
    const x = Math.round(u.x), y = Math.round(u.y);
    R("#050814", x - 21, y - 14, 42, 28); R("#3a2a3e", x - 19, y - 12, 38, 24); R("#0b1d36", x - 15, y - 9, 30, 17); R("#8fc8ff", x - 14, y - 8, 28, 15);
    R("#efc3a0", x - 4, y - 7, 9, 10); R("#2a1c14", x - 5, y - 8, 11, 3); R(Math.floor(u.face) % 2 ? "#7a3f3a" : "#a35a4a", x - 2, y - 1, 5, Math.floor(u.face) % 2 ? 3 : 1); R("#101629", x - 3, y - 4, 2, 2); R("#101629", x + 2, y - 4, 2, 2);
    R("#aab4d5", x - 8, y - 20, 1, 7); R("#aab4d5", x + 8, y - 20, 1, 7); R("#aab4d5", x - 9, y - 21, 3, 1); R("#aab4d5", x + 7, y - 21, 3, 1); R("#050814", x - 14, y + 14, 6, 3); R("#050814", x + 8, y + 14, 6, 3);
    if (Math.floor(t * 3) % 2) R("#ff4d61", x + 13, y - 12, 4, 4);
  }
  function drawPower(p) {
    const X = Math.round(p.x), Y = Math.round(p.y + Math.sin(t * 6 + p.x) * 2); ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.arc(X, Y, 23, 0, 7); ctx.fill();
    const bg = { hilo: "#2b9cf0", interrup: "#ffd34e", mesa: "#c792ea", escano: "#3cff7a" }[p.type];
    ctx.save(); ctx.translate(X, Y); ctx.scale(1.45, 1.45); const x = 0, y = 0;
    R("#050814", x - 13, y - 13, 26, 26); R(bg, x - 11, y - 11, 22, 22); R("rgba(255,255,255,.35)", x - 11, y - 11, 22, 3);
    if (p.type === "hilo") {            // pajarito negro de tuit sobre fondo azul
      const K = "#0b0b0b"; R(K, x - 10, y - 7, 3, 2); R(K, x - 9, y - 5, 3, 2); R(K, x - 7, y - 3, 11, 6); R(K, x - 5, y + 3, 8, 3); R(K, x - 2, y + 6, 4, 1);
      R(K, x + 2, y - 8, 6, 6); R(K, x + 4, y - 10, 2, 2); R(K, x + 8, y - 6, 3, 2);
      R("#2b9cf0", x - 5, y - 1, 7, 1); R("#2b9cf0", x - 3, y + 1, 6, 1); R("#ffffff", x + 5, y - 6, 1, 2);
    }
    else if (p.type === "interrup") { R("#050814", x - 1, y - 7, 2, 8); R("#050814", x - 1, y, 6, 2); R("#050814", x - 7, y - 8, 14, 1); R("#050814", x - 7, y + 7, 14, 1); R("#050814", x - 8, y - 7, 1, 14); R("#050814", x + 7, y - 7, 1, 14); }
    else if (p.type === "mesa") {       // apretón de manos: pacto
      R("#26304a", x - 11, y - 3, 6, 8); R("#7a1f31", x + 5, y - 3, 6, 8); R("#f7f0d5", x - 6, y - 3, 1, 8); R("#f7f0d5", x + 5, y - 3, 1, 8);
      R("#efc3a0", x - 5, y - 4, 10, 9); R("#efc3a0", x - 2, y - 7, 6, 3); R("#c0865f", x - 3, y - 1, 1, 4); R("#c0865f", x - 1, y - 1, 1, 4); R("#c0865f", x + 1, y - 1, 1, 4); R("#050814", x - 5, y + 5, 10, 1);
      R("#ffffff", x + 7, y - 10, 1, 4); R("#ffffff", x + 6, y - 9, 3, 1);
    }
    else { R("#050814", x - 7, y - 6, 5, 5); R("#050814", x + 2, y - 6, 5, 5); R("#050814", x - 6, y - 2, 12, 4); R("#050814", x - 4, y + 2, 8, 3); R("#050814", x - 2, y + 5, 4, 2); }
    ctx.restore();
    outlinedText({ hilo: "TUIT VIRAL", interrup: "BULO TIME", mesa: "PACTO", escano: "+1 VIDA" }[p.type], X, Y + 36, "#f7f0d5", `16px ${FONT_T}`);
  }
  function buildBg(ti) {
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"), B = (col, x, y, w, h) => gr(g, col, x, y, w, h);
    const pal = [["#17163a", "#2c2a5e"], ["#3a1740", "#12214a"], ["#0c1a2a", "#162b44"], ["#1a1630", "#3a1f3e"], ["#2a1020", "#10162e"]][ti % 5], gd = g.createLinearGradient(0, 0, 0, H); gd.addColorStop(0, pal[0]); gd.addColorStop(1, pal[1]); g.fillStyle = gd; g.fillRect(0, 0, W, H);
    if (ti % 5 === 0 || ti % 5 === 4) {      // hemiciclo: gradas en arco y presidencia
      for (let r = 0; r < 7; r++) for (let a = 0; a < 40; a++) { const ang = Math.PI * (.08 + .84 * a / 39), rad = 250 + r * 34, x = W / 2 - Math.cos(ang) * rad * 1.5, y = 470 - Math.sin(ang) * rad * .62; B(ti % 5 === 4 ? "rgba(122,31,49,.5)" : "rgba(60,58,110,.55)", x - 5, y - 3, 10, 6); B("rgba(5,8,20,.45)", x - 5, y + 3, 10, 2); }
      B("#3a2418", W / 2 - 90, 4, 180, 40); B("#6b4423", W / 2 - 90, 4, 180, 6); B("#ffd34e", W / 2 - 14, 18, 28, 8); B("#c8323f", 30, 0, 40, 120); B("#ffd34e", 30, 40, 40, 36); B("#c8323f", 30, 76, 40, 44); B("#c8323f", 730, 0, 40, 120); B("#ffd34e", 730, 40, 40, 36); B("#c8323f", 730, 76, 40, 44);
    } else if (ti % 5 === 1) {               // plató de televisión
      for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(255,${180 + i * 8},255,${.05 + i * .01})`; g.beginPath(); g.arc(W / 2, -60, 140 + i * 36, 0, 7); g.fill(); }
      B("#050814", 40, 330, 120, 150); B("#2a2f3e", 52, 342, 96, 90); B("#ff4d61", 100, 350, 6, 6); B("#050814", 640, 330, 120, 150); B("#2a2f3e", 652, 342, 96, 90); B("#ff4d61", 700, 350, 6, 6);
      B("#3a1a40", 120, 420, 560, 80); B("#5a2a5e", 120, 420, 560, 12); B("#ff4d61", 380, 24, 40, 14);
    } else if (ti % 5 === 2) {               // línea de tiempo
      for (let i = 0; i < 4; i++) B("rgba(255,255,255,.05)", 60 + i * 200, 0, 2, H);
      for (let i = 0; i < 9; i++) { const x = 70 + (i % 4) * 200, y = 30 + Math.floor(i / 4) * 170 + (i % 3) * 20; B("rgba(30,60,90,.55)", x, y, 170, 74); B("rgba(80,120,170,.45)", x + 8, y + 8, 22, 22); B("rgba(160,190,220,.35)", x + 38, y + 12, 100, 5); B("rgba(160,190,220,.25)", x + 38, y + 24, 80, 5); B("rgba(160,190,220,.25)", x + 8, y + 42, 150, 5); B("rgba(255,77,97,.4)", x + 12, y + 58, 8, 8); B("rgba(60,255,122,.35)", x + 70, y + 58, 8, 8); }
    } else {                                 // debate
      B("#050814", 80, 360, 180, 140); B("#3a2a4a", 90, 370, 160, 120); B("#050814", 540, 360, 180, 140); B("#3a2a4a", 550, 370, 160, 120);
      g.fillStyle = "rgba(255,230,160,.08)"; g.beginPath(); g.moveTo(170, 0); g.lineTo(100, 380); g.lineTo(240, 380); g.fill(); g.beginPath(); g.moveTo(630, 0); g.lineTo(560, 380); g.lineTo(700, 380); g.fill();
      B("#050814", 340, 10, 120, 44); B("#0b1d36", 346, 16, 108, 32);
    }
    B("rgba(0,0,0,.35)", 0, 500, W, 100); B("#6b4423", 0, 560, W, 40); B("#8a5a3b", 0, 560, W, 4);
    return c;
  }
  function drawBoss(b) {
    const x = Math.round(b.x), y = Math.round(b.y); ctx.save(); ctx.translate(x, y); ctx.scale(2.6, 2.6);
    drawPerson(ctx, { suit: b.suit, tie: b.tie, hair: b.hair, frame: Math.floor(t * 3) % 2, prop: b.prop, sash: true, glasses: b.prop === "chart" || b.prop === "phone" });
    ctx.restore(); if (b.flash > 0) { ctx.globalAlpha = .5; R("#ffffff", x - 40, y - 44, 80, 84); ctx.globalAlpha = 1; }
  }
  function drawHud() {
    // turno de palabra
    R("rgba(5,8,20,.85)", 0, H - 26, W, 26); outlinedText("TURNO DE PALABRA", 10, H - 8, pl.lock > 0 ? "#ff4d61" : "#f7f0d5", `17px ${FONT_T}`, "left");
    R("#050814", 150, H - 21, 202, 14); R("#17213c", 152, H - 19, 198, 10); const mc = pl.lock > 0 ? "#ff4d61" : pl.mic < 25 ? "#ffb347" : "#31d7c7"; R(mc, 152, H - 19, 198 * clamp(pl.mic / 100, 0, 1), 10); for (let k = 1; k < 5; k++) R("#050814", 152 + k * 39.6, H - 19, 1, 10);
    outlinedText("AUTOGOL", 366, H - 8, missStreak >= 5 ? "#ff4d61" : "#aab4d5", `15px ${FONT_T}`, "left");
    for (let k = 0; k < 8; k++) { const on = k < missStreak, blink = missStreak >= 6 && Math.floor(t * 8) % 2; R("#050814", 428 + k * 12, H - 21, 10, 14); R(on ? (blink ? "#ffffff" : missStreak >= 6 ? "#ff4d61" : "#ffb347") : "#17213c", 429 + k * 12, H - 20, 8, 12); }
    if (combo >= 2) outlinedText(`RACHA x${multNow()} · ${combo}`, 540, H - 8, "#ffd34e", `16px ${FONT_T}`, "left");
    let px = W - 10; if (tripleT > 0) { outlinedText(`TUIT VIRAL ${tripleT.toFixed(0)}`, px, H - 8, "#5bb8ff", `17px ${FONT_T}`, "right"); px -= 128; } if (freezeT > 0) outlinedText(`BULO TIME ${freezeT.toFixed(0)}`, px, H - 8, "#ffd34e", `17px ${FONT_T}`, "right");
    if (boss) { const bw = 360, k = clamp(boss.hp / boss.max, 0, 1); R("#050814", W / 2 - bw / 2 - 3, 8, bw + 6, 16); R("#17213c", W / 2 - bw / 2, 11, bw, 10); R(k < .3 ? "#ff4d61" : "#ffd34e", W / 2 - bw / 2, 11, bw * k, 10); outlinedText(boss.name, W / 2, 42, "#f7f0d5", `16px ${FONT_T}`); }
  }
  function render() {
    if (state !== "playing") placeEnemies();
    ctx.save(); if (shakeT > 0) ctx.translate(Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM)));
    const si = (stage - 1) % 5; ctx.drawImage(bgs[si] || (bgs[si] = buildBg(si)), 0, 0);
    if (si === 3 || si === 1) { ctx.fillStyle = `rgba(255,240,200,${.05 + .03 * Math.sin(t * 2)})`; ctx.beginPath(); ctx.moveTo(W / 2 - 220 + Math.sin(t) * 120, 0); ctx.lineTo(W / 2 - 80 + Math.sin(t) * 120, H); ctx.lineTo(W / 2 + 60 + Math.sin(t) * 120, H); ctx.lineTo(W / 2 - 180 + Math.sin(t) * 120, 0); ctx.fill(); }
    for (const sh of shields) for (let r = 0; r < SH; r++) for (let c = 0; c < SW; c++) if (sh.cells[r * SW + c]) { R(r < 2 ? "#a8703a" : (r + c) % 3 === 0 ? "#7a4a22" : "#8a5a3b", sh.x + c * CELL, sh.y + r * CELL, CELL, CELL); }
    for (const e of enemies) if (e.alive) { const b = BENCH[e.b]; ctx.save(); ctx.translate(Math.round(e.x), Math.round(e.y + Math.sin(t * 4 + e.c) * 1)); if (e.flash > 0) ctx.globalAlpha = .6; drawPerson(ctx, { suit: b.suit, tie: b.tie, hair: b.hair, frame: form ? form.anim : 0, sash: e.hp > 1 }); ctx.restore(); }
    if (boss) drawBoss(boss);
    for (const h of hammers) { const k = h.t < h.warn; if (k) { ctx.fillStyle = `rgba(255,77,97,${.15 + .15 * Math.sin(h.t * 30)})`; ctx.fillRect(h.x - 20, 60, 40, 440); outlinedText("!", h.x, 90, "#ff4d61", `22px ${FONT_PX}`); } else { R("#f7f0d5", h.x - 22, 60, 44, 440); R("#ffd34e", h.x - 12, 60, 24, 440); } }
    for (const b of bots) { R("#050814", b.x - 11, b.y - 11, 22, 22); R("#3cff7a", b.x - 9, b.y - 9, 18, 18); R("#050814", b.x - 5, b.y - 4, 3, 3); R("#050814", b.x + 2, b.y - 4, 3, 3); R("#050814", b.x - 5, b.y + 3, 10, 2); }
    if (ufo) drawUfo(ufo); for (const p of powerups) drawPower(p);
    for (const s of shots) drawZasca(s.x, s.y, s.vx); for (const b of ebul) drawEBullet(b);
    if (pl && state !== "title") { ctx.save(); ctx.translate(Math.round(pl.x), PY); ctx.scale(1.3, 1.3); if (pl.inv > 0 && Math.floor(t * 14) % 2) ctx.globalAlpha = .4; drawTribuno(ctx, pl.pose > 0, t); if (pl.lock > 0) { R("#ff4d61", -12, -62, 24, 4); R("#f7f0d5", -8, -60, 16, 1); } ctx.restore(); }
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); R(p.color, p.x, p.y, p.s, p.s); } ctx.globalAlpha = 1;
    for (const f of floats) { ctx.globalAlpha = clamp(1.7 - f.t / f.life * 1.7 + .2, 0, 1); if (f.heart) { const hx = Math.round(f.x) - 22, hy = Math.round(f.y) - 26; R("#050814", hx - 1, hy - 1, 15, 13); R("#3cff7a", hx, hy, 5, 4); R("#3cff7a", hx + 8, hy, 5, 4); R("#3cff7a", hx, hy + 3, 13, 4); R("#3cff7a", hx + 2, hy + 7, 9, 2); R("#3cff7a", hx + 5, hy + 9, 3, 2); } outlinedText(f.text, f.x, f.y, f.color, `${f.size || 22}px ${FONT_T}`); } ctx.globalAlpha = 1;
    if (bubble && pl) { ctx.font = `22px ${FONT_T}`; const w = Math.ceil(ctx.measureText(bubble.text).width) + 20, h = 28, bx = clamp(Math.round(pl.x - w / 2), 8, W - w - 8), by = PY - 132; ctx.globalAlpha = clamp(Math.min(bubble.t / .12, (bubble.life - bubble.t) / .25, 1), 0, 1); R("#050814", bx - 3, by - 3, w + 6, h + 6); R("#f7f0d5", bx, by, w, h); ctx.fillStyle = "#050814"; ctx.beginPath(); ctx.moveTo(pl.x - 6, by + h + 3); ctx.lineTo(pl.x + 6, by + h + 3); ctx.lineTo(pl.x, by + h + 12); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#f7f0d5"; ctx.beginPath(); ctx.moveTo(pl.x - 4, by + h); ctx.lineTo(pl.x + 4, by + h); ctx.lineTo(pl.x, by + h + 7); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#101629"; ctx.textAlign = "left"; ctx.fillText(bubble.text, bx + 10, by + 21); ctx.globalAlpha = 1; }
    if (state !== "title") drawHud();
    if (banner) { ctx.globalAlpha = clamp(Math.min(banner.t / .2, (banner.life - banner.t) / .5, 1), 0, 1); outlinedText(banner.text, W / 2, 270, "#ffd34e", `${banner.text.length > 14 ? 18 : 26}px ${FONT_PX}`); outlinedText(banner.sub, W / 2, 306, "#f7f0d5", `24px ${FONT_T}`); ctx.globalAlpha = 1; }
    ctx.restore(); if (flashT > 0) { ctx.globalAlpha = clamp(flashT * 2.4, 0, .45); ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
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
    if (state === "playing") { acc += dt; let k = 0; while (acc >= FIXED && k++ < 12) { update(FIXED); acc -= FIXED; } if (k >= 12) acc = 0; } else t += dt;
    render(); requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------------------- entrada */
  const KEYMAP = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "fire", ArrowUp: "fire", KeyW: "fire" };
  addEventListener("keydown", e => {
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "playing") pauseScreen(); else if (state === "paused") resume(); return; }
    if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) { if (state === "playing" || state === "paused") play(); return; }
    const a = KEYMAP[e.code]; if (a && state === "playing") { e.preventDefault(); keys[a] = true; }
  });
  addEventListener("keyup", e => { const a = KEYMAP[e.code]; if (a) keys[a] = false; });
  // táctil: arrastrar para mover y mantener para disparar
  let drag = null;
  canvas.addEventListener("pointerdown", e => { if (state !== "playing") return; e.preventDefault(); const r = canvas.getBoundingClientRect(); drag = { id: e.pointerId }; pl.x = clamp((e.clientX - r.left) * W / r.width, 28, W - 28); keys.fire = true; safe(() => canvas.setPointerCapture(e.pointerId)); });
  canvas.addEventListener("pointermove", e => { if (!drag || state !== "playing") return; const r = canvas.getBoundingClientRect(); pl.x = clamp((e.clientX - r.left) * W / r.width, 28, W - 28); });
  const endDrag = () => { drag = null; keys.fire = false; };
  canvas.addEventListener("pointerup", endDrag); canvas.addEventListener("pointercancel", endDrag);
  document.querySelectorAll(".dpad button").forEach(b => { const a = b.dataset.act; b.addEventListener("pointerdown", e => { e.preventDefault(); keys[a] = true; b.classList.add("on"); }); const off = () => { keys[a] = false; b.classList.remove("on"); }; b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off); });
  addEventListener("blur", () => { if (state === "playing") pauseScreen(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseScreen(); });
  UI.pause.addEventListener("click", () => state === "paused" ? resume() : pauseScreen());
  UI.restart.addEventListener("click", () => { if (state !== "title") play(); });
  UI.sound.addEventListener("click", () => { soundOn = !soundOn; store.set("zi-sound", soundOn ? "1" : "0"); AUD.setOn(soundOn); paintSound(); if (soundOn) { sfx.power(); if (state === "playing") music.start(0); } });

  /* ------------------------------------------------------------------ inicio */
  AUD.setOn(soundOn); paintSound(); reset(); titleScreen(); fixAccents(document.querySelector(".cabinet header")); fixAccents(document.querySelector(".hud"));
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('22px "VT323"')]).then(() => { bgs = []; }).catch(() => {});
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, stage, wave: waveN, loop, score, lives: pl && pl.lives, mic: pl && Math.round(pl.mic), lock: pl && +pl.lock.toFixed(1), alive: enemies.filter(e => e.alive).length, boss: boss && boss.hp, ebul: ebul.length, combo, miss: missStreak, shots: stats.shots, hits: stats.hits, waves: stats.waves, intro: +introT.toFixed(1), tr: tripleT > 0, ufo: !!ufo });
    window.__zi = {
      step: (k = 1, dt = FIXED, draw = true) => { for (let i = 0; i < k; i++) update(dt); if (draw) render(); return snap(); }, snap, play, render, title: titleScreen, over: why => gameOver(why || "bulo"),
      setStage: (s, w) => { stage = s; waveN = w; startWave(); updateHud(); }, give: type => applyPower(type, pl.x, 300), setScore: n => { score = n; updateHud(); }, spawnPower: (type, x, y, vy = 0) => { powerups.push({ x, y, type, vy }); }, key: (k, v) => { keys[k] = v; }, setMic: n => { pl.mic = n; }, kill: () => { enemies.forEach(e => { e.alive = false; }); if (boss) { boss.hp = 0; bossDown(); } }, ebul: () => ebul.length,
      /* piloto de pruebas: apunta con adelanto, solo dispara alineado y esquiva buscando un hueco libre */
      bot: () => {
        const al = enemies.filter(e => e.alive), vF = form ? form.dir * Math.min(110, 26 + lvl() * 5) * (1 + (1 - al.length / form.total) * 2.4) : 0; let tx = pl.x;
        const flight = e => (PY - 54 - e.y) / 580;
        if (boss) tx = boss.x; else if (al.length) { const cand = al.map(e => ({ e, x: e.x + vF * flight(e) })); tx = cand.reduce((a, b) => Math.abs(a.x - pl.x) < Math.abs(b.x - pl.x) ? a : b).x; }
        const safeAt = cx => ebul.every(b => { if (b.vy <= 0) return true; const tt = (PY - 26 - b.y) / b.vy; if (tt < -.1 || tt > 1.4) return true; return Math.abs(b.x + b.vx * tt - cx) > 26 || Math.abs(cx - pl.x) / 330 > tt + .05; }) && hammers.every(h => !(h.t > h.warn - .5 && h.t < h.warn + h.dur) || Math.abs(h.x - cx) > 34) && bots.every(b => Math.abs(b.x - cx) > 30 || b.y < 300);
        let dodge = false; if (!safeAt(pl.x)) { const opts = []; for (let d = -240; d <= 240; d += 20) { const cx = clamp(pl.x + d, 30, W - 30); if (safeAt(cx)) opts.push(cx); } if (opts.length) { tx = opts.reduce((a, b) => Math.abs(a - pl.x) < Math.abs(b - pl.x) ? a : b); dodge = true; } }
        keys.left = tx < pl.x - 5; keys.right = tx > pl.x + 5;
        const aligned = boss ? Math.abs(boss.x - pl.x) < 40 : al.some(e => Math.abs(e.x + vF * flight(e) - pl.x) < 11) || (ufo && Math.abs(ufo.x + ufo.vx * .8 - pl.x) < 16);
        keys.fire = !dodge && aligned;
      }
    };
  }
})();
