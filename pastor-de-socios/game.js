"use strict";
/* Pastor de socios — Sanxe Games.
   Un perro pastor, un rebaño de socios con carácter y un corral de 176 votos. */
(() => {
  const SPR = window.PS_SPR, AUD = window.PS_AUD, { sfx, music } = AUD;
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
  const W = 960, H = 600, FIXED = 1 / 60;
  const FIELD = { x: 24, y: 84, x2: 936, y2: 576 };
  const PEN = { x: 776, y: 236, w: 160, h: 184 }, GATE = { y1: 292, y2: 364 }, WALL = 8;
  const WALLS = [
    { x: PEN.x - 4, y: PEN.y - 4, w: PEN.w + 4, h: WALL },
    { x: PEN.x - 4, y: PEN.y + PEN.h - 4, w: PEN.w + 4, h: WALL },
    { x: PEN.x - 4, y: PEN.y - 4, w: WALL, h: GATE.y1 - PEN.y + 4 },
    { x: PEN.x - 4, y: GATE.y2, w: WALL, h: PEN.y + PEN.h + 4 - GATE.y2 }
  ];
  const PEN_IN = { x: PEN.x + 10, y: PEN.y + 12, w: PEN.w - 20, h: PEN.h - 24 };
  const EXITS = { L: { cx: FIELD.x, cy: 300, half: 54 }, B: { cx: 250, cy: FIELD.y2, half: 54 }, T: { cx: 250, cy: FIELD.y, half: 54 } };
  const GOAL = 176, DOG_SPEED = 235, DOG_R = 15, BARK_R = 200, BARK_CD = 1.2, WHISTLE_CD = 4, WHISTLE_R = 300, STRESS_R = 66;
  const SC = 2;

  /* ------------------------------------------------------------ catálogo */
  const SHEEP_COLORS = ["#ff4d61", "#ffd34e", "#31d7c7", "#8fa8ff", "#3cff7a", "#ff9ad5", "#f08a3c", "#c28bff", "#7ee0ff", "#e8e8a0", "#ff7e5e", "#a0ff5e"];
  const NORMAL_VALUES = [7, 10, 6, 12, 8, 9, 11];
  const TY = {
    n: { r: 18, sc: 2, flee: 1, stress: 1, speed: 1, label: "", value: 0 },
    p: { r: 24, sc: 3, flee: .72, stress: .6, speed: .72, label: "PESADO", value: 16 },
    v: { r: 18, sc: 2, flee: 1, stress: 1.1, speed: 1, label: "VELETA", value: 9 },
    f: { r: 16, sc: 2, flee: 1.3, stress: 1.4, speed: 1.15, label: "FUGAZ", value: 8 },
    c: { r: 19, sc: 2, flee: 1, stress: 1, speed: 1, label: "CABECILLA", value: 13 }
  };
  const THEMES = {
    dusk: { skyTop: "#2a1a4a", skyBot: "#ff9a6b", grassA: "#2f6b3a", grassB: "#34753f", tint: "rgba(255,140,60,.10)", stars: false },
    night: { skyTop: "#0b1021", skyBot: "#3a4f8c", grassA: "#1f4a3a", grassB: "#235240", tint: "rgba(0,0,40,.10)", stars: true },
    dawn: { skyTop: "#4a5a9a", skyBot: "#ffd0a0", grassA: "#2d6a45", grassB: "#34794f", tint: "rgba(255,220,180,.07)", stars: false },
    storm: { skyTop: "#141a2a", skyBot: "#3a4660", grassA: "#1b3f33", grassB: "#1f473a", tint: "rgba(0,10,30,.22)", stars: false, rain: true }
  };
  const LEVELS = [
    { name: "INVESTIDURA", sub: "El Congreso vota hoy", theme: "dusk", time: 100, sheep: "nnnn", exits: ["L"], bales: [], mud: [], wolf: null, pickups: [], tip: "Colócate detrás de cada socio y empújalo hacia el corral. Si lo agobias, se agobia." },
    { name: "PRESUPUESTOS", sub: "Cada socio quiere su partida", theme: "night", time: 96, sheep: "nnpnn", exits: ["L", "B"], bales: [[450, 300]], mud: [], wolf: null, pickups: [], tip: "Un socio agobiado se vuelve díscolo y huye. Corre a su lado para negociar." },
    { name: "DECRETO LEY", sub: "Hay mucho fango en la política", theme: "dawn", time: 94, sheep: "nvnpnn", exits: ["L", "B"], bales: [[470, 190], [610, 470]], mud: [[380, 390, 66], [600, 270, 58]], wolf: null, pickups: ["time"], tip: "El fango frena a todos. Recoge Prórrogas del campo para ganar tiempo. SHIFT para correr." },
    { name: "VOTO DE CONFIANZA", sub: "Ojo con el Lobo Mediático", theme: "night", time: 92, sheep: "ncnfnpn", exits: ["L", "B", "T"], bales: [[470, 190], [600, 470]], mud: [[390, 380, 62]], wolf: { n: 1, first: 14, every: 30 }, pickups: ["time", "lure"], tip: "El Lobo Mediático asusta a los socios. ¡Ladra o acércate para espantarlo! (X silba y los reúne)" },
    { name: "LA CENSURA", sub: "Tormenta en el hemiciclo", theme: "storm", time: 98, sheep: "nfcnvpnn", exits: ["L", "B", "T"], bales: [[460, 190], [620, 470], [330, 470]], mud: [[390, 360, 62], [630, 240, 54]], wolf: { n: 1, first: 10, every: 24 }, pickups: ["time", "lure", "freeze"], tip: "La Comisión de Estudio congela a todos unos segundos: ¡aprovéchalo!" },
    { name: "PLENO EXTRAORDINARIO", sub: "Convocado de madrugada", theme: "dusk", time: 98, sheep: "nnfcvpnfn", exits: ["L", "B", "T"], bales: [[460, 180], [620, 470], [330, 470]], mud: [[380, 370, 64], [600, 250, 56], [250, 190, 50]], wolf: { n: 1, first: 8, every: 20 }, pickups: ["time", "lure", "freeze"], tip: "" },
    { name: "REFORMA CONSTITUCIONAL", sub: "Hacen falta mayorías reforzadas", theme: "storm", time: 98, sheep: "nfcvpnfnvn", exits: ["L", "B", "T"], bales: [[470, 180], [620, 470], [320, 470], [250, 200]], mud: [[380, 370, 64], [610, 250, 58], [200, 330, 48]], wolf: { n: 2, first: 8, every: 20 }, pickups: ["time", "lure", "freeze"], tip: "" },
    { name: "CUMBRE DE SOCIOS", sub: "Todos exigen algo", theme: "dawn", time: 98, sheep: "cnfvpnfcnvp", exits: ["L", "B", "T"], bales: [[470, 180], [620, 470], [320, 470], [250, 200]], mud: [[380, 370, 64], [610, 250, 58], [200, 330, 48]], wolf: { n: 2, first: 6, every: 18 }, pickups: ["time", "lure", "freeze"], tip: "" }
  ];
  const THEME_CYCLE = ["night", "storm", "dusk", "dawn"];
  const baseDef = n => {
    if (n <= LEVELS.length) return LEVELS[n - 1];
    const k = n - LEVELS.length, L = LEVELS[LEVELS.length - 1], pool = "ncfvpnfnvcpn";
    return { ...L, name: "LEGISLATURA SIN FIN", sub: `Ronda ${n}: el Gobierno resiste`, theme: THEME_CYCLE[n % THEME_CYCLE.length], time: Math.max(62, L.time - k * 2), sheep: pool.slice(0, Math.min(12, 10 + Math.floor(k / 2))), wolf: { n: Math.min(3, 2 + Math.floor(k / 4)), first: 6, every: Math.max(12, 18 - k) }, tip: "" };
  };
  function levelDef(n) {
    const b = baseDef(n);
    const list = [...b.sheep].map((code, i) => ({ code, value: TY[code].value || NORMAL_VALUES[(i * 5 + n) % NORMAL_VALUES.length], color: SHEEP_COLORS[i] }));
    const sum = list.reduce((a, s) => a + s.value, 0), ratio = Math.min(.76, .56 + .03 * n), need = Math.round(sum * ratio);
    return {
      n, name: b.name, sub: b.sub, tip: b.tip, themeKey: b.theme, theme: THEMES[b.theme], time: b.time, list, count: list.length, need, base: GOAL - need,
      exits: b.exits, bales: b.bales.map(([x, y]) => ({ x, y, w: 52, h: 30 })), mud: b.mud.map(([x, y, r]) => ({ x, y, r })), wolf: b.wolf, pickups: b.pickups,
      fleeR: 132, fleeSpeed: Math.min(235, 150 + (n - 1) * 8), stressRate: .5 + .05 * (n - 1),
      tantrum: Math.min(.014, .006 + .002 * (n - 1)) * (b.theme === "storm" ? 1.3 : 1)
    };
  }

  /* -------------------------------------------------------------- estado */
  const UI = {
    level: $("#level"), votes: $("#votes"), time: $("#time"), lost: $("#lost"), status: $("#game-status"),
    overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"),
    sound: $("#sound"), pause: $("#pause"), restart: $("#restart")
  };
  let state = "title", level = levelDef(1), bg = null, soundOn = store.get("ps-sound") !== "0";
  let dog, sheep = [], wolves = [], pickups = [], particles = [], floats = [], bubbles = [], rings = [], rain = [], clouds = [], tufts = [];
  const keys = new Set(), pointer = { down: false, x: 0, y: 0 }, touch = { sprint: false };
  let votesSecured = 0, lostCount = 0, timeLeft = 0, score = 0, elapsed = 0, acc = 0, last = 0, bannerT = 0, tipT = 0, idleT = 0;
  let combo = 0, comboT = 0, freezeT = 0, wolfT = 0, pickT = 0, shakeT = 0, shakeM = 0, flash = 0, thunderT = 0, alertT = 0, stats = {}, filled = [], pops = {};
  let prog = safe(() => JSON.parse(store.get("ps-progress")), null) || { unlocked: 1, stars: {}, best: 0 };
  const DEMANDS = ["¡Quiero una competencia!", "¡Esto no estaba en el pacto!", "¡Que me llamen!", "¡Más financiación!", "¡Lo dije en campaña!", "¡Ahora no, mañana sí!", "¡Un ministerio, ya!", "¡Necesito un titular!", "¡Que se vote mi enmienda!", "¡Exijo una foto!"];
  const DOG_LINES = {
    secured: ["¡Un socio más!", "Cuadrando…", "¡Sigamos así!", "Esto está hablado."],
    lost: ["¡Vuelve, que lo hablamos!", "Era un socio… ¿o no?", "Lo que no se ve, no se pierde."],
    idle: ["Estoy reflexionando…", "Resistiré.", "Dame cinco días."],
    wolf: ["¡Fuera, prensa!", "¡Sin comentarios!", "¡Rueda de prensa cancelada!"]
  };
  const saveProg = () => store.set("ps-progress", JSON.stringify(prog));

  /* ------------------------------------------------------ escaños (hemiciclo) */
  const SEATS = (() => {
    const rows = 8, r0 = 36, dr = 5.4, radii = Array.from({ length: rows }, (_, i) => r0 + i * dr), sum = radii.reduce((a, b) => a + b, 0), out = [];
    let left = GOAL;
    radii.forEach((r, i) => {
      const n = i === rows - 1 ? left : Math.round(GOAL * r / sum); left -= n;
      for (let j = 0; j < n; j++) { const a = Math.PI - Math.PI * (j + .5) / n; out.push({ x: 480 + Math.cos(a) * r, y: 80 - Math.sin(a) * r, a }); }
    });
    return out.sort((p, q) => q.a - p.a || p.x - q.x);
  })();
  const BASE_SEAT = "#e8dfc0";

  /* --------------------------------------------------------------- fondo */
  const mk = SPR.mk;
  function buildBg() {
    const [c, g] = mk(W, H), th = level.theme; const R = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const sky = g.createLinearGradient(0, 0, 0, FIELD.y); sky.addColorStop(0, th.skyTop); sky.addColorStop(1, th.skyBot); g.fillStyle = sky; g.fillRect(0, 0, W, FIELD.y);
    if (th.stars) for (let i = 0; i < 46; i++) R(i % 4 ? "#f7f0d5" : "#31d7c7", (i * 193) % W, (i * 47) % 40, 2, 2);
    for (let x = 0, i = 0; x < W; i++) { const bw = 20 + (i * 7) % 18, bh = 14 + (i * 13) % 26; R(th.stars ? "#0c1430" : "#2b2150", x, FIELD.y - bh, bw, bh); for (let wy = FIELD.y - bh + 4; wy < FIELD.y - 4; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 6) if ((wx * 7 + wy * 3) % 5 < 2) R("#ffd34e", wx, wy, 2, 2); x += bw + 2; }
    for (let y = FIELD.y, k = 0; y < H; y += 32, k++) R(k % 2 ? th.grassB : th.grassA, 0, y, W, 32);
    for (let i = 0; i < 160; i++) { const x = (i * 97 + 31) % (W - 40) + 20, y = FIELD.y + 14 + (i * 61 + 17) % (FIELD.y2 - FIELD.y - 28); R(i % 5 ? "#2e6a50" : "#e8e8a0", x, y, 2, i % 5 ? 3 : 2); R(i % 5 ? "#2e6a50" : "#e8e8a0", x + 3, y + 1, 2, 2); }
    R("#10231d", 0, FIELD.y2, W, H - FIELD.y2);
    level.mud.forEach(m => { g.fillStyle = "#3b2a1a"; g.beginPath(); g.ellipse(m.x, m.y, m.r, m.r * .6, 0, 0, 7); g.fill(); g.fillStyle = "#4f3822"; g.beginPath(); g.ellipse(m.x - 4, m.y - 3, m.r * .82, m.r * .48, 0, 0, 7); g.fill(); g.fillStyle = "#2a1c10"; g.beginPath(); g.ellipse(m.x + 6, m.y + 4, m.r * .5, m.r * .26, 0, 0, 7); g.fill(); });
    R("#6b5a2e", PEN.x, PEN.y, PEN.w, PEN.h); for (let i = 0; i < 90; i++) R(i % 3 ? "#8a7438" : "#4d4020", PEN.x + 6 + (i * 53) % (PEN.w - 18), PEN.y + 6 + (i * 29) % (PEN.h - 14), 6, 1);
    const post = (x, y) => { R("#4a2e1b", x - 3, y - 16, 7, 22); R("#8a5a3b", x - 3, y - 16, 5, 20); R("#c28a5a", x - 3, y - 16, 5, 2); };
    const railH = (x1, x2, y) => { R("#4a2e1b", x1, y - 12, x2 - x1, 5); R("#c28a5a", x1, y - 12, x2 - x1, 3); R("#4a2e1b", x1, y - 4, x2 - x1, 5); R("#c28a5a", x1, y - 4, x2 - x1, 3); };
    const railV = (x, y1, y2) => { R("#4a2e1b", x - 6, y1, 5, y2 - y1); R("#c28a5a", x - 6, y1, 3, y2 - y1); R("#4a2e1b", x + 2, y1, 5, y2 - y1); R("#c28a5a", x + 2, y1, 3, y2 - y1); };
    const gap = s => level.exits.includes(s) ? EXITS[s] : null;
    const fenceH = (y, s) => { const g1 = gap(s); (g1 ? [[FIELD.x - 6, g1.cx - g1.half], [g1.cx + g1.half, FIELD.x2 + 6]] : [[FIELD.x - 6, FIELD.x2 + 6]]).forEach(([a, b]) => railH(a, b, y)); for (let x = FIELD.x; x <= FIELD.x2; x += 48) if (!g1 || x < g1.cx - g1.half - 4 || x > g1.cx + g1.half + 4) post(x, y); if (g1) { post(g1.cx - g1.half, y); post(g1.cx + g1.half, y); } };
    fenceH(FIELD.y + 4, "T"); fenceH(FIELD.y2 + 6, "B");
    const gl = gap("L"), vs = gl ? [[FIELD.y - 14, gl.cy - gl.half], [gl.cy + gl.half, FIELD.y2 + 6]] : [[FIELD.y - 14, FIELD.y2 + 6]];
    vs.forEach(([a, b]) => railV(FIELD.x, a, b)); for (let y = FIELD.y; y <= FIELD.y2; y += 48) if (!gl || y < gl.cy - gl.half - 4 || y > gl.cy + gl.half + 4) post(FIELD.x, y + 10);
    if (gl) { post(FIELD.x, gl.cy - gl.half + 10); post(FIELD.x, gl.cy + gl.half + 10); }
    railV(FIELD.x2 + 2, FIELD.y - 14, FIELD.y2 + 6); for (let y = FIELD.y; y <= FIELD.y2; y += 48) post(FIELD.x2 + 2, y + 10);
    WALLS.forEach(w => { R("#4a2e1b", w.x - 2, w.y - 2, w.w + 4, w.h + 4); R("#8a5a3b", w.x, w.y, w.w, w.h); R("#c28a5a", w.x, w.y, w.w, 2); });
    g.font = '8px "Press Start 2P", monospace'; g.textAlign = "center";
    const sign = (txt, x, y, col = "#ffd34e") => { const w = Math.ceil(g.measureText(txt).width) + 14; R("#050814", x - w / 2 - 3, y - 14, w + 6, 24); R("#1b3a8a", x - w / 2, y - 11, w, 18); R("#6fa0ff", x - w / 2, y - 11, w, 2); g.fillStyle = col; g.fillText(txt, x, y + 3); };
    sign("176 VOTOS", PEN.x + PEN.w / 2, PEN.y - 26);
    level.exits.forEach(s => { const e = EXITS[s]; if (s === "L") sign("GRUPO MIXTO", FIELD.x + 70, e.cy - e.half - 22, "#ff4d61"); else sign("GRUPO MIXTO", e.cx, s === "T" ? FIELD.y + 26 : FIELD.y2 - 30, "#ff4d61"); });
    tufts = Array.from({ length: 70 }, (_, i) => ({ x: (i * 131 + 57) % (W - 80) + 40, y: FIELD.y + 24 + (i * 89 + 11) % (FIELD.y2 - FIELD.y - 48), p: i * .7 }));
    bg = c;
  }

  /* --------------------------------------------------------- colisiones */
  function pushOut(e, r, rc) {
    const cx = clamp(e.x, rc.x, rc.x + rc.w), cy = clamp(e.y, rc.y, rc.y + rc.h), dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    if (d2 === 0) { const l = e.x - rc.x, rr = rc.x + rc.w - e.x, t = e.y - rc.y, b = rc.y + rc.h - e.y, m = Math.min(l, rr, t, b); if (m === l) e.x = rc.x - r; else if (m === rr) e.x = rc.x + rc.w + r; else if (m === t) e.y = rc.y - r; else e.y = rc.y + rc.h + r; return true; }
    const d = Math.sqrt(d2); e.x = cx + dx / d * r; e.y = cy + dy / d * r; return true;
  }
  const baleRect = b => ({ x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h });
  const inMud = e => level.mud.some(m => ((e.x - m.x) / m.r) ** 2 + ((e.y - m.y) / (m.r * .6)) ** 2 < 1);
  function gapAt(side, e) { if (!level.exits.includes(side)) return false; const x = EXITS[side]; return side === "L" ? Math.abs(e.y - x.cy) < x.half - 16 : Math.abs(e.x - x.cx) < x.half - 16; }
  function constrain(e, r, canExit) {
    if (e.x < FIELD.x + r && !(canExit && gapAt("L", e))) e.x = FIELD.x + r;
    if (e.x > FIELD.x2 - r) e.x = FIELD.x2 - r;
    if (e.y < FIELD.y + r + 6 && !(canExit && gapAt("T", e))) e.y = FIELD.y + r + 6;
    if (e.y > FIELD.y2 - r && !(canExit && gapAt("B", e))) e.y = FIELD.y2 - r;
  }
  function collide(e, r) { let hit = false; for (const w of WALLS) hit = pushOut(e, r, w) || hit; for (const b of level.bales) hit = pushOut(e, r, baleRect(b)) || hit; return hit; }

  /* ------------------------------------------------------------- efectos */
  const shake = (m, t = .25) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, t); };
  function say(x, y, text, color = "#f7f0d5", life = 2.4, sheepId) { bubbles = bubbles.filter(b => b.id !== text); bubbles.push({ x, y, text, color, life, t: 0, id: text, sheep: sheepId }); if (bubbles.length > 6) bubbles.shift(); }
  const float = (x, y, text, color, life = 1.4) => floats.push({ x, y, text, color, t: 0, life });
  function burst(x, y, color, n = 8, speed = 90, g = 140) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.283); particles.push({ x, y, vx: Math.cos(a) * rnd(.4, 1) * speed, vy: Math.sin(a) * rnd(.4, 1) * speed - 30, t: 0, life: rnd(.4, .8), color, g, s: 4 }); } }

  /* -------------------------------------------------------------- partida */
  function startLevel(n) {
    level = levelDef(n); buildBg();
    dog = { x: 480, y: 545, vx: 0, vy: 0, face: 1, phase: 0, barkT: 0, barkCD: 0, whistleCD: 0, stamina: 100, tired: false, sprint: false, lureT: 0, moving: false, dust: 0 };
    sheep = []; wolves = []; pickups = []; particles = []; floats = []; bubbles = []; rings = [];
    rain = level.theme.rain ? Array.from({ length: 130 }, () => ({ x: rnd(0, W), y: rnd(0, H), s: rnd(520, 760) })) : [];
    clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 210 + rnd(0, 80), y: rnd(6, 34), w: rnd(46, 90), v: rnd(5, 13) }));
    const spots = [];
    level.list.forEach((d, i) => {
      let x, y, tries = 0;
      do { x = rnd(150, 600); y = rnd(140, 500); tries++; } while (tries < 90 && (spots.some(s => Math.hypot(s.x - x, s.y - y) < 66) || level.bales.some(b => Math.abs(b.x - x) < 70 && Math.abs(b.y - y) < 60) || Math.hypot(x - dog.x, y - dog.y) < 120));
      spots.push({ x, y });
      sheep.push({ id: i, type: d.code, x, y, vx: 0, vy: 0, wx: 0, wy: 0, wt: rnd(.2, 1.5), value: d.value, color: d.color, stress: 0, state: "free", rt: 0, face: 1, phase: rnd(0, 6), sayCD: rnd(0, 2), fade: 0, neg: 0, tantrum: false, whistleT: 0, hop: 0, graze: false });
    });
    votesSecured = 0; lostCount = 0; timeLeft = level.time; elapsed = 0; bannerT = 2.6; tipT = level.tip ? 7 : 0; idleT = 0;
    combo = 0; comboT = 0; freezeT = 0; flash = 0; thunderT = 0; alertT = 0; pops = {};
    wolfT = level.wolf ? level.wolf.first : 1e9; pickT = rnd(9, 14);
    stats = { nego: 0, spooked: 0, maxCombo: 0, barks: 0, whistles: 0 };
    filled = Array(level.base).fill(BASE_SEAT);
    music.setLevel(n); music.setIntensity(0);
    updateHud();
  }
  const baseVotes = () => level.base + votesSecured;
  const potential = () => baseVotes() + sheep.filter(s => s.state === "free" || s.state === "rebel").reduce((a, s) => a + s.value, 0);
  function updateHud() { UI.level.textContent = level.n; UI.votes.textContent = pad(baseVotes(), 3); UI.time.textContent = pad(Math.ceil(timeLeft), 2); UI.lost.textContent = lostCount; }
  function setControls() { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; }
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };

  /* ----------------------------------------------------------- pantallas */
  function starsHtml(n) { return `<div class="stars" aria-label="${n} de 3 estrellas">${[0, 1, 2].map(i => `<i class="star ${i < n ? "on" : ""}"></i>`).join("")}</div>`; }
  function showOverlay({ stamp = "SÁTIRA PIXELADA", title, text = "", extra = "", actions = [], help = false }) {
    $("#game-help").hidden = !help;
    UI.stamp.textContent = stamp; UI.title.textContent = title; UI.text.textContent = text; UI.text.hidden = !text;
    if (typeof extra === "string") UI.extra.innerHTML = extra; else { UI.extra.innerHTML = ""; UI.extra.appendChild(extra); }
    UI.actions.innerHTML = "";
    actions.forEach((a, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn" + (a.secondary ? " secondary" : ""); b.textContent = a.label; b.addEventListener("click", a.fn); UI.actions.appendChild(b); if (i === 0) requestAnimationFrame(() => b.focus()); });
    UI.overlay.classList.remove("hidden"); keys.clear(); pointer.down = false;
  }
  const hideOverlay = () => UI.overlay.classList.add("hidden");
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    const acts = [{ label: "EMPEZAR", fn: () => playLevel(1, true) }];
    if (prog.unlocked > 1) acts.unshift({ label: `CONTINUAR: LEGISLATURA ${Math.min(prog.unlocked, 99)}`, fn: () => playLevel(prog.unlocked, true) });
    acts.push({ label: "MAPA DE LEGISLATURAS", secondary: true, fn: () => mapScreen() }); acts.push({ label: "VOLVER A SANXE GAMES", secondary: true, fn: () => { location.href = "../"; } });
    showOverlay({ help: true, title: "PASTOR DE SOCIOS", text: `Gobiernas por los pelos: te faltan votos para llegar a 176. Guía a cada socio hasta el corral sin agobiarlo, espanta al Lobo Mediático y no dejes que se fuguen al Grupo Mixto.${prog.best ? ` Récord: ${prog.best}.` : ""}`, actions: acts });
  }
  function mapScreen(from) {
    const wrap = document.createElement("div"); wrap.className = "map";
    const total = Math.max(8, Math.min(prog.unlocked + 1, 12));
    for (let n = 1; n <= total; n++) {
      const def = baseDef(n), open = n <= prog.unlocked, st = prog.stars[n] || 0;
      const b = document.createElement("button"); b.type = "button"; b.className = "tile" + (open ? "" : " locked"); b.disabled = !open;
      b.innerHTML = `<b>${n}</b><span>${def.name}</span>${open ? starsHtml(st) : ""}`;
      b.addEventListener("click", () => playLevel(n, true)); wrap.appendChild(b);
    }
    showOverlay({ stamp: "ELIGE LEGISLATURA", title: "MAPA", extra: wrap, actions: [{ label: "VOLVER", secondary: true, fn: () => (from === "pause" ? pauseScreen() : titleScreen()) }] });
  }
  function playLevel(n, fresh) {
    if (fresh) score = 0;
    state = "playing"; startLevel(n); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(n);
    UI.status.textContent = `${level.name}. Lleva a los socios al corral.`; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now();
  }
  function pauseScreen() {
    state = "paused"; setControls(); music.pause(true);
    showOverlay({ help: true, stamp: "RESPIRO", title: "PAUSA", text: "El Gobierno se toma un respiro. Los socios, no.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR NIVEL", secondary: true, fn: () => playLevel(level.n) }, { label: "MAPA", secondary: true, fn: () => mapScreen("pause") }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: () => { location.href = "../"; } }] });
  }
  function pauseGame() { if (state === "playing") pauseScreen(); }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function headline() {
    const margin = baseVotes() - GOAL, tr = timeLeft / level.time;
    if (margin <= 1) return ["SE SALVA POR UN VOTO", "Y lo celebran como si fuera una mayoría absoluta."];
    if (stats.spooked >= 2) return ["EL PERRO PLANTA CARA A LA PRENSA", "El Lobo Mediático huye con el rabo entre las piernas."];
    if (stats.nego >= 3) return ["NEGOCIADOR NATO", "Tres díscolos recuperados sin cambiar ni una coma del pacto."];
    if (lostCount === 0 && tr > .5) return ["INVESTIDURA EXPRÉS", "Todos los socios en el corral y ni una sola concesión."];
    if (lostCount === 0) return ["MAYORÍA PERFECTA", "Ni un solo socio se fue al Grupo Mixto."];
    if (stats.maxCombo >= 4) return ["CUADRANDO EL CÍRCULO", "Cuatro socios seguidos: algo nunca visto en la Cámara."];
    if (lostCount >= 2) return ["AJUSTE TÉCNICO", "Dos socios al Grupo Mixto. Fuentes del Gobierno lo llaman «reordenación»."];
    return ["LEGISLATURA SALVADA", "El Gobierno agradece la paciencia de sus socios."];
  }
  function levelComplete() {
    const bonus = Math.floor(timeLeft) * 10; score += bonus;
    const st = 1 + (lostCount === 0 ? 1 : 0) + (timeLeft >= level.time * .35 ? 1 : 0);
    prog.stars[level.n] = Math.max(prog.stars[level.n] || 0, st); prog.unlocked = Math.max(prog.unlocked, level.n + 1); prog.best = Math.max(prog.best, score); saveProg();
    state = "levelclear"; setControls(); sfx.win(); music.stop(); const [h1, h2] = headline();
    UI.status.textContent = `${level.name} superada con ${st} estrellas.`;
    showOverlay({ stamp: level.name, title: "INVESTIDURA APROBADA", text: `${baseVotes()} votos con ${Math.floor(timeLeft)} s de margen (+${bonus}). Puntuación: ${score}.`, extra: `${starsHtml(st)}<p class="headline"><b>TITULAR</b>${h1}<small>${h2}</small></p>`, actions: [{ label: "SIGUIENTE LEGISLATURA", fn: () => playLevel(level.n + 1) }, { label: "REPETIR", secondary: true, fn: () => playLevel(level.n) }, { label: "MAPA", secondary: true, fn: () => mapScreen() }] });
  }
  function gameOver(why) {
    prog.best = Math.max(prog.best, score); saveProg(); state = "lost"; setControls(); sfx.lose(); music.stop(); UI.status.textContent = "Fin de la legislatura.";
    const t = why === "tiempo"
      ? ["TE HAN CENSURADO", `Se acabó el tiempo: te quedaste en ${baseVotes()} votos. Moción aprobada, a hacer las maletas.`, "ÚLTIMA HORA", "El Gobierno cae sin enterarse de que había que votar."]
      : ["NO SALEN LAS CUENTAS", "Demasiados socios se han ido al Grupo Mixto: ya no hay forma de llegar a 176. Elecciones a la vista.", "ÚLTIMA HORA", "El Gobierno atribuye la fuga a «razones meteorológicas»."];
    showOverlay({ stamp: level.name, title: t[0], text: `${t[1]} Puntuación: ${score}. Récord: ${prog.best}.`, extra: `<p class="headline"><b>${t[2]}</b>${t[3]}</p>`, actions: [{ label: "REINTENTAR", fn: () => playLevel(level.n) }, { label: "MAPA", secondary: true, fn: () => mapScreen() }, { label: "INICIO", secondary: true, fn: titleScreen }] });
  }

  /* ----------------------------------------------------------- habilidades */
  function bark() {
    if (state !== "playing" || dog.barkCD > 0) return;
    dog.barkCD = BARK_CD; dog.barkT = .3; stats.barks++; sfx.bark(); shake(2.5, .15); rings.push({ x: dog.x, y: dog.y, t: 0, color: "247,240,213", max: BARK_R }); say(dog.x, dog.y - 74, "¡GUAU!", "#ffd34e", 1);
    for (const s of sheep) {
      if (s.state === "lost" || s.state === "secured") continue;
      const dx = s.x - dog.x, dy = s.y - dog.y, d = Math.hypot(dx, dy) || 1;
      if (d < BARK_R) { const k = 1 - d / BARK_R; s.vx += dx / d * (300 * k + 110); s.vy += dy / d * (300 * k + 110); s.stress += .26 * (.4 + k) * TY[s.type].stress; }
    }
    for (const w of wolves) if (w.state === "stalk" && Math.hypot(w.x - dog.x, w.y - dog.y) < BARK_R * 1.2) scareWolf(w);
  }
  function whistle() {
    if (state !== "playing" || dog.whistleCD > 0) return;
    dog.whistleCD = WHISTLE_CD; stats.whistles++; sfx.whistle(); rings.push({ x: dog.x, y: dog.y, t: 0, color: "49,215,199", max: WHISTLE_R });
    for (let i = 0; i < 6; i++) particles.push({ x: dog.x + rnd(-20, 20), y: dog.y - 40, vx: rnd(-30, 30), vy: rnd(-70, -30), t: 0, life: .9, color: "#31d7c7", g: 0, s: 5 });
    for (const s of sheep) if ((s.state === "free") && Math.hypot(s.x - dog.x, s.y - dog.y) < WHISTLE_R) { s.whistleT = 1.5; s.stress = Math.max(0, s.stress - .2); }
  }
  function scareWolf(w) { if (w.state !== "stalk") return; w.state = "flee"; stats.spooked++; sfx.scare(); float(w.x, w.y - 40, "¡FUERA!", "#ffd34e"); say(dog.x, dog.y - 74, pick(DOG_LINES.wolf), "#f7f0d5", 1.8); burst(w.x, w.y - 10, "#a3a7bd", 8); wolfT = level.wolf ? level.wolf.every : 1e9; }

  /* ----------------------------------------------------------- simulación */
  function nearestExit(e) {
    let best = null, bd = 1e9;
    for (const k of level.exits) { const x = EXITS[k], d = Math.hypot(e.x - x.cx, e.y - x.cy); if (d < bd) { bd = d; best = { ...x, key: k }; } }
    return best;
  }
  function updateDog(dt) {
    let ix = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    let iy = (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0);
    if (pointer.down) { const dx = pointer.x - dog.x, dy = pointer.y - dog.y, d = Math.hypot(dx, dy); if (d > 16) { ix += dx / d; iy += dy / d; } }
    const m = Math.hypot(ix, iy); if (m > 1) { ix /= m; iy /= m; }
    const want = (keys.has("ShiftLeft") || keys.has("ShiftRight") || touch.sprint) && (ix || iy);
    if (dog.tired && dog.stamina > 28) dog.tired = false;
    dog.sprint = !!want && !dog.tired && dog.stamina > 0;
    if (dog.sprint) { dog.stamina -= 42 * dt; if (dog.stamina <= 0) { dog.stamina = 0; dog.tired = true; dog.sprint = false; } } else dog.stamina = Math.min(100, dog.stamina + (ix || iy ? 16 : 30) * dt);
    const sp = DOG_SPEED * (dog.sprint ? 1.42 : 1) * (inMud(dog) ? .6 : 1);
    dog.vx += (ix * sp - dog.vx) * Math.min(1, dt * 14); dog.vy += (iy * sp - dog.vy) * Math.min(1, dt * 14);
    dog.x += dog.vx * dt; dog.y += dog.vy * dt; constrain(dog, DOG_R, false); collide(dog, DOG_R);
    const v = Math.hypot(dog.vx, dog.vy); dog.moving = v > 40;
    if (Math.abs(dog.vx) > 25) dog.face = dog.vx > 0 ? 1 : -1;
    dog.phase += dt * (dog.moving ? (dog.sprint ? 14 : 10) : 4);
    dog.barkT = Math.max(0, dog.barkT - dt); dog.barkCD = Math.max(0, dog.barkCD - dt); dog.whistleCD = Math.max(0, dog.whistleCD - dt); dog.lureT = Math.max(0, dog.lureT - dt);
    dog.dust -= dt; if (dog.moving && dog.dust <= 0) { dog.dust = dog.sprint ? .04 : .09; const mud = inMud(dog); particles.push({ x: dog.x - dog.face * 10, y: dog.y + 8, vx: -dog.vx * .12 + rnd(-8, 8), vy: rnd(-30, -10), t: 0, life: .4, color: mud ? "#4f3822" : "#b8a87a", g: 0, s: dog.sprint ? 5 : 3 }); }
    if (ix || iy) idleT = 0; else { idleT += dt; if (idleT > 6) { idleT = 0; say(dog.x, dog.y - 74, pick(DOG_LINES.idle), "#f7f0d5", 2.6); } }
  }
  function goRebel(s) {
    const ty = TY[s.type]; s.state = "rebel"; s.rt = 3; s.stress = 1; s.neg = 0; sfx.baa(s.type === "p" ? .7 : s.type === "f" ? 1.3 : 1); burst(s.x, s.y - 14, "#f7f0d5", 8); shake(1.5, .1);
    say(s.x, s.y - 58, s.type === "c" ? "¡A LA CALLE!" : s.tantrum ? pick(DEMANDS) : "¡ME VOY!", "#ff4d61", 1.6, s.id); s.tantrum = false;
    const rad = s.type === "c" ? 260 : 150, add = s.type === "c" ? .75 : .4;
    for (const o of sheep) if (o !== s && o.state === "free" && Math.hypot(o.x - s.x, o.y - s.y) < rad) o.stress = Math.min(.99, o.stress + add * TY[o.type].stress);
    void ty;
  }
  function secure(s) {
    s.state = "secured"; s.stress = 0; s.vx *= .3; s.vy *= .3; s.wt = .5; votesSecured += s.value;
    comboT > 0 ? combo++ : (combo = 1); comboT = 5; stats.maxCombo = Math.max(stats.maxCombo, combo);
    const mult = Math.min(5, combo); score += s.value * 10 * mult;
    for (let i = 0; i < s.value; i++) { filled.push(s.color); pops[filled.length - 1] = .45; }
    sfx.ding(); if (combo >= 2) { sfx.combo(combo); float(s.x, s.y - 70, `x${mult} ¡CUADRANDO!`, "#3cff7a", 1.6); }
    float(s.x, s.y - 42, `+${s.value}`, "#ffd34e"); burst(s.x, s.y - 14, "#ffd34e", 12, 120); shake(1.5, .12);
    say(dog.x, dog.y - 74, pick(DOG_LINES.secured), "#f7f0d5", 1.8);
    for (const o of sheep) if (o.state === "secured" && o !== s) o.hop = rnd(.15, .4);
    s.hop = .5; updateHud();
    if (baseVotes() >= GOAL) levelComplete();
  }
  function lose(s) {
    s.state = "lost"; s.fade = 0; const e = nearestExit(s) || { key: "L" }; s.exitDir = e.key === "L" ? [-1, 0] : e.key === "T" ? [0, -1] : [0, 1];
    lostCount++; score = Math.max(0, score - 40); sfx.lost(); combo = 0; comboT = 0;
    float(clamp(s.x, 80, W - 80), clamp(s.y, FIELD.y + 40, FIELD.y2 - 20), "¡AL GRUPO MIXTO!", "#ff4d61");
    say(dog.x, dog.y - 74, pick(DOG_LINES.lost), "#f7f0d5", 2); updateHud();
    if (potential() < GOAL) gameOver("cuentas");
  }
  function updateSheep(dt) {
    for (const s of sheep) {
      if (s.state === "lost") { s.fade += dt; const e = s.exitDir || [-1, 0]; s.x += e[0] * 70 * dt; s.y += e[1] * 70 * dt; continue; }
      const ty = TY[s.type];
      s.hop = Math.max(0, s.hop - dt);
      if (freezeT > 0 && s.state !== "secured") { s.vx = s.vy = 0; s.stress = Math.max(0, s.stress - dt * .6); if (s.state === "rebel") { s.state = "free"; s.stress = .2; } continue; }
      const dx = s.x - dog.x, dy = s.y - dog.y, d = Math.hypot(dx, dy) || 1, fleeR = level.fleeR * Math.sqrt(ty.flee), fleeSp = level.fleeSpeed * ty.flee;
      let dvx = 0, dvy = 0; s.graze = false;
      if (s.state === "secured") {
        s.wt -= dt; if (s.wt <= 0) { s.wt = rnd(.8, 2); const a = rnd(0, 6.283), sp = Math.random() < .5 ? 0 : rnd(10, 24); s.wx = Math.cos(a) * sp; s.wy = Math.sin(a) * sp; }
        dvx = s.wx; dvy = s.wy;
      } else if (s.state === "rebel") {
        const ex = nearestExit(s), tx = ex.cx - s.x, ty2 = ex.cy - s.y, td = Math.hypot(tx, ty2) || 1, rs = (138 + level.n * 4) * ty.speed;
        dvx = tx / td * rs; dvy = ty2 / td * rs;
        if (d < 110) { const k = 1 - d / 110; dvx += dx / d * fleeSp * 1.1 * k; dvy += dy / d * fleeSp * 1.1 * k; }
        if (d < 66) s.neg += dt; else s.neg = Math.max(0, s.neg - dt * .8);
        if (s.neg >= .55) { s.state = "free"; s.stress = .2; s.neg = 0; stats.nego++; sfx.nego(); float(s.x, s.y - 42, "¡NEGOCIADO!", "#3cff7a"); say(s.x, s.y - 58, pick(["Vale, lo hablamos", "Me has convencido", "Con una foto me vale"]), "#3cff7a", 1.6, s.id); burst(s.x, s.y - 14, "#3cff7a", 10); }
        s.rt -= dt; if (s.rt <= 0 && s.state === "rebel") { s.state = "free"; s.stress = .3; s.neg = 0; }
      } else {
        s.wt -= dt;
        if (s.wt <= 0) {
          if (s.type === "v") { s.wt = rnd(.3, .8); const a = rnd(0, 6.283), sp = rnd(30, 55); s.wx = Math.cos(a) * sp; s.wy = Math.sin(a) * sp; }
          else { s.wt = rnd(.8, 2.2); if (Math.random() < .45) { s.wx = s.wy = 0; } else { const a = rnd(0, 6.283), sp = rnd(18, 34); s.wx = Math.cos(a) * sp; s.wy = Math.sin(a) * sp; } }
        }
        dvx = s.wx; dvy = s.wy; s.graze = s.wx === 0 && s.wy === 0 && d > fleeR && s.stress < .2;
        const lure = dog.lureT > 0 && d < 320, whistled = s.whistleT > 0; s.whistleT = Math.max(0, s.whistleT - dt);
        if (lure || whistled) { if (d > 70) { const sp = lure ? 90 : 105; dvx = -dx / d * sp; dvy = -dy / d * sp; s.graze = false; } else { dvx = dvy = 0; } if (lure) s.stress = Math.max(0, s.stress - dt * .5); }
        else if (d < fleeR) { const k = Math.pow(1 - d / fleeR, .7); dvx += dx / d * fleeSp * k; dvy += dy / d * fleeSp * k; s.graze = false; }
        const gain = level.stressRate * ty.stress * (dog.sprint ? 1.5 : 1);
        if (!lure && !whistled && d < STRESS_R) s.stress += dt * gain * (1.25 - d / STRESS_R); else s.stress = Math.max(0, s.stress - dt * .22);
        for (const w of wolves) if (w.state === "stalk" && Math.hypot(w.x - s.x, w.y - s.y) < 140) s.stress += dt * .35 * ty.stress;
        let cx = 0, cy = 0, cn = 0;
        for (const o of sheep) {
          if (o === s || o.state === "lost") continue;
          const ox = s.x - o.x, oy = s.y - o.y, od = Math.hypot(ox, oy), sep = (ty.r + TY[o.type].r) * 1.15;
          if (od > 1 && od < sep) { const f = (1 - od / sep) * 70; dvx += ox / od * f; dvy += oy / od * f; }
          if (o.state === "free" && od < 230) { cx += o.x; cy += o.y; cn++; }
        }
        const gdx = PEN.x - 10 - s.x, gdy = (GATE.y1 + GATE.y2) / 2 - s.y, gdd = Math.hypot(gdx, gdy);
        if (gdd < 170 && d < fleeR) { dvx += gdx / gdd * 34; dvy += gdy / gdd * 34; }
        if (cn && !lure) { const gx = cx / cn - s.x, gy = cy / cn - s.y, gd = Math.hypot(gx, gy) || 1; if (gd > 70) { dvx += gx / gd * 14; dvy += gy / gd * 14; } }
        if (s.stress >= .55) { s.sayCD -= dt; if (s.sayCD <= 0 && bubbles.filter(b => b.sheep !== undefined).length < 2) { s.sayCD = rnd(3.5, 5.5); say(s.x, s.y - 58, pick(DEMANDS), s.color, 2.3, s.id); } }
        if (s.stress < 1 && Math.random() < level.tantrum * dt) { s.stress = 1; s.tantrum = true; }
        if (s.stress >= 1) goRebel(s);
      }
      const mudK = inMud(s) ? .6 : 1, resp = Math.min(1, dt * (s.state === "rebel" ? 8 : 5));
      s.vx += (dvx * mudK - s.vx) * resp; s.vy += (dvy * mudK - s.vy) * resp; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.state === "secured") { s.x = clamp(s.x, PEN_IN.x + 14, PEN_IN.x + PEN_IN.w - 14); s.y = clamp(s.y, PEN_IN.y + 14, PEN_IN.y + PEN_IN.h - 6); }
      else { constrain(s, ty.r, true); collide(s, ty.r); }
      if (Math.abs(s.vx) > 8) s.face = s.vx > 0 ? 1 : -1;
      s.phase += dt * Math.min(12, Math.hypot(s.vx, s.vy) / 14);
      if (s.state !== "secured" && s.x > PEN.x + 18 && s.y > PEN.y + 14 && s.y < PEN.y + PEN.h - 14) secure(s);
      else if (s.state !== "secured" && s.state !== "lost" && (s.x < FIELD.x - 6 || s.y < FIELD.y - 2 || s.y > FIELD.y2 + 6)) lose(s);
      if (state !== "playing") return;
    }
    sheep = sheep.filter(s => !(s.state === "lost" && s.fade > 1.1));
  }
  function spawnWolf() {
    const k = pick(level.exits), e = EXITS[k], x = k === "L" ? FIELD.x - 36 : e.cx, y = k === "L" ? e.cy : k === "T" ? FIELD.y - 30 : FIELD.y2 + 30;
    wolves.push({ x, y, vx: 0, vy: 0, state: "stalk", face: 1, phase: 0, target: null, t: 0 });
    alertT = 2.4; sfx.wolf(); shake(3, .3);
  }
  function updateWolves(dt) {
    if (level.wolf) { wolfT -= dt; if (wolfT <= 0 && wolves.length < level.wolf.n) { spawnWolf(); wolfT = level.wolf.every; } else if (wolfT <= 0) wolfT = 4; }
    for (const w of wolves) {
      w.t += dt; w.phase += dt * 12;
      if (freezeT > 0) { w.vx = w.vy = 0; continue; }
      const dd = Math.hypot(w.x - dog.x, w.y - dog.y);
      if (w.state === "stalk") {
        if (dd < 95) { scareWolf(w); }
        else {
          if (!w.target || !(w.target.state === "free" || w.target.state === "rebel")) { let best = null, bd = 1e9; for (const s of sheep) if (s.state === "free" || s.state === "rebel") { const d = Math.hypot(s.x - w.x, s.y - w.y); if (d < bd) { bd = d; best = s; } } w.target = best; }
          if (!w.target) w.state = "flee";
          else {
            const dx = w.target.x - w.x, dy = w.target.y - w.y, d = Math.hypot(dx, dy) || 1, sp = (96 + level.n * 5) * (inMud(w) ? .6 : 1);
            w.vx = dx / d * sp; w.vy = dy / d * sp;
            if (d < 30) { if (w.target.state === "free") goRebel(w.target); say(w.x, w.y - 56, "¡EL LOBO!", "#ff4d61", 1.4); shake(5, .3); w.state = "flee"; wolfT = level.wolf ? level.wolf.every : 1e9; }
          }
        }
      }
      if (w.state === "flee") {
        const ex = nearestExit(w) || { cx: FIELD.x, cy: 300 }, dx = ex.cx - w.x, dy = ex.cy - w.y, d = Math.hypot(dx, dy) || 1, outward = d < 40;
        w.vx = dx / d * 230; w.vy = dy / d * 230; if (outward || w.x < FIELD.x - 50 || w.y < FIELD.y - 50 || w.y > FIELD.y2 + 50) { w.state = "gone"; }
      }
      w.x += w.vx * dt; w.y += w.vy * dt; if (Math.abs(w.vx) > 10) w.face = w.vx > 0 ? 1 : -1;
    }
    wolves = wolves.filter(w => w.state !== "gone");
  }
  function updatePickups(dt) {
    if (level.pickups.length) { pickT -= dt; if (pickT <= 0 && pickups.length < 2) { pickT = rnd(13, 19); let x, y, tries = 0; do { x = rnd(120, 700); y = rnd(130, 520); tries++; } while (tries < 40 && (level.bales.some(b => Math.abs(b.x - x) < 60 && Math.abs(b.y - y) < 50) || inMud({ x, y }))); pickups.push({ type: pick(level.pickups), x, y, t: 0 }); } }
    for (const p of pickups) {
      p.t += dt;
      if (Math.hypot(p.x - dog.x, p.y - dog.y) < 30) {
        p.t = 99; sfx.pickup(); burst(p.x, p.y, "#ffd34e", 10, 110);
        if (p.type === "time") { timeLeft += 12; float(p.x, p.y - 30, "+12 S PRÓRROGA", "#ffd34e", 1.8); }
        else if (p.type === "lure") { dog.lureT = 7; float(p.x, p.y - 30, "¡CARTERA! TE SIGUEN", "#ffd34e", 1.8); }
        else { freezeT = 4.5; sfx.freeze(); float(p.x, p.y - 30, "COMISIÓN DE ESTUDIO", "#31d7c7", 1.8); for (const s of sheep) if (s.state === "rebel") { s.state = "free"; s.stress = .2; } }
      }
    }
    pickups = pickups.filter(p => p.t < 14);
  }
  function update(dt) {
    if (state !== "playing") return;
    elapsed += dt; bannerT = Math.max(0, bannerT - dt); tipT = Math.max(0, tipT - dt); alertT = Math.max(0, alertT - dt); freezeT = Math.max(0, freezeT - dt); timeLeft -= dt;
    comboT = Math.max(0, comboT - dt); if (comboT === 0) combo = 0;
    updateDog(dt); updateSheep(dt); if (state !== "playing") return; updateWolves(dt); updatePickups(dt);
    for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; } particles = particles.filter(p => p.t < p.life);
    for (const f of floats) { f.t += dt; f.y -= 26 * dt; } floats = floats.filter(f => f.t < f.life);
    for (const b of bubbles) { b.t += dt; if (b.sheep !== undefined) { const s = sheep.find(q => q.id === b.sheep); if (s) { b.x = s.x; b.y = s.y - 58; } } } bubbles = bubbles.filter(b => b.t < b.life);
    for (const r of rings) r.t += dt; rings = rings.filter(r => r.t < .45);
    for (const k in pops) { pops[k] -= dt; if (pops[k] <= 0) delete pops[k]; }
    shakeT = Math.max(0, shakeT - dt); for (const c of clouds) { c.x += c.v * dt; if (c.x > W + 40) c.x = -c.w - 20; }
    if (rain.length) { for (const r of rain) { r.y += r.s * dt; r.x -= r.s * .25 * dt; if (r.y > H) { r.y = -10; r.x = rnd(0, W + 120); } } thunderT -= dt; if (thunderT <= 0) { thunderT = rnd(7, 15); flash = reduced ? 0 : .9; setTimeout(() => sfx.thunder(), 350); } flash = Math.max(0, flash - dt * 2.2); }
    const rebels = sheep.some(s => s.state === "rebel") || wolves.length > 0;
    music.setIntensity(timeLeft < level.time * .25 ? 2 : rebels ? 1 : 0);
    const tl = Math.ceil(timeLeft); if (UI.time.textContent !== pad(tl, 2)) { UI.time.textContent = pad(tl, 2); if (tl <= 10 && tl > 0) sfx.tick(); }
    if (timeLeft <= 0) { timeLeft = 0; updateHud(); gameOver("tiempo"); }
  }

  /* ---------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  function outlinedText(txt, x, y, color, font, align = "center") {
    ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814";
    [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y);
  }
  const shadow = (x, y, rx) => { ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(x, y + 2, rx, rx * .38, 0, 0, 7); ctx.fill(); };
  function drawSheep(s) {
    const ty = TY[s.type], panic = s.state === "rebel" || s.stress >= .55, mode = panic ? "panic" : s.graze ? "graze" : "walk";
    const spr = SPR.sheep(s.color, mode, Math.floor(s.phase) % 2), sc = ty.sc, w = spr.width * sc, h = spr.height * sc;
    const shk = s.state === "rebel" ? Math.sin(elapsed * 50 + s.id) * 1.5 : s.stress >= .55 ? Math.sin(elapsed * 40 + s.id) : 0;
    const moving = Math.hypot(s.vx, s.vy) > 20, bounce = s.hop > 0 ? Math.abs(Math.sin(s.hop * 14)) * 12 : moving ? Math.abs(Math.sin(s.phase)) * 2 : 0;
    shadow(s.x, s.y + 8, ty.r + 5);
    ctx.save(); if (s.state === "lost") ctx.globalAlpha = Math.max(0, 1 - s.fade / 1.1);
    ctx.translate(Math.round(s.x + shk), Math.round(s.y + 10 - bounce)); if (s.face < 0) ctx.scale(-1, 1);
    const ox = Math.round(-w / 2), oy = -h; ctx.drawImage(spr, ox, oy, w, h);
    const acc = (px, py, pw, ph, col) => { ctx.fillStyle = col; ctx.fillRect(ox + px * sc, oy + py * sc, pw * sc, ph * sc); };
    if (s.type === "c") { acc(22, 3, 5, 1, "#d9992a"); acc(22, 2, 1, 1, "#ffd34e"); acc(24, 1, 1, 2, "#ffd34e"); acc(26, 2, 1, 1, "#ffd34e"); acc(23, 3, 1, 1, "#ff4d61"); }
    else if (s.type === "v") { const dir = Math.sin(elapsed * 3 + s.id) > 0 ? 1 : -1; acc(12, -3, 1, 5, "#aab4d5"); acc(dir > 0 ? 13 : 9, -3, 4, 1, "#31d7c7"); acc(dir > 0 ? 16 : 9, -4, 1, 3, "#31d7c7"); }
    else if (s.type === "f") { acc(21, 4, 6, 1, "#ff4d61"); acc(19, 5, 2, 1, "#ff4d61"); }
    ctx.restore();
    if (s.state === "rebel" && s.neg > 0) { ctx.strokeStyle = "#3cff7a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y - 14, 32, -1.57, -1.57 + 6.283 * Math.min(1, s.neg / .55)); ctx.stroke(); }
    if (s.state === "rebel") { ctx.fillStyle = "#ff4d61"; ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y - 76 - bounce), 4, 11); ctx.fillRect(Math.round(s.x) - 2, Math.round(s.y - 62 - bounce), 4, 4); }
    if (s.state === "free" && s.stress > .08) { const bw = 36, by = Math.round(s.y - ty.sc * 22); ctx.fillStyle = "#050814"; ctx.fillRect(Math.round(s.x - bw / 2) - 2, by, bw + 4, 8); ctx.fillStyle = s.stress > .7 ? "#ff4d61" : "#ffd34e"; ctx.fillRect(Math.round(s.x - bw / 2), by + 2, Math.round(bw * clamp(s.stress, 0, 1)), 4); }
    if (s.state === "free" || s.state === "rebel") {
      ctx.font = `14px ${FONT_T}`; ctx.textAlign = "center"; ctx.fillStyle = "#050814"; ctx.fillText(s.value, s.x + 1, s.y + 29); ctx.fillStyle = s.color; ctx.fillText(s.value, s.x, s.y + 28);
      if (ty.label) { ctx.font = `7px ${FONT_PX}`; ctx.fillStyle = "#050814"; ctx.fillText(ty.label, s.x + 1, s.y + 40); ctx.fillStyle = "#aab4d5"; ctx.fillText(ty.label, s.x, s.y + 39); }
    }
    if (s.type === "f" && moving && s.state !== "secured") { ctx.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(s.x - s.face * (30 + i * 8)), Math.round(s.y - 12 + i * 7), 14, 2); }
  }
  function drawDog() {
    const set = dog.barkT > 0 ? SPR.dog.bark : dog.moving ? SPR.dog.run : SPR.dog.idle, spr = set[Math.floor(dog.phase) % set.length], w = spr.width * SC, h = spr.height * SC;
    shadow(dog.x, dog.y + 8, 24);
    ctx.save(); ctx.translate(Math.round(dog.x), Math.round(dog.y + 10)); if (dog.face < 0) ctx.scale(-1, 1);
    if (dog.sprint) { ctx.fillStyle = "rgba(255,255,255,.35)"; for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 - 14 - i * 8, -h + 12 + i * 8, 14, 2); }
    ctx.drawImage(spr, Math.round(-w / 2), -h, w, h); ctx.restore();
    if (dog.lureT > 0) { const ic = SPR.pickups.lure; ctx.drawImage(ic, Math.round(dog.x - 16), Math.round(dog.y - 76 + Math.sin(elapsed * 6) * 3), 32, 32); ctx.strokeStyle = "#ffd34e"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(dog.x, dog.y - 60, 22, -1.57, -1.57 + 6.283 * dog.lureT / 7); ctx.stroke(); }
  }
  function drawWolf(w) {
    const set = w.state === "flee" ? SPR.wolf.scared : SPR.wolf.run, spr = set[Math.floor(w.phase) % set.length], sw = spr.width * SC, sh = spr.height * SC;
    shadow(w.x, w.y + 10, 28); ctx.save(); ctx.translate(Math.round(w.x), Math.round(w.y + 12)); if (w.face < 0) ctx.scale(-1, 1); ctx.drawImage(spr, Math.round(-sw / 2), -sh, sw, sh); ctx.restore();
    if (w.state === "stalk") { ctx.font = `7px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillStyle = "#050814"; ctx.fillText("LOBO MEDIATICO", w.x + 1, w.y - 54); ctx.fillStyle = "#ff4d61"; ctx.fillText("LOBO MEDIATICO", w.x, w.y - 55); }
  }
  function drawPickup(p) {
    const ic = SPR.pickups[p.type], bob = Math.sin(p.t * 4) * 4, blink = p.t > 10 && Math.floor(p.t * 6) % 2;
    shadow(p.x, p.y + 12, 14); if (blink) return;
    ctx.fillStyle = `rgba(255,211,78,${(.18 + .1 * Math.sin(p.t * 5)).toFixed(2)})`; ctx.beginPath(); ctx.arc(p.x, p.y - 4 + bob, 26, 0, 7); ctx.fill();
    ctx.drawImage(ic, Math.round(p.x - 20), Math.round(p.y - 24 + bob), 40, 40);
  }
  function drawBale(b) {
    const x = b.x - b.w / 2, y = b.y - b.h / 2; shadow(b.x, b.y + b.h / 2 - 2, 32);
    ctx.fillStyle = "#050814"; ctx.fillRect(x - 3, y - 15, b.w + 6, b.h + 18); ctx.fillStyle = "#b8923f"; ctx.fillRect(x, y - 12, b.w, b.h + 12); ctx.fillStyle = "#e0bb5e"; ctx.fillRect(x, y - 12, b.w, 7);
    ctx.fillStyle = "#8a6b2a"; for (let i = 1; i < 4; i++) ctx.fillRect(x + i * 13, y - 12, 2, b.h + 12); ctx.fillRect(x, y + 6, b.w, 2);
  }
  function drawHemicycle() {
    ctx.fillStyle = "rgba(8,12,30,.78)"; ctx.beginPath(); ctx.arc(480, 82, 84, Math.PI, 0); ctx.fill(); ctx.strokeStyle = "#27345b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(480, 82, 84, Math.PI, 0); ctx.stroke();
    const n = Math.min(GOAL, filled.length);
    for (let i = 0; i < GOAL; i++) {
      const s = SEATS[i], on = i < n, pop = pops[i], sz = pop ? 5 + Math.round(pop * 10) : 5;
      ctx.fillStyle = on ? filled[i] : "#1c2650"; ctx.fillRect(Math.round(s.x - sz / 2), Math.round(s.y - sz / 2), sz, sz);
      if (on) { ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(Math.round(s.x - 2), Math.round(s.y - 2), 2, 1); }
    }
    ctx.fillStyle = "#ffd34e"; const last = SEATS[GOAL - 1]; ctx.fillRect(Math.round(last.x) - 4, Math.round(last.y) + 5, 9, 2);
    const v = baseVotes(); ctx.font = `13px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillStyle = "#050814"; ctx.fillText(v, 482, 76); ctx.fillStyle = v >= GOAL ? "#3cff7a" : "#ffd34e"; ctx.fillText(v, 480, 74);
    ctx.font = `7px ${FONT_PX}`; ctx.fillStyle = "#aab4d5"; ctx.fillText("DE 176", 480, 82);
  }
  function drawGauges() {
    const bar = (x, y, w, label, k, col) => { ctx.font = `7px ${FONT_PX}`; ctx.textAlign = "left"; ctx.fillStyle = "#050814"; ctx.fillText(label, x + 1, y - 3); ctx.fillStyle = "#aab4d5"; ctx.fillText(label, x, y - 4); ctx.fillStyle = "#050814"; ctx.fillRect(x - 2, y, w + 4, 12); ctx.fillStyle = "#17213c"; ctx.fillRect(x, y + 2, w, 8); ctx.fillStyle = col; ctx.fillRect(x, y + 2, Math.round(w * clamp(k, 0, 1)), 8); };
    bar(18, 20, 150, "FUERZA", dog.stamina / 100, dog.tired ? "#ff4d61" : "#31d7c7");
    const cd = (x, label, k, key) => { ctx.fillStyle = "#050814"; ctx.fillRect(x - 2, 46, 70, 28); ctx.fillStyle = k >= 1 ? "#1b3a8a" : "#17213c"; ctx.fillRect(x, 48, 66, 24); ctx.fillStyle = k >= 1 ? "#ffd34e" : "#6b7799"; ctx.font = `7px ${FONT_PX}`; ctx.textAlign = "center"; ctx.fillText(label, x + 33, 58); ctx.fillStyle = k >= 1 ? "#f7f0d5" : "#6b7799"; ctx.fillText(key, x + 33, 68); if (k < 1) { ctx.fillStyle = "rgba(5,8,20,.55)"; ctx.fillRect(x, 48, Math.round(66 * (1 - k)), 24); } };
    cd(18, "LADRAR", 1 - dog.barkCD / BARK_CD, "ESPACIO"); cd(94, "SILBAR", 1 - dog.whistleCD / WHISTLE_CD, "X");
    bar(W - 168, 20, 150, "TIEMPO", timeLeft / level.time, timeLeft < level.time * .25 ? "#ff4d61" : "#ffd34e");
    if (combo >= 2) { ctx.font = `10px ${FONT_PX}`; ctx.textAlign = "right"; ctx.fillStyle = "#050814"; ctx.fillText(`COMBO x${Math.min(5, combo)}`, W - 17, 63); ctx.fillStyle = "#3cff7a"; ctx.fillText(`COMBO x${Math.min(5, combo)}`, W - 18, 62); ctx.fillStyle = "#3cff7a"; ctx.fillRect(W - 168, 68, Math.round(150 * comboT / 5), 3); }
  }
  function render() {
    ctx.save(); if (shakeT > 0) ctx.translate(Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM)));
    ctx.drawImage(bg, 0, 0);
    for (const c of clouds) { ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(Math.round(c.x), Math.round(c.y), c.w, 8); ctx.fillRect(Math.round(c.x + 8), Math.round(c.y - 6), c.w - 24, 8); }
    for (const t of tufts) { const sw = Math.sin(elapsed * 2 + t.p) * 2; ctx.fillStyle = "#3e8a63"; ctx.fillRect(Math.round(t.x + sw), t.y - 6, 2, 6); ctx.fillRect(Math.round(t.x + 3 + sw), t.y - 4, 2, 4); }
    for (const m of level.mud) { for (let i = 0; i < 3; i++) { const a = elapsed * .8 + i * 2.1 + m.x, bx = m.x + Math.cos(a) * m.r * .5, by = m.y + Math.sin(a) * m.r * .28, k = (Math.sin(elapsed * 2 + i) + 1) / 2; ctx.fillStyle = "rgba(120,90,50,.8)"; ctx.fillRect(Math.round(bx), Math.round(by - k * 4), 3, 3); } }
    drawHemicycle();
    ctx.fillStyle = "#c9d2e8"; const px = PEN.x + PEN.w - 12, py = PEN.y - 54; ctx.fillRect(px, py, 2, 34); ["#ff4d61", "#ffd34e", "#31d7c7", "#3cff7a", "#8fa8ff"].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(px + 2 + i * 3, py + Math.round(Math.sin(elapsed * 5 + i * .7) * 1.5), 3, 9); });
    const ents = []; for (const s of sheep) ents.push({ y: s.y, f: () => drawSheep(s) }); for (const b of level.bales) ents.push({ y: b.y + b.h / 2, f: () => drawBale(b) });
    for (const w of wolves) ents.push({ y: w.y, f: () => drawWolf(w) }); for (const p of pickups) ents.push({ y: p.y, f: () => drawPickup(p) }); ents.push({ y: dog.y, f: drawDog });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
    for (const r of rings) { const k = r.t / .45; ctx.strokeStyle = `rgba(${r.color},${(1 - k).toFixed(2)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(r.x, r.y + 6, r.max * k, r.max * k * .5, 0, 0, 7); ctx.stroke(); }
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); } ctx.globalAlpha = 1;
    for (const f of floats) { ctx.globalAlpha = clamp(1.6 - f.t / f.life * 1.6 + .2, 0, 1); outlinedText(f.text, f.x, f.y, f.color, `10px ${FONT_PX}`); } ctx.globalAlpha = 1;
    for (const b of bubbles) drawBubble(b);
    ctx.fillStyle = level.theme.tint; ctx.fillRect(0, FIELD.y, W, H - FIELD.y);
    if (freezeT > 0) { ctx.fillStyle = `rgba(120,230,255,${(.12 + .05 * Math.sin(elapsed * 8)).toFixed(2)})`; ctx.fillRect(0, FIELD.y, W, H - FIELD.y); }
    if (rain.length) { ctx.strokeStyle = "rgba(190,210,255,.45)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (const r of rain) { ctx.moveTo(Math.round(r.x), Math.round(r.y)); ctx.lineTo(Math.round(r.x - 6), Math.round(r.y + 16)); } ctx.stroke(); if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${(flash * .55).toFixed(2)})`; ctx.fillRect(0, 0, W, H); } }
    ctx.restore();
    drawGauges();
    if (alertT > 0) { const a = Math.floor(alertT * 6) % 2; if (a) outlinedText("¡LOBO MEDIÁTICO EN EL CAMPO!", W / 2, 130, "#ff4d61", `12px ${FONT_PX}`); }
    if (freezeT > 0) outlinedText("COMISIÓN DE ESTUDIO: NADIE SE MUEVE", W / 2, 130, "#31d7c7", `10px ${FONT_PX}`);
    if (bannerT > 0) { ctx.globalAlpha = clamp(bannerT / .5, 0, 1); outlinedText(`LEGISLATURA ${level.n}`, W / 2, 168, "#ffd34e", `20px ${FONT_PX}`); outlinedText(level.name, W / 2, 200, "#f7f0d5", `12px ${FONT_PX}`); ctx.font = `22px ${FONT_T}`; ctx.fillStyle = "#050814"; ctx.fillText(level.sub, W / 2 + 1, 229); ctx.fillStyle = "#aab4d5"; ctx.fillText(level.sub, W / 2, 228); ctx.globalAlpha = 1; }
    if (tipT > 0 && bannerT <= 0) drawTip(level.tip, clamp(tipT / .4, 0, 1));
  }
  function drawTip(txt, a) {
    ctx.globalAlpha = a; ctx.font = `21px ${FONT_T}`; const words = txt.split(" "), lines = [""]; for (const w of words) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (ctx.measureText(t).width > 700) lines.push(w); else lines[lines.length - 1] = t; }
    const h = 12 + lines.length * 24, y = H - 28 - h; ctx.fillStyle = "#050814"; ctx.fillRect(112, y - 3, 736, h + 6); ctx.fillStyle = "#17213c"; ctx.fillRect(115, y, 730, h); ctx.fillStyle = "#31d7c7"; ctx.fillRect(115, y, 6, h);
    ctx.fillStyle = "#f7f0d5"; ctx.textAlign = "left"; lines.forEach((l, i) => ctx.fillText(l, 134, y + 24 + i * 24)); ctx.globalAlpha = 1;
  }
  function drawBubble(b) {
    ctx.font = `22px ${FONT_T}`; const w = Math.ceil(ctx.measureText(b.text).width) + 18, h = 28, x = clamp(Math.round(b.x - w / 2), 8, W - w - 8), y = Math.round(b.y - h);
    ctx.globalAlpha = clamp(Math.min(b.t / .12, (b.life - b.t) / .25, 1), 0, 1);
    ctx.fillStyle = "#050814"; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.fillStyle = "#f7f0d5"; ctx.fillRect(x, y, w, h);
    const tx = clamp(b.x, x + 12, x + w - 12);
    ctx.fillStyle = "#050814"; ctx.beginPath(); ctx.moveTo(tx - 7, y + h + 3); ctx.lineTo(tx + 7, y + h + 3); ctx.lineTo(tx, y + h + 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f7f0d5"; ctx.beginPath(); ctx.moveTo(tx - 5, y + h); ctx.lineTo(tx + 5, y + h); ctx.lineTo(tx, y + h + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#101629"; ctx.textAlign = "left"; ctx.fillText(b.text, x + 9, y + 21);
    if (b.color !== "#f7f0d5" && b.color !== "#ffd34e") { ctx.fillStyle = b.color; ctx.fillRect(x, y + h - 4, w, 4); }
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------------- bucle */
  function frame(now) {
    if (!last) last = now; const dt = clamp((now - last) / 1000, 0, .1); last = now;
    if (state === "playing") { acc += dt; let n = 0; while (acc >= FIXED && n++ < 5) { update(FIXED); acc -= FIXED; } if (n >= 5) acc = 0; }
    render(); requestAnimationFrame(frame);
  }

  /* ----------------------------------------------------------------- entrada */
  const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS", "Space", "KeyX", "ShiftLeft", "ShiftRight"]);
  addEventListener("keydown", e => {
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "playing") pauseScreen(); else if (state === "paused") resume(); return; }
    if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) { if (state === "playing" || state === "paused") playLevel(level.n); return; }
    if (!GAME_KEYS.has(e.code)) return;
    if (state === "playing") { e.preventDefault(); if (e.code === "Space") { if (!e.repeat) bark(); } else if (e.code === "KeyX") { if (!e.repeat) whistle(); } else keys.add(e.code); }
  });
  addEventListener("keyup", e => keys.delete(e.code));
  addEventListener("blur", () => { keys.clear(); touch.sprint = false; pointer.down = false; if (state === "playing") pauseScreen(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseScreen(); });
  const toLogical = e => { const r = canvas.getBoundingClientRect(); pointer.x = (e.clientX - r.left) * W / r.width; pointer.y = (e.clientY - r.top) * H / r.height; };
  canvas.addEventListener("pointerdown", e => { if (state !== "playing") return; toLogical(e); pointer.down = true; safe(() => canvas.setPointerCapture(e.pointerId)); });
  canvas.addEventListener("pointermove", e => { if (pointer.down) toLogical(e); });
  ["pointerup", "pointercancel"].forEach(ev => canvas.addEventListener(ev, () => { pointer.down = false; }));
  document.querySelectorAll(".touch button").forEach(b => {
    const act = b.dataset.act;
    b.addEventListener("pointerdown", e => { e.preventDefault(); b.classList.add("on"); if (state !== "playing") return; if (act === "bark") bark(); else if (act === "whistle") whistle(); else touch.sprint = true; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => b.addEventListener(ev, () => { b.classList.remove("on"); if (act === "sprint") touch.sprint = false; }));
  });
  UI.pause.addEventListener("click", () => state === "paused" ? resume() : pauseScreen());
  UI.restart.addEventListener("click", () => { if (state !== "title") playLevel(level.n); });
  UI.sound.addEventListener("click", () => { soundOn = !soundOn; store.set("ps-sound", soundOn ? "1" : "0"); AUD.setOn(soundOn); paintSound(); if (soundOn) { sfx.ding(); if (state === "playing") music.start(level.n); } });

  /* ------------------------------------------------------------------ inicio */
  AUD.setOn(soundOn); paintSound(); startLevel(1); titleScreen();
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('22px "VT323"')]).then(() => buildBg()).catch(() => {});
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, level: level.n, votes: baseVotes(), time: Math.round(timeLeft), lost: lostCount, sheep: sheep.filter(s => s.state === "secured").length + "/" + sheep.length, wolves: wolves.length, pickups: pickups.length, combo, score });
    window.__ps = {
      step: (n = 1, dt = FIXED, draw = true) => { for (let i = 0; i < n; i++) update(dt); if (draw) render(); return snap(); },
      snap, level: n => { playLevel(n, true); render(); return snap(); }, key: (k, down = true) => { down ? keys.add(k) : keys.delete(k); }, bark, whistle,
      dogTo: (x, y) => { dog.x = x; dog.y = y; }, dog: () => ({ x: Math.round(dog.x), y: Math.round(dog.y), stamina: Math.round(dog.stamina) }),
      sheep: () => sheep.map(s => ({ id: s.id, t: s.type, x: Math.round(s.x), y: Math.round(s.y), st: s.state, stress: +s.stress.toFixed(2) })),
      wolves: () => wolves.map(w => ({ x: Math.round(w.x), y: Math.round(w.y), st: w.state })), spawnWolf, giveWolf: () => { wolfT = 0; },
      give: type => { pickups.push({ type, x: dog.x + 40, y: dog.y, t: 0 }); }, freeze: () => { freezeT = 4.5; },
      secureAll: () => { sheep.forEach(s => { if (s.state !== "secured" && state === "playing") { s.x = PEN.x + 60; s.y = PEN.y + 90; secure(s); } }); render(); return snap(); },
      render, setState: s => { state = s; }, map: () => mapScreen(), title: () => titleScreen()
    };
  }
})();
