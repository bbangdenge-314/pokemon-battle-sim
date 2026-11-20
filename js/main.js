/* ============================================================================
   메인 — 화면 흐름, 팀 선택, 프리뷰, 배틀 시작
   ========================================================================== */
import { DATA, } from './data.js';
import {
  TYPE_COLORS, WEATHERS, STAGE_META, statsAt50, typeEff, estimateWinRate, moveById, monById, josa
} from './engine.js';
import { Scene, STAGE_LIST } from './scenes.js';
import { getArt, preloadArt, playCry, sfx, setSound, isSoundOn, unlockAudio } from './sprites.js';
import { BattleUI } from './battle-ui.js';
import { weatherIcon, stageIcon } from './icons.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const DEX = DATA.dex;
const TYPE_LIST = DATA.types;

const state = {
  step: 0,
  mode: 1,
  stage: 'stadium',
  weather: 'clear',
  teams: { A: [], B: [] },
  pick: { side: 'A', idx: 0 },
  matchup: 0,
  speed: 2
};

/* ---------------- 스크린 ----------------
*/
function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ============================================================================
   인트로
   ========================================================================== */
let heroScene = null;
function initHero() {
  const c = $('#heroCanvas');
  heroScene = new Scene(c, 'space', 'clear', false, true, false);
  window.addEventListener('resize', () => heroScene && heroScene.resize());
  $('#startBtn').addEventListener('click', () => { unlockAudio(); sfx('click'); toSetup(0); });
  $('#quickBtn').addEventListener('click', () => { unlockAudio(); quickStart(); });
}

function toSetup(step = 0) {
  showScreen('screenSetup');
  goStep(step);
}

/* ============================================================================
   스텝 전환
   ========================================================================== */
const TOTAL_STEPS = 5;
function goStep(n) {
  state.step = Math.max(0, Math.min(TOTAL_STEPS - 1, n));
  $$('.step-btn').forEach((b) => {
    const i = Number(b.dataset.step);
    b.classList.toggle('active', i === state.step);
    b.classList.toggle('done', i < state.step);
  });
  $$('.step-panel').forEach((p) => p.classList.remove('active'));
  ['stepMode', 'stepStage', 'stepWeather', 'stepPick', 'stepPreview'][state.step] && $('#' + ['stepMode', 'stepStage', 'stepWeather', 'stepPick', 'stepPreview'][state.step]).classList.add('active');
  const prev = $('#navPrev');
  const next = $('#navNext');
  const _need = state.mode;
  next.disabled = state.step === 3 && !(state.teams.A.filter(Boolean).length === _need && state.teams.B.filter(Boolean).length === _need);
  prev.style.visibility = state.step === 0 ? 'hidden' : 'visible';
  next.textContent = state.step === 3 ? '프리뷰 보기 →' : state.step === 4 ? '' : '다음 →';
  next.style.display = state.step === 4 ? 'none' : '';
  const hints = ['대결 방식을 선택하세요', '배틀이 펼쳐질 장소를 고르세요', '날씨를 고르세요 — 실제 배틀 규칙에 반영됩니다', '양 팀 포켓몬을 모두 채워주세요', '능력치와 상성을 확인하고 전투를 시작하세요'];
  $('#footHint').textContent = hints[state.step];
  if (state.step === 1) ensureMiniScenes();
  if (state.step === 2) ensureWeatherPreview();
  if (state.step === 3) { renderTeams(); updatePickHint(); }
  if (state.step === 4) renderPreview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  sfx('click');
}

/* ============================================================================
   STEP 1 — 모드
   ========================================================================== */
function initMode() {
  $$('.mode-card').forEach((card) => {
    card.classList.toggle('on', Number(card.dataset.mode) === state.mode);
    card.addEventListener('click', () => {
      state.mode = Number(card.dataset.mode);
      $$('.mode-card').forEach((c) => c.classList.toggle('on', c === card));
      // 팀 배열 길이 맞추기
      for (const side of ['A', 'B']) {
        const arr = state.teams[side];
        while (arr.length < state.mode) arr.push(null);
        while (arr.length > state.mode) arr.pop();
      }
      renderTeams();
      sfx('click');
    });
  });
  state.teams.A = new Array(state.mode).fill(null);
  state.teams.B = new Array(state.mode).fill(null);
}

