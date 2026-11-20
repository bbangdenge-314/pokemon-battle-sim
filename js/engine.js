/* ============================================================================
   배틀 시뮬레이터 코어 엔진 (DOM 비의존 · 순수 로직)
   - Lv.50 · 개체값 31 · 노력치 0 기준 능력치 산출
   - 5세대 이후 데미지 공식 + 자속/상성/날씨/급소/화상 보정
   - 상태이상 · 랭크 변화 · 날씨 턴 데미지 · 교체 · AI 기술 선택
   - 배틀 전체를 '이벤트 시나리오'로 미리 시뮬레이션해 UI가 재생
   ========================================================================== */
import { DATA } from './data.js';

export const TYPE_COLORS = {
  노말: '#b7b7a4', 격투: '#d1584f', 비행: '#9d8fe0', 독: '#b45cb8', 땅: '#d8b25a',
  바위: '#bfa63e', 벌레: '#a3bd2f', 고스트: '#7b6ab0', 강철: '#9aa3b8', 불꽃: '#f4794a',
  물: '#4f9be8', 풀: '#63c25c', 전기: '#f3c93c', 에스퍼: '#f3649b', 얼음: '#6fd3d8',
  드래곤: '#6f5cf0', 악: '#7c6558', 페어리: '#ee8fb5'
};

export const WEATHERS = {
  clear:  { id: 'clear',  name: '맑음',     en: 'Clear',      icon: '☀️', desc: '특별한 보정 없음. 상쾌한 맑은 하늘.', tips: ['모든 기술 위력 100%'] },
  sun:    { id: 'sun',    name: '쾌청',     en: 'Harsh Sun',  icon: '🔥', desc: '햇빛이 쨍쨍 내리쬐어 불꽃 기술이 강화됩니다.', tips: ['불꽃 기술 ×1.5', '물 기술 ×0.5'] },
  rain:   { id: 'rain',   name: '비',       en: 'Rain',       icon: '🌧️', desc: '굵은 빗줄기가 내려 물 기술이 강해집니다.', tips: ['물 기술 ×1.5', '불꽃 기술 ×0.5'] },
  sand:   { id: 'sand',   name: '모래바람', en: 'Sandstorm',  icon: '🏜️', desc: '모래가 휘몰아쳐 바위 타입의 특수방어가 올라갑니다.', tips: ['바위 특방 ×1.5', '바위·땅·강철 외 매 턴 1/16 피해'] },
  hail:   { id: 'hail',   name: '싸라기눈', en: 'Hail',       icon: '❄️', desc: '차가운 눈보라가 몰아쳐 얼음 타입이 단단해집니다.', tips: ['얼음 방어 ×1.5', '얼음 외 매 턴 1/16 피해'] }
};

export const STAGE_META = {
  stadium:  { name: '포켓몬 스타디움', sub: '함성과 조명이 가득한 결전장', icon: '🏟️' },
  beach:    { name: '해변',           sub: '파도와 모래, 햇살 아래의 승부', icon: '🏖️' },
  rock:     { name: '바위산',         sub: '메마른 바위 협곡의 결투', icon: '⛰️' },
  snow:     { name: '설산',           sub: '눈보라 몰아치는 정상', icon: '🏔️' },
  forest:   { name: '숲',             sub: '빛이 새어드는 고요한 수림', icon: '🌲' },
  volcano:  { name: '화산',           sub: '용암이 끓는 대지', icon: '🌋' },
  city:     { name: '밤 도심',        sub: '네온이 번지는 옥상 결전', icon: '🌃' },
  space:    { name: '우주',           sub: '별이 쏟아지는 무중력 공간', icon: '🌌' },
  temple:   { name: '신전',           sub: '고대의 빛이 잠든 유적', icon: '🏛️' },
  cave:     { name: '수정 동굴',      sub: '일렁이는 결정 사이', icon: '💎' },
  desert:   { name: '사막',           sub: '끝없이 펼쳐진 모래 언덕', icon: '🏜️' }
};

/* ------------------------------------------------------------------ */
/* 능력치                                                              */
/* ------------------------------------------------------------------ */
/* 관전형 배틀 밸런스: 한 방에 끝나지 않도록 체력을 1.6배로 보정 */
export const HP_RULE = 1.6;
export function statsAt50(base) {
  const c = (b) => Math.floor((2 * b + 31) / 2);
  return {
    hp: Math.round((c(base[0]) + 60) * HP_RULE),
    atk: c(base[1]) + 5, def: c(base[2]) + 5, spa: c(base[3]) + 5, spd: c(base[4]) + 5, spe: c(base[5]) + 5
  };
}
export function monById(id) { return DATA.dex.find((d) => d.id === id); }
export function moveById(id) { return DATA.moves[String(id)]; }

const STAT_LABEL = { atk: '공격', def: '방어', spa: '특공', spd: '특방', spe: '스피드', acc: '명중', eva: '회피' };
const STAGE_MULT = [3 / 9, 3 / 8, 3 / 7, 3 / 6, 3 / 5, 3 / 4, 3 / 3, 4 / 3, 5 / 3, 6 / 3, 7 / 3, 8 / 3, 9 / 3];
const ACC_MULT = [3 / 9, 3 / 8, 3 / 7, 3 / 6, 3 / 5, 3 / 4, 3 / 3, 4 / 3, 5 / 3, 6 / 3, 7 / 3, 8 / 3, 9 / 3];
const stageMul = (s) => STAGE_MULT[Math.max(0, Math.min(12, s + 6))];

