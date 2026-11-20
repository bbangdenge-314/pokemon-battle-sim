import subprocess, time, os, json, sys
from playwright.sync_api import sync_playwright
PORT=8894
ROOT='/workspace/pokemon-battle-sim'
srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1440,'height':900})
    pg=ctx.new_page()
    errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{PORT}/',wait_until='networkidle'); pg.wait_for_timeout(500)
    pg.evaluate("([m,s,w])=>{window.PBS.setMode(m);window.PBS.setStage(s);window.PBS.setWeather(w)}",[3,'stadium','clear'])
    pg.evaluate("([A,B])=>window.PBS.setTeams(A,B)",[[3,9,25],[6,144,130]])
    pg.evaluate("()=>window.PBS.start()"); pg.wait_for_selector('#screenBattle.active'); pg.wait_for_timeout(1500)
    r=pg.evaluate("""async () => {
      const b = window.PBS.battle();
      let frames=0, t0=performance.now();
      await new Promise(res=>{
        const tick=()=>{frames++;
          if(performance.now()-t0<3000) requestAnimationFrame(tick); else res();};
        requestAnimationFrame(tick);
      });
      const dur=(performance.now()-t0)/1000;
      const info=b.info();
      return {fps: +(frames/dur).toFixed(1), simAdvance:+info.time.toFixed(2), fx:info.fx, parts:info.parts, proj:info.proj};
    }""")
    print(json.dumps(r,ensure_ascii=False), 'pageerrors', errs[:3])
    b.close()
finally:
  srv.terminate()
