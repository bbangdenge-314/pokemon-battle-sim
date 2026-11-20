/* ============================================================================
   아레나 배경 (2.5D 쿼터뷰) — 11개 장소
   - 상단 23% : 원경 (하늘·관중석·바다·산맥·네온 스카이라인 …)
   - 나머지 77% : 포켓몬이 실제로 X·Y 이동하는 플레이어블 아레나 바닥
   - 바닥 경계선 · 중앙선 · 팀 진영 · 원근 격자 · 장식물(충돌 없음)
   ========================================================================== */

const TAU = Math.PI * 2;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* 필드 좌표(fx 0=좌·1=우, fy 0=뒤·1=앞) → 화면 좌표 */
export const FIELD = { top: 0.235, backHalf: 0.405, frontHalf: 0.56 };

export function project(fx, fy, W, H) {
  const f = clamp01(fy);
  const y = H * (FIELD.top + (1 - FIELD.top) * f);
  const half = W * (FIELD.backHalf + (FIELD.frontHalf - FIELD.backHalf) * f);
  return { x: W * 0.5 + (fx - 0.5) * 2 * half, y, s: 0.70 + 0.52 * f, half };
}

/* 바닥 지점 (fx, fy)의 원근 반경(px) */
export function floorRadius(rx, ry, W, H) {
  return { rx: W * rx, ry: H * ry };
}

/* ------------------------------------------------------------------ */
/* 장소 설정                                                           */
/* ------------------------------------------------------------------ */
export const ARENA_STAGES = {
  stadium: {
    name: '포켓몬 스타디움', sky: ['#060f22', '#123059', '#1f4b78'], outer: '#0a1220',
    floor: ['#3d8a63', '#215139', '#132e21'], accent: '#b8f2d4', tex: 'grass', lines: 'rgba(240,255,250,.3)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'none',
    props: [{ k: 'flag', fx: .055, fy: .14 }, { k: 'flag', fx: .945, fy: .14 },
      { k: 'flag', fx: .035, fy: .74 }, { k: 'flag', fx: .965, fy: .74 },
      { k: 'barrier', fx: .10, fy: .045, w: 1.2 }, { k: 'barrier', fx: .90, fy: .045, w: 1.2 }]
  },
  beach: {
    name: '해변', sky: ['#3fb4ea', '#8bdcf7', '#ffe3b8'], outer: '#1a7ea6',
    floor: ['#f2ddab', '#d9bc83', '#b8925b'], accent: '#fff6dc', tex: 'sand', lines: 'rgba(255,250,235,.5)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'bubble',
    props: [{ k: 'palm', fx: .935, fy: .10 }, { k: 'palm', fx: .06, fy: .30 },
      { k: 'umbrella', fx: .065, fy: .62 }, { k: 'rock', fx: .94, fy: .52 }, { k: 'ball', fx: .90, fy: .86 }]
  },
  rock: {
    name: '바위산', sky: ['#2a2340', '#6d4c63', '#c98a63'], outer: '#3a2822',
    floor: ['#8a6247', '#64452f', '#3d2a1e'], accent: '#ffd9a6', tex: 'stone', lines: 'rgba(255,220,180,.22)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'dust',
    props: [{ k: 'boulder', fx: .07, fy: .12, s: 1.3 }, { k: 'boulder', fx: .93, fy: .22, s: 1.7 },
      { k: 'boulder', fx: .05, fy: .58, s: 1.1 }, { k: 'rockpillar', fx: .95, fy: .70, s: 1.5 }, { k: 'boulder', fx: .88, fy: .92, s: .9 }]
  },
  snow: {
    name: '설산', sky: ['#0d2544', '#31618d', '#b7d5e8'], outer: '#1b3247',
    floor: ['#cfe6f5', '#a8c8de', '#7d9fba'], accent: '#ffffff', tex: 'ice', lines: 'rgba(70,140,190,.45)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'snow',
    props: [{ k: 'pine', fx: .06, fy: .08, s: 1.1 }, { k: 'pine', fx: .94, fy: .12, s: 1.3 },
      { k: 'pine', fx: .035, fy: .46, s: .9 }, { k: 'iceblock', fx: .95, fy: .62, s: 1.2 }, { k: 'iceblock', fx: .08, fy: .88, s: .8 }]
  },
  forest: {
    name: '숲', sky: ['#0c2216', '#1d4a2c', '#4e8f52'], outer: '#12271a',
    floor: ['#5d9152', '#3a6b3c', '#24462a'], accent: '#c8ffb0', tex: 'moss', lines: 'rgba(210,255,190,.26)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'firefly',
    props: [{ k: 'tree', fx: .06, fy: .10, s: 1.2 }, { k: 'tree', fx: .935, fy: .08, s: 1.4 },
      { k: 'tree', fx: .04, fy: .52, s: 1 }, { k: 'tree', fx: .96, fy: .58, s: 1.1 },
      { k: 'mushroom', fx: .10, fy: .80, s: 1 }, { k: 'log', fx: .90, fy: .88, s: 1 }]
  },
  volcano: {
    name: '화산', sky: ['#180812', '#4d1220', '#a83a1e'], outer: '#2a0e0a',
    floor: ['#3a231d', '#241310', '#160a08'], accent: '#ff9a4a', tex: 'lava', lines: 'rgba(255,150,70,.28)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'ember',
    props: [{ k: 'lavavent', fx: .075, fy: .18 }, { k: 'obsidian', fx: .93, fy: .30, s: 1.3 },
      { k: 'obsidian', fx: .06, fy: .66, s: 1 }, { k: 'lavavent', fx: .945, fy: .78 }, { k: 'obsidian', fx: .87, fy: .95, s: .8 }]
  },
  city: {
    name: '밤 도심', sky: ['#05071a', '#101a3c', '#2a2350'], outer: '#0b0f22',
    floor: ['#28304f', '#1a2038', '#0e1324'], accent: '#9fc4ff', tex: 'tile', lines: 'rgba(150,190,255,.28)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'neon',
    props: [{ k: 'pump', fx: .07, fy: .12 }, { k: 'antenna', fx: .93, fy: .10 }, { k: 'sign', fx: .05, fy: .55 },
      { k: 'pump', fx: .94, fy: .64 }, { k: 'crate', fx: .09, fy: .90 }]
  },
  space: {
    name: '우주', sky: ['#04030f', '#0b0724', '#170b33'], outer: '#07040f',
    floor: ['#2a2358', '#191238', '#0c0722'], accent: '#b9a6ff', tex: 'hex', lines: 'rgba(180,150,255,.35)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'star',
    props: [{ k: 'crystal', fx: .07, fy: .16, s: 1 }, { k: 'crystal', fx: .93, fy: .22, s: 1.2 },
      { k: 'satellite', fx: .06, fy: .70 }, { k: 'crystal', fx: .95, fy: .74, s: .9 }]
  },
  temple: {
    name: '신전', sky: ['#1a1430', '#2c2350', '#5e4a7a'], outer: '#191426',
    floor: ['#5a4f78', '#3b3352', '#231d33'], accent: '#d8c8ff', tex: 'marble', lines: 'rgba(220,200,255,.28)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'sparkle',
    props: [{ k: 'pillar', fx: .06, fy: .13, s: 1 }, { k: 'pillar', fx: .94, fy: .13, s: 1 },
      { k: 'brazier', fx: .04, fy: .58 }, { k: 'brazier', fx: .96, fy: .58 }, { k: 'statue', fx: .08, fy: .92, s: .8 }]
  },
  cave: {
    name: '수정 동굴', sky: ['#050a1c', '#0c1a38', '#132a4a'], outer: '#050a14',
    floor: ['#1d3355', '#132340', '#0a1226'], accent: '#8fe3ff', tex: 'cave', lines: 'rgba(130,220,255,.3)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'sparkle',
    props: [{ k: 'crystal', fx: .06, fy: .12, s: 1.4 }, { k: 'crystal', fx: .94, fy: .18, s: 1.1 },
      { k: 'crystal', fx: .04, fy: .62, s: 1 }, { k: 'crystal', fx: .96, fy: .68, s: 1.5 }, { k: 'boulder', fx: .10, fy: .92, s: .7 }]
  },
  desert: {
    name: '사막', sky: ['#e8a355', '#f6c889', '#ffe8bd'], outer: '#d9a86a',
    floor: ['#f0d49b', '#dfb877', '#c39a58'], accent: '#fff3cf', tex: 'dune', lines: 'rgba(255,240,200,.45)',
    side: ['#4d8dff', '#f04b5a'], ambient: 'dust',
    props: [{ k: 'cactus', fx: .07, fy: .14, s: 1.1 }, { k: 'ruin', fx: .93, fy: .16, s: 1.1 },
      { k: 'cactus', fx: .95, fy: .60, s: .9 }, { k: 'palm', fx: .05, fy: .66, s: .9 }, { k: 'rock', fx: .90, fy: .90, s: .8 }]
  }
};

