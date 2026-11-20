/* ============================================================================
   아레나 기술 기믹 렌더러
   - 타입/형태별 실제 기믹: 나뭇잎 폴리곤 · 물줄기 스트림 · 전기 아크 감전
     · 화염 입자 · 얼음 결정 · 독방울 · 섀도 잔상 · 염력 파동 · 바위 파편
   - 모든 좌표는 화면(px) 좌표. 입자는 battle-ui의 parts 배열에 쌓인다.
   ========================================================================== */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const lerp = (a, b, t) => a + (b - a) * t;

export function hexA(hex, a) {
  if (!hex || hex[0] !== '#') return `rgba(255,255,255,${a})`;
  let h = hex.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* 타입 → 기믹 --------------------------------------------------------- */
const GIMMICK = {
  '풀': 'leaf', '벌레': 'leaf',
  '물': 'water',
  '전기': 'spark',
  '불꽃': 'flame',
  '얼음': 'frost',
  '독': 'poison',
  '고스트': 'shadow', '악': 'shadow',
  '에스퍼': 'psychic', '페어리': 'psychic',
  '땅': 'earth', '바위': 'earth', '강철': 'earth',
  '드래곤': 'dragon', '비행': 'wind',
  '격투': 'impact', '노말': 'impact'
};
export const gimmickOf = (type) => GIMMICK[type] || 'impact';

export function shapeOf(spec = {}) {
  const s = spec.shape;
  if (s === 'leaf' || s === 'water' || s === 'flame' || s === 'ice' || s === 'rock'
    || s === 'shadow' || s === 'star' || s === 'shuriken' || s === 'petal'
    || s === 'bone' || s === 'seed') return s;
  const g = gimmickOf(spec.type);
  return g === 'leaf' ? 'leaf' : g === 'water' ? 'water' : g === 'flame' ? 'flame'
    : g === 'frost' ? 'ice' : g === 'shadow' ? 'shadow' : g === 'earth' ? 'rock'
      : g === 'spark' ? 'spark' : g === 'psychic' ? 'psychic' : 'orb';
}

/* 기본 도형 --------------------------------------------------------- */
function leafPath(ctx, len, wid) {
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.quadraticCurveTo(-len * .15, -wid, len * .78, -wid * .12);
  ctx.quadraticCurveTo(len * 1.06, 0, len * .78, wid * .12);
  ctx.quadraticCurveTo(-len * .15, wid, -len, 0);
  ctx.closePath();
}

function dropPath(ctx, len, wid) {
  ctx.beginPath();
  ctx.moveTo(len * 1.15, 0);
  ctx.quadraticCurveTo(len * .2, -wid, -len * .75, -wid * .22);
  ctx.quadraticCurveTo(-len * 1.1, 0, -len * .75, wid * .22);
  ctx.quadraticCurveTo(len * .2, wid, len * 1.15, 0);
  ctx.closePath();
}

function shardPath(ctx, len, wid) {
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(len * .15, -wid);
  ctx.lineTo(-len * .55, -wid * .35);
  ctx.lineTo(-len * .9, 0);
  ctx.lineTo(-len * .5, wid * .55);
  ctx.lineTo(len * .2, wid * .9);
  ctx.closePath();
}

function starPath(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * TAU;
    const rr = i % 2 ? r * .44 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function polyPath(ctx, pts, r, jitter = .25) {
  ctx.beginPath();
  const seed = pts.__seed || (pts.__seed = Array.from({ length: 9 }, () => rnd(1, 1 - jitter)));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const rr = r * seed[i];
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr * .86;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/* ============================================================================
   입자 생성
   ========================================================================== */
function push(parts, p) {
  if (parts.length > 900) parts.shift();
  parts.push(p);
}
const base = (x, y, vx, vy, life, size, color, type, extra) => ({
  x, y, vx, vy, life, max: life, size, color, type,
  rot: rnd(TAU), vr: rnd(9, -9), grav: 1, drag: .96, ...extra
});

export function emitLeaves(parts, x, y, dir, spread, n, color, second, spd = 190, size = 8) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.25, .45);
    push(parts, base(x + rnd(8, -8), y + rnd(8, -8), Math.cos(a) * sp, Math.sin(a) * sp * .8 - 30,
      rnd(.85, .5), size * rnd(1.25, .6), i % 4 === 0 ? second : color, 'leaf',
      { grav: .34, drag: .975, vr: rnd(11, -11), wind: rnd(30, -30) }));
  }
}

export function emitWater(parts, x, y, dir, spread, n, color, second, spd = 230, size = 4) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.3, .4);
    push(parts, base(x + rnd(6, -6), y + rnd(6, -6), Math.cos(a) * sp, Math.sin(a) * sp * .8 - rnd(60, 20),
      rnd(.7, .34), size * rnd(1.4, .6), i % 5 === 0 ? second : color, 'drop', { grav: 1.5, drag: .985 }));
  }
  if (n > 3) {
    for (let i = 0; i < Math.max(2, n >> 2); i++) {
      push(parts, base(x + rnd(16, -16), y + rnd(10, -10), rnd(60, -60), rnd(-30, -90),
        rnd(.8, .45), size * rnd(2.2, 1.1), second, 'bubble', { grav: -.25, drag: .98 }));
    }
  }
}

export function emitSpark(parts, x, y, dir, spread, n, color, second, spd = 320, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.4, .5);
    push(parts, base(x + rnd(10, -10), y + rnd(10, -10), Math.cos(a) * sp, Math.sin(a) * sp * .8 - 20,
      rnd(.45, .2), size * rnd(1.5, .7), i % 3 === 0 ? second : color, 'spark',
      { grav: .2, drag: .93, len: rnd(9, 4) }));
  }
}

export function emitEmber(parts, x, y, dir, spread, n, color, second, spd = 150, size = 4) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.3, .4);
    push(parts, base(x + rnd(9, -9), y + rnd(9, -9), Math.cos(a) * sp, Math.sin(a) * sp * .7 - rnd(70, 30),
      rnd(.85, .35), size * rnd(1.4, .5), i % 4 === 0 ? second : color, 'ember',
      { grav: -.5, drag: .96, wob: rnd(30, -30) }));
  }
}

export function emitFrost(parts, x, y, dir, spread, n, color, second, spd = 200, size = 5) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.25, .35);
    push(parts, base(x + rnd(9, -9), y + rnd(9, -9), Math.cos(a) * sp, Math.sin(a) * sp * .8 - rnd(40, 10),
      rnd(1.1, .55), size * rnd(1.6, .7), i % 4 === 0 ? second : color, 'shard',
      { grav: .3, drag: .975, vr: rnd(5, -5) }));
  }
  for (let i = 0; i < Math.max(1, n >> 2); i++) {
    push(parts, base(x + rnd(18, -18), y + rnd(14, -14), rnd(30, -30), rnd(-5, -30),
      rnd(1.1, .6), size * rnd(4.5, 2.6), second, 'mist', { grav: -.04, drag: .97 }));
  }
}

export function emitDust(parts, x, y, dir, spread, n, color, second, spd = 210, size = 5) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.2, .3);
    push(parts, base(x + rnd(10, -10), y + rnd(8, -8), Math.cos(a) * sp, Math.sin(a) * sp * .7 - rnd(90, 20),
      rnd(.8, .4), size * rnd(1.6, .7), i % 4 === 0 ? second : color, 'rock',
      { grav: 1.25, drag: .97, vr: rnd(7, -7) }));
  }
}

export function emitPoison(parts, x, y, dir, spread, n, color, second, spd = 130, size = 5) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.2, .3);
    push(parts, base(x + rnd(12, -12), y + rnd(10, -10), Math.cos(a) * sp, Math.sin(a) * sp * .6 - rnd(60, 15),
      rnd(.95, .45), size * rnd(1.5, .6), i % 3 === 0 ? second : color, 'bubble',
      { grav: -.4, drag: .975, wob: rnd(24, -24) }));
  }
}

export function emitWisp(parts, x, y, dir, spread, n, color, second, spd = 120, size = 6) {
  for (let i = 0; i < n; i++) {
    const a = dir + rnd(spread, -spread);
    const sp = spd * rnd(1.1, .3);
    push(parts, base(x + rnd(12, -12), y + rnd(12, -12), Math.cos(a) * sp, Math.sin(a) * sp * .7 - rnd(50, 10),
      rnd(1, .5), size * rnd(1.6, .7), i % 3 === 0 ? second : color, 'wisp',
      { grav: -.25, drag: .965, wob: rnd(26, -26) }));
  }
}