/* ============================================================================
   STEP 2 — 장소
   ========================================================================== */
const minis = [];
let miniTicking = false;
function buildStageGrid() {
  const grid = $('#stageGrid');
  grid.innerHTML = '';
  STAGE_LIST.forEach((id) => {
    const meta = STAGE_META[id];
    const btn = document.createElement('button');
    btn.className = 'stage-card' + (id === state.stage ? ' on' : '');
    btn.dataset.stage = id;
    btn.innerHTML = `<canvas></canvas><span class="sc-icon">${stageIcon(id)}</span>
      <div class="sc-label"><b>${meta.name}</b><span>${meta.sub}</span></div>`;
    btn.addEventListener('click', () => {
      state.stage = id;
      $$('.stage-card').forEach((c) => c.classList.toggle('on', c === btn));
      if (weatherScene) weatherScene.destroy(), weatherScene = null, ensureWeatherPreview();
      sfx('click');
    });
    grid.appendChild(btn);
    minis.push({ id, canvas: btn.querySelector('canvas'), scene: null, card: btn });
  });
}
function ensureMiniScenes() {
  minis.forEach((m) => {
    if (m.scene) return;
    const r = m.canvas.getBoundingClientRect();
    if (!r.width) return;
    m.scene = new Scene(m.canvas, m.id, 'clear', true, false, false);
  });
  if (!miniTicking) { miniTicking = true; tickMinis(); }
}
let lastMini = 0;
function tickMinis() {
  requestAnimationFrame(tickMinis);
  const now = performance.now();
  if (now - lastMini < 50) return;
  lastMini = now;
  if (state.step !== 1) return;
  minis.forEach((m) => {
    if (!m.scene) return;
    const r = m.canvas.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
    m.scene.tick(52);
  });
}

/* ============================================================================
   STEP 3 — 날씨
   ========================================================================== */
let weatherScene = null;
function buildWeatherGrid() {
  const grid = $('#weatherGrid');
  grid.innerHTML = '';
  Object.values(WEATHERS).forEach((w) => {
    const btn = document.createElement('button');
    btn.className = 'weather-card' + (w.id === state.weather ? ' on' : '');
    btn.dataset.weather = w.id;
    btn.innerHTML = `<div class="weather-icon">${weatherIcon(w.id)}</div>
      <div><h4>${w.name}</h4><p>${w.desc}</p><div class="weather-tips">${w.tips.map((t) => `<span>${t}</span>`).join('')}</div></div>`;
    btn.addEventListener('click', () => {
      state.weather = w.id;
      $$('.weather-card').forEach((c) => c.classList.toggle('on', c === btn));
      if (weatherScene) weatherScene.setWeather(w.id);
      $('#wpLabel').textContent = `${w.name} · ${w.tips.join(' / ')}`;
      sfx('click');
    });
    grid.appendChild(btn);
  });
}
function ensureWeatherPreview() {
  const canvas = $('#weatherPreview');
  const r = canvas.getBoundingClientRect();
  if (!r.width) { setTimeout(ensureWeatherPreview, 60); return; }
  if (weatherScene) weatherScene.destroy();
  weatherScene = new Scene(canvas, state.stage, state.weather, true, true, false);
  const w = WEATHERS[state.weather];
  $('#wpLabel').textContent = `${w.name} · ${w.tips.join(' / ')}`;
}

/* ============================================================================
   STEP 4 — 팀 선택
   ========================================================================== */
