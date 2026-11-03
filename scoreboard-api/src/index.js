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
const MIN_AGE = 4000, MAX_AGE = 6 * 3600 * 1000, HOUR_LIMIT = 12, DAY_LIMIT = 40;

const enc = new TextEncoder();
const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
async function hmac(secret, data) { const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(data))); }
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map(b => b.toString(16).padStart(2, "0")).join(""); }
const nowMs = () => Date.now();

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
function cleanName(raw) { const n = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); return n.length === 3 && !BLOCK.has(n) ? n : null; }
const publicRow = (g, r, i) => ({ rank: i + 1, name: r.name, score: r.score, lv: r.lv, reason: r.reason != null ? (GAMES[g].reasons[r.reason] || "") : "", ts: r.ts });

async function top(env, game, limit) {
  const { results } = await env.DB.prepare("SELECT name, score, lv, reason, ts FROM scores WHERE game = ?1 ORDER BY score DESC, ts ASC LIMIT ?2").bind(game, limit).all();
  return results.map((r, i) => publicRow(game, r, i));
}

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
          if (ins.meta && ins.meta.changes > 0) await env.DB.prepare("INSERT INTO counters (k, n) VALUES ('visits', 1) ON CONFLICT(k) DO UPDATE SET n = n + 1").run();
          if (Math.random() < .03) await env.DB.prepare("DELETE FROM visits WHERE day < ?1").bind(new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)).run();
        }
        const r = await env.DB.prepare("SELECT n FROM counters WHERE k = 'visits'").first(); return json(req, { ok: true, total: r ? r.n : 0 });
      }
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
        const name = cleanName(b.name); if (!name) return fail(req, "name");
        const reason = Number.isInteger(b.reason) && b.reason >= 0 && b.reason < G.reasons.length ? b.reason : null, lv = Number.isInteger(b.lv) && b.lv >= 0 && b.lv < 1000 ? b.lv : null;
        const ip = req.headers.get("CF-Connecting-IP") || "0", day = new Date().toISOString().slice(0, 10), iph = (await sha(ip + "|" + day + "|" + env.SIGNING_SECRET)).slice(0, 20), now = nowMs();
        const rl = await env.DB.prepare("SELECT SUM(ts > ?2) AS h, COUNT(*) AS d FROM scores WHERE iph = ?1 AND ts > ?3").bind(iph, now - 3600000, now - 86400000).first();
        if ((rl && rl.h || 0) >= HOUR_LIMIT || (rl && rl.d || 0) >= DAY_LIMIT) return fail(req, "rate", 429);
        try { await env.DB.prepare("INSERT INTO scores (game, name, score, reason, lv, ts, nonce, iph) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(tk.g, name, score, reason, lv, now, tk.n, iph).run(); }
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
