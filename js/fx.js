/* ============================================================================
   기술별 Canvas 이펙트 엔진
   - 기술 → 아키타입(beam/stream/bolt/projectile/volley/slash/rush/drop/quake/
     wave/burst/buff/heal/status/shadow) 매핑
   - 파티클·궤적·히트스톱·화면 플래시 훅 제공
   ========================================================================== */
import { TYPE_COLORS } from './engine.js';

const C = TYPE_COLORS;
const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* 기술 → 연출 스펙 ------------------------------------------------------ */
const FX_TABLE = {
  // 불꽃
  'flamethrower': { kind: 'stream', color: '#ff6a2b', second: '#ffd166', shape: 'flame' },
  'fire-blast': { kind: 'burst', color: '#ff5a1f', second: '#ffd166', shape: 'flame' },
  'heat-wave': { kind: 'wave', color: '#ff7a3d', second: '#ffd166' },
  'overheat': { kind: 'burst', color: '#ff3b1f', second: '#ffd166', big: true },
  'flare-blitz': { kind: 'rush', color: '#ff6a2b', second: '#ffd166', trail: 'flame' },
  'sacred-fire': { kind: 'projectile', color: '#ffb347', second: '#fff3c4', shape: 'flame' },
  'ember': { kind: 'volley', color: '#ff8a3d', second: '#ffd166', shape: 'flame' },
  'blast-burn': { kind: 'pillar', color: '#ff4a1f', second: '#ffd166', big: true },
  'blue-flare': { kind: 'pillar', color: '#4aa8ff', second: '#d8f0ff', big: true },
  'steam-eruption': { kind: 'burst', color: '#cfe8ff', second: '#ffffff' },
  'will-o-wisp': { kind: 'status', color: '#8f6bff', second: '#c7b6ff', shape: 'flame' },
  // 물
  'hydro-pump': { kind: 'stream', color: '#2f8fe6', second: '#c8ecff', shape: 'water', power: 1.25 },
  'water-gun': { kind: 'stream', color: '#4aa8f0', second: '#d8f2ff', shape: 'water', power: 0.7 },
  'surf': { kind: 'wave', color: '#2f8fe6', second: '#d8f2ff', shape: 'water', power: 1.1 },
  'waterfall': { kind: 'rush', color: '#3f9fe8', second: '#d8f2ff', trail: 'water' },
  'aqua-jet': { kind: 'rush', color: '#5ec8ff', second: '#e6f8ff', trail: 'water' },
  'liquidation': { kind: 'rush', color: '#3f9fe8', second: '#d8f2ff', trail: 'water' },
  'origin-pulse': { kind: 'wave', color: '#2f7fe0', second: '#bfe6ff', big: true },
  'spacial-rend': { kind: 'slash', color: '#b06bff', second: '#ffd6ff', slash: 'cross' },
  'crabhammer': { kind: 'burst', color: '#4aa8f0', second: '#ffffff' },
  'water-shuriken': { kind: 'volley', color: '#6fd0ff', second: '#e8fbff', shape: 'shuriken' },
  'sparkling-aria': { kind: 'wave', color: '#7fd8ff', second: '#eaffff' },
  // 풀
  'solar-beam': { kind: 'beam', color: '#7ee06a', second: '#fff3b0', charge: true, big: true },
  'razor-leaf': { kind: 'volley', color: '#5fc24a', second: '#d9ffcf', shape: 'leaf' },
  'leaf-blade': { kind: 'slash', color: '#5fc24a', second: '#eaffdf' },
  'leaf-storm': { kind: 'volley', color: '#4fb83c', second: '#d6ffca', shape: 'leaf', many: 10 },
  'energy-ball': { kind: 'projectile', color: '#6fd45a', second: '#e9ffd9', shape: 'orb' },
  'seed-bomb': { kind: 'volley', color: '#7a9c3a', second: '#e2ffc7', shape: 'seed' },
  'bullet-seed': { kind: 'volley', color: '#8fbf46', second: '#f2ffd9', shape: 'seed', many: 5 },
  'giga-drain': { kind: 'drain', color: '#69d05a', second: '#d8ffcf' },
  'drain-punch': { kind: 'rush', color: '#69d05a', second: '#d8ffcf', drain: true },
  'power-whip': { kind: 'slash', color: '#5fc24a', second: '#eaffdf', slash: 'whip' },
  'petal-blizzard': { kind: 'volley', color: '#ff9ac4', second: '#ffe3ef', shape: 'petal', many: 9 },
  'frenzy-plant': { kind: 'pillar', color: '#3fa03a', second: '#c8ffbf', big: true },
  'spirit-shackle': { kind: 'shadow', color: '#6f5fd8', second: '#c9c2ff' },
  // 전기
  'thunderbolt': { kind: 'bolt', color: '#ffd93b', second: '#fffbe0', big: true },
  'thunder': { kind: 'bolt', color: '#ffe14d', second: '#ffffff', sky: true, big: true },
  'thunder-punch': { kind: 'rush', color: '#ffd93b', second: '#fffbe0', trail: 'spark' },
  'thunder-fang': { kind: 'rush', color: '#ffd93b', second: '#fffbe0', trail: 'spark' },
  'discharge': { kind: 'burst', color: '#ffe14d', second: '#fffbe0' },
  'volt-tackle': { kind: 'rush', color: '#ffe14d', second: '#fffbe0', trail: 'spark', big: true },
  'wild-charge': { kind: 'rush', color: '#ffe14d', second: '#fffbe0', trail: 'spark' },
  'volt-switch': { kind: 'projectile', color: '#ffe14d', second: '#fffbe0' },
  'thunder-cage': { kind: 'cage', color: '#ffd93b', second: '#fffbe0' },
  'zing-zap': { kind: 'rush', color: '#ffd93b', second: '#fffbe0', trail: 'spark' },
  'fusion-bolt': { kind: 'bolt', color: '#ffe14d', second: '#ffffff' },
  'rising-voltage': { kind: 'pillar', color: '#ffe14d', second: '#fffbe0' },
  'thunder-wave': { kind: 'status', color: '#ffd93b', second: '#fffbe0' },
  // 얼음
  'ice-beam': { kind: 'beam', color: '#66d9e8', second: '#ffffff', shape: 'ice' },
  'blizzard': { kind: 'storm', color: '#8fe3ef', second: '#ffffff', shape: 'snow' },
  'ice-punch': { kind: 'rush', color: '#8fe3ef', second: '#ffffff', trail: 'ice' },
  'ice-fang': { kind: 'rush', color: '#8fe3ef', second: '#ffffff', trail: 'ice' },
  'freeze-dry': { kind: 'beam', color: '#9fe8f2', second: '#ffffff', shape: 'ice' },
  'ice-shard': { kind: 'volley', color: '#a8ecf5', second: '#ffffff', shape: 'ice' },
  'icicle-spear': { kind: 'volley', color: '#a8ecf5', second: '#ffffff', shape: 'ice', many: 5 },
  'glacial-lance': { kind: 'projectile', color: '#8fe3ef', second: '#ffffff', shape: 'ice', big: true },
  'aurora-veil': { kind: 'buff', color: '#9fe8f2', second: '#ffffff' },
  'icy-wind': { kind: 'storm', color: '#bfeef7', second: '#ffffff', shape: 'snow' },
  // 격투
  'close-combat': { kind: 'rush', color: '#ff8a5c', second: '#ffd9c7', combo: 4 },
  'aura-sphere': { kind: 'projectile', color: '#6fa8ff', second: '#dfeaff', shape: 'orb' },
  'focus-blast': { kind: 'projectile', color: '#ff9a5c', second: '#ffe6d0', big: true },
  'dynamic-punch': { kind: 'rush', color: '#ff8a5c', second: '#ffe0cf', combo: 3 },
  'mach-punch': { kind: 'rush', color: '#ffb08a', second: '#ffe9dd' },
  'hammer-arm': { kind: 'rush', color: '#ff9a5c', second: '#ffe6d0', heavy: true },
  'superpower': { kind: 'rush', color: '#ff8a5c', second: '#ffe0cf' },
  'body-press': { kind: 'drop', color: '#c9b8a8', second: '#f0e6dc', shape: 'rock' },
  'low-kick': { kind: 'slash', color: '#ffb08a', second: '#ffe9dd' },
  'sacred-sword': { kind: 'slash', color: '#8fd0ff', second: '#ffffff' },
  // 악
  'crunch': { kind: 'bite', color: '#8a5cff', second: '#e0d4ff' },
  'dark-pulse': { kind: 'wave', color: '#7a4fd8', second: '#cbb8ff' },
  'night-slash': { kind: 'slash', color: '#8a5cff', second: '#e0d4ff' },
  'sucker-punch': { kind: 'rush', color: '#8a5cff', second: '#e0d4ff' },
  'knock-off': { kind: 'rush', color: '#9a7aff', second: '#eee6ff' },
  'foul-play': { kind: 'slash', color: '#7a4fd8', second: '#cbb8ff' },
  'night-daze': { kind: 'burst', color: '#9a5cff', second: '#e8d8ff', big: true },
  'beat-up': { kind: 'rush', color: '#8a5cff', second: '#e0d4ff', combo: 3 },
  'hypnosis': { kind: 'status', color: '#a78bfa', second: '#ddd6fe' },
  // 고스트
  'shadow-ball': { kind: 'projectile', color: '#7a5fd8', second: '#d8ccff', shape: 'shadow' },
  'shadow-claw': { kind: 'slash', color: '#8467e0', second: '#e3d9ff' },
  'shadow-sneak': { kind: 'rush', color: '#8467e0', second: '#e3d9ff' },
  'shadow-force': { kind: 'shadow', color: '#6a4fd0', second: '#cfc2ff', big: true },
  'shadow-bone': { kind: 'volley', color: '#8f7ad8', second: '#e8e1ff', shape: 'bone' },
  'phantom-force': { kind: 'shadow', color: '#6a4fd0', second: '#cfc2ff' },
  'moongeist-beam': { kind: 'beam', color: '#9a7aff', second: '#f0e8ff', big: true },
  'poltergeist': { kind: 'burst', color: '#7a5fd8', second: '#d8ccff' },
  'astral-barrage': { kind: 'volley', color: '#9a7aff', second: '#efe8ff', shape: 'star', many: 8 },
  'hex': { kind: 'burst', color: '#7a5fd8', second: '#d8ccff' },
  'shadow-sneak2': { kind: 'rush', color: '#8467e0', second: '#e3d9ff' },
  // 에스퍼
  'psychic': { kind: 'wave', color: '#ff6fae', second: '#ffd8ea' },
  'psystrike': { kind: 'wave', color: '#ff6fae', second: '#ffd8ea', big: true },
  'psycho-cut': { kind: 'slash', color: '#ff7ab8', second: '#ffdcea', slash: 'cross' },
  'future-sight': { kind: 'meteor', color: '#c86fff', second: '#f0d8ff' },
  'psycho-boost': { kind: 'burst', color: '#ff7ab8', second: '#ffe0f0', big: true },
  'extrasensory': { kind: 'wave', color: '#ff8ac0', second: '#ffe3f0' },
  'psyshock': { kind: 'projectile', color: '#ff85bd', second: '#ffe0f0' },
  'stored-power': { kind: 'wave', color: '#ff7ab8', second: '#ffe0f0' },
  'confusion': { kind: 'wave', color: '#ff9ac8', second: '#ffe6f2' },
  'moonblast': { kind: 'beam', color: '#ff9ad0', second: '#fff0f8', sparkle: true },
  'magical-shine': { kind: 'burst', color: '#ffb3dc', second: '#fff5fb', sparkle: true },
  'dazzling-gleam': { kind: 'burst', color: '#ffd1e8', second: '#ffffff', sparkle: true },
  'play-rough': { kind: 'rush', color: '#ffa8cf', second: '#fff0f6', combo: 3 },
  'spirit-break': { kind: 'wave', color: '#ff9ad0', second: '#fff0f8' },
  'fleur-cannon': { kind: 'beam', color: '#ff8ec8', second: '#fff0f8', big: true },
  // 드래곤
  'dragon-claw': { kind: 'slash', color: '#7a6bff', second: '#ddd8ff', slash: 'cross' },
  'dragon-pulse': { kind: 'wave', color: '#6f5cf0', second: '#d8d2ff' },
  'dragon-breath': { kind: 'stream', color: '#7a6bff', second: '#ddd8ff' },
  'draco-meteor': { kind: 'meteor', color: '#8f7bff', second: '#e0d8ff', many: 6 },
  'dragon-darts': { kind: 'volley', color: '#8f7bff', second: '#e6e0ff', shape: 'shard2', many: 2 },
  'scale-shot': { kind: 'volley', color: '#8f7bff', second: '#e6e0ff', shape: 'scale', many: 5 },
  'dragon-ascent': { kind: 'rush', color: '#8f7bff', second: '#e6e0ff', big: true },
  'outrage': { kind: 'rush', color: '#7a6bff', second: '#ddd8ff', combo: 4 },
  'roar-of-time': { kind: 'pillar', color: '#6f9cff', second: '#d8e8ff', big: true },
  'spacial-rend2': { kind: 'slash', color: '#b06bff', second: '#ffd6ff', slash: 'cross' },
  // 비행
  'air-slash': { kind: 'slash', color: '#a8c8ff', second: '#f0f8ff', slash: 'wind' },
  'hurricane': { kind: 'storm', color: '#a8c8ff', second: '#ffffff', shape: 'wind' },
  'brave-bird': { kind: 'rush', color: '#8fb8ff', second: '#e8f2ff', trail: 'wind' },
  'wing-attack': { kind: 'slash', color: '#b8d4ff', second: '#ffffff', slash: 'wind' },
  'drill-peck': { kind: 'rush', color: '#a8c8ff', second: '#ffffff' },
  'aeroblast': { kind: 'beam', color: '#7fb8ff', second: '#eaf6ff', big: true },
  'bleakwind-storm': { kind: 'storm', color: '#a8c8ff', second: '#ffffff', shape: 'wind' },
  'roost': { kind: 'heal', color: '#9fd8b0', second: '#ffffff' },
  // 독
  'sludge-bomb': { kind: 'projectile', color: '#b45cb8', second: '#e6c8ea', shape: 'sludge' },
  'sludge-wave': { kind: 'wave', color: '#b45cb8', second: '#e6c8ea' },
  'poison-jab': { kind: 'rush', color: '#c56bc9', second: '#f0dcf2' },
  'gunk-shot': { kind: 'volley', color: '#b45cb8', second: '#e6c8ea', shape: 'sludge', many: 3 },
  'poison-sting': { kind: 'projectile', color: '#c56bc9', second: '#f0dcf2' },
  'malignant-chain': { kind: 'beam', color: '#b45cb8', second: '#ffd6ff' },
  'dire-claw': { kind: 'slash', color: '#b45cb8', second: '#ffd0ff', slash: 'cross' },
  'toxic': { kind: 'status', color: '#a44fb0', second: '#e0c4e4' },
  'poison-powder': { kind: 'status', color: '#c67fcb', second: '#f0dcf2', shape: 'powder' },
  'sludge': { kind: 'projectile', color: '#b45cb8', second: '#e6c8ea' },
  // 땅/바위
  'earthquake': { kind: 'quake', color: '#d8a86a', second: '#f5e0c0' },
  'earth-power': { kind: 'quake', color: '#cfa063', second: '#f5e0c0' },
  'bulldoze': { kind: 'quake', color: '#d8b27a', second: '#f5e6cc' },
  'magnitude': { kind: 'quake', color: '#d8a86a', second: '#f5e0c0' },
  'rock-slide': { kind: 'drop', color: '#b8a06a', second: '#e8dcc0', shape: 'rock', many: 5 },
  'stone-edge': { kind: 'drop', color: '#c8b078', second: '#f0e6cc', shape: 'spike', many: 3 },
  'rock-blast': { kind: 'volley', color: '#b8a06a', second: '#e8dcc0', shape: 'rock', many: 4 },
  'head-smash': { kind: 'rush', color: '#c0a878', second: '#f0e6cc', heavy: true },
  'power-gem': { kind: 'volley', color: '#8fd8d0', second: '#e0fffb', shape: 'shard2', many: 3 },
  'sand-tomb': { kind: 'storm', color: '#d8bc84', second: '#f2e3c4' },
  'thousand-arrows': { kind: 'volley', color: '#d8b27a', second: '#f5e6cc', shape: 'arrow', many: 5 },
  // 벌레
  'bug-buzz': { kind: 'wave', color: '#a8c832', second: '#e8f5b0' },
  'x-scissor': { kind: 'slash', color: '#a8c832', second: '#e8f5b0', slash: 'cross' },
  'u-turn': { kind: 'rush', color: '#b8d84a', second: '#f0f8c8' },
  'first-impression': { kind: 'rush', color: '#b8d84a', second: '#f0f8c8' },
  'megahorn': { kind: 'rush', color: '#a8c832', second: '#e8f5b0', heavy: true },
  'leech-life': { kind: 'drain', color: '#a8c832', second: '#e8f5b0' },
  'bug-bite': { kind: 'bite', color: '#b8d84a', second: '#f0f8c8' },
  'struggle-bug': { kind: 'volley', color: '#b8d84a', second: '#f0f8c8', shape: 'dot', many: 3 },
  'electroweb': { kind: 'cage', color: '#ffe14d', second: '#fffbe0' },
  // 강철
  'iron-head': { kind: 'rush', color: '#b8c4d8', second: '#ffffff' },
  'flash-cannon': { kind: 'beam', color: '#c8d8e8', second: '#ffffff' },
  'iron-tail': { kind: 'slash', color: '#c0ccdd', second: '#ffffff', slash: 'whip' },
  'meteor-mash': { kind: 'rush', color: '#c8d8e8', second: '#ffffff', combo: 2 },
  'double-iron-bash': { kind: 'rush', color: '#b8c4d8', second: '#ffffff', combo: 2 },
  'steel-beam': { kind: 'beam', color: '#c8e0ff', second: '#ffffff', big: true },
  'anchor-shot': { kind: 'projectile', color: '#9fb0c8', second: '#e8f0fa' },
  'gigaton-hammer': { kind: 'quake', color: '#c8b0d8', second: '#f0e0ff', big: true },
  'behemoth-blade': { kind: 'slash', color: '#c8d8e8', second: '#ffffff', big: true },
  'sunsteel-strike': { kind: 'rush', color: '#ffd27a', second: '#fff4d0', big: true },
  'iron-defense': { kind: 'buff', color: '#b8c4d8', second: '#ffffff' },
  // 노말
  'body-slam': { kind: 'rush', color: '#e0d6c8', second: '#fff6ec', heavy: true },
  'double-edge': { kind: 'rush', color: '#e0d6c8', second: '#fff6ec', combo: 2 },
  'extreme-speed': { kind: 'rush', color: '#ffffff', second: '#cfe4ff', speed: true },
  'quick-attack': { kind: 'rush', color: '#ffffff', second: '#d8e8ff', speed: true },
  'hyper-beam': { kind: 'beam', color: '#ffd27a', second: '#ffffff', big: true },
  'giga-impact': { kind: 'rush', color: '#ffd27a', second: '#ffffff', big: true },
  'boomburst': { kind: 'wave', color: '#ffd8a8', second: '#ffffff', big: true },
  'fake-out': { kind: 'rush', color: '#ffffff', second: '#ffe0e0' },
  'tackle': { kind: 'rush', color: '#e0d6c8', second: '#fff6ec' },
  'scratch': { kind: 'slash', color: '#e0d6c8', second: '#fff6ec' },
  'growl': { kind: 'buff', color: '#ffd0d0', second: '#ffffff' },
  'recover': { kind: 'heal', color: '#8fe0b0', second: '#ffffff' },
  'slack-off': { kind: 'heal', color: '#8fe0b0', second: '#ffffff' },
  'synthesis': { kind: 'heal', color: '#8fe0b0', second: '#ffffff' },
  'moonlight': { kind: 'heal', color: '#c9e8ff', second: '#ffffff' },
  'morning-sun': { kind: 'heal', color: '#ffd88a', second: '#ffffff' },
  'shore-up': { kind: 'heal', color: '#d8c8a8', second: '#ffffff' },
  'rest': { kind: 'heal', color: '#a8c8ff', second: '#ffffff' },
  'soft-boiled': { kind: 'heal', color: '#ffe0b0', second: '#ffffff' },
  'milk-drink': { kind: 'heal', color: '#ffe0c0', second: '#ffffff' },
  'swords-dance': { kind: 'buff', color: '#ff9aa8', second: '#ffffff', blades: true },
  'nasty-plot': { kind: 'buff', color: '#b08cff', second: '#e8dcff' },
  'calm-mind': { kind: 'buff', color: '#8fc8ff', second: '#e8f4ff' },
  'dragon-dance': { kind: 'buff', color: '#8f7bff', second: '#e0d8ff' },
  'quiver-dance': { kind: 'buff', color: '#a8d8ff', second: '#ffffff' },
  'shell-smash': { kind: 'buff', color: '#ffb0a0', second: '#ffffff' },
  'bulk-up': { kind: 'buff', color: '#ffa070', second: '#ffe0d0' },
  'work-up': { kind: 'buff', color: '#ffc890', second: '#fff0e0' },
  'growth': { kind: 'buff', color: '#8fe08f', second: '#e0ffe0' },
  'agility': { kind: 'buff', color: '#8fd8ff', second: '#e8f8ff' },
  'rock-polish': { kind: 'buff', color: '#d8c8a0', second: '#f8f0e0' },
  'tail-glow': { kind: 'buff', color: '#ffe08a', second: '#fffbe0' },
  'cotton-guard': { kind: 'buff', color: '#e8f8ff', second: '#ffffff' },
  'sleep-powder': { kind: 'status', color: '#b8e89a', second: '#e8ffd8', shape: 'powder' },
  'spore': { kind: 'status', color: '#c8e8a0', second: '#f0ffd8', shape: 'powder' },
  'stun-spore': { kind: 'status', color: '#ffe08a', second: '#fffbe0', shape: 'powder' },
  'poison-powder': { kind: 'status', color: '#c67fcb', second: '#f0dcf2', shape: 'powder' },
  'grass-whistle': { kind: 'status', color: '#a8e08a', second: '#e8ffd8' },
  'sing': { kind: 'status', color: '#ffb0d8', second: '#ffe8f4' },
  'lovely-kiss': { kind: 'status', color: '#ff9ad0', second: '#ffe0f0' },
  'yawn': { kind: 'status', color: '#a8c0ff', second: '#e0e8ff' },
  'glare': { kind: 'status', color: '#ffe08a', second: '#fffbe0' },
  'confuse-ray': { kind: 'status', color: '#c08cff', second: '#e8d8ff' },
  'swagger': { kind: 'status', color: '#ff9aa8', second: '#ffe0e0' },
  'leech-seed': { kind: 'status', color: '#8fd06a', second: '#e0ffd0', shape: 'seed' },
  'protect': { kind: 'shield', color: '#8fd8ff', second: '#ffffff' },
  'dynamax-cannon': { kind: 'beam', color: '#ff6bd6', second: '#ffe0ff', big: true },
  'judgment': { kind: 'beam', color: '#ffe08a', second: '#ffffff', big: true },
  'hyper-voice': { kind: 'wave', color: '#ffe0a8', second: '#ffffff' },
  'earthquake2': { kind: 'quake', color: '#d8a86a', second: '#f5e0c0' }
};