function bst(mon) { return mon.st.reduce((a, b) => a + b, 0); }
function renderTeams() {
  for (const side of ['A', 'B']) {
    const box = $('#team' + side);
    box.innerHTML = '';
    state.teams[side].forEach((id, i) => {
      const mon = id ? monById(id) : null;
      const btn = document.createElement('button');
      btn.className = 'slot ' + (mon ? 'filled' : 'empty');
      btn.dataset.side = side;
      btn.dataset.idx = i;
      if (mon) {
        btn.innerHTML = `
          <div class="s-img"><img alt="${mon.n}"></div>
          <div class="s-info">
            <div class="s-name">${mon.n}<span class="s-no">#${String(mon.id).padStart(4, '0')}</span></div>
            <div class="s-types">${mon.t.map((t) => `<span class="type-chip" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('')}</div>
            <div class="s-bst">종족값 합 ${bst(mon)} · ${mon.gen}세대</div>
          </div>
          <span class="s-remove" title="빼기">✕</span>`;
        getArt(mon.id).then((a) => { const img = btn.querySelector('img'); if (a.src) img.src = a.src; });
        btn.querySelector('.s-remove').addEventListener('click', (e) => {
          e.stopPropagation();
          state.teams[side][i] = null;
          renderTeams(); updatePickHint(); sfx('click');
        });
        btn.addEventListener('click', () => openPicker(side, i));
      } else {
        btn.innerHTML = `<span class="plus">＋</span><span>${i + 1}번째 포켓몬 선택</span>`;
        btn.addEventListener('click', () => openPicker(side, i));
      }
      box.appendChild(btn);
    });
  }
  updatePickHint();
}
function updatePickHint() {
  const need = state.mode;
  const a = state.teams.A.filter(Boolean).length;
  const b = state.teams.B.filter(Boolean).length;
  $('#pickCount').innerHTML = `내 팀 <b>${a}</b> / ${need} <span style="opacity:.45">·</span> 상대 팀 <b>${b}</b> / ${need}`;
  const next = $('#navNext');
  next.disabled = state.step === 3 && !(a === need && b === need);
  $('#footHint').textContent = a === need && b === need ? '모두 선택 완료! 프리뷰로 넘어가세요' : `양 팀 ${need}마리씩 선택해 주세요 (${a + b} / ${need * 2})`;
}

/* ---------------- 랜덤 ---------------- */
function randomPick(exclude = new Set(), smart = true) {
  const pool = DEX.filter((d) => !exclude.has(d.id));
  const strong = pool.filter((d) => bst(d) >= 430);
  const arr = smart && strong.length && Math.random() < 0.82 ? strong : pool;
  return arr[Math.floor(Math.random() * arr.length)].id;
}
function fillRandomTeam(side) {
  const used = new Set([...state.teams.A, ...state.teams.B].filter(Boolean));
  const arr = state.teams[side];
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] && Math.random() < 0.5) continue;
    if (arr[i]) used.delete(arr[i]);
    const id = randomPick(used);
    arr[i] = id;
    used.add(id);
  }
  renderTeams();
}
function initPickActions() {
  $('#randomA').addEventListener('click', () => { fillRandomTeam('A'); sfx('click'); });
  $('#randomB').addEventListener('click', () => { fillRandomTeam('B'); sfx('click'); });
  $('#randomBoth').addEventListener('click', () => { fillRandomTeam('A'); fillRandomTeam('B'); sfx('click'); toast('랜덤 팀을 채웠습니다!'); });
  $('#clearBoth').addEventListener('click', () => {
    state.teams.A = state.teams.A.map(() => null);
    state.teams.B = state.teams.B.map(() => null);
    renderTeams(); sfx('click');
  });
}

/* ---------------- 도감 모달 ---------------- */
const picker = {
  gen: 0,
  type: '',
  q: '',
  open: false,
  els: {}
};
function initPicker() {
  picker.els = {
    modal: $('#picker'), grid: $('#pickerGrid'), search: $('#pickerSearch'),
    gen: $('#genChips'), type: $('#typeChips'), title: $('#pickerTitle'), count: $('#pickerCount')
  };
  const g = picker.els.gen;
  g.innerHTML = '';
  const gAll = document.createElement('button');
  gAll.className = 'chip on'; gAll.textContent = '전체 세대';
  gAll.addEventListener('click', () => { picker.gen = 0; [...g.children].forEach((c) => c.classList.toggle('on', c === gAll)); renderPickerGrid(); });
  g.appendChild(gAll);
  for (let i = 1; i <= 9; i++) {
    const c = document.createElement('button');
    c.className = 'chip'; c.textContent = `${i}세대`;
    c.addEventListener('click', () => { picker.gen = i; [...g.children].forEach((x) => x.classList.toggle('on', x === c)); renderPickerGrid(); });
    g.appendChild(c);
  }
  const tc = picker.els.type;
  tc.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'chip on'; all.textContent = '전체 타입';
  all.addEventListener('click', () => { picker.type = ''; [...tc.children].forEach((c) => c.classList.toggle('on', c === all)); renderPickerGrid(); });
  tc.appendChild(all);
  TYPE_LIST.forEach((t) => {
    const c = document.createElement('button');
    c.className = 'chip type';
    c.textContent = t;
    c.style.background = TYPE_COLORS[t];
    c.addEventListener('click', () => {
      picker.type = picker.type === t ? '' : t;
      [...tc.children].forEach((x) => x.classList.toggle('on', picker.type ? x === c : x === all));
      renderPickerGrid();
    });
    tc.appendChild(c);
  });
  picker.els.search.addEventListener('input', (e) => { picker.q = e.target.value.trim().toLowerCase(); renderPickerGrid(); });
  $('#pickerClose').addEventListener('click', closePicker);
  picker.els.modal.addEventListener('click', (e) => { if (e.target === picker.els.modal) closePicker(); });
  $('#pickerRandom').addEventListener('click', () => {
    const used = new Set([...state.teams.A, ...state.teams.B].filter(Boolean));
    const id = randomPick(used);
    placePick(id);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picker.open) closePicker(); });
}

function openPicker(side, idx) {
  state.pick = { side, idx };
  picker.open = true;
  picker.els.modal.classList.add('show');
  picker.els.modal.setAttribute('aria-hidden', 'false');
  picker.els.title.textContent = `${side === 'A' ? '내 팀' : '상대 팀'} ${idx + 1}번째 포켓몬`;
  renderPickerGrid();
  setTimeout(() => picker.els.search.focus(), 80);
  sfx('click');
}
function closePicker() {
  picker.open = false;
  picker.els.modal.classList.remove('show');
  picker.els.modal.setAttribute('aria-hidden', 'true');
}
function placePick(id) {
  state.teams[state.pick.side][state.pick.idx] = id;
  renderTeams();
  const used = new Set([...state.teams.A, ...state.teams.B].filter(Boolean));
  const side = state.pick.side;
  let nextIdx = state.teams[side].findIndex((v, i) => !v && i > state.pick.idx);
  if (nextIdx === -1) nextIdx = state.teams[side].findIndex((v) => !v);
  if (nextIdx !== -1) {
    state.pick.idx = nextIdx;
    picker.els.title.textContent = `${side === 'A' ? '내 팀' : '상대 팀'} ${nextIdx + 1}번째 포켓몬`;
    renderPickerGrid();
  } else {
    closePicker();
    const other = side === 'A' ? 'B' : 'A';
    const otherEmpty = state.teams[other].findIndex((v) => !v);
    if (otherEmpty !== -1) {
      toast(`${side === 'A' ? '내 팀' : '상대 팀'} 완성! 이제 ${other === 'A' ? '내 팀' : '상대 팀'}을 골라주세요`);
    } else {
      toast('모든 포켓몬을 선택했습니다!');
    }
  }
  sfx('click');
}
function renderPickerGrid() {
  const grid = picker.els.grid;
  const q = picker.q;
  const used = new Set([...state.teams.A, ...state.teams.B].filter(Boolean));
  const list = DEX.filter((d) => {
    if (picker.gen && d.gen !== picker.gen) return false;
    if (picker.type && !d.t.includes(picker.type)) return false;
    if (q) {
      if (String(d.id) === q) return true;
      if (d.n.toLowerCase().includes(q)) return true;
      if (d.en.includes(q)) return true;
      return false;
    }
    return true;
  });
  picker.els.count.textContent = `${list.length.toLocaleString()}마리`;
  const html = list.map((d) => `
    <button class="pick-card${used.has(d.id) && !(state.teams[state.pick.side][state.pick.idx] === d.id) ? ' inteam' : ''}" data-id="${d.id}">
      <span class="pc-no">#${String(d.id).padStart(4, '0')}</span>
      <img loading="lazy" alt="${d.n}">
      <span class="pc-name">${d.n}</span>
      <span class="pc-types">${d.t.map((t) => `<span class="type-chip" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('')}</span>
    </button>`).join('');
  grid.innerHTML = html;
  // 이미지 lazy 로딩
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const btn = en.target;
      const id = Number(btn.dataset.id);
      const img = btn.querySelector('img');
      if (!img.src) img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
      io.unobserve(btn);
    });
  }, { root: grid, rootMargin: '200px' });
  [...grid.children].forEach((c) => io.observe(c));
  grid.onclick = (e) => {
    const btn = e.target.closest('.pick-card');
    if (!btn || btn.classList.contains('inteam')) return;
    placePick(Number(btn.dataset.id));
  };
}

