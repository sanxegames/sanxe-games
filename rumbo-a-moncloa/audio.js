"use strict";
/* Rumbo a la Moncloa — efectos y música chiptune con WebAudio (sin archivos). */
(() => {
  let ctx = null, master = null, bus = null, on = true, running = false, timer = null, step = 0, nextT = 0, tempo = 120, level = 0, noiseBuf = null, paused = false;
  const ROOT = 98;   // sol
  const BASS = [0, -1, 0, -1, 7, -1, 7, 5, 3, -1, 3, -1, 5, -1, 7, 10];
  const ARP = [12, 15, 19, 15, 12, 17, 20, 17, 15, 19, 22, 19, 14, 17, 21, 17];
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
    hop() { tone(420, .07, "square", .04, 0, 640); },
    forward() { tone(520, .05, "square", .03, 0, 780); },
    squash() { noise(.25, .1, 0, 300); tone(180, .3, "sawtooth", .08, 0, 50); tone(95, .35, "square", .05, .05, 40); },
    splash() { noise(.45, .09, 0, 600, true, 200); tone(300, .25, "sine", .07, 0, 90); },
    honk() { tone(310, .18, "square", .04); tone(390, .18, "square", .035, .02); },
    door() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .12, "square", .05, i * .06)); },
    socio() { tone(880, .08, "square", .05); tone(1175, .26, "square", .05, .08); },
    gaviota() { tone(1500, .09, "triangle", .06, 0, 2300); tone(2300, .12, "triangle", .06, .09, 1500); },
    baron() { tone(180, .35, "sawtooth", .06, 0, 90); },
    warn() { tone(880, .08, "square", .04); tone(660, .1, "square", .04, .12); },
    pickup() { [660, 880, 1320].forEach((f, i) => tone(f, .09, "square", .045, i * .05)); },
    derogar() { noise(.5, .06, 0, 1500, false, 6000); [392, 523, 659, 784].forEach((f, i) => tone(f, .13, "triangle", .06, i * .05)); },
    round() { [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, .14, "square", .05, i * .07)); },
    over() { tone(294, .3, "sawtooth", .06, 0, 150); tone(220, .4, "sawtooth", .06, .25, 110); tone(147, .7, "sawtooth", .06, .55, 70); },
    tick() { tone(1500, .03, "square", .025); }
  };
  function scheduleStep(i, t) {
    const sd = 60 / tempo / 4, s = i % 16;
    const play = (f, d, type, v, to) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + .02); };
    const hat = (d, v, hp) => { if (!noiseBuf) return; const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + d + .01); };
    if (s % 4 === 0) play(140, .12, "sine", .15, 42);
    if (s % 2 === 1) hat(.04, .04, 6800);
    if (s === 4 || s === 12) hat(.09, .07, 1800);
    const b = BASS[s]; if (b >= 0) play(freq(b), sd * 1.7, "triangle", .2);
    if (s % 2 === 0) play(freq(ARP[s]), sd * 1.1, "square", .04);
    if (level >= 1) play(freq(ARP[(s + 4) % 16] + 12), sd * .7, "square", .022);
  }
  function tick() { if (!running || !ctx || paused) return; while (nextT < ctx.currentTime + .18) { scheduleStep(step, nextT); nextT += 60 / tempo / 4; step++; } }
  const music = {
    start(l = 0) { if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a); this.setLevel(l); if (running) return; running = true; paused = false; step = 0; nextT = a.currentTime + .05; timer = setInterval(tick, 40); },
    stop() { running = false; clearInterval(timer); timer = null; },
    pause(p) { paused = p; if (!p && ctx) nextT = ctx.currentTime + .05; },
    setLevel(l) { level = l >= 3 ? 1 : 0; tempo = Math.min(150, 116 + l * 4); }
  };
  window.RM_AUD = { sfx, music, setOn(v) { on = v; if (!v) music.stop(); }, unlock() { ensure(); } };
})();
