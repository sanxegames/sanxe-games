/* Formulario de contacto anónimo de Sanxe Games: envía el mensaje a la API (Cloudflare Worker). */
(function () {
  "use strict";
  var API = "https://sanxe-scores.scoreboard-api.workers.dev";
  var f = document.getElementById("cform"), msg = document.getElementById("msg"), cnt = document.getElementById("cnt"),
    st = document.getElementById("status"), send = document.getElementById("send"), kind = document.getElementById("kind");
  if (!f) return;
  var tipo = new URLSearchParams(location.search).get("tipo");
  if (tipo && kind.querySelector('option[value="' + tipo + '"]')) kind.value = tipo;
  function count() { cnt.textContent = msg.value.length + " / 1500"; }
  msg.addEventListener("input", count); count();
  var ERR = {
    short: "Cuéntanos un poco más (mínimo 10 caracteres).",
    long: "Mensaje demasiado largo.",
    spam: "Demasiados enlaces en el mensaje. Deja como máximo dos.",
    rate: "Hoy ya has enviado varios mensajes. Vuelve a intentarlo mañana.",
    full: "Ahora mismo no podemos recibir más mensajes. Inténtalo en unos días."
  };
  function say(t, cls) { st.textContent = t; st.className = cls || ""; }
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = msg.value.trim();
    if (text.length < 10) { say(ERR.short, "err"); msg.focus(); return; }
    send.disabled = true; say("Enviando...", "");
    fetch(API + "/contact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: kind.value, msg: text, reply: document.getElementById("reply").value.trim(), web: document.getElementById("web").value })
    }).then(function (r) { return r.json().catch(function () { return null; }); }).then(function (j) {
      if (j && j.ok) { say("Mensaje enviado. Gracias.", "ok"); msg.value = ""; document.getElementById("reply").value = ""; count(); }
      else say(ERR[j && j.error] || "No se ha podido enviar. Inténtalo de nuevo en un rato.", "err");
    }).catch(function () { say("No hay conexión con el servidor. Inténtalo de nuevo.", "err"); })
      .then(function () { send.disabled = false; });
  });
})();

/* Tildes en mayúsculas de la fuente pixel (mismo arreglo que la portada); el texto original queda para lectores de pantalla */
(function () {
  "use strict";
  var ACC = { "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U", "Ñ": "N", "Ü": "U" }, RE = /[ÁÉÍÓÚÑÜ]/;
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), nodes = [];
  while (walker.nextNode()) if (RE.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
  nodes.forEach(function (n) {
    var p = n.parentElement;
    if (!p || p.closest(".sr-only,[aria-hidden='true'],script,style,.ac")) return;
    if (getComputedStyle(p).fontFamily.indexOf("Press Start") < 0) return;
    var text = n.nodeValue, sr = document.createElement("span"), vis = document.createElement("span"), buf = "";
    sr.className = "sr-only"; sr.textContent = text; vis.setAttribute("aria-hidden", "true");
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ACC[ch]) { if (buf) { vis.append(buf); buf = ""; } var s = document.createElement("span"); s.className = "ac" + (ch === "Ñ" ? " n" : ch === "Ü" ? " u" : ""); s.textContent = ACC[ch]; vis.append(s); }
      else buf += ch;
    }
    if (buf) vis.append(buf);
    n.replaceWith(sr, vis);
  });
})();
