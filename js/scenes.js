/* ============================================================================
   배틀 배경(스테이지) — Canvas 일러스트 + 움직이는 요소 + 날씨 파티클
   11개 장소: 스타디움/해변/바위산/설산/숲/화산/밤도심/우주/신전/수정동굴/사막
   ========================================================================== */

const TAU = Math.PI * 2;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);

export const STAGE_LIST = ['stadium', 'beach', 'rock', 'snow', 'forest', 'volcano', 'city', 'space', 'temple', 'cave', 'desert'];

export class Scene {
  constructor(canvas, stageId, weather = 'clear', lite = false, auto = true, platforms = true) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.stage = stageId;
    this.weather = weather;
    this.lite = lite;
    this.t = 0;
    this.last = 0;
    this.parts = [];
    this.layout = { left: { x: 0.26, y: 0.72 }, right: { x: 0.74, y: 0.5 }, horizon: 0.62 };
    this.dpr = Math.min(lite ? 1.5 : 1.8, window.devicePixelRatio || 1);
    this.stars = Array.from({ length: lite ? 40 : 110 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: rnd(1.6, 0.4), p: rnd(TAU), s: rnd(1.2, 0.3) }));
    this.clouds = Array.from({ length: lite ? 3 : 6 }, () => ({ x: Math.random(), y: rnd(0.4, 0.06), s: rnd(1.4, 0.5), v: rnd(0.00006, 0.000015) }));
    this.embers = Array.from({ length: lite ? 10 : 34 }, () => this._ember());
    this.fireflies = Array.from({ length: lite ? 8 : 26 }, () => ({ x: Math.random(), y: rnd(0.75, 0.3), p: rnd(TAU), s: rnd(1.6, 0.6), v: rnd(0.00004, 0.00001) }));
    this.weatherParts = [];
    this.acc = 0;
    this.auto = auto;
    if (!platforms) this.platform = () => {};
    this.resize();
    this._loop = this._loop.bind(this);
    if (auto) this.raf = requestAnimationFrame(this._loop);
  }
  _ember() { return { x: Math.random(), y: rnd(1.05, 0.5), v: rnd(0.00035, 0.0001), s: rnd(2.6, 0.7), p: rnd(TAU) }; }
  setWeather(w) { this.weather = w; }
  setLayout(l) { this.layout = { ...this.layout, ...l }; }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width || 900; this.h = r.height || 480;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  destroy() { cancelAnimationFrame(this.raf); this.dead = true; }
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
    switch (this.stage) {
      case 'stadium': this.stadium(ctx, t, W, H); break;
      case 'beach': this.beach(ctx, t, W, H); break;
      case 'rock': this.rock(ctx, t, W, H); break;
      case 'snow': this.snow(ctx, t, W, H); break;
      case 'forest': this.forest(ctx, t, W, H); break;
      case 'volcano': this.volcano(ctx, t, W, H); break;
      case 'city': this.city(ctx, t, W, H); break;
      case 'space': this.space(ctx, t, W, H); break;
      case 'temple': this.temple(ctx, t, W, H); break;
      case 'cave': this.cave(ctx, t, W, H); break;
      case 'desert': this.desert(ctx, t, W, H); break;
    }
    this.weatherLayer(ctx, t, dt, W, H);
    this.vignette(ctx, W, H);
  }

  vignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W * 0.5, H * 0.52, Math.min(W, H) * 0.25, W * 0.5, H * 0.55, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(3,6,18,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  sky(ctx, W, H, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    stops.forEach(([p, c]) => g.addColorStop(p, c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  cloudsDraw(ctx, t, W, H, color = 'rgba(255,255,255,.75)', yBase = 0.2, scale = 1) {
    ctx.save();
    for (const c of this.clouds) {
      c.x += c.v;
      if (c.x > 1.25) c.x = -0.25;
      const x = c.x * W, y = (c.y + yBase * 0.2) * H;
      const s = c.s * scale * (W / 900);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(x, y, 70 * s, 22 * s, 0, 0, TAU);
      ctx.ellipse(x - 45 * s, y + 6 * s, 44 * s, 16 * s, 0, 0, TAU);
      ctx.ellipse(x + 48 * s, y + 5 * s, 50 * s, 17 * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  platform(ctx, x, y, rx, ry, c1, c2, glow) {
    const g = ctx.createRadialGradient(x, y, 2, x, y, rx);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* ---------------- 스타디움 ---------------- */
  stadium(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#0b1a3a'], [0.35, '#1d3f74'], [0.62, '#356ea8'], [0.63, '#2d5c46'], [1, '#1b3b2c']]);
    // 조명 기둥
    for (const fx of [0.12, 0.88]) {
      const x = W * fx;
      ctx.strokeStyle = 'rgba(180,210,255,.25)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, H * 0.62); ctx.lineTo(x, H * 0.1); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const bx = x + (i - 1) * 26;
        const g = ctx.createRadialGradient(bx, H * 0.09, 0, bx, H * 0.09, 130);
        g.addColorStop(0, 'rgba(220,240,255,.95)'); g.addColorStop(0.3, 'rgba(180,220,255,.35)'); g.addColorStop(1, 'rgba(120,170,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, H * 0.09, 130, 0, TAU); ctx.fill();
        ctx.fillStyle = '#eaf6ff'; ctx.fillRect(bx - 13, H * 0.075, 26, 9);
      }
    }
    // 관중석 (계단식)
    const standY = H * 0.4;
    ctx.fillStyle = 'rgba(8,16,34,.92)';
    ctx.beginPath(); ctx.moveTo(0, standY); ctx.lineTo(W, standY); ctx.lineTo(W, H * 0.66); ctx.lineTo(0, H * 0.66); ctx.closePath(); ctx.fill();
    for (let r = 0; r < 7; r++) {
      const y = standY + 10 + r * ((H * 0.235) / 7);
      const rowH = (H * 0.235) / 7;
      // 좌석 단
      ctx.fillStyle = r % 2 ? 'rgba(22,36,66,.95)' : 'rgba(16,28,54,.95)';
      ctx.fillRect(0, y - rowH * 0.55, W, rowH * 0.9);
      ctx.fillStyle = 'rgba(120,150,210,.10)';
      ctx.fillRect(0, y - rowH * 0.55, W, 1.4);
      // 관중
      const density = 70;
      for (let i = 0; i < density; i++) {
        const x = ((i + (r % 2) * 0.5) / density) * W + Math.sin(i * 3.1 + r) * 2;
        const bob = Math.sin(t * 1.6 + i * 1.3 + r * 2.2) * (rowH * 0.06);
        const blink = Math.sin(t * 2.4 + i * 1.7 + r) > 0.78;
        ctx.fillStyle = blink ? 'rgba(255,236,170,.95)' : `rgba(${70 + ((i * 37) % 130)},${90 + ((i * 53) % 100)},${140 + ((i * 71) % 90)},.8)`;
        ctx.beginPath(); ctx.arc(x + Math.sin(i + r) * 3, y + bob, Math.max(1.6, 2.1 + (r % 3) * 0.4), 0, TAU); ctx.fill();
        // 어깨
        ctx.fillStyle = `rgba(${40 + ((i * 29) % 60)},${50 + ((i * 41) % 60)},${80 + ((i * 61) % 70)},.75)`;
        ctx.fillRect(x - 3 + Math.sin(i + r) * 3, y + bob + 2, 6, 3.2);
      }
    }
    // 난간
    ctx.fillStyle = 'rgba(150,180,230,.16)';
    ctx.fillRect(0, H * 0.652, W, 3);
    // 필드
    const fieldY = H * 0.63;
    const fg = ctx.createLinearGradient(0, fieldY, 0, H);
    fg.addColorStop(0, '#3d7d52'); fg.addColorStop(1, '#204a32');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(0, fieldY); ctx.lineTo(W, fieldY); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 잔디 줄무늬
    for (let i = 0; i < 10; i++) {
      if (i % 2) continue;
      const x0 = (i / 10) * W;
      ctx.fillStyle = 'rgba(255,255,255,.045)';
      ctx.beginPath(); ctx.moveTo(x0, fieldY); ctx.lineTo(x0 + W / 10, fieldY); ctx.lineTo(x0 + W / 10 + 40, H); ctx.lineTo(x0 + 40, H); ctx.closePath(); ctx.fill();
    }
    // 센터 서클
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.86, W * 0.18, H * 0.1, 0, 0, TAU); ctx.stroke();
    // 플랫폼
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.055, 'rgba(120,200,150,.35)', 'rgba(30,70,50,.15)', 'rgba(180,255,210,.5)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.05, 'rgba(120,200,150,.3)', 'rgba(30,70,50,.12)', 'rgba(180,255,210,.45)');
    // 조명 빛줄기
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const fx of [0.25, 0.75]) {
      const g = ctx.createLinearGradient(W * fx, 0, W * fx, H);
      g.addColorStop(0, 'rgba(180,220,255,.16)'); g.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(W * fx - 30, 0); ctx.lineTo(W * fx + 30, 0); ctx.lineTo(W * fx + 160, H); ctx.lineTo(W * fx - 160, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- 해변 ---------------- */
  beach(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#59c2f2'], [0.45, '#a8e2f7'], [0.62, '#ffe7bd'], [0.63, '#2aa9d6'], [1, '#0f6f9e']]);
    // 해
    const seaY = H * 0.44;
    const sg = ctx.createLinearGradient(0, seaY, 0, H * 0.78);
    sg.addColorStop(0, '#1d9bd1'); sg.addColorStop(1, '#0b5f88');
    ctx.fillStyle = sg; ctx.fillRect(0, seaY, W, H * 0.34);
    // 햇빛 반짝임
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const x = (i / 22) * W + Math.sin(t * 0.7 + i) * 8;
      const y = seaY + 12 + ((i * 37) % (H * 0.3)) + Math.sin(t * 1.3 + i * 2) * 3;
      ctx.fillStyle = `rgba(255,255,255,${0.18 + 0.14 * Math.sin(t * 2 + i)})`;
      ctx.fillRect(x, y, 14 + Math.sin(t + i) * 8, 2);
    }
    ctx.restore();
    // 파도
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const y0 = seaY + 26 + k * 26;
      ctx.moveTo(0, y0);
      for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y0 + Math.sin(x * 0.012 + t * (1.1 + k * 0.3) + k) * (5 + k * 3));
      ctx.lineTo(W, H * 0.8); ctx.lineTo(0, H * 0.8); ctx.closePath();
      ctx.fillStyle = k === 2 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.1)';
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.45 - k * 0.1})`; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 12) { const y = y0 + Math.sin(x * 0.012 + t * (1.1 + k * 0.3) + k) * (5 + k * 3); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    }
    // 모래
    const sandY = H * 0.7;
    const sd = ctx.createLinearGradient(0, sandY, 0, H);
    sd.addColorStop(0, '#f7e2b0'); sd.addColorStop(1, '#d8b57a');
    ctx.fillStyle = sd;
    ctx.beginPath(); ctx.moveTo(0, sandY + 8);
    ctx.quadraticCurveTo(W * 0.3, sandY - 14, W * 0.55, sandY + 6);
    ctx.quadraticCurveTo(W * 0.8, sandY - 10, W, sandY + 4);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 거품
    for (let i = 0; i < 16; i++) {
      const x = ((i / 16) * W + Math.sin(t * 0.6 + i) * 20) % W;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.2 * Math.sin(t * 1.4 + i)})`;
      ctx.beginPath(); ctx.ellipse(x, sandY - 4 + Math.sin(t + i) * 4, 18 + Math.sin(i) * 8, 4, 0, 0, TAU); ctx.fill();
    }
    // 태양
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sunX = W * 0.82, sunY = H * 0.2;
    const gl = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 150);
    gl.addColorStop(0, 'rgba(255,250,220,1)'); gl.addColorStop(0.2, 'rgba(255,235,150,.75)'); gl.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sunX, sunY, 150, 0, TAU); ctx.fill();
    ctx.restore();
    this.cloudsDraw(ctx, t, W, H, 'rgba(255,255,255,.9)', 0.12, 1);
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(255,235,190,.55)', 'rgba(180,140,80,.15)', 'rgba(255,255,255,.5)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(255,235,190,.5)', 'rgba(180,140,80,.12)', 'rgba(255,255,255,.45)');
  }

  /* ---------------- 바위산 ---------------- */
  rock(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#2a2340'], [0.3, '#6b4a63'], [0.55, '#c97b5a'], [0.62, '#7a4a3a'], [1, '#3a241f']]);
    // 원경 산
    const layers = [[0.5, '#4a3350', 0.12], [0.58, '#5b3c48', 0.2], [0.66, '#3d2a2e', 0.28]];
    layers.forEach(([base, color, jag], li) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, H);
      let x = 0;
      const step = W / 9;
      let y = H * base;
      ctx.lineTo(0, y);
      for (let i = 0; i <= 9; i++) {
        x = (i / 9) * W;
        y = H * base - Math.abs(Math.sin(i * 2.1 + li)) * H * jag - (i % 2 ? 20 : 0);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    });
    // 바위 기둥
    for (let i = 0; i < 5; i++) {
      const x = W * (0.08 + i * 0.22), top = H * (0.32 + (i % 3) * 0.05);
      const g = ctx.createLinearGradient(x - 30, 0, x + 40, 0);
      g.addColorStop(0, '#5a3f36'); g.addColorStop(0.6, '#7a5747'); g.addColorStop(1, '#3d2a25');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 34, H); ctx.lineTo(x - 22, top); ctx.lineTo(x + 14, top - 10); ctx.lineTo(x + 36, H); ctx.closePath(); ctx.fill();
    }
    // 지면
    const gy = H * 0.7;
    const gg = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, '#7c5a45'); gg.addColorStop(1, '#3b2820');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.moveTo(0, gy + 10);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, gy + Math.sin(x * 0.01) * 8);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 자갈
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137) % W), y = gy + 20 + ((i * 71) % (H * 0.28));
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.beginPath(); ctx.ellipse(x, y, 8 + (i % 5), 4 + (i % 3), 0, 0, TAU); ctx.fill();
    }
    // 먼지 입자
    for (let i = 0; i < 18; i++) {
      const x = ((i * 97 + t * 12) % W), y = H * 0.55 + Math.sin(t + i) * 30;
      ctx.fillStyle = 'rgba(255,220,180,.18)';
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
    }
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(190,150,110,.5)', 'rgba(90,60,45,.15)', 'rgba(255,210,160,.35)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(190,150,110,.45)', 'rgba(90,60,45,.12)', 'rgba(255,210,160,.3)');
  }

  /* ---------------- 설산 ---------------- */
  snow(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#0f2a4a'], [0.35, '#2f5d8a'], [0.6, '#a8cbe4'], [1, '#dbeaf5']]);
    // 오로라
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const g = ctx.createLinearGradient(0, H * 0.1, W, H * 0.35);
      g.addColorStop(0, 'rgba(120,255,200,0)'); g.addColorStop(0.4, `rgba(${120 + i * 40},255,${180 + i * 20},${0.1 + Math.sin(t + i) * 0.04})`); g.addColorStop(1, 'rgba(120,180,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, H * (0.12 + i * 0.04));
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, H * (0.12 + i * 0.04) + Math.sin(x * 0.006 + t * 0.6 + i) * 26);
      ctx.lineTo(W, H * (0.1 + i * 0.05)); ctx.lineTo(0, H * 0.1);
      ctx.fill();
    }
    ctx.restore();
    // 봉우리 (날카로운 실루엣 + 눈 덮인 정상)
    const peaks = [
      { col: '#33526f', base: 0.6, amp: 0.34, seed: 1.1, snow: 0.95, step: 9 },
      { col: '#54748f', base: 0.68, amp: 0.26, seed: 3.4, snow: 0.75, step: 7 },
      { col: '#7e9bb4', base: 0.76, amp: 0.17, seed: 5.9, snow: 0.5, step: 6 }
    ];
    peaks.forEach((pk) => {
      const N = pk.step;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W;
        const r1 = Math.abs(Math.sin(i * 2.31 + pk.seed));
        const r2 = Math.abs(Math.sin(i * 0.77 + pk.seed * 2));
        const y = H * pk.base - (r1 * 0.62 + r2 * 0.38) * H * pk.amp;
        pts.push({ x, y });
      }
      const path = new Path2D();
      path.moveTo(0, H);
      pts.forEach((pt) => path.lineTo(pt.x, pt.y));
      path.lineTo(W, H);
      path.closePath();
      const mg = ctx.createLinearGradient(0, H * (pk.base - pk.amp), 0, H * pk.base);
      mg.addColorStop(0, pk.col);
      mg.addColorStop(1, '#101d2c');
      ctx.fillStyle = mg;
      ctx.fill(path);
      // 정상 눈 (클립 후 위쪽만)
      ctx.save();
      ctx.clip(path);
      const sg = ctx.createLinearGradient(0, H * (pk.base - pk.amp), 0, H * (pk.base - pk.amp * 0.35));
      sg.addColorStop(0, `rgba(255,255,255,${pk.snow})`);
      sg.addColorStop(0.55, `rgba(226,240,252,${pk.snow * 0.55})`);
      sg.addColorStop(1, 'rgba(226,240,252,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // 능선 하이라이트
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      pts.forEach((pt, i) => i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y));
      ctx.stroke();
    });
    // 설원
    const gy = H * 0.72;
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#eaf4fb'); g.addColorStop(1, '#b9d3e6');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, gy + 20);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, gy + Math.sin(x * 0.008) * 10);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 소나무
    for (const px of [0.06, 0.2, 0.86, 0.96]) {
      const x = px * W, y = gy + 14;
      ctx.fillStyle = '#26404f';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x, y - 60 + i * 20); ctx.lineTo(x + 22 - i * 4, y + i * 12); ctx.lineTo(x - 22 + i * 4, y + i * 12); ctx.closePath(); ctx.fill();
      }
    }
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(235,248,255,.75)', 'rgba(150,180,205,.2)', 'rgba(255,255,255,.65)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(235,248,255,.7)', 'rgba(150,180,205,.18)', 'rgba(255,255,255,.6)');
  }

  /* ---------------- 숲 ---------------- */
  forest(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#0e2418'], [0.3, '#1d4a2c'], [0.55, '#4e8f52'], [0.7, '#2b5230'], [1, '#12281a']]);
    // 빛줄기
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = W * (0.12 + i * 0.19);
      const g = ctx.createLinearGradient(x, 0, x + 90, H);
      g.addColorStop(0, 'rgba(220,255,180,.16)'); g.addColorStop(1, 'rgba(220,255,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 34, 0); ctx.lineTo(x + 150, H); ctx.lineTo(x + 60, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 나무 레이어 (침엽수 실루엣)
    const treeCols = ['#0e2a19', '#173c22', '#21552c'];
    treeCols.forEach((col, li) => {
      const n = 8 + li * 3;
      for (let i = 0; i < n; i++) {
        const seed = i * 137.5 + li * 53;
        const x = ((seed % 100) / 100) * W;
        const baseH = H * (0.62 + li * 0.1) + (seed % 17);
        const th = H * (0.22 + li * 0.07) * (0.7 + ((seed * 7) % 40) / 100);
        const sway = Math.sin(t * 0.6 + i + li) * (2 + li);
        const w = 26 + li * 6;
        ctx.fillStyle = col;
        ctx.fillRect(x - 3, baseH - th * 0.15, 6, th * 0.2);
        for (let k = 0; k < 3; k++) {
          const ky = baseH - th * (0.15 + k * 0.28);
          const kw = w * (1 - k * 0.22);
          ctx.beginPath();
          ctx.moveTo(x + sway * (0.3 + k * 0.3), ky - th * 0.45);
          ctx.lineTo(x + kw, ky);
          ctx.lineTo(x - kw, ky);
          ctx.closePath();
          ctx.fill();
        }
      }
    });
    // 지면
    const gy = H * 0.74;
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#2f5c32'); g.addColorStop(1, '#142a18');
    ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy);
    // 반딧불
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      f.x += f.v; if (f.x > 1) f.x = 0;
      const x = f.x * W, y = (f.y + Math.sin(t * 0.8 + f.p) * 0.03) * H;
      const a = 0.4 + 0.4 * Math.sin(t * 2 + f.p);
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, 14 * f.s);
      g2.addColorStop(0, `rgba(220,255,150,${a})`); g2.addColorStop(1, 'rgba(160,255,120,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, 14 * f.s, 0, TAU); ctx.fill();
    }
    ctx.restore();
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(140,200,120,.35)', 'rgba(30,60,35,.15)', 'rgba(190,255,160,.35)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(140,200,120,.3)', 'rgba(30,60,35,.12)', 'rgba(190,255,160,.3)');
  }

  /* ---------------- 화산 ---------------- */
  volcano(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#1a0a12'], [0.3, '#4a1220'], [0.55, '#a1351d'], [0.66, '#5c1a12'], [1, '#2a0d0a']]);
    // 화산
    ctx.fillStyle = '#2b1010';
    ctx.beginPath(); ctx.moveTo(0, H * 0.66);
    ctx.lineTo(W * 0.32, H * 0.66); ctx.lineTo(W * 0.48, H * 0.3); ctx.lineTo(W * 0.56, H * 0.34); ctx.lineTo(W * 0.72, H * 0.66);
    ctx.lineTo(W, H * 0.66); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    // 분화구 빛
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.34, W * 0.35);
    g.addColorStop(0, `rgba(255,180,60,${0.75 + Math.sin(t * 2) * 0.1})`); g.addColorStop(0.4, 'rgba(255,90,20,.35)'); g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.34, W * 0.35, 0, TAU); ctx.fill();
    ctx.restore();
    // 용암 강
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let x = W * (0.3 + i * 0.16); x < W * (0.7 + i * 0.1); x += 30) {
        pts.push([x, H * 0.78 + Math.sin(x * 0.02 + t * 1.6 + i) * 8]);
      }
      ctx.strokeStyle = `rgba(255,${120 + i * 30},40,${0.55 - i * 0.12})`;
      ctx.lineWidth = 10 - i * 2; ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 24;
      ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
    }
    ctx.restore();
    // 화산 사면 용암줄기
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const dir = i % 2 ? 1 : -1;
      const startX = W * 0.5 + dir * (26 + i * 14);
      ctx.strokeStyle = `rgba(255,${110 + i * 18},40,${0.34 - i * 0.06})`;
      ctx.lineWidth = 3.2 - i * 0.5; ctx.shadowColor = '#ff6a1a'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(startX, H * 0.35);
      ctx.quadraticCurveTo(startX + dir * 40, H * 0.5, startX + dir * 90 + Math.sin(t + i) * 4, H * 0.66);
      ctx.stroke();
    }
    ctx.restore();
    // 지면
    const gy = H * 0.76;
    const gg = ctx.createLinearGradient(0, gy, 0, H);
    gg.addColorStop(0, '#3a1a14'); gg.addColorStop(1, '#1a0a08');
    ctx.fillStyle = gg; ctx.fillRect(0, gy, W, H - gy);
    // 불티
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const e of this.embers) {
      e.y -= e.v; e.x += Math.sin(t + e.p) * 0.0004;
      if (e.y < 0) { e.y = 1.05; e.x = Math.random(); }
      const x = e.x * W, y = e.y * H;
      const a = 0.5 + 0.5 * Math.sin(t * 3 + e.p);
      ctx.fillStyle = `rgba(255,${140 + a * 60},40,${a * 0.9})`;
      ctx.beginPath(); ctx.arc(x, y, e.s, 0, TAU); ctx.fill();
    }
    ctx.restore();
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(200,90,50,.45)', 'rgba(60,20,15,.2)', 'rgba(255,140,70,.4)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(200,90,50,.4)', 'rgba(60,20,15,.18)', 'rgba(255,140,70,.35)');
  }

  /* ---------------- 밤 도심 ---------------- */
  city(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#05071a'], [0.4, '#101a3c'], [0.6, '#2a2350'], [1, '#120f22']]);
    // 별
    for (const s of this.stars) {
      const a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, TAU); ctx.fill();
    }
    // 달
    ctx.save();
    const mx = W * 0.82, my = H * 0.16;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
    mg.addColorStop(0, 'rgba(255,250,220,.95)'); mg.addColorStop(0.28, 'rgba(255,245,200,.5)'); mg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(mx, my, 26, 0, TAU); ctx.fill();
    ctx.restore();
    // 빌딩 3레이어
    const layers = [{ c: '#0d1430', n: 14, hmax: 0.3, base: 0.66, win: 0.15 }, { c: '#141c40', n: 11, hmax: 0.4, base: 0.72, win: 0.3 }, { c: '#1c2650', n: 8, hmax: 0.5, base: 0.8, win: 0.5 }];
    layers.forEach((L, li) => {
      ctx.fillStyle = L.c;
      for (let i = 0; i < L.n; i++) {
        const bw = W / L.n * (0.6 + ((i * 37) % 30) / 100);
        const x = (i / L.n) * W + 8;
        const bh = H * (L.hmax * (0.45 + ((i * 53) % 50) / 100));
        const y = H * L.base - bh;
        ctx.fillRect(x, y, bw, bh + H);
        // 창문
        for (let wy = y + 12; wy < H * L.base - 8; wy += 14) {
          for (let wx = x + 6; wx < x + bw - 6; wx += 12) {
            const on = ((wx * 13 + wy * 7 + li * 5) % 11) / 11 < L.win + 0.15 * Math.sin(t * 0.4 + wx);
            if (on) {
              ctx.fillStyle = (wx * wy) % 3 === 0 ? 'rgba(120,200,255,.75)' : 'rgba(255,214,140,.8)';
              ctx.fillRect(wx, wy, 4, 6);
              ctx.fillStyle = L.c;
            }
          }
        }
      }
    });
    // 네온 글로우
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const ng = ctx.createLinearGradient(0, H * 0.55, 0, H);
    ng.addColorStop(0, 'rgba(120,80,255,.16)'); ng.addColorStop(1, 'rgba(255,60,180,.06)');
    ctx.fillStyle = ng; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.restore();
    // 옥상 바닥
    const gy = H * 0.78;
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#20264a'); g.addColorStop(1, '#0c0f22');
    ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy);
    ctx.strokeStyle = 'rgba(120,160,255,.18)'; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const y = gy + i * i * 2.4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(110,140,255,.3)', 'rgba(20,25,60,.2)', 'rgba(150,180,255,.45)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(255,110,200,.22)', 'rgba(20,25,60,.18)', 'rgba(255,150,220,.4)');
  }

  /* ---------------- 우주 ---------------- */
  space(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#04030f'], [0.45, '#0b0724'], [0.75, '#170b33'], [1, '#08040f']]);
    // 성운
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const cx = W * (0.2 + i * 0.22) + Math.sin(t * 0.2 + i) * 20;
      const cy = H * (0.25 + (i % 2) * 0.3);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.22);
      g.addColorStop(0, `rgba(${100 + i * 40},${60 + i * 20},255,.18)`); g.addColorStop(1, 'rgba(60,0,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, W * 0.22, 0, TAU); ctx.fill();
    }
    ctx.restore();
    // 별
    for (const s of this.stars) {
      const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, TAU); ctx.fill();
    }
    // 유성
    const sh = (t * 0.15) % 4;
    if (sh < 0.6) {
      const p = sh / 0.6;
      const x = W * (0.1 + p * 0.7), y = H * (0.1 + p * 0.35);
      const g = ctx.createLinearGradient(x - 90, y - 45, x, y);
      g.addColorStop(0, 'rgba(180,220,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.95)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x - 90, y - 45); ctx.lineTo(x, y); ctx.stroke();
    }
    // 행성
    const px = W * 0.82, py = H * 0.26, pr = W * 0.075;
    const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    pg.addColorStop(0, '#b48cff'); pg.addColorStop(0.5, '#6b3fd6'); pg.addColorStop(1, '#1e0b46');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(px, py); ctx.rotate(-0.3); ctx.scale(1, 0.24);
    ctx.strokeStyle = 'rgba(220,200,255,.55)'; ctx.lineWidth = pr * 0.12;
    ctx.beginPath(); ctx.arc(0, 0, pr * 1.6, 0, TAU); ctx.stroke();
    ctx.restore();
    // 부유 바닥
    const gy = H * 0.8;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const x = (i / 30) * W, y = gy + Math.sin(t * 0.8 + i) * 6;
      ctx.fillStyle = `rgba(140,120,255,${0.05 + 0.05 * Math.sin(t + i)})`;
      ctx.fillRect(x, y, W / 30, H - y);
    }
    ctx.restore();
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(130,100,255,.4)', 'rgba(20,10,50,.2)', 'rgba(180,150,255,.5)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(100,200,255,.3)', 'rgba(20,10,50,.18)', 'rgba(150,220,255,.45)');
  }

  /* ---------------- 신전 ---------------- */
  temple(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#1a1430'], [0.35, '#2c2350'], [0.55, '#5e4a7a'], [0.7, '#3a2e52'], [1, '#1a1526']]);
    // 달빛
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(W * 0.5, H * 0.1, 0, W * 0.5, H * 0.3, W * 0.5);
    g.addColorStop(0, 'rgba(220,210,255,.35)'); g.addColorStop(1, 'rgba(160,140,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // 기둥
    for (const px of [0.08, 0.92, 0.24, 0.76]) {
      const x = W * px, top = H * 0.12;
      const cg = ctx.createLinearGradient(x - 30, 0, x + 30, 0);
      cg.addColorStop(0, '#3a3352'); cg.addColorStop(0.45, '#6a5f8c'); cg.addColorStop(1, '#2a2438');
      ctx.fillStyle = cg;
      ctx.fillRect(x - 26, top, 52, H * 0.66 - top);
      ctx.fillStyle = '#7a6e9c'; ctx.fillRect(x - 34, top - 16, 68, 18);
      ctx.fillRect(x - 34, H * 0.66 - 18, 68, 18);
      // 문양
      ctx.strokeStyle = 'rgba(180,160,255,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x, top + 60 + i * 70, 12, 0, TAU); ctx.stroke(); }
    }
    // 아치
    ctx.strokeStyle = 'rgba(160,140,220,.5)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(W / 2, H * 0.42, W * 0.36, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    // 바닥
    const gy = H * 0.66;
    const fg = ctx.createLinearGradient(0, gy, 0, H);
    fg.addColorStop(0, '#4a4064'); fg.addColorStop(1, '#221c33');
    ctx.fillStyle = fg; ctx.fillRect(0, gy, W, H - gy);
    // 바닥 원형 문양
    ctx.strokeStyle = 'rgba(200,180,255,.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.85, W * 0.28, H * 0.1, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W / 2, H * 0.85, W * 0.2, H * 0.07, 0, 0, TAU); ctx.stroke();
    // 떠다니는 룬
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const a = 0.3 + 0.4 * Math.sin(t * 1.2 + i);
      const x = W * (0.2 + (i % 3) * 0.3) + Math.sin(t * 0.5 + i) * 12;
      const y = H * (0.3 + Math.floor(i / 3) * 0.12) + Math.cos(t * 0.7 + i) * 8;
      ctx.fillStyle = `rgba(190,170,255,${a})`;
      ctx.font = `${12 + (i % 3) * 3}px serif`;
      ctx.fillText(['✦', '✧', '⟡', '◈'][i % 4], x, y);
    }
    ctx.restore();
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(170,150,230,.4)', 'rgba(40,30,65,.2)', 'rgba(210,190,255,.45)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(150,200,230,.3)', 'rgba(40,30,65,.18)', 'rgba(190,220,255,.4)');
  }

  /* ---------------- 수정 동굴 ---------------- */
  cave(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#050a1c'], [0.4, '#0c1a38'], [0.7, '#132a4a'], [1, '#070e1e']]);
    // 종유석
    ctx.fillStyle = '#0a1428';
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 30 + Math.abs(Math.sin(x * 0.012)) * 50 + (x % 3) * 12);
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H * 0.16); ctx.lineTo(0, H * 0.12); ctx.closePath(); ctx.fill();
    // 수정
    const crystals = [[0.12, 0.78, '#4fd8ff'], [0.3, 0.86, '#8f7bff'], [0.7, 0.84, '#4fd8ff'], [0.88, 0.76, '#ff7bd8'], [0.5, 0.72, '#6fe0c0']];
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [cx, cy, col] of crystals) {
      const x = cx * W, y = cy * H;
      const pulse = 0.5 + 0.3 * Math.sin(t * 1.5 + cx * 10);
      const g = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 90);
      g.addColorStop(0, col.replace(')', `,${pulse})`).replace('#', 'rgba(').length > 20 ? `rgba(120,220,255,${pulse})` : `rgba(120,220,255,${pulse})`);
      g.addColorStop(1, 'rgba(40,80,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 30, 90, 0, TAU); ctx.fill();
    }
    ctx.restore();
    for (const [cx, cy, col] of crystals) {
      const x = cx * W, y = cy * H;
      for (let i = 0; i < 4; i++) {
        const h = 40 + i * 22, w = 10 + (3 - i) * 4;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 2 + i);
        ctx.beginPath(); ctx.moveTo(x + (i - 1.5) * 20, y); ctx.lineTo(x + (i - 1.5) * 20 + w * 0.4, y - h); ctx.lineTo(x + (i - 1.5) * 20 - w * 0.4, y - h * 0.9); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    // 바닥
    const gy = H * 0.8;
    const g2 = ctx.createLinearGradient(0, gy, 0, H);
    g2.addColorStop(0, '#14243f'); g2.addColorStop(1, '#070d1a');
    ctx.fillStyle = g2; ctx.fillRect(0, gy, W, H - gy);
    // 물빛 반사
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const y = gy + 10 + i * 5;
      ctx.strokeStyle = `rgba(100,200,255,${0.06 + 0.04 * Math.sin(t * 2 + i)})`;
      ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x <= W; x += 20) { const yy = y + Math.sin(x * 0.02 + t * 2 + i) * 3; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.stroke();
    }
    ctx.restore();
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(90,180,230,.3)', 'rgba(10,25,50,.2)', 'rgba(120,220,255,.4)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(130,110,240,.28)', 'rgba(10,25,50,.18)', 'rgba(160,140,255,.35)');
  }

  /* ---------------- 사막 ---------------- */
  desert(ctx, t, W, H) {
    this.sky(ctx, W, H, [[0, '#f0a860'], [0.3, '#f7c98a'], [0.55, '#ffe6b8'], [0.6, '#e8b878'], [1, '#c98f52']]);
    // 태양
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sx = W * 0.5, sy = H * 0.28;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 160);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.25, 'rgba(255,230,150,.7)'); g.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 160, 0, TAU); ctx.fill();
    ctx.restore();
    // 모래 언덕
    const dunes = [[0.62, '#e0b278', 0], [0.7, '#d49f60', 1], [0.78, '#c78d50', 2]];
    for (const [base, col, k] of dunes) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, H);
      ctx.lineTo(0, H * base);
      for (let x = 0; x <= W; x += 20) {
        const y = H * base - Math.sin(x * 0.004 + k * 1.7 + t * 0.15) * H * 0.05 - Math.sin(x * 0.011 + k) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    // 선인장
    for (const [cx, s] of [[0.08, 1], [0.9, 0.8]]) {
      const x = cx * W, y = H * 0.8;
      ctx.fillStyle = '#4e6b3a';
      ctx.fillRect(x - 6 * s, y - 60 * s, 12 * s, 60 * s);
      ctx.fillRect(x - 24 * s, y - 44 * s, 10 * s, 26 * s);
      ctx.fillRect(x - 24 * s, y - 44 * s, 20 * s, 8 * s);
      ctx.fillRect(x + 14 * s, y - 52 * s, 10 * s, 34 * s);
      ctx.fillRect(x + 4 * s, y - 52 * s, 20 * s, 8 * s);
    }
    // 열기 일렁임
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = `rgba(255,240,200,${0.05 + 0.03 * Math.sin(t + i)})`;
      ctx.beginPath();
      const y = H * (0.55 + i * 0.03);
      for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.02 + t * 2.5 + i) * 4; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
      ctx.lineTo(W, y + 20); ctx.lineTo(0, y + 20); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const { left, right } = this.layout;
    this.platform(ctx, left.x * W, left.y * H, W * 0.15, H * 0.05, 'rgba(240,205,150,.55)', 'rgba(160,110,60,.2)', 'rgba(255,235,190,.4)');
    this.platform(ctx, right.x * W, right.y * H, W * 0.15, H * 0.045, 'rgba(240,205,150,.5)', 'rgba(160,110,60,.18)', 'rgba(255,235,190,.35)');
  }

  /* ---------------- 날씨 레이어 ---------------- */
  weatherLayer(ctx, t, dt, W, H) {
    const w = this.weather;
    if (w === 'clear') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,245,200,.035)'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    if (w === 'sun') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(W * 0.5, -H * 0.1, 0, W * 0.5, H * 0.2, W * 0.75);
      g.addColorStop(0, `rgba(255,230,140,${0.28 + Math.sin(t) * 0.03})`); g.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // 빛줄기
      for (let i = 0; i < 7; i++) {
        const x = W * (0.1 + i * 0.12);
        ctx.save(); ctx.translate(x, -20); ctx.rotate(0.18 + Math.sin(t * 0.6 + i) * 0.02);
        const lg = ctx.createLinearGradient(0, 0, 0, H * 1.2);
        lg.addColorStop(0, 'rgba(255,240,170,.16)'); lg.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = lg; ctx.fillRect(-14, 0, 28, H * 1.2);
        ctx.restore();
      }
      ctx.restore();
      return;
    }
    const count = this.lite ? 60 : 150;
    if (this.weatherParts.length !== count) {
      this.weatherParts = Array.from({ length: count }, () => ({
        x: Math.random(), y: Math.random(), s: rnd(1.4, 0.4), v: rnd(1, 0.35), p: rnd(TAU)
      }));
    }
    ctx.save();
    if (w === 'rain') {
      ctx.strokeStyle = 'rgba(170,210,255,.5)';
      for (const p of this.weatherParts) {
        p.y += p.v * 0.035 * (dt / 16); p.x += p.v * 0.008;
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
        if (p.x > 1.05) p.x = 0;
        const x = p.x * W, y = p.y * H;
        ctx.lineWidth = 1 + p.s;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6 * p.s, y + 22 * p.s); ctx.stroke();
      }
      // 물웅덩이 물결
      ctx.globalAlpha = 0.25;
      for (let i = 0; i < 8; i++) {
        const x = ((i * 173 + t * 20) % W), y = H * 0.82 + (i % 3) * 20;
        ctx.strokeStyle = 'rgba(200,230,255,.5)'; ctx.lineWidth = 1.4;
        const r = ((t * 40 + i * 33) % 60);
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.3, 0, 0, TAU); ctx.stroke();
      }
    } else if (w === 'sand') {
      ctx.fillStyle = 'rgba(230,190,130,.10)'; ctx.fillRect(0, 0, W, H);
      for (const p of this.weatherParts) {
        p.x += p.v * 0.02 * (dt / 16) * (1 + p.s); p.y += Math.sin(t * 2 + p.p) * 0.001;
        if (p.x > 1.05) { p.x = -0.05; p.y = Math.random(); }
        const x = p.x * W, y = p.y * H;
        ctx.fillStyle = `rgba(240,210,150,${0.25 + p.s * 0.3})`;
        ctx.beginPath(); ctx.ellipse(x, y, 1.6 + p.s * 2, 1 + p.s, 0.5, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(240,210,150,.12)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const y = H * (0.4 + i * 0.12);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 20) { const yy = y + Math.sin(x * 0.02 + t * 3 + i) * 6; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
        ctx.stroke();
      }
    } else if (w === 'hail') {
      ctx.fillStyle = 'rgba(200,230,255,.08)'; ctx.fillRect(0, 0, W, H);
      for (const p of this.weatherParts) {
        p.y += p.v * 0.02 * (dt / 16); p.x += Math.sin(t + p.p) * 0.0008;
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
        const x = p.x * W, y = p.y * H;
        ctx.fillStyle = `rgba(255,255,255,${0.35 + p.s * 0.4})`;
        ctx.beginPath(); ctx.arc(x, y, 1.5 + p.s * 2.4, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
}
