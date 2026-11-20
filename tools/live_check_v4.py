"""라이브(GitHub Pages) 배포 확인 — 실제 URL에서 전투 1회 실행"""
import json, time
from playwright.sync_api import sync_playwright
URL = 'https://bbangdenge-314.github.io/pokemon-battle-sim/'
out = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until='networkidle')
    pg.wait_for_timeout(1200)
    out['http_ok'] = pg.title()
    pg.evaluate("([m,s,w])=>{window.PBS.setMode(m);window.PBS.setStage(s);window.PBS.setWeather(w)}", [2, 'stadium', 'clear'])
    pg.evaluate("([A,B])=>window.PBS.setTeams(A,B)", [[3, 25], [6, 9]])
    pg.wait_for_timeout(300)
    pg.evaluate("()=>window.PBS.start()")
    pg.wait_for_selector('#screenBattle.active', timeout=15000)
    pg.wait_for_timeout(2500)
    out['speedBtns'] = pg.evaluate("()=>[...document.querySelectorAll('#speedGroup button')].map(b=>b.dataset.speed)")
    out['active'] = pg.evaluate("()=>document.querySelector('#speedGroup button.on').dataset.speed")
    out['info'] = pg.evaluate("()=>window.PBS.battle().info()")
    out['cast'] = pg.evaluate("""()=>{const l=[...document.querySelectorAll('.cast-line')];const last=l[l.length-1];
        return last?{fs:parseFloat(getComputedStyle(last).fontSize),w:parseFloat(getComputedStyle(last).fontWeight),text:last.innerText.replace(/\\n/g,' | ')}:null}""")
    pg.screenshot(path='/workspace/downloads/pokemon-battle-sim/v4_live_battle.png')
    ctx.close(); b.close()
out['errors'] = errs[:6]
out['errorCount'] = len(errs)
print(json.dumps(out, ensure_ascii=False, indent=2)[:1800])