export function emitRing(parts, x, y, color, size = 30, life = .45, type = 'ring') {
  push(parts, base(x, y, 0, 0, life, size, color, type, { grav: 0, drag: 1 }));
}

/* 타입별 피격 파편 ----------------------------------------------------- */
export function impactBurst(parts, x, y, type, color, strong = false, scale = 1) {
  const g = gimmickOf(type);
  const n = Math.round((strong ? 18 : 11) * scale);
  const spd = strong ? 300 : 210;
  switch (g) {
    case 'leaf': emitLeaves(parts, x, y, 0, Math.PI, n, color, '#eaffdf', spd, 8 * scale); break;
    case 'water': emitWater(parts, x, y, 0, Math.PI, n, color, '#ffffff', spd, 5 * scale); break;
    case 'spark': emitSpark(parts, x, y, 0, Math.PI, n, color, '#ffffff', spd, 4 * scale); break;
    case 'flame': emitEmber(parts, x, y, 0, Math.PI, n, color, '#ffe9a8', spd, 5 * scale); break;
    case 'frost': emitFrost(parts, x, y, 0, Math.PI, n, color, '#ffffff', spd, 6 * scale); break;
    case 'poison': emitPoison(parts, x, y, 0, Math.PI, n, color, '#e6ffcf', spd * .8, 6 * scale); break;
    case 'shadow': emitWisp(parts, x, y, 0, Math.PI, n, color, '#e2d8ff', spd * .9, 8 * scale); break;
    case 'psychic': {
      emitWisp(parts, x, y, 0, Math.PI, Math.round(n * .6), color, '#ffe3f2', spd * .8, 6 * scale);
      emitRing(parts, x, y, color, 26 * scale, .4);
      break;
    }
    case 'earth': emitDust(parts, x, y, 0, Math.PI, n, color, '#f0e6dc', spd, 7 * scale); break;
    default: emitSpark(parts, x, y, 0, Math.PI, Math.round(n * .6), color, '#ffffff', spd * .9, 4 * scale);
  }
  emitRing(parts, x, y, color, (strong ? 34 : 22) * scale, strong ? .5 : .38);
}

/* ============================================================================
   시전 중 매 프레임 파티클 방출 (물줄기·화염 분사 등)
   ========================================================================== */
export function emitCastParticles(parts, fx, k, cam) {
  const u = cam.unit;
  const a = cam.project(fx.x, fx.y, cam.W, cam.H);
  const b = fx.tx !== undefined ? cam.project(fx.tx, fx.ty, cam.W, cam.H) : a;
  const ax = a.x, ay = a.y - u * .34 * a.s;
  const by = b.y - u * .3 * b.s;
  const col = fx.color || '#fff';
  const sec = fx.second || '#ffffff';
  const shape = shapeOf({ shape: fx.shape, type: fx.type });
  const dir = Math.atan2(by - ay, b.x - ax);
  const size = (u / 120) * (fx.big ? 1.35 : 1);

  switch (fx.fx) {
    case 'stream': {
      if (shape === 'water') {
        const mx = lerp(ax, b.x, rnd(.85, .25)), my = lerp(ay, by, rnd(.85, .25));
        emitWater(parts, mx, my, dir, .5, 3, col, sec, 210, 3.4 * size);
      } else if (shape === 'flame') {
        const mx = lerp(ax, b.x, rnd(.95, .18)), my = lerp(ay, by, rnd(.95, .18));
        emitEmber(parts, mx, my, dir, .55, 3, col, '#ffe9a8', 175, 3.6 * size);
      } else {
        emitSpark(parts, lerp(ax, b.x, rnd(1, .2)), lerp(ay, by, rnd(1, .2)), dir, .5, 2, col, sec, 160, 2.6 * size);
      }
      break;
    }
    case 'beam': {
      if (shape === 'ice') {
        emitFrost(parts, lerp(ax, b.x, rnd(1, .1)), lerp(ay, by, rnd(1, .1)), dir + Math.PI, .9, 2, col, sec, 150, 3.6 * size);
      } else {
        emitSpark(parts, lerp(ax, b.x, rnd(1, .1)), lerp(ay, by, rnd(1, .1)), dir, .35, 2, col, sec, 130, 2.4 * size);
      }
      break;
    }
    case 'bolt': {
      if (k > .25) emitSpark(parts, b.x + rnd(24, -24), by + rnd(30, -10), -Math.PI / 2, Math.PI, 2, col, sec, 260, 3 * size);
      break;
    }
    case 'burst': {
      if (shape === 'flame' && k < .55) emitEmber(parts, b.x + rnd(20, -20), by + rnd(10, -14), -Math.PI / 2, Math.PI, 2, col, '#ffe9a8', 170, 3.4 * size);
      else if (shape === 'shadow' && k < .5) emitWisp(parts, b.x + rnd(18, -18), by + rnd(10, -12), -Math.PI / 2, Math.PI, 1, col, sec, 110, 4 * size);
      break;
    }
    case 'pillar': {
      if (k < .6) {
        const py = lerp(by, by - cam.H * .3, rnd(1));
        emitSpark(parts, b.x + rnd(12, -12), py, -Math.PI / 2, .8, 1, col, sec, 100, 2.2 * size);
      }
      break;
    }
    case 'cage': {
      if (k < .5 && Math.random() < .5) emitSpark(parts, b.x + rnd(u * .3, -u * .3), by - rnd(u * .3), 0, Math.PI, 1, col, sec, 150, 2.4 * size);
      break;
    }
    case 'wave': {
      if (shape === 'water' && k < .7) emitWater(parts, b.x + rnd(26, -26), by + rnd(6, -6), -Math.PI / 2, 1.2, 1, col, sec, 150, 3 * size);
      break;
    }
    case 'drain': {
      const t2 = rnd(1);
      emitSpark(parts, lerp(b.x, ax, t2), lerp(by, ay, t2), Math.atan2(ay - by, ax - b.x), .3, 1, col, sec, 130, 2.4 * size);
      break;
    }
    default: break;
  }
}

/* ============================================================================
   투사체 렌더 (기술 형태별)
   ========================================================================== */
export function drawProjectile(ctx, p, cam) {
  const sc = cam.project(p.x, p.y, cam.W, cam.H);
  const u = cam.unit, s = sc.s;
  const spec = p.spec || {};
  const shape = shapeOf({ shape: spec.shape, type: p.move && p.move.t });
  const col = spec.color || '#ffffff';
  const sec = spec.second || '#ffffff';
  const ang = p._px === undefined ? 0 : Math.atan2(sc.y - p._py, sc.x - p._px);
  if (!p._tr) p._tr = [];
  p._tr.push({ x: sc.x, y: sc.y, rot: ang });
  if (p._tr.length > 9) p._tr.shift();
  p._px = sc.x; p._py = sc.y;
  const base = clamp(u * .096 * s, 3.6, 15) * (spec.big ? 1.5 : 1);
  const t = (cam.t || 0) + (p._ph || (p._ph = rnd(TAU)));

  ctx.save();
  // 잔상/꼬리
  const tn = p._tr.length;
  for (let i = 0; i < tn - 1; i++) {
    const q = p._tr[i], a = (i / tn) * .5;
    const sz = base * (.35 + .5 * (i / tn));
    drawShape(ctx, shape, q.x, q.y, q.rot, sz, hexA(col, a), hexA(sec, a * .8), t + i, true);
  }
  drawShape(ctx, shape, sc.x, sc.y - base * .35, ang, base, col, sec, t, false);
  ctx.restore();
}

