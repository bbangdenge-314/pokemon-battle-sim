import subprocess, time, os, sys, json
from playwright.sync_api import sync_playwright

PORT = 8871
ROOT = '/workspace/pokemon-battle-sim'
OUT = '/workspace/downloads/pokemon-battle-sim'
os.makedirs(OUT, exist_ok=True)
srv = subprocess.Popen(['python3', '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)

MODE = int(sys.argv[1]) if len(sys.argv) > 1 else 3
STAGE = sys.argv[2] if len(sys.argv) > 2 else 'stadium'
WEATHER = sys.argv[3] if len(sys.argv) > 3 else 'clear'
TAG = sys.argv[4] if len(sys.argv) > 4 else f'{MODE}v{MODE}_{STAGE}'
W, H = (1440, 900) if (len(sys.argv) < 6 or sys.argv[5] == 'pc') else (390, 844)

TEAMS = {
    1: ([25], [94]),
    2: ([25, 143], [149, 6]),
    3: ([25, 143, 6], [149, 94, 248]),
}

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': W, 'height': H})
        pg = ctx.new_page()
        errs = []
        pg.on('console', lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append(f"pageerror: {e}"))
        pg.goto(f'http://127.0.0.1:{PORT}/', wait_until='networkidle')
        pg.wait_for_timeout(500)
        pg.evaluate("([m,s,w]) => { window.PBS.setMode(m); window.PBS.setStage(s); window.PBS.setWeather(w); }", [MODE, STAGE, WEATHER])
        A, B = TEAMS[MODE]
        pg.evaluate("([A,B]) => window.PBS.setTeams(A,B)", [A, B])
        pg.wait_for_timeout(300)
        pg.evaluate("() => window.PBS.start()")
        pg.wait_for_selector('#screenBattle.active', timeout=8000)
        t0 = time.time()
        shots = 0
        while time.time() - t0 < 40 and shots < 4:
            pg.wait_for_timeout(1400)
            pg.screenshot(path=f'{OUT}/t_{TAG}_{shots}.png')
            info = pg.evaluate("""() => {
              const b = window.PBS.battle();
              return { t: b?.battle?.time, alive: b?.battle ? [b.battle.aliveA.length, b.battle.aliveB.length] : null,
                       hp: b?.battle ? b.battle.all.map(f=>Math.round(f.hp/f.maxHp*100)) : null,
                       proj: b?.battle?.projectiles.length, bubbles: b?.battle ? b.battle.all.filter(f=>f.bubble).length : 0,
                       casts: b?.battle?.castCount, dodges: b?.battle?.dodgeCount };
            }""")
            print(shots, info)
            shots += 1
        print('ERRORS', len(errs))
        for e in errs[:12]:
            print(' ', e)
        ctx.close(); b.close()
finally:
    srv.terminate()
