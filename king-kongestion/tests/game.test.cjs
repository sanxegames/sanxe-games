const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Exercise the shipped script, with only browser rendering/audio replaced by stubs.
function game() {
  const globalEvents = new Map(), documentEvents = new Map(), elements = new Map();
  const context2d = new Proxy({}, { get: (target, key) => key === 'measureText' ? text => ({ width: String(text).length * 7 }) : target[key] ?? (() => {}) });
  function element(tag = 'DIV', dataset = {}) {
    const events = new Map(), classes = new Set();
    return { tagName: tag, dataset, events, style: {}, textContent: '', hidden: false,
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) },
      setAttribute() {}, focus() {}, setPointerCapture() {}, getContext: () => context2d,
      closest: selector => tag === 'BUTTON' && selector.includes('button') ? true : null,
      addEventListener: (name, callback) => events.set(name, callback) };
  }
  const touch = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight', 'Space'].map(key => element('BUTTON', { key }));
  for (const id of ['#start', '#sound', '#pause', '#restart']) elements.set(id, element('BUTTON'));
  const document = { hidden: false,
    createElement: tag => element(String(tag).toUpperCase()),
    querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); },
    querySelectorAll: selector => selector === '[data-key]' ? touch : [],
    addEventListener: (name, callback) => documentEvents.set(name, callback) };
  const sandbox = { document, window: {}, Image: class {}, performance: { now: () => 0 },
    requestAnimationFrame() {}, addEventListener: (name, callback) => globalEvents.set(name, callback) };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8'), sandbox);
  const run = source => vm.runInContext(source, sandbox);
  function key(code, target = document.querySelector('#game'), type = 'keydown', repeat = false) {
    const e = { code, target, repeat, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    globalEvents.get(type)(e); return e;
  }
  run('startGame();spawnClock=1e9;');
  return { run, key, document, elements, touch, globalEvents, documentEvents };
}

test('all ladder endpoints stop on their platforms during sustained input', () => {
  const g = game();
  for (let index = 0; index < 5; index++) {
    for (const direction of [-1, 1]) {
      const result = g.run(`startGame();spawnClock=1e9;
        player.x=ladders[${index}].x+2;player.y=ladders[${index}].y+(${direction}<0?ladders[${index}].h:0)-player.h;
        keyboardKeys.add(${direction}<0?'ArrowUp':'ArrowDown');
        for(let i=0;i<360;i++)update(FIXED_STEP);
        ({feet:player.y+player.h,expected:ladders[${index}].y+(${direction}>0?ladders[${index}].h:0),ground:player.onGround,ladder:player.onLadder,lives});`);
      assert.equal(result.feet, result.expected, `ladder ${index}, direction ${direction}`);
      assert.equal(result.ground, true);
      assert.equal(result.ladder, false);
      assert.equal(result.lives, 3);
    }
  }
});

test('entire route can be climbed and walked to clear the level without teleporting', () => {
  const g = game();
  const result = g.run(`
    function holdUntil(code,predicate,limit=3000){keyboardKeys.add(code);let steps=0;while(!predicate()&&state==='playing'&&steps++<limit)update(FIXED_STEP);keyboardKeys.delete(code);if(steps>=limit)throw new Error('Route stalled: '+code);}
    for(const ladder of ladders){const target=ladder.x+2;holdUntil(player.x<target?'ArrowRight':'ArrowLeft',()=>Math.abs(player.x-target)<2);holdUntil('ArrowUp',()=>player.onGround&&Math.abs(player.y+player.h-ladder.y)<.1);}
    holdUntil('ArrowRight',()=>state==='levelclear');
    ({state,lives,score,elapsed});`);
  assert.equal(result.state, 'levelclear'); assert.equal(result.lives, 3); assert.ok(result.score > 0); assert.ok(result.elapsed > 10);
});

test('movement clamps world bounds and jump lands with no repeat jump', () => {
  const g = game();
  assert.equal(g.run(`keyboardKeys.add('ArrowLeft');for(let i=0;i<120;i++)update(FIXED_STEP);player.x`), 26);
  g.run(`keyboardKeys.clear();player.x=60;player.y=512;player.onGround=true;`);
  g.key('Space');
  const velocity = g.run('player.vy');
  g.key('Space', undefined, 'keydown', true);
  assert.equal(g.run('player.vy'), velocity);
  assert.equal(g.run(`for(let i=0;i<180;i++)update(FIXED_STEP);player.onGround`), true);
  assert.equal(g.run('player.y+player.h'), 550);
});

