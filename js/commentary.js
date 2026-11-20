/* ============================================================================
   캐스터 · 해설 중계 — 실제 전투 이벤트에 반응하는 한국어 멘트
   ========================================================================== */
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const CAST_TEAM = {
  caster: { name: '민서', role: '캐스터', emoji: '🎙️' },
  analyst: { name: '도현', role: '해설', emoji: '🧠' }
};

const T = {
  start: {
    caster: [
      (c) => `안녕하십니까! ${c.stageName}에서 펼쳐지는 ${c.mode} 난투, 지금 시작합니다!`,
      (c) => `전국도감 ${c.mode} 한타! ${c.stageName}의 공기가 뜨겁습니다!`,
      (c) => `오늘의 매치업, ${c.aTeam} 대 ${c.bTeam}! 시작합니다!`
    ],
    analyst: [
      (c) => `양 팀 ${c.n}마리씩, 총 ${c.n * 2}마리가 한 필드에서 동시에 교전합니다. 스피드가 곧 생존입니다.`,
      (c) => `${c.stageName}은(는) 바닥이 넓습니다. 원거리 진형이 유리한 구도인데요, 근접진이 얼마나 붙느냐가 관건입니다.`,
      (c) => `체력이 아니라 '회피 동선'이 승부를 가릅니다. 빠른 포켓몬의 사이드스텝을 주목하십시오.`
    ]
  },
  firstCast: {
    caster: [
      (c) => `선제공격! ${c.name}의 ${c.move}!`,
      (c) => `먼저 움직인 건 ${c.name}! ${c.move} 날아갑니다!`
    ],
    analyst: [
      (c) => `첫 기술부터 ${c.move}. ${c.name}의 쿨타임 회전이 빠릅니다.`,
      (c) => `${c.name}가 거리를 재고 바로 기술을 넣습니다. 이 흐름을 가져가려 합니다.`
    ]
  },
  firstBlood: {
    caster: [
      (c) => `퍼스트 블러드! ${c.name}가 먼저 쓰러집니다!`,
      (c) => `첫 킬! ${c.name} 다운! 한타의 균형이 기웁니다!`
    ],
    analyst: [
      (c) => `${c.killer ? `${c.killer}의 각이 정확했습니다. ` : ''}${c.team} 진영에 구멍이 생겼습니다.`,
      (c) => `${c.name}가 먼저 빠졌습니다. 남은 인원의 화력 분배가 중요해졌습니다.`
    ]
  },
  faint: {
    caster: [
      (c) => `${c.name} 다운! ${c.team} 숫자가 줄어듭니다!`,
      (c) => `${c.name}, 버티지 못했습니다!`,
      (c) => `쓰러졌습니다 ${c.name}! ${c.killer ? `${c.killer}의 킬!` : ''}`
    ],
    analyst: [
      (c) => `${c.killer ? `${c.killer}가 확실하게 마무리했습니다. ` : ''}이제 수적 열세가 눈에 보입니다.`,
      (c) => `${c.name}의 이탈로 ${c.team}의 전선이 얇아졌습니다.`,
      (c) => `체력 관리가 아쉬웠습니다. ${c.name}는 회피 타이밍을 놓쳤습니다.`
    ]
  },
  dodge: {
    caster: [
      (c) => `피했다! ${c.name}, 종이 한 장 차이로 회피!`,
      (c) => `${c.name} 사이드스텝! ${c.move}가 허공을 갈랐습니다!`,
      (c) => `미스! ${c.name} 살아남습니다!`
    ],
    analyst: [
      (c) => `${c.move} 궤적을 읽었습니다. 스피드가 만든 한 걸음입니다.`,
      (c) => `발이 빠른 포켓몬은 이래서 무섭습니다. 판정 자체를 피해버립니다.`,
      (c) => `정확한 수직 대시였습니다. 최소 이동으로 최대 효과를 냈습니다.`
    ]
  },
  super: {
    caster: [
      (c) => `효과가 굉장하다! ${c.att}의 ${c.move}, ${c.def}에게 그대로 꽂혔습니다!`,
      (c) => `${c.def} 흔들립니다! 상성이 완벽하게 맞아떨어졌습니다!`
    ],
    analyst: [
      (c) => `타입 상성 2배. ${c.def} 입장에서는 정말 아픈 한 방입니다.`,
      (c) => `${c.att}의 기술 구성이 상대를 정확히 노렸습니다.`
    ]
  },
  crit: {
    caster: [
      (c) => `급소! ${c.att}의 ${c.move}가 급소를 찔렀습니다!`,
      (c) => `크리티컬! ${c.def} 체력이 순식간에 녹습니다!`
    ],
    analyst: [
      (c) => `급소 한 방에 체력 계산이 무너졌습니다.`,
      (c) => `운이 따른 일격이지만, 그 전에 각을 만들어둔 게 컸습니다.`
    ]
  },
  teamfight: {
    caster: [
      (c) => `한타다! ${c.n}마리가 한 점에 뭉쳤습니다!`,
      (c) => `난전입니다! 전원이 뒤엉켰습니다!`,
      (c) => `여기가 승부처입니다! ${c.n}마리 정면 충돌!`
    ],
    analyst: [
      (c) => `좁은 지역에 화력이 집중됩니다. 광역 기술 하나로 판이 갈립니다.`,
      (c) => `아군끼리 겹치지 않으려는 움직임, 진형이 살아 있습니다.`,
      (c) => `이 교전에서 누가 먼저 이탈하느냐가 다음 국면을 결정합니다.`
    ]
  },
  low: {
    caster: [
      (c) => `${c.name}, 체력이 위험합니다! 버틸 수 있을까요!`,
      (c) => `${c.name} 빈사 상태! 한 대만 더 맞으면 끝입니다!`
    ],
    analyst: [
      (c) => `${c.name}의 생존이 이 한타의 향방을 가릅니다.`,
      (c) => `체력 15% 이하. 회피 쿨타임이 남았는지가 관건입니다.`
    ]
  },
  comeback: {
    caster: [
      (c) => `역전입니다! ${c.team}가 판을 뒤집었습니다!`,
      (c) => `흐름이 완전히 바뀌었습니다! ${c.team}가 앞서 나갑니다!`
    ],
    analyst: [
      (c) => `수적 열세를 뒤집었습니다. 집중 견제가 통했습니다.`,
      (c) => `${c.team}의 타깃 전환이 빨랐습니다.`
    ]
  },
  sudden: {
    caster: [
      (c) => `시간이 흐릅니다 — 서든데스! 양 팀 화력이 폭발합니다!`
    ],
    analyst: [
      (c) => `이제 방어력 의미 없습니다. 먼저 때리는 쪽이 이깁니다.`
    ]
  },
  end: {
    caster: [
      (c) => `경기 종료! ${c.team} 승리! ${c.dur}초의 난투였습니다!`,
      (c) => `끝났습니다! ${c.team}가 아레나를 차지합니다!`
    ],
    analyst: [
      (c) => `MVP는 ${c.mvp}. ${c.dmg} 피해에 ${c.kos}킬, ${c.dodges}회 회피. 오늘 한타의 주인공입니다.`,
      (c) => `${c.mvp}의 기여가 압도적이었습니다. 피해량 ${c.dmg}, 회피 ${c.dodges}회.`
    ]
  },
  heal: {
    caster: [(c) => `${c.name}, 체력을 끌어올립니다!`],
    analyst: [(c) => `회복 타이밍이 좋습니다. 한 번 더 버티면 각이 나옵니다.`]
  }
};

