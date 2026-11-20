/* ============================================================================
   배틀 화면 재생기 — 시뮬레이션 이벤트를 애니메이션으로 재생
   ========================================================================== */
import { WEATHERS, TYPE_COLORS, moveById, monById, statsAt50, josa } from './engine.js';
import { Scene } from './scenes.js';
import { FX, getFxSpec } from './fx.js';
import { getArt, playCry, sfx } from './sprites.js';
import { weatherIcon } from './icons.js';

const $ = (s) => document.querySelector(s);

export class BattleUI {
  constructor({ onQuit, onAgain }) {
    this.onQuit = onQuit;
    this.onAgain = onAgain;
    this.speed = 2;
    this.paused = false;
    this.running = false;
    this.stage = 'stadium';
    this.weather = 'clear';
    this.config = null;
    this.active = { A: null, B: null };
    this.el = {
      wrap: $('#stageWrap'), scene: $('#sceneCanvas'), fx: $('#fxCanvas'),
      monA: $('#monA'), monB: $('#monB'), imgA: $('#imgA'), imgB: $('#imgB'),
      hudA: $('#hudA'), hudB: $('#hudB'),
      nameA: $('#nameA'), nameB: $('#nameB'),
      hpFillA: $('#hpFillA'), hpFillB: $('#hpFillB'),
      hpTextA: $('#hpTextA'), hpTextB: $('#hpTextB'),
      typesA: $('#typesA'), typesB: $('#typesB'),
      statusA: $('#statusA'), statusB: $('#statusB'),
      popups: $('#popupLayer'), banner: $('#banner'), toast: $('#moveToast'),
      hitstop: $('#hitstop'), turn: $('#turnChip'), weatherChip: $('#weatherChip'),
      log: $('#battleLog'), logCount: $('#logCount'),
      rosterA: $('#rosterA .roster-list'), rosterB: $('#rosterB .roster-list'),
      pauseBtn: $('#pauseBtn'), speedGroup: $('#speedGroup'),
      result: $('#resultOverlay'), winner: $('#winnerTitle'), resultSub: $('#resultSub'),
      crown: $('#resultCrown'), mvp: $('#mvpBox'), stats: $('#statsTable')
    };
    this._bind();
    this._ro = new ResizeObserver(() => {
      if (this.scene) this.scene.resize();
      if (this.fx) this.fx.resize();
    });
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
      this._flushPause();
    });
  }

  /* ---------------- 준비 ---------------- */
  setup({ teamA, teamB, weather, stage }) {
    this.config = { teamA: teamA.slice(), teamB: teamB.slice(), weather, stage };
    this.stage = stage; this.weather = weather;
    this.paused = false; this.running = true;
    this.el.pauseBtn.textContent = '⏸'; this.el.pauseBtn.style.background = '';
    this.el.log.innerHTML = '';
    this.el.popups.innerHTML = '';
    this.el.banner.className = 'banner';
    this.el.banner.textContent = '';
    this.el.result.classList.remove('show');
    this.el.monA.classList.remove('fainted', 'hurt', 'lunge', 'entering', 'attack-aura');
    this.el.monB.classList.remove('fainted', 'hurt', 'lunge', 'entering', 'attack-aura');
    this.el.imgA.style.opacity = '0';
    this.el.imgB.style.opacity = '0';
    this.el.weatherChip.innerHTML = `${weatherIcon(weather)}<span>${WEATHERS[weather].name}</span>`;
    this.el.turn.textContent = 'TURN 1';
    this.el.stats.innerHTML = '';
    this._logCount = 0;
    this.el.logCount.textContent = '';

    if (this.scene) this.scene.destroy();
    this.scene = new Scene(this.el.scene, stage, weather, false);
    if (this.fx) this.fx.clear();
    else this.fx = new FX(this.el.fx);
    this.fx.resize();
    this._layoutPlatforms(stage);

    this._renderRoster('A', teamA);
    this._renderRoster('B', teamB);
    this.active = { A: null, B: null };
    return this;
  }

  _layoutPlatforms(stage) {
    const landscape = this.el.wrap.clientWidth / Math.max(1, this.el.wrap.clientHeight) > 1.15;
    const layout = landscape
      ? { left: { x: 0.26, y: 0.84 }, right: { x: 0.74, y: 0.65 } }
      : { left: { x: 0.27, y: 0.77 }, right: { x: 0.72, y: 0.60 } };
    this.scene.setLayout(layout);
  }

  /* ---------------- 재생 ---------------- */
  async run() {
    const { teamA, teamB, weather } = this.config;
    const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    const { simulate } = await import('./engine.js');
    const battle = simulate({ teamA, teamB, weather, seed });
    this.battle = battle;
    const evs = battle.events;
    // 첫 등장
    const firstSwitch = { A: teamA[0], B: teamB[0] };
    await this._enter('A', firstSwitch.A, true);
    await this.wait(160);
    await this._enter('B', firstSwitch.B, true);
    await this.wait(420);

    for (const ev of evs) {
      if (!this.running) return;
      await this.handleEvent(ev);
      if (!this.running) return;
    }
    this.finish();
  }

  async _enter(side, id, cry = false) {
    const el = side === 'A' ? this.el.monA : this.el.monB;
    const img = side === 'A' ? this.el.imgA : this.el.imgB;
    const mon = monById(id);
    this.active[side] = id;
    const art = await getArt(id);
    img.src = art.src || this._fallbackArt(mon);
    img.style.opacity = art.src ? '1' : '.9';
    img.alt = mon.n;
    el.classList.remove('fainted');
    el.classList.remove('entering');
    void el.offsetWidth;
    el.classList.add('entering');
    this._setHud(side, mon);
    this._updateHp(side, this._hpOf(side, id), this._maxHpOf(side, id), true);
    this._markRoster();
    if (cry) { playCry(id, 0.3); await this.wait(260); }
  }

  _fallbackArt(mon) {
    const c = TYPE_COLORS[mon.t[0]] || '#888';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><radialGradient id="g"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#0b1020"/></radialGradient></defs><circle cx="100" cy="100" r="86" fill="url(#g)" stroke="${c}" stroke-width="4"/><text x="100" y="116" font-size="56" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">${mon.n.slice(0, 2)}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  _hpOf(side, id) {
    const f = this.battle?.fighters?.[side]?.find((x) => x.dex.id === id);
    return f ? f.maxHp : this._maxHpOf(side, id);
  }
  _maxHpOf(side, id) {
    const mon = monById(id);
    return statsAt50(mon.st).hp;
  }

  _setHud(side, mon) {
    const N = side === 'A' ? this.el.nameA : this.el.nameB;
    const T = side === 'A' ? this.el.typesA : this.el.typesB;
    const St = side === 'A' ? this.el.statusA : this.el.statusB;
    N.textContent = mon.n;
    T.innerHTML = mon.t.map((t) => `<span class="type-chip" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('');
    St.className = 'hud-status';
    St.textContent = '';
  }

  _updateHp(side, hp, max, instant = false) {
    const fill = side === 'A' ? this.el.hpFillA : this.el.hpFillB;
    const txt = side === 'A' ? this.el.hpTextA : this.el.hpTextB;
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    fill.style.transition = instant || hp <= 0 ? 'none' : '';
    fill.style.width = pct + '%';
    fill.classList.toggle('mid', pct <= 50 && pct > 20);
    fill.classList.toggle('low', pct <= 20);
    txt.textContent = `${Math.max(0, hp)} / ${max}`;
    if (instant) requestAnimationFrame(() => { fill.style.transition = ''; });
    const roster = side === 'A' ? this.el.rosterA : this.el.rosterB;
    const row = [...roster.children].find((r) => Number(r.dataset.id) === this.active[side]);
    if (row) {
      const hpEl = row.querySelector('.rm-hp');
      const p = Math.round(pct);
      hpEl.textContent = p + '%';
      hpEl.style.color = p <= 20 ? '#ff8a8a' : p <= 50 ? '#ffd166' : '#7bf0a8';
      row.classList.toggle('dead', hp <= 0);
    }
  }

  _renderRoster(side, team) {
    const box = side === 'A' ? this.el.rosterA : this.el.rosterB;
    box.innerHTML = '';
    team.forEach((id, i) => {
      const mon = monById(id);
      const row = document.createElement('div');
      row.className = 'roster-mon';
      row.dataset.id = id;
      row.innerHTML = `<img loading="lazy" alt=""><span class="rm-name">${mon.n}</span><span class="rm-hp">100%</span>`;
      getArt(id).then((a) => { if (a.src) row.querySelector('img').src = a.src; });
      box.appendChild(row);
    });
    this._markRoster();
  }

  _markRoster() {
    for (const side of ['A', 'B']) {
      const box = side === 'A' ? this.el.rosterA : this.el.rosterB;
      [...box.children].forEach((row) => {
        row.classList.toggle('active', Number(row.dataset.id) === this.active[side]);
      });
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
    const max = 220;
    while (this.el.log.children.length > max) this.el.log.firstChild.remove();
  }

  wait(ms) {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        if (!this.running) return resolve();
        if (this.paused) { this._pauseResolve = () => requestAnimationFrame(tick); return; }
        const elapsed = performance.now() - start;
        const scaled = ms / Math.max(1, this.speed);
        if (elapsed >= scaled) return resolve();
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  _flushPause() { if (!this.paused && this._pauseResolve) { const r = this._pauseResolve; this._pauseResolve = null; r(); } }

  /* ---------------- 이벤트 처리 ---------------- */
  async handleEvent(ev) {
    switch (ev.t) {
      case 'turn':
        this.el.turn.textContent = `TURN ${ev.n}`;
        if (ev.n > 1) await this.wait(120);
        break;
      case 'switch': {
        if (this.active[ev.side] === ev.id && ev.reason === 'faint') {
          // 같은 포켓몬 재등장은 없음
        }
        const isNew = this.active[ev.side] !== ev.id;
        if (isNew) await this._enter(ev.side, ev.id, true);
        break;
      }
      case 'move': {
        const move = ev.move || moveById(ev.moveId);
        const side = ev.side;
        const from = this._point(side);
        const to = this._point(side === 'A' ? 'B' : 'A');
        this._toast(move);
        const monEl = side === 'A' ? this.el.monA : this.el.monB;
        const spec = getFxSpec(move);
        monEl.style.setProperty('--aura', `rgba(255,255,255,.32)`);
        if (['rush', 'bite'].includes(spec.kind)) {
          monEl.style.setProperty('--lx', side === 'A' ? '16%' : '-16%');
        }
        monEl.classList.add('attack-aura');
        monEl.style.setProperty('--aura', this._hexA(spec.color, 0.45));
        setTimeout(() => monEl.classList.remove('attack-aura'), 760);
        if (move.c === '변화') sfx('whoosh');
        await this.fx.cast(move, from, to, {
          speed: () => this.speed,
          onWindup: () => { monEl.style.setProperty('--lx', side === 'A' ? '16%' : '-16%'); },
          onFire: () => { sfx(move.c === '변화' ? 'whoosh' : this._sfxForMove(move)); },
          onLunge: () => { this._lunge(side); },
          onQuake: () => this._shake(1.5),
          onImpact: () => { this._shake(spec.big ? 1 : 0.55); }
        });
        this._hideToast();
        break;
      }
      case 'damage': {
        const max = ev.maxHp; const hp = ev.hp;
        this._updateHp(ev.side, hp, max);
        const monEl = ev.side === 'A' ? this.el.monA : this.el.monB;
        this._hurt(ev.side);
        if (ev.amount > 0) {
          this._pop(ev.side, `-${ev.amount}`);
          const power = Math.min(1, ev.amount / Math.max(1, max) * 2.2);
          sfx(ev.crit ? 'crit' : ev.eff >= 2 ? 'super' : 'hit', 0.7 + power * 0.8);
          this._hitstop(ev.crit || ev.eff >= 2);
          await this.wait(ev.crit ? 260 : 190);
        }
        break;
      }
      case 'heal':
        this._updateHp(ev.side, ev.hp, ev.maxHp);
        this._pop(ev.side, `+${ev.amount}`, 'heal');
        sfx('heal');
        await this.wait(200);
        break;
      case 'status': {
        const st = ev.status;
        const chip = ev.side === 'A' ? this.el.statusA : this.el.statusB;
        if (st === 'confuse') { chip.className = 'hud-status on slp'; chip.textContent = '혼란'; }
        else { chip.className = 'hud-status on ' + st; chip.textContent = ev.text; }
        break;
      }
      case 'cure': {
        const chip = ev.side === 'A' ? this.el.statusA : this.el.statusB;
        chip.className = 'hud-status';
        chip.textContent = '';
        break;
      }
      case 'boost': {
        const monEl = ev.side === 'A' ? this.el.monA : this.el.monB;
        monEl.classList.add('attack-aura');
        setTimeout(() => monEl.classList.remove('attack-aura'), 700);
        this._pop(ev.side, `${ev.delta > 0 ? '▲' : '▼'}`, 'stat');
        break;
      }
      case 'banner':
        this._banner(ev.text, ev.kind);
        break;
      case 'miss':
        this._pop(ev.side === 'A' ? 'B' : 'A', '빗나감', 'miss');
        break;
      case 'faint': {
        const monEl = ev.side === 'A' ? this.el.monA : this.el.monB;
        monEl.classList.add('fainted');
        const chip = ev.side === 'A' ? this.el.statusA : this.el.statusB;
        chip.className = 'hud-status';
        chip.textContent = '';
        sfx('faint');
        await this.wait(900);
        break;
      }
      case 'log':
        this._log(ev.text, ev.cls);
        break;
      case 'weather':
        break;
      case 'end':
        this._endData = ev;
        break;
      default: break;
    }
  }

  _hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  _sfxForMove(move) {
    if (move.t === '불꽃') return 'fire';
    if (move.t === '전기') return 'crit';
    if (move.t === '물') return 'whoosh';
    return 'whoosh';
  }

  _point(side) {
    const el = side === 'A' ? this.el.monA : this.el.monB;
    const stage = this.el.wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - stage.left + r.width / 2, y: r.top - stage.top + r.height * 0.42 };
  }

  _pop(side, text, kind = '') {
    const p = this._point(side);
    const d = document.createElement('div');
    d.className = 'dmg-pop ' + kind;
    d.textContent = text;
    d.style.left = p.x + 'px';
    d.style.top = (p.y - 10) + 'px';
    this.el.popups.appendChild(d);
    setTimeout(() => d.remove(), 1200);
    if (kind === 'stat') d.style.fontSize = '22px';
  }

  _banner(text, kind) {
    const b = this.el.banner;
    b.className = 'banner ' + kind;
    b.textContent = text;
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.remove('show'), 1050);
  }

  _toast(move) {
    const t = this.el.toast;
    t.textContent = move.n;
    t.style.borderColor = this._hexA(TYPE_COLORS[move.t] || '#fff', 0.6);
    t.style.boxShadow = `0 0 26px ${this._hexA(TYPE_COLORS[move.t] || '#fff', 0.28)}`;
    t.classList.add('show');
  }
  _hideToast() { this.el.toast.classList.remove('show'); }

  _lunge(side) {
    const el = side === 'A' ? this.el.monA : this.el.monB;
    el.classList.remove('lunge');
    void el.offsetWidth;
    el.classList.add('lunge');
    setTimeout(() => el.classList.remove('lunge'), 460);
  }
  _hurt(side) {
    const el = side === 'A' ? this.el.monA : this.el.monB;
    el.classList.remove('hurt');
    void el.offsetWidth;
    el.classList.add('hurt');
    setTimeout(() => el.classList.remove('hurt'), 500);
  }
  _hitstop(strong) {
    const h = this.el.hitstop;
    h.className = 'stage-hitstop';
    void h.offsetWidth;
    h.classList.add(strong ? 'flash' : 'freeze');
  }
  _shake(power = 1) {
    const w = this.el.wrap;
    const amp = 4 * power;
    try {
      w.animate([
        { transform: 'translate(0,0)' },
        { transform: `translate(${-amp}px, ${amp * 0.6}px)` },
        { transform: `translate(${amp * 0.8}px, ${-amp * 0.5}px)` },
        { transform: `translate(${-amp * 0.5}px, ${amp * 0.3}px)` },
        { transform: 'translate(0,0)' }
      ], { duration: 220 + power * 60, easing: 'ease-out' });
    } catch (e) { /* noop */ }
  }

  /* ---------------- 종료 ---------------- */
  finish() {
    const end = this._endData || this.battle.events.find((e) => e.t === 'end');
    this.running = false;
    this._showResult(end);
  }

  async _showResult(end) {
    const win = end.winner;
    const my = this.config.teamA, opp = this.config.teamB;
    const el = this.el;
    el.result.classList.add('show');
    if (win === 'A') {
      el.winner.textContent = '승리!';
      el.winner.className = '';
      el.crown.textContent = '👑';
      el.resultSub.textContent = `${end.turns}턴 만에 상대 팀을 모두 쓰러뜨렸습니다!`;
      sfx('win');
    } else if (win === 'B') {
      el.winner.textContent = '패배…';
      el.winner.className = 'lose';
      el.crown.textContent = '💤';
      el.resultSub.textContent = `${end.turns}턴 만에 패배했습니다. 다시 도전해 보세요.`;
      sfx('lose');
    } else {
      el.winner.textContent = '무승부';
      el.winner.className = 'draw';
      el.crown.textContent = '🤝';
      el.resultSub.textContent = '양 팀 모두 끝까지 버텼습니다.';
    }
    const mvp = end.mvp;
    const mon = monById(mvp.id);
    const art = await getArt(mvp.id);
    el.mvp.innerHTML = `<img alt=""><div class="mvp-info"><span>MVP</span><b>${mon.n}</b><small>총 피해 ${mvp.dmg.toLocaleString()} · ${mvp.kos} KO ${mvp.survived ? '· 생존' : ''}</small></div>`;
    if (art.src) el.mvp.querySelector('img').src = art.src;

    const maxDmg = Math.max(1, ...[...end.stats.A, ...end.stats.B].map((s) => s.dmg));
    const rows = (stats, label, cls) => `
      <div class="rs-team">
        <h5>${label}</h5>
        ${stats.map((s) => {
          const m = monById(s.id);
          return `<div class="rs-row"><img alt="" data-id="${s.id}" style="--g:${s.survived ? 0 : 1}">
            <span class="rs-name">${m.n}</span>
            <span class="rs-bar"><i style="width:${Math.round((s.dmg / maxDmg) * 100)}%"></i></span>
            <span class="rs-dmg">${s.dmg.toLocaleString()}</span></div>`;
        }).join('')}
      </div>`;
    el.stats.innerHTML = rows(end.stats.A, '내 팀', 'a') + rows(end.stats.B, '상대 팀', 'b');
    const rl = document.querySelector('#resultLog');
    if (rl) {
      rl.innerHTML = '';
      [...this.el.log.children].forEach((n) => rl.appendChild(n.cloneNode(true)));
      rl.scrollTop = 0;
    }
    el.stats.querySelectorAll('img[data-id]').forEach(async (img) => {
      const a = await getArt(Number(img.dataset.id));
      if (a.src) img.src = a.src;
    });
  }

  destroy() {
    this.running = false;
    this.paused = false;
    if (this.scene) { this.scene.destroy(); this.scene = null; }
    if (this.fx) { this.fx.clear(); }
  }
}
