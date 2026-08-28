const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const pages=[];
(function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){
  const p=path.join(d,f.name);
  if(f.isDirectory()){ if(!/node_modules|_shots|raw/.test(f.name)) walk(p); }
  else if(f.name.endsWith('.html')) pages.push(p);
}})(ROOT);
const missing=new Map(); let checked=0;
for(const page of pages){
  const html=fs.readFileSync(page,'utf8');
  const dir=path.dirname(page);
  const urls=new Set();
  for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) urls.add(m[1]);
  for(let u of urls){
    if(/^(https?:|mailto:|tel:|#|data:)/.test(u)) continue;
    u=u.split('#')[0].split('?')[0];
    if(!u) continue;
    checked++;
    const target=path.resolve(dir,u);
    if(!fs.existsSync(target)){
      const key=u+'  <-  '+path.relative(ROOT,page);
      missing.set(key,(missing.get(key)||0)+1);
    }
  }
}
console.log(`${pages.length} pages · ${checked} local refs checked`);
if(!missing.size) console.log('no broken links');
else { console.log(`${missing.size} broken:`); [...missing.keys()].slice(0,25).forEach(k=>console.log('  ',k)); }