export function getFxSpec(move) {
  const t = move.t;
  const color = C[t] || '#ffffff';
  const spec = FX_TABLE[move.en];
  if (spec) return { color, second: '#ffffff', ...spec };
  // 기본값: 타입·분류 기반 추론
  const base = { color, second: '#ffffff' };
  if (move.c === '변화') return { ...base, kind: 'buff' };
  if (move.p >= 120) return { ...base, kind: 'beam', big: true };
  if (move.c === '물리') return { ...base, kind: 'rush' };
  if (t === '불꽃') return { ...base, kind: 'stream' };
  if (t === '물') return { ...base, kind: 'projectile' };
  if (t === '전기') return { ...base, kind: 'bolt' };
  if (t === '얼음') return { ...base, kind: 'beam' };
  if (t === '풀') return { ...base, kind: 'volley', shape: 'leaf' };
  if (t === '땅' || t === '바위') return { ...base, kind: 'drop', shape: 'rock' };
  if (t === '에스퍼') return { ...base, kind: 'wave' };
  if (t === '고스트') return { ...base, kind: 'projectile', shape: 'shadow' };
  return { ...base, kind: 'projectile' };
}

/* ====================================================================== */
export class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.systems = [];
    this.running = false;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = 0; this.h = 0;
    this.last = 0;
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width || 800; this.h = r.height || 450;
    this.s = Math.max(0.45, Math.min(1.15, Math.min(this.w, this.h) / 620));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  clear() { this.parts.length = 0; this.systems.length = 0; }
  _loop(ts) {
    const dt = Math.min(50, ts - (this.last || ts));
    this.last = ts;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const s of this.systems.slice()) s.update(dt, this);
    this.systems = this.systems.filter((s) => !s.dead);
    for (const p of this.parts) {
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += (p.grav || 0) * dt * 0.06;
      p.vx *= p.drag ?? 0.985;
      p.vy *= p.drag ?? 0.985;
      p.life -= dt;
      p.rot += (p.vr || 0) * dt * 0.06;
      if (p.life <= 0) continue;
      this.drawParticle(ctx, p);
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    requestAnimationFrame(this._loop);
  }
  drawParticle(ctx, p) {
    const a = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.save();
    ctx.globalAlpha = a * (p.alpha ?? 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot || 0);
    const col = p.color;
    switch (p.type) {
      case 'spark': {
        ctx.strokeStyle = col; ctx.lineWidth = p.size * 0.6; ctx.lineCap = 'round';
        ctx.shadowColor = col; ctx.shadowBlur = 10 * a;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 1.6, -p.vy * 1.6); ctx.stroke();
        break;
      }
      case 'shard': {
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8 * a;
        ctx.beginPath(); ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.6, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.6, 0); ctx.closePath(); ctx.fill();
        break;
      }
      case 'leaf': {
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6 * a;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'petal': {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.6, 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ring': {
        ctx.strokeStyle = col; ctx.lineWidth = p.size * 0.35; ctx.shadowColor = col; ctx.shadowBlur = 14 * a;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (1.6 - a), 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'orb': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.shadowColor = col; ctx.shadowBlur = 20 * a;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'rock': {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(-p.size, p.size * 0.5); ctx.lineTo(-p.size * 0.4, -p.size); ctx.lineTo(p.size * 0.6, -p.size * 0.7); ctx.lineTo(p.size, p.size * 0.4); ctx.lineTo(0, p.size); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.4; ctx.stroke();
        break;
      }
      case 'flame': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 1.6);
        g.addColorStop(0, '#fff8d0'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, p.size * 1.5, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'water': {
        ctx.fillStyle = col; ctx.globalAlpha = a * 0.85;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.7, p.rot, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = a * 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-p.size * 0.3, -p.size * 0.2, p.size * 0.3, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'star': {
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12 * a;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const ang = (Math.PI / 5) * i - Math.PI / 2;
          const r = i % 2 ? p.size * 0.45 : p.size;
          ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'smoke': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size * 1.8);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(80,80,80,0)');
        ctx.globalAlpha = a * 0.35; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, p.size * 1.8, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'line': {
        ctx.strokeStyle = col; ctx.lineWidth = p.size; ctx.lineCap = 'round'; ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * 2.2, -p.vy * 2.2); ctx.stroke();
        break;
      }
      case 'dot':
      default: {
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8 * a;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ---------- 파티클 헬퍼 ---------- */
  spawn(o) {
    const life = o.life ?? 600;
    this.parts.push({ life, maxLife: life, rot: o.rot ?? rnd(6.28), vr: o.vr ?? rnd(0.3, -0.3), grav: o.grav ?? 0, drag: o.drag ?? 0.98, alpha: o.alpha ?? 1, type: o.type || 'dot', size: (o.size ?? 4) * this.s, color: o.color || '#fff', x: o.x, y: o.y, vx: o.vx ?? 0, vy: o.vy ?? 0 });
  }
  burst(x, y, spec, n = 24, opts = {}) {
    const shapes = ['spark', 'shard', 'dot', 'orb'];
    for (let i = 0; i < n; i++) {
      const ang = opts.angle !== undefined ? opts.angle + rnd(1.1, -1.1) : rnd(Math.PI * 2);
      const sp = rnd(opts.speed ?? 9, 1.5);
      const type = opts.shape || pick(shapes);
      this.spawn({
        x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (opts.lift ?? 0),
        life: rnd(opts.life ?? 700, 300), size: rnd(opts.size ?? 7, 2.5),
        color: Math.random() < 0.4 ? spec.second : spec.color, type,
        grav: opts.grav ?? 0.06, drag: opts.drag ?? 0.965
      });
    }
    this.spawn({ x, y, size: (opts.ring ?? 22) * this.s, color: spec.color, type: 'ring', life: 420, maxLife: 420, vx: 0, vy: 0 });
    this.spawn({ x, y, size: (opts.ring ?? 26) * 1.9 * this.s, color: spec.second, type: 'ring', life: 620, maxLife: 620, vx: 0, vy: 0 });
    if (opts.flash !== false) this.spawn({ x, y, size: (opts.glow ?? 24) * this.s, color: spec.second, type: 'orb', life: 190, maxLife: 190, alpha: 0.8 });
    // 속도선
    for (let i = 0; i < 7; i++) {
      const ang = rnd(Math.PI * 2);
      this.spawn({ x: x + Math.cos(ang) * 8, y: y + Math.sin(ang) * 8, vx: Math.cos(ang) * rnd(16, 9), vy: Math.sin(ang) * rnd(16, 9), life: 220, size: rnd(5, 2), color: '#ffffff', type: 'line', drag: 0.9 });
    }
  }
  trail(x, y, spec, kind) {
    const col = Math.random() < 0.5 ? spec.color : spec.second;
    if (kind === 'flame') this.spawn({ x, y, vx: rnd(1, -1), vy: rnd(0.4, -1.4), life: 340, size: rnd(9, 4), color: col, type: 'flame' });
    else if (kind === 'water') this.spawn({ x, y, vx: rnd(0.6, -0.6), vy: rnd(1.4, -0.4), life: 300, size: rnd(6, 2.5), color: col, type: 'water' });
    else if (kind === 'ice') this.spawn({ x, y, vx: rnd(1, -1), vy: rnd(1, -1), life: 380, size: rnd(6, 2), color: col, type: 'shard' });
    else if (kind === 'spark') this.spawn({ x, y, vx: rnd(3, -3), vy: rnd(3, -3), life: 200, size: rnd(8, 3), color: col, type: 'spark' });
    else if (kind === 'wind') this.spawn({ x, y, vx: rnd(2, -2), vy: rnd(2, -2), life: 320, size: rnd(10, 4), color: col, type: 'line' });
    else this.spawn({ x, y, vx: rnd(0.8, -0.8), vy: rnd(0.8, -0.8), life: 300, size: rnd(5, 1.5), color: col, type: 'dot' });
  }

  /* ---------- 메인 재생 ---------- */
  async cast(move, from, to, hooks = {}) {
    const spec = getFxSpec(move);
    const speed = () => hooks.speed?.() || 3;
    const wait = (ms) => new Promise((res) => setTimeout(res, Math.max(16, ms / speed())));
    const dir = Math.sign(to.x - from.x) || 1;
    const impact = { x: to.x, y: to.y };
    const self = { x: from.x, y: from.y };
    const call = (fn, ...a) => { try { fn && fn(...a); } catch (e) { console.error(e); } };

    const impactBurst = (hits = 1) => {
      for (let i = 0; i < hits; i++) {
        setTimeout(() => {
          this.burst(impact.x, impact.y, spec, spec.big ? 34 : 22, { speed: spec.big ? 13 : 9, lift: 1.2 });
          call(hooks.onImpact);
        }, i * 70 / speed());
      }
    };

    switch (spec.kind) {
      case 'beam': {
        if (spec.charge !== false) {
          call(hooks.onWindup);
          const ox = self.x + dir * 30, oy = self.y - 12;
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2;
            const r0 = 90 + Math.random() * 60;
            this.spawn({ x: ox + Math.cos(a) * r0, y: oy + Math.sin(a) * r0, vx: -Math.cos(a) * 5.2, vy: -Math.sin(a) * 5.2, life: 560, size: 3.8, color: spec.second, type: 'dot' });
          }
          const chargeSys = { t: 0, dead: false, update: (dt, fx) => {
            chargeSys.t += dt;
            const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const r = 26 + Math.sin(chargeSys.t * 0.02) * 5;
            const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 2.4);
            g.addColorStop(0, '#fff'); g.addColorStop(0.3, spec.color); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r * 2.4, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = rgba(spec.second, 0.7); ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(ox, oy, r * (1.2 + (chargeSys.t % 400) / 400), 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            if (Math.random() < 0.9) fx.spawn({ x: ox + rnd(40, -40), y: oy + rnd(40, -40), vx: rnd(2, -2), vy: rnd(2, -2), life: 380, size: rnd(6, 2), color: spec.color, type: 'spark' });
            if (chargeSys.t > 420) chargeSys.dead = true;
          } };
          this.systems.push(chargeSys);
          await wait(380);
          call(hooks.onCharge);
        }
        call(hooks.onFire);
        const beamSys = { t: 0, dead: false, update: (dt, fx) => {
          beamSys.t += dt;
          const T = beamSys.t;
          const a = Math.min(1, T / 70) * (T > 640 ? Math.max(0, 1 - (T - 640) / 220) : 1);
          const x1 = self.x + dir * 26, y1 = self.y - 8, x2 = impact.x, y2 = impact.y;
          drawBeam(fx.ctx, spec, x1, y1, x2, y2, T, a, fx.s || 1);
          for (let i = 0; i < 4; i++) {
            const p = Math.random();
            const nx = -(y2 - y1), ny = (x2 - x1);
            const nl = Math.hypot(nx, ny) || 1;
            const spread = (spec.big ? 26 : 18) * (0.3 + p);
            const off = rnd(spread, -spread);
            fx.spawn({ x: lerp(x1, x2, p) + (nx / nl) * off, y: lerp(y1, y2, p) + (ny / nl) * off, vx: dir * rnd(5, 1), vy: rnd(4, -4), life: 380, size: rnd(7, 2), color: Math.random() < 0.35 ? spec.second : spec.color, type: 'spark' });
          }
          if (T > 860) beamSys.dead = true;
        } };
        this.systems.push(beamSys);
        await wait(360);
        impactBurst(1);
        this.burst(impact.x, impact.y, spec, spec.big ? 26 : 16, { speed: 13, shape: 'spark' });
        this.spawn({ x: impact.x, y: impact.y, size: spec.big ? 70 : 48, color: spec.second, type: 'ring', life: 520 });
        await wait(500);
        break;
      }
      case 'stream': {
        call(hooks.onWindup);
        await wait(170);
        call(hooks.onFire);
        const dur = spec.power ? 700 : 820;
        const water = spec.shape === 'water';
        const fire = !water;
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt;
          const T = sys.t;
          const life = T > dur * 0.8 ? Math.max(0, 1 - (T - dur * 0.8) / (dur * 0.2)) : 1;
          const ctx = fx.ctx;
          const x1 = self.x + dir * 30, y1 = self.y - 6;
          // 노즐 화염
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = life;
          const fg = ctx.createRadialGradient(x1, y1, 0, x1, y1, 46 * (fx.s || 1));
          fg.addColorStop(0, '#fff'); fg.addColorStop(0.3, spec.color); fg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x1, y1, 46 * (fx.s || 1), 0, Math.PI * 2); ctx.fill();
          // 줄기(부채꼴)
          for (let i = 0; i < 2; i++) {
            const spread = Math.sin(T * 0.02 + i * 2.1) * (spec.power ? 30 : 22);
            const g = ctx.createLinearGradient(x1, y1, impact.x, impact.y + spread);
            g.addColorStop(0, rgba(spec.second, 0.7));
            g.addColorStop(0.45, rgba(spec.color, 0.32));
            g.addColorStop(1, rgba(spec.color, 0.02));
            ctx.strokeStyle = g; ctx.lineWidth = ((spec.power ? 30 : 22) - i * 8) * (fx.s || 1); ctx.lineCap = 'round';
            ctx.shadowColor = spec.color; ctx.shadowBlur = 34;
            ctx.beginPath(); ctx.moveTo(x1, y1);
            const mx = lerp(x1, impact.x, 0.5);
            ctx.quadraticCurveTo(mx, y1 + spread, impact.x, impact.y + spread * 0.7);
            ctx.stroke();
          }
          ctx.restore();
          // 파티클 다발
          const n = fire ? 13 : 11;
          for (let i = 0; i < n; i++) {
            const p = Math.random();
            const spread = (spec.power ? 120 : 90) * p;
            const off = rnd(spread, -spread);
            const px = lerp(x1, impact.x, p), py = lerp(y1, impact.y, p) + off + Math.sin(T * 0.03 + i) * 4;
            if (fire) fx.spawn({ x: px, y: py, vx: dir * rnd(8, 2), vy: rnd(3.2, -3.2) + off * 0.03, life: rnd(560, 260), size: rnd(17, 7) * (1 - p * 0.25), color: Math.random() < 0.3 ? spec.second : spec.color, type: 'flame', grav: -0.03 });
            else fx.spawn({ x: px, y: py, vx: dir * rnd(8, 3), vy: rnd(3, -1.5), life: rnd(460, 240), size: rnd(8, 3), color: Math.random() < 0.35 ? '#ffffff' : spec.color, type: 'water', grav: 0.14 });
          }
          if (Math.random() < 0.35) fx.spawn({ x: impact.x + rnd(20, -20), y: impact.y + rnd(24, -24), vx: rnd(4, -4), vy: rnd(-2, -7), life: 620, size: rnd(20, 10), color: spec.color, type: 'smoke' });
          if (T > dur) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(dur * 0.5);
        impactBurst(3);
        if (water) this.burst(impact.x, impact.y, { ...spec, color: '#bfe8ff' }, 12, { speed: 8, shape: 'water' });
        await wait(dur * 0.5);
        break;
      }
      case 'bolt': {
        call(hooks.onWindup);
        await wait(230);
        call(hooks.onFire);
        const strikes = spec.big ? 5 : 2;
        for (let s = 0; s < strikes; s++) {
          const startX = spec.sky ? impact.x + rnd(50, -50) : self.x + dir * 26;
          const startY = spec.sky ? -40 : self.y - 10;
          const sys = { t: 0, dead: false, pts: buildBolt(startX, startY, impact.x, impact.y, spec.sky ? 13 : 6), update: (dt, fx) => {
            sys.t += dt;
            if (sys.t % 55 < 40) {
              const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
              // 바깥 광휘
              ctx.strokeStyle = rgba(spec.color, 0.35); ctx.lineWidth = 22; ctx.shadowColor = spec.color; ctx.shadowBlur = 40; ctx.lineJoin = 'round';
              ctx.beginPath(); sys.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
              // 본체
              ctx.strokeStyle = spec.color; ctx.lineWidth = 8; ctx.shadowBlur = 26;
              ctx.beginPath(); sys.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
              // 심
              ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.shadowBlur = 12;
              ctx.beginPath(); sys.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
              // 가지
              for (let b = 1; b < sys.pts.length - 1; b += 2) {
                if (Math.random() < 0.55) {
                  const p0 = sys.pts[b];
                  const ang = rnd(Math.PI * 2), len = rnd(60, 20);
                  ctx.strokeStyle = rgba(spec.second, 0.75); ctx.lineWidth = 2.2; ctx.shadowBlur = 14;
                  ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
                  ctx.lineTo(p0.x + Math.cos(ang) * len * 0.5 + rnd(10, -10), p0.y + Math.sin(ang) * len * 0.5);
                  ctx.lineTo(p0.x + Math.cos(ang) * len, p0.y + Math.sin(ang) * len);
                  ctx.stroke();
                }
              }
              ctx.restore();
              if (sys.t % 55 < 18) sys.pts = buildBolt(startX, startY, impact.x, impact.y, spec.sky ? 13 : 6);
            }
            if (sys.t > 330) sys.dead = true;
          } };
          this.systems.push(sys);
          if (s === 0) impactBurst(1);
          this.burst(impact.x, impact.y, spec, 20, { shape: 'spark', speed: 13 });
          await wait(120);
        }
        if (spec.sky && this.flash) this.flash('#fffbe0', 0.5);
        break;
      }
      case 'projectile': {
        call(hooks.onWindup);
        await wait(160);
        call(hooks.onFire);
        const px0 = self.x + dir * 20, py0 = self.y - 8;
        const sys = { t: 0, dead: false, x: px0, y: py0, update: (dt, fx) => {
          sys.t += dt;
          const p = Math.min(1, sys.t / 330);
          const ease = p * p * (3 - 2 * p);
          sys.x = lerp(px0, impact.x, ease);
          sys.y = lerp(py0, impact.y, ease) - Math.sin(p * Math.PI) * 26;
          const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(sys.x, sys.y, 0, sys.x, sys.y, spec.big ? 26 : 18);
          g.addColorStop(0, '#fff'); g.addColorStop(0.4, spec.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sys.x, sys.y, spec.big ? 26 : 18, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          for (let i = 0; i < 2; i++) fx.trail(sys.x + rnd(6, -6), sys.y + rnd(6, -6), spec, spec.shape === 'shadow' ? 'shadow' : 'default');
          if (p >= 1) { sys.dead = true; fx.burst(impact.x, impact.y, spec, spec.big ? 32 : 22, { speed: 12 }); }
        } };
        this.systems.push(sys);
        await wait(340);
        call(hooks.onImpact);
        await wait(280);
        break;
      }
      case 'volley': {
        call(hooks.onWindup);
        await wait(130);
        call(hooks.onFire);
        const n = spec.many || 5;
        const leaf = spec.shape === 'leaf' || spec.shape === 'petal';
        for (let i = 0; i < n; i++) {
          const p0x = self.x + dir * 16, p0y = self.y - 24 + rnd(40, -40);
          const target = { x: impact.x + rnd(36, -36), y: impact.y + rnd(34, -34) };
          setTimeout(() => {
            this._fly(p0x, p0y, target, spec, { spin: true, size: leaf ? 17 : 9 });
          }, (i * (leaf ? 70 : 90)) / speed());
        }
        if (leaf) {
          for (let i = 0; i < 10; i++) {
            this.spawn({ x: self.x + dir * rnd(30, 4), y: self.y + rnd(30, -30), vx: dir * rnd(7, 2), vy: rnd(3, -3), life: 600, size: 5, color: spec.color, type: 'leaf', vr: rnd(6, -6) });
          }
        }
        await wait(90 + n * 90 * 0.5);
        impactBurst(2);
        await wait(300 + n * 20);
        break;
      }
      case 'slash': {
        call(hooks.onWindup);
        await wait(150);
        call(hooks.onFire);
        const n = spec.slash === 'cross' ? 2 : spec.big ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const sys = { t: 0, dead: false, update: (dt, fx) => {
            sys.t += dt;
            const p = Math.min(1, sys.t / 300);
            const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const cx = impact.x, cy = impact.y;
            const ang = (spec.slash === 'whip' ? -0.5 : 0.7) + i * (spec.slash === 'cross' ? 1.4 : 0.5) + (spec.slash === 'wind' ? -0.9 : 0);
            const rad = 70 + p * 40;
            ctx.translate(cx, cy); ctx.rotate(ang);
            ctx.strokeStyle = spec.second; ctx.globalAlpha = Math.max(0, 1 - p) * 0.95;
            ctx.lineWidth = 12 * (1 - p * 0.6); ctx.shadowColor = spec.color; ctx.shadowBlur = 26; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(0, 0, rad, -0.9 + p * 1.6, 0.7 + p * 1.6); ctx.stroke();
            ctx.strokeStyle = spec.color; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(0, 0, rad, -0.85 + p * 1.6, 0.65 + p * 1.6); ctx.stroke();
            ctx.restore();
            if (sys.t % 40 < 20 && Math.random() < 0.7) fx.spawn({ x: cx + rnd(60, -60), y: cy + rnd(50, -50), vx: rnd(4, -4), vy: rnd(4, -4), life: 300, size: rnd(6, 2), color: spec.second, type: 'spark' });
            if (p >= 1) sys.dead = true;
          } };
          this.systems.push(sys);
          if (i === 0) { await wait(90); impactBurst(1); }
          await wait(120);
        }
        await wait(200);
        break;
      }
      case 'rush': {
        call(hooks.onWindup);
        const combos = spec.combo || 1;
        await wait(120);
        call(hooks.onFire);
        for (let c = 0; c < combos; c++) {
          call(hooks.onLunge, c, dir);
          const sys = { t: 0, dead: false, update: (dt, fx) => {
            sys.t += dt;
            const p = Math.min(1, sys.t / 220);
            const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const x = lerp(self.x, impact.x - dir * 60, p), y = lerp(self.y, impact.y, p) - Math.sin(p * Math.PI) * 34;
            const g = ctx.createRadialGradient(x, y, 0, x, y, 46);
            g.addColorStop(0, rgba(spec.second, 0.85)); g.addColorStop(0.5, rgba(spec.color, 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            for (let i = 0; i < 2; i++) fx.trail(x - dir * rnd(40, 5), y + rnd(26, -26), spec, spec.trail || 'default');
            if (p >= 1) sys.dead = true;
          } };
          this.systems.push(sys);
          await wait(150);
          impactBurst(1);
          this.burst(impact.x, impact.y, spec, spec.big ? 30 : 16, { shape: 'shard', speed: 10, ring: 30 });
          call(hooks.onBack);
          await wait(180);
        }
        break;
      }
      case 'drop': {
        call(hooks.onWindup);
        await wait(150);
        call(hooks.onFire);
        const n = spec.many || 4;
        for (let i = 0; i < n; i++) {
          const tx = impact.x + rnd(60, -60), ty = impact.y + rnd(40, -30);
          setTimeout(() => {
            const sys = { t: 0, dead: false, update: (dt, fx) => {
              sys.t += dt;
              const p = Math.min(1, sys.t / 420);
              const y = lerp(-40, ty, p * p);
              const ctx = fx.ctx;
              ctx.save(); ctx.translate(tx, y); ctx.rotate(p * 3);
              ctx.fillStyle = spec.color; ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2;
              if (spec.shape === 'spike') { ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(11, 18); ctx.lineTo(-11, 18); ctx.closePath(); }
              else { ctx.beginPath(); ctx.moveTo(-14, 8); ctx.lineTo(-6, -14); ctx.lineTo(9, -10); ctx.lineTo(15, 6); ctx.lineTo(0, 15); ctx.closePath(); }
              ctx.fill(); ctx.stroke();
              ctx.restore();
              if (p >= 1) {
                sys.dead = true;
                fx.burst(tx, ty, spec, 14, { speed: 7, shape: 'rock', grav: 0.12 });
                fx.spawn({ x: tx, y: ty, size: 26, color: spec.color, type: 'ring', life: 380 });
              }
            } };
            this.systems.push(sys);
          }, (i * 110) / speed());
        }
        await wait(300);
        impactBurst(1);
        await wait(400);
        break;
      }
      case 'quake': {
        call(hooks.onFire);
        call(hooks.onQuake);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt;
          const T = sys.t; const ctx = fx.ctx;
          const gY = fx.h * 0.9;
          // 지면 충격파
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 3; k++) {
            const p = Math.max(0, Math.min(1, (T - k * 120) / 800));
            if (p <= 0) continue;
            ctx.strokeStyle = rgba(spec.color, (1 - p) * 0.55);
            ctx.lineWidth = 8 * (1 - p) + 1;
            ctx.beginPath(); ctx.ellipse(impact.x, gY, (40 + p * 280) * (fx.s || 1), (14 + p * 80) * (fx.s || 1), 0, 0, Math.PI * 2); ctx.stroke();
          }
          if (!sys.cracks) {
            sys.cracks = [];
            for (let i = 0; i < 9; i++) {
              const sx = fx.w * rnd(0.92, 0.08);
              const pts = [{ x: sx, y: gY }];
              let cx = sx, cy = gY;
              for (let k = 0; k < 5; k++) { cx += rnd(60, -60); cy -= rnd(38, 10); pts.push({ x: cx, y: cy }); }
              sys.cracks.push({ pts, w: rnd(6, 3) });
            }
          }
          sys.cracks.forEach((c2) => {
            ctx.strokeStyle = rgba(spec.color, Math.max(0, 0.85 - T / 1400));
            ctx.lineWidth = c2.w; ctx.shadowColor = spec.color; ctx.shadowBlur = 14; ctx.lineCap = 'round';
            ctx.beginPath(); c2.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = c2.w * 0.5; ctx.shadowBlur = 0;
            ctx.beginPath(); c2.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
          });
          ctx.restore();
          // 바위 파편
          if (Math.random() < 0.9) fx.spawn({ x: rnd(fx.w), y: gY - rnd(10, 0), vx: rnd(4, -4), vy: rnd(-6, -14), life: 900, size: rnd(13, 5), color: spec.color, type: 'rock', grav: 0.28, rot: rnd(6), vr: rnd(4, -4) });
          // 먼지
          if (Math.random() < 0.7) fx.spawn({ x: rnd(fx.w), y: gY - rnd(30, 0), vx: rnd(2, -2), vy: rnd(-1, -4), life: 1100, size: rnd(40, 16), color: 'rgba(190,170,140,.5)', type: 'smoke' });
          if (T > 1000) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(180);
        impactBurst(1);
        await wait(650);
        break;
      }
      case 'wave': {
        call(hooks.onWindup);
        await wait(140);
        call(hooks.onFire);
        for (let i = 0; i < 3; i++) {
          const sys = { t: 0, dead: false, i, update: (dt, fx) => {
            sys.t += dt;
            const p = Math.min(1, (sys.t - sys.i * 90) / 520);
            if (p <= 0) return;
            const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
            ctx.translate(impact.x, impact.y);
            ctx.scale(1, 0.72);
            for (let k = 0; k < 2; k++) {
              ctx.strokeStyle = k ? spec.second : spec.color;
              ctx.globalAlpha = Math.max(0, 1 - p) * (k ? 0.9 : 0.7);
              ctx.lineWidth = (spec.big ? 16 : 11) * (1 - p * 0.7) * (fx.s || 1);
              ctx.shadowColor = spec.color; ctx.shadowBlur = 24;
              ctx.beginPath(); ctx.arc(0, 0, (18 + p * (spec.big ? 220 : 150)) * (fx.s || 1), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
            if (Math.random() < 0.5) fx.spawn({ x: impact.x + rnd(60, -60), y: impact.y + rnd(50, -50), vx: rnd(3, -3), vy: rnd(3, -3), life: 400, size: rnd(7, 2), color: spec.second, type: 'spark' });
            if (p >= 1) sys.dead = true;
          } };
          this.systems.push(sys);
        }
        await wait(120);
        impactBurst(1);
        await wait(440);
        break;
      }
      case 'burst': {
        call(hooks.onWindup);
        await wait(180);
        call(hooks.onFire);
        this.burst(impact.x, impact.y, spec, spec.big ? 44 : 30, { speed: spec.big ? 15 : 11, lift: 1, ring: spec.big ? 40 : 28 });
        call(hooks.onImpact);
        await wait(160);
        this.burst(impact.x, impact.y, spec, spec.big ? 26 : 16, { speed: 8, size: 5 });
        this.spawn({ x: impact.x, y: impact.y, size: spec.big ? 90 : 60, color: spec.second, type: 'ring', life: 600 });
        await wait(420);
        break;
      }
      case 'pillar': {
        call(hooks.onWindup);
        await wait(220);
        call(hooks.onFire);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt;
          const p = Math.min(1, sys.t / 760);
          const T = sys.t;
          const sc = fx.s || 1;
          const ctx = fx.ctx;
          const bx = impact.x, by = fx.h * 0.92;
          const wBase = (spec.big ? 110 : 80) * sc * (0.35 + p * 0.85);
          const topY = by - (spec.big ? 380 : 280) * sc;
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 3; k++) {
            const wob = Math.sin(T * 0.012 + k * 2.1) * 10 * sc;
            const w = wBase * (1 - k * 0.22);
            const a = (k === 0 ? 0.16 : k === 1 ? 0.3 : 0.55) * (1 - p * 0.85);
            const g = ctx.createLinearGradient(0, topY, 0, by);
            g.addColorStop(0, rgba(spec.color, 0));
            g.addColorStop(0.35, rgba(spec.color, a * 0.7));
            g.addColorStop(0.85, rgba(spec.second, a));
            g.addColorStop(1, rgba(spec.second, a * 0.6));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(bx - w * 0.35 + wob, topY);
            ctx.quadraticCurveTo(bx - w * 0.9, (topY + by) / 2, bx - w, by);
            ctx.lineTo(bx + w, by);
            ctx.quadraticCurveTo(bx + w * 0.9, (topY + by) / 2, bx + w * 0.35 + wob, topY);
            ctx.closePath();
            ctx.fill();
          }
          // 기저 폭발
          const bg = ctx.createRadialGradient(bx, by, 0, bx, by, (spec.big ? 150 : 110) * sc);
          bg.addColorStop(0, rgba(spec.second, 0.8 * (1 - p)));
          bg.addColorStop(0.4, rgba(spec.color, 0.35 * (1 - p)));
          bg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.ellipse(bx, by, (spec.big ? 150 : 110) * sc, (spec.big ? 46 : 34) * sc, 0, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          // 불티 상승
          for (let i = 0; i < 4; i++) {
            fx.spawn({ x: bx + rnd(wBase * 0.8, -wBase * 0.8), y: by - rnd(40, 0), vx: rnd(2, -2), vy: rnd(-5, -13), life: rnd(900, 400), size: rnd(14, 4) * sc, color: Math.random() < 0.4 ? spec.second : spec.color, type: 'flame', grav: -0.04 });
          }
          if (T > 760) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(200);
        impactBurst(2);
        this.burst(impact.x, this.h * 0.9, spec, spec.big ? 30 : 20, { speed: 12, shape: 'spark', ring: 40 });
        await wait(520);
        break;
      }
      case 'storm': {
        call(hooks.onWindup);
        await wait(160);
        call(hooks.onFire);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt;
          const p = Math.min(1, sys.t / 1200);
          const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
          // 소용돌이
          for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = rgba(i % 2 ? spec.second : spec.color, 0.35 * (1 - p));
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let k = 0; k <= 30; k++) {
              const tt = k / 30;
              const ang = tt * 7 + sys.t * 0.006 + i;
              const r = 20 + tt * 120 * (1 - p * 0.4);
              const x = impact.x + Math.cos(ang) * r;
              const y = impact.y + Math.sin(ang) * r * 0.8 - tt * 40 + p * 30;
              k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
          }
          ctx.restore();
          if (Math.random() < 0.9) fx.spawn({ x: impact.x + rnd(130, -130), y: impact.y + rnd(100, -100), vx: rnd(4, -4), vy: rnd(-2, -7), life: 600, size: rnd(7, 2), color: Math.random() < .5 ? spec.color : spec.second, type: spec.shape === 'snow' ? 'shard' : 'spark', vr: rnd(4, -4) });
          if (p >= 1) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(200);
        impactBurst(2);
        await wait(700);
        break;
      }
      case 'drain': {
        call(hooks.onWindup);
        await wait(160);
        call(hooks.onFire);
        this.burst(impact.x, impact.y, spec, 18, { speed: 8 });
        call(hooks.onImpact);
        for (let i = 0; i < 34; i++) {
          setTimeout(() => {
            this._homing(impact.x + rnd(50, -50), impact.y + rnd(40, -40), self.x, self.y, spec);
          }, (i * 26) / speed());
        }
        await wait(700);
        break;
      }
      case 'buff': {
        call(hooks.onWindup);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt;
          const p = Math.min(1, sys.t / 900);
          const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) {
            const r = 30 + p * 90 + i * 16;
            ctx.strokeStyle = rgba(i % 2 ? spec.second : spec.color, (1 - p) * 0.7);
            ctx.lineWidth = 3; ctx.shadowColor = spec.color; ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.ellipse(self.x, self.y + 40 - p * 70, r, r * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
          }
          ctx.restore();
          if (Math.random() < 0.55) fx.spawn({ x: self.x + rnd(54, -54), y: self.y + rnd(40, -20), vx: rnd(0.8, -0.8), vy: rnd(-3.4, -1.2), life: 700, size: rnd(6, 2), color: spec.color, type: 'star', vr: rnd(3, -3) });
          if (spec.blades && Math.random() < 0.35) fx.spawn({ x: self.x + rnd(40, -40), y: self.y, vx: rnd(1, -1), vy: rnd(-6, -2), life: 500, size: rnd(14, 7), color: spec.second, type: 'line' });
          if (p >= 1) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(760);
        break;
      }
      case 'heal': {
        call(hooks.onWindup);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt; const p = Math.min(1, sys.t / 1100);
          if (Math.random() < 0.8) fx.spawn({ x: self.x + rnd(60, -60), y: self.y + rnd(50, -10), vx: rnd(1, -1), vy: rnd(-4.5, -1.5), life: 800, size: rnd(7, 2.5), color: Math.random() < .5 ? spec.color : spec.second, type: Math.random() < .5 ? 'star' : 'dot', vr: rnd(3, -3) });
          const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = (1 - p) * 0.5;
          const g = ctx.createRadialGradient(self.x, self.y, 0, self.x, self.y, 110);
          g.addColorStop(0, rgba(spec.color, 0.5)); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(self.x, self.y, 110, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          if (p >= 1) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(900);
        break;
      }
      case 'status': {
        call(hooks.onWindup);
        await wait(180);
        call(hooks.onFire);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt; const p = Math.min(1, sys.t / 900);
          const cx = lerp(self.x, impact.x, Math.min(1, p * 1.4));
          const cy = lerp(self.y, impact.y, Math.min(1, p * 1.4)) - Math.sin(p * Math.PI) * 30;
          if (Math.random() < 0.95) fx.spawn({ x: cx + rnd(40, -40), y: cy + rnd(30, -30), vx: rnd(1.6, -1.6), vy: rnd(1.6, -1.6), life: 700, size: rnd(8, 3), color: Math.random() < .5 ? spec.color : spec.second, type: spec.shape === 'powder' ? 'dot' : 'orb' });
          if (p >= 1) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(520);
        call(hooks.onImpact);
        this.burst(impact.x, impact.y, spec, 12, { speed: 4, life: 900 });
        await wait(380);
        break;
      }
      case 'shadow': {
        call(hooks.onWindup);
        await wait(200);
        call(hooks.onFire);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt; const p = Math.min(1, sys.t / 800);
          const ctx = fx.ctx; ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = rgba(i % 2 ? spec.second : spec.color, (1 - p) * 0.6);
            ctx.lineWidth = 6 + Math.sin(sys.t * 0.01 + i) * 3;
            ctx.shadowColor = spec.color; ctx.shadowBlur = 20;
            ctx.beginPath();
            const sx = self.x + (i - 2) * 14, sy = self.y + 30;
            ctx.moveTo(sx, sy);
            ctx.bezierCurveTo(sx + 40, sy - 60, impact.x - 50, impact.y - 70, impact.x + (i - 2) * 12, impact.y);
            ctx.stroke();
          }
          ctx.restore();
          if (Math.random() < 0.7) fx.spawn({ x: impact.x + rnd(60, -60), y: impact.y + rnd(50, -50), vx: rnd(2, -2), vy: rnd(-2, -6), life: 600, size: rnd(9, 3), color: spec.color, type: 'smoke' });
          if (p >= 1) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(400);
        impactBurst(1);
        await wait(400);
        break;
      }
      case 'bite': {
        call(hooks.onWindup);
        await wait(120);
        call(hooks.onFire);
        this._lungeJaws(impact, spec);
        impactBurst(2);
        await wait(400);
        break;
      }
      case 'meteor': {
        call(hooks.onWindup);
        await wait(260);
        call(hooks.onFire);
        const n = spec.many || 1;
        for (let i = 0; i < n; i++) {
          setTimeout(() => {
            const tx = impact.x + rnd(60, -60);
            const sys = { t: 0, dead: false, update: (dt, fx) => {
              sys.t += dt; const p = Math.min(1, sys.t / 460);
              const x = lerp(fx.w * 0.8, tx, p), y = lerp(-60, impact.y, p * p);
              const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
              const g = ctx.createRadialGradient(x, y, 0, x, y, 30);
              g.addColorStop(0, '#fff'); g.addColorStop(0.4, spec.color); g.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
              for (let k = 0; k < 2; k++) {
                fx.spawn({ x: x + rnd(6, -6), y: y + rnd(6, -6), vx: rnd(2, -2), vy: rnd(3, -1), life: rnd(300, 160), size: rnd(8, 3), color: Math.random() < .5 ? spec.color : spec.second, type: 'flame' });
              }
              if (Math.random() < 0.7) fx.spawn({ x, y, vx: rnd(3, -3), vy: rnd(3, -3), life: 220, size: rnd(8, 3), color: spec.second, type: 'spark' });
              if (p >= 1) { sys.dead = true; fx.burst(tx, impact.y, spec, 20, { speed: 11 }); fx.spawn({ x: tx, y: impact.y, size: 44, color: spec.second, type: 'ring', life: 460 }); }
            } };
            this.systems.push(sys);
          }, (i * 140) / speed());
        }
        await wait(400);
        call(hooks.onImpact);
        await wait(500);
        break;
      }
      case 'cage': {
        call(hooks.onWindup);
        await wait(140);
        call(hooks.onFire);
        const sys = { t: 0, dead: false, update: (dt, fx) => {
          sys.t += dt; const p = Math.min(1, sys.t / 900);
          const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1 - p;
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + sys.t * 0.002;
            const r = 60;
            const x = impact.x + Math.cos(ang) * r, y = impact.y + Math.sin(ang) * r * 0.7;
            ctx.strokeStyle = spec.color; ctx.lineWidth = 3; ctx.shadowColor = spec.color; ctx.shadowBlur = 16;
            ctx.beginPath(); ctx.moveTo(x, y - 70); ctx.lineTo(x + rnd(6, -6), y + 70); ctx.stroke();
          }
          ctx.restore();
          if (Math.random() < 0.6) fx.spawn({ x: impact.x + rnd(60, -60), y: impact.y + rnd(50, -50), vx: 0, vy: 0, life: 220, size: rnd(7, 3), color: spec.color, type: 'spark' });
          if (p >= 1) sys.dead = true;
        } };
        this.systems.push(sys);
        await wait(300);
        impactBurst(1);
        await wait(400);
        break;
      }
      case 'shield': {
        this.spawn({ x: self.x, y: self.y, size: 90, color: spec.color, type: 'ring', life: 900 });
        this.spawn({ x: self.x, y: self.y, size: 70, color: spec.second, type: 'ring', life: 900 });
        await wait(600);
        break;
      }
      default: {
        call(hooks.onFire);
        this.burst(impact.x, impact.y, spec, 20);
        call(hooks.onImpact);
        await wait(400);
      }
    }
  }

  _fly(x, y, to, spec, opts = {}) {
    const shapeType = { leaf: 'leaf', petal: 'petal', shard2: 'shard', ice: 'shard', rock: 'rock', seed: 'orb', shuriken: 'shard', star: 'star', bone: 'line', scale: 'shard', arrow: 'line', dot: 'dot' }[spec.shape] || 'orb';
    const start = { x, y };
    const sys = { t: 0, dead: false, update: (dt, fx) => {
      sys.t += dt;
      const p = Math.min(1, sys.t / 380);
      const cx = lerp(start.x, to.x, p), cy = lerp(start.y, to.y, p) - Math.sin(p * Math.PI) * 40;
      const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.translate(cx, cy); ctx.rotate(sys.t * 0.02);
      ctx.fillStyle = spec.color; ctx.shadowColor = spec.color; ctx.shadowBlur = 14;
      const s = opts.size || 8;
      if (shapeType === 'leaf' || shapeType === 'petal') { ctx.beginPath(); ctx.ellipse(0, 0, s * 1.5, s * 0.6, 0.6, 0, Math.PI * 2); ctx.fill(); }
      else if (shapeType === 'shard') { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); ctx.fill(); }
      else if (shapeType === 'rock') { ctx.beginPath(); ctx.moveTo(-s, s * .6); ctx.lineTo(-s * .4, -s); ctx.lineTo(s * .7, -s * .6); ctx.lineTo(s, s * .6); ctx.closePath(); ctx.fill(); }
      else if (shapeType === 'star') { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = (Math.PI / 5) * i - Math.PI / 2; const r = i % 2 ? s * 0.5 : s; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }
      else { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s); g.addColorStop(0, '#fff'); g.addColorStop(0.5, spec.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      if (Math.random() < 0.6) fx.spawn({ x: cx, y: cy, vx: rnd(1, -1), vy: rnd(1, -1), life: 260, size: rnd(5, 1.5), color: spec.color, type: 'dot' });
      if (p >= 1) { sys.dead = true; fx.burst(to.x, to.y, spec, 8, { speed: 6, life: 420 }); }
    } };
    this.systems.push(sys);
  }
  _homing(x, y, tx, ty, spec) {
    const sys = { t: 0, dead: false, update: (dt, fx) => {
      sys.t += dt; const p = Math.min(1, sys.t / 520);
      const e = p * p;
      const cx = lerp(x, tx, e), cy = lerp(y, ty, e) - Math.sin(p * Math.PI) * 50;
      const ctx = fx.ctx; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 9);
      g.addColorStop(0, '#fff'); g.addColorStop(0.5, spec.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (p >= 1) { sys.dead = true; fx.spawn({ x: tx, y: ty, size: 16, color: spec.second, type: 'ring', life: 300 }); }
    } };
    this.systems.push(sys);
  }
  _lungeJaws(pos, spec) {
    const sys = { t: 0, dead: false, update: (dt, fx) => {
      sys.t += dt; const p = Math.min(1, sys.t / 280);
      const ctx = fx.ctx; ctx.save(); ctx.translate(pos.x, pos.y);
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = spec.second; ctx.lineWidth = 6; ctx.shadowColor = spec.color; ctx.shadowBlur = 18;
      const open = 26 + Math.sin(p * Math.PI) * 26;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-46, s * open); ctx.lineTo(0, 0); ctx.lineTo(46, s * open);
        ctx.stroke();
        ctx.fillStyle = spec.color;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 22, s * open); ctx.lineTo(-34 + i * 22, s * (open + 14)); ctx.lineTo(-28 + i * 22, s * open); ctx.fill(); }
      }
      ctx.restore();
      if (p >= 1) sys.dead = true;
    } };
    this.systems.push(sys);
  }
}

