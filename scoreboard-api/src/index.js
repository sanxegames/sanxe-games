/* Salón de la Dimisión — API de puntuaciones de Sanxe Games (Cloudflare Worker + D1).
   Guarda solo: 3 iniciales, puntuación, nivel opcional, motivo de salida (índice de una lista fija) y fecha.
   Sin cuentas, sin cookies. La IP se usa únicamente para limitar abusos, con hash de sal diaria, y se borra a las 48 h.
   Protección básica: token firmado por partida (un solo uso), tiempo mínimo, plausibilidad por juego, filtro de iniciales y límite por IP. */

const GAMES = {
  "king-kongestion": { label: "King Kongestion", unit: "puntos", max: 1000000, base: 3000, rate: 300, reasons: ["Cero retrasos registrados.", "La culpa era del ministro del andén.", "Perdió el tren con todo el equipo de gobierno.", "Los barriles eran un daño colateral.", "Hubo un incidente sin gravedad (grave).", "Servicio suspendido por mantenimiento de la excusa."] },
  "pastor-de-socios": { label: "Pastor de socios", unit: "puntos", max: 200000, base: 1500, rate: 200, reasons: ["Los socios se fugaron al Grupo Mixto.", "Se acabó el tiempo y la mayoría.", "Gobernó por decreto y se quedó sin decretos.", "Legislatura salvada por los pelos.", "Pactó con quien no debía.", "Dijo que no había prisa. Había moción."] },
  "flappy-falcon": { label: "Flappy Falcon", unit: "puntos", max: 200000, base: 1000, rate: 150, reasons: ["Chocó contra la realidad.", "Aterrizaje forzoso «por coherencia».", "Se quedó sin pista (y sin excusas).", "Culpa de las turbulencias del anterior.", "Voló alto. Cayó más alto.", "Los nubarrones eran de otro partido."] },
  "fruta-clasico": { label: "Me gusta la fruta · Clásico", unit: "kilos", max: 5000, base: 30, rate: 15, reasons: ["Subida de impuestos a la fruta.", "Se pudrió el programa electoral.", "Dijo que la fruta era del anterior.", "Cortó fruta hasta que llegó la factura.", "Terminó la partida con la fruta verde.", "El IVA se comió la cosecha."] },
  "fruta-reloj": { label: "Me gusta la fruta · Contrarreloj", unit: "kilos", max: 1500, base: 30, rate: 15, reasons: ["La rueda de prensa terminó. Las respuestas, no.", "Preguntas: ninguna. Respuestas: todas.", "Se acabó el tiempo y la fruta.", "Cortó mucha fruta y poca pregunta.", "Se le agotó el turno de palabra.", "Dijo «siguiente pregunta» demasiadas veces."] },
  "rumbo-a-moncloa": { label: "Rumbo a la Moncloa", unit: "puntos", max: 2000000, base: 500, rate: 400, reasons: ["Atropellado por una encuesta.", "Se ahogó en un titular.", "Le faltaban escaños. Siempre faltan.", "Se quedó a medio camino de la Moncloa.", "Una pregunta incómoda acabó con él.", "Ganó las elecciones. No el Gobierno."] },
  "bandera-xxl": { label: "Bandera XXL", unit: "metros", max: 5000, base: 20, rate: 4, reasons: ["Pedestal torcido, expediente abierto.", "La bandera no cabía en el mapa.", "Multado por el Ayuntamiento.", "Sin licencia, pero con mucho orgullo.", "Culpa de la Agenda 2030.", "La rotonda era suya (hasta que cayó)."] },
  "zasca-invaders": { label: "Zasca Invaders", unit: "likes", max: 2000000, base: 3000, rate: 700, reasons: ["Se le acabó el turno de palabra.", "Eliminado por un bulo.", "La Presidencia le retiró la palabra.", "Se tomaron el atril.", "Autogol: el zasca rebotó.", "Cancelado en directo."] },
  "unidad-total": { label: "Unidad Total", unit: "puntos", max: 2000000, base: 2500, rate: 700, reasons: ["Se rompió la unidad: hablaron demasiado.", "Expulsó a un leal por error.", "Un disidente contagió al grupo.", "Unanimidad total: no queda nadie.", "El grupo abrió un debate. Fin.", "Solo quedan el Jinete y el caballo."] }
};
const ORIGINS = new Set(["https://sanxegames.es", "https://www.sanxegames.es", "http://localhost:8149", "http://127.0.0.1:8149"]);
const BLOCK = new Set(["ASS", "CUM", "FAG", "FUC", "FUK", "KKK", "NIG", "NZI", "SEX", "TIT", "PTA", "PUT", "PUS"]);
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node/i;
const TEAMS = { izq: "IZQUIERDA", cen: "CENTRO", der: "DERECHA", mix: "MIXTO" };   // guerra de bancadas: solo ideas generales, nunca partidos
const KINDS = { contacto: "Contacto", retirada: "Retirada de contenido", error: "Error o sugerencia", ranking: "Ranking: quitar una entrada" };
const MIN_AGE = 4000, MAX_AGE = 6 * 3600 * 1000, HOUR_LIMIT = 12, DAY_LIMIT = 40;