test('jumping off a ladder initially detaches even with Up still held', () => {
  const g = game();
  const result = g.run(`player.x=747;player.y=460;player.onLadder=true;keyboardKeys.add('ArrowUp');jump();for(let i=0;i<20;i++)update(FIXED_STEP);({ladder:player.onLadder,vy:player.vy});`);
  assert.equal(result.ladder, false); assert.ok(result.vy < 0);
});

test('climbing then stopping above a barrel does not award jump points', () => {
  const g = game();
  assert.equal(g.run(`player.x=747;player.y=462;player.onLadder=true;player.invuln=100;
    barrels=[{id:99,x:750,y:525,w:25,h:25,vx:0,vy:0,level:0,falling:false,spin:0}];
    keyboardKeys.add('ArrowUp');update(FIXED_STEP);keyboardKeys.clear();update(FIXED_STEP);score;`), 0);
});

test('an actual jump over a barrel earns 150 points only once', () => {
  const g = game();
  assert.equal(g.run(`player.x=90;player.y=512;player.onGround=true;player.invuln=100;
    barrels=[{id:99,x:100,y:525,w:25,h:25,vx:0,vy:0,level:0,falling:false,spin:0}];
    jump();for(let i=0;i<150;i++)update(FIXED_STEP);score;`), 150);
  assert.equal(g.run(`for(let i=0;i<150;i++)update(FIXED_STEP);score;`), 150);
});

test('a barrel visits every level and is removed below the ground', () => {
  const g = game();
  const result = g.run(`player.invuln=1000;barrels=[{id:0,x:390,y:15,w:25,h:25,vx:0,vy:0,level:6,falling:true,spin:0}];
    const visited=new Set();for(let i=0;i<7200;i++){update(FIXED_STEP);if(barrels[0])visited.add(barrels[0].level);}({visited:[...visited],count:barrels.length});`);
  assert.deepEqual(Array.from(result.visited), [6, 5, 4, 3, 2, 1, 0]); assert.equal(result.count, 0);
});

test('collision ends the frame, grants invulnerability, and final life freezes play', () => {
  const g = game();
  const result = g.run(`player.invuln=0;barrels=[{x:90,y:510,w:25,h:25,vx:0,vy:0,level:0,falling:false,spin:0},{x:90,y:510,w:25,h:25,vx:0,vy:0,level:0,falling:false,spin:0}];update(FIXED_STEP);({lives,count:barrels.length});`);
  assert.equal(result.lives, 2); assert.equal(result.count, 0);
  assert.equal(g.run('loseLife();lives'), 2);
  const lost = g.run(`lives=1;player.invuln=0;loseLife();const before=elapsed;update(10);({state,lives,frozen:elapsed===before});`);
  assert.equal(lost.state, 'lost'); assert.equal(lost.lives, 0); assert.equal(lost.frozen, true);
});

test('blur and visibility pause, freeze the simulation and clear all input sources', () => {
  const g = game();
  g.run(`keyboardKeys.add('ArrowRight');touchKeys.add('ArrowUp');activePointers.set(1,'ArrowUp');update(.1);`);
  g.globalEvents.get('blur')();
  assert.equal(g.run(`update(10);state`), 'paused');
  assert.equal(g.run('elapsed'), .1);
  assert.equal(g.run('keyboardKeys.size+touchKeys.size+activePointers.size'), 0);
  g.run('resumeGame()'); g.document.hidden = true; g.documentEvents.get('visibilitychange')();
  assert.equal(g.run('state'), 'paused');
});

test('focused native controls retain Enter and Space activation', () => {
  const g = game(); g.run('pauseGame()');
  for (const selector of ['#sound', '#start', '#pause', '#restart']) {
    for (const code of ['Enter', 'Space']) {
      const e = g.key(code, g.elements.get(selector));
      assert.equal(e.defaultPrevented, false); assert.equal(g.run('state'), 'paused');
    }
  }
  g.key('Enter'); assert.equal(g.run('state'), 'playing');
});

test('keyboard release cannot cancel a held touch and pointer cancellation cleans up', () => {
  const g = game();
  const button = g.touch[0], pointer = {pointerId: 1, preventDefault() {}};
  button.events.get('pointerdown')(pointer);g.key('ArrowLeft');g.key('ArrowLeft', undefined, 'keyup');
  assert.equal(g.run(`isPressed('ArrowLeft')`), true);
  button.events.get('pointercancel')(pointer);assert.equal(g.run(`isPressed('ArrowLeft')`), false);
  g.key('ArrowLeft');button.events.get('pointerdown')(pointer);button.events.get('pointerup')(pointer);
  assert.equal(g.run(`isPressed('ArrowLeft')`), true);
});

