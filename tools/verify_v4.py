"""v4 검증 — 배속 세밀 조절 · 중계 가독성 · 기술 기믹(잎/물/번개/불꽃/얼음)

PC 1440×900 · 모바일 390×844 실브라우저에서 실제 전투를 돌리며
1) 기본 시뮬레이션 배율(0.65x)과 0.5x~3x 버튼 동작
2) 중계 텍스트 실제 렌더 크기(px)와 잘림 여부
3) 나뭇잎 · 물대포 · 번개 감전 · 화염 · 냉동 기믹 스크린샷
4) 콘솔 에러 0건
을 확인하고 downloads/pokemon-battle-sim/v4_*.png 로 남깁니다.
"""
import subprocess, time, os, json, sys
from playwright.sync_api import sync_playwright

PORT = 8891
ROOT = '/workspace/pokemon-battle-sim'
OUT = '/workspace/downloads/pokemon-battle-sim'
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.9)

report = {'cases': [], 'errors': [], 'checks': {}}
A_TEAM, B_TEAM = [3, 9, 25], [6, 144, 130]   # 이상해꽃(풀) 거북왕(물) 피카츄(전기) vs 리자몽(불꽃) 프리져(얼음) 갸라도스(물)


def setup(pg, mode, stage, weather, A, B):
    pg.goto(f'http://127.0.0.1:{PORT}/', wait_until='networkidle')
    pg.wait_for_timeout(500)
    pg.evaluate("([m,s,w]) => { window.PBS.setMode(m); window.PBS.setStage(s); window.PBS.setWeather(w); }",
                [mode, stage, weather])
    pg.evaluate("([A,B]) => window.PBS.setTeams(A,B)", [A, B])
    pg.wait_for_timeout(200)
    pg.evaluate("() => window.PBS.start()")
    pg.wait_for_selector('#screenBattle.active', timeout=12000)
    pg.wait_for_timeout(900)


def ensure_battle(pg):
    """결과 화면이 떠 있으면 다시 배틀"""
    if pg.evaluate("() => document.querySelector('#resultOverlay').classList.contains('show')"):
        pg.evaluate("() => { document.querySelector('#resultOverlay').classList.remove('show'); window.PBS.start(); }")
        pg.wait_for_timeout(1200)


def inject(pg, ev):
    pg.evaluate("(e) => window.PBS.battle()._onEvent(e)", ev)


def shot(pg, name, wait=260):
    pg.wait_for_timeout(wait)
    pg.screenshot(path=f'{OUT}/{name}.png')


def measure_castbar(pg):
    return pg.evaluate("""() => {
      const bar = document.querySelector('.cast-bar');
      const lines = [...document.querySelectorAll('.cast-line')];
      const last = lines[lines.length - 1], prev = lines[lines.length - 2];
      const cs = last ? getComputedStyle(last) : null;
      const span = last ? last.querySelector('span') : null;
      return {
        barH: Math.round(bar.getBoundingClientRect().height),
        lines: lines.length,
        lastSize: cs ? parseFloat(cs.fontSize) : 0,
        lastWeight: cs ? cs.fontWeight : '',
        prevSize: prev ? parseFloat(getComputedStyle(prev).fontSize) : 0,
        spanClientW: span ? span.clientWidth : 0,
        truncated: span ? span.scrollHeight > span.clientHeight + 1 : false,
        text: last ? last.innerText.replace(/\\n/g, ' | ') : ''
      };
    }""")


def speed_probe(pg, speed, secs=1.3):
    ensure_battle(pg)
    pg.evaluate("(s) => { const b = window.PBS.battle(); b.speed = s; b.paused = false; }", speed)
    pg.wait_for_timeout(200)
    t0 = pg.evaluate("() => window.PBS.battle().battle.time")
    w0 = time.time()
    pg.wait_for_timeout(int(secs * 1000))
    t1 = pg.evaluate("() => window.PBS.battle().battle.time")
    dt = time.time() - w0
    return round((t1 - t0) / dt, 3)


try:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ================= PC =================
        ctx = b.new_context(viewport={'width': 1440, 'height': 900})
        pg = ctx.new_page()
        errs = []
        pg.on('console', lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))
        setup(pg, 3, 'stadium', 'clear', A_TEAM, B_TEAM)
        pg.screenshot(path=f'{OUT}/v4_pc_01_battle_start.png')

        # --- 배속 (같은 조건에서 상대 비율 측정) ---
        r1 = speed_probe(pg, 1)
        r2 = speed_probe(pg, 2)
        r3 = speed_probe(pg, 3)
        r05 = speed_probe(pg, .5)
        base = r1 or .001
        report['checks']['speed_probe'] = {
            'abs': {'1x': r1, '2x': r2, '3x': r3, '0.5x': r05},
            'ratio_vs_1x': {k: round(v / base, 2) for k, v in
                            {'2x': r2, '3x': r3, '0.5x': r05}.items()}
        }
        # 버튼 클릭이 실제 배속·시뮬레이션 배율로 이어지는지
        report['checks']['speed_ui'] = []
        for v in ['0.5', '0.75', '1', '1.5', '2', '3']:
            pg.click(f'#speedGroup button[data-speed="{v}"]')
            pg.wait_for_timeout(80)
            i = pg.evaluate("() => window.PBS.battle().info()")
            on = pg.evaluate("() => document.querySelector('#speedGroup button.on').dataset.speed")
            report['checks']['speed_ui'].append({'btn': v, 'speed': i['speed'], 'simScale': i['simScale'], 'active': on})
        pg.click('#speedGroup button[data-speed="1"]')

        # --- 중계 가독성 ---
        t0 = time.time()
        while time.time() - t0 < 14:
            cb = measure_castbar(pg)
            if cb['lines'] >= 2:
                break
            pg.wait_for_timeout(250)
        report['checks']['pc_castbar'] = cb
        pg.screenshot(path=f'{OUT}/v4_pc_02_castbar.png')

        # --- 실제 전투 중 기술 교환 ---
        t0 = time.time()
        while time.time() - t0 < 14:
            info = pg.evaluate("() => window.PBS.battle().info()")
            if info['casts'] >= 2 and (info['fx'] > 0 or info['parts'] > 8):
                break
            pg.wait_for_timeout(150)
        pg.screenshot(path=f'{OUT}/v4_pc_03_live_skill.png')

        # --- 기믹 연출 (결정적 주입) ---
        ensure_battle(pg)
        shot(pg, 'v4_pc_04_leaf_volley', 60)
        pg.evaluate("""() => {
          const b = window.PBS.battle();
          b._onEvent({t:'fx', fx:'volley', kind:'volley', shape:'leaf', type:'풀', color:'#5fc24a', second:'#d9ffcf',
                      x:0.24, y:0.74, tx:0.7, ty:0.5});
          const s = b.battle; const o = s.A[0], tg = s.B[0];
          for (let i = 0; i < 5; i++) s.projectiles.push({x:o.x, y:o.y, vx:.62, vy:-.14+i*.06, side:'A',
            owner:o, target:tg, move:{t:'풀', n:'잎날가르기'},
            spec:{kind:'volley', shape:'leaf', color:'#5fc24a', second:'#d9ffcf'}, life:1.5, r:.03, dodged:false, homing:0});
        }""")
        pg.wait_for_timeout(420)
        pg.screenshot(path=f'{OUT}/v4_pc_05_leaf_flight.png')

        pg.evaluate("""() => window.PBS.battle()._onEvent({t:'fx', fx:'stream', kind:'stream', shape:'water', type:'물',
            color:'#2f8fe6', second:'#c8ecff', x:0.24, y:0.74, tx:0.72, ty:0.52, big:true})""")
        shot(pg, 'v4_pc_06_water_gun', 300)
        pg.screenshot(path=f'{OUT}/v4_pc_07_water_splash.png')

        ensure_battle(pg)
        pg.evaluate("""() => window.PBS.battle()._onEvent({t:'fx', fx:'bolt', kind:'bolt', type:'전기', big:true,
            color:'#ffd93b', second:'#fffbe0', x:0.7, y:0.52, tx:0.7, ty:0.52})""")
        pg.wait_for_timeout(120)
        pg.evaluate("""() => { const f = window.PBS.battle().battle.B[0];
            f.hitFx = {type:'전기', t:0, dur:.8, color:'#ffd93b', second:'#fffbe0'}; }""")
        pg.wait_for_timeout(110)
        pg.screenshot(path=f'{OUT}/v4_pc_08_thunder_zap.png')

        ensure_battle(pg)
        pg.evaluate("""() => window.PBS.battle()._onEvent({t:'fx', fx:'stream', kind:'stream', shape:'flame', type:'불꽃',
            color:'#ff6a2b', second:'#ffd166', x:0.24, y:0.74, tx:0.72, ty:0.52, big:true})""")
        pg.wait_for_timeout(260)
        pg.evaluate("""() => { const f = window.PBS.battle().battle.B[0];
            f.hitFx = {type:'불꽃', t:0, dur:.8, color:'#ff6a2b', second:'#ffd166'}; }""")
        pg.wait_for_timeout(110)
        pg.screenshot(path=f'{OUT}/v4_pc_09_flamethrower_burn.png')

        ensure_battle(pg)
        pg.evaluate("""() => window.PBS.battle()._onEvent({t:'fx', fx:'beam', kind:'beam', shape:'ice', type:'얼음',
            color:'#66d9e8', second:'#ffffff', x:0.24, y:0.74, tx:0.72, ty:0.52, big:true})""")
        pg.wait_for_timeout(240)
        pg.evaluate("""() => { const f = window.PBS.battle().battle.B[0];
            f.hitFx = {type:'얼음', t:0, dur:.8, color:'#66d9e8', second:'#ffffff'}; f.status = 'frz'; }""")
        pg.wait_for_timeout(110)
        pg.screenshot(path=f'{OUT}/v4_pc_10_ice_beam_freeze.png')

        # --- 오버플로 / 버튼 배치 ---
        report['checks']['pc_overflow'] = pg.evaluate(
            "() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth})")
        report['checks']['pc_speedbtns'] = pg.evaluate("""() => [...document.querySelectorAll('#speedGroup button')].map(b => ({
            v: b.dataset.speed, on: b.classList.contains('on'),
            w: Math.round(b.getBoundingClientRect().width),
            inView: b.getBoundingClientRect().left >= 0 && b.getBoundingClientRect().right <= window.innerWidth
        }))""")
        pg.screenshot(path=f'{OUT}/v4_pc_11_speed_buttons.png')
        report['cases'].append({'case': 'pc_3v3', 'errors': errs})
        report['errors'].extend(errs)
        ctx.close()

        # ================= 모바일 =================
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                            is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        errs2 = []
        pg.on('console', lambda m: errs2.append(f"console.{m.type}: {m.text}") if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs2.append(f"pageerror: {e}"))
        setup(pg, 2, 'forest', 'clear', [3, 25], [6, 9])
        pg.screenshot(path=f'{OUT}/v4_m_01_battle.png')
        t0 = time.time()
        cb2 = None
        while time.time() - t0 < 14:
            cb2 = measure_castbar(pg)
            if cb2['lines'] >= 1:
                break
            pg.wait_for_timeout(250)
        report['checks']['m_castbar'] = cb2
        pg.screenshot(path=f'{OUT}/v4_m_02_castbar.png')

        ensure_battle(pg)
        pg.evaluate("""() => {
          const b = window.PBS.battle();
          b._onEvent({t:'fx', fx:'stream', kind:'stream', shape:'water', type:'물', color:'#2f8fe6', second:'#c8ecff',
                      x:0.24, y:0.74, tx:0.72, ty:0.54, big:true});
          const s = b.battle, o = s.A[0], tg = s.B[0];
          for (let i = 0; i < 4; i++) s.projectiles.push({x:o.x, y:o.y, vx:.6, vy:-.12+i*.06, side:'A',
            owner:o, target:tg, move:{t:'풀', n:'잎날가르기'},
            spec:{kind:'volley', shape:'leaf', color:'#5fc24a', second:'#d9ffcf'}, life:1.5, r:.03, dodged:false, homing:0});
          tg.hitFx = {type:'전기', t:0, dur:.8, color:'#ffd93b', second:'#fffbe0'};
        }""")
        shot(pg, 'v4_m_03_water_leaf', 300)
        pg.evaluate("() => { const b = window.PBS.battle(); b.speed = 2; }")
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{OUT}/v4_m_04_speed2x.png')
        report['checks']['m_overflow'] = pg.evaluate(
            "() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth})")
        report['checks']['m_speedbtns'] = pg.evaluate("""() => [...document.querySelectorAll('#speedGroup button')].map(b => {
            const r = b.getBoundingClientRect();
            return {v: b.dataset.speed, l: Math.round(r.left), r: Math.round(r.right), inView: r.left >= 0 && r.right <= window.innerWidth};
        })""")
        report['cases'].append({'case': 'mobile_2v2', 'errors': errs2})
        report['errors'].extend(errs2)
        ctx.close()
        b.close()
finally:
    srv.terminate()

report['console_error_count'] = len(report['errors'])
with open(f'{OUT}/verify_v4_report.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print(json.dumps({k: v for k, v in report.items() if k != 'cases'}, ensure_ascii=False, indent=2)[:3000])