/* 기술별 부가 효과 테이블 -------------------------------------------- */
const E = (o) => o;
export const MOVE_EFFECTS = {
  // 화상
  flamethrower: E({ sec: ['burn', 10] }), 'fire-blast': E({ sec: ['burn', 10] }), 'heat-wave': E({ sec: ['burn', 10] }),
  ember: E({ sec: ['burn', 10] }), 'fire-punch': E({ sec: ['burn', 10] }), 'blaze-kick': E({ sec: ['burn', 10] }),
  'sacred-fire': E({ sec: ['burn', 50] }), 'flare-blitz': E({ sec: ['burn', 20], recoil: 1 / 3 }),
  'blue-flare': E({ sec: ['burn', 20] }), overheat: E({ self: { spa: -2 } }),
  // 마비
  thunderbolt: E({ sec: ['par', 10] }), thunder: E({ sec: ['par', 30], acc: 70 }), 'thunder-punch': E({ sec: ['par', 10] }),
  discharge: E({ sec: ['par', 30] }), lick: E({ sec: ['par', 30] }), 'body-slam': E({ sec: ['par', 30] }),
  'dragon-breath': E({ sec: ['par', 30] }), 'nuzzle': E({ sec: ['par', 100] }),
  'wild-charge': E({ recoil: 1 / 4 }), 'volt-tackle': E({ recoil: 1 / 3, sec: ['par', 10] }),
  // 얼음
  'ice-beam': E({ sec: ['frz', 10] }), blizzard: E({ sec: ['frz', 10], acc: 70 }), 'ice-punch': E({ sec: ['frz', 10] }),
  'ice-fang': E({ sec: ['frz', 10], sec2: ['flinch', 10] }), 'freeze-dry': E({ freezeDry: true }),
  // 풀
  'giga-drain': E({ drain: 1 / 2 }), 'drain-punch': E({ drain: 1 / 2 }), 'horn-leech': E({ drain: 1 / 2 }),
  'leech-life': E({ drain: 1 / 2 }), 'oblivion-wing': E({ drain: 3 / 4 }),
  'energy-ball': E({ sec: ['spd-', 10] }), 'seed-bomb': E(), 'bullet-seed': E({ hits: [2, 5] }),
  'solar-beam': E({ charge: true }), 'leaf-storm': E({ self: { spa: -2 } }),
  // 격투
  'close-combat': E({ self: { def: -1, spd: -1 } }), superpower: E({ self: { atk: -1, def: -1 } }),
  'focus-blast': E({ sec: ['spd-', 10], acc: 70 }), 'aura-sphere': E(), 'dynamic-punch': E({ sec: ['confuse', 100], acc: 50 }),
  'hammer-arm': E({ self: { spe: -1 } }), 'drain-punch2': E(),
  // 악
  crunch: E({ sec: ['def-', 20] }), 'dark-pulse': E({ sec: ['flinch', 20] }), sucker: E(),
  'night-slash': E({ critBoost: true }), 'knock-off': E(), 'foul-play': E(), 'beat-up2': E(),
  'night-daze': E({ acc: 95 }),
  // 고스트
  'shadow-ball': E({ sec: ['spd-', 20] }), 'shadow-claw': E({ critBoost: true }), 'shadow-sneak': E(),
  'shadow-force': E({ charge: true }), 'spirit-shackle': E(), 'phantom-force': E({ charge: true }),
  'moongeist-beam': E(), 'poltergeist': E(),
  // 에스퍼
  psychic: E({ sec: ['spd-', 10] }), psystrike: E(), 'psycho-cut': E({ critBoost: true }),
  'future-sight': E({ delay: true }), 'psycho-boost': E({ self: { spa: -2 } }), 'stored-power2': E(),
  'moonblast': E({ sec: ['spa-', 30] }), 'magical-shine': E(),
  // 드래곤
  'dragon-claw': E(), 'dragon-pulse': E(), 'draco-meteor': E({ self: { spa: -2 } }),
  'dragon-darts': E({ hits: [2, 2] }), 'scale-shot': E({ multiBoost: true }), 'dragon-ascent': E(),
  // 비행
  'air-slash': E({ sec: ['flinch', 30] }), hurricane: E({ sec: ['confuse', 30], acc: 70 }),
  'brave-bird': E({ recoil: 1 / 3 }), 'wing-attack': E(), 'drill-peck': E(), 'aeroblast': E({ critBoost: true }),
  'bleakwind-storm': E({ sec: ['spe-', 30] }),
  // 독
  'sludge-bomb': E({ sec: ['psn', 30] }), 'sludge-wave': E({ sec: ['psn', 10] }), 'poison-jab': E({ sec: ['psn', 30] }),
  'gunk-shot': E({ sec: ['psn', 30], acc: 80 }), 'poison-sting': E({ sec: ['psn', 30] }),
  'malignant-chain': E({ sec: ['psn', 30] }), 'dire-claw': E({ sec: ['psn', 30] }),
  // 바위/땅
  'rock-slide': E({ sec: ['flinch', 30], acc: 90 }), 'stone-edge': E({ critBoost: true, acc: 80 }),
  'rock-blast': E({ hits: [2, 5], acc: 90 }), 'rock-wrecker': E({ charge: true }),
  earthquake: E(), 'earth-power': E({ sec: ['spd-', 10] }), bulldoze: E({ sec: ['spe-', 100] }),
  'head-smash': E({ recoil: 1 / 2, acc: 80 }), 'power-gem': E(),
  // 벌레
  'bug-buzz': E({ sec: ['spd-', 10] }), 'x-scissor': E(), 'u-turn': E(), 'leech-life2': E(),
  'first-impression': E(), 'megahorn': E({ acc: 85 }),
  // 강철
  'iron-head': E({ sec: ['flinch', 30] }), 'flash-cannon': E({ sec: ['spd-', 10] }),
  'iron-tail': E({ sec: ['def-', 30], acc: 75 }), 'meteor-mash': E({ self: { atk: 1 } }),
  'double-iron-bash': E({ hits: [2, 2], sec: ['flinch', 30] }), 'steel-beam': E(), 'anchor-shot': E({ sec: ['spe-', 100] }),
  'gigaton-hammer': E(), 'behemoth-blade': E(), 'sunsteel-strike': E(),
  // 물
  'hydro-pump': E({ acc: 80 }), surf: E(), waterfall: E({ sec: ['flinch', 20] }), 'aqua-jet': E(),
  'water-shuriken': E({ hits: [2, 5] }), 'liquidation': E({ sec: ['def-', 20] }), 'origin-pulse': E(),
  'steam-eruption': E({ sec: ['burn', 30] }), 'spacial-rend': E({ critBoost: true }), 'crabhammer': E({ critBoost: true, acc: 90 }),
  // 전기
  'volt-switch': E(), 'electro-ball': E(), 'zing-zap': E({ sec: ['flinch', 30] }), 'thunder-cage': E(),
  'rising-voltage': E(), 'parabolic-charge': E({ drain: 1 / 2 }), 'fusion-bolt': E({ sec: ['par', 20] }),
  // 노말
  'body-slam2': E(), 'double-edge': E({ recoil: 1 / 3 }), 'extreme-speed': E(), 'quick-attack': E(),
  'hyper-beam': E({ recharge: true }), 'giga-impact': E({ recharge: true }), 'boomburst': E(),
  'fake-out': E({ flinch: 100 }),
  // 페어리
  'play-rough': E({ sec: ['atk-', 10] }), 'dazzling-gleam': E(), 'fleur-cannon': E({ self: { spa: -2 } }),
  'spirit-break': E({ sec: ['spa-', 100] }), 'moonblast2': E(),
  // 강력한 단발기
  'blast-burn': E({ recharge: true }), 'hydro-cannon': E({ recharge: true }), 'frenzy-plant': E({ recharge: true }),
  'roar-of-time': E({ recharge: true }), 'prismatic-laser': E({ recharge: true }), 'eternabeam': E({ recharge: true }),
  'gigavolt-havoc': E()
};
// 영문 id 보정 (일부 이름 오타/중복 키 방지)
MOVE_EFFECTS.sucker = E({});
MOVE_EFFECTS['night-daze'] = E({ acc: 95 });

