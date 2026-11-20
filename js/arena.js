/* ============================================================================
   실시간 아레나 난투 엔진 (2.5D 쿼터뷰 · 팀파이트)
   - 1v1(2마리) / 2v2(4마리) / 3v3(6마리) 전원 동시 출격
   - 능력치 기반 이동속도 · 쿨타임 회전 · 회피 반응
   - 근접은 돌진, 원거리는 거리 유지(카이팅), 아군끼리 겹침 분리
   - 실제 투사체/장판 판정 → 피하면 MISS(회피!), 맞으면 데미지
   - 코어 엔진(engine.js)의 능력치·데미지 공식·타입 상성·날씨를 그대로 사용
   ========================================================================== */
import {
  Fighter, statsAt50, typeEff, calcDamage, MOVE_EFFECTS, WEATHERS, josa, moveById, effLabel
} from './engine.js';
import { getFxSpec } from './fx.js';

/* 밸런스 튜닝 ------------------------------------------------------- */
export const TUNE = {
  hpMul: 4.1,
  dmgMul: 0.9,
  speedBase: 0.128,
  speedVar: 0.118,
  dodgeDur: 0.17,
  dodgeDist: 0.085,
  maxTime: 56,
  suddenAt: 38,
  suddenMul: 2.5
};
const YS = 0.72;
const BOUND = { x0: 0.07, x1: 0.93, y0: 0.06, y1: 0.94 };

const SPAWNS = {
  1: { A: [[.27, .62]], B: [[.73, .46]] },
  2: { A: [[.21, .70], [.30, .38]], B: [[.79, .62], [.70, .32]] },
  3: { A: [[.19, .80], [.28, .55], [.20, .28]], B: [[.81, .72], [.72, .46], [.79, .20]] }
};