const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function hmac(secret, data) { const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(data))); }
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map(b => b.toString(16).padStart(2, "0")).join(""); }
const nowMs = () => Date.now();
const today = () => new Date().toISOString().slice(0, 10);
const upsertEv = (env, k) => env.DB.prepare("INSERT INTO ev (day, k, n) VALUES (?1, ?2, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1").bind(today(), k).run();
const EVENTS = new Set(["play", "over", "share", "reto"]);
const esc = x => String(x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function corsHeaders(req) {
  const o = req.headers.get("Origin"), h = { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
  if (o && ORIGINS.has(o)) h["Access-Control-Allow-Origin"] = o; return h;
}
const json = (req, data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(req), ...extra } });
const fail = (req, error, status = 400) => json(req, { ok: false, error }, status);

async function makeToken(env, game) {
  const payload = b64u(enc.encode(JSON.stringify({ g: game, ts: nowMs(), n: b64u(crypto.getRandomValues(new Uint8Array(12))) })));
  return payload + "." + await hmac(env.SIGNING_SECRET, payload);
}
async function readToken(env, tok) {
  if (typeof tok !== "string" || tok.length > 400 || !tok.includes(".")) return null;
  const [p, sig] = tok.split("."); if (!p || !sig || sig !== await hmac(env.SIGNING_SECRET, p)) return null;
  try { const o = JSON.parse(new TextDecoder().decode(unb64u(p))); return GAMES[o.g] && Number.isFinite(o.ts) && typeof o.n === "string" ? o : null; } catch { return null; }
}
const isAdmin = (env, k) => !!env.STATS_KEY && typeof k === "string" && k.length === env.STATS_KEY.length && k === env.STATS_KEY;
async function isBlocked(env, name) { try { return !!(await env.DB.prepare("SELECT 1 FROM blocked WHERE name = ?1").bind(name).first()); } catch { return false; } }
const fmtTs = ms => new Date(ms).toISOString().replace("T", " ").slice(0, 16);
function cleanName(raw) { const n = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return n.length === 3 && !BLOCK.has(n) ? n : null; }
const publicRow = (g, r, i) => ({ rank: i + 1, name: r.name, score: r.score, lv: r.lv, reason: r.reason != null ? (GAMES[g].reasons[r.reason] || "") : "", ts: r.ts, team: Object.prototype.hasOwnProperty.call(TEAMS, r.team) ? r.team : null });