const STATUS_NAME = { brn: '화상', par: '마비', psn: '독', slp: '잠듦', frz: '얼음' };

/* 한국어 조사 자동 선택 (받침 유무) */
const JOSA = {
  '은/는': ['은', '는'], '이/가': ['이', '가'], '을/를': ['을', '를'], '과/와': ['과', '와'], '으로/로': ['으로', '로']
};
export function josa(word, pair) {
  const [withFinal, without] = JOSA[pair];
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return word + without;
  const hasFinal = (last - 0xac00) % 28 !== 0;
  return word + (hasFinal ? withFinal : without);
}

/* ------------------------------------------------------------------ */
/* 포켓몬 인스턴스                                                     */
/* ------------------------------------------------------------------ */
export class Fighter {
  constructor(dexId, side, slot) {
    const mon = monById(dexId);
    this.dex = mon;
    this.id = mon.id;
    this.name = mon.n;
    this.types = mon.t.slice();
    this.base = mon.st;
    this.stats = statsAt50(mon.st);
    this.maxHp = this.stats.hp;
    this.hp = this.maxHp;
    this.side = side;
    this.slot = slot;
    this.moves = mon.mv.slice();
    this.stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 };
    this.status = null;
    this.sleepTurns = 0;
    this.flinched = false;
    this.charging = null;
    this.usedMoves = {};
    this.damageDealt = 0;
    this.kos = 0;
    this.leech = false;
    this.lastMove = null;
  }
  get alive() { return this.hp > 0; }
  get hpPct() { return Math.max(0, this.hp / this.maxHp); }
  stat(key) {
    let v = this.stats[key];
    if (key === 'spe' && this.status === 'par') v *= 0.5;
    if (key === 'atk' && this.status === 'brn') v *= 0.5;
    if (key === 'spd' && this.dex.t.includes('바위') && this.battleWeather === 'sand') v *= 1.5;
    if (key === 'def' && this.types.includes('얼음') && this.battleWeather === 'hail') v *= 1.5;
    return Math.max(1, Math.floor(v * stageMul(this.stages[key])));
  }
  stageMul(key) { return stageMul(this.stages[key]); }
  hasType(t) { return this.types.includes(t); }
}