const STATUS_NAME = { brn: '화상', par: '마비', psn: '독', slp: '잠듦', frz: '얼음' };
const HEAL_MOVES = ['recover', 'roost', 'synthesis', 'moonlight', 'morning-sun', 'slack-off', 'shore-up', 'soft-boiled', 'milk-drink'];
const BOOST_TABLE = {
  'swords-dance': { atk: 2 }, 'nasty-plot': { spa: 2 }, 'calm-mind': { spa: 1, spd: 1 },
  'dragon-dance': { atk: 1, spe: 1 }, 'quiver-dance': { spa: 1, spd: 1, spe: 1 },
  'shell-smash': { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 }, 'bulk-up': { atk: 1, def: 1 },
  'work-up': { atk: 1, spa: 1 }, growth: { atk: 1, spa: 1 }, agility: { spe: 2 },
  'iron-defense': { def: 2 }, 'rock-polish': { spe: 2 }, 'tail-glow': { spa: 3 }, 'cotton-guard': { def: 3 }
};
const STATUS_MOVES = {
  'sleep-powder': 'slp', spore: 'slp', hypnosis: 'slp', sing: 'slp', 'grass-whistle': 'slp',
  'lovely-kiss': 'slp', yawn: 'slp', 'thunder-wave': 'par', glare: 'par', 'stun-spore': 'par',
  'will-o-wisp': 'brn', toxic: 'psn', 'poison-powder': 'psn'
};
const MELEE_KINDS = ['rush', 'slash', 'bite'];
const ZONE_KINDS = ['quake', 'storm', 'drop', 'meteor'];
const BEAM_KINDS = ['beam', 'bolt', 'wave', 'burst', 'pillar', 'shadow', 'cage', 'stream', 'drain'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KIND_SUB = { stream: 'drain' };

/* move 데이터에 id 부여 (DATA.moves는 id 필드를 갖지 않음) */
const MV = new Map();
function DATA_MOVE(id) {
  const k = String(id);
  if (MV.has(k)) return MV.get(k);
  const base = moveById(k);
  const mv = base ? { ...base, id: k } : null;
  MV.set(k, mv);
  return mv;
}

export function moveProfile(mv) {
  const spec = getFxSpec(mv);
  let kind = spec.kind || 'projectile';
  if (KIND_SUB[kind]) kind = KIND_SUB[kind];
  if (mv.c === '변화') return { kind: spec.kind || 'buff', melee: false, range: .28, windup: .3, color: spec.color, big: false };
  const melee = MELEE_KINDS.includes(kind);
  const range = melee ? .125 : clamp(.26 + (mv.p / 130) * .20, .26, .50);
  const windup = melee ? clamp(.20 - mv.p / 900, .12, .20) : clamp(.15 + mv.p / 520, .18, .42);
  return { kind, melee, range, windup, color: spec.color, big: !!spec.big };
}

/* 아레나 전투 */
export class ArenaBattle {
  constructor({ teamA, teamB, weather = 'clear', seed = 1 }) {
    this.weather = weather;
    this.time = 0;
    this.events = [];
    this.projectiles = [];
    this.zones = [];
    this.timers = [];
    this.logs = [];
    this.finished = false;
    this.winner = null;
    this.duration = 0;
    this.castCount = 0;
    this.dodgeCount = 0;
    this.hitCount = 0;
    this._mode = teamA.length;
    this._maxTime = teamA.length === 1 ? 40 : teamA.length === 2 ? 44 : 46;
    this._suddenAt = teamA.length === 1 ? 22 : teamA.length === 2 ? 23 : 24;
    this._suddenPower = 1;
    let s = (seed >>> 0) || 1;
    this.rng = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };

    const spawn = SPAWNS[teamA.length] || SPAWNS[1];
    const mk = (ids, side) => ids.map((id, i) => {
      const f = new Fighter(id, side, i);
      f.maxHp = Math.max(1, Math.round(f.maxHp * TUNE.hpMul * (teamA.length >= 3 ? .95 : teamA.length === 2 ? .95 : 1.22)));
      f.hp = f.maxHp;
      f.battleWeather = weather;
      const sp = (spawn[side] && spawn[side][i]) || [side === 'A' ? .25 : .75, .5];
      f.x = clamp(sp[0] + (this.rng() - .5) * .03, BOUND.x0, BOUND.x1);
      f.y = clamp(sp[1] + (this.rng() - .5) * .03, BOUND.y0, BOUND.y1);
      f.face = side === 'A' ? 1 : -1;
      f.cds = {};
      f.cast = null;
      f.dodgeCd = 0; f.dodgeT = 0; f.ddx = 0; f.ddy = 1;
      f.vx = 0; f.vy = 0;
      f.phase = this.rng() * 6.28;
      f.retarget = this.rng() * .4;
      f.think = .25 + this.rng() * .6;
      f.dodges = 0; f.casts = 0; f.hits = 0; f.hitFlash = 0; f.lungeT = 0;
      f.deadT = 0; f.after = []; f.stunT = 0; f.confusedT = 0; f.dotT = 0; f.wdot = 0;
      f.damageDealt = 0; f.kos = 0; f.healed = 0;
      f.role = this._roleOf(f);
      for (const mid of f.moves) f.cds[mid] = this.rng() * .8;
      return f;
    });
    this.A = mk(teamA, 'A');
    this.B = mk(teamB, 'B');
    this.all = [...this.A, ...this.B];
    for (const f of this.all) f.target = this._nearestFoe(f);
    this.events.push({ t: 'start', weather, mode: teamA.length });
    this._log(`${WEATHERS[weather].name} · ${teamA.length} 대 ${teamA.length} 난투 개시!`, 'sys');
  }

  /* ---------------- 기본 ---------------- */
  get aliveA() { return this.A.filter((f) => f.alive); }
  get aliveB() { return this.B.filter((f) => f.alive); }
  dist(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) * YS); }
  takeEvents() { const e = this.events; this.events = []; return e; }
  _log(text, cls = '') { this.logs.push({ text, cls, time: this.time }); this.events.push({ t: 'log', text, cls }); }

  _nearestFoe(f) {
    const foes = f.side === 'A' ? this.aliveB : this.aliveA;
    if (!foes.length) return null;
    let best = null, bestScore = 1e9;
    for (const o of foes) {
      const score = this.dist(f, o) - (1 - o.hp / o.maxHp) * .075;
      if (score < bestScore) { bestScore = score; best = o; }
    }
    return best;
  }

  _roleOf(f) {
    let meleeScore = 0, rangedScore = 0;
    for (const mid of f.moves) {
      const mv = DATA_MOVE(mid);
      if (!mv || mv.c === '변화') continue;
      const p = moveProfile(mv);
      const v = mv.p * (f.hasType(mv.t) ? 1.5 : 1) * (mv.a / 100);
      if (p.melee) meleeScore += v; else rangedScore += v * 1.05;
    }
    return meleeScore > rangedScore * 1.15 ? 'melee' : 'ranged';
  }

  /* ---------------- 진행 ---------------- */
  step(dt) {
    if (this.finished) return;
    const t = Math.min(dt, 1 / 30);
    this.time += t;
    this.duration = this.time;
    if (this.time >= this._maxTime) { this._finishByTime(); return; }

    for (const f of this.all) {
      if (!f.alive) { f.deadT += t; continue; }
      this._timers(f, t);
      if (f.alive) this._think(f, t);
    }
    this._updateProjectiles(t);
    this._updateZones(t);
    this._runTimers();
    this._ambientTicks(t);
    this.reap();
    this._checkEnd();
  }

  _runTimers() {
    if (!this.timers.length) return;
    const due = [];
    this.timers = this.timers.filter((x) => {
      if (x.at <= this.time) { due.push(x); return false; }
      return true;
    });
    for (const x of due) { try { x.fn(); } catch (e) { console.error(e); } }
  }

  _timers(f, dt) {
    for (const k in f.cds) { if (f.cds[k] > 0) f.cds[k] = Math.max(0, f.cds[k] - dt); }
    if (f.dodgeCd > 0) f.dodgeCd = Math.max(0, f.dodgeCd - dt);
    if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.lungeT > 0) f.lungeT = Math.max(0, f.lungeT - dt);
    if (f.stunT > 0) f.stunT = Math.max(0, f.stunT - dt);
    if (f.confusedT > 0) f.confusedT = Math.max(0, f.confusedT - dt);
    if (f.protectT > 0) f.protectT = Math.max(0, f.protectT - dt);
    if (f.after.length) f.after = f.after.filter((a) => { a.life -= dt; return a.life > 0; });
  }

  _ambientTicks(t) {
    this._suddenPower = this.time < this._suddenAt ? 1 : TUNE.suddenMul + Math.min(3.0, (this.time - this._suddenAt) * .2);
    if (this.time >= this._suddenAt && !this._sudden) {
      this._sudden = true;
      this.events.push({ t: 'sudden' });
      this._log('서든데스! 양 팀의 공격력이 크게 상승한다!', 'sys');
    }
    for (const f of this.all) {
      if (!f.alive) continue;
      if (f.status === 'brn' || f.status === 'psn') {
        f.dotT += t;
        if (f.dotT >= 2.0) {
          f.dotT = 0;
          this._rawDamage(f, Math.max(1, Math.floor(f.maxHp / (f.status === 'brn' ? 20 : 12))), null, null, { dot: true });
        }
      }
      if (this.weather === 'sand' || this.weather === 'hail') {
        const immune = this.weather === 'sand'
          ? (f.hasType('바위') || f.hasType('땅') || f.hasType('강철'))
          : f.hasType('얼음');
        if (!immune) {
          f.wdot = (f.wdot || 0) + t;
          if (f.wdot >= 2.6) {
            f.wdot = 0;
            this._rawDamage(f, Math.max(1, Math.floor(f.maxHp / 22)), null, null, { dot: true, weather: true });
          }
        }
      }
    }
  }

  /* ---------------- 개체 판단 ---------------- */
  _think(f, t) {
    if (f.status === 'slp') {
      f.sleepT = (f.sleepT || 0) - t;
      if (f.sleepT <= 0) {
        f.status = null, f.sleepT = 0;
        this.events.push({ t: 'cure', side: f.side, idx: f.slot, status: 'slp', x: f.x, y: f.y });
        this._log(`${josa(f.name, '은/는')} 잠에서 깨어났다!`, 'status');
      }
      return;
    }
    if (f.status === 'frz') {
      if (this.rng() < t * .4) {
        f.status = null;
        this.events.push({ t: 'cure', side: f.side, idx: f.slot, status: 'frz', x: f.x, y: f.y });
        this._log(`${f.name}의 얼음이 녹았다!`, 'status');
      }
      return;
    }
    if (f.stunT > 0) return;

    if (f.dodgeT > 0) {
      f.dodgeT -= t;
      const sp = TUNE.dodgeDist / TUNE.dodgeDur;
      f.x += f.ddx * sp * t;
      f.y += f.ddy * sp * t;
      if (f.after.length < 9) f.after.push({ x: f.x, y: f.y, life: .2, face: f.face });
      this._clampPos(f);
      if (f.dodgeT <= 0) f.dodgeT = 0;
      return;
    }

    if (f.cast) {
      f.cast.t += t;
      if (f.cast.t >= f.cast.dur) { this._resolveCast(f, f.cast); return; }
      this._integrate(f, t);
      return;
    }

    f.retarget -= t;
    if (!f.target || !f.target.alive || f.retarget <= 0) {
      f.target = this._nearestFoe(f);
      f.retarget = .9 + this.rng() * 1.1;
    }
    const foe = f.target;
    if (!foe) return;
    if (!f.cast) f.face = foe.x >= f.x ? 1 : -1;

    f.think -= t;
    if (f.think <= 0) {
      f.think = .1 + this.rng() * .16;
      const pick = this._chooseMove(f, foe);
      if (pick) {
        const d = this.dist(f, foe);
        if (pick.prof.melee ? d <= pick.prof.range * 1.45 : d <= pick.prof.range) {
          if (f.status === 'par' && this.rng() < .2) {
            this.events.push({ t: 'status', side: f.side, idx: f.slot, status: 'par', text: '마비', x: f.x, y: f.y, fizzle: true });
            f.think = .5;
          } else if (f.confusedT > 0 && this.rng() < .3) {
            f.confusedT -= 1;
            this._rawDamage(f, Math.max(1, Math.round(f.maxHp * .06)), null, null, {});
            this.events.push({ t: 'status', side: f.side, idx: f.slot, status: 'confuse', text: '혼란', x: f.x, y: f.y });
            f.think = .5;
          } else {
            this._startCast(f, foe, pick.mv, pick.prof, pick.mid);
          }
          return;
        }
      }
    }
    this._move(f, t, foe);
  }

  _chooseMove(f, foe) {
    const cands = [];
    for (const mid of f.moves) {
      const mv = DATA_MOVE(mid);
      if (!mv) continue;
      if ((f.cds[mid] || 0) > 0) continue;
      const prof = moveProfile(mv);
      let score = 1;
      if (mv.c === '변화') {
        if (HEAL_MOVES.includes(mv.en) || mv.en === 'rest') {
          score = f.hp / f.maxHp < .62 ? 330 * (1.3 - f.hp / f.maxHp) : 2;
        } else if (BOOST_TABLE[mv.en]) {
          score = (f.usedBoost || 0) < 2 && f.hp / f.maxHp > .5 ? 150 : 3;
        } else if (STATUS_MOVES[mv.en]) {
          score = !foe.status ? 175 * ((mv.a || 100) / 100) : 2;
        } else if (mv.en === 'leech-seed') {
          score = !foe.leech ? 125 : 1;
        } else if (mv.en === 'protect' || mv.en === 'detect') {
          score = f.hp / f.maxHp < .3 ? 80 : 5;
        } else score = 7;
        cands.push({ mid, mv, prof, score });
        continue;
      }
      const eff = typeEff(mv.t, foe.types);
      if (eff === 0) continue;
      const stab = f.hasType(mv.t) ? 1.5 : 1;
      score = mv.p * eff * stab * ((mv.a || 100) / 100);
      if (eff >= 2) score *= 1.3;
      const phys = f.stats.atk >= f.stats.spa;
      if ((mv.c === '물리') === phys) score *= 1.12;
      if (mv.pr > 0) score *= 1.1;
      const d = this.dist(f, foe);
      if (!prof.melee && d > prof.range * 1.05) score *= .72;
      if (!prof.melee && d < .16) score *= .8;
      if (prof.melee && d > .32) score *= .5;
      if (mv.p * eff * stab > foe.hp * 1.1) score *= 1.18;
      if ((f.usedCount?.[mid] || 0) >= 3) score *= .85;
      cands.push({ mid, mv, prof, score });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score);
    const top = cands.slice(0, Math.min(3, cands.length));
    const w = top.map((c, i) => Math.max(.02, c.score) * [1, .5, .22][i]);
    const sum = w.reduce((a, b) => a + b, 0);
    let r = this.rng() * sum;
    for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) return top[i]; }
    return top[0];
  }

  _move(f, dt, foe) {
    const d = this.dist(f, foe) || 1e-6;
    const dx = (foe.x - f.x) / d;
    const dy = ((foe.y - f.y) * YS) / d;
    const desired = f.role === 'melee' ? .105 : (f.hp / f.maxHp < .35 ? .38 : .30);
    const radial = d > desired + .04 ? 1 : d < desired - .05 ? -1 : 0;

    let fx = 0, fy = 0;
    for (const z of this.zones) {
      if (z.side === f.side || z.phase !== 'tell') continue;
      const dd = Math.hypot(f.x - z.x, (f.y - z.y) * YS);
      if (dd < z.r + .05) {
        const k = (z.r + .07 - dd) / (z.r + .07);
        fx += ((f.x - z.x) / (dd || 1e-6)) * k * 1.25;
        fy += (((f.y - z.y) * YS) / (dd || 1e-6)) * k * 1.25 / YS;
      }
    }
    let sx = 0, sy = 0;
    for (const o of this.all) {
      if (o === f || !o.alive) continue;
      const dd = Math.hypot(f.x - o.x, (f.y - o.y) * YS);
      if (dd < .145 && dd > 1e-5) {
        const k = ((.145 - dd) / .145) * 1.9;
        sx += ((f.x - o.x) / dd) * k;
        sy += (((f.y - o.y) * YS) / dd) * k / YS;
      }
    }
    // 아레나 경계에서 안쪽으로
    const margin = .1;
    if (f.x < BOUND.x0 + margin) fx += (BOUND.x0 + margin - f.x) / margin * 1.4;
    if (f.x > BOUND.x1 - margin) fx -= (f.x - (BOUND.x1 - margin)) / margin * 1.4;
    if (f.y < BOUND.y0 + margin) fy += (BOUND.y0 + margin - f.y) / margin * 1.4;
    if (f.y > BOUND.y1 - margin) fy -= (f.y - (BOUND.y1 - margin)) / margin * 1.4;
    const st = Math.sin(this.time * 1.15 + f.phase) * .5 + Math.sin(this.time * 2.3 + f.phase * 2.1) * .18;
    const strafe = Math.abs(radial || .3);
    let vx = dx * radial + (-dy) * st * strafe + fx + sx;
    let vy = dy * radial + (dx) * st * strafe + fy + sy;
    const mag = Math.hypot(vx, vy) || 1e-6;
    const spd = this._speedOf(f) * (radial === 0 ? .55 : 1);
    f.vx = (vx / mag) * spd;
    f.vy = (vy / mag) * spd;
    this._integrate(f, dt);
    if (Math.abs(f.vx) > .008) f.face = f.vx > 0 ? 1 : -1;
  }

  _integrate(f, dt) {
    f.x += (f.vx || 0) * dt;
    f.y += (f.vy || 0) * dt;
    this._clampPos(f);
  }
  _clampPos(f) {
    if (f.x < BOUND.x0) { f.x = BOUND.x0; f.vx = Math.abs(f.vx || 0); }
    if (f.x > BOUND.x1) { f.x = BOUND.x1; f.vx = -Math.abs(f.vx || 0); }
    if (f.y < BOUND.y0) { f.y = BOUND.y0; f.vy = Math.abs(f.vy || 0); }
    if (f.y > BOUND.y1) { f.y = BOUND.y1; f.vy = -Math.abs(f.vy || 0); }
  }
  _speedOf(f) {
    const spe = f.stat('spe');
    return TUNE.speedBase + TUNE.speedVar * clamp(spe / 230, .16, 1.05);
  }

  /* ---------------- 시전 ---------------- */
  _startCast(f, foe, mv, prof, mid) {
    const spear = f.stat('spe');
    const dur = prof.windup * (1.05 - .2 * clamp(spear / 230, 0, 1));
    f.cast = { mv, prof, mid, t: 0, dur, foe, tx: foe.x, ty: foe.y };
    f.vx = 0; f.vy = 0;
    f.casts++;
    f.usedCount = f.usedCount || {};
    f.usedCount[mid] = (f.usedCount[mid] || 0) + 1;
    this.castCount++;
    const spec = getFxSpec(mv);
    this.events.push({
      t: 'cast', side: f.side, idx: f.slot, name: f.name, moveId: mv.id, moveName: mv.n,
      type: mv.t, kind: spec.kind, color: spec.color, x: f.x, y: f.y, role: f.role,
      melee: prof.melee, dur, charge: !!spec.charge
    });
    if (prof.melee) {
      for (const o of (f.side === 'A' ? this.aliveB : this.aliveA)) {
        if (this.dist(f, o) < prof.range * 1.6) this._tryDodge(o, mv, f.x, f.y, .75);
      }
    } else if (['projectile', 'volley', 'status'].includes(prof.kind)) {
      /* 투사체는 발사 후 접근 시점에 회피 판정 */
    } else {
      this._tryDodge(foe, mv, f.x, f.y, .9);
    }
    const cdBase = mv.c === '변화' ? 3.9 : 1.35 + Math.min(2.5, mv.p / 58);
    f.cds[mid] = cdBase * Math.pow(140 / Math.max(45, spear), .55) * (0.9 + this.rng() * .2);
  }

  _resolveCast(f, cast) {
    const { mv, prof, foe } = cast;
    f.cast = null;
    const spec = getFxSpec(mv);
    const target = (foe && foe.alive) ? foe : this._nearestFoe(f);
    if (mv.c === '변화') { this._statusMove(f, target, mv); f.think = .3; return; }
    const ef = MOVE_EFFECTS[mv.en] || {};
    const acc = mv.a || 100;

    /* 근접 */
    if (prof.melee) {
      const d = target ? this.dist(f, target) : 9;
      if (target) {
        f.x += (target.x - f.x) * .14;
        f.y += (target.y - f.y) * .14;
        this._clampPos(f);
      }
      f.lungeT = .22;
      this.events.push({ t: 'fx', fx: prof.kind === 'bite' ? 'bite' : 'rush', color: spec.color, second: spec.second, shape: spec.shape, trail: spec.trail, type: mv.t, x: f.x, y: f.y, tx: target ? target.x : f.x, ty: target ? target.y : f.y, kind: prof.kind, big: spec.big });
      const justDodged = target && target.dodgeStamp && (this.time - target.dodgeStamp) < .5;
      if (!target || d > prof.range * 1.8 || justDodged) {
        if (target) this.events.push({ t: 'miss', side: target.side, idx: target.slot, moveName: mv.n, x: target.x, y: target.y, reason: 'dodge' });
        return;
      }
      this._strike(f, target, mv, ef);
      if (spec.big && mv.p >= 95) this._splash(f, target, mv, ef, .17);
      f.think = .18 + this.rng() * .18;
      return;
    }

    if (ZONE_KINDS.includes(prof.kind)) {
      this._spawnZone(f, target, mv, spec, prof);
      f.think = .3;
      return;
    }

    if (BEAM_KINDS.includes(prof.kind)) {
      if (target && this._tryDodge(target, mv, f.x, f.y, prof.kind === 'stream' ? .55 : .9)) {
        this.events.push({ t: 'fx', fx: prof.kind, color: spec.color, second: spec.second, shape: spec.shape, type: mv.t, big: spec.big, x: f.x, y: f.y, tx: target.x, ty: target.y, kind: prof.kind, whiff: true });
        this.events.push({ t: 'miss', side: target.side, idx: target.slot, moveName: mv.n, x: target.x, y: target.y, reason: 'dodge' });
        return;
      }
      const tx = target ? target.x : f.x + f.face * .2;
      const ty = target ? target.y : f.y;
      this.events.push({ t: 'fx', fx: prof.kind, color: spec.color, second: spec.second, shape: spec.shape, type: mv.t, big: spec.big, x: f.x, y: f.y, tx, ty, kind: prof.kind });
      if (target) {
        const d = this.dist(f, target);
        if (d > prof.range * 1.6) {
          this.events.push({ t: 'miss', side: target.side, idx: target.slot, moveName: mv.n, x: target.x, y: target.y, reason: 'range' });
        } else {
          this._strike(f, target, mv, ef);
          if (['wave', 'burst', 'cage', 'stream', 'drain'].includes(prof.kind)) this._splash(f, target, mv, ef, prof.kind === 'stream' || prof.kind === 'drain' ? .15 : .19);
        }
      }
      f.think = .18 + this.rng() * .2;
      return;
    }

    /* 투사체 */
    if (!target) return;
    const multi = ef.hits ? (ef.hits[0] === ef.hits[1] ? ef.hits[0] : ef.hits[0] + Math.floor(this.rng() * (ef.hits[1] - ef.hits[0] + 1))) : 1;
    for (let i = 0; i < multi; i++) {
      this.timers.push({
        at: this.time + i * .085,
        fn: () => { if (f.alive && target.alive) this._spawnProjectile(f, target, mv, spec, prof); }
      });
    }
    f.think = .16 + this.rng() * .18;
  }

  _spawnProjectile(f, target, mv, spec, prof) {
    const d = this.dist(f, target) || .001;
    const speed = .62 + Math.min(.3, mv.p / 420);
    const lead = Math.min(.4, d / speed);
    let tx = clamp(target.x + (target.vx || 0) * lead * .8, .02, .98);
    let ty = clamp(target.y + (target.vy || 0) * lead * .8, .02, .98);
    const ang = Math.atan2((ty - f.y) * YS, tx - f.x);
    this.projectiles.push({
      x: f.x, y: f.y + .015, vx: Math.cos(ang) * speed, vy: (Math.sin(ang) * speed) / YS,
      side: f.side, owner: f, target, move: mv, spec, life: 1.5,
      r: spec.big ? .042 : .032, dodged: false, trailT: 0,
      homing: spec.kind === 'volley' ? 0 : .16
    });
    this.events.push({ t: 'fx', fx: 'muzzle', color: spec.color, second: spec.second, shape: spec.shape, type: mv.t, x: f.x, y: f.y, kind: spec.kind, big: spec.big });
  }

  _updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      if (p.owner && !p.owner.alive) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.homing && p.target && p.target.alive) {
        const angNow = Math.atan2(p.vy * YS, p.vx);
        const angWant = Math.atan2((p.target.y - p.y) * YS, p.target.x - p.x);
        let diff = angWant - angNow;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = clamp(diff, -p.homing * dt, p.homing * dt);
        const sp = Math.hypot(p.vx, p.vy * YS);
        p.vx = Math.cos(angNow + turn) * sp;
        p.vy = (Math.sin(angNow + turn) * sp) / YS;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.trailT += dt;
      if (p.x < -.04 || p.x > 1.04 || p.y < -.04 || p.y > 1.04) continue;

      if (p.target && p.target.alive && !p.dodged) {
        const dd = Math.hypot(p.target.x - p.x, (p.target.y - p.y) * YS);
        if (dd < .23) {
          p.dodged = true;
          this._tryDodge(p.target, p.move, p.x, p.y, 1, true);
        }
      }
      let hit = false;
      for (const o of (p.side === 'A' ? this.aliveB : this.aliveA)) {
        if (!o.alive) continue;
        const dd = Math.hypot(o.x - p.x, (o.y - p.y) * YS);
        if (dd < p.r + .033) { this._projectileHit(p, o); hit = true; break; }
      }
      if (hit) continue;
      keep.push(p);
    }
    this.projectiles = keep;
  }

  _projectileHit(p, def) {
    const mv = p.move, ef = MOVE_EFFECTS[mv.en] || {};
    const accStage = clamp((p.owner?.stages.acc || 0) - (def.stages.eva || 0), -6, 6);
    const accMul = accStage >= 0 ? (3 + accStage) / 3 : 3 / (3 - accStage);
    const acc = clamp((mv.a || 100) * accMul, 35, 100);
    if (this.rng() * 100 > acc) {
      this.events.push({ t: 'miss', side: def.side, idx: def.slot, moveName: mv.n, x: def.x, y: def.y, reason: 'acc' });
      return;
    }
    this.events.push({ t: 'fx', fx: 'impact', color: p.spec.color, second: p.spec.second, shape: p.spec.shape, type: mv.t, x: p.x, y: p.y, kind: p.spec.kind, big: p.spec.big });
    this._strike(p.owner, def, mv, ef);
  }

  _strike(att, def, mv, ef, opts = {}) {
    if (!att || !def || !def.alive) return;
    if (def.protectT > 0) {
      this.events.push({ t: 'miss', side: def.side, idx: def.slot, moveName: mv.n, x: def.x, y: def.y, reason: 'protect' });
      return;
    }
    const r = calcDamage(att, def, mv, { rng: this.rng, weather: this.weather });
    if (r.immune) {
      this.events.push({ t: 'immune', side: def.side, idx: def.slot, x: def.x, y: def.y, moveName: mv.n });
      return;
    }
    const dmg = Math.max(1, Math.round(r.dmg * TUNE.dmgMul * this._suddenPower * (opts.mul || 1)));
    const before = def.hp;
    def.hp = Math.max(0, def.hp - dmg);
    const dealt = Math.round(before - def.hp);
    att.damageDealt += dealt;
    att.hits++;
    def.hitFlash = .18;
    def.lastHitBy = att;
    this.hitCount++;
    this.events.push({
      t: 'hit', aSide: att.side, aIdx: att.slot, side: def.side, idx: def.slot,
      amount: dealt, hp: def.hp, maxHp: def.maxHp, eff: r.eff, crit: r.crit,
      moveId: mv.id, moveName: mv.n, type: mv.t, x: def.x, y: def.y,
      phys: mv.c === '물리'
    });
    this._log(`${josa(att.name, '은/는')} ${mv.n}! ${def.name}에게 ${dealt} 피해${r.crit ? ' (급소)' : r.eff >= 2 ? ' (효과 굉장)' : ''}`, 'dmg');

    if (ef.recoil) this._rawDamage(att, Math.max(1, Math.round(dealt * ef.recoil)), null, null, { recoil: true });
    if (ef.drain) this._heal(att, Math.ceil(dealt * ef.drain), '흡수');
    if (def.alive) {
      for (const sec of [ef.sec, ef.sec2].filter(Boolean)) {
        if (this.rng() * 100 <= sec[1]) this._secondary(att, def, sec[0], mv);
      }
    }
    if (ef.self) this._boost(att, ef.self);
  }

  _splash(att, center, mv, ef, radius) {
    for (const o of (att.side === 'A' ? this.aliveB : this.aliveA)) {
      if (o === center || !o.alive) continue;
      if (this.dist(o, center) > radius) continue;
      const r = calcDamage(att, o, mv, { rng: this.rng, weather: this.weather });
      if (r.immune) continue;
      const dmg = Math.max(1, Math.round(r.dmg * TUNE.dmgMul * .5 * this._suddenPower));
      const before = o.hp;
      o.hp = Math.max(0, o.hp - dmg);
      att.damageDealt += Math.round(before - o.hp);
      o.hitFlash = .16;
      o.lastHitBy = att;
      this.events.push({ t: 'hit', aSide: att.side, aIdx: att.slot, side: o.side, idx: o.slot, amount: Math.round(before - o.hp), hp: o.hp, maxHp: o.maxHp, eff: r.eff, crit: false, moveId: mv.id, moveName: mv.n, type: mv.t, x: o.x, y: o.y, splash: true });
    }
  }

  _spawnZone(att, center, mv, spec, prof) {
    const r = prof.kind === 'storm' ? .28 : prof.kind === 'meteor' ? .22 : prof.kind === 'quake' ? .25 : .23;
    const tell = prof.kind === 'meteor' ? .6 : prof.kind === 'quake' ? .32 : .48;
    const z = {
      x: center ? center.x : clamp(att.x + att.face * .2, .05, .95),
      y: center ? center.y : att.y,
      r, side: att.side, owner: att, move: mv, spec, phase: 'tell', t: 0, tell,
      life: tell + .75, ticked: 0, tickEvery: prof.kind === 'storm' ? .3 : 99,
      inside: new Set(), kind: prof.kind
    };
    for (const o of (att.side === 'A' ? this.aliveB : this.aliveA)) {
      if (o.alive && this.dist(o, z) < r) { z.inside.add(o); o._zoneEscaped = false; }
    }
    this.zones.push(z);
    this.events.push({ t: 'fx', fx: 'zone', color: spec.color, second: spec.second, shape: spec.shape, type: mv.t, x: z.x, y: z.y, r, dur: tell, kind: prof.kind });
  }

  _updateZones(dt) {
    const keep = [];
    for (const z of this.zones) {
      z.t += dt; z.life -= dt;
      if (z.phase === 'tell' && z.t >= z.tell) { z.phase = 'live'; z.t = 0; z.ticked = 0; }
      if (z.phase === 'live') {
        z.ticked += dt;
        while (z.ticked >= z.tickEvery) { z.ticked -= z.tickEvery; this._zoneDamage(z); }
      }
      if (z.life > 0) keep.push(z);
    }
    this.zones = keep;
  }

  _zoneDamage(z) {
    if (!z.owner.alive) return;
    for (const o of (z.side === 'A' ? this.aliveB : this.aliveA)) {
      if (!o.alive) continue;
      const inside = this.dist(o, z) < z.r;
      if (!inside) {
        if (z.inside.has(o) && !o._zoneEscaped) { o._zoneEscaped = true; this._dodgeEvent(o, z.move); }
        continue;
      }
      if (o.protectT > 0) continue;
      const r = calcDamage(z.owner, o, z.move, { rng: this.rng, weather: this.weather });
      if (r.immune) continue;
      const dmg = Math.max(1, Math.round(r.dmg * TUNE.dmgMul * .85 * this._suddenPower));
      const before = o.hp;
      o.hp = Math.max(0, o.hp - dmg);
      z.owner.damageDealt += Math.round(before - o.hp);
      o.hitFlash = .18;
      o.lastHitBy = z.owner;
      this.events.push({ t: 'hit', aSide: z.side, aIdx: z.owner.slot, side: o.side, idx: o.slot, amount: Math.round(before - o.hp), hp: o.hp, maxHp: o.maxHp, eff: r.eff, crit: false, moveId: z.move.id, moveName: z.move.n, type: z.move.t, x: o.x, y: o.y, zone: true });
    }
    this.events.push({ t: 'fx', fx: 'zonehit', color: z.spec.color, second: z.spec.second, shape: z.spec.shape, type: z.move.t, x: z.x, y: z.y, r: z.r, kind: z.kind });
  }

  /* ---------------- 변화기 ---------------- */
  _statusMove(att, def, mv) {
    const en = mv.en;
    if (HEAL_MOVES.includes(en)) { this._heal(att, Math.floor(att.maxHp * .42), '회복'); return; }
    if (en === 'rest') {
      const amt = Math.min(att.maxHp - att.hp, Math.floor(att.maxHp * .6));
      if (amt > 0) { att.hp += amt; att.healed += amt; this.events.push({ t: 'heal', side: att.side, idx: att.slot, amount: amt, x: att.x, y: att.y }); }
      this._setStatus(att, 'slp');
      return;
    }
    if (BOOST_TABLE[en]) {
      att.usedBoost = (att.usedBoost || 0) + 1;
      this._boost(att, BOOST_TABLE[en]);
      this.events.push({ t: 'fx', fx: 'buff', color: getFxSpec(mv).color, x: att.x, y: att.y, kind: 'buff' });
      return;
    }
    if (STATUS_MOVES[en]) {
      if (!def || def.status) return;
      if (this.rng() * 100 > (mv.a || 100)) {
        this.events.push({ t: 'miss', side: def.side, idx: def.slot, moveName: mv.n, x: def.x, y: def.y, reason: 'acc' });
        return;
      }
      this._setStatus(def, STATUS_MOVES[en]);
      return;
    }
    if (en === 'leech-seed') {
      if (!def || def.leech) return;
      def.leech = true;
      def.leechBy = att;
      this.events.push({ t: 'status', side: def.side, idx: def.slot, status: 'leech', text: '씨앗', x: def.x, y: def.y });
      return;
    }
    if (en === 'protect' || en === 'detect') { att.protectT = 1.2; this.events.push({ t: 'fx', fx: 'shield', color: '#8fd8ff', x: att.x, y: att.y, kind: 'shield' }); return; }
    if (en === 'confuse-ray' || en === 'swagger') {
      if (!def) return;
      if (en === 'swagger') this._boost(def, { atk: 2 });
      def.confusedT = 2.5;
      this.events.push({ t: 'status', side: def.side, idx: def.slot, status: 'confuse', text: '혼란', x: def.x, y: def.y });
      return;
    }
  }

  _secondary(att, def, kind, mv) {
    switch (kind) {
      case 'burn': this._setStatus(def, 'brn'); break;
      case 'par': this._setStatus(def, 'par'); break;
      case 'psn': this._setStatus(def, 'psn'); break;
      case 'frz': this._setStatus(def, 'frz'); break;
      case 'slp': this._setStatus(def, 'slp'); break;
      case 'flinch': def.stunT = Math.max(def.stunT, .3); this.events.push({ t: 'status', side: def.side, idx: def.slot, status: 'flinch', text: '풀죽음', x: def.x, y: def.y }); break;
      case 'confuse': def.confusedT = 2.2; break;
      case 'atk-': this._boost(def, { atk: -1 }); break;
      case 'def-': this._boost(def, { def: -1 }); break;
      case 'spa-': this._boost(def, { spa: -1 }); break;
      case 'spd-': this._boost(def, { spd: -1 }); break;
      case 'spe-': this._boost(def, { spe: -1 }); break;
      default: break;
    }
  }

  _setStatus(f, st) {
    if (!f.alive || f.status) return false;
    if ((st === 'brn' && f.hasType('불꽃')) || (st === 'psn' && (f.hasType('독') || f.hasType('강철')))
      || (st === 'par' && f.hasType('전기')) || (st === 'frz' && f.hasType('얼음'))) return false;
    f.status = st;
    if (st === 'slp') f.sleepT = 1.8 + this.rng() * 1.8;
    f.dotT = 0;
    f.statusT = 0;
    this.events.push({ t: 'status', side: f.side, idx: f.slot, status: st, text: STATUS_NAME[st], x: f.x, y: f.y });
    this._log(`${josa(f.name, '은/는')} ${STATUS_NAME[st]} 상태가 되었다!`, 'status');
    return true;
  }

  _boost(f, table) {
    for (const [k, d] of Object.entries(table)) {
      const before = f.stages[k];
      f.stages[k] = clamp(before + d, -6, 6);
      if (f.stages[k] !== before) this.events.push({ t: 'boost', side: f.side, idx: f.slot, stat: k, delta: d, x: f.x, y: f.y });
    }
  }

  _heal(f, amount, reason) {
    if (!f.alive) return;
    const amt = Math.min(f.maxHp - f.hp, Math.max(1, Math.floor(amount)));
    if (amt <= 0) return;
    f.hp += amt;
    f.healed += amt;
    this.events.push({ t: 'heal', side: f.side, idx: f.slot, amount: amt, x: f.x, y: f.y });
    this._log(`${f.name}의 체력이 ${amt} 회복되었다${reason ? ` (${reason})` : ''}`, 'heal');
  }

  _rawDamage(f, amount, att, mv, meta = {}) {
    if (!f.alive) return;
    const before = f.hp;
    f.hp = Math.max(0, f.hp - amount);
    f.hitFlash = .1;
    if (att) { f.lastHitBy = att; att.damageDealt += Math.round(before - f.hp); }
    this.events.push({ t: 'hit', aSide: att ? att.side : null, aIdx: att ? att.slot : null, side: f.side, idx: f.slot, amount: Math.round(before - f.hp), hp: f.hp, maxHp: f.maxHp, eff: 1, crit: false, moveId: mv ? mv.id : null, moveName: mv ? mv.n : null, x: f.x, y: f.y, dot: !!meta.dot, recoil: !!meta.recoil });
  }

  /* ---------------- 회피 ---------------- */
  _dodgeChance(f, mv) {
    const spe = f.stat('spe');
    const acc = mv && mv.a ? mv.a : 100;
    let c = .16 + .5 * clamp(spe / 235, 0, 1) - clamp((acc - 92) / 60, -.05, .12);
    if (f.status === 'par') c -= .18;
    if (f.status === 'slp' || f.status === 'frz') c = 0;
    if (f.dodgeCd > 0) c = 0;
    return clamp(c, 0, .68);
  }

  _tryDodge(f, mv, fromX, fromY, weight = 1, projectile = false) {
    if (!f || !f.alive || f.cast || f.dodgeT > 0 || f.dodgeCd > 0 || f.stunT > 0) return false;
    const chance = this._dodgeChance(f, mv) * weight;
    if (this.rng() > chance) return false;
    let nx = f.x - fromX, ny = (f.y - fromY) * YS;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    let px = -ny, py = nx;
    // 필드 밖으로 향하면 반대쪽으로
    if (f.x + px * .14 < BOUND.x0 + .02 || f.x + px * .14 > BOUND.x1 - .02) { px = -px; py = -py; }
    if (f.y + py * .14 < BOUND.y0 + .02 || f.y + py * .14 > BOUND.y1 - .02) { px = -px; py = -py; }
    f.ddx = px; f.ddy = py;
    f.dodgeT = TUNE.dodgeDur;
    f.dodgeCd = (projectile ? .85 : 1.35) + this.rng() * .45;
    f.dodges++;
    f.dodgeStamp = this.time;
    this.dodgeCount++;
    this.events.push({ t: 'dodge', side: f.side, idx: f.slot, moveName: mv ? mv.n : '', x: f.x, y: f.y, dir: px, name: f.name });
    return true;
  }

  _dodgeEvent(f, mv) {
    f.dodges++;
    this.dodgeCount++;
    this.events.push({ t: 'dodge', side: f.side, idx: f.slot, moveName: mv ? mv.n : '', x: f.x, y: f.y, dir: 0, name: f.name, zone: true });
  }

  /* ---------------- 종료 ---------------- */
  reap() {
    for (const f of this.all) {
      if (f.hp > 0 || f._ko) continue;
      f._ko = true;
      const killer = f.lastHitBy && f.lastHitBy.side !== f.side ? f.lastHitBy : null;
      if (killer) killer.kos = (killer.kos || 0) + 1;
      this.events.push({ t: 'faint', side: f.side, idx: f.slot, name: f.name, x: f.x, y: f.y, killer: killer ? killer.name : null });
      this._log(`${josa(f.name, '은/는')} 쓰러졌다!`, 'faint');
      // 타겟 재지정
      for (const o of this.all) if (o.target === f) o.target = this._nearestFoe(o);
    }
  }

  _checkEnd() {
    if (this.finished) return;
    const a = this.aliveA.length, b = this.aliveB.length;
    if (a === 0 || b === 0) this._finish(a === 0 && b === 0 ? 'draw' : a === 0 ? 'B' : 'A');
  }

  _finishByTime() {
    const ha = this.A.reduce((s, f) => s + Math.max(0, f.hp) / f.maxHp, 0);
    const hb = this.B.reduce((s, f) => s + Math.max(0, f.hp) / f.maxHp, 0);
    this._finish(Math.abs(ha - hb) < .08 ? 'draw' : ha > hb ? 'A' : 'B', true);
  }

  _finish(winner, byTime = false) {
    if (this.finished) return;
    this.finished = true;
    this.winner = winner;
    const stats = (team) => team.map((f) => ({
      id: f.dex.id, name: f.name, dmg: Math.round(f.damageDealt || 0), kos: f.kos || 0,
      dodges: f.dodges || 0, casts: f.casts || 0, hits: f.hits || 0,
      healed: Math.round(f.healed || 0), hp: Math.max(0, Math.round(f.hp)), maxHp: f.maxHp,
      survived: f.alive, side: f.side
    }));
    const all = [...stats(this.A), ...stats(this.B)];
    const mvp = all.slice().sort((a, b) => (b.dmg + b.kos * 170 + b.dodges * 35 + b.healed * .4) - (a.dmg + a.kos * 170 + a.dodges * 35 + a.healed * .4))[0];
    this.result = { winner, mvp, stats: { A: stats(this.A), B: stats(this.B) }, duration: this.duration, byTime, weather: this.weather };
    this.events.push({ t: 'end', ...this.result });
    this._log(winner === 'draw' ? '무승부!' : `${winner === 'A' ? '내 팀' : '상대 팀'}의 승리!`, 'win');
  }

  runHeadless(maxSteps = 4000) {
    let n = 0;
    while (!this.finished && n++ < maxSteps) this.step(1 / 30);
    if (!this.finished) this._finishByTime();
    return this.result;
  }
}

/* 프리뷰 승률 추정 (실시간 엔진 헤드리스) */
export function arenaWinRate(teamA, teamB, weather, runs = 7) {
  let win = 0, draw = 0;
  for (let i = 0; i < runs; i++) {
    const b = new ArenaBattle({ teamA, teamB, weather, seed: 7919 * (i + 3) + teamA.length * 131 });
    const r = b.runHeadless(3000);
    if (r.winner === 'A') win++;
    else if (r.winner === 'draw') draw++;
  }
  const denom = Math.max(1, runs - draw * .5);
  return Math.round((win / denom) * 100);
}