/* Clasificación de bancadas: en cada tablero, los 10 mejores (una entrada por iniciales) dan 10..1 puntos a su bancada. Se recalcula como mucho una vez por minuto y se guarda en D1. */
async function standings(env) {
  const now = nowMs();
  try { const c = await env.DB.prepare("SELECT v, ts FROM cache WHERE k = 'teams'").first(); if (c && now - c.ts < 60000) return JSON.parse(c.v); } catch { /* sin caché */ }
  const ids = Object.keys(TEAMS), pts = {}, pl = {}, pn = {}; ids.forEach(k => { pts[k] = 0; pl[k] = 0; pn[k] = 0; });
  for (const g of Object.keys(GAMES)) {
    const { results } = await env.DB.prepare("SELECT team, MAX(score) AS s FROM scores WHERE game = ?1 GROUP BY name ORDER BY s DESC LIMIT 10").bind(g).all();
    results.forEach((r, i) => { if (Object.prototype.hasOwnProperty.call(TEAMS, r.team)) pts[r.team] += 10 - i; });
  }
  const rs = (await env.DB.prepare("SELECT team, COUNT(DISTINCT name) AS p, COUNT(*) AS n FROM scores WHERE team IS NOT NULL GROUP BY team").all()).results;
  rs.forEach(r => { if (Object.prototype.hasOwnProperty.call(TEAMS, r.team)) { pl[r.team] = r.p; pn[r.team] = r.n; } });
  const data = { ok: true, boards: Object.keys(GAMES).length, teams: ids.map(id => ({ id, label: TEAMS[id], points: pts[id], players: pl[id], plays: pn[id] })).sort((a, b) => b.points - a.points || b.players - a.players) };
  try { await env.DB.prepare("INSERT INTO cache (k, v, ts) VALUES ('teams', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind(JSON.stringify(data), now).run(); } catch { /* sin caché */ }
  return data;
}
async function top(env, game, limit) {
  const { results } = await env.DB.prepare("SELECT name, score, lv, reason, ts, team FROM scores WHERE game = ?1 ORDER BY score DESC, ts ASC LIMIT ?2").bind(game, limit).all();
  return results.map((r, i) => publicRow(game, r, i));
}

const ADMIN_HTML = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sanxe admin</title>
<style>body{background:#0b1021;color:#f7f0d5;font:17px/1.35 monospace;margin:20px;max-width:980px}h1{color:#ffd34e}h2{color:#31d7c7;margin-top:30px}h3{color:#ffd34e;margin:18px 0 6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #27345b;padding:5px 9px;text-align:left;vertical-align:top}th{color:#aab4d5}
button{background:#17213c;color:#f7f0d5;border:2px solid #27345b;padding:4px 9px;font:inherit;cursor:pointer}button:hover{border-color:#ff4d61;color:#ff4d61}.m{border:1px solid #27345b;padding:10px;margin:8px 0;background:#101629}.m small{color:#aab4d5}.m p{white-space:pre-wrap;margin:6px 0}.seed{color:#6b789f}.tag{display:inline-block;border:1px solid #ffd34e;color:#ffd34e;padding:0 6px;margin-right:6px}#st{position:fixed;right:14px;top:14px;background:#ffd34e;color:#101629;padding:6px 12px;display:none}.chip{display:inline-block;border:1px solid #ff4d61;padding:2px 8px;margin:2px}a{color:#31d7c7}</style>
<h1>SANXE GAMES · admin</h1><p><a id="back" href="#">&laquo; Estadísticas</a></p><div id="st"></div>
<h2>Mensajes (<span id="nm"></span>)</h2><div id="msgs"></div>
<h2>Iniciales bloqueadas</h2><p id="blk"></p><p><button id="seeds">Borrar todas las entradas de relleno (seed)</button></p>
<h2>Ranking</h2><p>Borrar una fila la quita del ranking. «Bloquear» borra todas las entradas con esas iniciales en todos los juegos y evita que vuelvan a usarse.</p><div id="boards"></div>
<script>
const D=__DATA__,K=new URLSearchParams(location.search).get("k"),$=id=>document.getElementById(id);
$("back").href="/stats?k="+encodeURIComponent(K);
const e=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function note(t){const s=$("st");s.textContent=t;s.style.display="block";setTimeout(()=>s.style.display="none",2500)}
async function act(o,ok){const r=await fetch("/admin/do",{method:"POST",headers:{"Content-Type":"application/json","X-Admin-Key":K},body:JSON.stringify(o)}).then(r=>r.json()).catch(()=>null);if(r&&r.ok){note("Hecho"+(r.removed!=null?" · "+r.removed+" entradas":""));ok&&ok(r)}else note("Error")}
function render(){
 $("nm").textContent=D.msgs.length;
 $("msgs").innerHTML=D.msgs.map(m=>'<div class="m"><span class="tag">'+e(m.kindLabel)+'</span><small>'+m.when+' UTC'+(m.reply?' · responder a: <b>'+e(m.reply)+'</b>':' · sin contacto')+'</small><p>'+e(m.msg)+'</p><button data-del-msg="'+m.id+'">Borrar</button></div>').join("")||"<p>Sin mensajes.</p>";
 $("blk").innerHTML=D.blocked.map(n=>'<span class="chip">'+e(n)+' <button data-unblock="'+e(n)+'">x</button></span>').join("")||"Ninguna.";
 $("boards").innerHTML=D.boards.map(b=>'<h3>'+e(b.label)+' <small>('+e(b.unit)+')</small></h3><table><tr><th>#</th><th>Iniciales</th><th>Puntos</th><th>Fecha</th><th></th></tr>'+b.rows.map((r,i)=>'<tr class="'+(r.seed?'seed':'')+'"><td>'+(i+1)+'</td><td>'+e(r.name)+(r.team?' / '+e(r.team):'')+(r.seed?' (seed)':'')+'</td><td>'+r.score+'</td><td>'+new Date(r.ts).toISOString().slice(0,16).replace("T"," ")+'</td><td><button data-del="'+r.id+'">Borrar</button> <button data-block="'+e(r.name)+'">Bloquear</button></td></tr>').join("")+'</table>').join("");
}
document.addEventListener("click",ev=>{const t=ev.target;if(t.tagName!=="BUTTON")return;
 if(t.dataset.del)act({do:"delscore",id:+t.dataset.del},()=>{D.boards.forEach(b=>b.rows=b.rows.filter(r=>r.id!=+t.dataset.del));render()});
 else if(t.dataset.delMsg)act({do:"delmsg",id:+t.dataset.delMsg},()=>{D.msgs=D.msgs.filter(m=>m.id!=+t.dataset.delMsg);render()});
 else if(t.dataset.block){if(confirm("¿Bloquear "+t.dataset.block+" y borrar todas sus entradas?"))act({do:"block",name:t.dataset.block},()=>{const n=t.dataset.block;D.boards.forEach(b=>b.rows=b.rows.filter(r=>r.name!==n));if(!D.blocked.includes(n))D.blocked.push(n);render()})}
 else if(t.dataset.unblock)act({do:"unblock",name:t.dataset.unblock},()=>{D.blocked=D.blocked.filter(n=>n!==t.dataset.unblock);render()});
 else if(t.id==="seeds"){if(confirm("¿Borrar todas las entradas de relleno?"))act({do:"delseed"},()=>location.reload())}
});
render();
</script></html>`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
    try {
      if (req.method === "GET" && path === "/scores") {
        const game = url.searchParams.get("game"); if (!GAMES[game]) return fail(req, "game");
        const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "10", 10) || 10));
        return json(req, { ok: true, game, unit: GAMES[game].unit, scores: await top(env, game, limit) }, 200, { "Cache-Control": "public, max-age=20" });
      }
      if (path === "/visits" && req.method === "GET") { const r = await env.DB.prepare("SELECT n FROM counters WHERE k = 'visits'").first(); return json(req, { ok: true, total: r ? r.n : 0 }, 200, { "Cache-Control": "public, max-age=60" }); }
      if (path === "/hit" && req.method === "POST") {   // visitante único por día: hash anónimo de IP+navegador+día (se borra a los 2 días)
        const ua = req.headers.get("User-Agent") || "";
        if (ua && !BOT.test(ua)) {
          const ip = req.headers.get("CF-Connecting-IP") || "0", day = new Date().toISOString().slice(0, 10), h = (await sha(ip + "|" + ua + "|" + day + "|" + env.SIGNING_SECRET)).slice(0, 20);
          const ins = await env.DB.prepare("INSERT OR IGNORE INTO visits (day, h) VALUES (?1, ?2)").bind(day, h).run();
          if (ins.meta && ins.meta.changes > 0) {
            await env.DB.prepare("INSERT INTO counters (k, n) VALUES ('visits', 1) ON CONFLICT(k) DO UPDATE SET n = n + 1").run();
            const ref = (url.searchParams.get("r") || "").toLowerCase(); await upsertEv(env, "visit"); await upsertEv(env, "ref:" + (/^[a-z0-9.-]{1,60}$/.test(ref) ? ref : "directo"));
          }
          if (Math.random() < .03) await env.DB.prepare("DELETE FROM visits WHERE day < ?1").bind(new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)).run();
          const cut = nowMs() - 172800000;
          await env.DB.prepare("UPDATE scores SET iph = NULL WHERE iph IS NOT NULL AND ts < ?1").bind(cut).run();
          await env.DB.prepare("UPDATE contact SET iph = NULL WHERE iph IS NOT NULL AND ts < ?1").bind(cut).run();
          await env.DB.prepare("DELETE FROM contact WHERE ts < ?1").bind(nowMs() - 180 * 86400000).run();
        }
        const r = await env.DB.prepare("SELECT n FROM counters WHERE k = 'visits'").first(); return json(req, { ok: true, total: r ? r.n : 0 });
      }
      if (path === "/ev" && req.method === "POST") {   // métricas anónimas: solo contadores por día
        const ua = req.headers.get("User-Agent") || "", e = url.searchParams.get("e"), g = url.searchParams.get("g") || "";
        if (ua && !BOT.test(ua) && EVENTS.has(e) && (g === "web" || GAMES[g])) await upsertEv(env, e + ":" + g);
        return json(req, { ok: true });
      }
      if (path === "/stats" && req.method === "GET") {   // panel privado (clave en el secreto STATS_KEY)
        if (!env.STATS_KEY || url.searchParams.get("k") !== env.STATS_KEY) return new Response("No", { status: 404 });
        const days = (await env.DB.prepare("SELECT day, n FROM ev WHERE k = 'visit' ORDER BY day DESC LIMIT 14").all()).results;
        const all = (await env.DB.prepare("SELECT k, SUM(n) AS n, SUM(CASE WHEN day >= date('now','-7 day') THEN n ELSE 0 END) AS w, SUM(CASE WHEN day = date('now') THEN n ELSE 0 END) AS d FROM ev GROUP BY k").all()).results;
        const by = {}; all.forEach(r => { by[r.k] = r; });
        const cell = (k, f) => by[k] ? by[k][f] : 0;
        const rows = Object.keys(GAMES).map(g => `<tr><td>${esc(GAMES[g].label)}</td>${["play", "over", "share", "reto"].map(e => `<td>${cell(e + ":" + g, "d")} / ${cell(e + ":" + g, "w")} / ${cell(e + ":" + g, "n")}</td>`).join("")}</tr>`).join("");
        const refs = all.filter(r => r.k.startsWith("ref:")).sort((a, b) => b.n - a.n).slice(0, 20).map(r => `<tr><td>${esc(r.k.slice(4))}</td><td>${r.d}</td><td>${r.w}</td><td>${r.n}</td></tr>`).join("");
        const total = (await env.DB.prepare("SELECT n FROM counters WHERE k = 'visits'").first());
        const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Sanxe stats</title><style>body{background:#0b1021;color:#f7f0d5;font:18px/1.3 monospace;margin:24px}h1{color:#ffd34e}h2{color:#31d7c7;margin-top:28px}table{border-collapse:collapse}td,th{border:1px solid #27345b;padding:6px 12px;text-align:left}th{color:#aab4d5}</style><h1>SANXE GAMES · estadísticas</h1><p><a style="color:#31d7c7" href="/admin?k=${encodeURIComponent(url.searchParams.get("k"))}">Mensajes y moderación del ranking &raquo;</a></p><p>Visitantes únicos (acumulado): <b>${total ? total.n : 0}</b> · valores como hoy / 7 días / total</p><h2>Visitantes por día</h2><table><tr><th>Día</th><th>Visitantes</th></tr>${days.map(r => `<tr><td>${r.day}</td><td>${r.n}</td></tr>`).join("")}</table><h2>Juegos</h2><table><tr><th>Juego</th><th>Partidas iniciadas</th><th>Partidas terminadas</th><th>Compartidos</th><th>Retos abiertos</th></tr>${rows}</table><p>Compartidos de la portada: ${cell("share:web", "d")} / ${cell("share:web", "w")} / ${cell("share:web", "n")}</p><h2>Orígenes de las visitas</h2><table><tr><th>Origen</th><th>Hoy</th><th>7 días</th><th>Total</th></tr>${refs || "<tr><td colspan=4>Aún sin datos</td></tr>"}</table>`;
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
      }
      if (req.method === "POST" && path === "/contact") {   // formulario anónimo de contacto / retirada de contenido
        const raw = await req.text(); if (raw.length > 3000) return fail(req, "size", 413);
        let b; try { b = JSON.parse(raw); } catch { return fail(req, "json"); }
        if (b.web) return json(req, { ok: true });   // campo trampa para bots: se finge éxito
        const kind = KINDS[b.kind] ? b.kind : "contacto", msg = String(b.msg || "").replace(/\r/g, "").trim(), reply = String(b.reply || "").trim();
        if (msg.length < 10) return fail(req, "short"); if (msg.length > 1500 || reply.length > 160) return fail(req, "long");
        if (/https?:\/\/\S+[\s\S]*https?:\/\/\S+[\s\S]*https?:\/\/\S+/i.test(msg)) return fail(req, "spam");
        const ip = req.headers.get("CF-Connecting-IP") || "0", day = new Date().toISOString().slice(0, 10), iph = (await sha(ip + "|c|" + day + "|" + env.SIGNING_SECRET)).slice(0, 20), now = nowMs();
        const rl = await env.DB.prepare("SELECT COUNT(*) AS d FROM contact WHERE iph = ?1 AND ts > ?2").bind(iph, now - 86400000).first();
        if (rl && rl.d >= 3) return fail(req, "rate", 429);
        const tot = await env.DB.prepare("SELECT COUNT(*) AS n FROM contact").first(); if (tot && tot.n >= 500) return fail(req, "full", 503);
        await env.DB.prepare("INSERT INTO contact (ts, kind, msg, reply, iph) VALUES (?1, ?2, ?3, ?4, ?5)").bind(now, kind, msg, reply || null, iph).run();
        return json(req, { ok: true });
      }
      if (path === "/admin" && req.method === "GET") {   // panel privado: mensajes y moderación del ranking
        const k = url.searchParams.get("k"); if (!isAdmin(env, k)) return new Response("No", { status: 404 });
        const msgs = (await env.DB.prepare("SELECT id, ts, kind, msg, reply FROM contact ORDER BY ts DESC LIMIT 100").all()).results;
        const blocked = (await env.DB.prepare("SELECT name FROM blocked ORDER BY name").all()).results;
        const boards = [];
        for (const g of Object.keys(GAMES)) boards.push({ id: g, label: GAMES[g].label, unit: GAMES[g].unit, rows: (await env.DB.prepare("SELECT id, name, team, score, ts, nonce LIKE 'seed-%' AS seed FROM scores WHERE game = ?1 ORDER BY score DESC, ts ASC LIMIT 30").bind(g).all()).results });
        const data = JSON.stringify({ msgs: msgs.map(m => ({ ...m, kindLabel: KINDS[m.kind] || m.kind, when: fmtTs(m.ts) })), blocked: blocked.map(r => r.name), boards }).replace(/</g, "\\u003c");
        return new Response(ADMIN_HTML.replace("__DATA__", () => data), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" } });
      }
      if (path === "/admin/do" && req.method === "POST") {   // acciones de moderación (la clave viaja en cabecera: una web ajena no puede falsificar la petición)
        if (!isAdmin(env, req.headers.get("X-Admin-Key"))) return new Response("No", { status: 404 });
        const b = await req.json().catch(() => null); if (!b) return fail(req, "json");
        const id = Number.isInteger(b.id) ? b.id : null;
        if (b.do === "delscore" && id != null) { await env.DB.prepare("DELETE FROM scores WHERE id = ?1").bind(id).run(); return json(req, { ok: true }); }
        if (b.do === "delmsg" && id != null) { await env.DB.prepare("DELETE FROM contact WHERE id = ?1").bind(id).run(); return json(req, { ok: true }); }
        if (b.do === "block") {   // borra todas las entradas con esas iniciales y las bloquea para el futuro
          const n = String(b.name || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (n.length !== 3) return fail(req, "name");
          await env.DB.prepare("INSERT OR IGNORE INTO blocked (name) VALUES (?1)").bind(n).run();
          const r = await env.DB.prepare("DELETE FROM scores WHERE name = ?1").bind(n).run(); return json(req, { ok: true, removed: r.meta ? r.meta.changes : 0 });
        }
        if (b.do === "unblock") { const n = String(b.name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3); await env.DB.prepare("DELETE FROM blocked WHERE name = ?1").bind(n).run(); return json(req, { ok: true }); }
        if (b.do === "delseed") { const r = await env.DB.prepare("DELETE FROM scores WHERE nonce LIKE 'seed-%'").run(); return json(req, { ok: true, removed: r.meta ? r.meta.changes : 0 }); }
        return fail(req, "do");
      }
      if (req.method === "GET" && path === "/teams") return json(req, await standings(env), 200, { "Cache-Control": "public, max-age=30" });
      if (req.method === "GET" && path === "/boards") return json(req, { ok: true, boards: Object.entries(GAMES).map(([id, g]) => ({ id, label: g.label, unit: g.unit })) }, 200, { "Cache-Control": "public, max-age=3600" });
      if (req.method === "POST" && path === "/start") {
        const b = await req.json().catch(() => null); if (!b || !GAMES[b.game]) return fail(req, "game");
        return json(req, { ok: true, token: await makeToken(env, b.game) });
      }
      if (req.method === "POST" && path === "/score") {
        const raw = await req.text(); if (raw.length > 1200) return fail(req, "size", 413);
        let b; try { b = JSON.parse(raw); } catch { return fail(req, "json"); }
        const tk = await readToken(env, b.token); if (!tk) return fail(req, "token");
        const G = GAMES[tk.g], age = nowMs() - tk.ts;
        if (age < MIN_AGE) return fail(req, "early"); if (age > MAX_AGE) return fail(req, "token");
        const score = Number.isInteger(b.score) ? b.score : NaN; if (!(score > 0) || score > G.max || score > G.base + G.rate * (age / 1000)) return fail(req, "score");
        const name = cleanName(b.name); if (!name || await isBlocked(env, name)) return fail(req, "name");
        const team = typeof b.team === "string" && Object.prototype.hasOwnProperty.call(TEAMS, b.team) ? b.team : null;
        const reason = Number.isInteger(b.reason) && b.reason >= 0 && b.reason < G.reasons.length ? b.reason : null, lv = Number.isInteger(b.lv) && b.lv >= 0 && b.lv < 1000 ? b.lv : null;
        const ip = req.headers.get("CF-Connecting-IP") || "0", day = new Date().toISOString().slice(0, 10), iph = (await sha(ip + "|" + day + "|" + env.SIGNING_SECRET)).slice(0, 20), now = nowMs();
        const rl = await env.DB.prepare("SELECT SUM(ts > ?2) AS h, COUNT(*) AS d FROM scores WHERE iph = ?1 AND ts > ?3").bind(iph, now - 3600000, now - 86400000).first();
        if ((rl && rl.h || 0) >= HOUR_LIMIT || (rl && rl.d || 0) >= DAY_LIMIT) return fail(req, "rate", 429);
        try { await env.DB.prepare("INSERT INTO scores (game, name, score, reason, lv, ts, nonce, iph, team) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)").bind(tk.g, name, score, reason, lv, now, tk.n, iph, team).run(); }
        catch (e) { return fail(req, /UNIQUE/i.test(String(e)) ? "used" : "db", /UNIQUE/i.test(String(e)) ? 409 : 500); }
        const rk = await env.DB.prepare("SELECT COUNT(*) + 1 AS r FROM scores WHERE game = ?1 AND (score > ?2 OR (score = ?2 AND ts < ?3))").bind(tk.g, score, now).first();
        if (Math.random() < .05) {    // limpieza: deja las 200 mejores por juego y borra hashes de IP de más de 48 h
          await env.DB.prepare("DELETE FROM scores WHERE game = ?1 AND id NOT IN (SELECT id FROM scores WHERE game = ?1 ORDER BY score DESC, ts ASC LIMIT 200)").bind(tk.g).run();
          await env.DB.prepare("UPDATE scores SET iph = NULL WHERE iph IS NOT NULL AND ts < ?1").bind(now - 172800000).run();
        }
        return json(req, { ok: true, rank: rk ? rk.r : null, scores: await top(env, tk.g, 5) });
      }
      if (path === "/") return new Response("Sanxe Games · Salón de la Dimisión API", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      return fail(req, "notfound", 404);
    } catch (e) { return fail(req, "server", 500); }
  }
};
