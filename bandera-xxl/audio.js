"use strict";
/* Bandera XXL — efectos y música chiptune con WebAudio (sin archivos). Marcha de desfile con trompeta y caja. */
(() => {
  let ctx = null, master = null, bus = null, on = true, running = false, timer = null, step = 0, nextT = 0, tempo = 112, level = 0, noiseBuf = null, paused = false;
  const ROOT = 110;   // la
  const BASS = [0, -1, 7, -1, 0, -1, 7, -1, 5, -1, 12, -1, 7, -1, 0, -1];
  const LEAD = [12, -1, 16, 19, 24, -1, 19, 16, 17, -1, 21, 24, 21, 19, 16, -1, 12, -1, 16, 19, 28, -1, 24, 19, 21, 19, 17, 16, 14, -1, 19, -1];
  function ensure() {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination); bus = ctx.createGain(); bus.gain.value = .5; bus.connect(master); }
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
    drop() { tone(150, .12, "triangle", .12, 0, 60); noise(.08, .06, 0, 500); },
    perfect(n = 1) { const b = 660 * Math.pow(2, Math.min(n, 7) / 12 * 2); [b, b * 1.25, b * 1.5].forEach((f, i) => tone(f, .12, "square", .045, i * .05)); tone(b * 2, .25, "triangle", .05, .15); },
    cut() { noise(.3, .09, 0, 400, false, 120); tone(220, .2, "sawtooth", .05, 0, 70); },
    fall() { tone(500, .6, "sawtooth", .05, 0, 60); noise(.5, .06, .1, 600, true, 150); },
    gust() { noise(1.1, .08, 0, 300, true, 2400); },
    stage() { [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, .14, "square", .05, i * .07)); tone(1568, .5, "triangle", .06, .45); },
    widen() { [523, 784, 1047].forEach((f, i) => tone(f, .1, "triangle", .06, i * .06)); },
    over() { tone(294, .3, "sawtooth", .06, 0, 150); tone(220, .4, "sawtooth", .06, .25, 110); tone(147, .7, "sawtooth", .06, .55, 70); },
    best() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, .13, "square", .05, i * .08)); },
    tick() { tone(1500, .03, "square", .025); },
    galope() { for (let i = 0; i < 6; i++) { tone(180, .06, "triangle", .1, i * .09 + (i % 2 ? .03 : 0), 90); noise(.04, .05, i * .09, 800); } tone(900, .3, "sawtooth", .05, .55, 1500); tone(1500, .25, "sawtooth", .04, .8, 900); },
    sello() { tone(110, .18, "square", .12, 0, 50); noise(.1, .1, 0, 300); tone(70, .3, "triangle", .1, .05, 40); },
    hito() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .12, "square", .045, i * .06)); tone(1568, .4, "triangle", .06, .32); },
    sirena() { for (let i = 0; i < 3; i++) { tone(660, .12, "square", .035, i * .26); tone(880, .12, "square", .035, i * .26 + .13); } }
  };
  function scheduleStep(i, t) {
    const sd = 60 / tempo / 4, s = i % 16, s32 = i % 32;
    const play = (f, d, type, v, to) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + .02); };
    const hat = (d, v, hp) => { if (!noiseBuf) return; const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + d + .01); };
    if (s % 8 === 0) play(120, .14, "sine", .18, 40);                     // bombo
    if (s % 4 === 2) hat(.07, .09, 2400);                                 // caja
    if (s % 2 === 1) hat(.03, .035, 7000);
    if (s === 15 || s === 7) { hat(.05, .08, 2400); }
    const b = BASS[s]; if (b >= 0) play(freq(b), sd * 1.8, "triangle", .2);
    const l = LEAD[s32]; if (l >= 0) { play(freq(l), sd * 1.6, "square", .035); play(freq(l) * 1.005, sd * 1.6, "sawtooth", .018); }
    if (level >= 1 && s % 4 === 0) play(freq(LEAD[(s32 + 8) % 32] + 12), sd * .8, "square", .018);
  }
  function tick() { if (!running || !ctx || paused) return; while (nextT < ctx.currentTime + .18) { scheduleStep(step, nextT); nextT += 60 / tempo / 4; step++; } }
  const music = {
    start(l = 0) { if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a); this.setLevel(l); if (running) return; running = true; paused = false; step = 0; nextT = a.currentTime + .05; timer = setInterval(tick, 40); },
    stop() { running = false; clearInterval(timer); timer = null; },
    pause(p) { paused = p; if (!p && ctx) nextT = ctx.currentTime + .05; },
    setLevel(l) { level = l >= 3 ? 1 : 0; tempo = Math.min(150, 108 + l * 4); }
  };
  window.BX_AUD = { sfx, music, setOn(v) { on = v; if (!v) music.stop(); }, unlock() { ensure(); } };
})();