/* ------------------------------------------------------------------ */
/* 타입 상성                                                           */
/* ------------------------------------------------------------------ */
export function typeEff(attackType, defTypes) {
  const row = DATA.eff[attackType] || {};
  let m = 1;
  for (const t of defTypes) m *= (row[t] ?? 1);
  return m;
}
export function effLabel(m) {
  if (m === 0) return { text: '효과 없음', cls: 'none' };
  if (m >= 4) return { text: '효과가 굉장하다!', cls: 'super' };
  if (m >= 2) return { text: '효과가 굉장하다!', cls: 'super' };
  if (m < 1) return { text: '효과가 별로인 듯하다…', cls: 'weak' };
  return { text: '', cls: '' };
}

/* ------------------------------------------------------------------ */
/* 데미지 계산                                                         */
/* ------------------------------------------------------------------ */
function rand(rng) { return rng(); }

function calcDamage(atk, def, move, opts = {}) {
  const rng = opts.rng || Math.random;
  const cat = move.c;                        // 물리 / 특수 / 변화
  if (cat === '변화') return { dmg: 0, eff: 1, crit: false };
  const aKey = cat === '물리' ? 'atk' : 'spa';
  const dKey = cat === '물리' ? 'def' : 'spd';
  const crit = opts.crit ?? (rand(rng) < (MOVE_EFFECTS[move.en]?.critBoost ? 1 / 8 : 1 / 16));
  let A = atk.stat(aKey);
  let D = def.stat(dKey);
  if (crit) {
    // 급소: 공격 측 랭크 하락/방어 측 랭크 상승 무시
    const rawA = atk.stats[aKey] * (atk.status === 'brn' && cat === '물리' ? 0.5 : 1);
    const rawD = def.stats[dKey];
    A = Math.max(1, Math.floor(rawA * stageMul(Math.max(0, atk.stages[aKey]))));
    D = Math.max(1, Math.floor(rawD * stageMul(Math.min(0, def.stages[dKey]))));
  }
  let eff = typeEff(move.t, def.types);
  if (MOVE_EFFECTS[move.en]?.freezeDry && def.hasType('물')) eff *= 2;
  if (eff === 0) return { dmg: 0, eff, crit, immune: true };

  const L = 50;
  let base = Math.floor(Math.floor(Math.floor((2 * L) / 5 + 2) * move.p * A / D) / 50) + 2;
  let mod = 1;
  // 날씨
  const w = opts.weather || 'clear';
  if (w === 'sun') { if (move.t === '불꽃') mod *= 1.5; if (move.t === '물') mod *= 0.5; }
  if (w === 'rain') { if (move.t === '물') mod *= 1.5; if (move.t === '불꽃') mod *= 0.5; }
  // 자속
  if (atk.hasType(move.t)) mod *= 1.5;
  // 급소
  if (crit) mod *= 1.5;
  // 상성
  mod *= eff;
  // 화상
  if (atk.status === 'brn' && cat === '물리') mod *= 0.9;
  const roll = 0.85 + rand(rng) * 0.15;
  let dmg = Math.floor(base * mod * roll);
  if (eff > 1) dmg = Math.floor(dmg * 1.0);
  return { dmg: Math.max(1, dmg), eff, crit };
}

/* ------------------------------------------------------------------ */
/* AI                                                                  */
/* ------------------------------------------------------------------ */
function aiChoose(self, foe, weather, rng) {
  const options = [];
  for (const mid of self.moves) {
    const mv = moveById(mid);
    if (!mv) continue;
    let score = 1;
    const usage = self.usedMoves[mid] || 0;
    if (mv.c === '변화') {
      const ef = MOVE_EFFECTS[mv.en] || {};
      if (mv.en === 'recover' || mv.en === 'roost' || mv.en === 'synthesis' || mv.en === 'moonlight' || mv.en === 'morning-sun' || mv.en === 'slack-off' || mv.en === 'shore-up' || mv.en === 'soft-boiled' || mv.en === 'milk-drink') {
        score = self.hpPct < 0.55 ? 260 * (0.6 - self.hpPct + 0.2) : 1;
      } else if (['swords-dance', 'nasty-plot', 'calm-mind', 'dragon-dance', 'quiver-dance', 'shell-smash', 'bulk-up', 'work-up', 'growth', 'agility', 'iron-defense'].includes(mv.en)) {
        const turn = self.battleTurn || 1;
        score = turn <= 3 && self.hpPct > 0.7 && !self.boosted ? 150 : 6;
      } else if (['sleep-powder', 'spore', 'hypnosis', 'sing', 'thunder-wave', 'will-o-wisp', 'toxic', 'poison-powder', 'stun-spore', 'grass-whistle', 'lovely-kiss', 'yawn', 'glare'].includes(mv.en)) {
        score = !foe.status && (usage < 2) ? 180 * (mv.a / 100) : 2;
        if (foe.status) score = 0.5;
      } else if (mv.en === 'leech-seed') {
        score = !foe.leech ? 120 : 1;
      } else {
        score = 4;
      }
      if (usage >= 2) score *= 0.25;
      options.push({ mid, mv, score });
      continue;
    }
    const eff = typeEff(mv.t, foe.types);
    if (eff === 0) continue;
    const stab = self.hasType(mv.t) ? 1.5 : 1;
    const expected = mv.p * eff * stab * (mv.a / 100);
    // 남은 HP를 정리할 수 있으면 가산
    const est = Math.floor((((2 * 50 / 5 + 2) * mv.p * self.stat(mv.c === '물리' ? 'atk' : 'spa') / Math.max(1, foe.stat(mv.c === '물리' ? 'def' : 'spd'))) / 50 + 2) * stab * eff * 0.93);
    score = expected;
    if (est >= foe.hp) score *= 1.6;
    if (mv.pr > 0) score *= 1.15;
    if (usage >= 3) score *= 0.8;
    if (mv.p >= 120 && mv.a < 100) score *= 0.95;
    if (weather === 'sun' && mv.t === '불꽃') score *= 1.2;
    if (weather === 'sun' && mv.t === '물') score *= 0.7;
    if (weather === 'rain' && mv.t === '물') score *= 1.2;
    if (weather === 'rain' && mv.t === '불꽃') score *= 0.7;
    // 물리/특수 중 유리한 쪽
    if (self.stats[mv.c === '물리' ? 'atk' : 'spa'] >= self.stats[mv.c === '물리' ? 'spa' : 'atk'] * 1.25) score *= 1.12;
    options.push({ mid, mv, score });
  }
  if (!options.length) return null;
  options.sort((a, b) => b.score - a.score);
  // 상위 후보 중 가중 랜덤 (단조로움 방지)
  const top = options.slice(0, Math.min(3, options.length));
  const weights = top.map((o, i) => Math.max(0.02, o.score) * [1, 0.45, 0.2][i]);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rand(rng) * sum;
  for (let i = 0; i < top.length; i++) { r -= weights[i]; if (r <= 0) return top[i]; }
  return top[0];
}