/* ---------------- 그리기 도우미 ---------------- */
function drawBeam(ctx, spec, x1, y1, x2, y2, T, alpha, sc = 1) {
  const dx = x2 - x1, dy = y2 - y1;
  const ang = Math.atan2(dy, dx);
  const nx = -Math.sin(ang), ny = Math.cos(ang);
  const pulse = 0.9 + Math.sin(T * 0.045) * 0.1;
  const w0 = (spec.big ? 10 : 7) * sc;
  const w1 = (spec.big ? 34 : 24) * pulse * sc;
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, rgba(spec.second, 0.35));
  grad.addColorStop(0.3, rgba(spec.color, 0.8));
  grad.addColorStop(0.9, rgba(spec.second, 0.95));
  grad.addColorStop(1, rgba(spec.color, 1));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  const drawShape = (wScale, fill, blur, a, core) => {
    ctx.globalAlpha = alpha * a;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * w0 * wScale, y1 + ny * w0 * wScale);
    ctx.quadraticCurveTo(
      (x1 + x2) / 2 + nx * w1 * wScale * 0.62, (y1 + y2) / 2 + ny * w1 * wScale * 0.62,
      x2 + nx * w1 * wScale * 0.95, y2 + ny * w1 * wScale * 0.95);
    ctx.quadraticCurveTo(x2 + nx * w1 * wScale * 0.2 + Math.cos(ang) * w1 * 0.7, y2 + ny * w1 * wScale * 0.2 + Math.sin(ang) * w1 * 0.7, x2 - nx * w1 * wScale * 0.95, y2 - ny * w1 * wScale * 0.95);
    ctx.quadraticCurveTo(
      (x1 + x2) / 2 - nx * w1 * wScale * 0.62, (y1 + y2) / 2 - ny * w1 * wScale * 0.62,
      x1 - nx * w0 * wScale, y1 - ny * w0 * wScale);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.shadowColor = core ? spec.second : spec.color;
    ctx.shadowBlur = blur;
    ctx.fill();
  };
  drawShape(2.1, rgba(spec.color, 0.14), 60, 0.6, false);
  drawShape(1.2, grad, 36, 0.9, false);
  drawShape(0.32, 'rgba(255,255,255,.5)', 14, 0.8, true);
  drawShape(0.16, 'rgba(255,255,255,.75)', 8, 0.9, true);
  // 흐르는 에너지 필라멘트
  for (let f = 0; f < 3; f++) {
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = rgba(spec.second, 0.75);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const p = i / 12;
      const off = Math.sin(p * 7 + T * 0.02 + f * 2.1) * w1 * 0.55 * p;
      const x = lerp(x1, x2, p) + nx * off, y = lerp(y1, y2, p) + ny * off;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  // 끝단 임팩트 글로우
  const eg = ctx.createRadialGradient(x2, y2, 0, x2, y2, w1 * 1.5);
  eg.addColorStop(0, 'rgba(255,255,255,.55)');
  eg.addColorStop(0.35, rgba(spec.color, 0.35));
  eg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = eg;
  ctx.beginPath(); ctx.arc(x2, y2, w1 * 1.5, 0, Math.PI * 2); ctx.fill();
  // 에너지 링
  for (let i = 0; i < 4; i++) {
    const p = ((T * 0.0016) + i / 4) % 1;
    const px = lerp(x1, x2, p), py = lerp(y1, y2, p);
    const r = (spec.big ? 22 : 16) * Math.sin(p * Math.PI) + 5;
    ctx.save();
    ctx.translate(px, py); ctx.rotate(ang);
    ctx.strokeStyle = rgba(spec.second, 0.7 * (1 - p));
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.35, r, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function buildBolt(x1, y1, x2, y2, segs = 8) {
  const pts = [{ x: x1, y: y1 }];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const x = lerp(x1, x2, t) + rnd(26, -26);
    const y = lerp(y1, y2, t) + rnd(14, -14);
    pts.push({ x, y });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}