export class Commentator {
  constructor(ctx) {
    this.ctx = ctx;
    this.queue = [];
    this.timer = 0;
    this.recent = {};
    this.firstCastDone = false;
    this.combo = {};
  }
  _cfg(ev = {}) {
    return {
      ...this.ctx,
      name: ev.name, move: ev.moveName, att: ev.att, def: ev.def,
      team: ev.team, killer: ev.killer, n: ev.n || this.ctx.n,
      dmg: ev.dmg, kos: ev.kos, dodges: ev.dodges, dur: ev.dur, mvp: ev.mvp,
      stageName: this.ctx.stageName, mode: this.ctx.mode
    };
  }
  say(who, text, priority = 1) {
    if (!text) return;
    this.queue.push({ who, text, priority, at: performance.now() });
    if (this.queue.length > 7) {
      this.queue.sort((a, b) => b.priority - a.priority);
      this.queue.length = 5;
    }
  }
  line(kind, priority = 1, ev = {}) {
    const bank = T[kind];
    if (!bank) return;
    const who = kind === 'firstBlood' || kind === 'faint' ? (Math.random() < .55 ? 'caster' : 'analyst') : (kind === 'crit' || kind === 'super' || kind === 'dodge' ? (Math.random() < .5 ? 'caster' : 'analyst') : 'caster');
    const arr = bank[who] || bank.caster || bank.analyst;
    const cfg = this._cfg(ev);
    let text = '';
    try { text = pick(arr)(cfg); } catch (e) { text = arr[0](cfg); }
    this.say(who, text, priority);
  }
  /* 이벤트 → 멘트 */
  on(ev) {
    const teamOf = (side) => (side === 'A' ? this.ctx.aTeam : this.ctx.bTeam);
    switch (ev.t) {
      case 'start':
        this.line('start', 5);
        this.say('analyst', pick(T.start.analyst)(this._cfg()), 4);
        break;
      case 'cast': {
        if (!this.firstCastDone) {
          this.firstCastDone = true;
          this.line('firstCast', 3, { name: ev.name, moveName: ev.moveName });
        }
        break;
      }
      case 'dodge':
        if (Math.random() < .42) this.line('dodge', 2, { name: ev.name, moveName: ev.moveName });
        break;
      case 'hit': {
        if (ev.crit && Math.random() < .8) this.line('crit', 2, { att: ev.attName, def: ev.defName, moveName: ev.moveName });
        else if (ev.eff >= 2 && Math.random() < .45) this.line('super', 2, { att: ev.attName, def: ev.defName, moveName: ev.moveName });
        break;
      }
      case 'faint': {
        if (!this.firstBlood) {
          this.firstBlood = true;
          this.line('firstBlood', 5, { name: ev.name, killer: ev.killer, team: teamOf(ev.side) });
        } else {
          this.line('faint', 4, { name: ev.name, killer: ev.killer, team: teamOf(ev.side) });
        }
        break;
      }
      case 'teamfight':
        this.line('teamfight', 3, { n: ev.n });
        break;
      case 'low':
        if (Math.random() < .7) this.line('low', 2, { name: ev.name });
        break;
      case 'comeback':
        this.line('comeback', 3, { team: teamOf(ev.side) });
        break;
      case 'sudden':
        this.line('sudden', 4);
        break;
      case 'end': {
        const w = ev.winner === 'draw' ? '무승부' : teamOf(ev.winner);
        this.say('caster', pick(T.end.caster)(this._cfg({ team: w, dur: Math.round(ev.duration) })), 6);
        if (ev.mvp) this.say('analyst', pick(T.end.analyst)(this._cfg({ mvp: ev.mvp.name, dmg: ev.mvp.dmg, kos: ev.mvp.kos, dodges: ev.mvp.dodges })), 6);
        break;
      }
      default: break;
    }
  }
  /* 다음 멘트 (최소 간격 유지) */
  tick(dt) {
    this.timer -= dt;
    if (this.timer > 0 || !this.queue.length) return null;
    this.queue.sort((a, b) => b.priority - a.priority || a.at - b.at);
    const line = this.queue.shift();
    this.timer = 1.05;
    return line;
  }
}