function drawShape(ctx, shape, x, y, ang, r, col, sec, t, ghost) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const alphaBase = ghost ? .6 : 1;
  switch (shape) {
    case 'leaf': {
      ctx.rotate(Math.sin(t * 4) * .5);
      ctx.fillStyle = ghost ? col : sec;
      ctx.strokeStyle = ghost ? col : 'rgba(28,80,20,.85)';
      ctx.lineWidth = ghost ? 0 : Math.max(.8, r * .07);
      leafPath(ctx, r, r * .52);
      if (!ghost) {
        const g = ctx.createLinearGradient(-r, 0, r, 0);
        g.addColorStop(0, col); g.addColorStop(.55, sec); g.addColorStop(1, col);
        ctx.fillStyle = g;
      }
      ctx.globalAlpha = alphaBase;
      ctx.fill();
      if (!ghost) {
        ctx.stroke();
        // 잎맥
        ctx.strokeStyle = 'rgba(20,70,15,.5)';
        ctx.lineWidth = Math.max(.7, r * .05);
        ctx.beginPath(); ctx.moveTo(-r * .9, 0); ctx.lineTo(r * .95, 0); ctx.stroke();
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(i * r * .3, 0); ctx.lineTo(i * r * .3 + r * .16, -r * .28);
          ctx.moveTo(i * r * .3, 0); ctx.lineTo(i * r * .3 + r * .16, r * .28);
        }
        ctx.stroke();
      }
      break;
    }
    case 'water': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
      g.addColorStop(0, ghost ? col : 'rgba(255,255,255,.95)');
      g.addColorStop(.4, col);
      g.addColorStop(1, hexA(col, 0));
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = hexA(col, .92);
      dropPath(ctx, r, r * .75);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.ellipse(r * .1, -r * .22, r * .34, r * .16, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'flame': {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(.28, sec);
      g.addColorStop(.6, hexA(col, .8));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const fl = 1 + Math.sin(t * 22 + i * 2) * .16;
        ctx.fillStyle = hexA(i === 0 ? '#ffffff' : i === 1 ? sec : col, .8 - i * .18);
        dropPath(ctx, r * (1.1 - i * .22) * fl, r * (.55 - i * .1));
        ctx.fill();
      }
      break;
    }
    case 'ice': {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.9);
      g.addColorStop(0, 'rgba(255,255,255,.75)');
      g.addColorStop(.45, hexA(col, .55));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = hexA(col, .95);
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = Math.max(.8, r * .08);
      shardPath(ctx, r * 1.15, r * .55);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      shardPath(ctx, r * .6, r * .26);
      ctx.fill();
      break;
    }
    case 'spark': {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.3, sec);
      g.addColorStop(.65, hexA(col, .75)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, r * .22); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a0 = t * 9 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        let px = 0, py = 0;
        for (let k = 1; k <= 3; k++) {
          px = Math.cos(a0) * r * .55 * k + rnd(3, -3);
          py = Math.sin(a0) * r * .55 * k + rnd(3, -3);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }
    case 'shadow': {
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.1);
      g.addColorStop(0, '#0b0616'); g.addColorStop(.45, hexA(col, .85));
      g.addColorStop(.72, hexA('#7a5fd8', .4)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(sec, .75); ctx.lineWidth = Math.max(1, r * .12);
      for (let i = 0; i < 2; i++) {
        const a0 = t * 6 + i * Math.PI;
        ctx.beginPath();
        ctx.arc(0, 0, r * (1.1 + i * .5), a0, a0 + 2.2);
        ctx.stroke();
      }
      break;
    }
    case 'psychic': {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.4, hexA(col, .7)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexA(sec, .8); ctx.lineWidth = Math.max(1, r * .1);
      for (let i = 0; i < 3; i++) {
        const a0 = t * 3 + i * 2.1;
        ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + i * .32), r * (.5 + i * .16), a0, 0, TAU); ctx.stroke();
      }
      break;
    }
    case 'rock': {
      ctx.fillStyle = hexA(col, .95);
      ctx.strokeStyle = 'rgba(40,30,22,.7)'; ctx.lineWidth = Math.max(.8, r * .1);
      polyPath(ctx, {}, r * (ghost ? 1 : .95));
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      polyPath(ctx, {}, r * .5);
      ctx.fill();
      break;
    }
    case 'seed': {
      ctx.fillStyle = hexA('#7a9c3a', .95);
      ctx.strokeStyle = hexA(sec, .8); ctx.lineWidth = Math.max(.8, r * .12);
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * .72, t * .8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = hexA(col, .8);
      ctx.beginPath(); ctx.ellipse(-r * .15, -r * .1, r * .45, r * .3, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'star': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.rotate(t * 3);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.6);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.5, hexA(col, .8)); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.fill();
      ctx.fillStyle = sec; starPath(ctx, r); ctx.fill();
      break;
    }
    case 'shuriken': {
      ctx.rotate(t * 14);
      ctx.fillStyle = hexA(col, .95);
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.rotate(i * Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 1.15, -r * .22); ctx.lineTo(r * .5, r * .3); ctx.closePath();
        ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = sec; ctx.beginPath(); ctx.arc(0, 0, r * .22, 0, TAU); ctx.fill();
      break;
    }
    case 'petal': {
      ctx.rotate(t * 3.5);
      ctx.globalAlpha = alphaBase;
      ctx.fillStyle = hexA(col, .92);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.bezierCurveTo(r * .5, -r * .95, -r * .75, -r * .7, -r, 0);
      ctx.bezierCurveTo(-r * .75, r * .7, r * .5, r * .95, r, 0);
      ctx.fill();
      ctx.fillStyle = hexA(sec, .55);
      ctx.beginPath(); ctx.ellipse(r * .05, 0, r * .42, r * .28, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'bone': {
      ctx.rotate(t * 6);
      ctx.fillStyle = hexA('#e8e0d0', .96);
      ctx.fillRect(-r, -r * .16, r * 2, r * .32);
      for (const sx of [-1, 1]) {
        ctx.beginPath(); ctx.arc(sx * r, -r * .24, r * .28, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(sx * r, r * .24, r * .28, 0, TAU); ctx.fill();
      }
      break;
    }
    default: {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.1);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.34, col); g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

/* ============================================================================
   시전 연출 (빔·스트림·낙뢰·폭발·장판 등)
   ========================================================================== */
export function drawCast(ctx, fx, k, cam) {
  const u = cam.unit;
  const a = cam.project(fx.x, fx.y, cam.W, cam.H);
  const b = fx.tx !== undefined ? cam.project(fx.tx, fx.ty, cam.W, cam.H) : a;
  const ax = a.x, ay = a.y - u * .34 * a.s;
  const by = b.y - u * .3 * b.s;
  const col = fx.color || '#ffffff';
  const sec = fx.second || '#ffffff';
  const shape = shapeOf({ shape: fx.shape, type: fx.type });
  const t = cam.t || 0;
  const big = !!fx.big;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (fx.fx) {
    case 'stream':
      if (shape === 'water') waterStream(ctx, ax, ay, b.x, by, k, cam, col, sec, big, fx.whiff);
      else if (shape === 'flame') fireStream(ctx, ax, ay, b.x, by, k, cam, col, sec, big, t);
      else energyStream(ctx, ax, ay, b.x, by, k, cam, col, sec, big, t);
      break;
    case 'beam':
      beamCast(ctx, ax, ay, b.x, by, k, cam, col, sec, shape, big, fx.whiff, t);
      break;
    case 'bolt':
      boltCast(ctx, b.x, by, k, cam, col, sec, big, fx.whiff);
      break;
    case 'wave':
      waveCast(ctx, b.x, by, k, cam, col, sec, shape, big, t);
      break;
    case 'burst':
      burstCast(ctx, b.x, by, k, cam, col, sec, shape, big, t);
      break;
    case 'pillar':
      pillarCast(ctx, b.x, by, k, cam, col, sec, big, shape);
      break;
    case 'shadow':
      shadowCast(ctx, b.x, by, k, cam, col, sec, big, t);
      break;
    case 'cage':
      cageCast(ctx, b.x, by, k, cam, col, sec, t);
      break;
    case 'drain':
      drainCast(ctx, ax, ay, b.x, by, k, cam, col, sec);
      break;
    case 'bite':
      biteCast(ctx, b.x, by, k, cam, col);
      break;
    case 'slash':
    case 'rush':
      meleeCast(ctx, a, b, k, cam, col, sec, fx.kind, shape, big, t);
      break;
    case 'ring': {
      const r = (u * .16 + k * u * .5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(col, (1 - k) * .8);
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(a.x, a.y, r, r * .45, 0, 0, TAU); ctx.stroke();
      break;
    }
    case 'zonehit': {
      const r = cam.W * (fx.r || .2) * .92;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 1.2);
      g.addColorStop(0, hexA('#ffffff', (1 - k) * .5));
      g.addColorStop(.5, hexA(col, (1 - k) * .3));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(b.x, b.y, r * (1 + k * .3), r * .5, 0, 0, TAU); ctx.fill();
      break;
    }
    default: break;
  }
  ctx.restore();
}

/* --- 물: 연속 물줄기 + 거품 + 착탄 물보라 ------------------------------- */
function waterStream(ctx, ax, ay, bx, by, k, cam, col, sec, big, whiff) {
  const u = cam.unit;
  const t = cam.t || 0;
  const grow = clamp(k * 1.9, 0, 1);
  const tx = whiff ? bx + (bx - ax) * .3 : bx;
  const ty = whiff ? by - u * .06 : by;
  const dx = tx - ax, dy = ty - ay;
  const len = Math.hypot(dx, dy) || 1;
  const dir = Math.atan2(dy, dx);
  const nx = -Math.sin(dir), ny = Math.cos(dir);
  const end = 1 - Math.pow(1 - grow, 2.6);
  const baseW = u * (.045 + (big ? .024 : 0));
  ctx.globalCompositeOperation = 'lighter';
  // 물기둥: 물방울 덩어리가 이어져 흐르는 제트
  const N = Math.max(12, Math.round(len * end / 13));
  for (let i = 0; i < N; i++) {
    const p = i / (N - 1);
    const ph = p * 9 + t * 15;
    const turb = Math.sin(ph) * baseW * 1.15 * p + Math.sin(ph * 2.1 + 1.3) * baseW * .5 * p;
    const px = ax + dx * end * p + nx * turb;
    const py = ay + dy * end * p + ny * turb * .55 + Math.sin(ph * 1.4) * baseW * .3;
    const w = baseW * (0.55 + p * 1.9) * (1 + Math.sin(ph * 1.7) * .13);
    // 바깥 물안개
    ctx.fillStyle = hexA(col, .13);
    ctx.beginPath(); ctx.ellipse(px, py, w * 2.2, w * 1.45, dir, 0, TAU); ctx.fill();
    // 물 몸통
    ctx.fillStyle = hexA(col, .3);
    ctx.beginPath(); ctx.ellipse(px, py, w * 1.45, w * 1.0, dir, 0, TAU); ctx.fill();
    // 흰 거품 결 (얇게)
    ctx.fillStyle = hexA(sec, .12);
    ctx.beginPath(); ctx.ellipse(px - nx * w * .25, py - ny * w * .25, w * .62, w * .3, dir, 0, TAU); ctx.fill();
  }
  // 물살 하이라이트 (앞으로 흘러가는 밝은 물덩어리)
  for (let i = 0; i < 7; i++) {
    const p = ((i / 7) + t * 2.6) % 1;
    if (p > end) continue;
    const qx = ax + dx * end * p + nx * Math.sin(p * 11 + t * 13) * baseW * .9 * p;
    const qy = ay + dy * end * p + ny * Math.sin(p * 11 + t * 13) * baseW * .5 * p;
    const w = baseW * (0.5 + p * 1.4);
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.beginPath(); ctx.ellipse(qx, qy, w * .55, w * .24, dir, 0, TAU); ctx.fill();
    ctx.fillStyle = hexA(sec, .45);
    ctx.beginPath(); ctx.arc(qx + nx * w * 1.1, qy + ny * w * .6, w * .2, 0, TAU); ctx.fill();
  }
  // 발사구 물이 뿜어져 나오는 섬광
  const g0 = ctx.createRadialGradient(ax, ay, 0, ax, ay, baseW * 4);
  g0.addColorStop(0, hexA('#ffffff', .45));
  g0.addColorStop(.4, hexA(sec, .3));
  g0.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g0;
  ctx.beginPath(); ctx.arc(ax, ay, baseW * 4, 0, TAU); ctx.fill();

  // 착탄 물보라
  if (!whiff && end > .45) {
    const sp = clamp((end - .45) / .55, 0, 1);
    for (let i = 0; i < 3; i++) {
      const rr = baseW * (1.9 + i * 1.15) * (0.5 + sp * 1.2);
      ctx.strokeStyle = hexA(sec, .45 * (1 - sp * .5));
      ctx.lineWidth = baseW * .32;
      ctx.beginPath();
      ctx.ellipse(bx, by, rr, rr * .52, 0, Math.PI * 1.03, Math.PI * 1.97);
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a0 = -Math.PI * .12 - rnd(Math.PI * .76);
      const rr = baseW * (1.1 + rnd(1.8)) * (.6 + sp * .9);
      ctx.fillStyle = hexA(i % 2 ? '#ffffff' : sec, .42 * (1 - sp * .45));
      ctx.beginPath();
      ctx.arc(bx + Math.cos(a0) * rr, by + Math.sin(a0) * rr * .55, baseW * .3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = hexA(sec, .26 * (1 - sp));
    ctx.beginPath(); ctx.ellipse(bx, by, baseW * 2.6, baseW * .9, 0, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 불꽃: 다층 일렁이는 화염 분사 ------------------------------------ */
function fireStream(ctx, ax, ay, bx, by, k, cam, col, sec, big, t) {
  const u = cam.unit;
  const grow = clamp(k * 2.2, 0, 1);
  const end = 1 - Math.pow(1 - grow, 2.2);
  const dx = (bx - ax) * end, dy = (by - ay) * end;
  const dir = Math.atan2(by - ay, bx - ax);
  const len = Math.hypot(dx, dy) || 1;
  const nx = -Math.sin(dir), ny = Math.cos(dir);
  const baseW = u * (.042 + (big ? .024 : 0));
  ctx.globalCompositeOperation = 'lighter';

  // 화염 덩어리가 이어지며 부풀어 오르는 플룸
  const N = Math.max(10, Math.round(len / 15));
  for (let i = 0; i < N; i++) {
    const p = i / (N - 1);
    const ph = p * 8 + t * 16;
    const turb = Math.sin(ph) * baseW * 1.5 * p + Math.sin(ph * 1.9 + .7) * baseW * .7 * p;
    const bob = Math.sin(ph * 1.3) * baseW * .8 * p;
    const px = ax + dx * p + nx * turb;
    const py = ay + dy * p + ny * turb * .5 - bob;
    const w = baseW * (0.7 + p * 2.6) * (1 + Math.sin(ph * 1.6) * .15);
    // 바깥 열기
    ctx.fillStyle = hexA(col, .13);
    ctx.beginPath(); ctx.ellipse(px, py, w * 2.3, w * 1.5, dir, 0, TAU); ctx.fill();
    ctx.fillStyle = hexA(col, .22);
    ctx.beginPath(); ctx.ellipse(px, py, w * 1.35, w * .9, dir, 0, TAU); ctx.fill();
    // 불꽃 몸통
    ctx.fillStyle = hexA(sec, .26);
    ctx.beginPath(); ctx.ellipse(px, py, w * .8, w * .52, dir, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,214,.3)';
    ctx.beginPath(); ctx.ellipse(px, py, w * .38, w * .24, dir, 0, TAU); ctx.fill();
  }
  // 타오르는 혀 (불꽃 모양)
  for (let i = 0; i < 5; i++) {
    const p = ((i / 5) + (t * 1.1) % .2) % 1;
    if (p > end) continue;
    const px = ax + dx * p + nx * Math.sin(p * 6 + t * 9) * baseW * 1.2 * p;
    const py = ay + dy * p + ny * Math.sin(p * 6 + t * 9) * baseW * .6 * p;
    const w = baseW * (0.8 + p * 2) * (1 + Math.sin(t * 20 + i * 2) * .22);
    ctx.save();
    ctx.translate(px, py - w * .2);
    ctx.rotate(dir + Math.sin(t * 12 + i) * .18);
    ctx.fillStyle = hexA(col, .18);
    dropPath(ctx, w * 1.7, w * .95); ctx.fill();
    ctx.fillStyle = hexA(sec, .28);
    dropPath(ctx, w * .95, w * .5); ctx.fill();
    ctx.fillStyle = 'rgba(255,252,230,.34)';
    dropPath(ctx, w * .48, w * .24); ctx.fill();
    ctx.restore();
  }
  // 발사구 섬광
  const g0 = ctx.createRadialGradient(ax, ay, 0, ax, ay, baseW * 4.2);
  g0.addColorStop(0, hexA('#ffffff', .5)); g0.addColorStop(.4, hexA(sec, .35)); g0.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g0;
  ctx.beginPath(); ctx.arc(ax, ay, baseW * 4.2, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 기타 스트림 (전기·드래곤 등) -------------------------------------- */
function energyStream(ctx, ax, ay, bx, by, k, cam, col, sec, big, t) {
  const u = cam.unit;
  const end = clamp(k * 2, 0, 1);
  const dx = (bx - ax) * end, dy = (by - ay) * end;
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createLinearGradient(ax, ay, ax + dx, ay + dy);
  grad.addColorStop(0, hexA(col, .2)); grad.addColorStop(.7, hexA(col, .5)); grad.addColorStop(1, hexA(sec, .8));
  ctx.strokeStyle = grad;
  ctx.lineWidth = u * (.09 + (big ? .04 : 0));
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + dx, ay + dy); ctx.stroke();
  ctx.strokeStyle = hexA(sec, .85);
  ctx.lineWidth = u * .035;
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const p = (i / 5 + (t * .9) % .2) % 1;
    const qx = ax + dx * p, qy = ay + dy * p + Math.sin(p * 12 + t * 10) * u * .02;
    ctx.fillStyle = hexA(sec, .5);
    ctx.beginPath(); ctx.arc(qx, qy, u * .012 * (1 + p), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 빔 (얼음 결정 / 에너지) ------------------------------------------ */
function beamCast(ctx, ax, ay, bx, by, k, cam, col, sec, shape, big, whiff, t) {
  const u = cam.unit;
  const end = clamp(k * 2.6, 0, 1);
  const tx = whiff ? bx + (bx - ax) * .26 : bx;
  const ty = whiff ? by - u * .12 : by;
  const ex = ax + (tx - ax) * end, ey = ay + (ty - ay) * end;
  const w = u * ((big ? .085 : .05) * (1 - k * .25));
  const dx = ex - ax, dy = ey - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  // 살짝 흔들리는 빔 경로
  const path = () => {
    ctx.beginPath();
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const p = i / steps;
      const wob = Math.sin(p * 7 + t * 14) * w * .22 * p;
      const px = ax + dx * p + nx * wob, py = ay + dy * p + ny * wob;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
  };
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(ax, ay, ex, ey);
  g.addColorStop(0, hexA(col, .26)); g.addColorStop(.5, hexA(col, .6)); g.addColorStop(1, hexA(col, .72));
  ctx.strokeStyle = g; ctx.lineWidth = w * 2.9; path(); ctx.stroke();
  ctx.strokeStyle = hexA(col, .78); ctx.lineWidth = w * 1.15; path(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = w * .3; path(); ctx.stroke();
  // 발사 섬광
  const g0 = ctx.createRadialGradient(ax, ay, 0, ax, ay, w * 2.6);
  g0.addColorStop(0, hexA('#ffffff', .85 * (1 - k))); g0.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g0;
  ctx.beginPath(); ctx.arc(ax, ay, w * 2.6, 0, TAU); ctx.fill();
  // 빔을 따라 흐르는 결정/입자
  const n = shape === 'ice' ? 7 : 5;
  for (let i = 0; i < n; i++) {
    const p = (((i / n) + (t * 1.4) % (1 / n)) % 1) * end;
    const qx = ax + dx * p + nx * Math.sin(p * 9 + t * 8) * w * .9;
    const qy = ay + dy * p + ny * Math.sin(p * 9 + t * 8) * w * .9;
    const rr = w * (shape === 'ice' ? .62 : .28) * (1 - p * .3);
    if (shape === 'ice') {
      ctx.save(); ctx.translate(qx, qy); ctx.rotate(p * 6 + t);
      ctx.fillStyle = hexA('#f4feff', .9);
      shardPath(ctx, rr * 1.9, rr * .9); ctx.fill();
      ctx.strokeStyle = hexA(col, .8); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = hexA(sec, .6);
      ctx.beginPath(); ctx.arc(qx, qy, rr * .5, 0, TAU); ctx.fill();
    }
  }
  if (!whiff && end > .55) {
    const sp = (end - .55) / .45;
    const rr = w * (2.4 + sp * 3.2);
    const gi = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
    gi.addColorStop(0, hexA('#ffffff', .85 * (1 - sp * .55)));
    gi.addColorStop(.4, hexA(col, .5 * (1 - sp * .5)));
    gi.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = gi;
    ctx.beginPath(); ctx.arc(bx, by, rr, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 번개: 하늘에서 갈라지는 낙뢰 + 지지직 ---------------------------- */
function boltCast(ctx, bx, by, k, cam, col, sec, big, whiff) {
  const u = cam.unit, H = cam.H;
  const top = H * .2;
  const x = whiff ? bx + u * .5 : bx;
  const y = whiff ? by + u * .1 : by;
  const fade = 1 - k;
  ctx.globalCompositeOperation = 'lighter';
  // 배경 섬광
  const g = ctx.createRadialGradient(x, y, 0, x, y, u * 1.35);
  g.addColorStop(0, hexA(sec, .5 * fade)); g.addColorStop(.4, hexA(col, .3 * fade)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, u * 1.35, 0, TAU); ctx.fill();
  // 하늘 번쩍임 (화면 폭 전체 세로 그라디언트 — 이음새 없이)
  const skyG = ctx.createLinearGradient(0, top - u * .4, 0, y + u * .3);
  skyG.addColorStop(0, hexA(col, 0));
  skyG.addColorStop(.35, hexA(col, .1 * fade));
  skyG.addColorStop(.75, hexA(col, .14 * fade));
  skyG.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = skyG;
  ctx.fillRect(0, top - u * .4, cam.W, y - top + u * .7);
  const jag = (x0, y0, x1, y1, wob, wid, alpha, branch) => {
    ctx.strokeStyle = hexA(col, alpha);
    ctx.shadowColor = col; ctx.shadowBlur = 26;
    ctx.lineWidth = wid;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    let px = x0, py = y0;
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      const ny = y0 + (y1 - y0) * (i / steps);
      const nx = x1 + (i === steps ? 0 : rnd(wob, -wob) * (1 - i / steps));
      ctx.lineTo(nx, ny);
      px = nx; py = ny;
    }
    ctx.stroke();
    if (branch) {
      ctx.lineWidth = wid * .5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + rnd(wob * 1.4, -wob * 1.4), py + (y1 - y0) * .18);
      ctx.stroke();
    }
    // 코어
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexA('#ffffff', alpha * .95);
    ctx.lineWidth = wid * .32;
    ctx.stroke();
  };
  jag(x - u * .04, top, x, y, 26, (big ? 16 : 11) * (1 - k * .35), fade, true);
  jag(x + u * .1, y - u * .85, x + u * .42, y + u * .04, 17, 5.5 * fade, fade * .85, true);
  jag(x - u * .12, y - u * .7, x - u * .38, y + u * .02, 15, 4.6 * fade, fade * .85, false);
  jag(x + u * .02, y - u * .6, x + u * .16, y - u * .1, 10, 3 * fade, fade * .7, false);
  // 지면 스파크 링
  if (!whiff) {
    const rr = u * (.18 + k * .5);
    ctx.strokeStyle = hexA(sec, (1 - k) * .9);
    ctx.lineWidth = 2.4 * (1 - k) + .6;
    ctx.beginPath(); ctx.ellipse(x, y, rr, rr * .42, 0, 0, TAU); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a0 = rnd(TAU);
      ctx.strokeStyle = hexA(col, (1 - k) * .8);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y);
      let px = x, py = y;
      for (let j = 1; j <= 3; j++) {
        px += Math.cos(a0) * rr * .5 + rnd(6, -6);
        py += Math.sin(a0) * rr * .22 + rnd(3, -3);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 확산파 (물 파도 / 염력 / 충격) ----------------------------------- */
function waveCast(ctx, bx, by, k, cam, col, sec, shape, big, t) {
  const u = cam.unit;
  ctx.globalCompositeOperation = 'lighter';
  const n = 3;
  for (let i = 0; i < n; i++) {
    const kk = clamp(k * 1.1 - i * .12, 0, 1);
    if (kk <= 0) continue;
    const r = u * (.12 + kk * (big ? .72 : .55));
    if (shape === 'water') {
      // 파도 크레스트
      ctx.strokeStyle = hexA(sec, (1 - kk) * .85);
      ctx.lineWidth = u * .035 * (1 - kk) + 1;
      ctx.beginPath();
      ctx.ellipse(bx, by, r, r * .48, 0, Math.PI * .92, Math.PI * 2.08);
      ctx.stroke();
      ctx.strokeStyle = hexA(col, (1 - kk) * .6);
      ctx.lineWidth = u * .06 * (1 - kk);
      ctx.beginPath();
      ctx.ellipse(bx, by, r * .92, r * .42, 0, Math.PI * .98, Math.PI * 2.02);
      ctx.stroke();
    } else {
      ctx.strokeStyle = hexA(col, (1 - kk) * .8);
      ctx.lineWidth = 3 * (1 - kk) + 1;
      ctx.beginPath(); ctx.ellipse(bx, by, r, r * .46, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = hexA(sec, (1 - kk) * .45);
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(bx, by, r * .7, r * .32, 0, 0, TAU); ctx.stroke();
    }
  }
  if (shape === 'psychic') {
    for (let i = 0; i < 3; i++) {
      const a0 = t * 2.4 + i * 2.1;
      ctx.strokeStyle = hexA(sec, (1 - k) * .5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(bx, by - u * .2, u * .3 * (1 - k * .5), u * .12, a0, 0, TAU);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 폭발 ------------------------------------------------------------- */
function burstCast(ctx, bx, by, k, cam, col, sec, shape, big, t) {
  const u = cam.unit;
  ctx.globalCompositeOperation = 'lighter';
  const grow = clamp(k * 3.2, 0, 1);
  const r = u * (.18 + grow * (big ? .95 : .62));
  if (shape === 'flame') {
    for (let i = 0; i < 4; i++) {
      const rr = r * (1 - i * .18) * (1 + Math.sin(t * 14 + i) * .06);
      const g = ctx.createRadialGradient(bx, by - u * .18, 0, bx, by - u * .18, rr);
      g.addColorStop(0, hexA('#ffffff', .5 * (1 - k * .5)));
      g.addColorStop(.35, hexA(i < 2 ? sec : col, .55 * (1 - k * .6)));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by - u * .18, rr, 0, TAU); ctx.fill();
    }
  } else {
    const g = ctx.createRadialGradient(bx, by - u * .16, 0, bx, by - u * .16, r);
    g.addColorStop(0, hexA('#ffffff', .8 * (1 - k)));
    g.addColorStop(.35, hexA(sec, .55 * (1 - k * .7)));
    g.addColorStop(.7, hexA(col, .35 * (1 - k * .8)));
    g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(bx, by - u * .16, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = hexA(sec, (1 - k) * .7);
  ctx.lineWidth = 2.6 * (1 - k) + .8;
  ctx.beginPath(); ctx.ellipse(bx, by, r * 1.1, r * .5, 0, 0, TAU); ctx.stroke();
}

/* --- 광주 ------------------------------------------------------------- */
function pillarCast(ctx, bx, by, k, cam, col, sec, big, shape) {
  const u = cam.unit, H = cam.H;
  const grow = clamp(k * 2.4, 0, 1);
  const top = by - H * .34 * grow;
  const w = u * (big ? .44 : .28) * (1 - k * .25);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(0, top, 0, by);
  g.addColorStop(0, hexA(col, 0));
  g.addColorStop(.45, hexA(col, .22 * (1 - k * .5)));
  g.addColorStop(.85, hexA(col, .5 * (1 - k * .4)));
  g.addColorStop(1, hexA(sec, .25 * (1 - k * .4)));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(bx - w * .35, top);
  ctx.lineTo(bx + w * .35, top);
  ctx.lineTo(bx + w, by);
  ctx.lineTo(bx - w, by);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = hexA(sec, (1 - k) * .55);
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * w * .5;
    ctx.beginPath(); ctx.moveTo(bx + ox * .5, by); ctx.lineTo(bx + ox, top + (by - top) * .25); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  if (shape === 'flame') {
    const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, w * 1.3);
    g2.addColorStop(0, hexA(sec, .4 * (1 - k))); g2.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.ellipse(bx, by, w * 1.3, w * .5, 0, 0, TAU); ctx.fill();
  }
}

/* --- 섀도 보이드 ------------------------------------------------------ */
function shadowCast(ctx, bx, by, k, cam, col, sec, big, t) {
  const u = cam.unit;
  const r = u * (.22 + clamp(k * 1.4, 0, 1) * (big ? .6 : .42));
  ctx.save();
  const g = ctx.createRadialGradient(bx, by - u * .22, 0, bx, by - u * .22, r * 1.2);
  g.addColorStop(0, 'rgba(10,4,20,.9)');
  g.addColorStop(.55, hexA(col, .45 * (1 - k * .4)));
  g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(bx, by - u * .22, r * 1.2, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hexA(sec, .6 * (1 - k));
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 3; i++) {
    const a0 = t * 4 + i * 2.1;
    ctx.beginPath();
    ctx.arc(bx, by - u * .22, r * (.6 + i * .2), a0, a0 + 2.4);
    ctx.stroke();
  }
  ctx.restore();
}

/* --- 전기 감옥 -------------------------------------------------------- */
function cageCast(ctx, bx, by, k, cam, col, sec, t) {
  const u = cam.unit;
  const r = u * .3;
  const fade = (1 - k);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * TAU + t * .6;
    ctx.strokeStyle = hexA(col, fade * .8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(ang) * r, by + Math.sin(ang) * r * .42);
    const mx = bx + Math.cos(ang) * r * 1.04, my = by + Math.sin(ang) * r * .42 - u * .24;
    ctx.quadraticCurveTo(mx + rnd(5, -5), my + rnd(5, -5), mx, my - u * .16);
    ctx.stroke();
  }
  ctx.strokeStyle = hexA(sec, fade * .7);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(bx, by, r, r * .42, 0, 0, TAU); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 흡수 ------------------------------------------------------------- */
function drainCast(ctx, ax, ay, bx, by, k, cam, col, sec) {
  const u = cam.unit;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(ax, ay, bx, by);
  g.addColorStop(0, hexA(col, .5 * (1 - k)));
  g.addColorStop(1, hexA(sec, .18 * (1 - k)));
  ctx.strokeStyle = g;
  ctx.lineWidth = u * .06 * (1 - k) + 1;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const p = ((i / 4) + (cam.t || 0) * 1.6) % 1;
    const qx = lerp(bx, ax, p), qy = lerp(by, ay, p) + Math.sin(p * 8) * 8;
    ctx.fillStyle = hexA(sec, .8 * (1 - k));
    ctx.beginPath(); ctx.arc(qx, qy, u * .02 * (1 - p * .4), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* --- 물기 ------------------------------------------------------------- */
function biteCast(ctx, bx, by, k, cam, col) {
  const u = cam.unit;
  if (k > .45) return;
  const a = 1 - k / .45;
  const sc = u * .22 * (1 + k * .5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = hexA('#ffffff', a * .92);
  ctx.shadowColor = col; ctx.shadowBlur = 18;
  for (const s2 of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(bx - sc, by - u * .3 + s2 * sc * .5);
    ctx.lineTo(bx + sc * .25, by - u * .3 + s2 * sc * .08);
    ctx.lineTo(bx - sc * .15, by - u * .3 + s2 * sc * .95);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* --- 근접 돌진 / 참격 (원소 궤적) ------------------------------------- */
function meleeCast(ctx, a, b, k, cam, col, sec, kind, shape, big, t) {
  const u = cam.unit;
  if (k > .55) return;
  const fade = 1 - k / .55;
  ctx.globalCompositeOperation = 'lighter';
  if (kind === 'bite') return;
  if (kind === 'slash') {
    ctx.strokeStyle = hexA(shape === 'leaf' ? sec : '#ffffff', fade * .9);
    ctx.shadowColor = col; ctx.shadowBlur = 20;
    ctx.lineWidth = (big ? 5 : 3.6) * fade + .6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(b.x, b.y - u * .3, u * (.18 + i * .05), -1.15 + i * .22, 1.15 + i * .22);
      ctx.stroke();
    }
    if (shape === 'leaf') {
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(b.x + rnd(u * .3, -u * .3), b.y - u * .3 + rnd(u * .3, -u * .3));
        ctx.rotate(rnd(TAU));
        ctx.fillStyle = hexA('#5fc24a', fade * .8);
        leafPath(ctx, u * .05, u * .026); ctx.fill();
        ctx.restore();
      }
    }
  } else {
    // 돌진 궤적
    const dir = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.strokeStyle = hexA(col, fade * .75);
    ctx.lineWidth = u * .05 * fade;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - u * .3);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - u * .12, b.x, b.y - u * .3);
    ctx.stroke();
    const tx = b.x - Math.cos(dir) * u * .2, ty = b.y - u * .3 - Math.sin(dir) * u * .2;
    if (shape === 'spark') {
      ctx.strokeStyle = hexA('#ffffff', fade);
      ctx.shadowColor = col; ctx.shadowBlur = 16;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const a0 = dir + rnd(1.4, -1.4);
        ctx.beginPath(); ctx.moveTo(tx, ty);
        let px = tx, py = ty;
        for (let j = 1; j <= 3; j++) {
          px += Math.cos(a0) * u * .09; py += Math.sin(a0) * u * .09 + rnd(5, -5);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    } else if (shape === 'water' || shape === 'ice') {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = hexA(sec, fade * .7);
        const p = rnd(1);
        ctx.beginPath();
        ctx.arc(lerp(a.x, b.x, p) + rnd(14, -14), lerp(a.y, b.y, p) - u * .3 + rnd(14, -14), u * .014, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* ============================================================================
   피격 상태 연출 (몸에 붙는 기믹)
   ========================================================================== */
export function drawHitState(ctx, f, cam, cx, cy, h, dtT, t) {
  const hit = f.hitFx;
  const status = f.status;
  const k = hit ? clamp(hit.t / hit.dur, 0, 1) : 1;
  const fade = hit ? (1 - k) : 0;
  const g = hit ? gimmickOf(hit.type) : null;
  const col = (hit && hit.color) || '#ffffff';
  const sec = (hit && hit.second) || '#ffffff';
  const bx = cx, by = cy - h * .44;
  const rw = h * .34, rh = h * .46;

  ctx.save();
  if (hit && fade > 0) {
    ctx.globalCompositeOperation = 'lighter';
    switch (g) {
      case 'spark': {
        // 감전: 몸 주위 아크가 지지직거리며 튄다
        const jitter = Math.sin(t * 62) * 2.5;
        // 몸 전체가 노랗게 달아오름
        const bg = ctx.createRadialGradient(bx, by, rh * .1, bx, by, rh * 1.35);
        bg.addColorStop(0, hexA(sec, .22 * fade));
        bg.addColorStop(.55, hexA(col, .16 * fade));
        bg.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.ellipse(bx, by, rw * 1.25, rh * 1.2, 0, 0, TAU); ctx.fill();
        ctx.shadowColor = col; ctx.shadowBlur = 18;
        for (let i = 0; i < 10; i++) {
          const a0 = rnd(TAU);
          const x0 = bx + Math.cos(a0) * rw * rnd(1.15, .45) + jitter;
          const y0 = by + Math.sin(a0) * rh * rnd(1.15, .45);
          const a1 = a0 + rnd(2.6, -2.6);
          const x1 = bx + Math.cos(a1) * rw * rnd(1.4, .75);
          const y1 = by + Math.sin(a1) * rh * rnd(1.4, .75);
          const wdt = (4.6 - i * .28) * fade + .7;
          ctx.strokeStyle = hexA(i % 3 === 0 ? sec : col, fade * (.95 - i * .055));
          ctx.lineWidth = wdt;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          const seg = 4;
          for (let s = 1; s <= seg; s++) {
            const p2 = s / seg;
            ctx.lineTo(lerp(x0, x1, p2) + rnd(8, -8) * (1 - p2 * .4), lerp(y0, y1, p2) + rnd(8, -8) * (1 - p2 * .4));
          }
          ctx.stroke();
          // 아크 심
          ctx.strokeStyle = hexA('#ffffff', fade * .75);
          ctx.lineWidth = wdt * .3;
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        // 튀는 전기 구슬
        for (let i = 0; i < 6; i++) {
          const a0 = t * 14 + i * 1.5;
          const rr = rw * (0.85 + (i % 3) * .2);
          ctx.fillStyle = hexA(i % 2 ? '#ffffff' : col, fade * .9);
          ctx.beginPath();
          ctx.arc(bx + Math.cos(a0) * rr, by + Math.sin(a0) * rh * .95, 2.4 * fade + .7, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'flame': {
        // 화상: 몸에 불티가 붙어 타오름
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * TAU + t * 2.2;
          const px = bx + Math.cos(a0) * rw * .85;
          const py = by + Math.sin(a0) * rh * .9;
          const fl = 1 + Math.sin(t * 24 + i * 1.7) * .3;
          const rr = h * .055 * fl * (0.4 + fade * .6);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(Math.sin(a0 + t * 3) * .35);
          ctx.fillStyle = hexA(col, fade * .55);
          dropPath(ctx, rr * 1.7, rr * .8); ctx.fill();
          ctx.fillStyle = hexA(sec, fade * .7);
          dropPath(ctx, rr * .95, rr * .45); ctx.fill();
          ctx.restore();
        }
        // 불티 상승
        for (let i = 0; i < 5; i++) {
          const a0 = t * 3 + i * 2.4;
          ctx.fillStyle = hexA(i % 2 ? '#fff3c4' : sec, fade * .85);
          ctx.beginPath();
          ctx.arc(bx + Math.sin(a0) * rw * .8, by + Math.cos(a0 * 1.4) * rh * .5 - h * .1 * ((t * .8 + i) % 1),
            1.9 * fade + .6, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'frost': {
        // 빙결: 몸에 얼음 결정이 맺히고 파랗게 언다
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const g2 = ctx.createRadialGradient(bx, by, rw * .1, bx, by, rw * 1.15);
        g2.addColorStop(0, hexA('#d8f8ff', .3 * fade));
        g2.addColorStop(1, hexA('#4fa8cc', .08 * fade));
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.ellipse(bx, by, rw * 1.05, rh * 1.02, 0, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * TAU + .4;
          const px = bx + Math.cos(a0) * rw * .92;
          const py = by + Math.sin(a0) * rh * .92;
          const rr = h * .055 * (0.7 + Math.sin(t * 6 + i) * .2) * fade;
          ctx.save();
          ctx.translate(px, py); ctx.rotate(a0 + Math.PI / 2);
          ctx.fillStyle = hexA('#e8fbff', fade * .8);
          shardPath(ctx, rr * 1.3, rr * .6); ctx.fill();
          ctx.restore();
        }
        ctx.strokeStyle = hexA('#dff8ff', fade * .6);
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) {
          const a0 = rnd(TAU);
          ctx.beginPath();
          ctx.moveTo(bx + Math.cos(a0) * rw * .2, by + Math.sin(a0) * rh * .2);
          ctx.lineTo(bx + Math.cos(a0) * rw, by + Math.sin(a0) * rh);
          ctx.stroke();
        }
        break;
      }
      case 'water': {
        // 물세례: 물방울이 몸을 타고 흐름
        for (let i = 0; i < 6; i++) {
          const a0 = (i / 6) * TAU + t;
          const px = bx + Math.cos(a0) * rw * .85;
          const py = by + Math.sin(a0) * rh * .8 + ((t * 1.2 + i * .17) % 1) * rh * .5;
          ctx.fillStyle = hexA(sec, fade * .75);
          ctx.beginPath();
          ctx.ellipse(px, py, h * .012, h * .02, 0, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'leaf': {
        // 잎 조각이 몸에 붙어 흩날림
        for (let i = 0; i < 5; i++) {
          const a0 = t * 4 + i * 1.3;
          ctx.save();
          ctx.translate(bx + Math.cos(a0) * rw, by + Math.sin(a0) * rh * .8);
          ctx.rotate(a0 * 1.4);
          ctx.fillStyle = hexA(i % 2 ? '#8fe06a' : '#d9ffcf', fade * .85);
          leafPath(ctx, h * .045, h * .02); ctx.fill();
          ctx.restore();
        }
        break;
      }
      case 'psychic': {
        for (let i = 0; i < 3; i++) {
          const rr = rw * (1 + i * .3) * (1 + Math.sin(t * 6 + i) * .06);
          ctx.strokeStyle = hexA(i === 0 ? sec : col, fade * (.6 - i * .15));
          ctx.lineWidth = 2 - i * .4;
          ctx.beginPath(); ctx.ellipse(bx, by, rr, rr * .8, t * 1.5 + i, 0, TAU); ctx.stroke();
        }
        break;
      }
      case 'poison': {
        for (let i = 0; i < 5; i++) {
          const a0 = t * 2 + i * 1.9;
          const py = by + rh * .5 - ((t * .6 + i * .2) % 1) * rh;
          ctx.fillStyle = hexA(i % 2 ? sec : col, fade * .7);
          ctx.beginPath();
          ctx.arc(bx + Math.sin(a0) * rw, py, h * .02 * (1 + (py - by) * .002), 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'shadow': {
        for (let i = 0; i < 4; i++) {
          const a0 = t * 3 + i * 1.6;
          const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, rw * 1.2);
          g2.addColorStop(0, hexA(col, fade * .35)); g2.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.ellipse(bx + Math.cos(a0) * rw * .5, by + Math.sin(a0) * rh * .5, rw * .7, rh * .7, 0, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'earth': {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = hexA('#c9b8a8', fade * .5);
        for (let i = 0; i < 5; i++) {
          const a0 = t * 1.6 + i * 1.3;
          ctx.beginPath();
          ctx.arc(bx + Math.cos(a0) * rw, by + rh * .5 + Math.sin(a0 * 2) * 4, h * .022, 0, TAU);
          ctx.fill();
        }
        break;
      }
      default: {
        ctx.strokeStyle = hexA(sec, fade * .55);
        ctx.lineWidth = 2;
        const rr = rw * (1 + k * .6);
        ctx.beginPath(); ctx.ellipse(bx, by, rr, rh * (1 + k * .4), 0, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* 지속 상태이상 오라 ------------------------------------------------ */
  if (status && f.alive) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (status === 'brn') {
      for (let i = 0; i < 3; i++) {
        const a0 = t * 3 + i * 2.1;
        const px = bx + Math.cos(a0) * rw * .7;
        const py = by + rh * .55 + Math.sin(a0 * 2) * 4;
        const fl = 1 + Math.sin(t * 26 + i * 2) * .3;
        const rr = h * .035 * fl;
        const gr = ctx.createRadialGradient(px, py, 0, px, py, rr * 2);
        gr.addColorStop(0, 'rgba(255,255,255,.7)');
        gr.addColorStop(.4, hexA('#ff8a3d', .5));
        gr.addColorStop(1, hexA('#ff3b1f', 0));
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(px, py, rr * 2, 0, TAU); ctx.fill();
      }
    } else if (status === 'par' && Math.random() < .5) {
      const a0 = rnd(TAU);
      ctx.strokeStyle = hexA('#ffe14d', .8);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let px = bx + Math.cos(a0) * rw * .9, py = by + Math.sin(a0) * rh * .9;
      ctx.moveTo(px, py);
      for (let i = 0; i < 3; i++) {
        px += rnd(9, -9); py += rnd(9, -9);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else if (status === 'frz') {
      ctx.fillStyle = hexA('#bfeefb', .28);
      ctx.beginPath(); ctx.ellipse(bx, by, rw, rh, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const a0 = i * 2.1 + t * .5;
        ctx.save();
        ctx.translate(bx + Math.cos(a0) * rw * .8, by + Math.sin(a0) * rh * .7);
        ctx.rotate(a0);
        ctx.fillStyle = hexA('#e8fbff', .5);
        shardPath(ctx, h * .04, h * .018); ctx.fill();
        ctx.restore();
      }
    } else if (status === 'psn') {
      for (let i = 0; i < 3; i++) {
        const py = by - ((t * .4 + i * .33) % 1) * rh * 1.2;
        ctx.fillStyle = hexA('#a75cff', .45);
        ctx.beginPath();
        ctx.arc(bx + Math.sin(t * 2 + i * 2) * rw * .6, py, h * .016, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

/* ============================================================================
   장판(지진·유성·눈보라) 보강
   ========================================================================== */
export function drawZoneDecor(ctx, z, p, rx, ry, t, cam) {
  const u = cam.unit;
  if (z.kind === 'quake') {
    ctx.save();
    ctx.strokeStyle = `rgba(190,150,100,${.25 + .2 * Math.sin(t * 10)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * TAU + .3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      let px = p.x, py = p.y;
      for (let j = 1; j <= 3; j++) {
        px += Math.cos(a0) * rx * .28 + rnd(rx * .08, -rx * .08);
        py += Math.sin(a0) * ry * .28 + rnd(ry * .12, -ry * .12);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  } else if (z.kind === 'meteor') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const prog = z.phase === 'tell' ? clamp(z.t / z.tell, 0, 1) : 1;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 1.4 + i * .33) % 1;
      const mx = p.x + Math.sin(i * 2.4) * rx * .4;
      const my = p.y - (1 - ph) * cam.H * .5;
      const gr = ctx.createRadialGradient(mx, my, 0, mx, my, u * .16);
      gr.addColorStop(0, 'rgba(255,240,200,.95)');
      gr.addColorStop(.4, `rgba(255,120,60,${.6 * prog})`);
      gr.addColorStop(1, 'rgba(255,80,40,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(mx, my, u * .16, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,170,90,${.5 * prog})`;
      ctx.lineWidth = u * .05;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - u * .05, my - u * .3); ctx.stroke();
    }
    ctx.restore();
  } else if (z.kind === 'storm') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(z.spec.color || '#fff', .35);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a0 = t * 2.2 + i * 2.1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx * (.5 + i * .2), ry * (.5 + i * .2), a0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ============================================================================
   입자 렌더 (battle-ui · 갤러리 공용)
   ========================================================================== */
export function drawParticle(ctx, p, a, t) {
  ctx.globalAlpha = a;
  ctx.fillStyle = p.color;
  ctx.strokeStyle = p.color;
  switch (p.type) {
    case 'leaf': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      ctx.scale(1, Math.max(.25, Math.abs(Math.cos((p.rot || 0) * 1.7))));
      const len = p.size * 1.9, wid = p.size * .85;
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.quadraticCurveTo(-len * .15, -wid, len * .78, -wid * .12);
      ctx.quadraticCurveTo(len * 1.06, 0, len * .78, wid * .12);
      ctx.quadraticCurveTo(-len * .15, wid, -len, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(214,255,190,.26)';
      ctx.lineWidth = Math.max(.6, p.size * .08);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(24,70,18,.55)';
      ctx.lineWidth = Math.max(.6, p.size * .07);
      ctx.beginPath(); ctx.moveTo(-len * .85, 0); ctx.lineTo(len * .95, 0); ctx.stroke();
      // 바람 궤적
      ctx.strokeStyle = 'rgba(220,255,200,.22)';
      ctx.lineWidth = Math.max(1, p.size * .25);
      ctx.beginPath(); ctx.moveTo(-len * 1.1, -wid * .2); ctx.lineTo(-len * 2.6, -wid * .8); ctx.stroke();
      break;
    }
    case 'drop': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx) + Math.PI / 2);
      const r = p.size * (.6 + a * .5);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.7);
      ctx.quadraticCurveTo(r, -r * .3, r * .72, r * .45);
      ctx.quadraticCurveTo(0, r * 1.25, -r * .72, r * .45);
      ctx.quadraticCurveTo(-r, -r * .3, 0, -r * 1.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.beginPath(); ctx.arc(-r * .2, -r * .3, r * .26, 0, TAU); ctx.fill();
      break;
    }
    case 'spark': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = Math.max(.9, p.size * .42 * a);
      const L = p.len || 8;
      const sp = Math.hypot(p.vx, p.vy) || 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L + 2);
      ctx.stroke();
      break;
    }
    case 'ember': {
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (.35 + a * .7);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a * .5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.7, 0, TAU); ctx.fill();
      ctx.globalAlpha = a * .9;
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * .42, 0, TAU); ctx.fill();
      break;
    }
    case 'shard': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      const r = p.size * (.6 + a * .5);
      ctx.beginPath();
      ctx.moveTo(r * 1.2, 0); ctx.lineTo(r * .1, -r * .8); ctx.lineTo(-r * .9, -r * .2);
      ctx.lineTo(-r * .5, r * .6); ctx.lineTo(r * .3, r * .9); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = .8; ctx.stroke();
      break;
    }
    case 'mist': {
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (1.4 + (1 - a) * 1.8);
      const mg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      mg.addColorStop(0, hexA(p.color, .13 * a));
      mg.addColorStop(.55, hexA(p.color, .045 * a));
      mg.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      break;
    }
    case 'rock': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot || 0);
      const r = p.size * (.55 + a * .45);
      ctx.beginPath();
      ctx.moveTo(r, -r * .2); ctx.lineTo(r * .4, -r); ctx.lineTo(-r * .6, -r * .7);
      ctx.lineTo(-r, r * .2); ctx.lineTo(-r * .2, r * .95); ctx.lineTo(r * .7, r * .7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(-r * .2, -r * .25, r * .4, 0, TAU); ctx.fill();
      break;
    }
    case 'bubble': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(p.color, .8);
      ctx.lineWidth = Math.max(.9, p.size * .22);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (.6 + (1 - a) * .7), 0, TAU); ctx.stroke();
      ctx.fillStyle = hexA(p.color, .22 * a);
      ctx.fill();
      break;
    }
    case 'wisp': {
      ctx.globalCompositeOperation = 'lighter';
      const r = p.size * (1.3 + (1 - a) * 1.2);
      ctx.globalAlpha = a * .42;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * .8, (p.rot || 0) * .2, 0, TAU); ctx.fill();
      ctx.globalAlpha = a * .3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r * .45, r * .36, 0, 0, TAU); ctx.fill();
      break;
    }
    case 'ring': {
      ctx.globalCompositeOperation = 'lighter';
      const k = 1 - a;
      ctx.strokeStyle = hexA(p.color, a * .8);
      ctx.lineWidth = 3 * a + .6;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * (1 + k * 2.4), p.size * (1 + k * 2.4) * .45, 0, 0, TAU);
      ctx.stroke();
      break;
    }
    case 'line': {
      ctx.lineWidth = p.size * .5;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .02); ctx.stroke();
      break;
    }
    default: {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, TAU); ctx.fill();
    }
      }
}
