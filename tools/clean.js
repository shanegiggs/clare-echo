/* ==========================================================================
   Clare Echo copy clean-up.

   The WordPress excerpts (and the first body paragraph) are generated from
   post content that begins with the photo caption, so stories arrive reading
   "*Seán Kennedy returned from injury... Photograph: Gerard O'Neill. KILMALEY
   have been...". This lifts the caption out into its own field so it can be
   set under the picture where it belongs, and hands the copy back starting at
   the actual lede.

   The Echo's house style opens every story with an all-caps place or subject
   ("KILMALEY have...", "WEST Clare councillors...", "A SIXMILEBRIDGE gym..."),
   which is what we look for to find where the caption ends.

   Run: node tools/clean.js   (idempotent)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// "Photograph: X", and the Echo's inset separator "Main caption || Inset: Y"
const CAP_MARK = /(Photographs?|Photo|Pic|Pictured|Inset)\s*:|\|\|/i;
// 4+ letters keeps GAA / SFC / MD / FF inside the caption where they belong
const LEDE = /(?:^|[\s.,)])((?:A\s|AN\s|THE\s)?[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ']{3,})/g;

function splitCaption(text) {
  if (!text) return { caption: '', rest: '' };
  const mark = text.slice(0, 340).match(CAP_MARK);
  if (!mark) return { caption: '', rest: text };

  LEDE.lastIndex = mark.index + mark[0].length;
  let cut = -1, m;
  while ((m = LEDE.exec(text))) { cut = m.index + m[0].indexOf(m[1]); break; }
  LEDE.lastIndex = 0;

  // No all-caps lede: not every story opens in house style. Cut just past the
  // photographer credit (at most two names) rather than swallowing the copy.
  if (cut < 0) {
    const after = text.slice(mark.index + mark[0].length);
    const credit = after.match(/^\s*[A-ZÁÉÍÓÚ][\w'’-]*(?:\s+[A-ZÁÉÍÓÚ][\w'’-]*)?/);
    if (!credit) return { caption: tidy(text), rest: '' };
    const end = mark.index + mark[0].length + credit[0].length;
    const rest = text.slice(end).replace(/^[\s.]+/, '');
    if (rest.length < 40) return { caption: tidy(text), rest: '' };
    return { caption: tidy(text.slice(0, end)), rest };
  }
  // a runaway match means we guessed wrong — leave the copy alone
  if (cut > 420) return { caption: '', rest: text };
  return { caption: tidy(text.slice(0, cut)), rest: text.slice(cut).trim() };
}

const tidy = s => s.replace(/^\*+\s*/, '').replace(/\s*\|\|\s*/g, ' — ').replace(/\s+/g, ' ').trim();

function cleanPost(p) {
  if (p.cleaned) return;
  let caption = '';

  if (Array.isArray(p.body) && p.body.length) {
    const r = splitCaption(p.body[0]);
    if (r.caption) {
      caption = r.caption;
      if (r.rest) p.body[0] = r.rest; else p.body.shift();
    }
  }
  const e = splitCaption(p.excerpt);
  if (e.caption) {
    if (!caption) caption = e.caption;
    p.excerpt = e.rest;
  }
  // excerpts are truncated mid-word by WordPress; the lede paragraph is better
  if (Array.isArray(p.body) && p.body.length && p.body[0].length > 40) {
    p.excerpt = p.body[0];
  }
  if (caption) p.caption = caption;   // never wipe one an earlier pass found
  p.cleaned = true;
}

/* A second house-style marker: captions with no photographer credit are still
   flagged with a leading asterisk. There is no "Photograph:" to anchor on, so
   take the first sentence as the caption — unless an all-caps lede shows up
   sooner, which means the caption ran to more than one sentence. */
function splitStar(text) {
  if (!/^\*/.test(text || '')) return { caption: '', rest: text };
  const t = text.replace(/^\*+\s*/, '');
  const stop = t.search(/[.!?]\s+/);
  if (stop < 0) return { caption: tidy(t), rest: '' };
  return { caption: tidy(t.slice(0, stop + 1)), rest: t.slice(stop + 1).trim() };
}

function cleanStar(p) {
  if (p.starCleaned) return;
  p.starCleaned = true;
  let caption = '';
  if (Array.isArray(p.body) && p.body.length) {
    const r = splitStar(p.body[0]);
    if (r.caption) {
      caption = r.caption;
      if (r.rest) p.body[0] = r.rest; else p.body.shift();
    }
  }
  const e = splitStar(p.excerpt);
  if (e.caption) {
    if (!caption) caption = e.caption;
    p.excerpt = e.rest;
  }
  if (Array.isArray(p.body) && p.body.length && p.body[0].length > 40) p.excerpt = p.body[0];
  if (caption && !p.caption) p.caption = caption;
}

/* An earlier pass could swallow a whole paragraph into the caption when the
   story did not open in house style; put that copy back. */
function repair(p) {
  if ((p.excerpt || '').trim() || !p.caption) return;
  const r = splitCaption(p.caption);
  if (!r.rest) return;
  p.caption = r.caption;
  p.excerpt = r.rest;
  if (!Array.isArray(p.body) || !p.body.length) p.body = [r.rest];
  p.read = Math.max(1, Math.round(p.body.join(' ').split(/\s+/).length / 220));
}

let n = 0, capped = 0;
const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/feed.json'), 'utf8'));
feed.forEach(p => { cleanPost(p); cleanStar(p); repair(p); n++; if (p.caption) capped++; });
fs.writeFileSync(path.join(ROOT, 'data/feed.json'), JSON.stringify(feed, null, 1));

const extra = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/extra.json'), 'utf8'));
Object.keys(extra).forEach(k => extra[k].forEach(p => { cleanPost(p); cleanStar(p); repair(p); n++; if (p.caption) capped++; }));
fs.writeFileSync(path.join(ROOT, 'data/extra.json'), JSON.stringify(extra, null, 1));

// podcast episodes carry the same caption-first copy as the rest of the archive
const podFile = path.join(ROOT, 'data/podcasts.json');
if (fs.existsSync(podFile)) {
  const shows = JSON.parse(fs.readFileSync(podFile, 'utf8'));
  shows.forEach(s => s.episodes.forEach(e => { cleanPost(e); cleanStar(e); repair(e); n++; if (e.caption) capped++; }));
  fs.writeFileSync(podFile, JSON.stringify(shows, null, 1));
}

console.log(`cleaned ${n} posts · ${capped} captions lifted`);
console.log('\nsamples:');
feed.filter(p => p.caption).slice(0, 4).forEach(p => {
  console.log('\n  CAPTION:', p.caption.slice(0, 110));
  console.log('  LEDE   :', p.excerpt.slice(0, 110));
});
