"use strict";
/* Sanxe Games — portada. Todo el arte se dibuja en canvas con la misma paleta que King Kongestion. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pad = (n, l) => String(Math.floor(n)).padStart(l, "0");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
  const store = { get: k => safe(() => localStorage.getItem(k)), set: (k, v) => safe(() => localStorage.setItem(k, v)) };
  const sstore = { get: k => safe(() => sessionStorage.getItem(k)), set: (k, v) => safe(() => sessionStorage.setItem(k, v)) };
  const DEBUG = /[?&]debug\b/.test(location.search), hooks = DEBUG ? (window.__sg = {}) : null;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];


  /* Tildes en mayúsculas de la fuente pixel (ver .ac en home.css); el texto original queda para lectores de pantalla */
  const ACC = { "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ñ": "N", "Ü": "U" }, ACC_RE = /[ÁÉÍÓÚÑÜ]/;
  function fixAccents(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
    while (walker.nextNode()) if (ACC_RE.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    for (const n of nodes) {
      const p = n.parentElement;
      if (!p || p.closest(".sr-only,[aria-hidden='true'],script,style,.ac")) continue;
      if (!getComputedStyle(p).fontFamily.includes("Press Start")) continue;
      const text = n.nodeValue, sr = document.createElement("span"), vis = document.createElement("span");
      sr.className = "sr-only"; sr.textContent = text; vis.setAttribute("aria-hidden", "true");
      let buf = "";
      for (const ch of text) {
        if (ACC[ch]) { if (buf) { vis.append(buf); buf = ""; } const s = document.createElement("span"); s.className = "ac" + (ch === "Ñ" ? " n" : ch === "Ü" ? " u" : ""); s.textContent = ACC[ch]; vis.append(s); }
        else buf += ch;
      }
      if (buf) vis.append(buf);
      n.replaceWith(sr, vis);
    }
  }

  /* ---------------------------------------------------------------- audio */
  let soundOn = store.get("sg-sound") !== "0", actx = null;
  function audio() {
    if (!actx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; actx = new A(); }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(freq, dur, type = "square", vol = .05, delay = 0) {
    if (!soundOn) return;
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  const sfx = {
    coin() { tone(988, .08, "square", .06); tone(1319, .35, "square", .06, .08); },
    vote() { tone(440, .05, "square", .05); tone(587, .09, "square", .05, .05); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .14, "square", .05, i * .09)); },
    go() { tone(660, .06, "square", .05); tone(880, .12, "square", .05, .06); }
  };
  const soundBtn = $("#sound"), soundLabel = $("#sound-s");
  function paintSound() { soundLabel.textContent = soundOn ? "SÍ" : "NO"; soundBtn.setAttribute("aria-pressed", String(soundOn)); fixAccents(soundLabel); }
  paintSound();
  soundBtn.addEventListener("click", () => { soundOn = !soundOn; store.set("sg-sound", soundOn ? "1" : "0"); paintSound(); if (soundOn) sfx.vote(); });

  /* ------------------------------------------------------------------ HUD */
  const hudCredits = $("#hud-credits"), hudScore = $("#hud-score");
  let credits = 0, bonus = 0;
  const updateScore = () => { hudScore.textContent = pad(Math.min(999999, window.scrollY * 2.5 + bonus), 6); };
  addEventListener("scroll", updateScore, { passive: true });
  let toastT;
  function toast(msg, ms = 2800) {
    const el = $("#toast"); el.textContent = msg; fixAccents(el); el.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), ms);
  }

  /* ----------------------------------------------------- botón de la ficha */
  $("#coin").addEventListener("click", e => {
    const b = e.currentTarget, r = b.getBoundingClientRect();
    credits = Math.min(99, credits + 1); bonus += 1000;
    hudCredits.textContent = pad(credits, 2); updateScore(); sfx.coin();
    const c = document.createElement("div"); c.className = "coin";
    c.style.left = (r.left + r.width / 2 - 13) + "px"; c.style.top = (r.top - 24) + "px";
    document.body.appendChild(c); setTimeout(() => c.remove(), 800);
    b.classList.add("pressed"); setTimeout(() => b.classList.remove("pressed"), 160);
    toast(credits === 1 ? "+1 CRÉDITO · ELIGE TU VILLANO" : `+1 CRÉDITO · TOTAL ${credits} (NO REEMBOLSABLE)`);
    if (window.scrollY < innerHeight * .6) setTimeout(() => $("#juegos").scrollIntoView({ behavior: reduced ? "auto" : "smooth" }), 750);
  });
  $$("#play, .screen").forEach(a => a.addEventListener("click", () => {
    sfx.go();
    if (credits > 0) { credits--; hudCredits.textContent = pad(credits, 2); }
  }));

  /* -------------------------------------------------------------- arranque */
  const bootDone = new Promise(resolve => {
    const el = $("#boot");
    if (!el || reduced || sstore.get("sg-boot")) { el && el.remove(); resolve(); return; }
    sstore.set("sg-boot", "1");
    document.body.style.overflow = "hidden";
    const out = $("#boot-lines");
    const lines = ["SANXE-OS v1.0  (C) 2026", "COMPROBANDO MEMORIA........ OK", "CARGANDO PROMESAS ELECTORALES", "  0% EJECUTADAS", "BUSCANDO PRESUPUESTO........ NO", "CALIBRANDO BARRILES......... OK", "CULPAR AL GOBIERNO ANTERIOR. ON", "", "> INSERTE FICHA_"];
    let i = 0, finished = false;
    const finish = () => {
      if (finished) return; finished = true; clearInterval(iv);
      el.classList.add("off"); document.body.style.overflow = "";
      setTimeout(() => { el.remove(); resolve(); }, 520);
    };
    const iv = setInterval(() => {
      if (i < lines.length) { out.appendChild(Object.assign(document.createElement("div"), { textContent: lines[i++] || " " })); }
      else setTimeout(finish, 280);
    }, 125);
    el.addEventListener("click", finish);
    addEventListener("keydown", finish, { once: true });
  });

  /* ------------------------------------------------------------ tagline */
  function typeTagline() {
    const el = $("#tagline"); if (!el) return;
    const full = el.dataset.full;
    if (reduced) return;
    const parts = [["Los políticos nunca dimiten. En nuestros juegos, al menos, ", ""], ["pierden vidas.", "em"]];
    el.innerHTML = `<span class="sr-only">${full}</span><span aria-hidden="true"></span><i class="caret" aria-hidden="true"></i>`;
    const holder = el.children[1], caret = el.children[2];
    let p = 0, c = 0, node = null;
    const next = () => {
      if (p >= parts.length) return;
      if (c === 0) { node = parts[p][1] ? document.createElement(parts[p][1]) : document.createElement("span"); holder.appendChild(node); }
      node.textContent = parts[p][0].slice(0, ++c);
      if (c >= parts[p][0].length) { p++; c = 0; }
      if (p < parts.length) setTimeout(next, 26 + (Math.random() < .12 ? 90 : 0)); else setTimeout(() => caret.remove(), 2600);
    };
    setTimeout(next, 650);
  }

  /* ------------------------------------------------------------- reveals */
  function reveals() {
    const els = $$(".reveal");
    $$(".locked, .man").forEach((el, i) => { el.style.transitionDelay = ((i % 3) * 140) + "ms"; });
    if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
    els.forEach(e => io.observe(e));
  }

  /* --------------------------------------------------------------- sondeo */
  function poll() {
    const box = $("#poll"); if (!box) return;
    const rows = $$(".row", box), totalEl = $("#poll-total");
    const state = rows.map(r => {
      const v = r.querySelector(".v"), wrap = document.createElement("div");
      wrap.className = "vwrap"; v.replaceWith(wrap); wrap.appendChild(v);
      const btn = Object.assign(document.createElement("button"), { type: "button", className: "vote", textContent: "VOTAR" });
      btn.setAttribute("aria-label", "Votar por " + r.querySelector(".lb").textContent);
      wrap.appendChild(btn);
      return { r, v, btn, fill: r.querySelector(".fill"), val: 0, target: +r.dataset.v };
    });
    const paint = () => {
      let tot = 0;
      for (const s of state) { s.v.textContent = Math.round(s.val) + "%"; s.fill.style.width = clamp(s.val, 0, 100) + "%"; tot += s.val; }
      totalEl.textContent = Math.round(tot) + "%"; totalEl.classList.toggle("over", tot > 100);
    };
    let told = false, over100 = false, ready = false;
    const run = () => {
      const t0 = performance.now(), dur = reduced ? 1 : 1200;
      const step = now => {
        const k = clamp((now - t0) / dur, 0, 1);
        state.forEach(s => { s.val = Math.round(s.target * k); }); paint();
        if (k < 1) requestAnimationFrame(step); else ready = true;
      };
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); run(); } }, { threshold: .35 });
      io.observe(box);
    } else run();
    state.forEach(s => s.btn.addEventListener("click", () => {
      if (!ready) return;
      s.target = s.val = Math.min(999, s.val + 1); paint(); sfx.vote(); bonus += 50; updateScore();
      const tot = state.reduce((a, b) => a + b.val, 0);
      if (!told && tot > 100) { told = true; toast("LA SUMA SUPERA EL 100%: COMO EN LAS ENCUESTAS DE VERDAD"); }
      if (!over100 && s.val > 100) { over100 = true; toast("¡LA CULPA SUPERA EL 100%! RESULTADO OFICIAL"); }
    }));
  }

  /* ---------------------------------------------------- recursos gráficos */
  const barrelImgs = [1, 2, 3, 4].map(i => { const im = new Image(); im.src = `king-kongestion/assets/boss-anim/barrelroll_${i}.png`; return im; });
  function drawBarrel(g, x, bottom, size, spin) {
    const im = barrelImgs[Math.floor(Math.abs(spin) / 7) % 4];
    if (im.complete && im.naturalWidth) g.drawImage(im, Math.round(x - size / 2), Math.round(bottom - size), size, size);
    else { g.fillStyle = "#a85a31"; g.fillRect(Math.round(x - size / 2), Math.round(bottom - size), size, size); }
  }
  function commuterSprites(scale = 1) {
    const C = window.COMMUTER; if (!C) return null;
    const mk = rows => {
      const c = document.createElement("canvas"); c.width = 16 * scale; c.height = 20 * scale;
      const g = c.getContext("2d");
      rows.forEach((l, y) => { for (let x = 0; x < 16; x++) { const k = l[x]; if (k !== ".") { g.fillStyle = C.pal[k]; g.fillRect(x * scale, y * scale, scale, scale); } } });
      return c;
    };
    return { run: C.run.map(mk), jump: C.jump.map(mk), climb: C.climb.map(mk), idle: C.idle.map(mk) };
  }
  function drawSprite(g, spr, cx, bottom, flip, scale = 1) {
    g.save(); g.translate(Math.round(cx), Math.round(bottom - 20 * scale)); if (flip) g.scale(-1, 1);
    g.drawImage(spr, -8 * scale, 0); g.restore();
  }
  function girder(g, x, y, w) {
    g.fillStyle = "#d9465b"; g.fillRect(x, y, w, 8);
    g.fillStyle = "#ff7384"; g.fillRect(x, y, w, 1);
    g.fillStyle = "#7a1f31"; g.fillRect(x, y + 7, w, 1);
    g.fillStyle = "#ffd34e";
    for (let dx = x + 3; dx < x + w - 6; dx += 14) g.fillRect(dx, y + 3, 8, 2);
  }
  function ladder(g, x, y1, y2, w = 14) {
    g.fillStyle = "#31d7c7"; g.fillRect(x, y1, 2, y2 - y1); g.fillRect(x + w - 2, y1, 2, y2 - y1);
    for (let y = y1 + 3; y < y2 - 1; y += 5) g.fillRect(x, y, w, 1);
  }

  /* ------------------------------------------------------------- escena hero */
  function initHero() {
    const cv = $("#hero-canvas"); if (!cv) return;
    const hero = cv.parentElement, g = cv.getContext("2d");
    const spr = commuterSprites(1);
    const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    let S = 3, W = 0, H = 0, L = {}, stat = null, stars = [], wins = [], barrels = [], ballots = [];
    let trainX = 0, trainWait = 2.5, trainDir = -1, barrelClock = .5, cm = null, t = 0, last = 0, running = false, visible = true;

    function build() {
      stat = document.createElement("canvas"); stat.width = W; stat.height = H;
      const s = stat.getContext("2d");
      // cielo con tramado ordenado (dithering), de noche cerrada a resplandor de ciudad
      const cols = ["#060a17", "#0a1022", "#0f1936", "#162349", "#223468", "#35508f", "#5a4a85"].map(hex);
      const id = s.createImageData(W, H), d = id.data;
      for (let y = 0; y < H; y++) {
        const tt = clamp(y / L.base, 0, 1) * (cols.length - 1), i = Math.min(cols.length - 2, Math.floor(tt)), f = tt - i;
        for (let x = 0; x < W; x++) {
          const c = f > (bayer[y & 3][x & 3] + .5) / 16 ? cols[i + 1] : cols[i], o = (y * W + x) * 4;
          d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
      }
      s.putImageData(id, 0, 0);
      // luna
      const mx = Math.round(Math.max(26, W * .13)), my = Math.round(H * .17), r = 11;
      s.fillStyle = "rgba(247,240,213,.12)";
      for (let y = -r - 9; y <= r + 9; y++) for (let x = -r - 9; x <= r + 9; x++) { const dd = Math.hypot(x, y); if (dd > r && dd < r + 9 && ((x + y) & 1) === 0) s.fillRect(mx + x, my + y, 1, 1); }
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.hypot(x, y) <= r) { s.fillStyle = "#f7f0d5"; s.fillRect(mx + x, my + y, 1, 1); }
      s.fillStyle = "#d4cdb0"; [[-4, -3, 3], [3, 2, 2], [-2, 5, 2], [5, -5, 1]].forEach(([cx, cy, cr]) => { for (let y = -cr; y <= cr; y++) for (let x = -cr; x <= cr; x++) if (Math.hypot(x, y) <= cr) s.fillRect(mx + cx + x, my + cy + y, 1, 1); });
      // horizonte
      wins = [];
      let x = -4;
      while (x < W) {
        const w = Math.round(rnd(9, 22)), h = Math.round(rnd(.1, .27) * H), y = L.base - h;
        s.fillStyle = "#0c1430"; s.fillRect(x, y, w, h);
        s.fillStyle = "#1a2548"; s.fillRect(x, y, w, 1);
        if (Math.random() < .25) { s.fillStyle = "#0c1430"; s.fillRect(x + (w >> 1), y - 6, 1, 6); }
        for (let wy = y + 3; wy < L.base - 3; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (Math.random() < .5) wins.push({ x: wx, y: wy, on: Math.random() < .6, c: Math.random() < .8 ? "#ffd34e" : "#31d7c7" });
        x += w + Math.round(rnd(0, 3));
      }
      palace(s);
      // talud, vía y vigas del primer plano
      s.fillStyle = "#070b18"; s.fillRect(0, L.base, W, H - L.base);
      s.fillStyle = "#0f1733"; s.fillRect(0, L.track + 1, W, 3);
      s.fillStyle = "#3b4a7a"; s.fillRect(0, L.track, W, 1);
      s.fillStyle = "#1b2648"; for (let sx = 0; sx < W; sx += 4) s.fillRect(sx, L.track + 1, 2, 1);
      s.fillStyle = "#17213c";
      for (let px = 20; px < W; px += 52) { s.fillRect(px, L.P1 + 8, 3, L.P2 - L.P1 - 8); s.fillRect(px + 26, L.P2 + 8, 3, H - L.P2 - 8); }
      girder(s, L.endP1 - 6, L.P1, W - L.endP1 + 6);
      girder(s, 0, L.P2, L.endP2);
      ladder(s, Math.round(W - 52), L.P1 + 8, L.P2);
    }

    function palace(s) {
      const pw = Math.round(clamp(W * .34, 64, 132)), cx = Math.round(W > 260 ? W * .77 : W * .6), base = L.base, x0 = cx - (pw >> 1);
      const body = "#18224a", dark = "#0f1733", lite = "#2b3b78", bh = 22, pedH = 10;
      s.fillStyle = body; s.fillRect(x0, base - bh, pw, bh);
      s.fillStyle = lite; s.fillRect(x0, base - bh, pw, 1);
      for (let x = x0 + 4; x < x0 + pw - 4; x += 6) { s.fillStyle = lite; s.fillRect(x, base - bh + 3, 2, bh - 5); s.fillStyle = dark; s.fillRect(x + 2, base - bh + 3, 1, bh - 5); }
      s.fillStyle = dark; s.fillRect(x0 - 3, base - 2, pw + 6, 2);
      const pedW = Math.round(pw * .5);
      for (let i = 0; i < pedH; i++) { const ww = Math.max(2, Math.round(pedW * (1 - i / pedH))); s.fillStyle = i === pedH - 1 ? lite : body; s.fillRect(cx - (ww >> 1), base - bh - 1 - (pedH - 1 - i), ww, 1); }
      const dr = Math.round(pw * .2), drumTop = base - bh - pedH - 2, dh = Math.round(dr * 1.05);
      s.fillStyle = body; s.fillRect(cx - dr, drumTop, dr * 2, 9);
      s.fillStyle = "#ffd34e"; for (let x = cx - dr + 3; x < cx + dr - 2; x += 5) s.fillRect(x, drumTop + 3, 2, 3);
      for (let i = 0; i < dh; i++) {
        const half = Math.round(dr * Math.sqrt(1 - (i / dh) ** 2)), yy = drumTop - 1 - i;
        s.fillStyle = body; s.fillRect(cx - half, yy, half * 2, 1);
        s.fillStyle = lite; s.fillRect(cx - half, yy, 1, 1);
      }
      const top = drumTop - dh;
      s.fillStyle = lite; s.fillRect(cx - 2, top - 5, 4, 5);
      s.fillStyle = "#c9d2e8"; s.fillRect(cx, top - 16, 1, 11);
      L.flag = { x: cx + 1, y: top - 16 }; L.dome = { x: cx, y: top - 5 };
      wins = wins.filter(w => !(w.x >= x0 - 3 && w.x <= x0 + pw + 3 && w.y >= base - bh - pedH - 4) && !(w.x >= cx - dr - 1 && w.x <= cx + dr + 1 && w.y >= top - 6));
    }

    function resize() {
      const cw = hero.clientWidth, ch = hero.clientHeight;
      S = clamp(Math.round(ch / 260), 3, 5);
      W = Math.ceil(cw / S) + 2; H = Math.ceil(ch / S) + 2;
      cv.width = W; cv.height = H; cv.style.width = W * S + "px"; cv.style.height = H * S + "px";
      L = { P2: H - 14, P1: H - 46 };
      L.track = L.P1 - 22; L.base = L.track - 6; L.endP1 = Math.round(clamp(W * .12, 22, 60)); L.endP2 = W - 24;
      stars = Array.from({ length: Math.round(W * H / 700) }, () => ({ x: rnd(0, W) | 0, y: rnd(0, H * .3) | 0, p: rnd(0, 6.28), s: rnd(.6, 2) }));
      ballots = Array.from({ length: clamp(Math.round(W / 22), 8, 22) }, () => ({ x: rnd(0, W), y: rnd(0, H), vx: rnd(-6, 6), vy: rnd(7, 16), r: rnd(0, 6), c: Math.random() < .2 ? "#ffd34e" : "#f7f0d5" }));
      barrels = []; barrelClock = .3; trainX = W + 20; trainWait = rnd(1.5, 4);
      cm = { x: W * .35, dir: 1, yOff: 0, vy: 0, air: false, t: 0, sp: 40 };
      build();
      draw();
    }

    function stepBarrels(dt) {
      barrelClock -= dt;
      if (barrelClock <= 0) { barrels.push({ x: W + 8, y: L.P1, vx: -48, vy: 0, ph: "p1", spin: 0 }); barrelClock = rnd(1.7, 2.9); }
      for (const b of barrels) {
        if (b.ph === "p1") { b.x += b.vx * dt; b.spin += Math.abs(b.vx) * dt; if (b.x < L.endP1) { b.ph = "f1"; b.vy = 0; } }
        else if (b.ph === "f1") { b.vy += 520 * dt; b.y += b.vy * dt; b.x -= 14 * dt; if (b.y >= L.P2) { b.y = L.P2; b.ph = "p2"; b.vx = 48; } }
        else if (b.ph === "p2") { b.x += b.vx * dt; b.spin += b.vx * dt; if (b.x > L.endP2) { b.ph = "f2"; b.vy = 0; } }
        else { b.vy += 520 * dt; b.y += b.vy * dt; b.x += 14 * dt; if (b.y > H + 16) b.dead = true; }
      }
      barrels = barrels.filter(b => !b.dead);
    }
    function stepCommuter(dt) {
      cm.t += dt;
      if (!cm.air) {
        for (const b of barrels) {
          if (b.ph !== "p2") continue;
          const dx = b.x - cm.x, closing = dx * (cm.dir * cm.sp - b.vx) > 0;
          if (closing && Math.abs(dx) < 17 + Math.abs(b.vx - cm.dir * cm.sp) * .2) { cm.vy = -185; cm.air = true; break; }
        }
      }
      if (cm.air) { cm.yOff += cm.vy * dt; cm.vy += 640 * dt; if (cm.yOff >= 0) { cm.yOff = 0; cm.air = false; cm.vy = 0; } }
      cm.x += cm.dir * cm.sp * dt;
      if (cm.x > W - 40) { cm.x = W - 40; cm.dir = -1; } else if (cm.x < 12) { cm.x = 12; cm.dir = 1; }
    }
    function update(dt) {
      t += dt; stepBarrels(dt); stepCommuter(dt);
      if (trainWait > 0) { trainWait -= dt; if (trainWait <= 0) { trainDir = Math.random() < .5 ? -1 : 1; trainX = trainDir < 0 ? W + 6 : -(trainLen() + 6); } }
      else { trainX += trainDir * 78 * dt; if ((trainDir < 0 && trainX < -trainLen() - 8) || (trainDir > 0 && trainX > W + 8)) trainWait = rnd(4, 8); }
      if (Math.random() < .08 && wins.length) { const w = wins[(Math.random() * wins.length) | 0]; w.on = !w.on; }
      for (const b of ballots) { b.x += (b.vx + Math.sin(t * 1.3 + b.r) * 5) * dt; b.y += b.vy * dt; b.r += dt * 4; if (b.y > H + 4) { b.y = -4; b.x = rnd(0, W); } }
    }
    const trainLen = () => 4 * 40 + 6;
    function drawTrain() {
      if (trainWait > 0) return;
      const y = L.track - 17, dir = trainDir;
      for (let i = 0; i < 4; i++) {
        const cx = Math.round(trainX + i * 40), head = (dir < 0 ? i === 0 : i === 3);
        g.fillStyle = "#c9d2e8"; g.fillRect(cx, y, 38, 16);
        g.fillStyle = "#8d98b8"; g.fillRect(cx, y, 38, 2);
        g.fillStyle = "#31d7c7"; g.fillRect(cx, y + 11, 38, 2);
        g.fillStyle = "#050814"; g.fillRect(cx + 3, y + 16, 5, 1); g.fillRect(cx + 30, y + 16, 5, 1);
        for (let k = 0; k < 5; k++) { g.fillStyle = "#101629"; g.fillRect(cx + 3 + k * 7, y + 4, 5, 5); g.fillStyle = (k + i) % 3 ? "#ffd34e" : "#c9a63a"; g.fillRect(cx + 4 + k * 7, y + 5, 3, 3); }
        if (head) {
          const hx = dir < 0 ? cx : cx + 36;
          g.fillStyle = "#fff6b0"; g.fillRect(hx, y + 9, 2, 3);
          g.save(); g.globalCompositeOperation = "lighter"; g.fillStyle = "rgba(255,246,176,.09)";
          g.beginPath(); g.moveTo(hx + (dir < 0 ? 0 : 2), y + 10); g.lineTo(hx + dir * 90, y + 3); g.lineTo(hx + dir * 90, y + 22); g.closePath(); g.fill(); g.restore();
        }
      }
    }
    function drawFlag() {
      const f = L.flag; if (!f) return; const cols = ["#ff4d61", "#ff4d61", "#ffd34e", "#ffd34e", "#31d7c7", "#31d7c7", "#3cff7a", "#3cff7a", "#8fa8ff"];
      cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(f.x + i, f.y + Math.round(Math.sin(t * 5 + i * .7) * 1.4), 1, 5); });
    }
    function drawBeams() {
      const o = L.dome; if (!o) return;
      g.save(); g.globalCompositeOperation = "lighter";
      [[0, .55], [2.1, .43]].forEach(([ph, sp]) => {
        const a = -Math.PI / 2 + Math.sin(t * sp + ph) * .75, len = H * 1.2, sp2 = .05;
        g.fillStyle = "rgba(255,243,176,.075)"; g.beginPath(); g.moveTo(o.x, o.y);
        g.lineTo(o.x + Math.cos(a - sp2) * len, o.y + Math.sin(a - sp2) * len); g.lineTo(o.x + Math.cos(a + sp2) * len, o.y + Math.sin(a + sp2) * len);
        g.closePath(); g.fill();
      });
      g.restore();
    }
    function draw() {
      if (!stat) return;
      g.drawImage(stat, 0, 0);
      for (const s of stars) { const a = .35 + .65 * Math.abs(Math.sin(t * s.s + s.p)); g.fillStyle = `rgba(247,240,213,${a.toFixed(2)})`; g.fillRect(s.x, s.y, 1, 1); }
      for (const w of wins) if (w.on) { g.fillStyle = w.c; g.fillRect(w.x, w.y, 2, 2); }
      drawBeams(); drawFlag(); drawTrain();
      for (const b of barrels) drawBarrel(g, b.x, b.y, 14, b.spin);
      if (spr) { const c = cm; drawSprite(g, c.air ? spr.jump[0] : spr.run[Math.floor(c.t * 12) % 4], c.x, L.P2 + c.yOff, c.dir < 0); }
      for (const b of ballots) { const v = Math.floor(b.r) & 1; g.fillStyle = v ? b.c : "#b9b3a0"; g.fillRect(Math.round(b.x), Math.round(b.y), v ? 3 : 2, v ? 2 : 3); }
    }

    function frame(ts) {
      if (!running) return;
      const dt = clamp((ts - last) / 1000 || 0, 0, .05); last = ts;
      update(dt); draw(); requestAnimationFrame(frame);
    }
    function start() { if (running || reduced || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    function stop() { running = false; }

    resize();
    if (hooks) hooks.hero = (n, dt = .05) => { for (let i = 0; i < n; i++) update(dt); draw(); return { barrels: barrels.length, commuter: Math.round(cm.x), train: Math.round(trainX) }; };
    if (reduced) { for (let i = 0; i < 400; i++) update(.05); draw(); }
    let rt, lastW = hero.clientWidth, lastH = hero.clientHeight;
    const onResize = () => {
      if (hero.clientWidth === lastW && hero.clientHeight === lastH) return;
      lastW = hero.clientWidth; lastH = hero.clientHeight;
      clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduced) { for (let i = 0; i < 400; i++) update(.05); draw(); } }, 120);
    };
    if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(hero); else addEventListener("resize", onResize);
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
    start();
    if (!reduced && matchMedia("(pointer:fine)").matches) {
      hero.addEventListener("pointermove", e => {
        const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
        cv.style.setProperty("--mx", (-nx * 16).toFixed(1) + "px"); cv.style.setProperty("--my", (-ny * 9).toFixed(1) + "px");
      });
    }
  }

  /* ----------------------------------- máquina recreativa: modo demostración */
  function initAttract() {
    const cv = $("#attract"); if (!cv) return;
    const g = cv.getContext("2d"), W = cv.width, H = cv.height;
    g.imageSmoothingEnabled = false;
    const T = 96, P2 = 159, P1 = 222, G = 282, TR_X = 375, DOOR = 430;
    const FRAME_SCALE = { idle_1: 1.015, idle_2: 1.002, idle_3: .975, idle_4: 1.009, pickup_1: 1.093, pickup_2: 1.068, pickup_3: 1.081, lift_1: .887, lift_2: .848, lift_3: .81, throw_1: .836, throw_2: .86, recovery_1: .886, recovery_2: .901, recovery_3: .912 };
    const FEET_X = { idle_1: 95, idle_2: 100, idle_3: 102, idle_4: 99, pickup_1: 88, pickup_2: 98, pickup_3: 73, lift_1: 88, lift_2: 93, lift_3: 94, throw_1: 108, throw_2: 117, recovery_1: 110, recovery_2: 115, recovery_3: 117 };
    const ANIM = {
      idle: { f: ["idle_1", "idle_2", "idle_3", "idle_4"], d: .22, loop: true },
      pickup: { f: ["pickup_1", "pickup_2", "pickup_3"], d: .12, next: "lift" },
      lift: { f: ["lift_1", "lift_2", "lift_3"], d: .12, next: "throw" },
      throw: { f: ["throw_1", "throw_2"], d: .11, next: "recovery" },
      recovery: { f: ["recovery_1", "recovery_2", "recovery_3"], d: .15, next: "idle" }
    };
    const imgs = {};
    Object.values(ANIM).forEach(a => a.f.forEach(n => { const im = new Image(); im.src = `king-kongestion/assets/boss-anim/${n}.png`; imgs[n] = im; }));
    const spr = commuterSprites(2);
    const APE_X = 92, APE_SCALE = .46;
    let stat = null, ape = { s: "idle", i: 0, t: 0, wait: 1.4 }, barrels = [], cm, popT = 0, t = 0, last = 0, running = false, visible = true;
    const FONT = '8px "Press Start 2P", monospace';

    function build() {
      stat = document.createElement("canvas"); stat.width = W; stat.height = H;
      const s = stat.getContext("2d");
      const grad = s.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "#0b1021"); grad.addColorStop(1, "#16204a");
      s.fillStyle = grad; s.fillRect(0, 0, W, H);
      for (let i = 0; i < 40; i++) { s.fillStyle = i % 4 ? "#263257" : "#31d7c7"; s.fillRect((i * 173) % W, (i * 79) % (T - 30), 2, 2); }
      s.fillStyle = "#17213c"; for (let x = 24; x < W; x += 90) s.fillRect(x, 120, 8, H - 120);
      s.strokeStyle = "#27345b"; s.lineWidth = 3;
      for (let x = 24; x < W; x += 90) for (let y = 126; y < G - 40; y += 63) { s.beginPath(); s.moveTo(x, y); s.lineTo(x + 66, y + 54); s.moveTo(x + 66, y); s.lineTo(x, y + 54); s.stroke(); }
      const gd = (x, y, w) => { s.fillStyle = "#d9465b"; s.fillRect(x, y, w, 9); s.fillStyle = "#ff7384"; s.fillRect(x, y, w, 1); s.fillStyle = "#7a1f31"; s.fillRect(x, y + 8, w, 1); s.fillStyle = "#ffd34e"; for (let dx = x + 4; dx < x + w - 8; dx += 20) s.fillRect(dx, y + 4, 11, 3); };
      gd(12, T, 354); gd(TR_X, T, 99); gd(12, P2, 432); gd(8, P1, 460); gd(0, G, W);
      const ld = (x, y1, y2) => { s.fillStyle = "#31d7c7"; s.fillRect(x, y1, 3, y2 - y1); s.fillRect(x + 21, y1, 3, y2 - y1); for (let y = y1 + 5; y < y2; y += 10) s.fillRect(x, y, 24, 3); };
      ld(432 - 12, P1 + 9, G); ld(60 - 12, P2 + 9, P1); ld(402 - 12, T + 9, P2);
      // cartel de andén
      s.font = FONT; s.textAlign = "center";
      s.fillStyle = "#1b3a8a"; s.fillRect(16, T + 11, 74, 14); s.fillStyle = "#6fa0ff"; s.fillRect(16, T + 11, 74, 2); s.fillStyle = "#f7f0d5"; s.fillText("ANDÉN 6", 53, T + 22);
      // tren de la vía 6
      const tx = TR_X, ty = T - 36;
      s.fillStyle = "#101629"; s.fillRect(tx, T - 6, 99, 6);
      s.fillStyle = "#c9d2e8"; s.fillRect(tx, ty, 90, 30); s.fillRect(tx + 90, ty + 12, 9, 18);
      s.fillStyle = "#8d98b8"; s.fillRect(tx, ty, 90, 5); s.fillStyle = "#31d7c7"; s.fillRect(tx, ty + 22, 99, 5);
      [tx + 8, tx + 52, tx + 72].forEach(x => { s.fillStyle = "#101629"; s.fillRect(x, ty + 9, 22, 12); s.fillStyle = "#31d7c7"; s.fillRect(x + 2, ty + 11, 18, 3); });
      s.fillStyle = "#0e8f86"; s.fillRect(DOOR - 12, ty + 8, 26, 22); s.fillStyle = "#ffd34e"; s.fillRect(DOOR - 9, ty + 11, 20, 19);
      s.fillStyle = "#101629"; s.fillRect(DOOR, ty + 11, 2, 19);
      s.fillStyle = "#31d7c7"; s.fillText("VÍA 6", DOOR, ty - 5);
      s.fillStyle = "#d9465b"; s.fillRect(tx + 4, ty + 5, 8, 4);
    }
    function reset() { cm = { st: "run", plat: "G", x: -14, dir: 1, y: G, yOff: 0, vy: 0, air: false, t: 0, sp: 58, climbT: 0 }; }
    reset();

    const floorOf = p => ({ G, P1, P2, T })[p];
    function spawnBarrel() { barrels.push({ x: APE_X + 50, y: T, vx: 80, vy: 0, ph: "T", spin: 0 }); }
    function stepApe(dt) {
      const a = ANIM[ape.s];
      if (ape.s === "idle") { ape.wait -= dt; if (ape.wait <= 0) { ape.s = "pickup"; ape.i = 0; ape.t = 0; } }
      ape.t += dt;
      if (ape.t >= a.d) {
        ape.t -= a.d; ape.i++;
        if (ape.s === "throw" && ape.i === 1) spawnBarrel();
        if (ape.i >= a.f.length) {
          if (a.loop) ape.i = 0;
          else { ape.s = a.next; ape.i = 0; if (ape.s === "idle") ape.wait = rnd(1.2, 2.4); }
        }
      }
    }
    function stepBarrels(dt) {
      for (const b of barrels) {
        if (b.ph === "T") { b.x += b.vx * dt; b.spin += 80 * dt; if (b.x > 364) { b.ph = "fT"; b.vy = 0; } }
        else if (b.ph === "fT") { b.vy += 900 * dt; b.y += b.vy * dt; b.x += 22 * dt; if (b.y >= P2) { b.y = P2; b.ph = "P2"; b.vx = -80; } }
        else if (b.ph === "P2") { b.x += b.vx * dt; b.spin += 80 * dt; if (b.x < 14) { b.ph = "f2"; b.vy = 0; } }
        else if (b.ph === "f2") { b.vy += 900 * dt; b.y += b.vy * dt; b.x += 30 * dt; if (b.y >= P1) { b.y = P1; b.ph = "P1"; b.vx = 80; } }
        else if (b.ph === "P1") { b.x += b.vx * dt; b.spin += 80 * dt; if (b.x > 466) { b.ph = "f1"; b.vy = 0; } }
        else if (b.ph === "f1") { b.vy += 900 * dt; b.y += b.vy * dt; b.x += 12 * dt; if (b.y >= G) { b.y = G; b.ph = "G"; b.vx = -80; } }
        else if (b.ph === "G") { b.x += b.vx * dt; b.spin += 80 * dt; if (b.x < -30) b.dead = true; }
      }
      barrels = barrels.filter(b => !b.dead);
    }
    const ROUTE = { G: { dir: 1, ladX: 432, up: "P1" }, P1: { dir: -1, ladX: 60, up: "P2" }, P2: { dir: 1, ladX: 402, up: "T" } };
    function stepCommuter(dt) {
      const c = cm; c.t += dt;
      if (popT > 0) popT -= dt;
      if (c.st === "win") { c.winT -= dt; if (c.winT <= 0) reset(); return; }
      if (c.st === "climb") {
        c.y -= 38 * dt; c.climbT += dt;
        if (c.y <= floorOf(c.up)) { c.y = floorOf(c.up); c.plat = c.up; c.st = "run"; c.dir = ROUTE[c.plat] ? ROUTE[c.plat].dir : 1; }
        return;
      }
      if (!c.air) {
        for (const b of barrels) {
          if (b.ph !== c.plat) continue;
          const dx = b.x - c.x, closing = dx * (c.dir * c.sp - b.vx) > 0;
          if (closing && Math.abs(dx) < 26 + Math.abs(b.vx - c.dir * c.sp) * .22) { c.vy = -255; c.air = true; break; }
        }
      }
      if (c.air) { c.yOff += c.vy * dt; c.vy += 880 * dt; if (c.yOff >= 0) { c.yOff = 0; c.air = false; c.vy = 0; } }
      c.x += c.dir * c.sp * dt;
      if (c.plat === "T") { if (c.x >= DOOR) { c.st = "win"; c.winT = 1.7; popT = 1.7; } return; }
      const r = ROUTE[c.plat];
      if (!c.air && ((r.dir > 0 && c.x >= r.ladX) || (r.dir < 0 && c.x <= r.ladX))) { c.x = r.ladX; c.st = "climb"; c.up = r.up; c.climbT = 0; }
    }
    function drawApe() {
      const a = ANIM[ape.s], key = a.f[Math.min(ape.i, a.f.length - 1)], im = imgs[key];
      if (!(im && im.complete && im.naturalWidth)) return;
      const sc = APE_SCALE * (FRAME_SCALE[key] ?? 1), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
      const bob = ape.s === "idle" ? Math.sin(t * 2.4) * 2 : 0;
      g.drawImage(im, APE_X - (FEET_X[key] ?? im.naturalWidth / 2) * sc, T - h + bob, w, h);
    }
    function draw() {
      if (!stat) return;
      g.drawImage(stat, 0, 0);
      // luz del tren
      if (Math.floor(t * 2) % 2 === 0) { g.fillStyle = "#fff6b0"; g.fillRect(TR_X + 94, T - 22, 5, 7); }
      drawApe();
      for (const b of barrels) drawBarrel(g, b.x, b.y, 24, b.spin);
      const c = cm;
      if (spr && c.st !== "win") {
        let sp = c.st === "climb" ? spr.climb[Math.floor(c.climbT * 6) % 2] : c.air ? spr.jump[0] : spr.run[Math.floor(c.t * 12) % 4];
        drawSprite(g, sp, c.x, c.y + c.yOff, c.st === "climb" ? false : c.dir < 0, 2);
      }
      if (popT > 0) {
        const k = 1 - popT / 1.7;
        g.save(); g.font = FONT; g.textAlign = "center"; g.fillStyle = "#050814"; g.fillText("¡HAS COGIDO EL TREN!", 241, 146 - k * 6); g.fillText("+3000", DOOR + 1, T - 52 - k * 18);
        g.fillStyle = "#ffd34e"; g.fillText("¡HAS COGIDO EL TREN!", 240, 145 - k * 6); g.fillText("+3000", DOOR, T - 53 - k * 18); g.restore();
      }
    }
    function frame(ts) {
      if (!running) return;
      const dt = clamp((ts - last) / 1000 || 0, 0, .05); last = ts; t += dt;
      stepApe(dt); stepBarrels(dt); stepCommuter(dt); draw(); requestAnimationFrame(frame);
    }
    function start() { if (running || reduced || !visible || document.hidden) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    function stop() { running = false; }
    if (hooks) hooks.attract = (n, dt = .05) => { for (let i = 0; i < n; i++) { t += dt; stepApe(dt); stepBarrels(dt); stepCommuter(dt); } draw(); return { barrels: barrels.length, ape: ape.s, cm: cm.st + "@" + cm.plat + ":" + Math.round(cm.x) }; };
    const go = () => { build(); draw(); start(); };
    (document.fonts && document.fonts.load ? document.fonts.load(FONT).catch(() => {}) : Promise.resolve()).then(go);
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: .1 }).observe(cv);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  }

  /* ------------------------------------------------- siluetas y pictogramas */
  function silhouette(cv, kind) {
    const w = cv.width, h = cv.height, tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h;
    const g = tmp.getContext("2d"); g.fillStyle = "#000";
    const body = () => { g.beginPath(); g.moveTo(3, h); g.lineTo(6, 40); g.quadraticCurveTo(10, 34, 19, 33); g.lineTo(29, 33); g.quadraticCurveTo(38, 34, 42, 40); g.lineTo(45, h); g.closePath(); g.fill(); g.fillRect(20, 28, 8, 8); };
    const ell = (x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
    body();
    if (kind === "magnate") {
      ell(24, 21, 9, 11);
      g.beginPath(); g.moveTo(13, 19); g.lineTo(14, 9); g.lineTo(22, 3); g.lineTo(34, 4); g.lineTo(42, 9); g.lineTo(41, 13); g.lineTo(33, 9); g.lineTo(24, 12); g.lineTo(17, 19); g.closePath(); g.fill();
    } else if (kind === "tribuno") {
      ell(24, 19, 10, 9); ell(24, 29, 8, 7);
      g.fillRect(23, 33, 2, 12); g.beginPath(); g.arc(24, 32, 3, 0, 7); g.fill();
      g.fillRect(5, 44, 38, 12);
    } else { ell(24, 21, 9, 11); }
    const a = g.getImageData(0, 0, w, h).data, mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = a[i * 4 + 3] > 110 ? 1 : 0;
    const out = cv.getContext("2d"), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : mask[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!at(x, y)) continue;
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      out.fillStyle = edge ? "#31d7c7" : (y % 2 ? "#0a0f1f" : "#0d1427"); out.fillRect(x, y, 1, 1);
    }
    if (kind === "magnate") { out.fillStyle = "#ff4d61"; for (let y = 37; y < 55; y++) { const half = y < 40 ? 1 : y < 50 ? 2 : 1; out.fillRect(24 - half, y, half * 2 + 1, 1); } }
    if (kind === "tribuno") {
      // barba oscura, micrófono y atril con panel propio para que no se fundan con el cuerpo
      const ell2 = (cx, cy, rx, ry, c) => { out.fillStyle = c; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) out.fillRect(x, y, 1, 1); };
      ell2(24, 29, 7, 6, "#03050c");
      out.fillStyle = "#17213c"; out.fillRect(7, 45, 34, 10);
      out.fillStyle = "#31d7c7"; out.fillRect(7, 45, 34, 1); out.fillRect(7, 45, 1, 10); out.fillRect(40, 45, 1, 10);
      out.fillStyle = "#ffd34e"; out.fillRect(21, 48, 6, 4); out.fillStyle = "#ff4d61"; out.fillRect(23, 49, 2, 2);
      out.fillStyle = "#aab4d5"; out.fillRect(23, 36, 2, 9);
      out.fillStyle = "#f7f0d5"; out.fillRect(22, 33, 4, 4);
    }
    if (kind === "mystery") {
      const q = [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."];
      out.fillStyle = "#ffd34e"; q.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === "#") out.fillRect(22 + x, 15 + y, 1, 1); });
    }
  }
  function icon(cv, kind) {
    const g = cv.getContext("2d"), circ = (cx, cy, r, c) => { g.fillStyle = c; for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= r) g.fillRect(x, y, 1, 1); };
    if (kind === "mask") {
      circ(7, 7, 6.4, "#050814"); circ(7, 7, 5.4, "#ffd34e");
      g.fillStyle = "#050814"; g.fillRect(4, 4, 2, 3); g.fillRect(8, 4, 2, 3); g.fillRect(3, 8, 8, 1); g.fillRect(4, 9, 6, 1); g.fillRect(5, 10, 4, 1);
      g.fillStyle = "#ff4d61"; g.fillRect(5, 9, 4, 1);
    } else if (kind === "coin") {
      circ(7, 7, 6.4, "#050814"); circ(7, 7, 5.4, "#ffd34e"); circ(7, 7, 3.6, "#d9992a");
      g.fillStyle = "#ffd34e"; g.fillRect(6, 4, 2, 6);
      g.fillStyle = "#ff4d61"; for (let i = 0; i < 12; i++) { g.fillRect(1 + i, 1 + i, 2, 2); }
    } else {
      g.fillStyle = "#050814"; g.fillRect(2, 0, 10, 14); g.fillRect(1, 1, 12, 12);
      g.fillStyle = "#a85a31"; g.fillRect(2, 1, 10, 12);
      g.fillStyle = "#e19a4f"; g.fillRect(2, 3, 10, 2); g.fillRect(2, 9, 10, 2);
      g.fillStyle = "#71321f"; g.fillRect(6, 1, 2, 12);
    }
  }

  /* ------------------------------------------------------ código Konami */
  function rain() {
    const cv = $("#rain"); if (!cv || !cv.hidden) return;
    cv.hidden = false; const S = 3, W = Math.ceil(innerWidth / S), H = Math.ceil(innerHeight / S);
    cv.width = W; cv.height = H; const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    const list = Array.from({ length: clamp(Math.round(W / 6), 30, 80) }, () => ({ x: rnd(0, W), y: -rnd(10, H * 1.2), vy: rnd(40, 90), vx: rnd(-10, 10), spin: rnd(0, 20), r: 0 }));
    sfx.win(); bonus += 30000; updateScore();
    toast("¡CÓDIGO KONAMI! +30 VIDAS (NO VÁLIDAS EN POLÍTICA)", 4200);
    const t0 = performance.now(); let last = t0;
    const sim = dt => {
      g.clearRect(0, 0, W, H);
      for (const b of list) {
        b.vy += 420 * dt; b.y += b.vy * dt; b.x += b.vx * dt; b.spin += 60 * dt;
        if (b.y > H - 6 && b.vy > 0) { b.y = H - 6; b.vy *= -.45; }
        drawBarrel(g, b.x, b.y, 14, b.spin);
      }
    };
    if (hooks) hooks.rain = (n, dt = .05) => { for (let i = 0; i < n; i++) sim(dt); return list.filter(b => b.y > 0 && b.y < H + 20).length; };
    setTimeout(() => { cv.hidden = true; }, 5200);
    const step = now => {
      if (cv.hidden) return;
      const dt = clamp((now - last) / 1000 || 0, 0, .05); last = now;
      sim(dt);
      if (now - t0 < 4600) requestAnimationFrame(step); else { cv.hidden = true; }
    };
    requestAnimationFrame(step);
  }
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kpos = 0;
  addEventListener("keydown", e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = k === KONAMI[kpos] ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kpos === KONAMI.length) { kpos = 0; rain(); }
  });
  let logoClicks = 0, logoT;
  $(".logo-s")?.addEventListener("click", () => { logoClicks++; clearTimeout(logoT); logoT = setTimeout(() => logoClicks = 0, 1200); if (logoClicks >= 5) { logoClicks = 0; rain(); } });

  /* ---------------------------------------- miniatura de Pastor de socios */
  function initPastorThumb() {
    const cv = $("#pastor-thumb"), S = window.PS_SPR; if (!cv || !S) return;
    const g = cv.getContext("2d"), W = cv.width, H = cv.height; g.imageSmoothingEnabled = false;
    const [bg, b] = S.mk(W, H), R = (c, x, y, w, h) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
    const sky = b.createLinearGradient(0, 0, 0, 16); sky.addColorStop(0, "#2a1a4a"); sky.addColorStop(1, "#ff9a6b"); b.fillStyle = sky; b.fillRect(0, 0, W, 16);
    for (let x = 0, i = 0; x < W; i++) { const bw = 6 + (i * 5) % 7, bh = 3 + (i * 7) % 6; R("#2b2150", x, 16 - bh, bw, bh); x += bw + 1; }
    for (let y = 16, k = 0; y < H; y += 8, k++) R(k % 2 ? "#34753f" : "#2f6b3a", 0, y, W, 8);
    R("#4a2e1b", 0, 14, W, 3); R("#c28a5a", 0, 14, W, 1); for (let x = 3; x < W; x += 12) { R("#4a2e1b", x, 11, 2, 8); R("#c28a5a", x, 11, 1, 2); }
    R("#6b5a2e", 72, 26, 24, 30); R("#4a2e1b", 71, 25, 26, 2); R("#4a2e1b", 71, 55, 26, 2); R("#4a2e1b", 71, 25, 2, 12); R("#4a2e1b", 71, 45, 2, 12);
    for (let i = 0; i < 40; i++) R(i % 4 ? "#2e6a50" : "#e8e8a0", (i * 37 + 5) % 68, 20 + (i * 23) % 50, 1, 2);
    const cols = ["#ff4d61", "#ffd34e", "#31d7c7", "#8fa8ff"], spots = [[24, 40], [44, 33], [38, 52], [60, 44]];
    let t = 0, last = 0, running = false;
    function draw() {
      g.drawImage(bg, 0, 0);
      const items = spots.map(([x, y], i) => ({ y, f: () => { const mode = Math.floor(t * .7 + i * 1.3) % 3 === 0 ? "graze" : "walk", spr = S.sheep(cols[i], mode, Math.floor(t * 3 + i) % 2), hop = Math.abs(Math.sin(t * 2 + i * 2)) > .96 ? 2 : 0; g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height + 4 - hop)); } }));
      const dx = ((t * 16) % 120) - 24, set = S.dog.run, ds = set[Math.floor(t * 9) % set.length];
      items.push({ y: 60, f: () => g.drawImage(ds, Math.round(dx - ds.width / 2), 60 - ds.height + 4) });
      items.sort((p, q) => p.y - q.y).forEach(i => i.f());
    }
    function frame(ts) { if (!running) return; t += Math.min(.05, Math.max(0, (ts - last) / 1000 || 0)); last = ts; draw(); requestAnimationFrame(frame); }
    function start() { if (running || reduced) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    t = 3; draw();
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { if (es[0].isIntersecting) start(); else running = false; }).observe(cv); else start();
    if (hooks) hooks.thumb = (n, dt = .05) => { for (let i = 0; i < n; i++) t += dt; draw(); return t; };
  }

  /* ------------------------------------------ miniatura de Flappy Falcon */
  function initFalconThumb() {
    const cv = $("#falcon-thumb"), S = window.PS_SPR; if (!cv || !S) return;
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, P = S.P; g.imageSmoothingEnabled = false;
    const [pc, pg] = S.mk(52, 30), R = (c, x, y, w, h) => { pg.fillStyle = c; pg.fillRect(x, y, w, h); };
    R("#8d98b8", 3, 4, 9, 2); R(P.cream, 6, 5, 4, 11); R(P.cream, 5, 6, 1, 3); R(P.cream, 8, 13, 6, 2); R(P.red2, 6, 6, 4, 2); R(P.gold, 6, 8, 4, 2); R(P.cyan, 6, 10, 4, 2);
    R(P.cream, 8, 15, 34, 8); R(P.cream, 42, 16, 4, 6); R(P.cream, 46, 17, 2, 4); R(P.cream, 48, 18, 1, 2); R(P.creamS, 8, 22, 34, 1); R(P.red2, 8, 19, 38, 1); R(P.gold, 8, 20, 38, 1); R(P.cyan, 8, 21, 36, 1);
    [12, 16, 20, 24].forEach(x => { R("#2b3b78", x, 17, 2, 2); R("#6fa0ff", x, 17, 1, 1); });
    R("#8d98b8", 5, 16, 5, 4); R("#3a4660", 4, 17, 1, 2); R("#aab4d5", 20, 23, 14, 2); R("#8d98b8", 16, 25, 16, 1); R("#6b7799", 14, 26, 10, 1); R("#ffd34e", 1, 17, 3, 3); R("#ff7a2e", 0, 18, 2, 1);
    pg.drawImage(S.dog.idle[0], 17, 0, 13, 12, 27, 3, 13, 12); R(P.ink, 30, 6, 5, 5); R(P.cyan, 31, 7, 3, 3); R("#fff", 31, 7, 1, 1); R(P.ink, 27, 8, 3, 1); R(P.red2, 26, 13, 4, 1); R(P.red, 22, 13, 5, 1); R(P.red, 20, 14, 3, 1);
    const plane = S.outlined(pc), [bg, b] = S.mk(W, H), B = (c, x, y, w, h) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
    const sky = b.createLinearGradient(0, 0, 0, 84); sky.addColorStop(0, "#2a1a4a"); sky.addColorStop(1, "#ff7a5a"); b.fillStyle = sky; b.fillRect(0, 0, W, 84);
    b.fillStyle = "#ffb06a"; b.beginPath(); b.arc(104, 34, 9, 0, 7); b.fill();
    for (let x = 0, i = 0; x < W; i++) { const bw = 8 + (i * 5) % 8, bh = 8 + (i * 7) % 18; B("#3a2a5e", x, 84 - bh, bw, bh); for (let wy = 84 - bh + 3; wy < 82; wy += 5) for (let wx = x + 2; wx < x + bw - 2; wx += 4) if ((wx + wy + i) % 5 < 2) B("#ffd34e", wx, wy, 2, 2); x += bw + 1; }
    B("#2b5a3a", 0, 84, W, 12); B("rgba(0,0,0,.2)", 0, 90, W, 6);
    let t = 0, last = 0, running = false;
    const cols = [{ x: 70, cy: 44 }, { x: 150, cy: 56 }];
    function column(x, cy) {
      const gap = 34, top = cy - gap / 2, bot = cy + gap / 2;
      for (let y = top - 12; y > -24; y -= 12) { S.disc(g, "#4a5578", x + 15, y + 2, 17, 13); S.disc(g, "#7885ad", x + 14, y, 16, 12); S.disc(g, "#a9b6d8", x + 10, y - 3, 10, 7); }
      for (let y = bot + 12; y < 108; y += 12) { S.disc(g, "#4a5578", x + 15, y + 2, 17, 13); S.disc(g, "#7885ad", x + 14, y, 16, 12); S.disc(g, "#a9b6d8", x + 10, y - 3, 10, 7); }
      g.fillStyle = "#f7f0d5"; g.fillRect(x + 4, top - 8, 24, 7); g.fillStyle = "#ff4d61"; g.fillRect(x + 4, top - 8, 24, 2); g.fillStyle = "#f7f0d5"; g.fillRect(x + 8, bot + 2, 24, 7); g.fillStyle = "#ff4d61"; g.fillRect(x + 8, bot + 2, 24, 2);
    }
    function draw() {
      g.drawImage(bg, 0, 0);
      cols.forEach((c, i) => { const x = ((c.x - t * 26) % 190 + 190) % 190 - 30; column(x, c.cy + Math.sin(t * 1.4 + i * 2) * 5); const vx = x + 62, vy = (i ? 46 : 52) + Math.sin(t * 2 + i) * 3; g.fillStyle = "#f7f0d5"; g.fillRect(Math.round(vx), Math.round(vy), 5, 6); g.fillStyle = "#ff4d61"; g.fillRect(Math.round(vx), Math.round(vy), 5, 1); });
      g.drawImage(plane, 20, Math.round(36 + Math.sin(t * 3) * 7));
    }
    function frame(ts) { if (!running) return; t += Math.min(.05, Math.max(0, (ts - last) / 1000 || 0)); last = ts; draw(); requestAnimationFrame(frame); }
    function start() { if (running || reduced) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    t = 1.2; draw();
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { if (es[0].isIntersecting) start(); else running = false; }).observe(cv); else start();
    if (hooks) hooks.falcon = (n, dt = .05) => { for (let i = 0; i < n; i++) t += dt; draw(); return t; };
  }

  /* ---------------------------------------- miniatura de Me gusta la fruta */
  function initFruitThumb() {
    const cv = $("#fruit-thumb"), S = window.MF_SPR; if (!cv || !S) return;
    const g = cv.getContext("2d"), W = cv.width, H = cv.height; g.imageSmoothingEnabled = false;
    const [bg, b] = S.mk(W, H), B = (c, x, y, w, h) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
    B("#3a2a3e", 0, 0, W, H); for (let y = 0; y < H; y += 10) for (let x = (y / 10 % 2) * 10; x < W; x += 20) B("#4b3550", x, y, 19, 9);
    const sky = b.createLinearGradient(0, 22, 0, 62); sky.addColorStop(0, "#ffcf8a"); sky.addColorStop(1, "#ff8a5a"); b.fillStyle = sky; b.fillRect(40, 22, 48, 40);
    for (let x = 40, i = 0; x < 88; i++) { const bw = 5 + (i * 3) % 5, bh = 6 + (i * 5) % 12; B("#4a3f78", x, 62 - bh, Math.min(bw, 88 - x), bh); x += bw + 1; }
    B("#2a1c14", 38, 20, 52, 2); B("#2a1c14", 38, 62, 52, 2); B("#2a1c14", 38, 20, 2, 44); B("#2a1c14", 88, 20, 2, 44); B("#2a1c14", 63, 22, 2, 40);
    for (let x = 0; x < W; x += 16) B(x % 32 ? "#f7f0d5" : "#d9465b", x, 0, 16, 12); for (let x = 0; x < W; x += 16) { b.fillStyle = x % 32 ? "#f7f0d5" : "#d9465b"; b.beginPath(); b.arc(x + 8, 12, 8, 0, Math.PI); b.fill(); }
    B("#6b4423", 0, 78, W, 18); B("#8a5a3b", 0, 78, W, 3); B("#050814", 0, 77, W, 1);
    const defs = [{ k: "melon", x0: 24, x1: 54, off: 0 }, { k: "orange", x0: 96, x1: 70, off: .8 }, { k: "apple", x0: 50, x1: 100, off: 1.6 }], PERIOD = 2.6;
    let t = 0, last = 0, running = false;
    function draw() {
      g.drawImage(bg, 0, 0);
      defs.forEach(d => {
        const ph = ((t + d.off) % PERIOD) / PERIOD, cut = .5, x = d.x0 + (d.x1 - d.x0) * ph, ycen = 92 - 150 * ph * (1 - ph) * 1.35 - 2, spr = S.fruit(d.k), sz = 30;
        if (ph < cut) { g.save(); g.translate(x, ycen); g.rotate(ph * 5); g.drawImage(spr, -sz / 2, -sz / 2, sz, sz); g.restore(); }
        else {
          const k = (ph - cut) / (1 - cut), [h1, h2] = S.halves(spr, 0.9, S.FLESH[d.k]), sep = k * 22, fall = k * k * 26;
          [[h1, -1], [h2, 1]].forEach(([im, s]) => { g.save(); g.translate(x + s * sep * .7, ycen + fall + s * sep * .4); g.rotate(ph * 5 + s * k * 1.4); g.globalAlpha = clamp(1.2 - k * .6, 0, 1); g.drawImage(im, -sz / 2, -sz / 2, sz, sz); g.restore(); });
          g.globalAlpha = 1;
          if (k < .22) { g.strokeStyle = `rgba(255,255,255,${(1 - k / .22).toFixed(2)})`; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 24, ycen + 14); g.lineTo(x + 24, ycen - 14); g.stroke(); }
        }
      });
      g.globalAlpha = 1;
    }
    function frame(ts) { if (!running) return; t += Math.min(.05, Math.max(0, (ts - last) / 1000 || 0)); last = ts; draw(); requestAnimationFrame(frame); }
    function start() { if (running || reduced) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    t = .9; draw();
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { if (es[0].isIntersecting) start(); else running = false; }).observe(cv); else start();
    if (hooks) hooks.fruit = (n, dt = .05) => { for (let i = 0; i < n; i++) t += dt; draw(); return t; };
  }

  /* ---------------------------------------- miniatura de Rumbo a la Moncloa */
  function initMoncloaThumb() {
    const cv = $("#moncloa-thumb"); if (!cv) return;
    const g = cv.getContext("2d"), W = cv.width, H = cv.height; g.imageSmoothingEnabled = false;
    const B = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    const rows = [[8, "river", 1, 10, 22], [20, "river", -1, 14, 36], [32, "river", 1, 12, 28], [44, "road", -1, 11, 30], [56, "road", 1, 9, 26], [68, "road", -1, 12, 34]];
    let t = 0, last = 0, running = false;
    function draw() {
      B("#1d2b53", 0, 0, W, H);
      B("#6e5a3a", 0, 0, W, 8); for (let i = 0; i < 3; i++) { const dx = 10 + i * 42; B("#f7f0d5", dx - 2, 0, 28, 8); B("#2a1c14", dx + 4, 2, 14, 6); B("#ffd34e", dx + 5, 3, 12, 5); }
      B("#2a63c9", 0, 8, W, 36); B("#5a8fe8", 0, 8, W, 1);
      B("#2f6b3a", 0, 44, W, 6); B("#3d8a4b", 0, 44, W, 1);
      B("#3a3a46", 0, 50, W, 24); for (let x = 0; x < W; x += 16) B("#ffd34e", x, 61, 8, 1);
      B("#2f6b3a", 0, 74, W, 22);
      rows.forEach(([y, kind, dir, w, gap], i) => {
        const sp = (kind === "road" ? 28 : 16) * (1 + i % 3 * .3), off = (t * sp * dir) % (w + gap), cols = ["#d9465b", "#f7f0d5", "#ffb347", "#31d7c7"];
        for (let k = -2; k < W / (w + gap) + 2; k++) {
          const x = k * (w + gap) + off;
          if (kind === "river") { B("#7a4a22", x, y + 1, w + 8, 9); B("#a8703a", x, y + 1, w + 8, 2); B("#f7f0d5", x + 3, y + 4, w + 2, 3); }
          else { B(cols[(k + i + 4) % 4], x, y + 2, w, 8); B("#10131f", x + 1, y + 9, 3, 2); B("#10131f", x + w - 4, y + 9, 3, 2); B("#9bd6ff", dir > 0 ? x + w - 4 : x + 1, y + 3, 3, 3); }
        }
      });
      const hop = Math.abs(Math.sin(t * 2.2)) * 3, px = 60 + Math.sin(t * .9) * 2, py = 80 - hop;
      B("#10131f", px - 4, py + 8, 9, 2); B("#ffdcb0", px - 3, py, 7, 5); B("#bfc3cf", px - 3, py - 1, 7, 2); B("#1b3a7a", px - 4, py + 5, 9, 5); B("#d9465b", px, py + 5, 1, 4);
    }
    function frame(ts) { if (!running) return; t += Math.min(.05, Math.max(0, (ts - last) / 1000 || 0)); last = ts; draw(); requestAnimationFrame(frame); }
    function start() { if (running || reduced) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
    draw();
    if ("IntersectionObserver" in window) new IntersectionObserver(es => { if (es[0].isIntersecting) start(); else running = false; }).observe(cv); else start();
    if (hooks) hooks.moncloa = (n, dt = .05) => { for (let i = 0; i < n; i++) t += dt; draw(); return t; };
  }

  /* ---------------------------------------------------------------- init */
  fixAccents(document.body); reveals(); poll(); updateScore();
  $$("canvas[data-sil]").forEach(c => silhouette(c, c.dataset.sil));
  $$("canvas[data-icon]").forEach(c => icon(c, c.dataset.icon));
  initHero(); initAttract(); initPastorThumb(); initFalconThumb(); initFruitThumb(); initMoncloaThumb();
  bootDone.then(typeTagline);
})();