/* ------------------------------------------------------------------ */
export class ArenaScene {
  constructor(canvas, stageId, weather = 'clear', lite = false, auto = true) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stage = ARENA_STAGES[stageId] ? stageId : 'stadium';
    this.cfg = ARENA_STAGES[this.stage];
    this.weather = weather;
    this.lite = lite;
    this.t = 0;
    this.last = 0;
    this.dead = false;
    this.dpr = Math.min(lite ? 1.4 : 1.75, window.devicePixelRatio || 1);
    this.stars = Array.from({ length: lite ? 26 : 74 }, () => ({ x: Math.random(), y: Math.random() * 0.22, r: rnd(1.5, .35), p: rnd(TAU), s: rnd(1.1, .3) }));
    this.clouds = Array.from({ length: lite ? 2 : 4 }, () => ({ x: Math.random(), y: rnd(.14, .02), s: rnd(1.3, .6), v: rnd(.00005, .000012) }));
    this.parts = [];
    this.wparts = [];
    this.acc = 0;
    this.resize();
    this._loop = this._loop.bind(this);
    if (auto) this.raf = requestAnimationFrame(this._loop);
  }
  get props() { return this.cfg.props || []; }
  setWeather(w) { this.weather = w; }
  setLayout() { /* 아레나에는 발판 레이아웃이 없음 */ }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width || 900;
    this.h = r.height || 500;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  destroy() { this.dead = true; cancelAnimationFrame(this.raf); }
  tick(dt) { if (this.dead) return; this.t += dt; this.draw(this.t / 1000, dt); }
  _loop(ts) {
    if (this.dead) return;
    const dt = Math.min(48, ts - (this.last || ts));
    this.last = ts;
    this.t += dt;
    this.draw(this.t / 1000, dt);
    this.raf = requestAnimationFrame(this._loop);
  }

  /* ---------------- 메인 ---------------- */
  draw(t, dt) {
    const ctx = this.ctx, W = this.w, H = this.h;
    ctx.clearRect(0, 0, W, H);
    this.skyBand(ctx, t, W, H);
    this.scenery(ctx, t, W, H);
    this.outerGround(ctx, t, W, H);
    this.floor(ctx, t, W, H);
    this.markings(ctx, t, W, H);
    this.ambient(ctx, t, dt, W, H);
    this.weatherLayer(ctx, t, dt, W, H);
    this.vignette(ctx, W, H);
  }

  floorPath(ctx, W, H) {
    const bl = project(0, 0, W, H), br = project(1, 0, W, H);
    const fr = project(1, 1, W, H), fl = project(0, 1, W, H);
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
    ctx.lineTo(fr.x, fr.y); ctx.lineTo(fl.x, fl.y);
    ctx.closePath();
    return { bl, br, fr, fl };
  }

  skyBand(ctx, t, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H * (FIELD.top + 0.04));
    this.cfg.sky.forEach((c, i) => g.addColorStop(i / (this.cfg.sky.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * (FIELD.top + 0.05));
  }

  outerGround(ctx, t, W, H) {
    const g = ctx.createLinearGradient(0, H * FIELD.top, 0, H);
    g.addColorStop(0, this.cfg.outer);
    g.addColorStop(1, '#04060d');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * FIELD.top - 1, W, H - H * FIELD.top + 1);
  }

  /* ---------------- 원경 (상단 밴드) ---------------- */
  scenery(ctx, t, W, H) {
    const band = H * FIELD.top;
    switch (this.stage) {
      case 'stadium': {
        // 관중석 3단 + 조명 기둥
        for (let r = 0; r < 3; r++) {
          const y = band * (0.34 + r * 0.22);
          ctx.fillStyle = r === 0 ? 'rgba(16,28,54,.95)' : r === 1 ? 'rgba(22,36,66,.95)' : 'rgba(28,44,78,.95)';
          ctx.fillRect(0, y, W, band * 0.24);
          const n = this.lite ? 34 : 86;
          for (let i = 0; i < n; i++) {
            const x = ((i + (r % 2) * 0.5) / n) * W;
            const bob = Math.sin(t * 2 + i * 1.7 + r) * 1.6;
            const blink = Math.sin(t * 2.6 + i * 1.3 + r) > 0.86;
            ctx.fillStyle = blink ? 'rgba(255,238,180,.95)' : `rgba(${70 + ((i * 37) % 120)},${92 + ((i * 53) % 96)},${150 + ((i * 71) % 80)},.85)`;
            ctx.beginPath(); ctx.arc(x, y + band * 0.1 + bob, 1.5 + (r % 3) * 0.2, 0, TAU); ctx.fill();
          }
        }
        ctx.fillStyle = 'rgba(150,185,235,.18)';
        ctx.fillRect(0, band * 0.29, W, 2);
        // 조명탑
        for (const fx of [0.08, 0.92]) {
          const x = W * fx;
          ctx.strokeStyle = 'rgba(180,215,255,.28)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x, band * 0.9); ctx.lineTo(x, band * 0.1); ctx.stroke();
          for (let i = 0; i < 3; i++) {
            const bx = x + (i - 1) * 13, by = band * 0.1;
            const gl = ctx.createRadialGradient(bx, by, 0, bx, by, 46);
            gl.addColorStop(0, 'rgba(230,245,255,.95)'); gl.addColorStop(.4, 'rgba(170,215,255,.3)'); gl.addColorStop(1, 'rgba(120,170,255,0)');
            ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bx, by, 46, 0, TAU); ctx.fill();
          }
        }
        break;
      }
      case 'beach': {
        const seaH = band * 0.52;
        const sg = ctx.createLinearGradient(0, band * 0.28, 0, band * 0.8);
        sg.addColorStop(0, '#219bd0'); sg.addColorStop(1, '#0d6b96');
        ctx.fillStyle = sg; ctx.fillRect(0, band * 0.28, W, seaH);
        // 수평선 반짝임
        for (let i = 0; i < 26; i++) {
          const x = (i / 26) * W + Math.sin(t * .6 + i) * 6;
          const y = band * 0.34 + ((i * 29) % (band * 0.4));
          ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.12 * Math.sin(t * 2 + i)})`;
          ctx.fillRect(x, y, 10 + Math.sin(t + i) * 6, 1.6);
        }
        // 파도
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 14) {
          const y = band * 0.78 + Math.sin(x * .014 + t * 1.4) * 3;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        // 태양
        const sx = W * 0.8, sy = band * 0.34;
        const gl = ctx.createRadialGradient(sx, sy, 0, sx, sy, band * 0.6);
        gl.addColorStop(0, 'rgba(255,250,220,.95)'); gl.addColorStop(.3, 'rgba(255,235,150,.5)'); gl.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sx, sy, band * 0.6, 0, TAU); ctx.fill();
        this.cloudsDraw(ctx, W, H, 'rgba(255,255,255,.85)', 1);
        break;
      }
      case 'rock': {
        const layers = [[0.9, '#4a3350'], [0.7, '#5b3c48'], [0.5, '#3d2a2e']];
        layers.forEach(([base, col], li) => {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(0, band);
          for (let i = 0; i <= 10; i++) {
            const x = (i / 10) * W;
            const y = band * base - Math.abs(Math.sin(i * 2.1 + li)) * band * 0.42 - (i % 2 ? band * 0.08 : 0);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, band); ctx.closePath(); ctx.fill();
        });
        for (let i = 0; i < 4; i++) {
          const x = W * (0.12 + i * 0.26), top = band * (0.42 + (i % 2) * 0.1);
          const g = ctx.createLinearGradient(x - 20, 0, x + 24, 0);
          g.addColorStop(0, '#4c352c'); g.addColorStop(.6, '#6d4f3f'); g.addColorStop(1, '#30211c');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x - 22, band); ctx.lineTo(x - 14, top); ctx.lineTo(x + 8, top - 6); ctx.lineTo(x + 24, band); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'snow': {
        // 오로라
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const g = ctx.createLinearGradient(0, 0, W, band);
          g.addColorStop(0, 'rgba(120,255,200,0)');
          g.addColorStop(.45, `rgba(${120 + i * 40},255,${180 + i * 20},${0.09 + Math.sin(t + i) * .03})`);
          g.addColorStop(1, 'rgba(120,180,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(0, band * (0.12 + i * 0.06));
          for (let x = 0; x <= W; x += 24) ctx.lineTo(x, band * (0.12 + i * 0.06) + Math.sin(x * .006 + t * .6 + i) * 12);
          ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.fill();
        }
        ctx.restore();
        // 봉우리
        [['#3a5b78', .98, .5, 1.1], ['#5d7d97', 1.0, .34, 3.4], ['#8aa7bd', 1.02, .2, 5.9]].forEach(([col, base, amp, seed]) => {
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.moveTo(0, band);
          for (let i = 0; i <= 9; i++) {
            const x = (i / 9) * W;
            const y = band * base - (Math.abs(Math.sin(i * 2.31 + seed)) * .62 + Math.abs(Math.sin(i * .77 + seed * 2)) * .38) * band * amp;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, band); ctx.closePath(); ctx.fill();
        });
        break;
      }
      case 'forest': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const x = W * (0.14 + i * 0.24);
          const g = ctx.createLinearGradient(x, 0, x + 50, band);
          g.addColorStop(0, 'rgba(220,255,180,.16)'); g.addColorStop(1, 'rgba(220,255,180,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x - 14, 0); ctx.lineTo(x + 22, 0); ctx.lineTo(x + 80, band); ctx.lineTo(x + 26, band); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        [['#0e2a19', 1, 8], ['#173c22', .96, 11], ['#21552c', .9, 7]].forEach(([col, sc, n]) => {
          ctx.fillStyle = col;
          for (let i = 0; i < n; i++) {
            const seed = i * 137.5;
            const x = ((seed % 100) / 100) * W;
            const top = band * sc - band * (0.3 + ((seed * 7) % 40) / 120);
            const w = 20 + (seed % 17);
            const sway = Math.sin(t * .6 + i) * 1.6;
            for (let k = 0; k < 3; k++) {
              const y = top + k * band * 0.12;
              ctx.beginPath();
              ctx.moveTo(x + sway * (k + .4), y - band * 0.16);
              ctx.lineTo(x + w * (1 - k * .2), y);
              ctx.lineTo(x - w * (1 - k * .2), y);
              ctx.closePath(); ctx.fill();
            }
          }
        });
        break;
      }
      case 'volcano': {
        ctx.fillStyle = '#2b1010';
        ctx.beginPath(); ctx.moveTo(0, band); ctx.lineTo(0, band * .86);
        ctx.lineTo(W * .30, band * .86); ctx.lineTo(W * .46, band * .12); ctx.lineTo(W * .56, band * .18);
        ctx.lineTo(W * .74, band * .86); ctx.lineTo(W, band * .86); ctx.lineTo(W, band); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(W * .5, band * .2, 0, W * .5, band * .3, W * .3);
        g.addColorStop(0, `rgba(255,180,60,${.7 + Math.sin(t * 2) * .1})`); g.addColorStop(.4, 'rgba(255,90,20,.3)'); g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * .5, band * .24, W * .3, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'city': {
        for (const s of this.stars) {
          ctx.fillStyle = `rgba(255,255,255,${.3 + .5 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))})`;
          ctx.beginPath(); ctx.arc(s.x * W, s.y * band, s.r, 0, TAU); ctx.fill();
        }
        const mx = W * .84, my = band * .3;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, band * .5);
        mg.addColorStop(0, 'rgba(255,250,220,.9)'); mg.addColorStop(.25, 'rgba(255,245,200,.35)'); mg.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, band * .5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(mx, my, band * .12, 0, TAU); ctx.fill();
        const layers = [[{ c: '#0d1430', n: 14, h: .62, w: .16 }], [{ c: '#141c40', n: 11, h: .9, w: .26 }], [{ c: '#1c2650', n: 8, h: 1.05, w: .36 }]];
        layers.forEach(([L], li) => {
          for (let i = 0; i < L.n; i++) {
            const bw = (W / L.n) * (0.62 + ((i * 37) % 30) / 100);
            const x = (i / L.n) * W + 4;
            const bh = band * L.h * (0.5 + ((i * 53) % 50) / 100);
            ctx.fillStyle = L.c;
            ctx.fillRect(x, band - bh, bw, bh);
            for (let wy = band - bh + 5; wy < band - 3; wy += 7) {
              for (let wx = x + 3; wx < x + bw - 3; wx += 6) {
                const on = ((wx * 13 + wy * 7 + li * 5) % 11) / 11 < L.w + 0.12 * Math.sin(t * .4 + wx);
                if (on) {
                  ctx.fillStyle = (wx * wy) % 3 === 0 ? 'rgba(120,200,255,.8)' : 'rgba(255,214,140,.85)';
                  ctx.fillRect(wx, wy, 2, 3);
                }
              }
            }
          }
        });
        break;
      }
      case 'space': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const cx = W * (0.16 + i * 0.23) + Math.sin(t * .2 + i) * 12;
          const cy = band * (0.4 + (i % 2) * .35);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * .16);
          g.addColorStop(0, `rgba(${100 + i * 40},${70 + i * 20},255,.18)`); g.addColorStop(1, 'rgba(60,0,120,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, W * .16, 0, TAU); ctx.fill();
        }
        ctx.restore();
        for (const s of this.stars) {
          ctx.fillStyle = `rgba(255,255,255,${.35 + .55 * (0.5 + 0.5 * Math.sin(t * s.s + s.p))})`;
          ctx.beginPath(); ctx.arc(s.x * W, s.y * band, s.r, 0, TAU); ctx.fill();
        }
        const px = W * .82, py = band * .42, pr = Math.min(W, H) * .06;
        const pg = ctx.createRadialGradient(px - pr * .4, py - pr * .4, pr * .1, px, py, pr);
        pg.addColorStop(0, '#b48cff'); pg.addColorStop(.5, '#6b3fd6'); pg.addColorStop(1, '#1e0b46');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(px, py); ctx.rotate(-.3); ctx.scale(1, .24);
        ctx.strokeStyle = 'rgba(220,200,255,.5)'; ctx.lineWidth = pr * .12;
        ctx.beginPath(); ctx.arc(0, 0, pr * 1.6, 0, TAU); ctx.stroke(); ctx.restore();
        break;
      }
      case 'temple': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(W * .5, band * .1, 0, W * .5, band, W * .5);
        g.addColorStop(0, 'rgba(220,210,255,.3)'); g.addColorStop(1, 'rgba(160,140,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, band); ctx.restore();
        for (const px of [0.06, 0.94, 0.22, 0.78]) {
          const x = W * px;
          const cg = ctx.createLinearGradient(x - 16, 0, x + 16, 0);
          cg.addColorStop(0, '#3a3352'); cg.addColorStop(.45, '#6a5f8c'); cg.addColorStop(1, '#2a2438');
          ctx.fillStyle = cg;
          ctx.fillRect(x - 13, band * .18, 26, band * .82);
          ctx.fillStyle = '#7a6e9c'; ctx.fillRect(x - 17, band * .13, 34, 7);
        }
        ctx.strokeStyle = 'rgba(170,150,230,.45)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(W / 2, band * .95, W * .3, Math.PI * 1.06, Math.PI * 1.94); ctx.stroke();
        break;
      }
      case 'cave': {
        ctx.fillStyle = '#060c18';
        ctx.beginPath(); ctx.moveTo(0, band * .95);
        for (let x = 0; x <= W; x += 30) ctx.lineTo(x, band * (.2 + Math.abs(Math.sin(x * .011)) * .34) + (x % 3) * 6);
        ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [cx, col] of [[.14, 'rgba(90,220,255,'], [.42, 'rgba(140,120,255,'], [.7, 'rgba(90,220,255,'], [.9, 'rgba(255,125,215,']]) {
          const x = W * cx, y = band * .55;
          const pulse = .35 + .2 * Math.sin(t * 1.5 + cx * 10);
          const g = ctx.createRadialGradient(x, y, 0, x, y, band * .7);
          g.addColorStop(0, col + pulse + ')'); g.addColorStop(1, col + '0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, band * .7, 0, TAU); ctx.fill();
        }
        ctx.restore();
        // 종유석
        ctx.fillStyle = '#0b1526';
        for (let i = 0; i < 9; i++) {
          const x = W * (0.04 + i * 0.115), w = 10 + (i % 3) * 5, h = band * (0.12 + (i % 4) * 0.06);
          ctx.beginPath(); ctx.moveTo(x - w, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x, h); ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'desert': {
        const sx = W * .5, sy = band * .3;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, band * .8);
        g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(.22, 'rgba(255,232,150,.7)'); g.addColorStop(1, 'rgba(255,200,100,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, band * .8, 0, TAU); ctx.fill();
        [[.9, '#dcae74'], [.98, '#cf9d5f'], [1.04, '#c08f52']].forEach(([base, col], k) => {
          ctx.fillStyle = col
          ctx.beginPath(); ctx.moveTo(0, band);
          for (let x = 0; x <= W; x += 18) {
            const y = band * base - Math.sin(x * .005 + k * 1.7 + t * .12) * band * .12 - Math.sin(x * .013 + k) * 3;
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, band); ctx.closePath(); ctx.fill();
        });
        this.cloudsDraw(ctx, W, H, 'rgba(255,245,225,.5)', .7);
        break;
      }
    }
  }

  cloudsDraw(ctx, W, H, color, scale = 1) {
    const band = H * FIELD.top;
    ctx.save();
    for (const c of this.clouds) {
      c.x += c.v * 16;
      if (c.x > 1.2) c.x = -.2;
      const x = c.x * W, y = band * c.y * 2.4;
      const s = c.s * scale * (W / 900) * 2.2;
      ctx.globalAlpha = .5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, 46 * s, 13 * s, 0, 0, TAU);
      ctx.ellipse(x - 30 * s, y + 4 * s, 28 * s, 9 * s, 0, 0, TAU);
      ctx.ellipse(x + 32 * s, y + 3 * s, 32 * s, 10 * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- 아레나 바닥 ---------------- */
  floor(ctx, t, W, H) {
    const cfg = this.cfg;
    ctx.save();
    this.floorPath(ctx, W, H);
    ctx.clip();
    const g = ctx.createLinearGradient(0, H * FIELD.top, 0, H);
    g.addColorStop(0, cfg.floor[0]); g.addColorStop(.55, cfg.floor[1]); g.addColorStop(1, cfg.floor[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, H * FIELD.top, W, H);

    // 원근 바닥 텍스처
    const N = 14;
    for (let k = 0; k < N; k++) {
      const f0 = k / N, f1 = (k + 1) / N;
      const a0 = project(0, f0, W, H), b0 = project(1, f0, W, H);
      const a1 = project(0, f1, W, H), b1 = project(1, f1, W, H);
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.lineTo(a1.x, a1.y); ctx.closePath();
      const kind = cfg.tex;
      if (kind === 'grass') ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.045)' : 'rgba(0,0,0,.05)';
      else if (kind === 'sand' || kind === 'dune') ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.06)' : 'rgba(180,120,60,.05)';
      else if (kind === 'ice') ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.14)' : 'rgba(60,110,150,.12)';
      else if (kind === 'lava') ctx.fillStyle = k % 2 ? 'rgba(255,110,30,.06)' : 'rgba(0,0,0,.22)';
      else if (kind === 'tile' || kind === 'hex' || kind === 'marble') ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.14)';
      else if (kind === 'moss') ctx.fillStyle = k % 2 ? 'rgba(180,255,140,.05)' : 'rgba(0,0,0,.14)';
      else ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.12)';
      ctx.fill();

      // 가로 이음선
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(b0.x, b0.y); ctx.stroke();
    }

    // 세로 원근 격자
    ctx.strokeStyle = cfg.lines;
    ctx.globalAlpha = .16;
    for (let i = 1; i < 10; i++) {
      const p0 = project(i / 10, 0, W, H), p1 = project(i / 10, 1, W, H);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 스테이지별 바닥 디테일
    this.floorDetail(ctx, t, W, H);
    ctx.restore();
  }

  floorDetail(ctx, t, W, H) {
    const tex = this.cfg.tex;
    if (tex === 'grass') {
      // 잔디 결
      for (let i = 0; i < 120; i++) {
        const fx = ((i * 137) % 1000) / 1000, fy = ((i * 71) % 1000) / 1000;
        const p = project(fx, fy, W, H);
        ctx.strokeStyle = `rgba(${180 + (i % 40)},${240 - (i % 30)},${170 + (i % 40)},.16)`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.sin(t + i) * 1.2, p.y - 3 * p.s); ctx.stroke();
      }
    } else if (tex === 'sand' || tex === 'dune') {
      for (let i = 0; i < 26; i++) {
        const fy = ((i * 97) % 1000) / 1000;
        const p = project(0, fy, W, H), q = project(1, fy, W, H);
        ctx.strokeStyle = `rgba(255,245,215,${.10 + .06 * Math.sin(t * .6 + i)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const fx = k / 12;
          const pp = project(fx, fy, W, H);
          const y = pp.y + Math.sin(fx * 9 + i + t * .5) * 2.4 * pp.s;
          k ? ctx.lineTo(pp.x, y) : ctx.moveTo(pp.x, y);
        }
        ctx.stroke();
      }
    } else if (tex === 'ice') {
      for (let i = 0; i < 9; i++) {
        const fx = .1 + ((i * 37) % 80) / 100, fy = .1 + ((i * 53) % 80) / 100;
        const p = project(fx, fy, W, H);
        ctx.strokeStyle = `rgba(255,255,255,${.18 + .1 * Math.sin(t + i)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = (i + k) * 1.7;
          const r = 10 + k * 7;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(a) * r * p.s, p.y + Math.sin(a) * r * .5 * p.s);
        }
        ctx.stroke();
      }
    } else if (tex === 'lava') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const fy = .16 + i * .17;
        const p0 = project(.05, fy, W, H), p1 = project(.95, fy + .05, W, H);
        ctx.strokeStyle = `rgba(255,${100 + i * 20},40,${.18 + .08 * Math.sin(t * 1.6 + i)})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(W * .5, p0.y + 14, p1.x, p1.y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (tex === 'cave') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const fx = .15 + ((i * 41) % 70) / 100, fy = .2 + ((i * 59) % 70) / 100;
        const p = project(fx, fy, W, H);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 42 * p.s);
        const col = i % 2 ? '90,220,255' : '150,120,255';
        g.addColorStop(0, `rgba(${col},${.22 + .1 * Math.sin(t * 1.6 + i)})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 42 * p.s, 0, TAU); ctx.fill();
      }
      ctx.restore();
    } else if (tex === 'hex') {
      ctx.strokeStyle = 'rgba(170,140,255,.16)'; ctx.lineWidth = 1;
      const R = W * .045;
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 9; col++) {
          const fx = (col + (row % 2) * .5) / 9, fy = .1 + row * .16;
          const p = project(fx, fy, W, H);
          const r = R * p.s;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = k * Math.PI / 3;
            const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * .5;
            k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.closePath(); ctx.stroke();
        }
      }
    } else if (tex === 'marble') {
      for (let i = 0; i < 8; i++) {
        const fy = .12 + i * .11;
        const p0 = project(0, fy, W, H), p1 = project(1, fy, W, H);
        ctx.strokeStyle = 'rgba(230,215,255,.08)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    } else if (tex === 'tile') {
      ctx.strokeStyle = 'rgba(150,190,255,.12)'; ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const fy = .1 + i * .14;
        const p0 = project(0, fy, W, H), p1 = project(1, fy, W, H);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      for (let i = 0; i < 9; i++) {
        const p0 = project(i / 9, 0, W, H), p1 = project(i / 9, 1, W, H);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
    } else if (tex === 'stone' || tex === 'moss') {
      for (let i = 0; i < 22; i++) {
        const fx = ((i * 173) % 980) / 1000 + .01, fy = ((i * 113) % 980) / 1000 + .01;
        const p = project(fx, fy, W, H);
        ctx.fillStyle = tex === 'moss' ? 'rgba(150,230,120,.10)' : 'rgba(0,0,0,.14)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, (6 + (i % 7) * 2) * p.s, (3 + (i % 4)) * p.s, 0, 0, TAU); ctx.fill();
      }
    }

    // 바닥을 가로지르는 빛 번짐 (이동감)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sweep = (t * .06) % 1.6 - .3;
    const sp = project(sweep, .55, W, H);
    const lg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, W * .3);
    lg.addColorStop(0, `${this.cfg.accent}22`.replace('22', '1f')); lg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, H * FIELD.top, W, H);
    ctx.restore();
  }

  /* ---------------- 경계선 · 진영 ---------------- */
  markings(ctx, t, W, H) {
    const cfg = this.cfg;
    // 팀 진영 (좌: 내 팀 / 우: 상대 팀)
    ctx.save();
    this.floorPath(ctx, W, H);
    ctx.clip();
    const c = project(.5, 0, W, H), c2 = project(.5, 1, W, H);
    let g = ctx.createLinearGradient(0, 0, W * .5, 0);
    g.addColorStop(0, 'rgba(77,141,255,.13)'); g.addColorStop(1, 'rgba(77,141,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, H * FIELD.top, W * .5, H);
    g = ctx.createLinearGradient(W, 0, W * .5, 0);
    g.addColorStop(0, 'rgba(240,75,90,.12)'); g.addColorStop(1, 'rgba(240,75,90,0)');
    ctx.fillStyle = g; ctx.fillRect(W * .5, H * FIELD.top, W * .5, H);

    // 중앙선
    ctx.strokeStyle = 'rgba(255,255,255,.28)';
    ctx.setLineDash([9, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
    ctx.setLineDash([]);

    // 센터 서클
    const mid = project(.5, .58, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.30)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(mid.x, mid.y, W * .115, H * .085, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(mid.x, mid.y, W * .045, H * .033, 0, 0, TAU); ctx.stroke();
    // 중앙 로고
    ctx.save();
    ctx.globalAlpha = .35;
    ctx.translate(mid.x, mid.y);
    ctx.scale(1, .72);
    const R = W * .034;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(-R, -R * .12, R * 2, R * .24);
    ctx.beginPath(); ctx.arc(0, 0, R * .3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#0b1020'; ctx.lineWidth = R * .12;
    ctx.beginPath(); ctx.arc(0, 0, R * .98, 0, TAU); ctx.stroke();
    ctx.restore();

    // 진영 시작 지점
    const za = project(.22, .58, W, H), zb = project(.78, .58, W, H);
    for (const [p, color] of [[za, 'rgba(77,141,255,.3)'], [zb, 'rgba(240,75,90,.3)']]) {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, W * .075, H * .05, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // 경계선 (글로우)
    ctx.save();
    ctx.shadowColor = cfg.accent; ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 3;
    this.floorPath(ctx, W, H); ctx.stroke();
    ctx.strokeStyle = `${cfg.accent}66`;
    ctx.lineWidth = 6;
    this.floorPath(ctx, W, H); ctx.stroke();
    ctx.restore();
  }

  /* ---------------- 장식물 ---------------- */
  drawProp(ctx, prop, t, W, H) {
    const p = project(prop.fx, prop.fy, W, H);
    const s = (prop.s || 1) * p.s * Math.min(1.35, Math.max(.6, W / 950));
    ctx.save();
    ctx.translate(p.x, p.y);
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(0, 0, 16 * s, 6 * s, 0, 0, TAU); ctx.fill();
    switch (prop.k) {
      case 'flag': {
        ctx.strokeStyle = '#c8d6ef'; ctx.lineWidth = 2.4 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -46 * s); ctx.stroke();
        ctx.fillStyle = prop.fx < .5 ? '#4d8dff' : '#f04b5a';
        ctx.beginPath();
        ctx.moveTo(0, -46 * s);
        ctx.lineTo(20 * s + Math.sin(t * 3) * 3 * s, -40 * s);
        ctx.lineTo(0, -32 * s);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'barrier': {
        ctx.fillStyle = 'rgba(210,225,255,.5)';
        ctx.fillRect(-26 * s * (prop.w || 1), -12 * s, 52 * s * (prop.w || 1), 4 * s);
        ctx.fillStyle = 'rgba(160,180,220,.35)';
        for (let k = -1; k <= 1; k++) ctx.fillRect(k * 20 * s - 1.5 * s, -12 * s, 3 * s, 12 * s);
        break;
      }
      case 'palm': {
        ctx.strokeStyle = '#7d5a35'; ctx.lineWidth = 5 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(4 * s, -26 * s, 2 * s, -42 * s); ctx.stroke();
        ctx.fillStyle = '#2f8a52';
        for (let k = 0; k < 5; k++) {
          const a = -Math.PI / 2 + (k - 2) * .5;
          ctx.beginPath();
          ctx.ellipse(2 * s + Math.cos(a) * 14 * s, -42 * s + Math.sin(a) * 9 * s, 16 * s, 4.5 * s, a * .5, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'umbrella': {
        ctx.strokeStyle = '#e8eefc'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26 * s); ctx.stroke();
        ctx.fillStyle = '#ff6f8a';
        ctx.beginPath(); ctx.arc(0, -26 * s, 18 * s, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath(); ctx.arc(0, -26 * s, 18 * s, Math.PI * 1.25, Math.PI * 1.55); ctx.lineTo(0, -26 * s); ctx.fill();
        break;
      }
      case 'ball': {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.arc(0, -5 * s, 5 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'tree': {
        ctx.fillStyle = '#3a2a1c';
        ctx.fillRect(-3 * s, -16 * s, 6 * s, 16 * s);
        ctx.fillStyle = '#21552c';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.ellipse(0, -20 * s - k * 8 * s, (17 - k * 4) * s, (9 - k * 2) * s, 0, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'pine': {
        ctx.fillStyle = '#2b2118';
        ctx.fillRect(-2.5 * s, -10 * s, 5 * s, 10 * s);
        ctx.fillStyle = '#1e4a34';
        for (let k = 0; k < 3; k++) {
          const y = -8 * s - k * 10 * s;
          ctx.beginPath(); ctx.moveTo(0, y - 22 * s); ctx.lineTo((13 - k * 3) * s, y); ctx.lineTo(-(13 - k * 3) * s, y); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(240,250,255,.75)';
        ctx.beginPath(); ctx.moveTo(0, -52 * s); ctx.lineTo(6 * s, -42 * s); ctx.lineTo(-6 * s, -42 * s); ctx.closePath(); ctx.fill();
        break;
      }
      case 'boulder':
      case 'rock': {
        const g = ctx.createLinearGradient(-12 * s, -18 * s, 12 * s, 4 * s);
        g.addColorStop(0, '#9b7a5e'); g.addColorStop(1, '#4a3527');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-14 * s, 0); ctx.lineTo(-9 * s, -16 * s); ctx.lineTo(3 * s, -21 * s);
        ctx.lineTo(14 * s, -9 * s); ctx.lineTo(10 * s, 0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'rockpillar': {
        const g = ctx.createLinearGradient(-10 * s, 0, 12 * s, 0);
        g.addColorStop(0, '#5a3f36'); g.addColorStop(.6, '#7a5747'); g.addColorStop(1, '#3d2a25');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-12 * s, 0); ctx.lineTo(-8 * s, -54 * s); ctx.lineTo(6 * s, -60 * s); ctx.lineTo(13 * s, 0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'obsidian': {
        ctx.fillStyle = '#241a26';
        ctx.beginPath();
        ctx.moveTo(-11 * s, 0); ctx.lineTo(-4 * s, -22 * s); ctx.lineTo(4 * s, -28 * s); ctx.lineTo(12 * s, -6 * s); ctx.lineTo(9 * s, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,50,.5)'; ctx.lineWidth = 1.2 * s;
        ctx.beginPath(); ctx.moveTo(-2 * s, -6 * s); ctx.lineTo(3 * s, -20 * s); ctx.stroke();
        break;
      }
      case 'lavavent': {
        ctx.fillStyle = '#2a1512';
        ctx.beginPath(); ctx.ellipse(0, 0, 15 * s, 6 * s, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, -4 * s, 0, 0, -4 * s, 22 * s);
        g.addColorStop(0, `rgba(255,190,90,${.7 + .2 * Math.sin(t * 3)})`); g.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -4 * s, 22 * s, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'crystal': {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, -18 * s, 0, 0, -18 * s, 34 * s);
        g.addColorStop(0, 'rgba(120,220,255,.32)'); g.addColorStop(1, 'rgba(80,120,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -18 * s, 34 * s, 0, TAU); ctx.fill();
        ctx.restore();
        const cols = ['#63d8ff', '#8f7bff', '#63ffd0'];
        for (let k = 0; k < 3; k++) {
          const w = (5 + k * 2) * s, h = (18 + k * 8) * s;
          ctx.fillStyle = cols[k % 3];
          ctx.globalAlpha = .75;
          ctx.beginPath();
          ctx.moveTo((-8 + k * 8) * s, 0); ctx.lineTo((-8 + k * 8) * s + w * .4, -h); ctx.lineTo((-8 + k * 8) * s - w * .4, -h * .9);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'iceblock': {
        ctx.fillStyle = 'rgba(210,240,255,.8)';
        ctx.beginPath();
        ctx.moveTo(-12 * s, 0); ctx.lineTo(-6 * s, -18 * s); ctx.lineTo(8 * s, -20 * s); ctx.lineTo(13 * s, -2 * s); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2 * s; ctx.stroke();
        break;
      }
      case 'pillar': {
        const g = ctx.createLinearGradient(-10 * s, 0, 12 * s, 0);
        g.addColorStop(0, '#3a3352'); g.addColorStop(.45, '#6a5f8c'); g.addColorStop(1, '#2a2438');
        ctx.fillStyle = g;
        ctx.fillRect(-8 * s, -50 * s, 16 * s, 50 * s);
        ctx.fillStyle = '#7a6e9c';
        ctx.fillRect(-11 * s, -55 * s, 22 * s, 6 * s);
        ctx.fillRect(-11 * s, -4 * s, 22 * s, 4 * s);
        break;
      }
      case 'statue': {
        ctx.fillStyle = '#5c5478';
        ctx.fillRect(-9 * s, -6 * s, 18 * s, 6 * s);
        ctx.fillStyle = '#6f6690';
        ctx.beginPath(); ctx.ellipse(0, -18 * s, 7 * s, 12 * s, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -32 * s, 5 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'brazier': {
        ctx.fillStyle = '#3a3352';
        ctx.fillRect(-2 * s, -18 * s, 4 * s, 18 * s);
        ctx.beginPath(); ctx.ellipse(0, -18 * s, 9 * s, 4 * s, 0, 0, TAU); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, -24 * s, 0, 0, -24 * s, 20 * s);
        g.addColorStop(0, `rgba(255,220,150,${.8 + .2 * Math.sin(t * 6)})`); g.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -24 * s, 20 * s, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'mushroom': {
        ctx.fillStyle = '#f0e6d2';
        ctx.fillRect(-1.5 * s, -8 * s, 3 * s, 8 * s);
        ctx.fillStyle = '#e0698a';
        ctx.beginPath(); ctx.arc(0, -9 * s, 7 * s, Math.PI, 0); ctx.fill();
        break;
      }
      case 'log': {
        ctx.fillStyle = '#4a3626';
        ctx.beginPath(); ctx.ellipse(0, -5 * s, 15 * s, 5 * s, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2a1c';
        ctx.fillRect(-15 * s, -8 * s, 30 * s, 4 * s);
        break;
      }
      case 'cactus': {
        ctx.fillStyle = '#4e6b3a';
        ctx.fillRect(-4 * s, -30 * s, 8 * s, 30 * s);
        ctx.fillRect(-14 * s, -22 * s, 5 * s, 14 * s);
        ctx.fillRect(-14 * s, -22 * s, 14 * s, 5 * s);
        ctx.fillRect(9 * s, -26 * s, 5 * s, 16 * s);
        ctx.fillRect(0, -26 * s, 14 * s, 5 * s);
        break;
      }
      case 'ruin': {
        ctx.fillStyle = '#cbb387';
        ctx.fillRect(-16 * s, -30 * s, 6 * s, 30 * s);
        ctx.fillRect(4 * s, -20 * s, 12 * s, 20 * s);
        ctx.fillRect(-16 * s, -34 * s, 20 * s, 5 * s);
        break;
      }
      case 'pump': {
        ctx.fillStyle = '#2f3a55';
        ctx.fillRect(-12 * s, -14 * s, 24 * s, 14 * s);
        ctx.fillStyle = '#465579';
        ctx.fillRect(-9 * s, -17 * s, 18 * s, 4 * s);
        ctx.strokeStyle = '#8fa8d8'; ctx.lineWidth = 1.4 * s;
        ctx.beginPath(); ctx.arc(0, -10 * s, 5 * s, 0, TAU); ctx.stroke();
        break;
      }
      case 'antenna': {
        ctx.strokeStyle = '#8fa8d8'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -48 * s); ctx.stroke();
        ctx.fillStyle = `rgba(255,90,90,${.6 + .4 * Math.sin(t * 3)})`;
        ctx.beginPath(); ctx.arc(0, -50 * s, 3 * s, 0, TAU); ctx.fill();
        break;
      }
      case 'sign': {
        ctx.fillStyle = 'rgba(20,26,48,.9)';
        ctx.fillRect(-16 * s, -34 * s, 32 * s, 14 * s);
        ctx.strokeStyle = '#ff6fd8'; ctx.lineWidth = 1.6 * s;
        ctx.strokeRect(-16 * s, -34 * s, 32 * s, 14 * s);
        ctx.fillStyle = '#ffb3ef';
        ctx.fillRect(-11 * s, -29 * s, 18 * s, 3 * s);
        ctx.fillStyle = '#2f3a55';
        ctx.fillRect(-2 * s, -20 * s, 4 * s, 20 * s);
        break;
      }
      case 'crate': {
        ctx.fillStyle = '#5a4630';
        ctx.fillRect(-11 * s, -20 * s, 22 * s, 20 * s);
        ctx.strokeStyle = '#7a6244'; ctx.lineWidth = 1.6 * s;
        ctx.beginPath(); ctx.moveTo(-11 * s, -20 * s); ctx.lineTo(11 * s, 0); ctx.moveTo(11 * s, -20 * s); ctx.lineTo(-11 * s, 0); ctx.stroke();
        break;
      }
      case 'satellite': {
        ctx.fillStyle = '#39406b';
        ctx.fillRect(-5 * s, -22 * s, 10 * s, 16 * s);
        ctx.fillStyle = '#5a6ad8';
        ctx.fillRect(-22 * s, -20 * s, 15 * s, 8 * s);
        ctx.fillRect(7 * s, -20 * s, 15 * s, 8 * s);
        break;
      }
      default: break;
    }
    ctx.restore();
  }

  /* ---------------- 앰비언트 ---------------- */
  ambient(ctx, t, dt, W, H) {
    const kind = this.cfg.ambient;
    if (kind === 'none') return;
    const max = this.lite ? 14 : 40;
    if (this.parts.length < max && Math.random() < .5) {
      this.parts.push({
        x: rnd(1), y: kind === 'ember' ? rnd(1, .4) : rnd(1), s: rnd(2.2, .7), p: rnd(TAU),
        v: rnd(1.4, .3), k: kind
      });
    }
    ctx.save();
    if (kind === 'ember' || kind === 'star' || kind === 'firefly' || kind === 'sparkle') ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (kind === 'ember') {
        p.y -= p.v * dt * 0.00012 * 60; if (p.y < 0) p.y = 1;
        p.x += Math.sin(t + p.p) * 0.0004;
        const a = .5 + .5 * Math.sin(t * 3 + p.p);
        ctx.fillStyle = `rgba(255,${140 + a * 60},40,${a * .85})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s, 0, TAU); ctx.fill();
      } else if (kind === 'firefly') {
        p.x += Math.sin(t * .4 + p.p) * 0.0006; p.y += Math.cos(t * .5 + p.p) * 0.0004;
        const a = .35 + .45 * Math.sin(t * 2 + p.p);
        const x = p.x * W, y = p.y * H;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 12 * p.s);
        g.addColorStop(0, `rgba(220,255,150,${a})`); g.addColorStop(1, 'rgba(160,255,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12 * p.s, 0, TAU); ctx.fill();
      } else if (kind === 'bubble') {
        p.y -= p.v * dt * 0.0002 * 60; if (p.y < 0) { p.y = 1; p.x = rnd(1); }
        ctx.strokeStyle = `rgba(255,255,255,${.25 + .2 * Math.sin(t + p.p)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H * .5 + H * .2, p.s * 1.4, 0, TAU); ctx.stroke();
      } else if (kind === 'star') {
        const a = .3 + .5 * Math.sin(t * 1.6 + p.p);
        ctx.fillStyle = `rgba(220,220,255,${a})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s * .9, 0, TAU); ctx.fill();
      } else if (kind === 'sparkle') {
        const a = .25 + .5 * Math.abs(Math.sin(t * 1.2 + p.p));
        ctx.fillStyle = `rgba(210,230,255,${a})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s * .8, 0, TAU); ctx.fill();
      } else if (kind === 'dust') {
        p.x += p.v * dt * 0.00003; if (p.x > 1) p.x = 0;
        ctx.fillStyle = `rgba(255,235,200,${.08 + .05 * Math.sin(t + p.p)})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s, 0, TAU); ctx.fill();
      } else if (kind === 'snow') {
        p.y += p.v * dt * 0.00006; p.x += Math.sin(t + p.p) * 0.0004;
        if (p.y > 1) { p.y = 0; p.x = rnd(1); }
        ctx.fillStyle = `rgba(255,255,255,${.3 + .3 * Math.sin(t + p.p)})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.s * .8, 0, TAU); ctx.fill();
      } else if (kind === 'neon') {
        const a = .12 + .1 * Math.sin(t * 2 + p.p);
        ctx.fillStyle = p.p % 2 > 1 ? `rgba(120,200,255,${a})` : `rgba(255,90,190,${a})`;
        ctx.fillRect(p.x * W, p.y * H, p.s * 3, p.s * 8);
      }
    }
    ctx.restore();
  }

  /* ---------------- 날씨 ---------------- */
  weatherLayer(ctx, t, dt, W, H) {
    const w = this.weather;
    if (w === 'clear') return;
    if (w === 'sun') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(W * .5, -H * .1, 0, W * .5, H * .3, W * .8);
      g.addColorStop(0, `rgba(255,230,140,${.22 + Math.sin(t) * .02})`); g.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    const count = this.lite ? 40 : 110;
    if (this.wparts.length !== count) {
      this.wparts = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), s: rnd(1.4, .4), v: rnd(1, .35), p: rnd(TAU) }));
    }
    ctx.save();
    if (w === 'rain') {
      ctx.strokeStyle = 'rgba(175,215,255,.45)';
      for (const p of this.wparts) {
        p.y += p.v * 0.05 * (dt / 16); p.x += p.v * 0.008;
        if (p.y > 1.05) { p.y = -.05; p.x = Math.random(); }
        if (p.x > 1.05) p.x = 0;
        ctx.lineWidth = 1 + p.s * .7;
        ctx.beginPath(); ctx.moveTo(p.x * W, p.y * H); ctx.lineTo(p.x * W - 5 * p.s, p.y * H + 18 * p.s); ctx.stroke();
      }
    } else if (w === 'sand') {
      ctx.fillStyle = 'rgba(230,190,130,.10)'; ctx.fillRect(0, 0, W, H);
      for (const p of this.wparts) {
        p.x += p.v * .022 * (dt / 16) * (1 + p.s);
        if (p.x > 1.05) { p.x = -.05; p.y = Math.random(); }
        ctx.fillStyle = `rgba(245,215,155,${.2 + p.s * .28})`;
        ctx.beginPath(); ctx.ellipse(p.x * W, p.y * H, 1.6 + p.s * 2, 1 + p.s, .5, 0, TAU); ctx.fill();
      }
    } else if (w === 'hail') {
      ctx.fillStyle = 'rgba(200,230,255,.05)'; ctx.fillRect(0, 0, W, H);
      for (const p of this.wparts) {
        p.y += p.v * .03 * (dt / 16); p.x += Math.sin(t + p.p) * .0008;
        if (p.y > 1.05) { p.y = -.05; p.x = Math.random(); }
        ctx.fillStyle = `rgba(255,255,255,${.3 + p.s * .4})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, 1.4 + p.s * 2, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }

  vignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W * .5, H * .58, Math.min(W, H) * .34, W * .5, H * .6, Math.max(W, H) * .82);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(3,6,18,.34)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}