/* ============================================================================
   STEP 5 — 프리뷰
   ========================================================================== */
function renderPreview() {
  const { A = [], B = [] } = state.teams;
  const sumA = A.filter(Boolean).map(monById);
  const sumB = B.filter(Boolean).map(monById);
  $('#previewSummary').textContent = `${state.mode} 대 ${state.mode} · ${STAGE_META[state.stage].name} · ${WEATHERS[state.weather].name}`;
  $('#previewMeta').innerHTML = `
    <span class="meta-pill">${stageIcon(state.stage)} ${STAGE_META[state.stage].name}</span>
    <span class="meta-pill">${weatherIcon(state.weather)} ${WEATHERS[state.weather].name}</span>
    <span class="meta-pill">⚔ ${state.mode} vs ${state.mode}</span>
    <span class="meta-pill">Lv.50 · 체력 ×1.6</span>`;
  const teamHtml = (side, arr) => `
    <div class="pt-side">
      <h4>${side === 'A' ? '내 팀' : '상대 팀'}</h4>
      <div class="pt-list">${arr.map((m) => `<div class="pt-mon"><img data-art="${m.id}" alt=""><div><b>${m.n}</b><div style="display:flex;gap:3px;margin-top:3px;flex-wrap:wrap">${m.t.map((t) => `<span class="type-chip" style="background:${TYPE_COLORS[t]}">${t}</span>`).join('')}</div></div></div>`).join('')}</div>
    </div>`;
  $('#previewTeams').innerHTML = teamHtml('A', sumA) + '<div class="pt-mid">VS</div>' + teamHtml('B', sumB);
  $$('#previewTeams img[data-art]').forEach(async (img) => {
    const a = await getArt(Number(img.dataset.art));
    if (a.src) img.src = a.src;
  });

  const tabs = $('#matchupTabs');
  tabs.innerHTML = sumA.map((_, i) => `<button data-i="${i}" class="${state.matchup === i ? 'on' : ''}">${i + 1}번째</button>`).join('');
  tabs.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.matchup = Number(b.dataset.i);
    $('.matchup-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    renderMatchup();
    sfx('click');
  };

  const wr = estimateWinRate(A.filter(Boolean), B.filter(Boolean), state.weather, 24);
  $('#winRate').innerHTML = `
    <div class="wr-num" style="color:${wr >= 50 ? '#8fc0ff' : '#ff9aa4'}">${wr}<small>%</small></div>
    <div class="wr-meta">
      <b>내 팀 예상 승률</b>
      <div class="wr-bar"><i class="a" style="width:${wr}%"></i><i class="b" style="width:${100 - wr}%"></i></div>
      <div class="wr-legend"><span>내 팀 ${wr}%</span><span>상대 팀 ${100 - wr}%</span></div>
    </div>`;
  renderMatchup();
}

