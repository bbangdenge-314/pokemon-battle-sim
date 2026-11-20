import subprocess, time, os, json, sys
from playwright.sync_api import sync_playwright

PORT = 8880
ROOT = '/workspace/pokemon-battle-sim'
OUT = '/workspace/downloads/pokemon-battle-sim'
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.9)

results = []
errors_all = []

def set_common(pg, mode, stage, weather, A, B):
    pg.goto(f'http://127.0.0.1:{PORT}/', wait_until='networkidle')
    pg.wait_for_timeout(600)
    pg.evaluate("([m,s,w]) => { window.PBS.setMode(m); window.PBS.setStage(s); window.PBS.setWeather(w); }", [mode, stage, weather])
    pg.evaluate("([A,B]) => window.PBS.setTeams(A,B)", [A, B])
    pg.wait_for_timeout(250)

def wait_battle_end(pg, limit=70):
    t0 = time.time()
    while time.time() - t0 < limit:
        if pg.evaluate("document.querySelector('#resultOverlay').classList.contains('show')"):
            return True
        pg.wait_for_timeout(350)
    return False

def shot_when(pg, path, cond, limit=40, label=''):
    """cond: JS expression string returning boolean in page"""
    t0 = time.time()
    while time.time() - t0 < limit:
        try:
            ok = pg.evaluate(f"() => {{ const i = window.PBS.battle().info(); return ({cond}); }}")
        except Exception:
            ok = False
        if ok:
            pg.screenshot(path=path)
            return True
        pg.wait_for_timeout(180)
    pg.screenshot(path=path)
    return False

def run_pc_case(browser, name, mode, stage, weather, A, B, caps):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))
    set_common(pg, mode, stage, weather, A, B)
    pg.evaluate("() => window.PBS.start()")
    pg.wait_for_selector('#screenBattle.active', timeout=10000)
    pg.wait_for_timeout(900)
    pg.screenshot(path=f'{OUT}/v3_{name}_01_start.png')

    got = []
    # 1) 초반 기술 교환
    ok = shot_when(pg, f'{OUT}/v3_{name}_02_skill.png',
                   "i.bubbles>=2 && (i.fx>0 || i.parts>10)", 25)
    got.append(('skill', ok))
    pg.wait_for_timeout(500)
    # 2) 말풍선 + 중계 (최대 개수)
    if mode >= 2:
        ok = shot_when(pg, f'{OUT}/v3_{name}_03_bubbles.png',
                       f"i.bubbles>={min(3, mode + 1)} && i.castLines>=1", 30)
        got.append(('bubbles', ok))
    # 3) 한타 (근접 클러스터)
    ok = shot_when(pg, f'{OUT}/v3_{name}_04_teamfight.png',
                   "i.bubbles>=2 && (i.parts>6 || i.fx>0) && i.dodges>=1", 30)
    got.append(('teamfight', ok))
    ended = wait_battle_end(pg, 70)
    pg.wait_for_timeout(700)
    pg.screenshot(path=f'{OUT}/v3_{name}_05_result.png')
    info = pg.evaluate("() => window.PBS.battle().info()")
    try:
        pg.click('.result-log-wrap summary'); pg.wait_for_timeout(400)
        pg.screenshot(path=f'{OUT}/v3_{name}_06_result_log.png')
    except Exception:
        pass
    res = {'case': name, 'mode': mode, 'stage': stage, 'weather': weather, 'ended': ended,
           'shots': got, **{k: info[k] for k in ('casts', 'dodges', 'hits', 'time')}, 'result': info['result'], 'errors': errs}
    results.append(res)
    errors_all.extend(errs)
    print(f"[{name}] ended={ended} casts={info['casts']} dodges={info['dodges']} hits={info['hits']} "
          f"time={info['time']} result={info['result']} shots={got} errors={len(errs)}")
    ctx.close()

def run_mobile_case(browser, name, mode, stage, weather, A, B):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))
    set_common(pg, mode, stage, weather, A, B)
    pg.screenshot(path=f'{OUT}/v3_m_{name}_01_preview.png', full_page=False)
    pg.evaluate("() => window.PBS.start()")
    pg.wait_for_selector('#screenBattle.active', timeout=10000)
    pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{OUT}/v3_m_{name}_02_battle.png')
    ok = shot_when(pg, f'{OUT}/v3_m_{name}_03_skill.png', "i.bubbles>=2 && (i.fx>0 || i.parts>6)", 30)
    ended = wait_battle_end(pg, 70)
    pg.wait_for_timeout(700)
    pg.screenshot(path=f'{OUT}/v3_m_{name}_04_result.png')
    info = pg.evaluate("() => window.PBS.battle().info()")
    res = {'case': f'mobile_{name}', 'mode': mode, 'stage': stage, 'weather': weather, 'ended': ended,
           'skillShot': ok, 'result': info['result'], 'errors': errs}
    results.append(res)
    errors_all.extend(errs)
    print(f"[mobile {name}] ended={ended} result={info['result']} skill={ok} errors={len(errs)}")
    ctx.close()

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        run_pc_case(b, '1v1', 1, 'stadium', 'clear', [6], [9], {})
        run_pc_case(b, '2v2', 2, 'beach', 'rain', [25, 6], [149, 9], {})
        run_pc_case(b, '3v3', 3, 'volcano', 'sun', [25, 6, 3], [149, 94, 9], {})
        run_mobile_case(b, '3v3', 3, 'city', 'clear', [25, 6, 3], [149, 94, 9])
        run_mobile_case(b, '2v2', 2, 'snow', 'hail', [25, 6], [149, 9])
        b.close()
finally:
    srv.terminate()

print(json.dumps(results, ensure_ascii=False, indent=1)[:4000])
print('TOTAL ERRORS', len(errors_all))
for e in errors_all[:20]:
    print(' ', e)
with open(f'{OUT}/verify_v3_report.json', 'w', encoding='utf-8') as f:
    json.dump({'results': results, 'errors': errors_all}, f, ensure_ascii=False, indent=1)
