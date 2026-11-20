import subprocess, time, os, json, sys
from playwright.sync_api import sync_playwright

PORT = 8860
ROOT = '/workspace/pokemon-battle-sim'
OUT = '/workspace/downloads/pokemon-battle-sim'
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.9)

results = []
errors_all = []

def run_case(browser, name, mode, stage, weather, A, B):
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))

    pg.goto(f'http://127.0.0.1:{PORT}/', wait_until='networkidle')
    pg.wait_for_timeout(700)
    pg.screenshot(path=f'{OUT}/00_intro.png')
    pg.click('#startBtn')
    pg.wait_for_timeout(350)
    if mode != 1:
        pg.click(f'.mode-card[data-mode="{mode}"]')
        pg.wait_for_timeout(250)
    pg.click('#navNext'); pg.wait_for_timeout(900)
    pg.click(f'.stage-card[data-stage="{stage}"]'); pg.wait_for_timeout(350)
    pg.screenshot(path=f'{OUT}/01_stage_{name}.png')
    pg.click('#navNext'); pg.wait_for_timeout(900)
    pg.click(f'.weather-card[data-weather="{weather}"]'); pg.wait_for_timeout(400)
    if name == '3v3':
        pg.screenshot(path=f'{OUT}/02_weather_{name}.png')
    pg.click('#navNext'); pg.wait_for_timeout(400)
    pg.evaluate("([A,B]) => window.PBS.setTeams(A,B)", [A, B])
    pg.wait_for_timeout(500)
    pg.screenshot(path=f'{OUT}/03_pick_{name}.png')
    # 도감 모달
    pg.click('#teamA .slot.filled')
    pg.wait_for_timeout(700)
    if name == '3v3':
        pg.screenshot(path=f'{OUT}/04_picker_{name}.png')
    pg.click('#pickerClose'); pg.wait_for_timeout(200)
    pg.click('#navNext'); pg.wait_for_timeout(900)
    pg.screenshot(path=f'{OUT}/05_preview_{name}.png', full_page=True)

    # 배속 1x로 설정해 연출 캡처
    pg.once('dialog', lambda d: d.accept())
    pg.click('#startBattle')
    pg.wait_for_selector('#screenBattle.active', timeout=10000)
    pg.wait_for_timeout(2600)
    pg.screenshot(path=f'{OUT}/06_battle_start_{name}.png')
    # 스킬 연출 캡처 (move-toast 가 뜨면 잠시 뒤)
    shots = 0
    t0 = time.time()
    while shots < 2 and time.time() - t0 < 25:
        try:
            pg.wait_for_selector('.move-toast.show', timeout=4000)
            pg.wait_for_timeout(260)
            pg.screenshot(path=f'{OUT}/07_skill_{name}_{shots + 1}.png')
            shots += 1
            pg.wait_for_timeout(1200)
        except Exception:
            break
    # 결과 대기
    ended = False
    t1 = time.time()
    while time.time() - t1 < 90:
        if pg.evaluate("document.querySelector('#resultOverlay').classList.contains('show')"):
            ended = True
            break
        pg.wait_for_timeout(400)
    pg.wait_for_timeout(900)
    pg.screenshot(path=f'{OUT}/08_result_{name}.png')
    try:
        pg.click('.result-log-wrap summary')
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'{OUT}/08b_result_log_{name}.png')
    except Exception:
        pass
    info = pg.evaluate("""() => ({
        winner: document.querySelector('#winnerTitle').textContent,
        sub: document.querySelector('#resultSub').textContent,
        mvp: document.querySelector('#mvpBox').textContent.trim().slice(0,80),
        logs: document.querySelectorAll('.log-line').length,
        turn: document.querySelector('#turnChip').textContent,
        teams: [window.PBS.state.teams.A, window.PBS.state.teams.B]
    })""")
    results.append({'case': name, 'mode': mode, 'stage': stage, 'weather': weather, 'ended': ended, 'skill_shots': shots, **info, 'errors': errs})
    errors_all.extend(errs)
    ctx.close()
    print(f"[{name}] ended={ended} winner={info['winner']} logs={info['logs']} skillShots={shots} errors={len(errs)}")


try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        run_case(b, '1v1', 1, 'stadium', 'clear', [6], [130])
        run_case(b, '2v2', 2, 'beach', 'rain', [3, 130], [9, 248])
        run_case(b, '3v3', 3, 'volcano', 'sun', [150, 445, 448], [149, 94, 248])
        b.close()
finally:
    srv.terminate()

print(json.dumps(results, ensure_ascii=False, indent=2)[:3000])
print('TOTAL ERRORS', len(errors_all))
for e in errors_all[:20]: print(' ', e)
