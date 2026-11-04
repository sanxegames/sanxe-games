"use strict";
/* Sanxe Games — módulo compartido (ranking, compartir, retos y métricas anónimas). Sin cuentas ni cookies.
   Uso en los juegos:  SGS.begin("id-del-juego") al empezar cada partida  ·  SGS.attach(contenedor, { game, score, unit, reason, lv, headline }) al terminar.
   En la portada:  SGS.shareSite(botón). Los enlaces de reto (?reto=3310&por=ABC) muestran un aviso en la página del juego. */
(() => {
  const PROD = "https://sanxe-scores.scoreboard-api.workers.dev";   // Worker del Salón de la Dimisión (Cloudflare)
  const SITE = "https://sanxegames.es";
  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://127.0.0.1:8787" : PROD;
  const BOARDS = [
    ["king-kongestion", "KING KONGESTION", "puntos"], ["pastor-de-socios", "PASTOR DE SOCIOS", "puntos"], ["flappy-falcon", "FLAPPY FALCON", "puntos"],
    ["fruta-clasico", "FRUTA · CLÁSICO", "kilos"], ["fruta-reloj", "FRUTA · RELOJ", "kilos"], ["rumbo-a-moncloa", "RUMBO A LA MONCLOA", "puntos"], ["bandera-xxl", "BANDERA XXL", "metros"], ["unidad-total", "UNIDAD TOTAL", "puntos"], ["zasca-invaders", "ZASCA INVADERS", "likes"]
  ];
  /* nombre para la imagen, carpeta de la página y color de acento de cada juego */
  const GAMES = {
    "king-kongestion": { name: "KING KONGESTION", path: "king-kongestion/", col: "#ffd34e" },
    "pastor-de-socios": { name: "PASTOR DE SOCIOS", path: "pastor-de-socios/", col: "#3cff7a" },
    "flappy-falcon": { name: "FLAPPY FALCON", path: "flappy-falcon/", col: "#31d7c7" },
    "fruta-clasico": { name: "ME GUSTA LA FRUTA", path: "me-gusta-la-fruta/", col: "#ff8a3d" },
    "fruta-reloj": { name: "ME GUSTA LA FRUTA", path: "me-gusta-la-fruta/", col: "#ff8a3d" },
    "rumbo-a-moncloa": { name: "RUMBO A LA MONCLOA", path: "rumbo-a-moncloa/", col: "#ff4d61" },
    "bandera-xxl": { name: "BANDERA XXL", path: "bandera-xxl/", col: "#ffd34e" },
    "unidad-total": { name: "UNIDAD TOTAL", path: "unidad-total/", col: "#31d7c7" },
    "zasca-invaders": { name: "ZASCA INVADERS", path: "zasca-invaders/", col: "#2b9cf0" }
  };
  const safe = (fn, fb = null) => { try { return fn(); } catch { return fb; } };
  const store = { get: k => safe(() => localStorage.getItem(k)), set: (k, v) => safe(() => localStorage.setItem(k, v)) };
  const copy = t => { try { const p = navigator.clipboard.writeText(t); if (p && p.catch) p.catch(() => {}); } catch { /* sin portapapeles */ } };
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const ERR = { name: "Esas iniciales no están permitidas. Prueba otras.", rate: "Demasiados envíos seguidos. Prueba más tarde.", used: "Esta partida ya está guardada.", early: "Partida demasiado corta para validarla.", score: "No se ha podido validar la puntuación.", token: "La partida ha caducado. Juega otra.", net: "Sin conexión con el Salón. Inténtalo de nuevo." };
  let token = null, tokenGame = null, styled = false;

  /* ------------------------------------------------------------ retos por enlace */
  const q = new URLSearchParams(location.search), reto = (() => { const n = parseInt(q.get("reto"), 10); return n > 0 && n < 1e9 ? { score: n, by: String(q.get("por") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) } : null; })();

  /* ------------------------------------------------------------ métricas anónimas (solo contadores) */
  function ev(e, g) { if (!API) return; safe(() => fetch(`${API}/ev?e=${encodeURIComponent(e)}&g=${encodeURIComponent(g || "")}`, { method: "POST", keepalive: true }).catch(() => {})); }

  function begin(game) {
    token = null; tokenGame = game; document.querySelectorAll(".sgs").forEach(n => n.remove()); if (!API) return; ev("play", game);
    fetch(API + "/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game }) }).then(r => r.json()).then(j => { if (j && j.ok && tokenGame === game) token = j.token; }).catch(() => {});
  }
  async function top(game, limit = 10) {
    if (!API) throw new Error("off");
    const r = await fetch(`${API}/scores?game=${encodeURIComponent(game)}&limit=${limit}`); const j = await r.json(); if (!j.ok) throw new Error(j.error || "err"); return j;
  }
  function css() {
    if (styled) return; styled = true; const s = document.createElement("style");
    s.textContent = `.sgs{margin:10px 0 8px;padding:10px 12px 12px;border:3px dashed #3b4a7a;background:#0b1126;text-align:center;color:#f7f0d5;font-family:"VT323",monospace}
.sgs-t{margin:0 0 8px;font-size:1.3rem;line-height:1.1;color:#ffd34e}
.sgs-sub{margin:0 0 8px;font-size:1.15rem;line-height:1.1;color:#aab4d5}
.sgs-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center}
.sgs-in{width:6.4em;padding:10px 4px 10px 14px;border:3px solid #31d7c7;background:#050814;color:#ffd34e;text-align:center;text-transform:uppercase;letter-spacing:.35em;font:400 1.05rem "Press Start 2P",monospace}
.sgs-in:focus{outline:3px solid #ffd34e;outline-offset:2px}
.sgs button,.sgs-btn{border:0;padding:12px 14px;background:#ff4d61;color:#fff;font:400 .55rem/1.2 "Press Start 2P",monospace;cursor:pointer;box-shadow:0 4px 0 #b52746;text-decoration:none;display:inline-block}
.sgs button.alt,.sgs-btn.alt{background:#27345b;box-shadow:0 4px 0 #151d36;color:#fff}
.sgs button:disabled{opacity:.45;cursor:default}
.sgs button:active:not(:disabled){transform:translateY(3px);box-shadow:none}
.sgs-msg{min-height:1.2em;margin:8px 0 0;font-size:1.2rem;line-height:1.1;color:#ff8fa3}
.sgs-top{margin:8px auto 0;border-collapse:collapse;font-size:1.2rem;text-align:left}
.sgs-top td{padding:1px 8px}.sgs-top td:first-child{color:#ffd34e}.sgs-top td:nth-child(3){text-align:right;color:#ff8fa3}
.sgs-top tr.me td{color:#31d7c7}
.sgs a{color:#31d7c7}
.sgs-share{margin-top:10px;padding-top:10px;border-top:3px dashed #1b2648}
.sgs-reto{margin:0 0 8px;font-size:1.3rem;line-height:1.1}
.sgs-menu{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:8px}
.sgs-reto-banner{margin:0 0 12px;padding:10px 14px;border:3px solid #ffd34e;background:#14182e;color:#f7f0d5;text-align:center;font:400 1.35rem/1.15 "VT323",monospace}
.sgs-reto-banner b{color:#ffd34e;font-weight:400}`;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------ imagen para compartir */
  function wrap(g, text, maxW, font) { g.font = font; const words = String(text).split(" "), lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
  async function makeCard(o, rank, name) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
    const G = GAMES[o.game] || { name: "SANXE GAMES", path: "", col: "#ffd34e" }, c = document.createElement("canvas"); c.width = 1080; c.height = 1080; const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
    const PX = '"Press Start 2P", monospace', TT = '"VT323", monospace';
    const grd = g.createLinearGradient(0, 0, 0, 1080); grd.addColorStop(0, "#0b1021"); grd.addColorStop(1, "#1a2347"); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1080);
    g.fillStyle = "rgba(255,255,255,.03)"; for (let y = 0; y < 1080; y += 6) g.fillRect(0, y, 1080, 2);
    g.fillStyle = "#c8323f"; g.fillRect(0, 0, 1080, 28); g.fillStyle = "#ffd34e"; g.fillRect(0, 28, 1080, 20); g.fillStyle = "#c8323f"; g.fillRect(0, 48, 1080, 12);
    g.fillStyle = "#303b61"; g.fillRect(0, 1056, 1080, 24); g.fillStyle = "#050814"; g.fillRect(24, 90, 1032, 920);
    g.strokeStyle = "#303b61"; g.lineWidth = 8; g.strokeRect(24, 90, 1032, 920);
    g.textAlign = "center";
    g.font = `34px ${PX}`; g.fillStyle = "#7a1f31"; g.fillText("SANXE GAMES", 546, 172); g.fillStyle = "#ffd34e"; g.fillText("SANXE GAMES", 540, 166);
    g.font = `42px ${PX}`; g.fillStyle = G.col; g.fillText(G.name, 540, 270);
    g.font = `150px ${PX}`; g.fillStyle = "#b52746"; g.fillText(fmt(o.score), 548, 478); g.fillStyle = "#ffd34e"; g.fillText(fmt(o.score), 540, 470);
    g.font = `76px ${TT}`; g.fillStyle = "#f7f0d5"; g.fillText((o.unit || "puntos").toUpperCase(), 540, 548);
    if (rank) { g.font = `60px ${TT}`; g.fillStyle = "#31d7c7"; g.fillText(`${name ? name + " · " : ""}PUESTO ${rank}.º DEL SALÓN`, 540, 618); }
    // titular
    const hl = o.headline || "", lines = hl ? wrap(g, hl.toUpperCase(), 860, `58px ${TT}`).slice(0, 3) : []; if (lines.length) {
      const bh = 70 + lines.length * 62; g.setLineDash([14, 10]); g.strokeStyle = "#3b4a7a"; g.lineWidth = 5; g.strokeRect(100, 660, 880, bh); g.setLineDash([]);
      g.fillStyle = "#0b1126"; g.fillRect(104, 664, 872, bh - 8); g.font = `34px ${TT}`; g.textAlign = "left"; g.fillStyle = "#31d7c7"; g.fillText("ÚLTIMA HORA", 130, 704); g.textAlign = "center";
      g.font = `58px ${TT}`; g.fillStyle = "#f7f0d5"; lines.forEach((l, i) => g.fillText(l, 540, 772 + i * 62));
    }
    g.font = `64px ${TT}`; g.fillStyle = "#ff4d61"; g.fillText("¿ME SUPERAS?", 540, 930);
    g.font = `50px ${TT}`; g.fillStyle = "#aab4d5"; g.fillText(`sanxegames.es/${G.path}`, 540, 990);
    return new Promise(r => c.toBlob(r, "image/png"));
  }
  const challengeUrl = (o, name) => `${SITE}/${(GAMES[o.game] || { path: "" }).path}?reto=${Math.round(o.score)}${name ? "&por=" + name : ""}`;

  function shareUi(host, o, state) {
    const wrapEl = document.createElement("div"); wrapEl.className = "sgs-share";
    const G = GAMES[o.game] || { name: "Sanxe Games" }, unit = o.unit || "puntos";
    let msgHtml = ""; if (reto) { const diff = Math.round(o.score) - reto.score; msgHtml = diff > 0 ? `<p class="sgs-reto" style="color:#3cff7a">¡RETO SUPERADO! +${fmt(diff)} ${unit}${reto.by ? " a " + reto.by : ""}</p>` : `<p class="sgs-reto" style="color:#ff8fa3">Te faltaron ${fmt(-diff + 1)} ${unit} para superar el reto${reto.by ? " de " + reto.by : ""}.</p>`; }
    wrapEl.innerHTML = `${msgHtml}<p class="sgs-sub">Reta a tus amigos: comparte tu puntuación.</p><div class="sgs-row"><button type="button" class="sgs-sh">COMPARTIR</button></div><div class="sgs-menu" hidden></div><p class="sgs-msg" role="status" aria-live="polite"></p>`;
    host.appendChild(wrapEl);
    const btn = wrapEl.querySelector(".sgs-sh"), menu = wrapEl.querySelector(".sgs-menu"), msg = wrapEl.querySelector(".sgs-msg");
    btn.addEventListener("click", async () => {
      btn.disabled = true; msg.style.color = "#aab4d5"; msg.textContent = "Preparando imagen…"; ev("share", o.game);
      const url = challengeUrl(o, state.name), text = `He hecho ${fmt(o.score)} ${unit} en ${G.name}${state.rank ? ` (puesto ${state.rank} del Salón)` : ""}. ¿Me superas?`;
      let blob = null; try { blob = await makeCard(o, state.rank, state.name); } catch { /* sin imagen */ } btn.disabled = false; msg.textContent = "";
      const file = blob && new File([blob], "sanxe-games.png", { type: "image/png" });
      if (navigator.share && file && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `${text} ${url}`, title: "Sanxe Games" }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      else if (navigator.share && !file) { try { await navigator.share({ text, url, title: "Sanxe Games" }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
      menu.hidden = false; const enc = encodeURIComponent, t = enc(text), u = enc(url); menu.innerHTML = "";
      const link = (label, href) => { const a = document.createElement("a"); a.className = "sgs-btn alt"; a.textContent = label; a.href = href; a.target = "_blank"; a.rel = "noopener"; menu.appendChild(a); };
      link("X", `https://twitter.com/intent/tweet?text=${t}&url=${u}`); link("WHATSAPP", `https://wa.me/?text=${t}%20${u}`); link("TELEGRAM", `https://t.me/share/url?url=${u}&text=${t}`);
      const cp = document.createElement("button"); cp.type = "button"; cp.className = "alt"; cp.textContent = "COPIAR ENLACE"; cp.addEventListener("click", () => { copy(`${text} ${url}`); cp.textContent = "¡COPIADO!"; }); menu.appendChild(cp);
      if (blob) { const dl = document.createElement("a"); dl.className = "sgs-btn alt"; dl.textContent = "DESCARGAR IMAGEN"; dl.href = URL.createObjectURL(blob); dl.download = "sanxe-games.png"; menu.appendChild(dl); }
    });
  }

  /* ------------------------------------------------------------ panel de fin de partida */
  function attach(host, o) {
    if (!host || !(o.score > 0)) return null;
    css(); ev("over", o.game); const unit = o.unit || "puntos", box = document.createElement("div"), state = { rank: null, name: "" }; box.className = "sgs";
    const canSave = !!API && !!token && tokenGame === o.game;
    if (canSave) {
      const saveEl = document.createElement("div"); saveEl.className = "sgs-save";
      saveEl.innerHTML = `<p class="sgs-t">¿GUARDAR EN EL SALÓN DE LA DIMISIÓN?</p><p class="sgs-sub">${fmt(o.score)} ${unit}. Deja tus 3 iniciales (un apodo, no tu nombre real) y entra en el ranking público.</p>
<div class="sgs-row"><input class="sgs-in" maxlength="3" size="3" placeholder="AAA" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" aria-label="Tus 3 iniciales (letras o números)"><button type="button" class="sgs-go" disabled>GUARDAR</button><button type="button" class="alt sgs-no">AHORA NO</button></div><p class="sgs-msg" role="status" aria-live="polite"></p>`;
      box.appendChild(saveEl);
      const input = saveEl.querySelector(".sgs-in"), go = saveEl.querySelector(".sgs-go"), no = saveEl.querySelector(".sgs-no"), msg = saveEl.querySelector(".sgs-msg");
      const clean = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3); go.disabled = input.value.length !== 3; };
      input.value = store.get("sgs-name") || ""; clean();
      input.addEventListener("input", clean);
      input.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter" && !go.disabled) { e.preventDefault(); send(); } });
      input.addEventListener("keyup", e => e.stopPropagation());
      no.addEventListener("click", () => { saveEl.remove(); });
      go.addEventListener("click", send);
      let sending = false;
      async function send() {
        if (sending || go.disabled) return; sending = true; go.disabled = true; msg.style.color = "#aab4d5"; msg.textContent = "Guardando…";
        try {
          const name = input.value; store.set("sgs-name", name);
          const r = await fetch(API + "/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, score: Math.round(o.score), reason: o.reason == null ? null : o.reason, lv: o.lv == null ? null : o.lv }) });
          const j = await r.json();
          if (!j.ok) { msg.style.color = "#ff8fa3"; msg.textContent = ERR[j.error] || "No se ha podido guardar."; sending = false; go.disabled = j.error === "used" || j.error === "token"; if (j.error === "used") token = null; return; }
          token = null; state.rank = j.rank; state.name = name; done(saveEl, j, name, o, unit);
        } catch { msg.style.color = "#ff8fa3"; msg.textContent = ERR.net; sending = false; go.disabled = false; }
      }
      setTimeout(() => safe(() => input.focus({ preventScroll: true })), 160);
    }
    host.appendChild(box); shareUi(box, o, state);
    return box;
  }
  function done(el, j, name, o, unit) {
    const rows = (j.scores || []).map(r => `<tr${r.name === name && r.score === Math.round(o.score) ? ' class="me"' : ""}><td>${r.rank}.º</td><td>${r.name}</td><td>${fmt(r.score)}</td></tr>`).join("");
    el.innerHTML = `<p class="sgs-t">¡EN EL SALÓN! PUESTO ${j.rank}.º</p><p class="sgs-sub">${name} · ${fmt(o.score)} ${unit}</p><table class="sgs-top" aria-label="Mejores puntuaciones">${rows}</table><p class="sgs-sub" style="margin-top:8px"><a href="../#salon">Ver el Salón completo</a></p>`;
  }

  /* ------------------------------------------------------------ compartir la web (portada) */
  async function shareSite(msgEl) {
    const text = "Sanxe Games: minijuegos retro de sátira política, gratis y en el navegador. ¿Cuánto aguantas?", url = SITE + "/"; ev("share", "web");
    if (navigator.share) { try { await navigator.share({ title: "Sanxe Games", text, url }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    copy(`${text} ${url}`); if (msgEl) { msgEl.textContent = "¡Enlace copiado!"; setTimeout(() => { msgEl.textContent = ""; }, 2500); }
  }

  /* ------------------------------------------------------------ contador de visitantes y retos */
  function hit() {
    if (!API) return Promise.resolve(null); const day = new Date().toISOString().slice(0, 10), seen = store.get("sgs-hit") === day;
    const ref = safe(() => { const h = new URL(document.referrer).hostname.replace(/^www\./, ""); return h && h !== location.hostname && !/sanxegames\.es$/.test(h) ? h : ""; }, "");
    return fetch(API + (seen ? "/visits" : "/hit?r=" + encodeURIComponent(ref)), { method: seen ? "GET" : "POST" }).then(r => r.json()).then(j => { if (j && j.ok) { if (!seen) store.set("sgs-hit", day); return j.total; } return null; }).catch(() => null);
  }
  const init = () => {
    const el = document.getElementById("hud-visits"); hit().then(n => { if (el && n != null) el.textContent = String(n).padStart(7, "0"); });
    if (reto && document.getElementById("game")) {          // aviso de reto en la página del juego
      css(); const cab = document.querySelector(".cabinet"), screen = document.querySelector(".screen"), g = Object.values(GAMES).find(x => location.pathname.includes("/" + x.path));
      if (cab && screen) { const b = document.createElement("div"); b.className = "sgs-reto-banner"; b.innerHTML = `RETO: <b>supera ${fmt(reto.score)}</b>${reto.by ? ` (lo dejó <b>${reto.by}</b>)` : ""}. ¿Te atreves?`; cab.insertBefore(b, screen); ev("reto", g ? Object.keys(GAMES).find(k => GAMES[k] === g) : ""); }
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.SGS = { api: API, hit, boards: BOARDS, begin, attach, top, fmt, ev, shareSite, enabled: !!API };
})();
