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
import {
  drawProjectile, drawCast, drawHitState, drawZoneDecor, emitCastParticles, drawParticle,
  impactBurst, emitLeaves, emitWater, emitSpark, emitEmber, emitFrost, emitDust,
  emitPoison, emitWisp, shapeOf, gimmickOf
} from './fx-arena.js';

/* 기본 배속 — 1x의 실제 시뮬레이션 시간 배율(연출·중계를 따라가기 쉽게 0.65배) */
export const SPEED_BASE = 0.65;

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
    const scale = this.speed * SPEED_BASE;
    const sdt = this.paused ? 0 : raw * scale;
    if (!this.paused) {
      let left = raw * scale;
      let steps = 0;
      while (left > 0 && steps < 10) {
        const s = Math.min(left, 1 / 60);
        this.battle.step(s);
        this._drain();
        left -= s; steps++;
      }
      this.sceneT += sdt * 1000;
      this.scene.tick(sdt * 1000);
      this._tickCommentary(sdt);
      if (this.battle.finished) {
        this._endT += raw;
        if (this._endT > 1.3) { this._showResult(); return; }
      }
    }
    this._draw(raw, sdt);
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
        const strong = ev.crit || ev.eff >= 2;
        this._burst(ev.x, ev.y, ev.type, strong ? 16 : 9, strong);
        // 피겨 몸에 붙는 타입별 피격 상태 연출 (감전·화상·빙결 등)
        const df = (ev.side === 'A' ? this.battle.A : this.battle.B)[ev.idx];
        if (df) {
          df.hitFx = {
            type: ev.type, t: 0, dur: strong ? .8 : .62,
            color: TYPE_COLORS[ev.type] || '#ffffff', second: '#ffffff', strong
          };
          df.zapT = (df.zapT || 0) + 1;
        }
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
        if (f && ['brn', 'par', 'frz', 'psn'].includes(ev.status)) {
          const stType = { brn: '불꽃', par: '전기', frz: '얼음', psn: '독' }[ev.status];
          f.hitFx = { type: stType, t: 0, dur: .8, color: TYPE_COLORS[stType] || '#fff', second: '#ffffff' };
        }
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
    // 기술 종류별 연출 지속시간
    const durMap = {
      stream: ev.big ? .72 : .6, beam: .46, bolt: .5, wave: .55, burst: .55,
      pillar: .6, shadow: .55, cage: .6, drain: .5, bite: .34, slash: .34, rush: .34,
      zone: ev.dur, zonehit: .4, ring: .45, muzzle: .3, impact: .3, buff: .7, shield: .5, status: .6
    };
    const dur = durMap[ev.fx] !== undefined ? durMap[ev.fx] : .34;
    this.fxList.push({ ...ev, t: 0, dur, seed: rnd(10) });
    const W = this.cvW, H = this.cvH;
    const p = project(ev.x, ev.y, W, H);
    const type = ev.type;
    switch (ev.fx) {
      case 'muzzle':
        this._puff(ev.x, ev.y, ev.color, 4, .5);
        break;
      case 'impact': {
        // 착탄: 타입별 파편 (물보라·잎조각·불티·얼음 결정·전기 스파크)
        impactBurst(this.parts, p.x, p.y - 18, type, ev.color, !!ev.big, 1);
        this._ring(ev.x, ev.y, ev.color || '#fff');
        break;
      }
      case 'rush':
        for (let i = 0; i < 8; i++) {
          this.parts.push({
            x: p.x + rnd(20, -20), y: p.y - rnd(30, 5), vx: rnd(20, -20), vy: rnd(-10, -50),
            life: .3, max: .3, size: rnd(5, 2), color: ev.color, type: 'line'
          });
        }
        break;
      case 'zonehit':
        impactBurst(this.parts, p.x, p.y, type, ev.color, true, 1.15);
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
    impactBurst(this.parts, p.x, p.y - 20, type, col, strong, strong ? 1.2 : .9);
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
  _draw(dt, sdt) {
    const ctx = this.actx, W = this.cvW, H = this.cvH;
    ctx.clearRect(0, 0, W, H);
    const t = this.sceneT / 1000;
    const tick = sdt === undefined ? dt : sdt;
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

    this._drawProjectiles(ctx, W, H, t, tick);
    this._drawFx(ctx, W, H, t, tick);
    this._drawParts(ctx, tick);
    this._drawBars(ctx, W, H);
    this._drawBubbles(ctx, W, H, tick);
    this._drawTexts(ctx, dt);
    ctx.restore();
    this._drawFront(ctx, W, H, t, dt);
    // 피격 상태 타이머
    for (const f of this.battle.all) {
      if (f.hitFx) {
        f.hitFx.t += tick;
        if (f.hitFx.t >= f.hitFx.dur) f.hitFx = null;
      }
    }
  }

  /* 화면 좌표 계수(카메라) */
  cam() {
    const c = this._camObj || (this._camObj = { W: 0, H: 0, unit: 0, small: false, project, t: 0 });
    c.W = this.cvW; c.H = this.cvH; c.unit = this.unit; c.small = this.small; c.t = this.sceneT / 1000;
    return c;
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
      // 장판 종류별 기믹 (지진 균열 · 유성 낙하 · 눈보라 회오리)
      drawZoneDecor(ctx, z, p, rx, ry, t, this.cam());
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
    // 감전 중에는 몸이 미세하게 지직거린다
    const zap = f.hitFx && gimmickOf(f.hitFx.type) === 'spark'
      ? (Math.random() - .5) * h * .032 * (1 - f.hitFx.t / f.hitFx.dur) : 0;
    const cx = p.x + lunge + shake + zap;
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

    // 타입별 피격 상태 연출 (감전 아크 · 불티 · 서리 결정 · 물방울 ...)
    if (alive) drawHitState(ctx, f, this.cam(), cx, cy, dh, 0, t);

    // 상태이상 표시 (머리 위 작은 아이콘)
    if (alive && f.status) {
      const icons = { brn: '🔥', par: '⚡', psn: '☠', slp: '💤', frz: '❄' };
      ctx.font = `${Math.max(10, h * .15)}px sans-serif`;
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

  _drawBubbles(ctx, W, H, tick) {
    const list = [];
    const dtt = tick === undefined ? 1 / 60 : tick;
    for (const f of this.battle.all) {
      if (!f.bubble) continue;
      f.bubble.t += dtt;
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

  _drawProjectiles(ctx, W, H, t, tick) {
    const cam = this.cam();
    for (const p of this.battle.projectiles) {
      drawProjectile(ctx, p, cam);
    }
    // 투사체 비행 궤적의 잔여 파티클 (잎·물방울·불티)
    if (this.battle.projectiles.length) this._projParts(tick || .016);
  }

  _projParts(dt) {
    if (this._projT === undefined) this._projT = 0;
    this._projT += dt;
    if (this._projT < .055) return;
    this._projT = 0;
    const cam = this.cam();
    for (const p of this.battle.projectiles) {
      if (!p._tr || p._tr.length < 2) continue;
      const q = p._tr[p._tr.length - 2];
      const shape = shapeOf({ shape: p.spec && p.spec.shape, type: p.move && p.move.t });
      const col = (p.spec && p.spec.color) || '#fff';
      const sec = (p.spec && p.spec.second) || '#ffffff';
      if (shape === 'leaf') emitLeaves(this.parts, q.x, q.y, -p.vx * 2, .5, 1, col, sec, 40, 5);
      else if (shape === 'water') emitWater(this.parts, q.x, q.y, Math.PI, .6, 1, col, sec, 30, 2.6);
      else if (shape === 'flame') emitEmber(this.parts, q.x, q.y, Math.PI, .6, 1, col, sec, 30, 2.6);
      else if (shape === 'ice') emitFrost(this.parts, q.x, q.y, Math.PI, .6, 1, col, sec, 26, 2.4);
      else if (shape === 'spark') emitSpark(this.parts, q.x, q.y, Math.PI, .7, 1, col, sec, 60, 1.8);
      else if (shape === 'shadow') emitWisp(this.parts, q.x, q.y, Math.PI, .7, 1, col, sec, 20, 3.4);
    }
  }

  _drawFx(ctx, W, H, t, tick) {
    const keep = [];
    const cam = this.cam();
    const dt = tick === undefined ? 1 / 60 : tick;
    for (const fx of this.fxList) {
      fx.t += dt;
      const k = clamp(fx.t / fx.dur, 0, 1);
      if (k >= 1) continue;
      // 시전 중 파티클 (물줄기·화염·결정 등)
      emitCastParticles(this.parts, fx, k, cam);
      drawCast(ctx, fx, k, cam);
      keep.push(fx);
    }
    this.fxList = keep;
  }


  _drawParts(ctx, dt) {
    const keep = [];
    const ts = this.sceneT / 1000;
    for (const p of this.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.wob) p.vx += Math.sin((p.life * 9) + p.size) * p.wob * dt * .6;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 320 * (p.grav === undefined ? 1 : p.grav) * dt;
      const drag = p.drag === undefined ? .96 : p.drag;
      p.vx *= drag; p.vy *= Math.min(.995, drag + .02);
      if (p.vr) p.rot = (p.rot || 0) + p.vr * dt;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      drawParticle(ctx, p, a, ts);
      ctx.restore();
      keep.push(p);
    }
    this.parts = keep.length > 760 ? keep.slice(keep.length - 760) : keep;
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
    const empty = this.el.castLines.querySelector('.cast-empty');
    if (empty) empty.remove();
    const whoInfo = who === 'caster' ? CAST_TEAM.caster : CAST_TEAM.analyst;
    const d = document.createElement('div');
    d.className = `cast-line ${who}`;
    d.innerHTML = `<i>${whoInfo.emoji}</i><b class="cw">${whoInfo.name}</b><span>${text}</span>`;
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
      speed: this.speed,
      simScale: +(this.speed * SPEED_BASE).toFixed(3),
      hitFx: b ? b.all.filter((f) => f.hitFx).map((f) => f.hitFx.type) : [],
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
