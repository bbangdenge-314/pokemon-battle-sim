#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PokeAPI CSV -> js/data.js (1~9세대 전국도감 1,025종 번들)

- 한국어 이름/타입/종족값/세대/전설 여부
- 실제 학습 기술 중 대표 기술 4개 선정(자속/위력/명중/타입 견제 다양성)
- 기술 테이블(한국어 이름, 타입, 분류, 위력, 명중, PP, 우선도)
- 타입 상성표(18x18)
"""
import csv, json, os, sys, collections

BASE = os.path.dirname(os.path.abspath(__file__))
CSV = os.path.join(BASE, '..', 'data', 'csv')
OUT = os.path.join(BASE, '..', 'js', 'data.js')

MAX_DEX = 1025
KO = '3'

def load(name):
    with open(os.path.join(CSV, name + '.csv'), newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))

def num(v, default=None):
    if v is None or v == '':
        return default
    return int(float(v))

species = {int(r['id']): r for r in load('pokemon_species')}
sp_names = {}
for r in load('pokemon_species_names'):
    if r['local_language_id'] == KO:
        sp_names[int(r['pokemon_species_id'])] = r['name']

pokes = {}
for r in load('pokemon'):
    pid = int(r['id'])
    if pid <= MAX_DEX and r['is_default'] == '1':
        pokes[pid] = r

types = {}
for r in load('types'):
    types[int(r['id'])] = r['identifier']
type_ko = {}
for r in load('type_names'):
    if r['local_language_id'] == KO:
        type_ko[int(r['type_id'])] = r['name'].strip()
TYPE_ORDER = ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost',
              'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon',
              'dark', 'fairy']
TYPE_ID = {types[tid]: tid for tid in types}
KO_BY_ID = {TYPE_ID[t]: type_ko[TYPE_ID[t]] for t in TYPE_ORDER}

p_types = collections.defaultdict(list)
for r in load('pokemon_types'):
    pid = int(r['pokemon_id'])
    if pid <= MAX_DEX:
        p_types[pid].append((int(r['slot']), KO_BY_ID[int(r['type_id'])]))
for pid in p_types:
    p_types[pid] = [t for _, t in sorted(p_types[pid])]

STAT_IDS = {1: 'hp', 2: 'atk', 3: 'def', 4: 'spa', 5: 'spd', 6: 'spe'}
p_stats = collections.defaultdict(dict)
for r in load('pokemon_stats'):
    pid = int(r['pokemon_id'])
    if pid <= MAX_DEX and int(r['stat_id']) in STAT_IDS:
        p_stats[pid][STAT_IDS[int(r['stat_id'])]] = int(r['base_stat'])

moves = {}
for r in load('moves'):
    mid = int(r['id'])
    if int(r['type_id']) not in KO_BY_ID:
        continue
    moves[mid] = {
        'id': mid,
        'ident': r['identifier'],
        'type': KO_BY_ID[int(r['type_id'])],
        'power': num(r['power']),
        'acc': num(r['accuracy']),
        'pp': num(r['pp'], 10),
        'prio': num(r['priority'], 0),
        'dmg': num(r['damage_class_id'], 1),
        'gen': num(r['generation_id'], 1),
        'chance': num(r['effect_chance']),
        'target': num(r['target_id']),
    }
move_ko = {}
for r in load('move_names'):
    if r['local_language_id'] == KO:
        move_ko[int(r['move_id'])] = r['name']
for mid, m in moves.items():
    m['name'] = move_ko.get(mid) or m['ident'].replace('-', ' ').title()

# 학습 기술: 세대/버전 무관 전체 학습 경로(레벨업>교배>가르침>기술머신)
METHOD_RANK = {'1': 0, '2': 1, '3': 2, '4': 3}
learn = collections.defaultdict(dict)   # pid -> mid -> rank/min-level
for r in load('pokemon_moves'):
    pid = int(r['pokemon_id'])
    if pid > MAX_DEX:
        continue
    mid = int(r['move_id'])
    rank = METHOD_RANK.get(r['pokemon_move_method_id'], 9)
    lvl = num(r['level'], 0) or 0
    key = (rank, lvl)
    if mid not in learn[pid] or key < learn[pid][mid]:
        learn[pid][mid] = key

# 제외 기술(자폭/반동성 과도/고정데미지/1턴빔 제외 등)
BANNED = {
    'self-destruct', 'explosion', 'misty-explosion', 'final-gambit', 'healing-wish',
    'memento', 'pain-split', 'nightmare', 'curse', 'bide', 'mirror-coat', 'counter',
    'metal-burst', 'comeuppance', 'destiny-bond', 'endeavor', 'super-fang', 'natures-madness',
    'ruination', 'seismic-toss', 'night-shade', 'dragon-rage', 'sonic-boom', 'psywave',
    'guillotine', 'horn-drill', 'fissure', 'sheer-cold', 'present', 'fling', 'natural-gift',
    'magnitude', 'beat-up', 'punishment', 'power-trip', 'stored-power', 'grass-knot',
    'low-kick', 'heavy-slam', 'heat-crash', 'electro-ball', 'gyro-ball', 'return',
    'frustration', 'hidden-power', 'secret-power', 'trump-card', 'spit-up', 'rollout',
    'ice-ball', 'fury-cutter', 'echoed-voice', 'round', 'uproar', 'thrash', 'outrage',
    'petal-dance', 'raging-fury', 'solar-blade', 'skull-bash', 'sky-attack', 'razor-wind',
    'freeze-shock', 'ice-burn', 'steel-roller', 'steamroller', 'bolt-beak', 'fishious-rend',
    'dragon-energy', 'tera-blast', 'ivy-cudgel', 'collision-course', 'electro-drift',
    'hydro-steam', 'psyblade', 'aqua-step', 'raging-bull', 'population-bomb',
}

# 힘을 실어 쓰기 좋은 기술(우선순위/선제기) — 선호 가점
RECHARGE = {'hyper-beam', 'giga-impact', 'blast-burn', 'hydro-cannon', 'frenzy-plant',
            'rock-wrecker', 'roar-of-time', 'prismatic-laser', 'eternabeam', 'meteor-assault',
            'draco-meteor', 'overheat', 'leaf-storm', 'psycho-boost', 'fleur-cannon'}

PRIORITY_BONUS = {'extreme-speed', 'quick-attack', 'mach-punch', 'bullet-punch', 'aqua-jet',
                  'ice-shard', 'shadow-sneak', 'vacuum-wave', 'accelerock', 'sucker-punch',
                  'water-shuriken', 'grassy-glide', 'jet-punch'}

# 대표성 높은 변화 기술(1개까지 채용)
UTILITY = {
    'swords-dance', 'nasty-plot', 'calm-mind', 'dragon-dance', 'quiver-dance', 'shell-smash',
    'iron-defense', 'agility', 'rock-polish', 'bulk-up', 'work-up', 'growth', 'curse',
    'recover', 'roost', 'slack-off', 'soft-boiled', 'milk-drink', 'moonlight', 'morning-sun',
    'synthesis', 'shore-up', 'strength-sap', 'giga-drain',
    'sleep-powder', 'spore', 'hypnosis', 'sing', 'grass-whistle', 'lovely-kiss', 'yawn',
    'thunder-wave', 'glare', 'stun-spore', 'will-o-wisp', 'toxic', 'poison-powder',
    'leech-seed', 'protect', 'substitute', 'confuse-ray', 'swagger',
}
UTILITY_KO_PRIORITY = ['수면가루', '최면술', '칼춤', '나쁜음모', '명상', '용의춤', '회복', '전기자석']


def score_move(mid, own_types):
    m = moves[mid]
    if m['dmg'] not in (2, 3) or not m['power'] or m['power'] < 40:
        return -1
    if m['ident'] in BANNED:
        return -1
    acc = m['acc'] if m['acc'] else 100
    if acc < 65:
        return -1
    stab = 1.5 if m['type'] in own_types else 1.0
    s = m['power'] * stab * (acc / 100.0)
    if m['prio'] > 0:
        s *= 1.12
    if m['ident'] in RECHARGE:
        s *= 0.78
    elif m['power'] > 140:
        s *= 0.9
    return s


SIGNATURE = {  # 도감번호 -> 대표 기술(영문 identifier). 실제 학습 가능한 기술만 채택
    3: ['solar-beam', 'razor-leaf', 'sludge-bomb', 'sleep-powder'],
    6: ['flamethrower', 'air-slash', 'dragon-claw', 'blast-burn'],
    9: ['hydro-pump', 'ice-beam', 'surf', 'iron-tail'],
    18: ['air-slash', 'hurricane', 'quick-attack', 'wing-attack'],
    25: ['thunderbolt', 'quick-attack', 'iron-tail', 'volt-tackle'],
    26: ['thunderbolt', 'thunder-wave', 'iron-tail', 'thunder'],
    65: ['psychic', 'shadow-ball', 'focus-blast', 'calm-mind'],
    68: ['close-combat', 'earthquake', 'stone-edge', 'dynamic-punch'],
    94: ['shadow-ball', 'sludge-bomb', 'dark-pulse', 'hypnosis'],
    130: ['hydro-pump', 'ice-fang', 'waterfall', 'dragon-dance'],
    131: ['ice-beam', 'surf', 'thunderbolt', 'sing'],
    143: ['body-slam', 'earthquake', 'ice-punch', 'rest'],
    149: ['dragon-claw', 'air-slash', 'earthquake', 'hurricane'],
    150: ['psystrike', 'shadow-ball', 'aura-sphere', 'recover'],
    151: ['psychic', 'shadow-ball', 'aura-sphere', 'calm-mind'],
    248: ['stone-edge', 'crunch', 'earthquake', 'iron-tail'],
    249: ['aeroblast', 'surf', 'extreme-speed', 'calm-mind'],
    250: ['sacred-fire', 'extreme-speed', 'brave-bird', 'calm-mind'],
    282: ['psychic', 'moonblast', 'shadow-ball', 'calm-mind'],
    384: ['dragon-ascent', 'dragon-claw', 'earthquake', 'dragon-dance'],
    445: ['earthquake', 'dragon-claw', 'stone-edge', 'swords-dance'],
    448: ['close-combat', 'dark-pulse', 'dragon-pulse', 'calm-mind'],
    479: ['thunderbolt', 'shadow-ball', 'volt-switch', 'thunder-wave'],
    483: ['roar-of-time', 'dragon-claw', 'flamethrower', 'ice-beam'],
    484: ['spacial-rend', 'surf', 'thunderbolt', 'ice-beam'],
    487: ['shadow-force', 'dragon-claw', 'earthquake', 'calm-mind'],
    493: ['judgment', 'earthquake', 'flamethrower', 'calm-mind'],
    571: ['nasty-plot', 'dark-pulse', 'night-daze', 'sucker-punch'],
    658: ['water-shuriken', 'dark-pulse', 'ice-beam', 'extrasensory'],
    700: ['moonblast', 'magical-shine', 'shadow-ball', 'calm-mind'],
    706: ['draco-meteor', 'dragon-pulse', 'power-whip', 'earthquake'],
    724: ['spirit-shackle', 'leaf-blade', 'sucker-punch', 'swords-dance'],
    778: ['shadow-claw', 'play-rough', 'shadow-sneak', 'swords-dance'],
    784: ['scale-shot', 'dragon-claw', 'earthquake', 'swords-dance'],
    809: ['double-iron-bash', 'thunderbolt', 'ice-punch', 'earthquake'],
    849: ['overdrive', 'boomburst', 'thunderbolt', 'sludge-bomb'],
    869: ['magical-shine', 'moonblast', 'recover', 'calm-mind'],
    887: ['dragon-darts', 'shadow-ball', 'thunderbolt', 'dragon-dance'],
    890: ['dynamax-cannon', 'dragon-pulse', 'flamethrower', 'toxic'],
    959: ['gigaton-hammer', 'play-rough', 'knock-off', 'swords-dance'],
    1007: ['close-combat', 'dragon-claw', 'swords-dance', 'flame-charge'],
    1024: ['earth-power', 'double-edge', 'surf', 'calm-mind'],
}


def pick_moves(pid, own_types):
    pool = {}
    for mid, key in learn[pid].items():
        s = score_move(mid, own_types)
        if s > 0:
            pool[mid] = s
    chosen = []
    # 1) 자속 기술 상위 2개(가능하면 물리/특수 각각)
    stab = sorted([m for m in pool if moves[m]['type'] in own_types], key=lambda m: -pool[m])
    for mid in stab[:2]:
        chosen.append(mid)
    # 2) 타입 견제: 아직 없는 타입 중 최고 점수
    used_types = {moves[m]['type'] for m in chosen}
    while len(chosen) < 3:
        cand = [m for m in pool if m not in chosen and moves[m]['type'] not in used_types]
        if not cand:
            break
        best = max(cand, key=lambda m: pool[m])
        chosen.append(best)
        used_types.add(moves[best]['type'])
    # 3) 남은 자리: 점수 순
    rest = sorted([m for m in pool if m not in chosen], key=lambda m: -pool[m])
    for mid in rest:
        if len(chosen) >= 4:
            break
        chosen.append(mid)
    # 4) 변화 기술 1개(있으면 마지막 자리 교체)
    util = [mid for mid in learn[pid] if moves[mid]['ident'] in UTILITY and moves[mid]['ident'] != 'giga-drain']
    if util and len(chosen) >= 4:
        util.sort(key=lambda mid: (moves[mid]['ident'] not in ('swords-dance', 'nasty-plot', 'calm-mind',
                                                                'dragon-dance', 'quiver-dance', 'shell-smash')))
        chosen[3] = util[0]
    while len(chosen) < 4:
        # 최후 fallback: 자속 기술 아무거나 / 몸통박치기
        fb = [mid for mid in learn[pid] if moves[mid]['dmg'] in (2, 3)]
        if fb:
            chosen.append(sorted(fb, key=lambda m: -(moves[m]['power'] or 0))[0])
        else:
            chosen.append(33)
    out = []
    for mid in chosen:
        if mid not in out:
            out.append(mid)
    return out[:4]


dex = []
missing = []
moves_used = set()
for pid in range(1, MAX_DEX + 1):
    p = pokes.get(pid)
    name = sp_names.get(pid)
    if not p or not name:
        missing.append(pid)
        continue
    st = p_stats.get(pid)
    tp = p_types.get(pid)
    if not st or not tp:
        missing.append(pid)
        continue
    sp = species.get(pid, {})
    ms = pick_moves(pid, tp)
    if pid in SIGNATURE:
        learnable = {mid for mid in learn[pid]}
        ident2id = {m['ident']: mid for mid, m in moves.items()}
        over = []
        for en in SIGNATURE[pid]:
            found = ident2id.get(en)
            if found and found in learnable and found not in over:
                over.append(found)
        if len(over) >= 3:
            for mid in ms:
                if mid not in over and len(over) < 4:
                    over.append(mid)
            ms = over[:4]
    for mid in ms:
        moves_used.add(mid)
    dex.append({
        'id': pid,
        'n': name,
        'en': p['identifier'],
        't': tp,
        'gen': num(sp.get('generation_id'), 1),
        'st': [st.get('hp', 50), st.get('atk', 50), st.get('def', 50),
               st.get('spa', 50), st.get('spd', 50), st.get('spe', 50)],
        'lg': 1 if sp.get('is_legendary') == '1' else 0,
        'my': 1 if sp.get('is_mythical') == '1' else 0,
        'ht': num(p['height'], 10),
        'wt': num(p['weight'], 100),
        'mv': ms,
    })

# 기술 테이블(사용되는 기술만)
move_out = {}
for mid in sorted(moves_used):
    m = moves[mid]
    move_out[str(mid)] = {
        'n': m['name'], 'en': m['ident'], 't': m['type'],
        'c': {1: '변화', 2: '물리', 3: '특수'}.get(m['dmg'], '물리'),
        'p': m['power'] or 0, 'a': m['acc'] if m['acc'] else 100,
        'pp': m['pp'], 'pr': m['prio'], 'ch': m['chance'] or 0,
    }

# 타입 상성
eff = {}
for r in load('type_efficacy'):
    if int(r['damage_type_id']) not in KO_BY_ID or int(r['target_type_id']) not in KO_BY_ID:
        continue
    atk = KO_BY_ID[int(r['damage_type_id'])]
    dfn = KO_BY_ID[int(r['target_type_id'])]
    eff.setdefault(atk, {})[dfn] = int(r['damage_factor']) / 100.0

data = {
    'generated': 'PokeAPI CSV snapshot (pokemon.csv / pokemon_moves.csv / moves.csv)',
    'types': [KO_BY_ID[TYPE_ID[t]] for t in TYPE_ORDER],
    'typeEn': TYPE_ORDER,
    'dex': dex,
    'moves': move_out,
    'eff': eff,
}

js = ('/* 1~9세대 전국도감 1,025종 데이터 (자동 생성: tools/build_data.py, PokeAPI CSV 기반) */\n'
      'export const DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(js)

print('dex entries:', len(dex), 'missing:', missing[:20], len(missing))
print('moves used:', len(move_out))
print('data.js bytes:', len(js.encode('utf-8')))
gaps = [d['id'] for d in dex if len(d['mv']) != 4]
print('pokemon with !=4 moves:', len(gaps), gaps[:10])
# 샘플 확인
for pid in (25, 3, 6, 150, 448, 1025):
    d = next((x for x in dex if x['id'] == pid), None)
    if d:
        print(pid, d['n'], d['t'], d['st'], [move_out[str(m)]['n'] for m in d['mv']])
