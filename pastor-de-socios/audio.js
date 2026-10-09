"use strict";
/* Pastor de socios — efectos y música chiptune generados con WebAudio (sin archivos). */
(() => {
  let ctx = null, master = null, musicBus = null, on = true, running = false, timer = null, step = 0, nextT = 0, tempo = 118, intensity = 0, rootIdx = 0, noiseBuf = null, paused = false;
  const ROOTS = [110, 98, 123.47, 103.83];
  const BASS = [0, -1, -1, 0, -1, -1, 7, -1, 5, -1, -1, 5, -1, 3, -1, 7];
  const ARP = [0, 12, 7, 12, 3, 12, 7, 15, 5, 12, 8, 12, 3, 10, 7, 14];

  function ensure() {
    if (!ctx) {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      ctx = new A(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = .55; musicBus.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const freq = (root, semi) => root * Math.pow(2, semi / 12);
  function tone(f, d, type = "square", v = .05, delay = 0, to = 0, bus = null) {
    if (!on) return; const a = ensure(); if (!a) return;
    const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(bus || master); o.start(t); o.stop(t + d + .02);
  }
  function noise(d, v, delay = 0, hp = 4000, bus = null) {
    if (!on) return; const a = ensure(); if (!a) return;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * .5, a.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const t = a.currentTime + delay, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = hp; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    s.connect(f).connect(g).connect(bus || master); s.start(t); s.stop(t + d + .02);
  }

  const sfx = {
    bark() { tone(340, .12, "sawtooth", .07, 0, 130); tone(220, .16, "square", .05, .07, 90); noise(.06, .04, 0, 1500); },
    baa(p = 1) { tone(430 * p, .3, "sawtooth", .035, 0, 290 * p); tone(445 * p, .3, "triangle", .03, .02, 300 * p); },
    ding() { tone(880, .08, "square", .05); tone(1175, .24, "square", .05, .08); },
    combo(n) { for (let i = 0; i < Math.min(n, 5); i++) tone(660 * Math.pow(1.122, i * 2), .09, "square", .04, i * .06); },
    lost() { tone(300, .35, "sawtooth", .05, 0, 90); },
    whistle() { tone(1300, .18, "sine", .06, 0, 2100); tone(2100, .22, "sine", .05, .16, 1500); },
    pickup() { [660, 880, 1320].forEach((f, i) => tone(f, .09, "square", .045, i * .05)); },
    freeze() { tone(1400, .5, "triangle", .05, 0, 300); noise(.4, .03, 0, 6000); },
    wolf() { tone(190, .6, "sawtooth", .05, 0, 310); tone(310, .5, "sawtooth", .04, .35, 190); },
    scare() { tone(520, .2, "square", .05, 0, 150); },
    nego() { tone(523, .08, "triangle", .06); tone(784, .18, "triangle", .06, .08); },
    win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .16, "square", .05, i * .09)); },
    lose() { tone(196, .3, "sawtooth", .06, 0, 110); tone(147, .55, "sawtooth", .06, .22, 70); },
    thunder() { noise(.9, .08, 0, 120); tone(70, .8, "sawtooth", .05, 0, 35); },
    tick() { tone(1500, .03, "square", .025); }
  };

  /* ------------------------------------------------------------- música */
  function scheduleStep(i, t) {
    const root = ROOTS[rootIdx % ROOTS.length], sd = 60 / tempo / 4, bus = musicBus;
    const play = (f, d, type, v, to) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + .02);
    };
    const s = i % 16;
    if (s % 4 === 0) play(150, .12, "sine", .16, 45);                       // bombo
    if (s % 2 === 1) { const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); if (noiseBuf) { n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = 6500; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .04); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + .05); } }
    if (s === 4 || s === 12) { const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); if (noiseBuf) { n.buffer = noiseBuf; f.type = "highpass"; f.frequency.value = 1800; g.gain.setValueAtTime(.09, t); g.gain.exponentialRampToValueAtTime(.0001, t + .1); n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + .11); } }
    const b = BASS[s]; if (b >= 0) play(freq(root, b), sd * 1.8, "triangle", .2);
    if (intensity >= 1 && s % 2 === 0) play(freq(root * 2, ARP[s]), sd * 1.2, "square", .045);
    if (intensity >= 2) play(freq(root * 4, ARP[(s + 4) % 16]), sd * .7, "square", .028);
  }
  function tick() {
    if (!running || !ctx || paused) return;
    while (nextT < ctx.currentTime + .18) { scheduleStep(step, nextT); nextT += 60 / tempo / 4; step++; }
  }
  const music = {
    start(level = 1) {
      if (!on) return; const a = ensure(); if (!a || running) { if (running) this.setLevel(level); return; }
      if (!noiseBuf) noise(.01, 0);
      running = true; paused = false; step = 0; nextT = a.currentTime + .05; this.setLevel(level);
      timer = setInterval(tick, 40);
    },
    stop() { running = false; clearInterval(timer); timer = null; },
    pause(p) { paused = p; if (!p && ctx) nextT = ctx.currentTime + .05; },
    setLevel(n) { tempo = Math.min(150, 114 + n * 4); rootIdx = n - 1; },
    setIntensity(n) { intensity = n; }
  };

  window.PS_AUD = {
    sfx, music,
    setOn(v) { on = v; if (!v) music.stop(); },
    isOn: () => on,
    unlock() { ensure(); }
  };
})();