/* ------------------------------------------------------------------ */
/* 배틀 시뮬레이션                                                     */
/* ------------------------------------------------------------------ */
export function simulate({ teamA, teamB, weather = 'clear', seed = 1 }) {
  let s = seed >>> 0 || 1;
  const rng = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };

  const A = teamA.map((id, i) => new Fighter(id, 'A', i));
  const B = teamB.map((id, i) => new Fighter(id, 'B', i));
  for (const f of [...A, ...B]) f.battleWeather = weather;

  const events = [];
  const push = (e) => events.push(e);
  const log = (text, cls = '') => push({ t: 'log', text, cls });
  let turn = 0;
  let idxA = 0, idxB = 0;
  let actA = A[0], actB = B[0];
  let winner = null;
  let protectSide = null;

  const alive = (team) => team.filter((f) => f.alive);
  const nextAlive = (team, cur) => {
    const i = team.indexOf(cur);
    for (let k = 1; k <= team.length; k++) {
      const f = team[(i + k) % team.length];
      if (f.alive) return f;
    }
    return null;
  };

  push({ t: 'weather', kind: weather });
  log(`${WEATHERS[weather].name} 상태에서 배틀이 시작되었다!`, 'sys');

  const doSwitch = (side, fighter, reason) => {
    if (side === 'A') { actA = fighter; idxA = A.indexOf(fighter); } else { actB = fighter; idxB = B.indexOf(fighter); }
    push({ t: 'switch', side, idx: fighter.slot, name: fighter.name, id: fighter.id, hp: fighter.hp, maxHp: fighter.maxHp, reason });
    log(`${side === 'A' ? '내' : '상대'} ${fighter.name}, 승부를 걸어온다!`, 'switch');
  };

  const applyDamage = (att, def, raw, move, meta = {}) => {
    const before = def.hp;
    const dmg = Math.min(def.hp, raw);
    def.hp = Math.max(0, def.hp - dmg);
    if (meta.offField) {} else att.damageDealt += dmg;
    push({ t: 'damage', side: def.side, idx: def.slot, amount: dmg, hp: def.hp, maxHp: def.maxHp, eff: meta.eff, crit: meta.crit, move: move ? move.t : null, moveId: move?.id, before, attacker: att.side });
    def.lastTaken = dmg;
    const eff = meta.eff ?? 1;
    if (meta.crit) push({ t: 'banner', kind: 'crit', text: '급소에 맞았다!' });
    if (eff >= 2) push({ t: 'banner', kind: 'super', text: eff >= 4 ? '효과가 굉장하다!!' : '효과가 굉장하다!' });
    else if (eff > 0 && eff < 1) push({ t: 'banner', kind: 'weak', text: '효과가 별로인 듯하다…' });
    if (dmg <= 0) push({ t: 'banner', kind: 'none', text: '효과가 없는 것 같다…' });
    log(`${def.name}에게 ${dmg}의 피해!${meta.crit ? ' (급소)' : ''}`, 'dmg');
    return dmg;
  };

  const heal = (f, amount, reason) => {
    const amt = Math.min(f.maxHp - f.hp, Math.max(1, Math.floor(amount)));
    if (amt <= 0) return;
    f.hp += amt;
    push({ t: 'heal', side: f.side, idx: f.slot, amount: amt, hp: f.hp, maxHp: f.maxHp });
    log(`${f.name}의 체력이 ${amt} 회복되었다!${reason ? ` (${reason})` : ''}`, 'heal');
  };

  const setStatus = (f, st) => {
    if (!f.alive || f.status) return false;
    if ((st === 'brn' && f.hasType('불꽃')) || (st === 'psn' && (f.hasType('독') || f.hasType('강철'))) || (st === 'par' && f.hasType('전기')) || (st === 'frz' && f.hasType('얼음'))) {
      return false;
    }
    f.status = st;
    if (st === 'slp') f.sleepTurns = 1 + Math.floor(rng() * 3);
    push({ t: 'status', side: f.side, idx: f.slot, status: st, text: STATUS_NAME[st] });
    const msg = { brn: '화상을 입었다!', par: '몸이 저려 움직이기 힘들다!', psn: '독에 걸렸다!', slp: '잠들어 버렸다!', frz: '얼어붙었다!' }[st];
    log(`${josa(f.name, '은/는')} ${msg}`, 'status');
    return true;
  };

  const boost = (f, table, self = true) => {
    for (const [k, d] of Object.entries(table)) {
      const before = f.stages[k];
      f.stages[k] = Math.max(-6, Math.min(6, before + d));
      if (f.stages[k] === before) {
        log(`${f.name}의 ${josa(STAT_LABEL[k], '은/는')} 더 이상 ${d > 0 ? '올라가지' : '떨어지지'} 않는다!`, 'boost');
      } else {
        push({ t: 'boost', side: f.side, idx: f.slot, stat: k, delta: d, value: f.stages[k] });
        log(`${f.name}의 ${josa(STAT_LABEL[k], '이/가')} ${d > 0 ? '올라갔다!' : '떨어졌다!'}`, 'boost');
      }
    }
  };

  const executeMove = (att, def, chosen) => {
    const mv = chosen.mv;
    att.lastMove = mv.id;
    att.usedMoves[mv.id] = (att.usedMoves[mv.id] || 0) + 1;
    push({ t: 'move', side: att.side, idx: att.slot, moveId: mv.id, name: mv.n, move: mv, targetSide: def.side, targetIdx: def.slot });
    log(`${att.name}의 ${mv.n}!`, 'move');

    // 명중 판정
    if (mv.c !== '변화') {
      const accStage = Math.max(-6, Math.min(6, att.stages.acc - def.stages.eva));
      const acc = Math.min(100, (mv.a || 100) * ACC_MULT[accStage + 6]);
      if (rng() * 100 > acc) {
        push({ t: 'miss', side: att.side, idx: att.slot, moveId: mv.id });
        log(`하지만 ${def.name}에게 맞지 않았다!`, 'miss');
        return;
      }
    }

    if (mv.c === '변화') {
      applyStatusMove(att, def, mv);
      return;
    }

    const ef = MOVE_EFFECTS[mv.en] || {};
    // 연속 공격
    let hits = 1;
    if (ef.hits) {
      if (ef.hits[0] === ef.hits[1]) hits = ef.hits[0];
      else hits = ef.hits[0] + Math.floor(rng() * (ef.hits[1] - ef.hits[0] + 1));
    }
    let totalEff = 1, totalDmg = 0;
    for (let h = 0; h < hits; h++) {
      if (!def.alive) break;
      const r = calcDamage(att, def, mv, { rng, weather });
      totalEff = r.eff;
      if (r.immune) { push({ t: 'banner', kind: 'none', text: '효과가 없는 것 같다…' }); log(`${def.name}에게 통하지 않는다!`, 'miss'); return; }
      totalDmg += applyDamage(att, def, r.dmg, mv, { eff: r.eff, crit: r.crit });
      if (r.crit) push({ t: 'shake', power: 1 });
    }
    if (hits > 1) log(`${hits}번 연속으로 맞았다!`, 'dmg');
    // 반동
    if (ef.recoil) {
      const rec = Math.max(1, Math.floor(Math.max(totalDmg, 1) * ef.recoil));
      applyDamage(att, att, rec, null, { eff: 1, offField: true });
      log(`${josa(att.name, '은/는')} 반동으로 ${rec}의 피해를 입었다!`, 'dmg');
    }
    // 흡수
    if (ef.drain && totalDmg > 0) heal(att, Math.ceil(totalDmg * ef.drain), '흡수');
    // 부가 효과
    if (def.alive) {
      const secs = [ef.sec, ef.sec2].filter(Boolean);
      for (const [kind, chance] of secs) {
        if (rng() * 100 > chance) continue;
        applySecondary(att, def, kind, mv);
      }
    }
    if (ef.self) boost(att, ef.self);
  };

  const applySecondary = (att, def, kind, mv) => {
    switch (kind) {
      case 'burn': setStatus(def, 'brn'); break;
      case 'par': setStatus(def, 'par'); break;
      case 'psn': setStatus(def, 'psn'); break;
      case 'frz': setStatus(def, 'frz'); break;
      case 'slp': setStatus(def, 'slp'); break;
      case 'flinch': def.flinched = true; log(`${def.name}의 풀이 죽었다!`, 'status'); break;
      case 'confuse': if (!def.confused) { def.confused = 2; log(`${josa(def.name, '은/는')} 혼란에 빠졌다!`, 'status'); push({ t: 'status', side: def.side, idx: def.slot, status: 'confuse', text: '혼란' }); } break;
      case 'atk-': boost(def, { atk: -1 }); break;
      case 'def-': boost(def, { def: -1 }); break;
      case 'spa-': boost(def, { spa: -1 }); break;
      case 'spd-': boost(def, { spd: -1 }); break;
      case 'spe-': boost(def, { spe: -1 }); break;
      default: break;
    }
  };

  const applyStatusMove = (att, def, mv) => {
    const en = mv.en;
    if (['recover', 'roost', 'synthesis', 'moonlight', 'morning-sun', 'slack-off', 'shore-up', 'soft-boiled', 'milk-drink'].includes(en)) {
      heal(att, Math.floor(att.maxHp * 0.5), '회복');
      return;
    }
    if (en === 'rest') {
      att.hp = att.maxHp; push({ t: 'heal', side: att.side, idx: att.slot, amount: att.maxHp, hp: att.hp, maxHp: att.maxHp });
      att.status = 'slp'; att.sleepTurns = 2;
      push({ t: 'status', side: att.side, idx: att.slot, status: 'slp', text: '잠듦' });
      log(`${josa(att.name, '은/는')} 잠들어 체력을 모두 회복했다!`, 'heal');
      return;
    }
    const boostTable = {
      'swords-dance': { atk: 2 }, 'nasty-plot': { spa: 2 }, 'calm-mind': { spa: 1, spd: 1 },
      'dragon-dance': { atk: 1, spe: 1 }, 'quiver-dance': { spa: 1, spd: 1, spe: 1 },
      'shell-smash': { atk: 2, spa: 2, spe: 2, def: -1, spd: -1 }, 'bulk-up': { atk: 1, def: 1 },
      'work-up': { atk: 1, spa: 1 }, growth: { atk: 1, spa: 1 }, agility: { spe: 2 },
      'iron-defense': { def: 2 }, 'rock-polish': { spe: 2 }, 'tail-glow': { spa: 3 },
      'cotton-guard': { def: 3 }
    };
    if (boostTable[en]) {
      att.boosted = true;
      boost(att, boostTable[en]);
      return;
    }
    const statusTable = {
      'sleep-powder': 'slp', spore: 'slp', hypnosis: 'slp', sing: 'slp', 'grass-whistle': 'slp',
      'lovely-kiss': 'slp', yawn: 'slp', 'thunder-wave': 'par', glare: 'par', 'stun-spore': 'par',
      'will-o-wisp': 'brn', toxic: 'psn', 'poison-powder': 'psn'
    };
    if (statusTable[en]) {
      if (def.status) { log(`하지만 ${josa(def.name, '은/는')} 이미 상태이상이다!`, 'miss'); return; }
      setStatus(def, statusTable[en]);
      return;
    }
    if (en === 'leech-seed') {
      if (def.leech) { log('하지만 새싹이 심어지지 않았다!', 'miss'); return; }
      def.leech = true; log(`${def.name}에게 씨앗이 심어졌다!`, 'status');
      return;
    }
    if (en === 'confuse-ray' || en === 'swagger') {
      if (en === 'swagger') boost(def, { atk: 2 });
      applySecondary(att, def, 'confuse', mv);
      return;
    }
    if (en === 'protect' || en === 'detect') {
      att.protect = true; log(`${josa(att.name, '은/는')} 몸을 지켰다!`, 'status');
      return;
    }
    log(`하지만 아무 일도 일어나지 않았다…`, 'miss');
  };

  const endOfTurn = () => {
    for (const [side, f] of [['A', actA], ['B', actB]]) {
      if (!f || !f.alive) continue;
      // 날씨 데미지
      if ((weather === 'sand' || weather === 'hail')) {
        const immune = weather === 'sand' ? (f.hasType('바위') || f.hasType('땅') || f.hasType('강철')) : f.hasType('얼음');
        if (!immune) {
          const d = Math.max(1, Math.floor(f.maxHp / 16));
          applyDamage(f, f, d, null, { eff: 1, offField: true });
          log(`${josa(f.name, '은/는')} ${weather === 'sand' ? '모래바람' : '싸라기눈'}에 ${d}의 피해를 입었다!`, 'dmg');
        }
      }
      if (!f.alive) continue;
      if (f.status === 'brn' || f.status === 'psn') {
        const d = Math.max(1, Math.floor(f.maxHp / (f.status === 'brn' ? 16 : 8)));
        applyDamage(f, f, d, null, { eff: 1, offField: true });
        log(`${josa(f.name, '은/는')} ${STATUS_NAME[f.status]}${f.status === 'brn' ? '으로' : '으로'} ${d}의 피해를 입었다!`, 'dmg');
      }
      if (f.leech && f.alive) {
        const d = Math.max(1, Math.floor(f.maxHp / 8));
        applyDamage(f, f, d, null, { eff: 1, offField: true });
        log(`${f.name}의 생명력이 흡수되었다!`, 'dmg');
      }
      if (f.confused) f.confused--;
    }
  };

  const checkFaint = (f) => {
    if (f.hp <= 0 && !f.faintedFlag) {
      f.faintedFlag = true;
      push({ t: 'faint', side: f.side, idx: f.slot, name: f.name });
      log(`${josa(f.name, '은/는')} 쓰러졌다!`, 'faint');
      const killer = f.side === 'A' ? actB : actA;
      if (killer) killer.kos++;
      return true;
    }
    return false;
  };

  const sidesDone = () => {
    const aAlive = alive(A).length, bAlive = alive(B).length;
    if (aAlive === 0 && bAlive === 0) return 'draw';
    if (aAlive === 0) return 'B';
    if (bAlive === 0) return 'A';
    return null;
  };

  const MAX_TURNS = 90;
  while (turn < MAX_TURNS) {
    turn++;
    push({ t: 'turn', n: turn });
    actA.battleTurn = turn; actB.battleTurn = turn;
    actA.protect = false; actB.protect = false;
    actA.flinched = false; actB.flinched = false;

    // 행동 불가 판정
    const canAct = (f) => {
      if (!f.alive) return false;
      if (f.status === 'slp') {
        f.sleepTurns--;
        if (f.sleepTurns <= 0) {
          f.status = null;
          push({ t: 'cure', side: f.side, idx: f.slot, status: 'slp' });
          log(`${josa(f.name, '은/는')} 잠에서 깨어났다!`, 'status');
          return true;
        }
        push({ t: 'asleep', side: f.side, idx: f.slot });
        log(`${josa(f.name, '은/는')} 잠들어 있다…`, 'status');
        return false;
      }
      if (f.status === 'frz') {
        if (rng() < 0.2) { f.status = null; push({ t: 'cure', side: f.side, idx: f.slot, status: 'frz' }); log(`${f.name}의 얼음이 녹았다!`, 'status'); return true; }
        log(`${josa(f.name, '은/는')} 얼어붙어 움직일 수 없다!`, 'status');
        return false;
      }
      if (f.status === 'par' && rng() < 0.25) {
        log(`${josa(f.name, '은/는')} 몸이 저려 움직일 수 없다!`, 'status');
        return false;
      }
      if (f.confused && rng() < 0.33) {
        const d = Math.max(1, Math.floor(calcDamage(f, f, { p: 40, c: '물리', t: '노말', en: '', a: 100 }, { rng, weather, crit: false }).dmg));
        applyDamage(f, f, d, null, { eff: 1, offField: true });
        log(`${josa(f.name, '은/는')} 혼란으로 자신을 공격했다!`, 'dmg');
        return false;
      }
      return true;
    };

    const chosenA = actA.alive ? aiChoose(actA, actB, weather, rng) : null;
    const chosenB = actB.alive ? aiChoose(actB, actA, weather, rng) : null;

    const acts = [];
    if (chosenA) acts.push({ f: actA, chosen: chosenA });
    if (chosenB) acts.push({ f: actB, chosen: chosenB });
    acts.sort((x, y) => {
      const px = x.chosen.mv.pr || 0, py = y.chosen.mv.pr || 0;
      if (px !== py) return py - px;
      const sx = x.f.stat('spe'), sy = y.f.stat('spe');
      if (sx !== sy) return sy - sx;
      return rng() - 0.5;
    });

    for (const a of acts) {
      if (!a.f.alive) continue;
      const foe = a.f === actA ? actB : actA;
      if (!foe.alive) continue;
      if (!canAct(a.f)) continue;
      if (a.f.flinched) { log(`${josa(a.f.name, '은/는')} 풀죽어 움직이지 못했다!`, 'status'); continue; }
      if (foe.protect) { log(`${josa(foe.name, '은/는')} 공격을 막았다!`, 'miss'); continue; }
      executeMove(a.f, foe, a.chosen);
      checkFaint(foe);
      if (!foe.alive) {
        const w = sidesDone();
        if (w) { winner = w; break; }
        const nxt = nextAlive(foe.side === 'A' ? A : B, foe);
        if (nxt) {
          // 교체는 다음 턴 시작에
          a.pendingSwitch = foe;
          doSwitch(foe.side, nxt, 'faint');
        }
      }
      if (!a.f.alive) break;
    }
    if (winner) break;
    endOfTurn();
    for (const f of [actA, actB]) {
      if (checkFaint(f)) {
        const w = sidesDone();
        if (w) { winner = w; break; }
        const nxt = nextAlive(f.side === 'A' ? A : B, f);
        if (nxt) doSwitch(f.side, nxt, 'faint');
      }
    }
    if (winner) break;
    if (!actA.alive || !actB.alive) break;
  }
  if (!winner) {
    const w = sidesDone();
    winner = w || (actA.hpPct + alive(A).length >= actB.hpPct + alive(B).length ? 'A' : 'B');
    log('시간 초과! 남은 체력으로 승부를 가린다.', 'sys');
  }

  // 스탯 집계
  const teamStats = (team) => team.map((f) => ({ id: f.id, name: f.name, dmg: f.damageDealt, kos: f.kos, survived: f.alive, hp: f.hp, maxHp: f.maxHp }));
  const all = [...teamStats(A), ...teamStats(B)];
  const mvp = all.slice().sort((a, b) => (b.dmg + b.kos * 120) - (a.dmg + a.kos * 120))[0];
  push({ t: 'end', winner, mvp, stats: { A: teamStats(A), B: teamStats(B) }, turns: turn });
  log(winner === 'draw' ? '무승부!' : `${winner === 'A' ? '내 팀' : '상대 팀'}의 승리!`, 'win');

  return { events, winner, mvp, turn, stats: { A: teamStats(A), B: teamStats(B) }, fighters: { A, B } };
}

/* 빠른 승률 추정 (프리뷰용) */
export function estimateWinRate(teamA, teamB, weather, runs = 24) {
  let win = 0, draw = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulate({ teamA, teamB, weather, seed: 7919 * (i + 3) + teamA.length * 101 });
    if (r.winner === 'A') win++;
    else if (r.winner === 'draw') draw++;
  }
  return Math.round((win / runs) * 100);
}

export { calcDamage, STATUS_NAME, STAT_LABEL };
