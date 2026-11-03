"use strict";
/* Sanxe Games — modo "pantalla completa" para móviles. Usa la API de pantalla completa donde existe (Android, escritorio) y un modo
   equivalente por CSS donde no (iPhone). El lienzo se reajusta a su proporción sin deformar para que los toques sigan acertando. */
(() => {
  const toolbar = document.querySelector(".toolbar"), box = document.querySelector(".screen"), cv = document.getElementById("game"); if (!toolbar || !box || !cv) return;
  const btn = document.createElement("button"); btn.id = "fs"; btn.type = "button"; btn.className = "small-button"; btn.textContent = "PANTALLA COMPLETA"; btn.setAttribute("aria-pressed", "false"); toolbar.appendChild(btn);
  const out = document.createElement("button"); out.type = "button"; out.className = "fs-exit"; out.textContent = "SALIR"; out.setAttribute("aria-label", "Salir de pantalla completa"); document.body.appendChild(out);
  const hint = document.createElement("p"); hint.className = "rot-hint"; hint.textContent = "Consejo: gira el móvil o pulsa PANTALLA COMPLETA para jugar más grande."; box.parentNode.insertBefore(hint, box);
  const isFs = () => document.body.classList.contains("fs");
  function fit() {
    if (!isFs()) { cv.style.width = ""; cv.style.height = ""; return; }
    const hud = box.querySelector(".hud"), availW = box.clientWidth, availH = box.clientHeight - (hud ? hud.offsetHeight : 0) - 2, ratio = cv.width / cv.height, w = Math.max(100, Math.min(availW, availH * ratio));
    cv.style.width = Math.floor(w) + "px"; cv.style.height = Math.floor(w / ratio) + "px";
  }
  async function enter() {
    document.body.classList.add("fs"); btn.setAttribute("aria-pressed", "true"); btn.textContent = "SALIR"; scrollTo(0, 0);
    try { const el = document.documentElement; if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch { /* el modo CSS ya está activo */ }
    try { await screen.orientation.lock("landscape"); } catch { /* no disponible */ }
    requestAnimationFrame(fit); setTimeout(fit, 250);
  }
  function exit() {
    document.body.classList.remove("fs"); btn.setAttribute("aria-pressed", "false"); btn.textContent = "PANTALLA COMPLETA";
    try { if (document.fullscreenElement) document.exitFullscreen(); else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch { /* nada */ }
    try { screen.orientation.unlock(); } catch { /* nada */ }
    fit();
  }
  btn.addEventListener("click", () => (isFs() ? exit() : enter())); out.addEventListener("click", exit);
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && isFs()) exit(); });
  addEventListener("resize", fit); addEventListener("orientationchange", () => setTimeout(fit, 250));
  addEventListener("keydown", e => { if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey && !/input|textarea/i.test((e.target || {}).tagName || "")) { /* F alterna pantalla completa */ isFs() ? exit() : enter(); } });
})();
