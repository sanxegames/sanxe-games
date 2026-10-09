"use strict";
/* Unidad Total — Sanxe Games.
   El grupo de mensajería del partido se llena de críticos. Expulsa a los disidentes antes de que contagien a los demás, sin echar a los leales.
   Cada ronda, los leales de ayer se convierten en los críticos de hoy, hasta que solo quedan el Jinete y el caballo: unanimidad total. */
(() => {
  const AUD = window.UT_AUD, sfx = AUD.sfx, music = AUD.music;
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
  const W = 800, H = 600, FIXED = 1 / 120;
  const AREA_TOP = 62, AREA_BOT = 536; let CX0 = 210, CX1 = 794, BUB_X = 250, BUB_W = 470, FS = 1, compact = false;
  function applyLayout() { const c = canvas.clientWidth > 0 && canvas.clientWidth < 560; if (c === compact) return; compact = c; CX0 = c ? 4 : 210; CX1 = c ? 796 : 794; BUB_X = CX0 + 42; BUB_W = c ? 730 : 470; FS = c ? 1.3 : 1; for (const m of msgs) if (m.lines) layoutMsg(m); }
  const NAMES = ["EL NÚMERO DOS", "LA PORTAVOZ", "EL DE LAS FINANZAS", "LA EX-DIPUTADA", "EL TERCERO DE LA LISTA", "EL ASESOR", "EL ALCALDE DEL PUEBLO", "LA CONCEJALA", "EL ECONOMISTA", "EL SECRETARIO", "EL DEL MICRO", "EL FUNDADOR", "LA DE COMUNICACIÓN", "EL DE LOS ESTATUTOS", "EL SENADOR", "LA ABOGADA", "EL DE LA CAFETERÍA", "LA BECARIA", "EL PORTAVOZ ADJUNTO", "EL CONSEJERO", "LA ALCALDESA", "EL DE LAS REDES", "EL PRESIDENTE REGIONAL", "LA SECRETARIA GENERAL"];
  const NCOL = ["#7fdbff", "#ffb347", "#c792ea", "#7cf08a", "#ff8fa3", "#f7e07a", "#8fb8ff", "#ff9f7a"];
  const LOYAL = ["¡Todo perfecto, jefe!", "Ni una crítica. Jamás.", "El Jinete tiene razón. Siempre.", "Estoy de acuerdo. ¿En qué? En todo.", "Aplauso. Aplauso. Aplauso.", "Sobresaliente, como siempre.", "Yo firmo lo que sea, pero con entusiasmo.", "¡Más bandera!", "La unidad es lo primero. Y lo segundo.", "Perdón por existir, jefe.", "Que no me echen, por favor.", "Yo siempre estuve de acuerdo (desde hoy).", "El caballo también tiene razón.", "Buenos días, equipo. Todo bien. TODO.", "Sin debate se vive mejor.", "Os quiero a todos (menos a los que opinan).", "Mi opinión es la del jefe, qué casualidad.", "Cuenten conmigo. Y con mi silencio."];
  const DISSENT = ["¿Y si... debatimos?", "Creo que nos hemos equivocado.", "Yo no lo habría dicho así.", "Propongo un congreso.", "¿Alguien ha leído los estatutos?", "Quizá deberíamos escuchar a la gente.", "Esto no es lo que firmé.", "Echar a otro más no suma escaños.", "¿Por qué se ha ido otro compañero?", "Pido un poco de pluralidad.", "Ya sé que no se puede decir, pero...", "Con el debido respeto: no.", "¿Y si hacemos una votación?", "Discrepo (con cariño).", "El caballo no vota, ¿verdad?", "Creo que somos menos cada semana.", "¿Sigue abierta la puerta? Pregunto por un amigo.", "A mí me gustaba cuando éramos más.", "Con el pulpo no habría pasado esto.", "Solo digo que quizá podríamos hablar."];
  const FLIPS = [["¡Todo perfecto, jefe!", " ...aunque creo que deberíamos hablarlo."], ["Estoy totalmente de acuerdo con la dirección", " ...en que no estoy de acuerdo."], ["Por supuesto que sí.", " ...que no. Perdón. Que no."], ["¡Viva el partido!", " ...pero cambiaría un par de cosas."], ["Yo siempre apoyo al jefe", " ...salvo en lo de echar gente."], ["Sin ninguna duda", " ...bueno, con unas pocas dudas."], ["Cuenten conmigo", " ...en el próximo partido."]];
  const JIN = ["Aquí nadie discrepa.", "Unidad ante todo.", "No hay disidentes: hay compañeros que aún no lo saben.", "Cuanto menos seamos, más de acuerdo estaremos.", "Se acabó el debate.", "Mi puerta siempre está abierta (hacia fuera).", "Esto no es una purga. Es una limpieza de grupo.", "Silencio en las filas, que escribo yo.", "El que se va no vuelve. Ni se le echa de menos."];
  const HORSE = ["¡Iiiiiii!", "*relincho de aprobación*", "*se come un pensamiento crítico*", "¡Piiii! (traducción: unidad)"];

  const UI = { unity: $("#unity"), members: $("#members"), score: $("#score"), best: $("#best"), status: $("#game-status"), overlay: $("#overlay"), stamp: $("#overlay-stamp"), title: $("#overlay-title"), text: $("#overlay-text"), extra: $("#overlay-extra"), actions: $("#overlay-actions"), sound: $("#sound"), pause: $("#pause"), restart: $("#restart"), help: $("#game-help") };
  let state = "title", soundOn = store.get("ut-sound") !== "0", best = +store.get("ut-best") || 0;
  let members = [], msgs = [], floats = [], particles = [], banner = null, nextId = 1, sel = 0;
  let t = 0, acc = 0, last = 0, round = 1, cycle = 0, unity = 100, score = 0, streak = 0, spawnT = 1, jinT = 9, hintT = 8, breakT = 0, shakeT = 0, shakeM = 0, flashT = 0, flashCol = "#fff", rnd1 = 0, stats = { out: 0, wrong: 0, infect: 0, rounds: 0 }, win = false, mood = 0, quipT = 0;
  const alive = () => members.filter(m => m.alive);
  const dissLeft = () => members.filter(m => m.alive && m.dis).length;

  /* -------------------------------------------------------------- miembros */
  function makeFace() { return { skin: pick(["#efc3a0", "#e0a982", "#c68c68", "#f5d3b8", "#9a6a4a"]), hair: pick(["#2a1c14", "#5a3a22", "#8a8f9e", "#d8dce8", "#b5651d", "#101629"]), style: (Math.random() * 3) | 0, glasses: Math.random() < .4, tie: pick(["#c8323f", "#2b6cff", "#3cff7a", "#ffd34e", "#c792ea"]), suit: pick(["#17306b", "#2a2f3e", "#3a4a3a", "#4a3a3a"]) }; }
  function makeMembers(count) {
    const out = [];
    for (let i = 0; i < count; i++) { const base = NAMES[i % NAMES.length], k = (i / NAMES.length) | 0; out.push({ id: i, name: k ? `${base} ${k + 1}` : base, col: NCOL[i % NCOL.length], face: makeFace(), alive: true, dis: false, sneaky: false, out: 0 }); }
    return out;
  }
  function startRound() {
    const al = alive(), n = al.length, frac = Math.min(.5, .35 + (round - 1) * .02), d = Math.max(1, Math.min(n, Math.ceil(n * frac)));
    al.forEach(m => { m.dis = false; m.sneaky = false; });
    const pool = al.slice().sort(() => Math.random() - .5).slice(0, d); pool.forEach(m => { m.dis = true; m.sneaky = round >= 2 && Math.random() < Math.min(.5, .15 + round * .07); });
    msgs = msgs.filter(m => m.kind === "sys"); spawnT = .6; hintT = round === 1 && cycle === 0 ? 9 : 0; breakT = 0;
    banner = { text: `RONDA ${round}`, sub: round === 1 ? "Los leales de hoy son los críticos de mañana." : `${n} miembros. ${d} están pensando algo.`, t: 0, life: 2.6 }; updateHud();
  }
  const lvl = () => round + cycle * 3;
  const lifeNow = () => Math.max(1.6, 4.4 - .55 * (lvl() - 1));
  const spawnEvery = () => Math.max(.55, 1.45 - .14 * (lvl() - 1));

  /* --------------------------------------------------------------- partida */
  function reset(nextCycle) {
    if (!nextCycle) cycle = 0; else cycle++;
    members = makeMembers(Math.min(36, 30 + cycle * 3)); msgs = []; floats = []; particles = []; round = 1; unity = nextCycle ? Math.max(60, unity) : 100; if (!nextCycle) { score = 0; stats = { out: 0, wrong: 0, infect: 0, rounds: 0 }; } streak = 0; win = false; sel = 0; jinT = 9; mood = 0;
    pushSys("Se ha creado el grupo «UNIDAD TOTAL». El Jinete ha añadido a " + (members.length) + " participantes."); startRound();
  }
  function updateHud() { UI.unity.textContent = Math.round(unity); UI.members.textContent = alive().length; UI.score.textContent = pad(score, 5); UI.best.textContent = pad(Math.max(best, score), 5); }
  const setControls = () => { UI.pause.disabled = !(state === "playing" || state === "paused"); UI.restart.disabled = state === "title"; UI.pause.textContent = state === "paused" ? "SEGUIR" : "PAUSA"; };
  const paintSound = () => { UI.sound.textContent = "SONIDO: " + (soundOn ? "ON" : "OFF"); UI.sound.setAttribute("aria-pressed", String(soundOn)); };

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
    g.fillStyle = "#0b141a"; g.fillRect(0, 0, 64, 80); g.fillStyle = "#1f2c34"; g.fillRect(0, 0, 64, 10); g.fillStyle = "#c8323f"; g.fillRect(3, 3, 5, 4); g.fillStyle = "#ffd34e"; g.fillRect(3, 4, 5, 2);
    g.save(); g.translate(32, 48); g.scale(1.8, 1.8); drawBeard(g, 0); g.restore();
    box.appendChild(cv);
    const dl = document.createElement("dl");
    [["ADMINISTRADOR", "EL JINETE (Y SU CABALLO)"], ["GRUPO", "UNIDAD TOTAL · SOLO ADMINS ESCRIBEN"], ["REGLA 1", "AQUÍ NADIE DISCREPA"], ["REGLA 2", "LA PUERTA ESTÁ ABIERTA (HACIA FUERA)"], ["OBJETIVO", "UNANIMIDAD: CUANTOS MENOS, MEJOR"]].forEach(([k, v]) => { const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); });
    box.appendChild(dl); return box;
  }
  function titleScreen() {
    state = "title"; setControls(); music.stop();
    showOverlay({ help: true, stamp: "GRUPO DE MENSAJERÍA · SOLO LEALES", title: "UNIDAD TOTAL", text: `En el grupo del partido hay críticos infiltrados. Lee cada mensaje: toca los de los disidentes para expulsarlos antes de que contagien, y deja en paz a los leales.${best ? ` Récord: ${best}.` : ""}`, extra: fichaNode(), actions: [{ label: "ENTRAR AL GRUPO", fn: play }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] });
  }
  function play(nextCycle) { state = "playing"; reset(nextCycle === true); hideOverlay(); setControls(); AUD.unlock(); if (soundOn) music.start(cycle); UI.status.textContent = "Expulsa a los disidentes del grupo."; safe(() => canvas.focus({ preventScroll: true })); acc = 0; last = performance.now(); }
  function pauseScreen() { if (state !== "playing") return; state = "paused"; setControls(); music.pause(true); showOverlay({ help: true, stamp: "GRUPO SILENCIADO", title: "PAUSA", text: "Por una vez, nadie escribe. Qué paz.", actions: [{ label: "SEGUIR", fn: resume }, { label: "REINICIAR", secondary: true, fn: () => play() }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] }); }
  function resume() { if (state !== "paused") return; state = "playing"; acc = 0; last = performance.now(); hideOverlay(); setControls(); music.pause(false); safe(() => canvas.focus({ preventScroll: true })); }
  function endGame(victory) {
    state = "over"; win = victory; setControls(); music.stop(); if (victory) { score += Math.round(unity) * 10; sfx.final(); } else sfx.over();
    const nb = score > best; if (nb) { best = score; store.set("ut-best", String(best)); if (!victory) setTimeout(() => sfx.best(), 700); } updateHud();
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`, left = alive().length;
    const title = victory ? "UNANIMIDAD TOTAL: 100 % DE ACUERDO" : pick(["EL GRUPO SE HA ROTO: HAN HABLADO DEMASIADO", "SE ABRE UN DEBATE. FIN DE LA UNIDAD", "LA DISCREPANCIA GANA POR MAYORÍA"]);
    UI.status.textContent = victory ? "Unanimidad total. Solo quedan el Jinete y el caballo." : "El grupo se ha roto.";
    showOverlay({
      stamp: victory ? "ACTA DE UNANIMIDAD" : `RONDA ${round} · ${left + 2} PARTICIPANTES`, title, text: "",
      extra: `<div class="acta"><b>EJECUTIVA NACIONAL · ACTA Nº ${3000 + stats.out}/UT</b><dl>${row("RONDAS", `${victory ? stats.rounds : stats.rounds} SUPERADAS`)}${row("EXPULSADOS", `${stats.out} DISIDENTES`)}${row("ERRORES", `${stats.wrong} LEALES ECHADOS POR ERROR`)}${row("CONTAGIOS", `${stats.infect}`)}${row("QUEDAN", victory ? "EL JINETE Y EL CABALLO" : `${left} MIEMBROS + ADMINS`)}${row("PUNTOS", `<u>${score}${nb ? " · ¡RÉCORD!" : ` · RÉCORD ${best}`}</u>`)}${row("VEREDICTO", victory ? "NADIE DISCREPA. NADIE QUEDA." : "EL JINETE CULPA A LA PRENSA")}</dl><i class="sello">${victory ? "UNÁNIME" : "DISCREPANCIA"}</i></div>`,
      actions: victory ? [{ label: "NUEVA AFILIACIÓN (MÁS DIFÍCIL)", fn: () => play(true) }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }] : [{ label: "OTRO GRUPO", fn: () => play() }, { label: "VOLVER A SANXE GAMES", secondary: true, fn: goHome }]
    });
  }

  /* ------------------------------------------------------------------ efectos */
  const shake = (m, d = .25) => { if (reduced) return; shakeM = Math.max(shakeM, m); shakeT = Math.max(shakeT, d); };
  const flash = (c = "#fff", d = .14) => { if (!reduced) { flashT = d; flashCol = c; } };
  const float = (x, y, text, color, life = 1.2) => floats.push({ x, y, text, color, t: 0, life });
  function burst(x, y, colors, k = 10, sp = 200) { for (let i = 0; i < k; i++) { const a = rnd(0, 6.283), v = rnd(.3, 1) * sp; particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: rnd(.4, .9), color: pick(colors), s: pick([3, 4, 5]), g: 500 }); } }

  /* ---------------------------------------------------------------- mensajes */
  function wrap(text, maxW, font) {
    ctx.font = font; const words = text.split(" "), lines = []; let cur = "";
    for (const w of words) { const test = cur ? cur + " " + w : w; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
    if (cur) lines.push(cur); return lines;
  }
  function pushSys(text, color = "#8d98b8") { msgs.push({ id: nextId++, kind: "sys", text, color, state: "live", t: 0, y: AREA_BOT + 30, h: 26 }); }
  function pushMsg(o) { const m = { id: nextId++, state: "live", t: 0, y: AREA_BOT + 40, fx: 0, ...o }; layoutMsg(m); msgs.push(m); sfx.msg(); sel = m.id; return m; }
  function layoutMsg(m) {
    const text = m.kind === "flip" && m.flipped ? m.text + m.text2 : m.text; m.lines = wrap(text, BUB_W - 28, `${Math.round(22 * FS)}px "VT323", monospace`);
    const lw = Math.max(...m.lines.map(l => ctx.measureText(l).width), 0); ctx.font = `${Math.round(18 * FS)}px "VT323", monospace`; const nw = ctx.measureText(m.mem ? m.mem.name : "").width;
    m.w = Math.max(lw, nw + 44 * FS) + 28; m.h = Math.round((24 + m.lines.length * 22 + 8) * FS);
  }
  function spawnMessage() {
    const al = alive(), diss = al.filter(m => m.dis), live = new Set(msgs.filter(m => m.state === "live" && m.mem).map(m => m.mem.id)), cands = diss.filter(m => !live.has(m.id)), loyal = al.filter(m => !m.dis);
    const early = round === 1 && cycle === 0 && msgs.filter(m => m.mem).length < 2;
    const wantDis = cands.length > 0 && !early && (Math.random() < Math.min(.8, .5 + .04 * (lvl() - 1)) || !loyal.length || rnd1 >= 3);
    if (wantDis) {
      rnd1 = 0; const mem = pick(cands);
      if (alive().length === 1) pushMsg({ kind: "dis", mem, text: "Jefe... solo quedamos tú, yo y el caballo. ¿No crees que...?", life: lifeNow() + 1.5, age: 0 });
      else if (mem.sneaky) { const f = pick(FLIPS); pushMsg({ kind: "flip", mem, text: f[0], text2: f[1], flipped: false, flipAt: rnd(.9, 1.4), life: lifeNow(), age: 0 }); }
      else pushMsg({ kind: "dis", mem, text: pick(DISSENT), life: lifeNow(), age: 0 });
    } else if (loyal.length) { rnd1++; const mem = pick(loyal); pushMsg({ kind: "loyal", mem, text: pick(LOYAL) }); }
  }
  function infect(m) {
    m.state = "gone"; stats.infect++; unity -= 18; streak = 0; sfx.infect(); shake(6, .4); flash("#ff4d61", .18); mood = 2;
    const loy = alive().filter(x => !x.dis); let extra = ""; if (loy.length) { const c = pick(loy); c.dis = true; extra = ` ${c.name} ya lo está pensando.`; }
    pushSys(`${m.mem.name} ha convencido a 3 compañeros (¡contagio!).${extra}`, "#ff6b7d"); updateHud(); if (unity <= 0) { unity = 0; updateHud(); endGame(false); }
  }
  function expel(m) {
    if (state !== "playing" || m.state !== "live" || m.kind === "sys") return;
    const isDis = m.kind === "dis" || (m.kind === "flip" && m.flipped);
    if (m.kind === "jin") { unity -= 5; streak = 0; sfx.bad(); float(m.fxPos || 400, m.y, "¡EL ADMIN ES INTOCABLE!", "#ff4d61", 1.3); pushSys("Solo un administrador puede eliminar a un administrador.", "#ffd34e"); m.state = "gone"; updateHud(); if (unity <= 0) { unity = 0; endGame(false); } return; }
    const px = BUB_X + 100, py = m.y + 16;
    if (isDis) {
      streak++; stats.out++; const mult = Math.min(4, 1 + Math.floor((streak - 1) / 4)), speedBonus = Math.round(clamp(1 - m.age / m.life, 0, 1) * 100), gain = (100 + speedBonus) * mult; score += gain;
      m.mem.alive = false; m.state = "out"; m.outT = 0; sfx.expel(streak); burst(px, py, ["#ff4d61", "#ffd34e", "#f7f0d5"], 12); shake(2, .12); float(px, py - 18, `¡FUERA! +${gain}${mult > 1 ? ` x${mult}` : ""}`, "#3cff7a", 1.1); pushSys(`EL JINETE ha eliminado a ${m.mem.name}.`); mood = 1;
      if (Math.random() < .35) pushMsg({ kind: "jin", mem: { name: "EL JINETE · ADMIN", col: "#ffd34e", face: null, jinete: true }, text: pick(JIN) });
    } else {
      const pre = m.kind === "flip"; stats.wrong++; streak = 0; unity -= pre ? 8 : 12; m.mem.alive = false; m.state = "out"; m.outT = 0; sfx.bad(); shake(4, .25); flash("#ff4d61", .12); mood = 2;
      float(px, py - 18, pre ? "¡AÚN NO HABÍA HABLADO!" : "¡ERA DE LOS NUESTROS!", "#ff4d61", 1.3); pushSys(`EL JINETE ha eliminado a ${m.mem.name}. ${pre ? "Estaba a punto de discrepar. O no." : "Era de los nuestros."}`, "#ff9f7a");
    }
    updateHud(); if (unity <= 0) { unity = 0; updateHud(); endGame(false); return; } checkRound();
  }
  function checkRound() {
    if (state !== "playing" || breakT > 0) return;
    if (alive().length === 0) { stats.rounds++; endGame(true); return; }
    if (dissLeft() === 0) {
      stats.rounds++; score += 500 * round; unity = Math.min(100, unity + 20); sfx.round(); flash("#ffd34e", .25); breakT = 3;
      banner = { text: "¡UNANIMIDAD!", sub: `Ronda ${round} superada. Quedan ${alive().length} miembros... por ahora.`, t: 0, life: 3 }; pushSys("Todos de acuerdo. Nadie ha discrepado (nadie queda que discrepe).", "#3cff7a"); updateHud();
    }
  }

  /* ------------------------------------------------------------- simulación */
  function update(dt) {
    t += dt;
    for (const p of particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } particles = particles.filter(p => p.t < p.life);
    for (const f of floats) { f.t += dt; f.y -= 30 * dt; } floats = floats.filter(f => f.t < f.life);
    shakeT = Math.max(0, shakeT - dt); flashT = Math.max(0, flashT - dt); if (banner) { banner.t += dt; if (banner.t > banner.life) banner = null; } quipT -= dt; if (quipT <= 0) mood = 0;
    if (state !== "playing") return;
    hintT = Math.max(0, hintT - dt);
    if (breakT > 0) { breakT -= dt; if (breakT <= 0) { round++; startRound(); } } else { spawnT -= dt; if (spawnT <= 0) { spawnT = spawnEvery() * rnd(.8, 1.15); spawnMessage(); } jinT -= dt; if (jinT <= 0) { jinT = rnd(10, 16); pushMsg(Math.random() < .3 ? { kind: "jin", mem: { name: "EL CABALLO · ADMIN", col: "#c98a4b", face: null }, text: pick(HORSE) } : { kind: "jin", mem: { name: "EL JINETE · ADMIN", col: "#ffd34e", face: null, jinete: true }, text: pick(JIN) }); sfx.jinete(); } }
    for (const m of msgs) {
      m.t += dt;
      if (m.state === "live" && (m.kind === "dis" || m.kind === "flip")) {
        if (m.kind === "flip" && !m.flipped) { m.age = 0; if (m.t >= m.flipAt) { m.flipped = true; m.age = 0; layoutMsg(m); sfx.warn(); } }
        else { m.age += dt; if (m.age >= m.life) { infect(m); if (state !== "playing") return; } }
      }
      if (m.state === "out") { m.outT += dt; m.fx = m.outT * 900; if (m.outT > .26) m.state = "gone"; }
    }
    msgs = msgs.filter(m => !(m.state === "gone" && m.kind !== "sys") && !(m.kind === "sys" && m.y < AREA_TOP - 40));
    // colocación (la más reciente abajo)
    let bottom = AREA_BOT - 6; for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i], ty = bottom - m.h; m.ty = ty; m.y += (ty - m.y) * Math.min(1, dt * 12); bottom = ty - 8; if (m.state === "live" && m.mem && (m.kind === "dis" || m.kind === "flip") && ty < AREA_TOP - 30 && m.age < m.life) m.age = m.life; }
    msgs = msgs.filter(m => !(m.y < AREA_TOP - 70 && m.ty < AREA_TOP - 70));
    if (!msgs.some(m => m.id === sel && m.state === "live")) { const l = msgs.filter(m => m.state === "live" && m.mem); sel = l.length ? l[l.length - 1].id : 0; }
  }

  /* ----------------------------------------------------------------- dibujo */
  const FONT_PX = '"Press Start 2P", monospace', FONT_T = '"VT323", monospace';
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const gr = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function outlinedText(txt, x, y, color, font, align = "center") { ctx.font = font; ctx.textAlign = align; ctx.fillStyle = "#050814"; [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]].forEach(([dx, dy]) => ctx.fillText(txt, x + dx, y + dy)); ctx.fillStyle = color; ctx.fillText(txt, x, y); }
  function drawBeard(g, md = 0) {
    const B = (c, x, y, w, h) => gr(g, c, x, y, w, h);
    B("#050814", -15, 3, 30, 22); B("#050814", -13, -28, 26, 32);
    B("#2d6a3a", -14, 8, 28, 16); B("#1f4a29", -14, 8, 6, 16); B("#1f4a29", 8, 8, 6, 16); B("#3d8a4b", -8, 10, 2, 12); B("#f7f0d5", -4, 8, 8, 4); B("#8d98b8", -2, 12, 4, 2);
    B("#1f4a29", -13, 5, 26, 5); B("#c8323f", 8, 13, 5, 1); B("#ffd34e", 8, 14, 5, 2); B("#c8323f", 8, 16, 5, 1);
    B("#efc3a0", -9, -20, 18, 8); B("#efc3a0", -10, -14, 20, 8); B("#efc3a0", -12, -16, 3, 5); B("#efc3a0", 9, -16, 3, 5); B("#d89d7c", -12, -15, 1, 3); B("#d89d7c", 11, -15, 1, 3);
    B("#2a1c14", -11, -29, 22, 10); B("#2a1c14", -12, -22, 4, 9); B("#2a1c14", 8, -22, 4, 9); B("#4a3326", -6, -29, 12, 2); B("#4a3326", -9, -26, 5, 1); B("#4a3326", 4, -27, 5, 1);
    B("#1a120e", -9, md === 2 ? -17 : -18, 7, 3); B("#1a120e", 2, md === 2 ? -17 : -18, 7, 3);
    B("#f7f0d5", -8, -14, 6, 3); B("#f7f0d5", 2, -14, 6, 3); B("#101629", -5, -14, 3, 3); B("#101629", 4, -14, 3, 3); B("#8d98b8", -9, -11, 8, 1); B("#8d98b8", 1, -11, 8, 1);
    B("#d89d7c", -1, -11, 3, 4);
    B("#1a120e", -12, -9, 24, 5); B("#1a120e", -11, -4, 22, 6); B("#1a120e", -9, 2, 18, 5); B("#1a120e", -6, 7, 12, 3);
    B("#3a2a22", -9, -2, 2, 1); B("#3a2a22", 6, 0, 2, 1); B("#3a2a22", -4, 5, 2, 1); B("#3a2a22", -10, -7, 2, 1);
    B("#2a1c14", -7, -8, 14, 3);
    if (md) { B("#7a3f3a", -3, -4, 6, 3); B("#f7f0d5", -2, -4, 4, 1); } else B("#3a1f1a", -3, -4, 6, 1);
  }
  function drawFace(x, y, f, s = 2, dead = false) {
    const P = (c, px, py, w, h) => R(dead ? "#4a4f60" : c, x + px * s, y + py * s, w * s, h * s);
    P(f.hair, 2, 0, 8, 4); if (f.style === 2) { P(f.hair, 1, 3, 2, 7); P(f.hair, 9, 3, 2, 7); } else if (f.style === 0) { P(f.hair, 1, 2, 1, 3); P(f.hair, 10, 2, 1, 3); }
    P(f.skin, 2, 3, 8, 7); if (f.style === 1) P(f.skin, 2, 2, 8, 2);
    P("#101629", 4, 5, 1, 2); P("#101629", 7, 5, 1, 2); if (f.glasses) { P("#2a3047", 3, 4, 3, 1); P("#2a3047", 6, 4, 3, 1); P("#2a3047", 3, 7, 3, 1); P("#2a3047", 6, 7, 3, 1); } P("#a35a4a", 5, 8, 2, 1);
    P(f.suit, 1, 10, 10, 2); P(f.tie, 5, 10, 2, 2);
  }
  function drawBackground() {
    R("#070b14", 0, 0, W, H); for (let y = 0; y < H; y += 4) { ctx.fillStyle = "rgba(255,255,255,.015)"; ctx.fillRect(0, y, W, 1); }
    // marco del móvil/chat
    R("#050814", CX0 - 4, 2, CX1 - CX0 + 8, H - 4); R("#0b141a", CX0, 6, CX1 - CX0, H - 12);
    ctx.save(); ctx.beginPath(); ctx.rect(CX0, 52, CX1 - CX0, 490); ctx.clip();      // fondo con garabatos
    for (let y = 60; y < 540; y += 46) for (let x = CX0 + ((y / 46 | 0) % 2) * 23; x < CX1; x += 46) { ctx.globalAlpha = .07; R("#8d98b8", x, y, 6, 4); R("#c8323f", x + 14, y + 8, 5, 3); R("#ffd34e", x + 14, y + 11, 5, 2); R("#8d98b8", x + 26, y + 2, 3, 8); }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function drawHeader() {
    R("#1f2c34", CX0, 6, CX1 - CX0, 48); R("#050814", CX0, 54, CX1 - CX0, 2);
    R("#050814", CX0 + 10, 12, 36, 36); R("#c8323f", CX0 + 12, 14, 32, 8); R("#ffd34e", CX0 + 12, 22, 32, 14); R("#c8323f", CX0 + 12, 36, 32, 10);
    ctx.textAlign = "left"; ctx.font = `24px ${FONT_T}`; ctx.fillStyle = "#f7f0d5"; ctx.fillText("UNIDAD TOTAL", CX0 + 56, 29);
    ctx.font = `17px ${FONT_T}`; ctx.fillStyle = "#8d98b8"; const typing = Math.floor(t * 2) % 3; ctx.fillText(`${alive().length + 2} participantes · EL JINETE está escribiendo${".".repeat(typing + 1)}`, CX0 + 56, 47);
    for (let i = 0; i < 3; i++) R("#8d98b8", CX1 - 22, 18 + i * 8, 4, 4);
    if (compact) { R("#050814", CX0, 54, CX1 - CX0, 7); R(unity > 60 ? "#3cff7a" : unity > 30 ? "#ffd34e" : "#ff4d61", CX0 + 2, 56, (CX1 - CX0 - 4) * clamp(unity / 100, 0, 1), 3); }
  }
  function drawFooter() {
    R("#1f2c34", CX0, 540, CX1 - CX0, 54); R("#050814", CX0, 538, CX1 - CX0, 2);
    R("#0b141a", CX0 + 14, 550, CX1 - CX0 - 28, 34); R("#2a3a44", CX0 + 14, 550, CX1 - CX0 - 28, 2);
    R("#8d98b8", CX0 + 26, 562, 10, 8); R("#8d98b8", CX0 + 28, 557, 6, 6); R("#0b141a", CX0 + 30, 559, 2, 3);
    ctx.font = `19px ${FONT_T}`; ctx.textAlign = "left"; ctx.fillStyle = "#6b7a85"; ctx.fillText("Solo los administradores pueden enviar mensajes.", CX0 + 48, 572);
  }
  function drawBubble(m) {
    const x = BUB_X + (m.fx || 0), y = Math.round(m.y), a = m.state === "out" ? clamp(1 - m.outT / .26, 0, 1) : 1;
    if (y > AREA_BOT + 20 || y + m.h < AREA_TOP - 10) return;
    if (m.kind === "sys") { ctx.font = `17px ${FONT_T}`; ctx.textAlign = "center"; const w = Math.min(540, ctx.measureText(m.text).width + 24); R("#050814", CX0 + (CX1 - CX0) / 2 - w / 2 - 2, y - 1, w + 4, 24); R("rgba(31,44,52,.95)", CX0 + (CX1 - CX0) / 2 - w / 2, y + 1, w, 20); ctx.fillStyle = m.color; ctx.fillText(m.text.length > 70 ? m.text.slice(0, 68) + "…" : m.text, CX0 + (CX1 - CX0) / 2, y + 16); return; }
    ctx.globalAlpha = a; const urgent = (m.kind === "dis" || m.kind === "flip" && m.flipped) && m.state === "live" && m.age > m.life - .7, shk = urgent && !reduced ? Math.round(Math.sin(t * 70) * 2) : 0, bx = x + shk;
    if (m.mem && m.mem.face) drawFace(CX0 + 8, y + 2, m.mem.face, 2); else if (m.mem && m.mem.jinete) { R("#050814", CX0 + 8, y + 2, 26, 26); R("#16224a", CX0 + 10, y + 4, 22, 22); ctx.save(); ctx.beginPath(); ctx.rect(CX0 + 10, y + 4, 22, 22); ctx.clip(); ctx.translate(CX0 + 21, y + 24); ctx.scale(.62, .62); drawBeard(ctx, 0); ctx.restore(); } else if (m.mem) { R("#050814", CX0 + 8, y + 2, 26, 26); R(m.mem.col, CX0 + 10, y + 4, 22, 22); R("#050814", CX0 + 16, y + 10, 10, 10); }
    const sl = m.id === sel && m.state === "live";
    R(sl ? "#ffd34e" : urgent ? "#ff4d61" : "#050814", bx - 3, y - 3, m.w + 6, m.h + 6); R(m.kind === "jin" ? "#3a3418" : "#202c33", bx, y, m.w, m.h); R("#202c33", bx - 6, y + 4, 6, 8); if (m.kind === "jin") R("#3a3418", bx - 6, y + 4, 6, 8);
    ctx.textAlign = "left"; ctx.font = `${Math.round(18 * FS)}px ${FONT_T}`; ctx.fillStyle = m.mem ? m.mem.col : "#fff"; ctx.fillText(m.mem ? m.mem.name : "", bx + 12, y + Math.round(18 * FS));
    ctx.font = `${Math.round(22 * FS)}px ${FONT_T}`; ctx.fillStyle = "#e9edef"; m.lines.forEach((l, i) => ctx.fillText(l, bx + 12, y + Math.round((40 + i * 22) * FS)));
    if (m.kind === "flip" && !m.flipped && m.state === "live") { ctx.fillStyle = "#8d98b8"; ctx.fillText(".".repeat(1 + Math.floor(t * 4) % 3), bx + 12 + (m.lines.length ? ctx.measureText(m.lines[m.lines.length - 1]).width : 0), y + Math.round((40 + (m.lines.length - 1) * 22) * FS)); }
    ctx.font = `${Math.round(14 * FS)}px ${FONT_T}`; ctx.fillStyle = "#6b7a85"; ctx.textAlign = "right"; const hh = 10 + (Math.floor(t / 60) % 12), mm = pad(Math.floor(t) % 60, 2); ctx.fillText(`${hh}:${mm}`, bx + m.w - 24, y + m.h - 5); ctx.strokeStyle = "#53a6d6"; ctx.lineWidth = 2; ctx.beginPath(); const tx = bx + m.w - 20, ty = y + m.h - 9; ctx.moveTo(tx, ty); ctx.lineTo(tx + 3, ty + 3); ctx.lineTo(tx + 9, ty - 3); ctx.moveTo(tx + 5, ty); ctx.lineTo(tx + 8, ty + 3); ctx.lineTo(tx + 14, ty - 3); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function drawSidebar() {
    R("#050814", 4, 2, 204, H - 4); R("#10182f", 6, 6, 198, H - 12);
    // retrato del Jinete
    R("#050814", 14, 14, 182, 154); R(unity < 35 ? "#4a1f2a" : "#16224a", 17, 17, 176, 148); R("#c8323f", 17, 17, 176, 8); R("#ffd34e", 17, 25, 176, 5); R("#c8323f", 17, 30, 176, 4);
    ctx.save(); ctx.translate(105, 98); ctx.scale(2.6, 2.6); const md = mood === 1 ? 1 : mood === 2 ? 2 : 0; drawBeard(ctx, md); ctx.restore();
    outlinedText("EL JINETE · ADMIN", 105, 188, "#ffd34e", `19px ${FONT_T}`);
    // unidad
    ctx.textAlign = "left"; ctx.font = `17px ${FONT_T}`; ctx.fillStyle = "#aab4d5"; ctx.fillText("UNIDAD", 16, 214);
    R("#050814", 14, 220, 182, 16); R("#17213c", 16, 222, 178, 12); const uc = unity > 60 ? "#3cff7a" : unity > 30 ? "#ffd34e" : "#ff4d61"; R(uc, 16, 222, 178 * clamp(unity / 100, 0, 1), 12); for (let k = 1; k < 5; k++) R("#050814", 16 + k * 35.6, 222, 1, 12);
    ctx.fillStyle = "#aab4d5"; ctx.fillText(`RONDA ${round}`, 16, 258); ctx.textAlign = "right"; ctx.fillStyle = dissLeft() ? "#ff8fa3" : "#3cff7a"; ctx.fillText(`DISIDENTES ${dissLeft()}`, 196, 258);
    if (streak >= 2) { ctx.textAlign = "left"; ctx.fillStyle = "#ffd34e"; ctx.fillText(`PURGA x${Math.min(4, 1 + Math.floor((streak - 1) / 4))} · RACHA ${streak}`, 16, 278); }
    // cuadrícula de miembros
    for (let i = 0; i < members.length; i++) { const m = members[i], gx = 16 + (i % 6) * 31, gy = 290 + ((i / 6) | 0) * 29; R("#050814", gx - 1, gy - 1, 28, 28); R("#17213c", gx, gy, 26, 26); if (m.alive) { drawFace(gx + 1, gy + 1, m.face, 2); } else { ctx.globalAlpha = .5; drawFace(gx + 1, gy + 1, m.face, 2, true); ctx.globalAlpha = 1; ctx.strokeStyle = "#ff4d61"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx + 3, gy + 3); ctx.lineTo(gx + 23, gy + 23); ctx.moveTo(gx + 23, gy + 3); ctx.lineTo(gx + 3, gy + 23); ctx.stroke(); } }
    // caballo (admin)
    const hy = 520; ctx.save(); ctx.translate(100, hy); R("#050814", -36, -26, 72, 52); R("#16224a", -33, -23, 66, 46);
    R("#8a5a3b", -20, -8, 26, 14); R("#6b4423", -18, 6, 4, 8); R("#6b4423", 0, 6, 4, 8); R("#8a5a3b", 2, -22, 8, 16); R("#a8703a", 6, -24, 16, 10); R("#6b4423", 18, -20, 5, 5); R("#050814", 15, -22, 2, 2); R("#3a2418", 0, -24, 4, 16); R("#3a2418", -24, -6, 5, 12); R("#c8323f", -12, -10, 18, 3); R("#ffd34e", -12, -7, 18, 3);
    ctx.restore(); outlinedText("EL CABALLO · ADMIN", 105, 560, "#c98a4b", `17px ${FONT_T}`);
  }
  function render() {
    ctx.save(); if (shakeT > 0) ctx.translate(Math.round(rnd(-shakeM, shakeM)), Math.round(rnd(-shakeM, shakeM)));
    applyLayout(); drawBackground(); if (!compact) drawSidebar();
    ctx.save(); ctx.beginPath(); ctx.rect(CX0, 56, CX1 - CX0, 482); ctx.clip(); for (const m of msgs) drawBubble(m); ctx.restore();
    drawHeader(); drawFooter();
    for (const p of particles) { ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1); R(p.color, p.x, p.y, p.s, p.s); } ctx.globalAlpha = 1;
    for (const f of floats) { ctx.globalAlpha = clamp(1.7 - f.t / f.life * 1.7 + .2, 0, 1); outlinedText(f.text, f.x, f.y, f.color, `24px ${FONT_T}`); } ctx.globalAlpha = 1;
    if (hintT > 0 && state === "playing") { ctx.globalAlpha = clamp(hintT / 1.5, 0, 1); outlinedText("LEE CADA MENSAJE: TOCA EL DEL DISIDENTE PARA EXPULSARLO", (CX0 + CX1) / 2, 84, "#f7f0d5", `22px ${FONT_T}`); ctx.globalAlpha = 1; }
    if (banner) { ctx.globalAlpha = clamp(Math.min(banner.t / .2, (banner.life - banner.t) / .5, 1), 0, 1); const bx = (CX0 + CX1) / 2; R("rgba(5,8,20,.72)", CX0 + 20, 250, CX1 - CX0 - 40, 96); outlinedText(banner.text, bx, 292, "#ffd34e", `22px ${FONT_PX}`); outlinedText(banner.sub, bx, 328, "#f7f0d5", `22px ${FONT_T}`); ctx.globalAlpha = 1; }
    ctx.restore();
    if (flashT > 0) { ctx.globalAlpha = clamp(flashT * 2.4, 0, .4); ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
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
  const hit = (cx, cy) => { for (let i = msgs.length - 1; i >= 0; i--) { const m = msgs[i]; if (m.kind === "sys" || m.state !== "live") continue; const y = m.y; if (cx >= BUB_X - 6 && cx <= BUB_X + m.w && cy >= y - 4 && cy <= y + m.h + 4 && cy > AREA_TOP - 6 && cy < AREA_BOT + 6) return m; } return null; };
  canvas.addEventListener("pointerdown", e => { if (state !== "playing") return; e.preventDefault(); const r = canvas.getBoundingClientRect(), cx = (e.clientX - r.left) * W / r.width, cy = (e.clientY - r.top) * H / r.height, m = hit(cx, cy); if (m) expel(m); });
  addEventListener("keydown", e => {
    if (e.code === "KeyP" || e.code === "Escape") { if (state === "playing") pauseScreen(); else if (state === "paused") resume(); return; }
    if (e.code === "KeyR" && !e.metaKey && !e.ctrlKey) { if (state === "playing" || state === "paused") play(); return; }
    if (state !== "playing") return;
    const live = msgs.filter(m => m.state === "live" && m.mem); if (!live.length) return; let i = live.findIndex(m => m.id === sel); if (i < 0) i = live.length - 1;
    if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); sel = live[Math.max(0, i - 1)].id; }
    else if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); sel = live[Math.min(live.length - 1, i + 1)].id; }
    else if ((e.code === "Space" || e.code === "Enter") && !e.repeat) { e.preventDefault(); expel(live[i]); }
  });
  addEventListener("blur", () => { if (state === "playing") pauseScreen(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "playing") pauseScreen(); });
  UI.pause.addEventListener("click", () => state === "paused" ? resume() : pauseScreen());
  UI.restart.addEventListener("click", () => { if (state !== "title") play(); });
  UI.sound.addEventListener("click", () => { soundOn = !soundOn; store.set("ut-sound", soundOn ? "1" : "0"); AUD.setOn(soundOn); paintSound(); if (soundOn) { sfx.msg(); if (state === "playing") music.start(cycle); } });

  /* ------------------------------------------------------------------ inicio */
  AUD.setOn(soundOn); paintSound(); reset(false); titleScreen(); fixAccents(document.querySelector(".cabinet header")); fixAccents(document.querySelector(".hud"));
  requestAnimationFrame(frame);

  if (DEBUG) {
    const snap = () => ({ state, round, cycle, unity: Math.round(unity), score, alive: alive().length, diss: dissLeft(), streak, out: stats.out, wrong: stats.wrong, infect: stats.infect, rounds: stats.rounds, break: +breakT.toFixed(1) });
    window.__ut = {
      step: (k = 1, dt = FIXED, draw = true) => { for (let i = 0; i < k; i++) update(dt); if (draw) render(); return snap(); }, snap, play, render, title: titleScreen, expel: id => { const m = msgs.find(x => x.id === id); if (m) expel(m); },
      msgs: () => msgs.filter(m => m.kind !== "sys" && m.state === "live").map(m => ({ id: m.id, kind: m.kind, flipped: !!m.flipped, age: +(m.age || 0).toFixed(2), life: m.life, y: Math.round(m.y), name: m.mem && m.mem.name, text: m.text })),
      /* piloto: expulsa todo mensaje disidente ya revelado */
      bot: (delay = .25) => { let c = 0; for (const m of msgs.slice()) if (m.state === "live" && (m.kind === "dis" || (m.kind === "flip" && m.flipped)) && (m.age || 0) >= delay) { expel(m); c++; } return c; }
    };
  }
})();
