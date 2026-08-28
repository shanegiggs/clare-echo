/* ==========================================================================
   Build data/podcasts.json and data/youtube.json.

   Podcasts come from the Echo's WordPress podcast category and are grouped
   into their real series. YouTube comes from the channel's public RSS feed —
   no API key needed — and the thumbnails are pulled local so the page never
   calls out to a third-party host.

   Run: node tools/fetch-media.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const sharp = require(path.join(
  'C:/Users/shane/AppData/Local/Temp/claude/C--Users-shane--claude-projects-C--WINDOWS-system32',
  'd49193a1-cc21-4e1c-ace5-8fbfd23795ec/scratchpad/node_modules/sharp'
));

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'assets/img');
const RAW = path.join(IMG, 'raw');
const CHANNEL = 'UChMWkifachaZDpkUsdpNS4Q';
const HANDLE = 'https://www.youtube.com/@theclareecho5641';

const ents = { 8217: "'", 8216: "'", 39: "'", 38: '&', 8211: '–', 8212: '—', 8220: '“', 8221: '”',
  8230: '…', 160: ' ', 233: 'é', 225: 'á', 243: 'ó', 237: 'í', 250: 'ú', 201: 'É', 211: 'Ó',
  193: 'Á', 205: 'Í', 218: 'Ú', 8364: '€', 34: '"', 60: '<', 62: '>' };
const dec = s => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (m, d) => ents[+d] ?? '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…')
  .replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
  .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&quot;/g, '"')
  .replace(/&[a-z]+;/g, '').replace(/\s+/g, ' ').trim();

// the Echo's real podcast series, with what the copy actually establishes
const SERIES = [
  { slug: 'the-water-break', name: 'The Water Break', match: /water break/i,
    kicker: 'Clare GAA',
    blurb: 'Clare club and county GAA, week by week — championship reaction, the ' +
      'games that turned, and the players and managers who were in them.' },
  { slug: 'the-business-chamber', name: 'The Business Chamber', match: /business chamber/i,
    kicker: 'Business',
    blurb: 'Joe Melody sits down with the people building businesses in Clare, in ' +
      'association with Ennis Chamber of Commerce.' },
  { slug: 'the-electoral-chair', name: 'The Electoral Chair', match: /electoral chair/i,
    kicker: 'Politics',
    blurb: 'Páraic McMahon, Mark Dunphy, Gerry Reidy and Joe Melody on Clare ' +
      'politics — counts, candidates and what the result actually means.' }
];

async function grab(url, file) {
  if (fs.existsSync(file)) return true;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) return false;
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return true;
}

async function encode(rawFile, base) {
  await sharp(rawFile).rotate().resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 76 }).toFile(path.join(IMG, base + '-lg.webp'));
  await sharp(rawFile).rotate().resize({ width: 700, withoutEnlargement: true })
    .webp({ quality: 74 }).toFile(path.join(IMG, base + '-sm.webp'));
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });

  /* ---------------- podcasts ---------------- */
  const res = await fetch(
    'https://www.clareecho.ie/wp-json/wp/v2/posts?categories=1&per_page=40&_embed=1',
    { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const posts = await res.json();

  const shows = SERIES.map(s => ({ ...s, episodes: [] }));
  for (const p of posts) {
    const title = dec(p.title.rendered);
    const show = shows.find(s => s.match.test(title));
    if (!show) continue;                       // one-offs stay out of the show pages
    const m = p._embedded?.['wp:featuredmedia']?.[0];
    const sz = m?.media_details?.sizes;
    const img = sz ? (sz.large || sz.medium_large || sz.full)?.source_url : m?.source_url;
    const base = p.slug.slice(0, 48).replace(/[^a-z0-9-]/g, '');
    let file = '';
    if (img && !fs.existsSync(path.join(IMG, base + '-sm.webp'))) {
      const rawf = path.join(RAW, base + path.extname(img).split('?')[0]);
      if (await grab(img, rawf)) { try { await encode(rawf, base); file = base; } catch (e) {} }
    } else if (img) { file = base; }

    // strip the series prefix — the show name is already the page heading
    const epTitle = title.replace(/^(The\s+)?(Water Break|Business Chamber|Electoral Chair)\s*[:–-]?\s*/i, '').trim();
    // full copy too, so every episode gets a real page rather than a dead link
    const html = (p.content?.rendered || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<div class="clare-[\s\S]*?<\/div>\s*<\/div>/gi, '');
    const paras = [];
    for (const pm of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
      const t = dec(pm[1]);
      if (t.length > 25 && !/^(Advertisement|Related|Share this)/i.test(t)) paras.push(t);
    }
    const words = paras.join(' ').split(/\s+/).length;
    show.episodes.push({
      slug: p.slug, title: epTitle || title, fullTitle: title,
      date: p.date, file, img,
      alt: dec(m?.alt_text || title),
      author: 'The Clare Echo', cats: ['Podcasts'],
      excerpt: dec(p.excerpt.rendered).replace(/\s*\[…\]$/, '').slice(0, 240),
      body: paras.slice(0, 26), read: Math.max(1, Math.round(words / 220)),
      link: p.link
    });
  }
  shows.forEach(s => { delete s.match; s.count = s.episodes.length; });
  fs.writeFileSync(path.join(ROOT, 'data/podcasts.json'), JSON.stringify(shows, null, 1));

  /* ---------------- youtube ---------------- */
  const xml = await (await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();

  const vids = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const g = re => { const r = e.match(re); return r ? dec(r[1]) : ''; };
    const id = g(/<yt:videoId>([^<]*)</);
    if (!id) continue;
    const base = 'yt-' + id;
    let file = '';
    if (!fs.existsSync(path.join(IMG, base + '-sm.webp'))) {
      const rawf = path.join(RAW, base + '.jpg');
      // maxres is not published for every video; hq always is
      const ok = await grab(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, rawf)
        || await grab(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`, rawf);
      if (ok) { try { await encode(rawf, base); file = base; } catch (e) {} }
    } else { file = base; }
    vids.push({
      id, title: g(/<title>([^<]*)</), date: g(/<published>([^<]*)</),
      desc: g(/<media:description>([\s\S]*?)<\/media:description>/).slice(0, 200),
      views: (e.match(/views="(\d+)"/) || [])[1] || '',
      url: `https://www.youtube.com/watch?v=${id}`, file
    });
  }
  fs.writeFileSync(path.join(ROOT, 'data/youtube.json'),
    JSON.stringify({ channel: HANDLE, channelId: CHANNEL, videos: vids }, null, 1));

  console.log('shows   :', shows.map(s => `${s.name} (${s.count})`).join(', '));
  console.log('episodes:', shows.reduce((a, s) => a + s.count, 0),
    '| with artwork:', shows.reduce((a, s) => a + s.episodes.filter(e => e.file).length, 0));
  console.log('youtube :', vids.length, '| with thumbnail:', vids.filter(v => v.file).length);
})().catch(e => { console.error('ERR', e); process.exit(1); });
