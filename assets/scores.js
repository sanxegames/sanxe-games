"use strict";
/* Salón de la Dimisión — cliente de puntuaciones de Sanxe Games.
   Al terminar una partida, ofrece guardar 3 iniciales y la puntuación en el ranking público. Sin cuentas ni cookies.
   Uso en los juegos:  SGS.begin("id-del-juego") al empezar cada partida  ·  SGS.attach(contenedor, { game, score, unit, reason, lv }) al terminar. */
(() => {
  const PROD = "https://sanxe-scores.scoreboard-api.workers.dev";   // Worker del Salón de la Dimisión (Cloudflare)
  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://127.0.0.1:8787" : PROD;
  const BOARDS = [
    ["king-kongestion", "KING KONGESTION", "puntos"], ["pastor-de-socios", "PASTOR DE SOCIOS", "puntos"], ["flappy-falcon", "FLAPPY FALCON", "puntos"],
    ["fruta-clasico", "FRUTA · CLÁSICO", "kilos"], ["fruta-reloj", "FRUTA · RELOJ", "kilos"], ["rumbo-a-moncloa", "RUMBO A LA MONCLOA", "puntos"], ["bandera-xxl", "BANDERA XXL", "metros"], ["unidad-total", "UNIDAD TOTAL", "puntos"]
  ];
  const safe = (fn, fb = null) => { try { return fn(); } catch { return fb; } };
  const store = { get: k => safe(() => localStorage.getItem(k)), set: (k, v) => safe(() => localStorage.setItem(k, v)) };
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const ERR = { name: "Esas iniciales no están permitidas. Prueba otras.", rate: "Demasiados envíos seguidos. Prueba más tarde.", used: "Esta partida ya está guardada.", early: "Partida demasiado corta para validarla.", score: "No se ha podido validar la puntuación.", token: "La partida ha caducado. Juega otra.", net: "Sin conexión con el Salón. Inténtalo de nuevo." };
  let token = null, tokenGame = null, styled = false;

  function begin(game) {
    token = null; tokenGame = game; document.querySelectorAll(".sgs").forEach(n => n.remove()); if (!API) return;
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
.sgs button{border:0;padding:12px 14px;background:#ff4d61;color:#fff;font:400 .55rem/1.2 "Press Start 2P",monospace;cursor:pointer;box-shadow:0 4px 0 #b52746}
.sgs button.alt{background:#27345b;box-shadow:0 4px 0 #151d36}
.sgs button:disabled{opacity:.45;cursor:default}
.sgs button:active:not(:disabled){transform:translateY(3px);box-shadow:none}
.sgs-msg{min-height:1.2em;margin:8px 0 0;font-size:1.2rem;line-height:1.1;color:#ff8fa3}
.sgs-top{margin:8px auto 0;border-collapse:collapse;font-size:1.2rem;text-align:left}
.sgs-top td{padding:1px 8px}.sgs-top td:first-child{color:#ffd34e}.sgs-top td:nth-child(3){text-align:right;color:#ff8fa3}
.sgs-top tr.me td{color:#31d7c7}
.sgs a{color:#31d7c7}`;
    document.head.appendChild(s);
  }
  function attach(host, o) {
    if (!host || !API || !token || tokenGame !== o.game || !(o.score > 0)) return null;
    css(); const unit = o.unit || "puntos", box = document.createElement("div"); box.className = "sgs";
    box.innerHTML = `<p class="sgs-t">¿GUARDAR EN EL SALÓN DE LA DIMISIÓN?</p><p class="sgs-sub">${fmt(o.score)} ${unit}. Deja tus 3 iniciales y entra en el ranking público.</p>
<div class="sgs-row"><input class="sgs-in" maxlength="3" size="3" placeholder="AAA" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" aria-label="Tus 3 iniciales (letras o números)"><button type="button" class="sgs-go" disabled>GUARDAR</button><button type="button" class="alt sgs-no">AHORA NO</button></div><p class="sgs-msg" role="status" aria-live="polite"></p>`;
    host.appendChild(box);
    const input = box.querySelector(".sgs-in"), go = box.querySelector(".sgs-go"), no = box.querySelector(".sgs-no"), msg = box.querySelector(".sgs-msg");
    const clean = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3); go.disabled = input.value.length !== 3; };
    input.value = store.get("sgs-name") || ""; clean();
    input.addEventListener("input", clean);
    input.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter" && !go.disabled) { e.preventDefault(); send(); } });
    input.addEventListener("keyup", e => e.stopPropagation());
    no.addEventListener("click", () => { box.remove(); });
    go.addEventListener("click", send);
    let sending = false;
    async function send() {
      if (sending || go.disabled) return; sending = true; go.disabled = true; msg.style.color = "#aab4d5"; msg.textContent = "Guardando…";
      try {
        const name = input.value; store.set("sgs-name", name);
        const r = await fetch(API + "/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name, score: Math.round(o.score), reason: o.reason == null ? null : o.reason, lv: o.lv == null ? null : o.lv }) });
        const j = await r.json();
        if (!j.ok) { msg.style.color = "#ff8fa3"; msg.textContent = ERR[j.error] || "No se ha podido guardar."; sending = false; go.disabled = j.error === "used" || j.error === "token"; if (j.error === "used") token = null; return; }
        token = null; done(box, j, name, o, unit);
      } catch { msg.style.color = "#ff8fa3"; msg.textContent = ERR.net; sending = false; go.disabled = false; }
    }
    setTimeout(() => safe(() => input.focus({ preventScroll: true })), 160);
    return box;
  }
  function done(box, j, name, o, unit) {
    const rows = (j.scores || []).map(r => `<tr${r.name === name && r.score === Math.round(o.score) ? ' class="me"' : ""}><td>${r.rank}.º</td><td>${r.name}</td><td>${fmt(r.score)}</td></tr>`).join("");
    box.innerHTML = `<p class="sgs-t">¡EN EL SALÓN! PUESTO ${j.rank}.º</p><p class="sgs-sub">${name} · ${fmt(o.score)} ${unit}</p><table class="sgs-top" aria-label="Mejores puntuaciones">${rows}</table><p class="sgs-sub" style="margin-top:8px"><a href="${/\/$/.test(location.pathname) ? "../" : "./"}#salon">Ver el Salón completo</a></p>`;
  }
  window.SGS = { api: API, boards: BOARDS, begin, attach, top, fmt, enabled: !!API };
})();
