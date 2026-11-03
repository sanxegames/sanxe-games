"use strict";
/* Sanxe Games — experiencia móvil compartida.
   · Pantalla completa: botón, tecla F y entrada automática al girar el móvil a horizontal (modo CSS; en cuanto se pulsa el botón usa también la API nativa).
   · El lienzo se reajusta a su proporción sin deformar, para que los toques sigan acertando.
   · En móvil: vibración ligera en los botones y la pantalla no se apaga mientras se juega. */
(() => {
  const toolbar = document.querySelector(".toolbar"), box = document.querySelector(".screen"), cv = document.getElementById("game"); if (!toolbar || !box || !cv) return;
  const touch = navigator.maxTouchPoints > 0 && (matchMedia("(pointer:coarse)").matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
  const btn = document.createElement("button"); btn.id = "fs"; btn.type = "button"; btn.className = "small-button"; btn.textContent = "PANTALLA COMPLETA"; btn.setAttribute("aria-pressed", "false"); toolbar.appendChild(btn);
  const out = document.createElement("button"); out.type = "button"; out.className = "fs-exit"; out.textContent = "SALIR"; out.setAttribute("aria-label", "Salir de pantalla completa"); document.body.appendChild(out);
  const hint = document.createElement("p"); hint.className = "rot-hint"; hint.textContent = "Consejo: gira el móvil y se pondrá a pantalla completa, con los controles a los lados."; box.parentNode.insertBefore(hint, box);
  let auto = false, suppress = false;
  const isFs = () => document.body.classList.contains("fs");
  function fit() {
    if (!isFs()) { cv.style.width = ""; cv.style.height = ""; return; }
    const hud = box.querySelector(".hud"), availW = box.clientWidth, availH = box.clientHeight - (hud ? hud.offsetHeight : 0) - 2, ratio = cv.width / cv.height, w = Math.max(100, Math.min(availW, availH * ratio));
    cv.style.width = Math.floor(w) + "px"; cv.style.height = Math.floor(w / ratio) + "px";
  }
  function show() { document.body.classList.add("fs"); btn.setAttribute("aria-pressed", "true"); btn.textContent = "SALIR"; scrollTo(0, 0); requestAnimationFrame(fit); setTimeout(fit, 250); }
  async function enter() {
    auto = false; show();
    try { const el = document.documentElement; if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" }); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch { /* el modo CSS ya está activo */ }
    try { await screen.orientation.lock("landscape"); } catch { /* no disponible */ }
  }
  function exit() {
    document.body.classList.remove("fs"); btn.setAttribute("aria-pressed", "false"); btn.textContent = "PANTALLA COMPLETA";
    try { if (document.fullscreenElement) document.exitFullscreen(); else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch { /* nada */ }
    try { screen.orientation.unlock(); } catch { /* nada */ }
    fit();
  }
  /* al girar el móvil: horizontal ⇒ pantalla completa; vertical ⇒ vista normal (salvo que el jugador haya salido a mano) */
  function sync() {
    if (!touch) return; const land = innerWidth > innerHeight && innerHeight < 520;
    if (land && !isFs() && !suppress) { auto = true; show(); } else if (!land) { suppress = false; if (isFs() && auto) { auto = false; exit(); } }
    fit();
  }
  btn.addEventListener("click", () => { if (isFs()) { suppress = true; auto = false; exit(); } else enter(); });
  out.addEventListener("click", () => { suppress = true; auto = false; exit(); });
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && isFs() && !auto) exit(); });
  addEventListener("resize", sync); addEventListener("orientationchange", () => setTimeout(sync, 250));
  addEventListener("keydown", e => { if (e.code === "KeyF" && !e.ctrlKey && !e.metaKey && !/input|textarea/i.test((e.target || {}).tagName || "")) { if (isFs()) { suppress = true; auto = false; exit(); } else enter(); } });
  sync();

  /* detalles de móvil */
  if (touch) {
    document.querySelectorAll(".dpad button,.touch button").forEach(b => b.addEventListener("pointerdown", () => { if (navigator.vibrate) navigator.vibrate(8); }, { passive: true }));
    let wl = null; const lock = async () => { try { if ("wakeLock" in navigator && !wl) { wl = await navigator.wakeLock.request("screen"); wl.addEventListener("release", () => { wl = null; }); } } catch { /* sin bloqueo */ } };
    addEventListener("pointerdown", lock, { passive: true }); document.addEventListener("visibilitychange", () => { if (!document.hidden) lock(); });
  }
})();