function renderMatchup() {
  const A = state.teams.A.filter(Boolean).map(monById);
  const B = state.teams.B.filter(Boolean).map(monById);
  const i = Math.min(state.matchup, A.length - 1);
  const a = A[i], b = B[i];
  if (!a || !b) return;

  // 레이더
  const cv = $('#radarCanvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = cv.getBoundingClientRect();
  const W = Math.max(280, rect.width || 520), H = Math.round(W * 0.8);
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawRadar(ctx, W, H, a, b);

  // 스탯 바
  const labels = [['HP', 0], ['공격', 1], ['방어', 2], ['특공', 3], ['특방', 4], ['스피드', 5]];
  $('#statBars').innerHTML = labels.map(([label, k]) => {
    const va = a.st[k], vb = b.st[k];
    const max = Math.max(va, vb, 1);
    return `<div class="stat-row">
      <span class="sl">${va}</span>
      <span class="stat-bar l"><i style="width:${(va / max) * 100}%"></i></span>
      <span class="sname">${label}</span>
      <span class="stat-bar r"><i style="width:${(vb / max) * 100}%"></i></span>
      <span class="sr">${vb}</span>
    </div>`;
  }).join('');

  // 상성 분석
  const effLine = (mv, target, me) => {
    const e = typeEff(mv.t, target.t);
    const stab = me.t.includes(mv.t) ? 1.5 : 1;
    const power = Math.round(mv.p * stab * e);
    const badge = e === 0 ? '<span class="ta-badge weak">효과 없음</span>'
      : e >= 2 ? `<span class="ta-badge super">${e}x 굉장함</span>`
        : e < 1 ? `<span class="ta-badge weak">${e}x 반감</span>`
          : '<span class="ta-badge normal">1x</span>';
    return `<div class="ta-line"><span class="ta-move" style="color:${TYPE_COLORS[mv.t]}">${mv.n}</span><span class="ta-arrow">→</span>${badge}<span style="color:#8b93ad;font-size:11px">실효 위력 ${power || '-'}</span></div>`;
  };
  const defLine = (t, me) => {
    const e = typeEff(t, me.t);
    const badge = e === 0 ? '<span class="ta-badge super">무효</span>' : e >= 2 ? `<span class="ta-badge weak">${e}x 약점</span>` : e < 1 ? `<span class="ta-badge super">${e}x 저항</span>` : '<span class="ta-badge normal">1x</span>';
    return `<div class="ta-line"><span class="ta-move" style="color:${TYPE_COLORS[t]}">${t}</span><span class="ta-arrow">→</span>${badge}</div>`;
  };
  const mine = a.mv.map(moveById).filter(Boolean);
  const theirs = b.mv.map(moveById).filter(Boolean);
  $('#typeAnalysis').innerHTML = `
    <div class="ta-block">
      <h5>내 기술 → ${b.n}</h5>
      <div class="ta-lines">${mine.map((m) => effLine(m, b, a)).join('')}</div>
    </div>
    <div class="ta-block">
      <h5>${b.n}의 기술 → 나</h5>
      <div class="ta-lines">${theirs.map((m) => effLine(m, a, b)).join('')}</div>
    </div>
    <div class="ta-block">
      <h5>타입 방어 상성 · ${a.n} ← ${b.t.join('·')}</h5>
      <div class="ta-lines">${b.t.map((t) => defLine(t, a)).join('')}</div>
    </div>`;
}

function drawRadar(ctx, W, H, a, b) {
  const cx = W / 2, cy = H / 2 + 4;
  const R = Math.min(W, H) * 0.33;
  const labels = ['HP', '공격', '방어', '특공', '특방', '스피드'];
  const n = 6;
  const angle = (i) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const MAX = 160;
  ctx.clearRect(0, 0, W, H);
  // 배경 그리드
  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const r = (R * ring) / 4;
      const x = cx + Math.cos(angle(i)) * r, y = cy + Math.sin(angle(i)) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = ring === 4 ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle(i)) * R, cy + Math.sin(angle(i)) * R);
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke();
  }
  const poly = (mon, fill, stroke) => {
    ctx.beginPath();
    mon.st.forEach((v, i) => {
      const r = Math.max(6, Math.min(1, v / MAX) * R);
      const x = cx + Math.cos(angle(i)) * r, y = cy + Math.sin(angle(i)) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = stroke; ctx.lineWidth = 2.5; ctx.stroke();
    mon.st.forEach((v, i) => {
      const r = Math.max(6, Math.min(1, v / MAX) * R);
      const x = cx + Math.cos(angle(i)) * r, y = cy + Math.sin(angle(i)) * r;
      ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = stroke; ctx.fill();
      ctx.strokeStyle = 'rgba(9,13,26,.9)'; ctx.lineWidth = 1.4; ctx.stroke();
    });
  };
  poly(b, 'rgba(240,75,90,.18)', '#ff8a95');
  poly(a, 'rgba(77,141,255,.22)', '#7fb3ff');
  // 라벨
  ctx.font = '700 12px ' + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  labels.forEach((l, i) => {
    const r = R + 26;
    const x = cx + Math.cos(angle(i)) * r, y = cy + Math.sin(angle(i)) * r;
    ctx.fillStyle = 'rgba(200,210,235,.75)';
    ctx.fillText(l, x, y);
  });
  // 범례
  ctx.textAlign = 'left';
  ctx.font = '900 12px ' + getComputedStyle(document.body).fontFamily;
  ctx.fillStyle = '#7fb3ff'; ctx.beginPath(); ctx.arc(14, 16, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#c8d2ee'; ctx.fillText(a.n, 26, 16);
  ctx.fillStyle = '#ff8a95'; ctx.beginPath(); ctx.arc(14, 38, 5, 0, 7); ctx.fill();
  ctx.fillStyle = '#c8d2ee'; ctx.fillText(b.n, 26, 38);
}

/* ============================================================================
   배틀 시작
   ========================================================================== */
let battleUI = null;
function initBattle() {
  battleUI = new BattleUI({
    onQuit: () => { battleUI.destroy(); showScreen('screenSetup'); goStep(3); },
    onAgain: () => { startBattle(); }
  });
  $('#battleQuit').addEventListener('click', () => { battleUI.running = false; battleUI.destroy(); showScreen('screenSetup'); goStep(3); });
  $('#battleSkip').addEventListener('click', () => { battleUI.running = false; battleUI.finish(); });
  $('#againBtn').addEventListener('click', () => { $('#resultOverlay').classList.remove('show'); startBattle(); });
  $('#setupBtn').addEventListener('click', () => { $('#resultOverlay').classList.remove('show'); battleUI.destroy(); showScreen('screenSetup'); goStep(3); });
}

async function startBattle() {
  const A = state.teams.A.filter(Boolean);
  const B = state.teams.B.filter(Boolean);
  if (!A.length || !B.length) { toast('양 팀 포켓몬을 먼저 선택해 주세요'); goStep(3); return; }
  unlockAudio();
  sfx('click');
  showScreen('screenBattle');
  // 아트워크 선로딩
  await preloadArt([...A, ...B]);
  battleUI.setup({ teamA: A, teamB: B, weather: state.weather, stage: state.stage });
  requestAnimationFrame(() => { battleUI.scene.resize(); battleUI.fx.resize(); });
  battleUI.run();
}

function quickStart() {
  const mode = 1 + Math.floor(Math.random() * 3);
  state.mode = mode;
  $$('.mode-card').forEach((c) => c.classList.toggle('on', Number(c.dataset.mode) === mode));
  state.teams.A = new Array(mode).fill(null);
  state.teams.B = new Array(mode).fill(null);
  fillRandomTeam('A'); fillRandomTeam('B');
  const stages = STAGE_LIST;
  state.stage = stages[Math.floor(Math.random() * stages.length)];
  const ws = Object.keys(WEATHERS);
  state.weather = ws[Math.floor(Math.random() * ws.length)];
  $$('.stage-card').forEach((c) => c.classList.toggle('on', c.dataset.stage === state.stage));
  $$('.weather-card').forEach((c) => c.classList.toggle('on', c.dataset.weather === state.weather));
  toast(`${mode} 대 ${mode} · ${STAGE_META[state.stage].name} · ${WEATHERS[state.weather].name}`);
  startBattle();
}

/* ============================================================================
   공통
   ========================================================================== */
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

function initSound() {
  const btn = $('#soundBtn');
  const sync = () => { btn.textContent = isSoundOn() ? '🔊' : '🔇'; };
  sync();
  btn.addEventListener('click', () => { setSound(!isSoundOn()); sync(); if (isSoundOn()) { unlockAudio(); sfx('click'); } });
}

function initNav() {
  $('#navPrev').addEventListener('click', () => goStep(state.step - 1));
  $('#navNext').addEventListener('click', () => {
    if (state.step === 1 && !state.stage) { toast('장소를 선택해 주세요'); return; }
    if (state.step === 3) {
      const a = state.teams.A.filter(Boolean).length, b = state.teams.B.filter(Boolean).length;
      if (a !== state.mode || b !== state.mode) { toast('양 팀 포켓몬을 모두 선택해 주세요'); return; }
    }
    goStep(state.step + 1);
  });
  $$('.step-btn').forEach((b) => {
    b.addEventListener('click', () => {
      const target = Number(b.dataset.step);
      if (target > state.step) {
        if (state.step === 3) {
          const a = state.teams.A.filter(Boolean).length, b2 = state.teams.B.filter(Boolean).length;
          if (a !== state.mode || b2 !== state.mode) { toast('양 팀 포켓몬을 모두 선택해 주세요'); return; }
        }
      }
      goStep(target);
    });
  });
  $('#brandHome').addEventListener('click', () => { showScreen('screenIntro'); });
  $('#startBattle').addEventListener('click', startBattle);
  window.addEventListener('resize', () => {
    if (state.step === 4) renderMatchup();
    if (state.step === 2 && weatherScene) weatherScene.resize();
    minis.forEach((m) => m.scene && m.scene.resize());
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && state.step < 4 && $('#screenSetup').classList.contains('active') && !picker.open) $('#navNext').click();
    if (e.key === 'ArrowLeft' && state.step > 0 && $('#screenSetup').classList.contains('active') && !picker.open) $('#navPrev').click();
  });
}

let booted = false;
function init() {
  if (booted) return;
  booted = true;
  initHero();
  initSound();
  initMode();
  initNav();
  buildStageGrid();
  buildWeatherGrid();
  initPicker();
  initPickActions();
  initBattle();
  renderTeams();
  $('#previewSummary').textContent = '';
}

/* 디버그/검증용 훅 (UI 동작에는 영향 없음) */
window.PBS = {
  state,
  go: (n) => goStep(n),
  setMode: (m) => { state.mode = m; $$('.mode-card').forEach((c) => c.classList.toggle('on', Number(c.dataset.mode) === m)); state.teams.A = new Array(m).fill(null); state.teams.B = new Array(m).fill(null); renderTeams(); },
  setStage: (id) => { state.stage = id; $$('.stage-card').forEach((c) => c.classList.toggle('on', c.dataset.stage === id)); },
  setWeather: (id) => { state.weather = id; $$('.weather-card').forEach((c) => c.classList.toggle('on', c.dataset.weather === id)); if (weatherScene) weatherScene.setWeather(id); },
  setTeams: (A, B) => { state.teams.A = A.slice(); state.teams.B = B.slice(); state.mode = A.length; renderTeams(); },
  battle: () => battleUI,
  start: startBattle
};

document.addEventListener('DOMContentLoaded', init);
if (document.readyState === 'interactive' || document.readyState === 'complete') init();
