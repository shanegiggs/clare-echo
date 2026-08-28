// CDP screenshot harness — drives headless Edge so the design can be reviewed
// without the preview pane being visible (a hidden pane freezes rAF and
// screenshots time out). Requires Edge with --remote-debugging-port=9222.
//
//   node tools/capture.js                    # homepage, 3 viewports
//   CAP_PAGE=/story/x.html node tools/capture.js
//   CAP_FULL=1 node tools/capture.js         # whole-page shots
//   CAP_REDUCED=1 node tools/capture.js      # motion-off pass
const fs = require('fs');
const path = require('path');

const BASE = process.env.CAP_URL || 'http://localhost:5126';
// Git Bash rewrites a leading "/" argument into a Windows path (MSYS path
// conversion), so strip any drive prefix it may have glued on.
const PAGE = '/' + (process.env.CAP_PAGE || 'index.html')
  .replace(/^[A-Za-z]:[\\/].*?[\\/](?=(story|section)[\\/]|[^\\/]*\.html$)/, '')
  .replace(/\\/g, '/')
  .replace(/^\/+/, '');
const TAG = process.env.CAP_TAG || path.basename(PAGE, '.html');
const OUT = path.join(__dirname, '_shots');
fs.mkdirSync(OUT, { recursive: true });

// [label, selector] — scrolled to top of viewport before capture
const SPOTS = [
  ['01-top', null],
  ['02-lead', '.lead-grid'],
  ['03-grid', '.cards'],
  ['04-premium', '.prem'],
  ['05-sport', '.sport-grid'],
  ['06-media', '.media'],
  ['06b-youtube', '.yt-grid'],
  ['07-subs', '.subs'],
  ['08-digests', '.notice-grid'],
  ['09-newsletter', '.nl'],
  ['10-footer', '.foot']
];

const VIEWPORTS = [
  { name: 'desktop', w: 1440, h: 900, dpr: 1, mobile: false },
  { name: 'tablet', w: 900, h: 1100, dpr: 1, mobile: true },
  { name: 'mobile', w: 390, h: 844, dpr: 2, mobile: true }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  let target;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://localhost:9222/json')).json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch (e) { /* Edge not up yet */ }
    await sleep(300);
  }
  if (!target) throw new Error('no CDP page target');

  const sock = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });

  let mid = 0; const pending = new Map(); const waiters = [];
  sock.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else if (m.method) waiters.slice().forEach(w => w(m));
  };
  const cmd = (method, params = {}) => new Promise(res => {
    const id = ++mid; pending.set(id, res); sock.send(JSON.stringify({ id, method, params }));
  });
  const waitEvent = (method, timeout = 15000) => new Promise(res => {
    const to = setTimeout(() => { const i = waiters.indexOf(fn); if (i >= 0) waiters.splice(i, 1); res(null); }, timeout);
    const fn = m => { if (m.method === method) { clearTimeout(to); const i = waiters.indexOf(fn); if (i >= 0) waiters.splice(i, 1); res(m); } };
    waiters.push(fn);
  });
  const evaluate = async expr => {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r && r.result ? r.result.value : undefined;
  };

  await cmd('Page.enable');
  await cmd('Runtime.enable');
  if (process.env.CAP_REDUCED) {
    await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }

  const results = [];
  for (const vp of VIEWPORTS) {
    await cmd('Emulation.setDeviceMetricsOverride', {
      width: vp.w, height: vp.h, deviceScaleFactor: vp.dpr, mobile: vp.mobile,
      screenWidth: vp.w, screenHeight: vp.h
    });
    const loaded = waitEvent('Page.loadEventFired');
    await cmd('Page.navigate', { url: BASE + PAGE });
    await loaded;
    await sleep(1600);

    // smooth scrolling would still be animating when the shutter fires
    await evaluate(`document.documentElement.style.scrollBehavior='auto';1`);
    // a full-page shot never scrolls past the middle sections, so their
    // scroll-reveal observers would never fire — settle them by hand
    await evaluate(`document.querySelectorAll('.rv').forEach(function(e){e.classList.add('is-in')});1`);
    // force every lazy image in, then let them decode
    await evaluate(`[...document.images].forEach(i=>i.loading='eager');1`);
    await evaluate(`window.scrollTo(0,document.body.scrollHeight);1`);
    await sleep(1400);
    await evaluate(`window.scrollTo(0,0);1`);
    // captureBeyondViewport renders rows that never entered the viewport, so
    // wait for every image to actually decode before the shutter fires
    await cmd('Runtime.evaluate', {
      expression: `Promise.all([...document.images].map(i=>i.decode().catch(()=>0))).then(()=>1)`,
      awaitPromise: true, returnByValue: true
    });
    await sleep(400);

    const audit = await evaluate(`JSON.stringify({
      at:location.pathname,
      sw:document.documentElement.scrollWidth, iw:innerWidth,
      sh:document.documentElement.scrollHeight,
      broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).length,
      invisible:[...document.querySelectorAll('h1,h2,h3')].filter(e=>{
        var s=getComputedStyle(e); return (parseFloat(s.opacity)<0.05||s.visibility==='hidden')&&e.getBoundingClientRect().height>0;
      }).length
    })`);
    results.push([vp.name, audit]);
    console.log(vp.name, audit);

    if (process.env.CAP_FULL) {
      const shot = await cmd('Page.captureScreenshot', { format: 'jpeg', quality: 78, captureBeyondViewport: true });
      if (shot && shot.data) {
        fs.writeFileSync(path.join(OUT, `${TAG}_${vp.name}_full.jpg`), Buffer.from(shot.data, 'base64'));
        console.log('saved full', vp.name);
      }
    } else {
      for (const [label, sel] of SPOTS) {
        await evaluate(`(function(){
          var y = 0;
          if (${JSON.stringify(sel)}) {
            var el = document.querySelector(${JSON.stringify(sel)});
            if (!el) return 0;
            y = el.getBoundingClientRect().top + window.scrollY - 8;
          }
          window.scrollTo(0, y); return 1;
        })()`);
        await sleep(420);
        const shot = await cmd('Page.captureScreenshot', { format: 'png' });
        if (shot && shot.data) {
          fs.writeFileSync(path.join(OUT, `${TAG}_${vp.name}_${label}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
      console.log('saved spots', vp.name);
    }
    await cmd('Emulation.clearDeviceMetricsOverride');
  }
  console.log('DONE', JSON.stringify(results));
  sock.close();
  process.exit(0);
}
main().catch(e => { console.error('ERR', e); process.exit(1); });
