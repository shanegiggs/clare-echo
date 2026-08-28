/* ==========================================================================
   Wrap the style guide into a standalone, deployable page.

   brand/styleguide.html is authored as an Artifact body — no doctype, no
   <head> — because the Artifact host supplies that skeleton. GitHub Pages
   does not, so this emits a complete document from the same single source.

   Run: node tools/build-styleguide.js  [outDir]
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, '..', 'clare-echo-styleguide');

const body = fs.readFileSync(path.join(ROOT, 'brand/styleguide.html'), 'utf8');

// lift the <title> and the font <link>s out of the body into a real <head>
const title = (body.match(/<title>([\s\S]*?)<\/title>/) || [, 'Clare Echo Brand Book'])[1].trim();
const links = (body.match(/<link\b[^>]*>/g) || []).join('\n');
const rest = body
  .replace(/<title>[\s\S]*?<\/title>\s*/, '')
  .replace(/<link\b[^>]*>\s*/g, '');

const DESC = 'Brand and editorial style guide for The Clare Echo — logo lockups, ' +
  'colour with CMYK and Pantone, print type scale, page grid, advert sizes and social templates.';

const favicon =
  `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="12" fill="#0080FF"/>' +
    '<text x="32" y="43" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" ' +
    'font-size="31" font-weight="900" letter-spacing="-1.5" fill="#fff">CE</text></svg>'
  )}`;

const page = `<!DOCTYPE html>
<html lang="en-IE">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${DESC}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0080FF">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${DESC}">
<link rel="icon" href="${favicon}">
${links}
<style>
*{margin:0}
html{color-scheme:light dark}
</style>
</head>
<body>
${rest.trim()}
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), page, 'utf8');
// GitHub Pages runs Jekyll by default, which can fail the build outright
fs.writeFileSync(path.join(OUT, '.nojekyll'), '', 'utf8');

// ship the master artwork alongside the guide so it is downloadable
const brandOut = path.join(OUT, 'logos');
fs.mkdirSync(brandOut, { recursive: true });
let copied = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'assets/brand'))) {
  fs.copyFileSync(path.join(ROOT, 'assets/brand', f), path.join(brandOut, f));
  copied++;
}

console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`  index.html   ${(page.length / 1024).toFixed(1)} KB`);
console.log(`  .nojekyll`);
console.log(`  logos/       ${copied} master SVGs`);
