/* ============================================================================
   실시간 아레나 배틀 화면
   - 시뮬레이션(arena.js)을 60fps 루프로 돌리고 Canvas에 포켓몬·이펙트·말풍선을 그림
   - 상단 캐스터/해설 중계 바, 양 팀 전원 HP HUD, 결과 화면
   ========================================================================== */
import { WEATHERS, TYPE_COLORS, monById, statsAt50, josa } from './engine.js';
import { ArenaScene, project, ARENA_STAGES } from './arena-scenes.js';
import { ArenaBattle, TUNE } from './arena.js';
import { getArt, playCry, sfx } from './sprites.js';
import { weatherIcon } from './icons.js';
import { Commentator, CAST_TEAM } from './commentary.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);

function hexA(hex, a) {
  if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, rr); return; }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export class BattleUI {
  constructor({ onQuit, onAgain }) {
    this.onQuit = onQuit;
    this.onAgain = onAgain;
    this.speed = 1;
    this.paused = false;
    this.running = false;
    this.stage = 'stadium';
    this.weather = 'clear';
    this.config = null;
    this.battle = null;
    this.scene = null;
    this.sceneT = 0;
    this.parts = [];
    this.fxList = [];
    this.texts = [];
    this.artRatio = {};
    this.shakeT = 0;
    this.shakeAmp = 0;
    this._endT = 0;
    this._hudT = 0;
    this._sfxAt = {};
    this._last = 0;
    this._clusterT = 0;
    this._alivePre = { A: 0, B: 0 };

    this.el = {
      wrap: $('#stageWrap'), scene: $('#sceneCanvas'), arena: $('#arenaCanvas'),
      banner: $('#banner'), hitstop: $('#hitstop'),
      time: $('#turnChip'), weatherChip: $('#weatherChip'), modeChip: $('#modeChip'),
      log: $('#battleLog'), logCount: $('#logCount'),
      rosterA: $('#rosterA .roster-list'), rosterB: $('#rosterB .roster-list'),
      hudA: $('#teamHudA'), hudB: $('#teamHudB'),
      castLines: $('#castLines'),
      pauseBtn: $('#pauseBtn'), speedGroup: $('#speedGroup'),
      result: $('#resultOverlay'), winner: $('#winnerTitle'), resultSub: $('#resultSub'),
      crown: $('#resultCrown'), mvp: $('#mvpBox'), stats: $('#statsTable'),
      mvpTitle: $('#mvpTitle')
    };
    this.actx = this.el.arena.getContext('2d');
    this._bind();
    this._loop = this._loop.bind(this);
    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(this.el.wrap);
  }

  _bind() {
    this.el.speedGroup.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        this.speed = Number(b.dataset.speed);
        this.el.speedGroup.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        sfx('click');
      });
    });
    this.el.pauseBtn.addEventListener('click', () => {
      this.paused = !this.paused;
      this.el.pauseBtn.textContent = this.paused ? '▶' : '⏸';
      this.el.pauseBtn.style.background = this.paused ? 'rgba(255,209,102,.35)' : '';
    });
  }

  resize() {
    const W = this.el.wrap.clientWidth || 900, H = this.el.wrap.clientHeight || 500;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cvW = W; this.cvH = H;
    this.el.arena.width = Math.round(W * dpr);
    this.el.arena.height = Math.round(H * dpr);
    this.actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const modeScale = this.config ? (this.config.teamA.length === 1 ? 1.26 : this.config.teamA.length === 2 ? 1.12 : 1) : 1;
    this.small = W < 560;
    this.unit = clamp(Math.min(W * 0.15, H * 0.2), this.small ? 42 : 54, 150) * modeScale * (this.small ? .92 : 1);
    if (this.scene) this.scene.resize();
  }

  /* ---------------- 준비 ---------------- */
  setup({ teamA, teamB, weather, stage }) {
    this.config = { teamA: teamA.slice(), teamB: teamB.slice(), weather, stage };
    this.stage = stage; this.weather = weather;
    this.paused = false; this.running = true;
    this.parts = []; this.fxList = []; this.texts = []; this._endT = 0;
    this.el.pauseBtn.textContent = '⏸'; this.el.pauseBtn.style.background = '';
    this.el.log.innerHTML = ''; this._logCount = 0;
    this.el.logCount.textContent = '';
    this.el.banner.className = 'banner'; this.el.banner.textContent = '';
    this.el.result.classList.remove('show');
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this.el.castLines.innerHTML = '<div class="cast-empty">중계 준비 중…</div>';
    this.el.weatherChip.innerHTML = `${weatherIcon(weather)}<span>${WEATHERS[weather].name}</span>`;
    this.el.modeChip.textContent = `${teamA.length} : ${teamB.length} 난투`;
    this.el.time.textContent = '00:00';
    this.el.stats.innerHTML = ''; this.el.mvp.innerHTML = '';

    if (this.scene) { this.scene.destroy(); this.scene = null; }
    this.scene = new ArenaScene(this.el.scene, stage, weather, false, false);
    this.sceneT = 0;
    this.resize();

    this._renderRoster('A', teamA);
    this._renderRoster('B', teamB);
    this._renderTeamHud('A', teamA);
    this._renderTeamHud('B', teamB);
    // 아트 비율 캐시
    for (const id of [...teamA, ...teamB]) {
      getArt(id).then((a) => {
        if (a.img && a.img.height) this.artRatio[id] = a.img.width / a.img.height;
      });
    }
    return this;
  }

  _renderRoster(side, team) {
    const box = side === 'A' ? this.el.rosterA : this.el.rosterB;
    box.innerHTML = '';
    team.forEach((id) => {
      const mon = monById(id);
      const row = document.createElement('div');
      row.className = 'roster-mon';
      row.dataset.id = id;
      row.innerHTML = `<img loading="lazy" alt=""><div class="rm-body"><span class="rm-name">${mon.n}</span><span class="rm-hpbar"><i style="width:100%"></i></span></div><span class="rm-hp">100%</span>`;
      getArt(id).then((a) => { if (a.src) row.querySelector('img').src = a.src; });
      box.appendChild(row);
    });
  }

  _renderTeamHud(side, team) {
    const box = side === 'A' ? this.el.hudA : this.el.hudB;
    box.innerHTML = '';
    team.forEach((id) => {
      const mon = monById(id);
      const row = document.createElement('div');
      row.className = 'th-row';
      row.dataset.id = id;
      row.innerHTML = `<span class="th-name">${mon.n}</span><span class="th-track"><i style="width:100%"></i></span><span class="th-status"></span>`;
      box.appendChild(row);
    });
  }

  /* ---------------- 시작 ---------------- */
  async run() {
    const { teamA, teamB, weather } = this.config;
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    this.battle = new ArenaBattle({ teamA, teamB, weather, seed });
    for (const f of this.battle.all) f.enterT = .55 + f.slot * .12;
    this.comm = new Commentator({
      n: teamA.length, aTeam: '내 팀', bTeam: '상대 팀',
      stageName: (ARENA_STAGES[this.stage] || {}).name || '아레나',
      mode: `${teamA.length} 대 ${teamA.length}`
    });
    this.comm.on({ t: 'start' });
    this._banner(`${teamA.length} : ${teamB.length} 난투 개시!`, 'start');
    this._alivePre = { A: this.battle.aliveA.length, B: this.battle.aliveB.length };
    this._last = performance.now();
    playCry(teamA[0], .2);
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(this._loop);
  }

  /* ---------------- 루프 ---------------- */
  _loop(ts) {
    if (!this.running) return;
    const raw = clamp((ts - (this._last || ts)) / 1000, 0, .06);
    this._last = ts;
    if (!this.paused) {
      let left = raw * this.speed;
      let steps = 0;
      while (left > 0 && steps < 10) {
        const s = Math.min(left, 1 / 60);
        this.battle.step(s);
        this._drain();
        left -= s; steps++;
      }
      this.sceneT += raw * this.speed * 1000;
      this.scene.tick(raw * this.speed * 1000);
      this._tickCommentary(raw);
      if (this.battle.finished) {
        this._endT += raw;
        if (this._endT > 1.3) { this._showResult(); return; }
      }
    }
    this._draw(raw);
    this._syncHud(raw);
    this._raf = requestAnimationFrame(this._loop);
  }

  _tickCommentary(dt) {
    if (!this.comm) return;
    const line = this.comm.tick(dt);
    if (line) this._castLine(line.who, line.text);
    // 팀파이트 감지
    this._clusterT -= dt;
    if (this._clusterT <= 0) {
      this._clusterT = 1.6;
      const alive = this.battle.all.filter((f) => f.alive);
      let best = 0;
      for (const a of alive) {
        let n = 0;
        for (const b of alive) if (this.battle.dist(a, b) < .34) n++;
        best = Math.max(best, n);
      }
      if (best >= Math.min(4, alive.length) && alive.length >= 4) this.comm.on({ t: 'teamfight', n: best });
      // 위기 상황
      for (const f of alive) {
        if (f.hp / f.maxHp < .16 && !f._lowSaid) { f._lowSaid = true; this.comm.on({ t: 'low', name: f.name }); }
        if (f.hp / f.maxHp > .4) f._lowSaid = false;
      }
      // 역전 감지
      const a = this.battle.aliveA.length, b = this.battle.aliveB.length;
      const pre = this._alivePre;
      if ((pre.A - pre.B) <= -1 && (a - b) >= 1 && !this._comebackSaid) { this._comebackSaid = true; this.comm.on({ t: 'comeback', side: 'A' }); }
      if ((pre.B - pre.A) <= -1 && (b - a) >= 1 && !this._comebackSaid) { this._comebackSaid = true; this.comm.on({ t: 'comeback', side: 'B' }); }
      this._alivePre = { A: a, B: b };
    }
  }

  /* ---------------- 이벤트 반영 ---------------- */
  _drain() {
    const evs = this.battle.takeEvents();
    for (const ev of evs) this._onEvent(ev);
  }

  _onEvent(ev) {
    const nameOf = (side, idx) => {
      const arr = side === 'A' ? this.battle.A : this.battle.B;
      return arr[idx] ? arr[idx].name : '?';
    };
    switch (ev.t) {
      case 'cast': {
        const f = (ev.side === 'A' ? this.battle.A : this.battle.B)[ev.idx];
        if (f) {
          f.bubble = { text: ev.moveName, color: ev.color || TYPE_COLORS[ev.type] || '#fff', t: 0, dur: 1.5, type: ev.type };
          f.castGlow = { color: ev.color, t: ev.dur };
        }
        this._sfx(ev.melee ? 'whoosh' : 'whoosh', .06, .5);
        break;
      }
      case 'hit': {
        if (ev.dot || ev.recoil) {
          this._text(ev.x, ev.y, `-${ev.amount}`, ev.recoil ? '#ffcf70' : '#c8a2ff', 13);
          break;
        }
        const color = ev.crit ? '#ffe066' : ev.eff >= 2 ? '#ff9a5c' : ev.eff < 1 ? '#9fb4d8' : '#ffffff';
        this._text(ev.x, ev.y, `-${ev.amount}`, color, ev.crit ? 24 : ev.eff >= 2 ? 21 : 18);
        this._burst(ev.x, ev.y, ev.type, ev.crit ? 16 : 9, ev.crit || ev.eff >= 2);
        if (ev.crit || ev.eff >= 2) { this._shake(ev.crit ? 6 : 3.5); this._hitstop(ev.crit); }
        this._sfx(ev.crit ? 'crit' : ev.eff >= 2 ? 'super' : 'hit', .05, ev.crit ? 1.2 : .8);
        this.comm.on({ ...ev, attName: nameOf(ev.aSide, ev.aIdx), defName: nameOf(ev.side, ev.idx) });
        break;
      }
      case 'dodge': {
        this._text(ev.x, ev.y, '회피!', '#8ff0ff', 17);
        this._puff(ev.x, ev.y, '#9fe8ff', 10);
        this._sfx('whoosh', .1, .4);
        this.comm.on(ev);
        break;
      }
      case 'miss': {
        const label = ev.reason === 'dodge' ? '회피!' : 'MISS';
        this._text(ev.x, ev.y, label, '#b8c8e8', 15);
        break;
      }
      case 'immune':
        this._text(ev.x, ev.y, '효과 없음', '#8b93ad', 14);
        break;
      case 'faint': {
        const f = (ev.side === 'A' ? this.battle.A : this.battle.B)[ev.idx];
        if (f) f.bubble = null;
        this._text(ev.x, ev.y, 'DOWN!', '#ffd166', 20);
        this._puff(ev.x, ev.y, '#ffd166', 16);
        this._sfx('faint', .2, 1);
        this.comm.on(ev);
        break;
      }
      case 'heal':
        this._text(ev.x, ev.y, `+${ev.amount}`, '#7bf0a8', 16);
        this._puff(ev.x, ev.y, '#8ff0b0', 8);
        this._sfx('heal', .4, .5);
        break;
      case 'status': {
        const f = (ev.side === 'A' ? this.battle.A : this.battle.B)[ev.idx];
        if (f) f.statusChip = ev.text;
        if (ev.status === 'slp') this._text(ev.x, ev.y, 'Zzz', '#b8c8e8', 15);
        break;
      }
      case 'cure': {
        const f = (ev.side === 'A' ? this.battle.A : this.battle.B)[ev.idx];
        if (f) f.statusChip = '';
        break;
      }
      case 'boost': {
        this._text(ev.x, ev.y, ev.delta > 0 ? '▲' : '▼', ev.delta > 0 ? '#8fd8ff' : '#ff9aa4', 15);
        break;
      }
      case 'fx':
        this._spawnFx(ev);
        break;
      case 'sudden':
        this._banner('서든데스!', 'crit');
        break;
      case 'log':
        this._log(ev.text, ev.cls);
        break;
      case 'end':
        this.endData = ev;
        this.comm.on(ev);
        break;
      default: break;
    }
  }

  /* ---------------- 이펙트 ---------------- */
  _sfx(kind, gap = .06, vol = 1) {
    const now = performance.now();
    if (this._sfxAt[kind] && now - this._sfxAt[kind] < gap * 1000) return;
    this._sfxAt[kind] = now;
    try { sfx(kind, vol); } catch (e) { /* noop */ }
  }

  _shake(power) { this.shakeT = .22; this.shakeAmp = Math.max(this.shakeAmp, power); }
  _hitstop(strong) {
    const h = this.el.hitstop;
    h.className = 'stage-hitstop';
    void h.offsetWidth;
    h.classList.add(strong ? 'flash' : 'freeze');
  }

  _spawnFx(ev) {
    const dur = ev.fx === 'zone' ? ev.dur : .34;
    this.fxList.push({ ...ev, t: 0, dur, seed: rnd(10) });
    const W = this.cvW, H = this.cvH;
    const p = project(ev.x, ev.y, W, H);
    const t2 = ev.tx !== undefined ? project(ev.tx, ev.ty, W, H) : null;
    switch (ev.fx) {
      case 'muzzle':
        this._puff(ev.x, ev.y, ev.color, 4, .5);
        break;
      case 'impact':
        this._burst(ev.x, ev.y, null, 12, false, ev.color);
        break;
      case 'rush':
        for (let i = 0; i < 8; i++) {
          this.parts.push({
            x: p.x + rnd(20, -20), y: p.y - rnd(30, 5), vx: rnd(20, -20), vy: rnd(-10, -50),
            life: .3, max: .3, size: rnd(5, 2), color: ev.color, type: 'line'
          });
        }
        break;
      case 'zonehit':
        this._burst(ev.x, ev.y, null, 22, true, ev.color);
        this._shake(3);
        break;
      case 'buff':
        for (let i = 0; i < 12; i++) {
          this.parts.push({ x: p.x + rnd(26, -26), y: p.y - rnd(8), vx: rnd(8, -8), vy: rnd(-25, -60), life: .7, max: .7, size: rnd(4, 1.6), color: ev.color, type: 'dot' });
        }
        break;
      case 'shield':
        this._ring(ev.x, ev.y, '#8fd8ff');
        break;
      default: break;
    }
  }

  _puff(x, y, color, n = 8, size = 1) {
    const W = this.cvW, H = this.cvH;
    const p = project(x, y, W, H);
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: p.x + rnd(10, -10), y: p.y - rnd(24, 0), vx: rnd(60, -60), vy: rnd(-20, -80),
        life: .45, max: .45, size: rnd(6, 2) * size, color, type: 'dot'
      });
    }
  }

  _burst(x, y, type, n = 10, strong = false, colorOverride) {
    const W = this.cvW, H = this.cvH;
    const p = project(x, y, W, H);
    const col = colorOverride || (type ? TYPE_COLORS[type] : '#ffffff') || '#fff';
    for (let i = 0; i < n; i++) {
      const a = rnd(TAU);
      const sp = rnd(strong ? 260 : 170, 40);
      this.parts.push({
        x: p.x, y: p.y - 18, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .6 - 40,
        life: .55, max: .55, size: rnd(strong ? 8 : 5.5, 1.8), color: i % 3 === 0 ? '#ffffff' : col,
        type: i % 4 === 0 ? 'spark' : 'dot'
      });
    }
    if (strong) this.fxList.push({ fx: 'ring', x, y, t: 0, dur: .34, color: col });
  }

  _ring(x, y, color) {
    this.fxList.push({ fx: 'ring', x, y, t: 0, dur: .45, color });
  }

  _text(x, y, text, color = '#fff', size = 18) {
    if (this.small) size *= .82;
    const W = this.cvW, H = this.cvH;
    const p = project(x, y, W, H);
    let ty = p.y - this.unit * .5;
    for (let i = 0; i < 4; i++) {
      const clash = this.texts.some((o) => o.life > .5 && Math.abs(o.x - p.x) < 30 && Math.abs(o.y - ty) < 20);
      if (!clash) break;
      ty -= 20;
    }
    this.texts.push({ x: p.x + rnd(14, -14), y: ty, text, color, size, life: .85, max: .85 });
    while (this.texts.length > 40) this.texts.shift();
  }

  /* ---------------- 그리기 ---------------- */
  _draw(dt) {
    const ctx = this.actx, W = this.cvW, H = this.cvH;
    ctx.clearRect(0, 0, W, H);
    const t = this.sceneT / 1000;
    // 흔들림
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * (this.shakeT / .22);
      ctx.save();
      ctx.translate(rnd(a, -a), rnd(a, -a) * .6);
    } else { ctx.save(); this.shakeAmp = 0; }

    this._drawZones(ctx, W, H, t);

    const actors = [];
    for (const p of this.scene.props) actors.push({ y: p.fy, prop: p });
    for (const f of this.battle.all) actors.push({ y: f.y, f });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a.f) this._drawFighter(ctx, a.f, W, H, t);
      else this.scene.drawProp(ctx, a.prop, t, W, H);
    }

    this._drawProjectiles(ctx, W, H, t);
    this._drawFx(ctx, W, H, t);
    this._drawParts(ctx, dt);
    this._drawBars(ctx, W, H);
    this._drawBubbles(ctx, W, H);
    this._drawTexts(ctx, dt);
    ctx.restore();
    this._drawFront(ctx, W, H, t, dt);
  }

  _drawZones(ctx, W, H, t) {
    for (const z of this.battle.zones) {
      const p = project(z.x, z.y, W, H);
      const rx = z.r * W * .92, ry = z.r * H * .55;
      const prog = z.phase === 'tell' ? clamp(z.t / z.tell, 0, 1) : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rx);
      const col = z.spec.color || '#fff';
      g.addColorStop(0, hexA(col, z.phase === 'live' ? .38 : .10 + prog * .18));
      g.addColorStop(.7, hexA(col, .12));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(col, z.phase === 'live' ? .65 : .45 + prog * .3);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, rx * prog, ry * prog, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  _drawFighter(ctx, f, W, H, t) {
    const p = project(f.x, f.y, W, H);
    const h = this.unit * p.s;
    const alive = f.alive;
    const deadT = clamp(f.deadT / .9, 0, 1);
    ctx.save();
    // 그림자
    ctx.globalAlpha = alive ? .34 : .18 * (1 - deadT);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, h * .26, h * .075, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    // 팀 링
    const ring = f.side === 'A' ? 'rgba(90,160,255,' : 'rgba(255,90,110,';
    ctx.strokeStyle = ring + (alive ? (f.side === 'A' ? .5 : .42) : .12) + ')';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, h * .24, h * .07, 0, 0, TAU); ctx.stroke();

    if (!alive) {
      if (deadT >= 1) { ctx.restore(); return; }
      ctx.globalAlpha = 1 - deadT;
    }

    // 회피 잔상
    const art0 = this._art(f.dex.id);
    const asp0 = this.artRatio[f.dex.id] || .92;
    for (const a of f.after) {
      const ap = project(a.x, a.y, W, H);
      const ah = this.unit * ap.s;
      const aw = Math.min(ah * asp0, ah * 1.25);
      ctx.globalAlpha = (a.life / .2) * .34;
      if (art0) {
        ctx.save();
        ctx.translate(ap.x, ap.y);
        if (f.face < 0) ctx.scale(-1, 1);
        ctx.filter = 'saturate(2.2) brightness(1.3)';
        ctx.drawImage(art0, -aw / 2, -ah * .84, aw, ah);
        ctx.restore();
      } else {
        ctx.fillStyle = f.side === 'A' ? '#8fc0ff' : '#ff98a4';
        ctx.beginPath(); ctx.ellipse(ap.x, ap.y - h * .32, h * .2, h * .34, 0, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = alive ? 1 : (1 - deadT);

    // 진입 애니메이션
    let enter = 1;
    if (f.enterT > 0) { f.enterT -= .016; enter = 1 + Math.max(0, f.enterT) * .9; }

    const bob = Math.sin(t * 3 + f.phase) * h * .016;
    const lunge = f.lungeT > 0 ? Math.sin((f.lungeT / .22) * Math.PI) * h * .1 * (f.face) : 0;
    const shake = f.hitFlash > 0 ? Math.sin(this.sceneT * .09) * h * .02 * (f.hitFlash / .18) : 0;
    const cx = p.x + lunge + shake;
    const cy = p.y + bob;

    // 시전 오라
    if (f.cast && f.castGlow) {
      const g = ctx.createRadialGradient(cx, cy - h * .3, 0, cx, cy - h * .3, h * .5);
      g.addColorStop(0, hexA(f.castGlow.color, .28)); g.addColorStop(1, hexA(f.castGlow.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy - h * .3, h * .5, 0, TAU); ctx.fill();
    }

    const img = this._art(f.dex.id);
    // 피격 섬광
    if (f.hitFlash > 0) {
      const g = ctx.createRadialGradient(cx, cy - h * .34, 0, cx, cy - h * .34, h * .55);
      g.addColorStop(0, `rgba(255,255,255,${(f.hitFlash / .18) * .22})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy - h * .34, h * .55, 0, TAU); ctx.fill();
    }
    ctx.save();
    if (!alive) ctx.filter = 'grayscale(1) brightness(.55)';
    ctx.translate(cx, cy);
    if (!alive) ctx.rotate(-deadT * .5);
    const face = f.face;
    const aspect = this.artRatio[f.dex.id] || .92;
    const dh = h * enter;
    const dw = Math.min(dh * aspect, h * 1.25);
    if (face < 0) ctx.scale(-1, 1);
    if (img) {
      ctx.drawImage(img, -dw / 2, -dh * .84, dw, dh);
    } else {
      const tc = TYPE_COLORS[f.dex.t[0]] || '#889';
      const g = ctx.createRadialGradient(0, -dh * .4, 0, 0, -dh * .4, dh * .4);
      g.addColorStop(0, tc); g.addColorStop(1, '#0b1020');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -dh * .4, dh * .34, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // 상태이상 표시 (머리 위 작은 아이콘)
    if (alive && f.status) {
      const icons = { brn: '🔥', par: '⚡', psn: '☠', slp: '💤', frz: '❄' };
      ctx.font = `${Math.max(9, h * .13)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(icons[f.status] || '', cx + h * .26, cy - h * .72);
    }
    ctx.restore();
  }

  _art(id) {
    if (!this._artCache) this._artCache = {};
    if (this._artCache[id] !== undefined) return this._artCache[id];
    this._artCache[id] = null;
    getArt(id).then((a) => { this._artCache[id] = a.img || null; });
    return null;
  }

  _drawBars(ctx, W, H) {
    const fs = clamp(this.unit * .105, 9, 12);
    for (const f of this.battle.all) {
      if (!f.alive) continue;
      const p = project(f.x, f.y, W, H);
      const h = this.unit * p.s;
      const bw = clamp(h * .5, this.small ? 32 : 40, 76);
      const bx = p.x - bw / 2;
      const by = p.y - h * .86 - fs - 12;
      const pct = clamp(f.hp / f.maxHp, 0, 1);
      // 이름
      if (!this.small) {
        ctx.font = `800 ${fs}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = f.side === 'A' ? '#bcd6ff' : '#ffc2c8';
        ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = 4;
        ctx.fillText(f.name, p.x, by - 3);
        ctx.shadowBlur = 0;
      }
      // HP
      ctx.fillStyle = 'rgba(6,10,20,.72)';
      roundRect(ctx, bx - 1, by, bw + 2, 6, 3); ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      if (pct > .5) { g.addColorStop(0, '#35d17f'); g.addColorStop(1, '#8bf0b4'); }
      else if (pct > .22) { g.addColorStop(0, '#e8b93a'); g.addColorStop(1, '#ffe08a'); }
      else { g.addColorStop(0, '#e83a3a'); g.addColorStop(1, '#ff8a8a'); }
      ctx.fillStyle = g;
      roundRect(ctx, bx, by + 1, Math.max(0, bw * pct), 4, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
      roundRect(ctx, bx - 1, by, bw + 2, 6, 3); ctx.stroke();
      // 시전 게이지
      if (f.cast) {
        const cp = clamp(f.cast.t / f.cast.dur, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        roundRect(ctx, bx, by + 8, bw, 2.4, 1.2); ctx.fill();
        ctx.fillStyle = hexA(f.bubble?.color || '#ffe066', .9);
        roundRect(ctx, bx, by + 8, bw * cp, 2.4, 1.2); ctx.fill();
      }
    }
  }

  _drawBubbles(ctx, W, H) {
    const list = [];
    for (const f of this.battle.all) {
      if (!f.bubble) continue;
      f.bubble.t += 1 / 60;
      if (f.bubble.t > f.bubble.dur) { f.bubble = null; continue; }
      const p = project(f.x, f.y, W, H);
      const h = this.unit * p.s;
      const fs = clamp(h * .135, this.small ? 9 : 10, this.small ? 12.5 : 15);
      list.push({ f, p, h, b: f.bubble, fs });
    }
    // 크기 측정
    for (const it of list) {
      const fs = it.fs;
      ctx.font = `900 ${fs}px system-ui, sans-serif`;
      const tw = ctx.measureText(it.b.text).width;
      const padX = fs * .62;
      it.bw = tw + padX * 2 + fs * .55;
      it.bh = fs * 1.85;
      it.bx = clamp(it.p.x - it.bw / 2, 4, W - it.bw - 4);
      it.by = it.p.y - it.h * .86 - 34 - it.bh;
      it.lift = 0;
    }
    // 겹침 해소
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const a = list[i], b = list[j];
          const ay = a.by - a.lift, by = b.by - b.lift;
          if (Math.abs((a.bx + a.bw / 2) - (b.bx + b.bw / 2)) < (a.bw + b.bw) / 2 + 4 && Math.abs(ay - by) < a.bh + 4) {
            a.lift = Math.max(a.lift, b.lift + b.bh + 4);
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    for (const it of list) {
      const { p, h, b, fs, bw, bh } = it;
      const t = b.t / b.dur;
      const alpha = t < .1 ? t / .1 : t > .75 ? (1 - t) / .25 : 1;
      const scale = t < .12 ? .7 + (t / .12) * .3 : 1;
      const bx = it.bx;
      const by = it.by - it.lift;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.translate(bx + bw / 2, by + bh / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(bx + bw / 2), -(by + bh / 2));
      const tailX = clamp(p.x, bx + 10, bx + bw - 10);
      if (it.lift > 0) {
        ctx.strokeStyle = hexA(b.color, .35);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(tailX, by + bh + 6);
        ctx.lineTo(p.x, p.y - h * .86 - 6);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.moveTo(tailX - 5, by + bh - .5);
      ctx.lineTo(tailX + 1, by + bh + 7);
      ctx.lineTo(tailX + 6, by + bh - .5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(9,14,26,.94)';
      ctx.fill();
      ctx.fillStyle = 'rgba(9,14,26,.94)';
      ctx.strokeStyle = hexA(b.color, .85);
      ctx.lineWidth = 1.6;
      roundRect(ctx, bx, by, bw, bh, bh * .42);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(bx + fs * .45, by + bh / 2, fs * .24, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${fs}px system-ui, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(b.text, bx + fs * .45 + fs * .55, by + bh / 2 + .5);
      ctx.restore();
    }
  }

  _drawProjectiles(ctx, W, H, t) {
    for (const p of this.battle.projectiles) {
      const s = project(p.x, p.y, W, H);
      const size = clamp(this.unit * .1 * s.s, 3, 12) * (p.spec.big ? 1.6 : 1);
      const col = p.spec.color || '#fff';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // 꼬리
      const back = project(p.x - p.vx * .05, p.y - p.vy * .05, W, H);
      const grad = ctx.createLinearGradient(back.x, back.y, s.x, s.y);
      grad.addColorStop(0, hexA(col, 0));
      grad.addColorStop(1, hexA(col, .55));
      ctx.strokeStyle = grad;
      ctx.lineWidth = size * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(back.x, back.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      // 본체
      const g = ctx.createRadialGradient(s.x, s.y - 6, 0, s.x, s.y - 6, size * 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(.35, col);
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y - 6, size * 2, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  _drawFx(ctx, W, H, t) {
    const keep = [];
    for (const fx of this.fxList) {
      fx.t += 1 / 60;
      const k = fx.t / fx.dur;
      if (k >= 1) continue;
      const a = project(fx.x, fx.y, W, H);
      const col = fx.color || '#ffffff';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      switch (fx.fx) {
        case 'ring': {
          const r = (this.unit * .16 + k * this.unit * .5);
          ctx.strokeStyle = hexA(col, (1 - k) * .8);
          ctx.lineWidth = 3 * (1 - k) + 1;
          ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * .45, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'beam': {
          const b = project(fx.tx, fx.ty, W, H);
          const w = (fx.big ? 18 : 9) * (1 - k * .6) * (this.unit / 120);
          const hx = fx.whiff ? b.x + (b.x - a.x) * .26 : b.x;
          const hy = fx.whiff ? b.y - this.unit * .18 : b.y - this.unit * .3;
          // 발사 지점 섬광
          const g0 = ctx.createRadialGradient(a.x, a.y - this.unit * .3, 0, a.x, a.y - this.unit * .3, this.unit * .22);
          g0.addColorStop(0, hexA('#ffffff', (1 - k) * .9)); g0.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(a.x, a.y - this.unit * .3, this.unit * .22, 0, TAU); ctx.fill();
          ctx.strokeStyle = hexA(col, (1 - k) * .9);
          ctx.shadowColor = col; ctx.shadowBlur = 24;
          ctx.lineWidth = w;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(a.x, a.y - this.unit * .3); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.92)';
          ctx.lineWidth = w * .34;
          ctx.beginPath(); ctx.moveTo(a.x, a.y - this.unit * .3); ctx.lineTo(hx, hy); ctx.stroke();
          if (!fx.whiff) {
            const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, this.unit * .26);
            g.addColorStop(0, hexA('#ffffff', (1 - k) * .95)); g.addColorStop(1, hexA(col, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, this.unit * .26, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'bolt': {
          const b = project(fx.tx, fx.ty, W, H);
          const top = H * .205;
          ctx.strokeStyle = hexA(col, (1 - k) * .95);
          ctx.shadowColor = col; ctx.shadowBlur = 30;
          ctx.lineWidth = (fx.big ? 9 : 5.5) * (1 - k * .55);
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          const jag = (x0, y0, x1, y1, wob) => {
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            let px = x0, py = y0;
            const steps = 7;
            for (let i = 1; i <= steps; i++) {
              const ny = y0 + (y1 - y0) * (i / steps);
              const nx = x1 + (i === steps ? 0 : rnd(wob, -wob) * (1 - i / steps));
              ctx.lineTo(nx, ny);
              px = nx; py = ny;
            }
            ctx.stroke();
          };
          jag(b.x - 6, top, b.x, b.y, 26);
          ctx.lineWidth *= .5;
          jag(b.x + 10, b.y - this.unit * .9, b.x + this.unit * .35, b.y + 6, 16);
          jag(b.x - 12, b.y - this.unit * .7, b.x - this.unit * .3, b.y + 2, 14);
          // 임팩트 섬광
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, this.unit * .34);
          g.addColorStop(0, hexA('#ffffff', (1 - k) * .95));
          g.addColorStop(.4, hexA(col, (1 - k) * .65));
          g.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, this.unit * .34, 0, TAU); ctx.fill();
          break;
        }
        case 'pillar': {
          const b = project(fx.tx, fx.ty, W, H);
          const top = b.y - H * .34;
          const g = ctx.createLinearGradient(0, top, 0, b.y);
          g.addColorStop(0, hexA(col, 0));
          g.addColorStop(.55, hexA(col, (1 - k) * .22));
          g.addColorStop(.88, hexA(col, (1 - k) * .5));
          g.addColorStop(1, hexA(col, (1 - k) * .12));
          ctx.fillStyle = g;
          const pw = (fx.big ? 30 : 18) * (this.unit / 120) * (1 - k * .45);
          ctx.beginPath();
          ctx.moveTo(b.x - pw * .35, top);
          ctx.lineTo(b.x + pw * .35, top);
          ctx.lineTo(b.x + pw, b.y);
          ctx.lineTo(b.x - pw, b.y);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'zone': {
          // sim zone에서 그림 (여기서는 진입 섬광만)
          if (k < .25) {
            ctx.strokeStyle = hexA(col, (1 - k / .25) * .9);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.ellipse(a.x, a.y, fx.r * W * .92, fx.r * H * .55, 0, 0, TAU); ctx.stroke();
          }
          break;
        }
        case 'stream': {
          const b = project(fx.tx, fx.ty, W, H);
          if (k < .5) {
            for (let i = 0; i < 9; i++) {
              const tt = rnd(1);
              ctx.fillStyle = hexA(col, (1 - k) * .6);
              ctx.beginPath();
              ctx.arc(a.x + (b.x - a.x) * tt, a.y - this.unit * .3 + (b.y - a.y) * tt + rnd(16, -16), 3 + rnd(4), 0, TAU);
              ctx.fill();
            }
          }
          break;
        }
        case 'wave': {
          const b = project(fx.tx, fx.ty, W, H);
          const r = this.unit * .1 + k * this.unit * .55;
          ctx.strokeStyle = hexA(col, (1 - k) * .8);
          ctx.lineWidth = 4 * (1 - k) + 1;
          ctx.beginPath(); ctx.ellipse(b.x, b.y, r, r * .5, 0, 0, TAU); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) * .5 + ')';
          ctx.beginPath(); ctx.ellipse(b.x, b.y, r * .7, r * .35, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'bite': {
          const b = project(fx.tx, fx.ty, W, H);
          if (k < .4) {
            const sc = this.unit * .2 * (1 + k * .6);
            ctx.fillStyle = hexA('#ffffff', (1 - k / .4) * .9);
            ctx.shadowColor = col; ctx.shadowBlur = 16;
            for (const s2 of [-1, 1]) {
              ctx.beginPath();
              ctx.moveTo(b.x - sc, b.y - this.unit * .28 + s2 * sc * .5);
              ctx.lineTo(b.x + sc * .2, b.y - this.unit * .28 + s2 * sc * .1);
              ctx.lineTo(b.x - sc * .2, b.y - this.unit * .28 + s2 * sc * .9);
              ctx.closePath(); ctx.fill();
            }
          }
          break;
        }
        case 'slash':
        case 'rush': {
          const b = project(fx.tx, fx.ty, W, H);
          if (k < .45) {
            ctx.strokeStyle = hexA('#ffffff', (1 - k / .45) * .9);
            ctx.shadowColor = col; ctx.shadowBlur = 18;
            ctx.lineWidth = 3.4;
            for (let i = 0; i < 3; i++) {
              const off = (i - 1) * 12;
              ctx.beginPath();
              ctx.arc(b.x, b.y - this.unit * .3, this.unit * .17 + off * .3, -1.1 + i * .2, 1.1 + i * .2);
              ctx.stroke();
            }
          }
          break;
        }
        case 'burst': {
          const b = project(fx.tx, fx.ty, W, H);
          if (k < .3) {
            const g = ctx.createRadialGradient(b.x, b.y - 20, 0, b.x, b.y - 20, this.unit * .5 * (1 + k));
            g.addColorStop(0, 'rgba(255,255,255,.9)');
            g.addColorStop(.4, hexA(col, .6 * (1 - k / .3)));
            g.addColorStop(1, hexA(col, 0));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(b.x, b.y - 20, this.unit * .6, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'shadow': {
          const b = project(fx.tx, fx.ty, W, H);
          ctx.fillStyle = hexA('#1a1030', (1 - k) * .8);
          ctx.beginPath(); ctx.ellipse(b.x, b.y - this.unit * .3, this.unit * .24 * (1 + k), this.unit * .2 * (1 + k), 0, 0, TAU); ctx.fill();
          break;
        }
        case 'cage': {
          const b = project(fx.tx, fx.ty, W, H);
          ctx.strokeStyle = hexA(col, (1 - k) * .85);
          ctx.lineWidth = 2;
          for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * TAU + t;
            const r = this.unit * .3;
            ctx.beginPath();
            ctx.moveTo(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r * .45);
            ctx.lineTo(b.x + Math.cos(ang) * r, b.y - this.unit * .4);
            ctx.stroke();
          }
          ctx.beginPath(); ctx.ellipse(b.x, b.y, this.unit * .3, this.unit * .14, 0, 0, TAU); ctx.stroke();
          break;
        }
        case 'status': {
          const b = project(fx.tx, fx.ty, W, H);
          ctx.fillStyle = hexA(col, (1 - k) * .5);
          for (let i = 0; i < 8; i++) {
            ctx.beginPath(); ctx.arc(b.x + rnd(24, -24), b.y - rnd(40, 0), 3 + rnd(3), 0, TAU); ctx.fill();
          }
          break;
        }
        default: break;
      }
      ctx.restore();
      keep.push(fx);
    }
    this.fxList = keep;
  }

  _drawParts(ctx, dt) {
    const keep = [];
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 320 * dt;
      p.vx *= .96; p.vy *= .97;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.type === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * .5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .04, p.y - p.vy * .04); ctx.stroke();
      } else if (p.type === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * .5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .02); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, TAU); ctx.fill();
      }
      ctx.restore();
      keep.push(p);
    }
    this.parts = keep.length > 420 ? keep.slice(keep.length - 420) : keep;
  }

  _drawTexts(ctx, dt) {
    const keep = [];
    for (const tx of this.texts) {
      tx.life -= dt;
      if (tx.life <= 0) continue;
      const k = 1 - tx.life / tx.max;
      const a = k < .15 ? k / .15 : k > .6 ? (1 - k) / .4 : 1;
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.font = `900 ${tx.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,10,20,.8)';
      ctx.strokeText(tx.text, tx.x, tx.y - k * 26);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y - k * 26);
      ctx.restore();
      keep.push(tx);
    }
    this.texts = keep;
  }

  _drawFront(ctx, W, H, t, dt) {
    // 하단 비네트 + 대기 안개
    const g = ctx.createLinearGradient(0, H * .86, 0, H);
    g.addColorStop(0, 'rgba(4,7,16,0)');
    g.addColorStop(1, 'rgba(4,7,16,.26)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * .82, W, H * .18);

    // 날씨 전면 입자
    if (this.weather === 'rain' || this.weather === 'hail' || this.weather === 'sand') {
      if (!this._front || this._front.length !== 26) {
        this._front = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(1.4, .5) }));
      }
      ctx.save();
      if (this.weather === 'rain') {
        ctx.strokeStyle = 'rgba(190,225,255,.3)'; ctx.lineWidth = 1.4;
        for (const p of this._front) {
          p.y += p.s * .03; if (p.y > 1) p.y = 0;
          ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(p.x * W - 4, p.y * H + 22); ctx.stroke();
        }
      } else {
        for (const p of this._front) {
          p.y += p.s * .012; if (p.y > 1) p.y = 0;
          ctx.fillStyle = this.weather === 'hail' ? 'rgba(255,255,255,.5)' : 'rgba(245,220,170,.28)';
          ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s * 1.6, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  /* ---------------- HUD ---------------- */
  _syncHud(dt) {
    this._hudT += dt;
    if (this._hudT < .08) return;
    this._hudT = 0;
    if (!this.battle) return;
    const mm = Math.floor(this.battle.time / 60), ss = Math.floor(this.battle.time % 60);
    this.el.time.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    for (const f of this.battle.all) {
      const pct = clamp(f.hp / f.maxHp, 0, 1);
      const rowSel = f.side === 'A' ? this.el.hudA : this.el.hudB;
      const row = rowSel.querySelector(`.th-row[data-id="${f.dex.id}"]`);
      if (row) {
        const bar = row.querySelector('.th-track i');
        bar.style.width = (pct * 100) + '%';
        bar.className = pct <= .22 ? 'low' : pct <= .5 ? 'mid' : '';
        row.classList.toggle('dead', !f.alive);
        const st = row.querySelector('.th-status');
        st.textContent = f.status ? ({ brn: '화', par: '마', psn: '독', slp: '잠', frz: '얼' }[f.status] || '') : '';
      }
      const roster = f.side === 'A' ? this.el.rosterA : this.el.rosterB;
      const rr = roster.querySelector(`.roster-mon[data-id="${f.dex.id}"]`);
      if (rr) {
        const hpEl = rr.querySelector('.rm-hp');
        const fill = rr.querySelector('.rm-hpbar i');
        hpEl.textContent = Math.round(pct * 100) + '%';
        hpEl.style.color = pct <= .22 ? '#ff8a8a' : pct <= .5 ? '#ffd166' : '#7bf0a8';
        fill.style.width = (pct * 100) + '%';
        rr.classList.toggle('dead', !f.alive);
      }
    }
  }

  _log(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'log-line ' + cls;
    d.textContent = text;
    this.el.log.appendChild(d);
    this.el.log.scrollTop = this.el.log.scrollHeight;
    this._logCount++;
    this.el.logCount.textContent = this._logCount + '줄';
    while (this.el.log.children.length > 220) this.el.log.firstChild.remove();
  }

  _castLine(who, text) {
    if (!this.el.castLines.querySelector('.cast-empty')) { /* ok */ }
    const empty = this.el.castLines.querySelector('.cast-empty');
    if (empty) empty.remove();
    const d = document.createElement('div');
    d.className = `cast-line ${who}`;
    d.innerHTML = `<i>${who === 'caster' ? CAST_TEAM.caster.emoji : CAST_TEAM.analyst.emoji}</i><span>${text}</span>`;
    this.el.castLines.appendChild(d);
    const kids = [...this.el.castLines.children];
    while (kids.length > 2) { kids.shift().remove(); }
    requestAnimationFrame(() => d.classList.add('show'));
  }

  _banner(text, kind = '') {
    const b = this.el.banner;
    b.className = 'banner ' + kind;
    b.textContent = text;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.remove('show'), 1100);
  }

  /* ---------------- 종료 ---------------- */
  finish() {
    if (this.battle && !this.battle.finished) {
      this.battle._finishByTime();
      this.endData = this.battle.result;
    } else if (this.battle) this.endData = this.battle.result;
    this.running = false;
    this._showResult();
  }

  async _showResult() {
    this.running = false;
    const end = this.endData || (this.battle && this.battle.result);
    if (!end) return;
    const el = this.el;
    el.result.classList.add('show');
    if (end.winner === 'A') {
      el.winner.textContent = '승리!';
      el.winner.className = '';
      el.crown.textContent = '👑';
      el.resultSub.textContent = `${Math.round(end.duration)}초 난투 끝에 상대 팀을 모두 쓰러뜨렸습니다!`;
      sfx('win');
    } else if (end.winner === 'B') {
      el.winner.textContent = '패배…';
      el.winner.className = 'lose';
      el.crown.textContent = '💤';
      el.resultSub.textContent = `${Math.round(end.duration)}초 난투 끝에 패배했습니다. 다시 도전해 보세요.`;
      sfx('lose');
    } else {
      el.winner.textContent = '무승부';
      el.winner.className = 'draw';
      el.crown.textContent = '🤝';
      el.resultSub.textContent = '양 팀 모두 끝까지 버텼습니다.';
    }
    const mvp = end.mvp;
    if (mvp) {
      const art = await getArt(mvp.id);
      el.mvp.innerHTML = `<img alt=""><div class="mvp-info"><span>MVP</span><b>${mvp.name}</b><small>피해 ${mvp.dmg.toLocaleString()} · ${mvp.kos} KO · 회피 ${mvp.dodges}회${mvp.survived ? ' · 생존' : ''}</small></div>`;
      if (art.src) el.mvp.querySelector('img').src = art.src;
    }
    const maxDmg = Math.max(1, ...[...end.stats.A, ...end.stats.B].map((s) => s.dmg));
    const rows = (stats, label) => `
      <div class="rs-team">
        <h5>${label}</h5>
        ${stats.map((s) => `<div class="rs-row${s.survived ? '' : ' out'}">
            <img alt="" data-id="${s.id}">
            <span class="rs-name">${s.name}<em>${s.kos}K · ${s.dodges}회피</em></span>
            <span class="rs-bar"><i style="width:${Math.round((s.dmg / maxDmg) * 100)}%"></i></span>
            <span class="rs-dmg">${s.dmg.toLocaleString()}</span>
          </div>`).join('')}
      </div>`;
    el.stats.innerHTML = rows(end.stats.A, '내 팀') + rows(end.stats.B, '상대 팀');
    el.stats.querySelectorAll('img[data-id]').forEach(async (img) => {
      const a = await getArt(Number(img.dataset.id));
      if (a.src) img.src = a.src;
    });
    const rl = document.querySelector('#resultLog');
    if (rl) {
      rl.innerHTML = '';
      [...this.el.log.children].forEach((n) => rl.appendChild(n.cloneNode(true)));
      rl.scrollTop = 0;
    }
  }

  info() {
    const b = this.battle;
    return {
      running: this.running, paused: this.paused, finished: !!(b && b.finished),
      time: b ? +b.time.toFixed(2) : 0,
      fighters: b ? b.all.length : 0,
      alive: b ? [b.aliveA.length, b.aliveB.length] : null,
      bubbles: b ? b.all.filter((f) => f.bubble).length : 0,
      fx: this.fxList.length, parts: this.parts.length,
      casts: b ? b.castCount : 0, dodges: b ? b.dodgeCount : 0, hits: b ? b.hitCount : 0,
      proj: b ? b.projectiles.length : 0, zones: b ? b.zones.length : 0,
      castLines: this.el.castLines.querySelectorAll('.cast-line').length,
      banner: this.el.banner.textContent,
      result: b && b.result ? { winner: b.result.winner, dur: +b.result.duration.toFixed(2), mvp: b.result.mvp.name } : null,
      W: this.cvW, H: this.cvH, unit: Math.round(this.unit),
      pos: b ? b.all.map((f) => { const p = project(f.x, f.y, this.cvW, this.cvH); return { n: f.name, x: Math.round(p.x), y: Math.round(p.y), h: Math.round(this.blue === undefined ? this.unit * p.s : this.unit * p.s) }; }) : null
    };
  }

  destroy() {
    this.running = false;
    this.paused = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this.scene) { this.scene.destroy(); this.scene = null; }
  }
}
