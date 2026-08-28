/* ==========================================================================
   Render the style guide to PDF via headless Edge over CDP.

   Requires Edge running with --remote-debugging-port=9222 and the local
   server on :5126. The page's own @media print rules do the layout work;
   this only drives the print and adds page numbers.

   Run: node tools/build-pdf.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const URL = process.env.PDF_URL || 'http://localhost:5126/brand/_preview.html';
const OUT = process.env.PDF_OUT ||
  path.join(ROOT, '..', 'clare-echo-styleguide', 'clare-echo-style-guide.pdf');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const FOOTER = `
<div style="width:100%;font-family:Inter,Helvetica,Arial,sans-serif;font-size:7pt;
  color:#8A9BA5;padding:0 18mm;display:flex;justify-content:space-between;">
  <span>The Clare Echo &mdash; Brand &amp; editorial style guide v1.0</span>
  <span class="pageNumber"></span>
</div>`;

(async () => {
  let target;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch('http://localhost:9222/json')).json();
      target = list.find(t => t.type === 'page');
      if (target) break;
    } catch (e) { /* not up yet */ }
    await sleep(300);
  }
  if (!target) throw new Error('no CDP page target — start Edge with --remote-debugging-port=9222');

  const sock = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { sock.onopen = res; sock.onerror = rej; });

  let id = 0; const pending = new Map(); const waiters = [];
  sock.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else if (m.method) waiters.slice().forEach(f => f(m));
  };
  const cmd = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res); sock.send(JSON.stringify({ id: i, method, params }));
  });
  const wait = (method, ms = 20000) => new Promise(res => {
    const to = setTimeout(() => res(null), ms);
    const fn = m => { if (m.method === method) { clearTimeout(to); const i = waiters.indexOf(fn); if (i >= 0) waiters.splice(i, 1); res(m); } };
    waiters.push(fn);
  });

  await cmd('Page.enable');
  await cmd('Runtime.enable');
  await cmd('Emulation.setDeviceMetricsOverride',
    { width: 1100, height: 1400, deviceScaleFactor: 1, mobile: false });

  const loaded = wait('Page.loadEventFired');
  await cmd('Page.navigate', { url: URL });
  await loaded;

  // a dark OS would otherwise print the dark palette
  await cmd('Runtime.evaluate', { expression: `document.documentElement.setAttribute('data-theme','light')` });
  // webfonts must be in before the print snapshot, or it sets in the fallback
  await cmd('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true, returnByValue: true });
  await cmd('Runtime.evaluate', {
    expression: `Promise.all([...document.images].map(i=>i.decode().catch(()=>0))).then(()=>1)`,
    awaitPromise: true, returnByValue: true
  });
  await sleep(1200);

  const res = await cmd('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: false,
    paperWidth: 8.27, paperHeight: 11.69,          // A4 portrait, inches
    marginTop: 0, marginBottom: 0.55, marginLeft: 0, marginRight: 0,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: FOOTER,
    generateTaggedPDF: true
  });
  if (!res || !res.data) throw new Error('printToPDF returned no data');

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const buf = Buffer.from(res.data, 'base64');
  fs.writeFileSync(OUT, buf);

  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`wrote ${OUT}`);
  console.log(`  ${(buf.length / 1024).toFixed(0)} KB · ~${pages} pages · A4 portrait`);

  sock.close();
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
