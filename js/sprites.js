/* ============================================================================
   스프라이트 · 울음소리 · 효과음
   - 공식 아트워크(PokeAPI/sprites) → 실패 시 픽셀 스프라이트 → 도형 폴백
   - 울음소리(PokeAPI/cries, ogg) 재생, 실패 시 WebAudio 합성음
   - 타격/급소/기절 등 절차적 효과음
   ========================================================================== */
const ART = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';
const PIXEL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const CRY = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';

const artCache = new Map();   // id -> {img, src}
const pixelCache = new Map();
let soundOn = localStorage.getItem('pbs-sound') !== 'off';

export function setSound(on) { soundOn = on; localStorage.setItem('pbs-sound', on ? 'on' : 'off'); }
export function isSoundOn() { return soundOn; }

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function getArt(id) {
  if (artCache.has(id)) return artCache.get(id);
  const p = (async () => {
    let img = await loadImage(`${ART}/${id}.png`);
    if (img) return { img, src: `${ART}/${id}.png` };
    img = await loadImage(`${PIXEL}/${id}.png`);
    if (img) return { img, src: `${PIXEL}/${id}.png` };
    return { img: null, src: null };
  })();
  artCache.set(id, p);
  const v = await p;
  artCache.set(id, v);
  return v;
}

export function preloadArt(ids) {
  return Promise.all(ids.map((id) => getArt(id).catch(() => null)));
}

/* ---------------- 오디오 ---------------- */
let ac = null;
function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function unlockAudio() { ctx(); }

function noiseBuffer(a, dur = 0.3) {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  return buf;
}

const cryCache = new Map();
export function playCry(id, volume = 0.28) {
  if (!soundOn) return;
  try {
    let a = cryCache.get(id);
    if (!a) {
      a = new Audio(`${CRY}/${id}.ogg`);
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      cryCache.set(id, a);
      a.addEventListener('error', () => { cryCache.set(id, null); });
    }
    if (a) {
      a.volume = volume;
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => synthCry(id));
      return;
    }
  } catch (e) { /* ignore */ }
  synthCry(id);
}

/* 울음소리를 못 불러올 때: id 기반 짧은 합성 울음 */
function synthCry(id) {
  if (!soundOn) return;
  const a = ctx(); if (!a) return;
  const t = a.currentTime;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  g.connect(a.destination);
  const base = 320 + (id % 17) * 42;
  const osc = a.createOscillator();
  osc.type = id % 3 === 0 ? 'square' : id % 3 === 1 ? 'sawtooth' : 'triangle';
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(base * 1.9, t + 0.12);
  osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.4);
  osc.connect(g); osc.start(t); osc.stop(t + 0.45);
}

export function sfx(kind, power = 1) {
  if (!soundOn) return;
  const a = ctx(); if (!a) return;
  const t = a.currentTime;
  const master = a.createGain();
  master.gain.value = 0.5;
  master.connect(a.destination);
  const boom = (freq, dur, type = 'sine', vol = 0.5, slide = 0) => {
    const o = a.createOscillator(); const g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  };
  const hiss = (dur = 0.18, vol = 0.25, hp = 800) => {
    const src = a.createBufferSource(); src.buffer = noiseBuffer(a, dur);
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hp; f.Q.value = 0.8;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  };
  switch (kind) {
    case 'hit': boom(150 * power, 0.16, 'sine', 0.45, -80); hiss(0.12, 0.22, 1200); break;
    case 'crit': boom(220, 0.26, 'square', 0.32, -140); hiss(0.2, 0.3, 2200); break;
    case 'super': boom(520, 0.3, 'triangle', 0.28, -260); hiss(0.24, 0.22, 3000); break;
    case 'weak': boom(120, 0.12, 'sine', 0.18, -40); break;
    case 'fire': hiss(0.3, 0.18, 700); boom(90, 0.3, 'sawtooth', 0.12, -30); break;
    case 'faint': boom(360, 0.6, 'triangle', 0.3, -300); break;
    case 'heal': [523, 659, 784].forEach((f, i) => { setTimeout(() => boom(f, 0.18, 'sine', 0.14), i * 90); }); break;
    case 'whoosh': hiss(0.22, 0.12, 1800); break;
    case 'click': boom(880, 0.05, 'square', 0.08); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => { setTimeout(() => boom(f, 0.3, 'triangle', 0.16), i * 130); }); break;
    case 'lose': [392, 330, 262].forEach((f, i) => { setTimeout(() => boom(f, 0.34, 'sine', 0.16), i * 160); }); break;
    default: break;
  }
}