test('fixed-step movement and time agree at 30, 60 and 144 frames per second', () => {
  const results = [30, 60, 144].map(fps => game().run(`player.invuln=100;keyboardKeys.add('ArrowRight');for(let i=1;i<=${fps};i++)loop(i*1000/${fps});({x:player.x,elapsed});`));
  for (const result of results) { assert.ok(Math.abs(result.elapsed - 1) < .009); assert.ok(Math.abs(result.x - 300) < 1.8); }
  assert.ok(Math.max(...results.map(r => r.x)) - Math.min(...results.map(r => r.x)) < 1.8);
});

test('clearing a level scores once and the next level keeps score and lives with faster barrels', () => {
  const g = game();
  const cleared = g.run(`player.x=865;player.y=45;update(FIXED_STEP);const points=score;update(10);({state,points,score,level});`);
  assert.equal(cleared.state, 'levelclear'); assert.equal(cleared.points, cleared.score); assert.equal(cleared.level, 1);
  const speed1 = g.run('difficulty.barrelSpeed');
  const next = g.run(`lives=2;startNextLevel();({state,level,lives,score,elapsed,barrels:barrels.length,speed:difficulty.barrelSpeed});`);
  assert.equal(next.state, 'playing'); assert.equal(next.level, 2); assert.equal(next.lives, 2);
  assert.equal(next.score, cleared.score); assert.equal(next.elapsed, 0); assert.equal(next.barrels, 0);
  assert.ok(next.speed > speed1);
});

test('barrel speed rises every level up to a cap', () => {
  const g = game();
  const speeds = g.run('[1,2,3,4,10,50].map(n=>levelParams(n).barrelSpeed)');
  assert.ok(speeds[0] < speeds[1] && speeds[1] < speeds[2] && speeds[2] < speeds[3] && speeds[3] < speeds[4]);
  assert.equal(speeds[5], g.run('BARREL_SPEED_MAX'));
});

test('from level 8 some barrels take the ladders straight down, earlier levels never do', () => {
  const g = game();
  const useLadder = lvl => g.run(`setLevel(${lvl});barrels=[{id:1,x:600,y:58,w:25,h:25,vx:difficulty.barrelSpeed,vy:0,level:5,falling:false,spin:0}];player.invuln=1e9;Math.random=()=>0;
    let used=false,xAtLadder=null;for(let i=0;i<2400&&barrels[0];i++){update(FIXED_STEP);if(barrels[0]&&barrels[0].onLadder){used=true;if(xAtLadder===null)xAtLadder=barrels[0].x;}}({used,xAtLadder,left:barrels.length});`);
  const early = useLadder(1), late = useLadder(8);
  assert.equal(early.used, false);
  assert.equal(late.used, true); assert.equal(late.xAtLadder, 700 + 15 - 25 / 2);
});

test('barrels spawn more often every level down to a floor', () => {
  const g = game();
  const spawn = g.run('[1,2,3,6,50].map(n=>levelParams(n).spawnStart)');
  assert.ok(spawn[0] > spawn[1] && spawn[1] > spawn[2] && spawn[2] > spawn[3]);
  assert.equal(spawn[4], g.run('SPAWN_START_FLOOR'));
});

test('losing the last life ends the run and a new game restarts at level one', () => {
  const g = game();
  g.run(`setLevel(4);score=900;lives=1;player.invuln=0;loseLife();`);
  assert.equal(g.run('state'), 'lost');
  const fresh = g.run(`startGame();({state,level,lives,score,elapsed,speed:difficulty.barrelSpeed});`);
  assert.equal(fresh.state, 'playing'); assert.equal(fresh.level, 1); assert.equal(fresh.lives, 3);
  assert.equal(fresh.score, 0); assert.equal(fresh.elapsed, 0); assert.equal(fresh.speed, g.run('BARREL_SPEED_BASE'));
});

test('visible pause and restart controls perform the expected transitions', () => {
  const g = game();
  g.elements.get('#pause').events.get('click')();assert.equal(g.run('state'),'paused');
  g.elements.get('#pause').events.get('click')();assert.equal(g.run('state'),'playing');
  g.run('score=800;elapsed=20');g.elements.get('#restart').events.get('click')();
  assert.equal(g.run('score+elapsed'),0);assert.equal(g.run('state'),'playing');
});

test('missing or unavailable AudioContext does not interrupt play', () => {
  const g = game();
  assert.doesNotThrow(() => g.run(`beep(440,.1);window.AudioContext=class {constructor(){throw Error('Unavailable')}};beep(440,.1);update(FIXED_STEP);`));
  assert.equal(g.run('state'),'playing');
});
