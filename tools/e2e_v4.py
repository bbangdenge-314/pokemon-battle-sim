import subprocess, time, json
from playwright.sync_api import sync_playwright
PORT=8901; ROOT='/workspace/pokemon-battle-sim'; OUT='/workspace/downloads/pokemon-battle-sim'
srv=subprocess.Popen(['python3','-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(0.8)
res={}
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    for tag,mode,A,B,stage,weather,wh in [('1v1',1,[6],[9],'beach','rain',(1440,900)),('3v3',3,[3,9,25],[6,144,130],'volcano','sun',(1440,900))]:
      ctx=b.new_context(viewport={'width':wh[0],'height':wh[1]}); pg=ctx.new_page(); errs=[]
      pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
      pg.on('pageerror',lambda e: errs.append(str(e)))
      pg.goto(f'http://127.0.0.1:{PORT}/',wait_until='networkidle'); pg.wait_for_timeout(400)
      pg.evaluate("([m,s,w])=>{window.PBS.setMode(m);window.PBS.setStage(s);window.PBS.setWeather(w)}",[mode,stage,weather])
      pg.evaluate("([A,B])=>window.PBS.setTeams(A,B)",[A,B]); pg.wait_for_timeout(200)
      t0=time.time(); pg.evaluate("()=>window.PBS.start()")
      pg.wait_for_selector('#screenBattle.active',timeout=10000)
      ended=False
      while time.time()-t0<150:
        if pg.evaluate("()=>document.querySelector('#resultOverlay').classList.contains('show')"):
          ended=True; break
        pg.wait_for_timeout(400)
      info=pg.evaluate("()=>window.PBS.battle().info()")
      pg.wait_for_timeout(600)
      pg.screenshot(path=f'{OUT}/v4_e2e_{tag}_result.png')
      res[tag]={'ended':ended,'realSec':round(time.time()-t0,1),'simTime':info['time'],'speed':info['speed'],'simScale':info['simScale'],'result':info['result'],'errors':len(errs)}
      print(tag,res[tag], errs[:3])
      ctx.close()
    b.close()
finally: srv.terminate()
print(json.dumps(res,ensure_ascii=False))
