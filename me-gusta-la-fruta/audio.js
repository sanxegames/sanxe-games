"use strict";
/* Me gusta la fruta — efectos y música chiptune con WebAudio (sin archivos). */
(() => {
  let ctx = null, master = null, bus = null, on = true, running = false, timer = null, step = 0, nextT = 0, tempo = 132, level = 0, slow = false, noiseBuf = null, paused = false;
  const ROOT = 146.83;   // re
  const BASS = [0, -1, 0, 7, -1, 5, -1, 3, 0, -1, 0, 7, -1, 10, 8, 7];
  const ARP = [12, 15, 19, 15, 12, 17, 20, 17, 14, 17, 21, 17, 15, 19, 22, 19];
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
  function noise(d, v, delay = 0, hp = 3000, lp = 0, sweepTo = 0) {
    if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a); const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = lp ? "bandpass" : "highpass"; f.frequency.setValueAtTime(hp, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + d + .02);
  }
  const sfx = {
    whoosh() { noise(.18, .035, 0, 800, 0, 3200); },
    slice(n = 0) { noise(.1, .07, 0, 2500, 1, 7000); tone(900 + n * 80, .07, "square", .03, 0, 400); },
    splat(n = 0) { noise(.12, .06, .02, 500, 1, 200); tone(160 + n * 25, .12, "sine", .08, 0, 70); },
    combo(n = 3) { for (let i = 0; i < Math.min(n, 6); i++) tone(523 * Math.pow(1.122, i * 2), .09, "square", .045, i * .06); },
    bomb() { noise(.7, .13, 0, 220); tone(110, .6, "sawtooth", .09, 0, 35); tone(70, .7, "square", .06, .05, 28); },
    miss() { tone(330, .1, "square", .05); tone(196, .25, "sawtooth", .05, .1, 110); },
    cana() { [392, 523, 659, 784].forEach((f, i) => tone(f, .16, "triangle", .06, i * .05)); noise(.5, .03, 0, 6000); },
    libertad() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .14, "square", .05, i * .06)); },
    prensa() { for (let i = 0; i < 6; i++) { tone(1568, .03, "square", .04, i * .06); noise(.03, .04, i * .06, 5000); } },
    round() { [392, 494, 587, 784].forEach((f, i) => tone(f, .12, "square", .05, i * .07)); },
    life() { tone(660, .12, "triangle", .06); tone(990, .2, "triangle", .06, .1); },
    over() { tone(294, .3, "sawtooth", .06, 0, 150); tone(220, .4, "sawtooth", .06, .25, 110); tone(147, .7, "sawtooth", .06, .55, 70); },
    tick() { tone(1500, .03, "square", .025); },
    pa() { tone(1046, .12, "sine", .05); tone(784, .22, "sine", .05, .14); }
  };
  function scheduleStep(i, t) {
    const sd = 60 / tempo / 4, s = i % 16;
    const play = (f, d, type, v, to) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + .02); };
    const hat = (d, v, hp) => { if (!noiseBuf) return; const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + d + .01); };
    if (s % 4 === 0) play(150, .12, "sine", .15, 45);
    if (s % 2 === 1) hat(.04, .04, 6800);
    if (s === 4 || s === 12) hat(.09, .07, 1900);
    const b = BASS[s]; if (b >= 0) play(freq(b), sd * 1.7, "triangle", .2);
    if (s % 2 === 0) play(freq(ARP[s]), sd * 1.1, "square", slow ? .03 : .04);
    if (level >= 1) play(freq(ARP[(s + 5) % 16] + 12), sd * .7, "square", .022);
  }
  function tick() { if (!running || !ctx || paused) return; while (nextT < ctx.currentTime + .18) { scheduleStep(step, nextT); nextT += 60 / (slow ? tempo * .62 : tempo) / 4; step++; } }
  const music = {
    start(l = 0) { if (!on) return; const a = ensure(); if (!a) return; ensureNoise(a); this.setLevel(l); if (running) return; running = true; paused = false; step = 0; nextT = a.currentTime + .05; timer = setInterval(tick, 40); },
    stop() { running = false; clearInterval(timer); timer = null; },
    pause(p) { paused = p; if (!p && ctx) nextT = ctx.currentTime + .05; },
    setLevel(l) { level = l >= 4 ? 1 : 0; tempo = Math.min(160, 126 + l * 3); },
    setSlow(v) { slow = v; }
  };
  window.MF_AUD = { sfx, music, setOn(v) { on = v; if (!v) music.stop(); }, unlock() { ensure(); } };
})();
