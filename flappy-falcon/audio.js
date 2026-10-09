"use strict";
/* Flappy Falcon — efectos y música chiptune con WebAudio (sin archivos). */
(() => {
  let ctx = null, master = null, bus = null, on = true, running = false, timer = null, step = 0, nextT = 0, tempo = 128, mode = 0, rootIdx = 0, noiseBuf = null, paused = false;
  const ROOTS = [130.81, 146.83, 123.47, 138.59];            // do, re, si, do#
  const BASS = [0, -1, 0, -1, 7, -1, 7, -1, 5, -1, 5, -1, 7, -1, 4, -1];
  const ARP = [12, 16, 19, 16, 14, 17, 21, 17, 12, 16, 19, 24, 19, 16, 14, 19];

  function ensure() {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ctx = new A(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
      bus = ctx.createGain(); bus.gain.value = .5; bus.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const freq = (root, semi) => root * Math.pow(2, semi / 12);
  function tone(f, d, type = "square", v = .05, delay = 0, to = 0) {
    if (!on) return; const a = ensure(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(master); o.start(t); o.stop(t + d + .02);
  }
  function ensureNoise(a) { if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * .6, a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; } }
  function noise(d, v, delay = 0, hp = 3000, out = null) {
    if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a);
    const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f).connect(g).connect(out || master); s.start(t); s.stop(t + d + .02);
  }

  const sfx = {
    flap() { tone(330, .09, "square", .035, 0, 560); noise(.07, .03, 0, 2500); },
    ding(n = 0) { tone(660 * Math.pow(1.0595, Math.min(n, 12) * 2), .08, "square", .05); tone(990 * Math.pow(1.0595, Math.min(n, 12) * 2), .16, "square", .045, .07); },
    vote() { tone(1175, .05, "square", .04); tone(1568, .12, "square", .04, .05); },
    shield() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .12, "triangle", .06, i * .05)); },
    shieldHit() { tone(900, .25, "sawtooth", .06, 0, 200); noise(.2, .05, 0, 800); },
    turbo() { tone(200, .6, "sawtooth", .06, 0, 1200); noise(.5, .04, 0, 1500); },
    crash() { noise(.7, .12, 0, 200); tone(180, .6, "sawtooth", .08, 0, 40); tone(90, .7, "square", .06, .1, 30); },
    touch() { noise(.12, .06, 0, 400); tone(120, .15, "square", .05, 0, 70); },
    land() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .14, "square", .05, i * .08)); },
    perfect() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, .12, "square", .05, i * .06)); },
    applause() { for (let i = 0; i < 16; i++) noise(.05, .035, i * .09 + Math.random() * .05, 1800 + Math.random() * 2000); },
    warn() { tone(880, .1, "square", .05); tone(660, .12, "square", .05, .14); },
    gust() { noise(.9, .05, 0, 700); },
    thunder() { noise(.9, .08, 0, 120); tone(70, .8, "sawtooth", .05, 0, 35); },
    lose() { tone(196, .3, "sawtooth", .06, 0, 110); tone(147, .55, "sawtooth", .06, .22, 70); },
    pa() { tone(1046, .12, "sine", .05); tone(784, .22, "sine", .05, .14); }
  };

  function scheduleStep(i, t) {
    const root = ROOTS[rootIdx % ROOTS.length], sd = 60 / tempo / 4, s = i % 16;
    const play = (f, d, type, v, to) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + .02); };
    const hat = (d, v, hp) => { if (!noiseBuf) return; const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + d + .01); };
    if (mode === 2) { if (s % 8 === 0) play(freq(root, 0), sd * 7, "triangle", .12); if (s % 4 === 0) play(freq(root * 2, ARP[s]), sd * 3, "sine", .05); return; }   // aterrizaje: calma
    if (s % 4 === 0) play(150, .12, "sine", .15, 45);
    if (s % 2 === 1) hat(.04, .045, 6500);
    if (s === 4 || s === 12) hat(.09, .07, 1800);
    const b = BASS[s]; if (b >= 0) play(freq(root, b), sd * 1.6, "triangle", .2);
    if (s % 2 === 0) play(freq(root * 2, ARP[s]), sd * 1.1, "square", .04);
    if (mode >= 1) play(freq(root * 4, ARP[(s + 3) % 16]), sd * .7, "square", .025);
  }
  function tick() { if (!running || !ctx || paused) return; while (nextT < ctx.currentTime + .18) { scheduleStep(step, nextT); nextT += 60 / tempo / 4; step++; } }
  const music = {
    start(n = 1) { if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a); if (running) { this.setLevel(n); return; } running = true; paused = false; step = 0; nextT = a.currentTime + .05; this.setLevel(n); timer = setInterval(tick, 40); },
    stop() { running = false; clearInterval(timer); timer = null; },
    pause(p) { paused = p; if (!p && ctx) nextT = ctx.currentTime + .05; },
    setLevel(n) { tempo = Math.min(158, 124 + n * 4); rootIdx = n - 1; },
    setMode(m) { mode = m; }            // 0 crucero, 1 tension, 2 aterrizaje
  };
  window.FF_AUD = { sfx, music, setOn(v) { on = v; if (!v) music.stop(); }, unlock() { ensure(); } };
})();
