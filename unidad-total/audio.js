"use strict";
/* Unidad Total — efectos y música chiptune con WebAudio (sin archivos). Bajo tenso de oficina con tictac. */
(() => {
  let ctx = null, master = null, bus = null, on = true, running = false, timer = null, step = 0, nextT = 0, tempo = 118, level = 0, noiseBuf = null, paused = false;
  const ROOT = 98;
  const BASS = [0, -1, 0, 0, -1, 0, 3, -1, 0, -1, 0, 0, -1, 5, 3, -1];
  const LEAD = [12, -1, -1, 15, -1, -1, 19, -1, 17, -1, -1, 15, -1, 12, -1, -1, 12, -1, -1, 15, -1, -1, 20, -1, 19, -1, 17, -1, 15, -1, 12, -1];
  function ensure() {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination); bus = ctx.createGain(); bus.gain.value = .45; bus.connect(master); }
    if (ctx.state === "suspended") ctx.resume(); return ctx;
  }
  const freq = semi => ROOT * Math.pow(2, semi / 12);
  function ensureNoise(a) { if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * .6, a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; } }
  function tone(f, d, type = "square", v = .05, delay = 0, to = 0) {
    if (!on) return; const a = ensure(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + .02);
  }
  function noise(d, v, delay = 0, hp = 3000, band = false, sweepTo = 0) {
    if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a); const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = band ? "bandpass" : "highpass"; f.frequency.setValueAtTime(hp, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + d + .02);
  }
  const sfx = {
    msg() { tone(1175, .06, "sine", .045); tone(1568, .09, "sine", .04, .06); },
    jinete() { tone(392, .08, "square", .04); tone(330, .12, "square", .04, .09); },
    expel(n = 1) { noise(.16, .1, 0, 400, false, 1800); tone(240, .12, "square", .09, 0, 90); const b = 520 * Math.pow(2, Math.min(n, 8) / 12 * 2); tone(b, .09, "square", .05, .1); tone(b * 1.5, .12, "square", .05, .17); },
    bad() { tone(200, .22, "sawtooth", .07, 0, 90); tone(140, .3, "square", .06, .1, 70); },
    infect() { noise(.5, .08, 0, 600, true, 160); tone(330, .25, "sawtooth", .06, 0, 110); tone(247, .35, "sawtooth", .06, .15, 82); },
    warn() { tone(880, .05, "square", .04); },
    round() { [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, .14, "square", .05, i * .07)); tone(1568, .4, "triangle", .06, .5); },
    final() { [262, 330, 392, 523, 392, 523, 659, 784].forEach((f, i) => tone(f, .16, "square", .05, i * .1)); tone(1047, .7, "triangle", .06, .85); },
    over() { tone(294, .3, "sawtooth", .06, 0, 150); tone(220, .4, "sawtooth", .06, .25, 110); tone(147, .7, "sawtooth", .06, .55, 70); },
    best() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, .13, "square", .05, i * .08)); },
    tick() { tone(1500, .03, "square", .025); }
  };
  function scheduleStep(i, t) {
    const sd = 60 / tempo / 4, s = i % 16, s32 = i % 32;
    const play = (f, d, type, v, to) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + .02); };
    const hat = (d, v, hp) => { if (!noiseBuf) return; const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + d + .01); };
    if (s % 4 === 0) play(130, .1, "sine", .16, 44);
    if (s % 2 === 0) hat(.025, .05, 8000);                      // tictac de reloj
    if (s === 4 || s === 12) hat(.08, .07, 2200);
    const b = BASS[s]; if (b >= 0) play(freq(b), sd * 1.5, "triangle", .2);
    const l = LEAD[s32]; if (l >= 0) play(freq(l), sd * 1.3, "square", .03);
    if (level >= 1 && s % 4 === 2) play(freq(LEAD[(s32 + 12) % 32] + 12), sd * .7, "square", .018);
  }
  function tick() { if (!running || !ctx || paused) return; while (nextT < ctx.currentTime + .18) { scheduleStep(step, nextT); nextT += 60 / tempo / 4; step++; } }
  const music = {
    start(l = 0) { if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a); this.setLevel(l); if (running) return; running = true; paused = false; step = 0; nextT = a.currentTime + .05; timer = setInterval(tick, 40); },
    stop() { running = false; clearInterval(timer); timer = null; },
    pause(p) { paused = p; if (!p && ctx) nextT = ctx.currentTime + .05; },
    setLevel(l) { level = l >= 3 ? 1 : 0; tempo = Math.min(150, 112 + l * 4); }
  };
  window.UT_AUD = { sfx, music, setOn(v) { on = v; if (!v) music.stop(); }, unlock() { ensure(); } };
})();
