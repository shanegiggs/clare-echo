/* ==========================================================================
   The Clare Echo — static site generator
   Reads data/feed.json + data/extra.json (real clareecho.ie editorial pulled
   via their public WordPress REST API) and writes the full static site.
   Run:  node tools/build.js
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const feed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/feed.json'), 'utf8'));
const extra = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/extra.json'), 'utf8'));

/* ---------------------------------------------------------------- helpers */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const D = iso => new Date(iso.replace(' ', 'T'));
const fmtDate = iso => { const d = D(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtLong = iso => { const d = D(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${fmtTime(iso)}`; };
const fmtTime = iso => { const d = D(iso); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const NOW = D(feed[0].date);
const rel = iso => {
  const mins = Math.round((NOW - D(iso)) / 60000);
  if (mins < 60) return mins <= 1 ? 'now' : mins + 'm';
  const h = Math.round(mins / 60);
  if (h < 24) return h + 'h';
  const d = Math.round(h / 24);
  return d < 7 ? d + 'd' : fmtDate(iso).split(' ').slice(0, 2).join(' ');
};

const PREM = p => (p.cats || []).includes('Premium');
const SECTION_NAMES = { 'News':'News', 'Sport':'Sport', 'Business':'Business',
  'Arts and Entertainment':'Arts & Culture', 'Opinion':'Opinion', 'Podcasts':'Podcasts' };
const catOf = p => {
  const c = (p.cats || []).find(x => x !== 'Premium' && SECTION_NAMES[x]);
  return c ? SECTION_NAMES[c] : 'News';
};
const SLUGS = { 'News':'news', 'Sport':'sport', 'Business':'business',
  'Arts & Culture':'arts', 'Opinion':'opinion', 'Podcasts':'podcasts' };
const catSlug = p => SLUGS[catOf(p)] || 'news';

const storyUrl = (B, p) => `${B}story/${p.slug}.html`;
const sectionUrl = (B, slug) => `${B}section/${slug}.html`;
const showUrl = (B, slug) => `${B}podcast/${slug}.html`;

/* ---------------------------------------------------------------- media */
const shows = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/podcasts.json'), 'utf8'));
const yt = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/youtube.json'), 'utf8'));
const vids = yt.videos.filter(v => v.file);
// same-day uploads are almost always clips of one event, so the homepage row
// takes the first from each day — otherwise it shows four cuts of one interview
const vidsVaried = Object.values(
  vids.reduce((acc, v) => { const d = v.date.slice(0, 10); if (!acc[d]) acc[d] = v; return acc; }, {})
).sort((a, b) => new Date(b.date) - new Date(a.date));

const pic = (p, size, ratio, cls, eager) => {
  if (!p.file) {
    return `<div class="ph ${ratio} ${cls || ''}" aria-hidden="true"></div>`;
  }
  return `<div class="ph ${ratio} ${cls || ''}"><img src="{{B}}assets/img/${p.file}-${size}.webp" alt="${esc(p.alt || p.title)}"` +
    (eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async"></div>';
};

const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// bare <img> for the .thumb wrapper, which supplies its own ratio and radius
const thumb = (o, size) => o && o.file
  ? `<img src="{{B}}assets/img/${o.file}-${size || 'sm'}.webp" alt="" loading="lazy" decoding="async">`
  : '';

const ytCard = v => `<article class="yt-card">
  <a href="${v.url}" target="_blank" rel="noopener">
    <span class="thumb">${thumb(v)}<span class="play">${ico.play}</span></span>
    <h3 class="hl">${clip(v.title, 92)}</h3>
    <p class="meta"><b>The Clare Echo</b><span class="dot"></span><time datetime="${v.date}">${fmtDate(v.date)}</time></p>
  </a>
</article>`;

// truncate on a word boundary so cards never read "...industry aw"
function clip(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return esc(s);
  let cut = s.slice(0, n);
  cut = cut.slice(0, cut.lastIndexOf(' '));
  return esc(cut.replace(/[,;:.–—]$/, '')) + '&hellip;';
}

const ico = {
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>',
  chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
  burger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V7a6 6 0 0 1 12 0v3h1.2v12H4.8V10H6zm2.4 0h7.2V7a3.6 3.6 0 0 0-7.2 0v3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  rss: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3a16 16 0 0 1 16 16h-3A13 13 0 0 0 5 6V3zm0 7a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6v-3zm2.2 6.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5v17l14-8.5-14-8.5z"/></svg>',
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5l5-5M11 6.5l1.6-1.6a4.3 4.3 0 0 1 6.1 6.1L17 12.6M13 17.4l-1.6 1.6a4.3 4.3 0 0 1-6.1-6.1L7 11.2"/></svg>',
  fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.6c-.3 0-1.3-.13-2.47-.13-2.44 0-4.11 1.49-4.11 4.22V9.9H7.4V13h2.72v8h3.38z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.3 3h3.3l-7.2 8.24L21.9 21h-6.6l-5.17-6.76L4.2 21H.9l7.7-8.8L.4 3h6.77l4.67 6.18L17.3 3zm-1.16 16h1.83L6.94 4.9H4.98L16.14 19z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.89 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0 5.17a4.67 4.67 0 1 0 0 9.34 4.67 4.67 0 0 0 0-9.34zm0 7.7a3.03 3.03 0 1 1 0-6.06 3.03 3.03 0 0 1 0 6.06zm4.85-8.99a1.09 1.09 0 1 0 0 2.18 1.09 1.09 0 0 0 0-2.18z"/></svg>',
  yt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22.5 7.2a2.75 2.75 0 0 0-1.93-1.95C18.85 4.8 12 4.8 12 4.8s-6.85 0-8.57.45A2.75 2.75 0 0 0 1.5 7.2C1.05 8.93 1.05 12 1.05 12s0 3.07.45 4.8a2.75 2.75 0 0 0 1.93 1.95c1.72.45 8.57.45 8.57.45s6.85 0 8.57-.45a2.75 2.75 0 0 0 1.93-1.95c.45-1.73.45-4.8.45-4.8s0-3.07-.45-4.8zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z"/></svg>'
};

/* ---------------------------------------------------------------- logo
   The supplied master vectors (D:\Echo logos). The wordmark is painted with
   currentColor and the arcs with --logo-arc, which reproduces both official
   files — black type with blue arcs, and the all-white knockout — from one
   inline copy. viewBoxes are tightened to the measured content bounds so the
   mark sizes predictably by height.                                        */
// box = measured content bounds (goes on the <symbol>)
// size = the same extents at origin 0,0 (goes on the referencing <svg>) — a
// non-zero origin there would offset the <use> and crop the mark.
const LOGO_SRC = {
  h: { file: 'logo-horizontal.svg', box: '23.7 47.7 1044.4 202.6', size: '0 0 1044.4 202.6' },
  s: { file: 'logo-stacked.svg', box: '134.8 7.9 1185.3 613', size: '0 0 1185.3 613' }
};

/* Each page carries the artwork once as a <symbol> and references it with
   <use>. Document CSS cannot reach inside a <use> shadow tree, so the fills
   are inline styles — `currentColor` and the custom property both inherit
   through, which is what lets one sprite serve every colourway. */
const LOGO_SYMBOLS = Object.entries(LOGO_SRC).map(([key, cfg]) => {
  const raw = fs.readFileSync(path.join(ROOT, 'assets/brand', cfg.file), 'utf8');
  const inner = raw
    .replace(/<\?xml[\s\S]*?\?>\s*/, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s(?:id|data-name)="[^"]*"/g, '')
    .replace(/style="fill:\s*#231f20;"/gi, 'style="fill:currentColor"')
    .replace(/style="fill:\s*#0080ff;"/gi, 'style="fill:var(--logo-arc,#0080FF)"')
    .replace(/\s*\n\s*/g, '');
  return `<symbol id="lg-${key}" viewBox="${cfg.box}">${inner}</symbol>`;
}).join('');

const logoSprite = () =>
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">${LOGO_SYMBOLS}</svg>`;

// variant: 'h' horizontal (default) | 's' stacked
const logo = (invert, variant) => {
  const v = variant || 'h';
  return `<span class="logo${invert ? ' logo--invert' : ''}">` +
    `<svg viewBox="${LOGO_SRC[v].size}" aria-hidden="true" focusable="false"><use href="#lg-${v}"/></svg>` +
    `</span>`;
};

const premBadge = paper => `<span class="badge-prem${paper ? ' badge-prem--paper' : ''}">${ico.lock}Premium</span>`;

/* ---------------------------------------------------------------- subscribe
   The Echo's live rate card. Shared by the homepage band and the subscribe
   page so a price change lands in one place. */
const PLANS = {
  annual: {
    label: 'Annually', price: '&euro;69.99', per: '/ year', was: '&euro;96',
    note: 'Billed once per year.', save: 'Save 27%'
  },
  monthly: {
    label: 'Monthly', price: '&euro;3', per: '/ month',
    note: 'For your first 6 months, then &euro;8 a month.', save: 'Cancel any time'
  }
};

const HELPS = 'Your community is our passion. Your subscription helps The Clare Echo to ' +
  'continue delivering trusted information to the public on a daily basis, with in-depth ' +
  'news and updates that simply are not available in any other place. Local news is the ' +
  'most important news and with your support, we are creating an unrivalled user ' +
  'experience and delivering important content to give you the most informed context for ' +
  'the community you live in.';

// hand-drawn double underline, lifted from the Echo's own subscribe panel
const SCRIBBLE = `<svg class="subs-scribble" viewBox="0 0 1000 54" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 14C210 4 620 8 996 26 620 18 210 22 4 14Z"/>
      <path d="M168 48C420 40 760 30 992 25 762 38 420 50 168 48Z"/>
    </svg>`;

function planCard() {
  return `<div class="plancard">
      <h3>Subscribe to The Clare Echo</h3>

      <div class="plan-toggle" role="tablist" aria-label="Billing period">
        ${Object.entries(PLANS).map(([key, p], i) => `<button type="button" role="tab"
          id="ptab-${key}" aria-selected="${i === 0}" aria-controls="plan-${key}"
          data-plan-tab="${key}">${p.label}</button>`).join('\n        ')}
      </div>

      ${Object.entries(PLANS).map(([key, p], i) => `<div class="plan" id="plan-${key}"${i === 0 ? '' : ' hidden'}>
        <p class="plan-price">
          <b>${p.price}</b><span class="per">${p.per}</span>
          ${p.was ? `<span class="was">${p.was}</span>` : ''}
        </p>
        <p class="plan-note">${p.note}</p>
        <span class="plan-save">${p.save}</span>
      </div>`).join('\n      ')}

      <a class="btn btn--primary" href="{{B}}subscribe.html">Subscribe</a>

      <p class="plan-terms">By proceeding you agree to our
        <a href="{{B}}subscribe.html">Terms</a> and
        <a href="{{B}}subscribe.html">Privacy Policy</a>.</p>

      <p class="plan-signin">Already have an account?
        <a href="{{B}}subscribe.html">Sign in</a></p>
    </div>`;
}

function subsPanel() {
  return `<div class="subs-grid">
    <div class="subs-copy">
      <p class="kicker">Subscribe</p>
      <h2 style="margin-top:13px">Local News Matters</h2>
      ${SCRIBBLE}
      <p class="lede">County Clare has one newsroom of its own. Backing it is what keeps a
      reporter in the council chamber, at the county final and outside the courthouse.</p>
      <ul class="subs-points">
        <li>${ico.check}<span>Every story on the site, on all your devices</span></li>
        <li>${ico.check}<span><b>Echo Premium</b> &mdash; the reporting held for subscribers</span></li>
        <li>${ico.check}<span>The full digital edition every Thursday, plus the archive to 2018</span></li>
      </ul>
      <p class="helps">${HELPS}</p>
    </div>
    ${planCard()}
  </div>`;
}

/* ---------------------------------------------------------------- chrome */
// full set — every section that exists, used for the footer sitemap so
// Arts & Culture / Opinion / Video stay reachable even though the primary
// header nav (below) doesn't have room for all eight
const NAV_ALL = [
  { name: 'News', slug: 'news' },
  { name: 'Sport', slug: 'sport' },
  { name: 'Business', slug: 'business' },
  { name: 'Arts & Culture', slug: 'arts' },
  { name: 'Opinion', slug: 'opinion' },
  { name: 'Podcasts', slug: 'podcasts' },
  { name: 'Video', slug: 'video', href: 'youtube.html' },
  { name: 'Premium', slug: 'premium', premium: true }
];

// primary header row + drawer (client reference) — a shorter list with
// Contributors added in place of Arts & Culture / Opinion / Video
const NAV = [
  { name: 'News', slug: 'news' },
  { name: 'Sport', slug: 'sport' },
  { name: 'Business', slug: 'business' },
  { name: 'Podcasts', slug: 'podcasts' },
  { name: 'Contributors', slug: 'contributors', href: 'contributors.html' },
  { name: 'Premium', slug: 'premium', premium: true }
];

function head(o) {
  return `<!DOCTYPE html>
<html lang="en-IE">
<head>
<script>document.documentElement.className+=' js'</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="theme-color" content="#0080FF">
<meta property="og:site_name" content="The Clare Echo">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:type" content="${o.type || 'website'}">
<link rel="icon" href="{{B}}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" as="font" type="font/woff2" href="{{B}}assets/fonts/inter-latin-normal.woff2" crossorigin>
<link rel="stylesheet" href="{{B}}assets/css/style.css">
<link rel="stylesheet" href="{{B}}assets/css/blocks.css">
<link rel="stylesheet" href="{{B}}assets/css/pages.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${logoSprite()}`;
}

function utilbar() {
  return `<div class="util">
  <div class="wrap">
    <span class="util-date" data-today>Thursday 27 August 2026</span>
    <nav class="util-links" aria-label="Reader services">
      <a href="{{B}}obituaries.html">Obituaries</a>
      <a href="{{B}}digital-edition.html">E-Paper</a>
      <a href="{{B}}subscribe.html">Job Watch</a>
      <a class="util-cta" href="{{B}}subscribe.html">Subscribe</a>
      <a href="{{B}}subscribe.html">Log in</a>
    </nav>
  </div>
</div>`;
}

function brandbar() {
  return `<div class="brandbar">
  <div class="wrap">
    <div class="bb-left">
      <button class="bb-btn" id="burger" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${ico.burger}</button>
    </div>
    <a href="{{B}}index.html" aria-label="The Clare Echo — home">${logo(true)}</a>
    <div class="bb-right">
      <button class="bb-btn" data-search-open aria-label="Search the Echo">${ico.search}</button>
    </div>
  </div>
</div>`;
}

function secnav(active) {
  return `<nav class="secnav" aria-label="Sections">
  <div class="wrap">
    <a class="sec-ad" href="{{B}}advertise.html">Advertise</a>
    <div class="seclist">
      ${NAV.map(s => {
        const cls = [s.premium ? 'is-premium' : '', active === s.slug ? 'is-active' : ''].filter(Boolean).join(' ');
        const href = s.href ? '{{B}}' + s.href : sectionUrl('{{B}}', s.slug);
        const link = `<a href="${href}"${cls ? ` class="${cls}"` : ''}${active === s.slug ? ' aria-current="page"' : ''}>${esc(s.name)}</a>`;
        return SUBNAV[s.slug] ? `<div class="sec-item has-sub">${link}${subMenu(s.slug)}</div>` : link;
      }).join('\n      ')}
    </div>
  </div>
</nav>`;
}

// one call site per page instead of three
const siteHeader = active => `${utilbar()}\n${brandbar()}\n${secnav(active)}`;

function ticker(items) {
  return `<div class="ticker">
  <div class="wrap">
    <span class="ticker-label">${ico.bolt}<span>Breaking</span></span>
    <div class="ticker-track" id="ticker-track" aria-live="off">
      ${items.map((p, i) => `<div class="ticker-item${i === 0 ? ' is-on' : ''}"><time datetime="${p.date}">${rel(p.date)}</time><a href="${storyUrl('{{B}}', p)}">${esc(p.title)}</a></div>`).join('\n      ')}
    </div>
    <div class="ticker-dots" id="ticker-dots">
      ${items.map((p, i) => `<button type="button" aria-current="${i === 0}" aria-label="Headline ${i + 1}"></button>`).join('\n      ')}
    </div>
  </div>
</div>`;
}

function drawer() {
  return `<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-label="Menu">
  <div class="drawer-top">
    ${logo()}
    <button class="icon-btn" id="drawer-close" aria-label="Close menu">${ico.close}</button>
  </div>
  <div class="drawer-body">
    <nav class="drawer-nav" aria-label="Sections">
      ${NAV.map(s => {
        const href = s.href ? '{{B}}' + s.href : sectionUrl('{{B}}', s.slug);
        const link = `<a href="${href}"${s.premium ? ' class="is-premium"' : ''}>${esc(s.name)}${ico.chev}</a>`;
        if (!SUBNAV[s.slug]) return link;
        const subs = SUBNAV[s.slug].map(e => e.group
          ? `<p>${esc(e.group)}</p>` + e.items.map(i =>
              `<a class="indent" href="${topicUrl('{{B}}', i.slug)}">${esc(i.name)}</a>`).join('')
          : `<a href="${topicUrl('{{B}}', e.slug)}">${esc(e.name)}</a>`).join('');
        return `<div class="drawer-sec">${link}<div class="drawer-sub-list">${subs}</div></div>`;
      }).join('\n      ')}
    </nav>
    <div class="drawer-sub">
      <a href="{{B}}digital-edition.html">Digital Edition</a>
      <a href="{{B}}subscribe.html">Job Watch</a>
      <a href="{{B}}obituaries.html">Obituaries &amp; Notices</a>
      <a href="{{B}}advertise.html">Advertise with us</a>
      <a href="{{B}}subscribe.html">Contact the newsroom</a>
    </div>
  </div>
  <div class="drawer-foot">
    <a class="btn btn--primary btn--block" href="{{B}}subscribe.html">Subscribe from &euro;3</a>
    <a class="btn btn--ghost btn--block" href="{{B}}subscribe.html">Sign in</a>
  </div>
</aside>`;
}

function searchOverlay() {
  return `<div class="search" id="search" data-index="{{B}}data/search.json" role="dialog" aria-modal="true" aria-label="Search">
  <button class="icon-btn search-close" id="search-close" aria-label="Close search">${ico.close}</button>
  <div class="search-inner">
    <label for="search-input">Search The Clare Echo</label>
    <div class="search-field">
      ${ico.search}
      <input id="search-input" type="search" placeholder="Ennis, Shannon, hurling&hellip;" autocomplete="off">
    </div>
    <div class="search-hint">
      <span>Try:</span>
      <a href="#" data-search-term="Shannon">Shannon</a>
      <a href="#" data-search-term="Ennis">Ennis</a>
      <a href="#" data-search-term="camogie">Camogie</a>
      <a href="#" data-search-term="planning">Planning</a>
      <a href="#" data-search-term="Kilrush">Kilrush</a>
    </div>
    <div class="search-results" id="search-results"></div>
  </div>
</div>`;
}

function newsletter() {
  return `<section class="band nl">
  <div class="wrap nl-inner">
    <div>
      <h2>The Echo, in your inbox before the kettle boils</h2>
      <p>Clare&rsquo;s stories, fixtures and notices &mdash; gathered every morning by our newsroom in Ennis and sent at 7am, Monday to Saturday.</p>
    </div>
    <div>
      <form class="nl-form" id="nl-form" novalidate>
        <label class="vh" for="nl-email">Email address</label>
        <input id="nl-email" type="email" name="email" placeholder="you@example.ie" required>
        <button class="btn btn--paper" type="submit">Sign up free</button>
      </form>
      <p class="nl-ok" id="nl-ok">${ico.check}<span>You&rsquo;re on the list. Watch for tomorrow&rsquo;s 7am briefing.</span></p>
      <p class="nl-note">Free forever. Unsubscribe in one click. See our <a href="{{B}}subscribe.html">privacy policy</a>.</p>
    </div>
  </div>
</section>`;
}

function footer() {
  const col = (title, links) =>
    `<div class="foot-col"><h3>${title}</h3><ul>${links.map(l => `<li><a href="${l[1]}">${l[0]}</a></li>`).join('')}</ul></div>`;
  return `<footer class="foot">
  <div class="wrap">
    <div class="foot-top">
      <div class="foot-brand">
        ${logo(true, 's')}
        <p>Published in Ennis since 2018. The Clare Echo is County Clare&rsquo;s independent newspaper &mdash; in print every Thursday, online every hour.</p>
        <div class="foot-social">
          <a href="{{B}}subscribe.html" aria-label="Facebook">${ico.fb}</a>
          <a href="{{B}}subscribe.html" aria-label="X">${ico.x}</a>
          <a href="{{B}}subscribe.html" aria-label="Instagram">${ico.ig}</a>
          <a href="{{B}}subscribe.html" aria-label="YouTube">${ico.yt}</a>
        </div>
      </div>
      ${col('Sections', NAV_ALL.map(s => [s.name, (s.href ? '{{B}}' + s.href : sectionUrl('{{B}}', s.slug))]))}
      ${col('Reader', [['Digital Edition', '{{B}}digital-edition.html'], ['Subscribe', '{{B}}subscribe.html'], ['Sign in', '{{B}}subscribe.html'], ['Newsletters', '{{B}}subscribe.html'], ['Obituaries & Notices', '{{B}}obituaries.html']])}
      ${col('Business', [['Advertise with us', '{{B}}advertise.html'], ['Job Watch', '{{B}}subscribe.html'], ['Sponsored content', '{{B}}subscribe.html']])}
      ${col('The Echo', [['Contact the newsroom', '{{B}}subscribe.html'], ['Our contributors', '{{B}}contributors.html'], ['Corrections', '{{B}}subscribe.html'], ['Work with us', '{{B}}subscribe.html']])}
    </div>
    <div class="foot-bot">
      <span>&copy; ${NOW.getFullYear()} The Clare Echo. All rights reserved.</span>
      <nav aria-label="Legal">
        <a href="{{B}}subscribe.html">Privacy</a>
        <a href="{{B}}subscribe.html">Cookies</a>
        <a href="{{B}}subscribe.html">Terms</a>
        <a href="{{B}}subscribe.html">Accessibility</a>
      </nav>
    </div>
  </div>
</footer>`;
}

const tail = () => `<script src="{{B}}assets/js/main.js" defer></script>
</body>
</html>`;

/* ---------------------------------------------------------------- cards */
// `short` drops the read time — narrow cards can't hold three items on one line
function metaLine(p, paper, short) {
  return `<p class="meta${paper ? ' meta--paper' : ''}"><b>${esc(p.author)}</b><span class="dot"></span><time datetime="${p.date}">${fmtDate(p.date)}</time>` +
    (p.read && !short ? `<span class="dot"></span><span>${p.read} min read</span>` : '') + `</p>`;
}

function card(p, opts) {
  opts = opts || {};
  return `<article class="card ${opts.cls || ''}">
  <a href="${storyUrl('{{B}}', p)}">
    ${pic(p, 'sm', opts.ratio || 'ph--32')}
    <p class="kicker">${PREM(p) ? premBadge() : esc(catOf(p))}</p>
    <h3 class="hl">${esc(p.title)}</h3>
    ${opts.stand ? `<p class="stand">${clip(p.excerpt, 118)}</p>` : ''}
    ${metaLine(p, false, opts.short)}
  </a>
</article>`;
}

function cardH(p, opts) {
  opts = opts || {};
  return `<article class="card-h"${opts.hidden ? ' hidden' : ''}>
  <a href="${storyUrl('{{B}}', p)}" style="display:contents">
    <div>
      <p class="kicker">${PREM(p) ? premBadge() : esc(catOf(p))}</p>
      <h3 class="hl">${esc(p.title)}</h3>
      ${opts.stand ? `<p class="stand">${clip(p.excerpt, 150)}</p>` : ''}
      ${metaLine(p, false, opts.short)}
    </div>
    ${pic(p, 'sm', 'ph--43')}
  </a>
</article>`;
}

/* ---------------------------------------------------------------- buckets */
const byDate = (a, b) => D(b.date) - D(a.date);
const has = (p, c) => (p.cats || []).includes(c);
const news = feed.filter(p => has(p, 'News')).sort(byDate);
const sport = feed.filter(p => has(p, 'Sport')).sort(byDate);
const premium = feed.filter(PREM).sort(byDate);
const latest = feed.slice().sort(byDate);

const withFile = a => a.filter(p => p.file);

/* ---------------------------------------------------------------- home */
function buildHome() {
  const lead = latest[0];
  const used = new Set([lead.id]);
  const take = (src, n) => {
    const out = withFile(src.filter(p => !used.has(p.id))).slice(0, n);
    out.forEach(p => used.add(p.id));
    return out;
  };
  const trio = take(latest, 3);            // 3-up row under the lead
  const duo = take(latest, 2);             // 2-up horizontal row
  const trio2 = take(news, 3);             // second 3-up, balances the sidebar
  const railItems = take(latest, 9);       // "Latest news" sidebar module
  const mostRead = take(latest, 5);        // "Most read today" sidebar module
  const grid = withFile(news.filter(p => !used.has(p.id))).slice(0, 8);
  grid.forEach(p => used.add(p.id));
  const premItems = withFile(premium.filter(p => !used.has(p.id))).slice(0, 3);
  premItems.forEach(p => used.add(p.id));
  const sportLead = withFile(sport.filter(p => !used.has(p.id)))[0];
  used.add(sportLead.id);
  const sportList = withFile(sport.filter(p => !used.has(p.id))).slice(0, 4);
  sportList.forEach(p => used.add(p.id));

  /* match centre: group remaining sport coverage by competition */
  const comps = [
    { name: 'Clare Senior Hurling', re: /hurl|SHC|camán|Clonlara|Inagh|Ballyea|Kilmaley|Sixmilebridge|Tones/i },
    { name: 'Clare Football', re: /football|IFC|SFC|Cooraclare|Ennistymon|Corofin|Kilmihil|Clondegad|St Breckans/i },
    { name: 'Camogie & Ladies', re: /camogie|ladies|LGFA|women/i }
  ];
  const pool = sport.filter(p => !used.has(p.id));
  const mc = comps.map(c => ({
    name: c.name,
    items: pool.filter(p => c.re.test(p.title)).slice(0, 4)
  })).filter(c => c.items.length);
  mc.forEach(c => c.items.forEach(p => used.add(p.id)));

  const ops = extra.opinion.filter(p => p.file).slice(0, 3);
  const biz = extra.business.filter(p => p.file && !used.has(p.id)).slice(0, 3);
  const arts = extra.arts.filter(p => p.file && !used.has(p.id)).slice(0, 3);

  const digest = (title, slug, items) => `<div>
    <div class="sec-head"><h2>${title}</h2><a class="more" href="${sectionUrl('{{B}}', slug)}">All${ico.arrow}</a></div>
    ${items.map((p, i) => i === 0 ? `<article class="card">
      <a href="${storyUrl('{{B}}', p)}">${pic(p, 'sm', 'ph--32')}<h3 class="hl">${esc(p.title)}</h3>${metaLine(p)}</a>
    </article>` : `<article class="card card--divided" style="margin-top:22px">
      <a href="${storyUrl('{{B}}', p)}"><h3 class="hl" style="font-size:16px">${esc(p.title)}</h3>${metaLine(p)}</a>
    </article>`).join('\n    ')}
  </div>`;

  return head({
    title: 'The Clare Echo — News, sport and life in County Clare',
    desc: 'County Clare’s independent newspaper. Breaking news from Ennis, Shannon and west Clare, full GAA coverage, business, arts and the weekly digital edition.'
  }) + `
${siteHeader('home')}

<main id="main">

  <!-- ============ lead well + sidebar ============ -->
  <section class="lead">
    <div class="wrap home-top">

      <div class="home-main">

        <a class="lead-hero" href="${storyUrl('{{B}}', lead)}">
          <div>
            <p class="kicker">${PREM(lead) ? premBadge() : esc(catOf(lead))}<span class="dot"></span>Lead story</p>
            <h1 class="hl">${esc(lead.title)}</h1>
            
            ${metaLine(lead)}
          </div>
          ${pic(lead, 'lg', 'ph--32', '', true)}
        </a>

        <hr class="rule-h">

        <div class="cards cards--3">
          ${trio.map(p => card(p, { short: true })).join('\n          ')}
        </div>

        <hr class="rule-h">

        <div class="lead-pair">
          ${duo.map(p => cardH(p, { short: true })).join('\n          ')}
        </div>

        <hr class="rule-h">

        <div class="cards cards--3">
          ${trio2.map(p => card(p, { short: true })).join('\n          ')}
        </div>

      </div>

      <aside class="home-rail" aria-label="Latest and most read">

        <div class="railcard">
          <div class="railcard-head"><span class="pip"></span><h2>Latest news</h2></div>
          <ul class="rail-list rail-scroll">
            ${railItems.map(p => `<li><a href="${storyUrl('{{B}}', p)}">
              <time datetime="${p.date}">${rel(p.date)}</time>
              <h3 class="hl">${esc(p.title)}</h3>
              <span class="sec">${PREM(p) ? 'Premium &middot; ' : ''}${esc(catOf(p))}</span>
            </a></li>`).join('\n            ')}
          </ul>
          <div class="railcard-foot">
            <a class="pill" href="${sectionUrl('{{B}}', 'news')}">See more${ico.chev}</a>
          </div>
        </div>

        <div class="railcard">
          <div class="railcard-head"><h2>Most read today</h2></div>
          <ul class="mostread">
            ${mostRead.map((p, i) => `<li><a href="${storyUrl('{{B}}', p)}"><span class="n">${i + 1}</span><h4 class="hl">${esc(p.title)}</h4></a></li>`).join('\n            ')}
          </ul>
        </div>

        <div class="adslot">
          <span>Advertisement</span>
          <div class="adslot-box"><b>MPU slot</b><em>300 &times; 250</em></div>
        </div>

      </aside>

    </div>
  </section>

  <!-- ============ more from clare ============ -->
  <section class="band band--tight rule">
    <div class="wrap">
      <div class="sec-head">
        <h2>Across the county</h2>
        <span class="sub">Ennis &middot; Shannon &middot; Kilrush &middot; Ennistymon</span>
        <a class="more" href="${sectionUrl('{{B}}', 'news')}">More news${ico.arrow}</a>
      </div>
      <div class="cards rv">
        ${grid.map((p, i) => card(p, { stand: i < 4 })).join('\n        ')}
      </div>
    </div>
  </section>

  <!-- ============ premium ============ -->
  <section class="band prem">
    <div class="wrap">
      <div class="prem-top">
        <div>
          <p class="kicker kicker--gold">${ico.lock} Echo Premium</p>
          <h2 style="margin-top:12px">Reporting that only comes from being here</h2>
          <p>Council chambers, club dressing rooms and courtrooms &mdash; the stories our reporters chase all week, kept for subscribers.</p>
        </div>
        <a class="btn btn--primary" href="{{B}}subscribe.html">Subscribe from &euro;3${ico.arrow}</a>
      </div>
      <div class="prem-grid divided divided--paper rv">
        ${premItems.map(p => `<article class="prem-item">
          <a href="${storyUrl('{{B}}', p)}">
            ${pic(p, 'sm', 'ph--32')}
            ${premBadge(true)}
            <h3 class="hl--paper">${esc(p.title)}</h3>
            <p class="stand">${clip(p.excerpt, 122)}</p>
            ${metaLine(p, true)}
          </a>
        </article>`).join('\n        ')}
      </div>
    </div>
  </section>

  <!-- ============ sport ============ -->
  <section class="band">
    <div class="wrap">
      <div class="sec-head">
        <h2>Sport</h2>
        <span class="sub">Every club, every code, every week</span>
        <a class="more" href="${sectionUrl('{{B}}', 'sport')}">All sport${ico.arrow}</a>
      </div>
      <div class="sport-grid divided rv">
        <div class="sport-lead">
          <a href="${storyUrl('{{B}}', sportLead)}">
            ${pic(sportLead, 'lg', 'ph--32')}
            <p class="kicker">${PREM(sportLead) ? premBadge() : 'GAA'}</p>
            <h3 class="hl">${esc(sportLead.title)}</h3>
            <p class="stand">${clip(sportLead.excerpt, 168)}</p>
            ${metaLine(sportLead)}
          </a>
        </div>
        <div class="sport-list">
          ${sportList.map(p => `<article class="item">
            <a href="${storyUrl('{{B}}', p)}">
              <p class="kicker">${PREM(p) ? premBadge() : esc(catOf(p))}</p>
              <h3 class="hl" style="font-size:17px">${esc(p.title)}</h3>
              ${metaLine(p)}
            </a>
          </article>`).join('\n          ')}
        </div>
        <div class="sport-mc">
          <div class="matchcentre">
            <h3>Match centre</h3>
            <p style="font-size:12.5px;color:var(--slate);line-height:1.45">Reports &amp; reaction from the weekend&rsquo;s club championship.</p>
            ${mc.map(c => `<div class="mc-comp">
              <span>${esc(c.name)}</span>
              <ul>${c.items.map(p => `<li><a href="${storyUrl('{{B}}', p)}">${esc(p.title.replace(/^[A-Z\s:]{4,}:\s*/, ''))}</a></li>`).join('')}</ul>
            </div>`).join('\n            ')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ podcasts ============ -->
  <section class="band media">
    <div class="wrap">
      <div class="media-top">
        <h2>Podcasts</h2>
        <a class="pill pill--paper media-all" href="${sectionUrl('{{B}}', 'podcasts')}">All podcasts${ico.chev}</a>
      </div>

      <div class="media-tabs" role="tablist" aria-label="Echo podcast series">
        ${shows.map((s, i) => `<button type="button" role="tab" id="tab-${s.slug}"
          aria-selected="${i === 0}" aria-controls="panel-${s.slug}"
          data-media-tab="${s.slug}">${esc(s.name)}</button>`).join('\n        ')}
      </div>

      ${shows.map((s, i) => {
        const eps = s.episodes.filter(e => e.file);
        const lead = eps[0];
        const rest = eps.slice(1, 6);
        return `<div class="media-panel" role="tabpanel" id="panel-${s.slug}"
        aria-labelledby="tab-${s.slug}"${i === 0 ? '' : ' hidden'}>
        <div class="media-grid">
          <article class="vfeat">
            <a href="${showUrl('{{B}}', s.slug)}">
              <span class="thumb">${thumb(lead)}<span class="play">${ico.play}</span></span>
              <p class="kicker kicker--paper">${esc(s.kicker)}</p>
              <h3 class="hl--paper">${esc(lead.title)}</h3>
              <p>${clip(lead.excerpt, 190)}</p>
              <p class="meta meta--paper"><b>${esc(s.name)}</b><span class="dot"></span><time datetime="${lead.date}">${fmtDate(lead.date)}</time></p>
            </a>
          </article>
          <ul class="vlist">
            ${rest.map(e => `<li><a href="${showUrl('{{B}}', s.slug)}">
              <span class="thumb">${thumb(e)}<span class="play play--sm">${ico.play}</span></span>
              <div><h4 class="hl--paper">${clip(e.title, 84)}</h4>
              <time datetime="${e.date}">${fmtDate(e.date)}</time></div>
            </a></li>`).join('\n            ')}
          </ul>
        </div>
        <div class="media-foot">
          <a class="pill pill--paper" href="${showUrl('{{B}}', s.slug)}">All ${s.count} episodes${ico.chev}</a>
        </div>
      </div>`; }).join('\n      ')}
    </div>
  </section>

  <!-- ============ youtube ============ -->
  <section class="band band--tight">
    <div class="wrap">
      <div class="yt-top">
        <span class="yt-mark">${ico.yt}YouTube</span>
        <div>
          <h2>On the Echo channel</h2>
          <p class="sub">Match clips, breaking footage and full interviews</p>
        </div>
        <a class="more" href="{{B}}youtube.html" style="font-size:13px;font-weight:700;color:var(--blue);display:inline-flex;align-items:center;gap:5px">All videos${ico.arrow}</a>
      </div>
      <div class="yt-grid rv">
        ${vidsVaried.slice(0, 4).map(v => ytCard(v)).join('\n        ')}
      </div>
    </div>
  </section>

  <!-- ============ subscribe ============ -->
  <section class="band subs">
    <div class="wrap">
      ${subsPanel()}
    </div>
  </section>

  <!-- ============ digests ============ -->
  <section class="band">
    <div class="wrap">
      <div class="notice-grid divided rv">
        ${digest('Business', 'business', biz)}
        ${digest('Arts &amp; Culture', 'arts', arts)}
        ${digest('Opinion', 'opinion', ops)}
      </div>
    </div>
  </section>

  ${newsletter()}

</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- section */
const SECTION_META = {
  news: { name: 'News', kicker: 'Section', blurb: 'Everything happening in County Clare — council, courts, planning, health, schools and the parishes in between. Filed by our newsroom in Ennis.' },
  sport: { name: 'Sport', kicker: 'Section', blurb: 'Club championship, county, schools and everything in between. Match reports, reaction and analysis from every corner of the county.' },
  business: { name: 'Business', kicker: 'Section', blurb: 'Jobs, investment, tourism and the traders keeping Clare’s towns open for business.' },
  arts: { name: 'Arts & Culture', kicker: 'Section', blurb: 'Music, festivals, theatre and the heritage that makes Clare what it is — from Doolin to Feakle to the Glór stage.' },
  opinion: { name: 'Opinion', kicker: 'Section', blurb: 'Columns, letters and argument from Clare voices. The Echo’s writers on what the county is talking about.' },
  podcasts: { name: 'Podcasts', kicker: 'Listen', blurb: 'The Water Break and The Business Chamber — long-form conversation, recorded in Ennis.' },
  premium: { name: 'Echo Premium', kicker: 'Subscribers', blurb: 'The reporting that takes weeks, not minutes. Held for the readers who fund it.' }
};

function sectionPool(slug) {
  if (slug === 'news') return news;
  if (slug === 'sport') return sport;
  if (slug === 'premium') return premium;
  if (slug === 'business') return extra.business.filter(p => p.file);
  if (slug === 'arts') return extra.arts.filter(p => p.file);
  if (slug === 'opinion') return extra.opinion.filter(p => p.file);
  if (slug === 'podcasts') return extra.pod.filter(p => p.file);
  return news;
}

function buildSection(slug) {
  const m = SECTION_META[slug];
  const pool = sectionPool(slug).slice().sort(byDate);
  const lead = pool[0];
  const feat = pool.slice(1, 4);
  const stream = pool.slice(4, 22);
  const mostRead = latest.slice(0, 5);

  return head({
    title: `${m.name} — The Clare Echo`,
    desc: m.blurb
  }) + `
${siteHeader(slug)}

<main id="main">

  <section class="sec-hero sec-hero--tight">
    <div class="wrap">
      <h1>${m.name.replace('&', '&amp;')}</h1>
    </div>
  </section>

  <section class="band band--tight">
    <div class="wrap">
      <div class="cards cards--3" style="align-items:start">
        <article class="card card--lg" style="grid-column:span 2">
          <a href="${storyUrl('{{B}}', lead)}">
            ${pic(lead, 'lg', 'ph--21', '', true)}
            <p class="kicker">${PREM(lead) ? premBadge() : esc(catOf(lead))}</p>
            <h3 class="hl">${esc(lead.title)}</h3>
            <p class="stand">${clip(lead.excerpt, 180)}</p>
            ${metaLine(lead)}
          </a>
        </article>
        <div style="display:grid;gap:22px">
          ${feat.map(p => cardH(p)).join('\n          ')}
        </div>
      </div>
    </div>
  </section>

  <section class="band band--tight rule">
    <div class="wrap sec-split">
      <div>
        <div class="sec-head"><h2>More from ${m.name.replace('&', '&amp;')}</h2><span class="sub">${pool.length} stories</span></div>
        <div class="stream">
          ${stream.map((p, i) => cardH(p, { stand: true, hidden: i >= 8 })).join('\n          ')}
        </div>
        ${stream.length > 8 ? `<div class="loadmore"><button class="btn btn--ghost" id="loadmore">Load more stories</button></div>` : ''}
        <div class="pagenav">
          <span class="is-active">1</span><a href="#">2</a><a href="#">3</a><span class="gap">&hellip;</span><a href="#">18</a>
          <a href="#" aria-label="Next page">${ico.chev}</a>
        </div>
      </div>
      <div class="aside">
        <div class="aside-block">
          <h3>Most read today</h3>
          <ul class="mostread">
            ${mostRead.map((p, i) => `<li><a href="${storyUrl('{{B}}', p)}"><span class="n">${i + 1}</span><h4 class="hl">${esc(p.title)}</h4></a></li>`).join('\n            ')}
          </ul>
        </div>
        <div class="aside-promo">
          <h3>Echo Premium</h3>
          <p>Back the reporting that keeps Clare informed.</p>
          <p class="sm">Unlimited access to every story, the digital edition and the full archive from &euro;3 a month.</p>
          <a class="btn btn--primary btn--sm" href="{{B}}subscribe.html">Subscribe${ico.arrow}</a>
        </div>
      </div>
    </div>
  </section>

  ${newsletter()}

</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- story */
function buildStory(p) {
  const locked = PREM(p);
  // the lede paragraph doubles as the standfirst, so the prose picks up after it
  const all = p.body || [];
  const stand = all[0] || p.excerpt;
  const body = all.length > 1 ? all.slice(1) : all;
  const free = locked ? body.slice(0, 3) : body;
  const quoteIdx = body.findIndex((t, i) => i > 2 && /[“"']/.test(t) && t.length > 90 && t.length < 260);
  const sameCat = latest.filter(x => x.id !== p.id && catOf(x) === catOf(p) && x.file).slice(0, 3);
  const mostRead = latest.filter(x => x.id !== p.id).slice(0, 5);

  const paras = [];
  free.forEach((t, i) => {
    paras.push(`<p>${esc(t)}</p>`);
    if (!locked && i === quoteIdx - 1 && quoteIdx > 0) {
      paras.push(`<blockquote class="pull"><p>${esc(body[quoteIdx].replace(/^[“"]|[”"]$/g, '').slice(0, 190))}</p><cite>${esc(p.author)} reports</cite></blockquote>`);
    }
  });
  if (!locked && quoteIdx > 0) {
    // the quoted paragraph is rendered as the pull quote, so drop the duplicate
    paras.splice(quoteIdx + 1, 1);
  }

  return head({
    title: `${p.title} — The Clare Echo`,
    desc: p.excerpt.slice(0, 155),
    type: 'article'
  }) + `
<div class="progress" id="progress"></div>
${siteHeader(catSlug(p))}

<main id="main">

  <div class="wrap">
    <nav class="crumb" aria-label="Breadcrumb">
      <a href="{{B}}index.html">Home</a>${ico.chev}
      <a href="${sectionUrl('{{B}}', catSlug(p))}">${esc(catOf(p))}</a>${ico.chev}
      <span class="cur">${esc(p.title)}</span>
    </nav>
  </div>

  <article data-progress-target>
    <div class="wrap">
      <div class="art-top">
        <div class="art-main">
          <div class="art-head">
            <p class="kicker">${locked ? premBadge() : esc(catOf(p))}</p>
            <h1>${esc(p.title)}</h1>
            <p class="art-stand">${clip(stand, 230)}</p>
            <div class="art-byline">
              <span class="art-av" aria-hidden="true">${esc(initials(p.author))}</span>
              <div>
                <p class="who">${esc(p.author)}</p>
                <p class="when"><time datetime="${p.date}">${esc(fmtLong(p.date))}</time>${p.read ? ` &middot; ${p.read} min read` : ''}</p>
              </div>
              <div class="art-share">
                <a href="{{B}}subscribe.html" aria-label="Share on Facebook">${ico.fb}</a>
                <a href="{{B}}subscribe.html" aria-label="Share on X">${ico.x}</a>
                <button class="stroke" data-share="copy" aria-label="Copy link to this story">${ico.link}</button>
              </div>
              <p class="vh" id="share-live" role="status" aria-live="polite"></p>
            </div>
          </div>

          <figure class="art-hero">
            ${pic(p, 'lg', 'ph--169', '', true)}
            ${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}
          </figure>

          <div class="prose">
            ${paras.join('\n            ')}
          </div>
          ${locked ? `<div class="paywall">
            <div class="paywall-card">
              ${premBadge()}
              <h2>Keep reading with Echo Premium</h2>
              <p>This story is one of ${premium.length}+ pieces of original Clare journalism our reporters filed this month. Subscribers read every word.</p>
              <div class="paywall-cta">
                <a class="btn btn--primary" href="{{B}}subscribe.html">Subscribe from &euro;3${ico.arrow}</a>
                <a class="btn btn--ghost" href="{{B}}subscribe.html">Already a subscriber? Sign in</a>
              </div>
              <p class="sm">Cancel any time. Includes the weekly <a href="{{B}}digital-edition.html">digital edition</a>.</p>
            </div>
          </div>` : ''}
          <div class="tags">
            <span>Filed under</span>
            <a href="${sectionUrl('{{B}}', catSlug(p))}">${esc(catOf(p))}</a>
            ${locked ? `<a href="${sectionUrl('{{B}}', 'premium')}">Premium</a>` : ''}
            <a href="${sectionUrl('{{B}}', 'news')}">County Clare</a>
          </div>
        </div>

        <div class="aside">
          <div class="aside-block">
            <h3>Most read today</h3>
            <ul class="mostread">
              ${mostRead.map((x, i) => `<li><a href="${storyUrl('{{B}}', x)}"><span class="n">${i + 1}</span><h4 class="hl">${esc(x.title)}</h4></a></li>`).join('\n              ')}
            </ul>
          </div>
          <div class="aside-promo">
            <h3>The Thursday paper</h3>
            <p>Read this week&rsquo;s edition before it reaches the shelves.</p>
            <p class="sm">Every page of The Clare Echo, on your phone from Wednesday night.</p>
            <a class="btn btn--primary btn--sm" href="{{B}}digital-edition.html">Open digital edition${ico.arrow}</a>
          </div>
        </div>
      </div>
    </div>
  </article>

  <section class="band band--tight readnext">
    <div class="wrap">
      <div class="sec-head"><h2>Read next</h2><a class="more" href="${sectionUrl('{{B}}', catSlug(p))}">More ${esc(catOf(p))}${ico.arrow}</a></div>
      <div class="cards cards--3">
        ${sameCat.map(x => card(x, { stand: true })).join('\n        ')}
      </div>
    </div>
  </section>

  ${newsletter()}

</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- shows */
function buildShow(show) {
  const eps = show.episodes;
  const art = eps.find(e => e.file);
  const others = shows.filter(s => s.slug !== show.slug);

  return head({
    title: `${show.name} — Clare Echo Podcasts`,
    desc: show.blurb
  }) + `
${siteHeader('podcasts')}

<main id="main" class="show">
  <div class="wrap">

    <div class="show-hero">
      ${art ? `<img src="{{B}}assets/img/${art.file}-lg.webp" alt="" fetchpriority="high" decoding="async">` : ''}
      <div class="show-hero-in">
        <p class="show-name">${esc(show.name.replace(/^The\s+/, ''))}<em>Podcast</em></p>
        <div class="show-cta">
          <a class="btn btn--primary" href="${storyUrl('{{B}}', eps[0])}">
            ${ico.play}<span>Listen<small>Latest episode</small></span>
          </a>
          <a class="btn btn--paper" href="{{B}}subscribe.html">
            ${ico.rss}<span>Download / Subscribe<small>Podcast apps</small></span>
          </a>
        </div>
      </div>
    </div>

    <div class="show-bar">
      <h1>${esc(show.name)}</h1>
      <p class="count">${show.count} episode${show.count === 1 ? '' : 's'} &middot; ${esc(show.kicker)}</p>
      <p>${esc(show.blurb)}</p>
      <a class="show-back" href="${sectionUrl('{{B}}', 'podcasts')}">${ico.arrow}Back to all podcasts</a>
    </div>

    <h2 class="epi-head">Podcast episodes</h2>

    <div class="show-split">
      <div class="epi-list">
        ${eps.map((e, i) => `<article class="epi"${i >= 10 ? ' hidden' : ''}>
          <a href="${storyUrl('{{B}}', e)}">
            <span class="thumb">${thumb(e)}<span class="play play--sm">${ico.play}</span></span>
            <div>
              <h3>${esc(e.title)}</h3>
              <p>${clip(e.excerpt, 168)}</p>
              <p class="emeta">${fmtDate(e.date)} &middot; ${esc(show.name)}</p>
            </div>
          </a>
        </article>`).join('\n        ')}
        ${eps.length > 10 ? `<div class="loadmore" style="margin-top:20px">
          <button class="pill pill--paper" id="loadmore-epi">Load more episodes</button>
        </div>` : ''}
      </div>

      <aside class="show-aside">
        <div class="adslot">
          <span>Advertisement</span>
          <div class="adslot-box"><b>MPU slot</b><em>300 &times; 250</em></div>
        </div>
        ${others.length ? `<div class="other-shows">
          <h3>More Echo podcasts</h3>
          ${others.map(s => `<a href="${showUrl('{{B}}', s.slug)}">
            <span class="thumb">${thumb(s.episodes.find(e => e.file))}</span>
            <div><b>${esc(s.name)}</b><span>${s.count} episodes &middot; ${esc(s.kicker)}</span></div>
          </a>`).join('\n          ')}
        </div>` : ''}
      </aside>
    </div>

  </div>
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- youtube page */
function buildYouTube() {
  return head({
    title: 'Video — The Clare Echo on YouTube',
    desc: 'Match clips, breaking footage and full interviews from The Clare Echo YouTube channel.'
  }) + `
${siteHeader('')}

<main id="main">
  <section class="sec-hero">
    <div class="wrap">
      <p class="kicker"><span class="yt-mark">${ico.yt}YouTube</span></p>
      <h1 style="margin-top:14px">Video</h1>
      <p>Match clips, breaking footage and full interviews &mdash; filmed around the county
      and published to the Echo&rsquo;s channel.</p>
      <div class="sec-chips" style="margin-top:22px">
        <a href="${yt.channel}" target="_blank" rel="noopener" class="is-active">Visit the channel</a>
        <a href="${sectionUrl('{{B}}', 'podcasts')}">Podcasts</a>
        <a href="{{B}}digital-edition.html">Digital Edition</a>
      </div>
    </div>
  </section>

  <section class="band band--tight">
    <div class="wrap">
      <div class="yt-grid">
        ${vids.map(v => ytCard(v)).join('\n        ')}
      </div>
      <p style="margin-top:34px;text-align:center;font-size:13px;color:var(--slate)">
        ${vids.length} most recent uploads &mdash;
        <a href="${yt.channel}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:650">see the full channel on YouTube</a>.
      </p>
    </div>
  </section>

  ${newsletter()}
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- podcast index */
function buildPodcastIndex() {
  return head({
    title: 'Podcasts — The Clare Echo',
    desc: 'The Water Break, The Business Chamber and The Electoral Chair — long-form conversation from the Echo newsroom in Ennis.'
  }) + `
${siteHeader('podcasts')}

<main id="main" class="show">
  <div class="wrap">
    <div class="show-bar" style="margin-top:0">
      <p class="count" style="margin-top:0">Listen</p>
      <h1 style="margin-top:9px;font-size:clamp(28px,4vw,44px)">Echo Podcasts</h1>
      <p>Three series from the newsroom in Ennis &mdash; the county&rsquo;s GAA week,
      the people building businesses in Clare, and the politics behind the count.</p>
    </div>

    ${shows.map(s => {
      const eps = s.episodes.filter(e => e.file);
      return `<section style="margin-top:clamp(28px,4vw,44px)">
      <div class="show-hero" style="min-height:clamp(180px,24vw,260px)">
        ${eps[0] ? `<img src="{{B}}assets/img/${eps[0].file}-lg.webp" alt="" loading="lazy" decoding="async">` : ''}
        <div class="show-hero-in">
          <p class="show-name" style="font-size:clamp(24px,4vw,48px)">${esc(s.name.replace(/^The\s+/, ''))}<em>Podcast</em></p>
          <div class="show-cta">
            <a class="btn btn--primary" href="${showUrl('{{B}}', s.slug)}">
              ${ico.play}<span>All ${s.count} episodes<small>${esc(s.kicker)}</small></span>
            </a>
          </div>
        </div>
      </div>
      <p style="margin-top:14px;font-size:15px;line-height:1.6;color:rgba(255,255,255,.7);max-width:64ch">${esc(s.blurb)}</p>
      <div class="epi-list" style="margin-top:18px">
        ${eps.slice(0, 3).map(e => `<article class="epi">
          <a href="${storyUrl('{{B}}', e)}">
            <span class="thumb">${thumb(e)}<span class="play play--sm">${ico.play}</span></span>
            <div>
              <h3>${esc(e.title)}</h3>
              <p>${clip(e.excerpt, 150)}</p>
              <p class="emeta">${fmtDate(e.date)} &middot; ${esc(s.name)}</p>
            </div>
          </a>
        </article>`).join('\n        ')}
      </div>
    </section>`; }).join('\n    ')}

  </div>
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- sub-nav
   News and Sport carry sub-sections. The Echo's WordPress has no taxonomy for
   most of these yet, so each one is matched against the real story text by
   place name or subject — the pages are populated with genuine articles and
   will simply pick up more as the archive grows. */
const SUBNAV = {
  news: [
    { name: 'Latest News', slug: 'latest-news', re: null },
    { group: 'Regional', items: [
      { name: 'Ennis', slug: 'ennis', re: /\bennis\b(?!tymon)/i },
      { name: 'Shannon', slug: 'shannon', re: /\bshannon\b/i },
      { name: 'East Clare', slug: 'east-clare',
        re: /\b(tulla|scariff|feakle|killaloe|ogonnelloe|bodyke|mountshannon|broadford|sixmilebridge|clonlara|truagh|east clare)\b/i },
      { name: 'West Clare', slug: 'west-clare',
        re: /\b(kilrush|kilkee|doonbeg|cooraclare|quilty|miltown|kilmihil|carrigaholt|kilbaha|coolmeen|west clare)\b/i },
      { name: 'North Clare', slug: 'north-clare',
        re: /\b(ennistymon|lisdoonvarna|lahinch|corofin|moher|burren|kilfenora|liscannor|doolin|north clare)\b/i },
      { name: 'Gort & South Galway', slug: 'gort-south-galway', re: /\b(gort|south galway)\b/i }
    ] },
    { name: 'Courts & Crime', slug: 'courts-crime',
      re: /\b(court|garda|garda[ií]|charged|sentenc\w*|convict\w*|assault|theft|crime|illegal|prosecut\w*)\b/i },
    { name: 'Education', slug: 'education',
      re: /\b(school|students?|college|pupils?|teachers?|university|education)\b/i },
    { name: 'Politics', slug: 'politics',
      re: /\b(councillor|cllr|council|td|minister|d[áa]il|fianna f[áa]il|fine gael|sinn f[ée]in|election|motion)\b/i }
  ],
  sport: [
    { group: 'GAA', items: [
      { name: 'Hurling', slug: 'hurling', re: /\b(hurl\w*|shc|camogie|canon hamilton)\b/i },
      { name: 'Football', slug: 'football', re: /\b(football|sfc|ifc)\b/i }
    ] },
    { name: 'Soccer', slug: 'soccer',
      re: /\b(soccer|premier division|league of ireland|fai|newmarket celtic|avenue utd|tulla utd)\b/i },
    { name: 'Rugby', slug: 'rugby', re: /\b(rugby|all-ireland league)\b/i },
    { name: 'Golf', slug: 'golf', re: /\bgolf\w*\b/i },
    { name: 'Greyhounds', slug: 'greyhounds', re: /\b(greyhound\w*|sweepstake|sprint cup|bar one)\b/i }
  ]
};

// flat list of every topic, with the parent it belongs to
const TOPICS = [];
for (const [parent, entries] of Object.entries(SUBNAV)) {
  for (const e of entries) {
    if (e.group) e.items.forEach(i => TOPICS.push({ ...i, parent, group: e.group }));
    else TOPICS.push({ ...e, parent });
  }
}
const topicUrl = (B, slug) => `${B}topic/${slug}.html`;

const searchText = p => `${p.title} ${(p.body || []).join(' ')}`;
function topicPool(t) {
  const base = t.parent === 'sport' ? sport : news;
  if (!t.re) return base.slice();
  return base.filter(p => t.re.test(searchText(p)));
}

// the dropdown panel shared by the section row
function subMenu(parent) {
  const entries = SUBNAV[parent];
  if (!entries) return '';
  return `<div class="submenu"><div class="submenu-in">
        ${entries.map(e => e.group
          ? `<div class="submenu-group"><p>${esc(e.group)}</p>
          ${e.items.map(i => `<a href="${topicUrl('{{B}}', i.slug)}">${esc(i.name)}</a>`).join('\n          ')}
        </div>`
          : `<a class="submenu-top" href="${topicUrl('{{B}}', e.slug)}">${esc(e.name)}</a>`
        ).join('\n        ')}
      </div></div>`;
}

function buildTopic(t) {
  const pool = topicPool(t).slice().sort(byDate);
  const parentName = t.parent === 'sport' ? 'Sport' : 'News';
  const lead = pool[0];
  const feat = pool.slice(1, 4);
  const stream = pool.slice(4, 22);
  const mostRead = latest.slice(0, 5);
  const siblings = TOPICS.filter(x => x.parent === t.parent);

  return head({
    title: `${t.name} — ${parentName} — The Clare Echo`,
    desc: `${t.name} coverage from The Clare Echo — ${parentName.toLowerCase()} from across County Clare.`
  }) + `
${siteHeader(t.parent)}

<main id="main">

  <section class="sec-hero">
    <div class="wrap">
      <p class="kicker"><a href="${sectionUrl('{{B}}', t.parent)}">${esc(parentName)}</a>${t.group ? ` <span class="dot"></span> ${esc(t.group)}` : ''}</p>
      <h1>${esc(t.name)}</h1>
      <p>${pool.length} ${pool.length === 1 ? 'story' : 'stories'} filed under ${esc(t.name)}.</p>
      <div class="sec-chips">
        ${siblings.map(s => `<a href="${topicUrl('{{B}}', s.slug)}"${s.slug === t.slug ? ' class="is-active"' : ''}>${esc(s.name)}</a>`).join('\n        ')}
      </div>
    </div>
  </section>

  ${lead ? `<section class="band band--tight">
    <div class="wrap">
      <div class="cards cards--3" style="align-items:start">
        <article class="card card--lg" style="grid-column:span 2">
          <a href="${storyUrl('{{B}}', lead)}">
            ${pic(lead, 'lg', 'ph--21', '', true)}
            <p class="kicker">${PREM(lead) ? premBadge() : esc(catOf(lead))}</p>
            <h3 class="hl">${esc(lead.title)}</h3>
            <p class="stand">${clip(lead.excerpt, 180)}</p>
            ${metaLine(lead)}
          </a>
        </article>
        <div style="display:grid;gap:22px">
          ${feat.map(p => cardH(p)).join('\n          ')}
        </div>
      </div>
    </div>
  </section>` : ''}

  <section class="band band--tight rule">
    <div class="wrap sec-split">
      <div>
        <div class="sec-head"><h2>More ${esc(t.name)}</h2><span class="sub">${pool.length} stories</span></div>
        ${stream.length ? `<div class="stream">
          ${stream.map((p, i) => cardH(p, { stand: true, hidden: i >= 8 })).join('\n          ')}
        </div>
        ${stream.length > 8 ? `<div class="loadmore"><button class="btn btn--ghost" id="loadmore">Load more stories</button></div>` : ''}`
        : `<p style="font-size:15px;color:var(--slate)">More ${esc(t.name)} coverage will appear here as it is filed.</p>`}
      </div>
      <div class="aside">
        <div class="aside-block">
          <h3>Most read today</h3>
          <ul class="mostread">
            ${mostRead.map((p, i) => `<li><a href="${storyUrl('{{B}}', p)}"><span class="n">${i + 1}</span><h4 class="hl">${esc(p.title)}</h4></a></li>`).join('\n            ')}
          </ul>
        </div>
        <div class="adslot" style="margin-top:0">
          <span>Advertisement</span>
          <div class="adslot-box"><b>MPU slot</b><em>300 &times; 250</em></div>
        </div>
      </div>
    </div>
  </section>

  ${newsletter()}
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- obituaries */
function buildObituaries() {
  const kinds = [
    ['Death notice', 'Announces a death, with funeral arrangements. Published as soon as we receive it and updated if arrangements change.'],
    ['Acknowledgement', 'Thanks from the family to all who sympathised, usually published a few weeks after the funeral.'],
    ['Month&rsquo;s Mind', 'Notice of the Month&rsquo;s Mind Mass.'],
    ['In Memoriam', 'An anniversary remembrance, with a verse if you wish.']
  ];
  return head({
    title: 'Obituaries & Family Notices — The Clare Echo',
    desc: 'Death notices, acknowledgements, Month’s Mind and In Memoriam notices from across County Clare.'
  }) + `
${siteHeader('obituaries')}

<main id="main">
  <section class="sec-hero">
    <div class="wrap">
      <p class="kicker">Family Notices</p>
      <h1>Obituaries</h1>
      <p>Death notices, acknowledgements and remembrances from every parish in the county,
      published as we receive them and free to read for everyone.</p>
    </div>
  </section>

  <section class="band band--tight">
    <div class="wrap sec-split">
      <div>
        <div class="sec-head"><h2>Today&rsquo;s notices</h2><span class="sub">Updated through the day</span></div>
        <div class="notice-empty">
          <p><b>No notices have been published yet today.</b></p>
          <p>Notices appear here as soon as the newsroom receives them. To place one, ring
          the office on <a href="tel:+353851488435">+353 85 148 8435</a> or email
          <a href="mailto:ross@clareecho.ie">ross@clareecho.ie</a>.</p>
        </div>

        <div class="sec-head" style="margin-top:clamp(30px,4vw,44px)"><h2>Types of notice</h2></div>
        <ul class="notice-kinds">
          ${kinds.map(([k, d]) => `<li><b>${k}</b><span>${d}</span></li>`).join('\n          ')}
        </ul>
      </div>

      <div class="aside">
        <div class="aside-promo">
          <h3>Place a notice</h3>
          <p>We will take it over the phone.</p>
          <p class="sm">The office is open Monday to Friday. Notices received before 4pm are
          published the same day.</p>
          <a class="btn btn--primary btn--sm" href="tel:+353851488435">+353 85 148 8435${ico.arrow}</a>
        </div>
        <div class="adslot" style="margin-top:0">
          <span>Advertisement</span>
          <div class="adslot-box"><b>MPU slot</b><em>300 &times; 250</em></div>
        </div>
      </div>
    </div>
  </section>

  ${newsletter()}
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- contributors
   Real bylines only — no invented roles or bios, since the archive doesn't
   carry that data. `stories` is assembled near the bottom of this file, but
   it exists by the time this function actually runs (build.js calls every
   page builder after that point). */
function buildContributors() {
  const by = new Map();
  stories.forEach(p => {
    if (!p.author) return;
    if (!by.has(p.author)) by.set(p.author, []);
    by.get(p.author).push(p);
  });
  const people = [...by.entries()]
    .map(([name, posts]) => ({ name, posts: posts.slice().sort(byDate) }))
    .sort((a, b) => b.posts.length - a.posts.length);

  return head({
    title: 'Contributors — The Clare Echo',
    desc: 'The reporters filing for The Clare Echo — News, Sport, Business, Arts, Opinion and the podcasts.'
  }) + `
${siteHeader('contributors')}

<main id="main">
  <section class="sec-hero sec-hero--tight">
    <div class="wrap">
      <p class="kicker">The Echo</p>
      <h1>Contributors</h1>
    </div>
  </section>

  <section class="band band--tight">
    <div class="wrap">
      <div class="op-grid divided">
        ${people.map(p => `<div class="op">
          <span class="op-av" aria-hidden="true">${esc(initials(p.name))}</span>
          <div>
            <p class="name">${p.posts.length} ${p.posts.length === 1 ? 'story' : 'stories'}</p>
            <h3>${esc(p.name)}</h3>
            <p class="stand">Latest: <a href="${storyUrl('{{B}}', p.posts[0])}" style="color:var(--blue);font-weight:650">${clip(p.posts[0].title, 64)}</a></p>
          </div>
        </div>`).join('\n        ')}
      </div>
    </div>
  </section>

  ${newsletter()}
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- statics */
/* ---------------------------------------------------------------- advertise
   Figures, team and office from the Echo's own advertise_with_us page. */
const AD_TEAM = [
  { name: 'Ross Houlihan', role: 'Sales Director', email: 'ross@clareecho.ie' },
  { name: 'Kieran Murphy', role: 'Account Executive', email: 'kieran@clareecho.ie' }
];

function buildAdvertise() {
  return head({
    title: 'Advertise with us — The Clare Echo',
    desc: "Clare's most read media title — 13,500 papers a week and 100,000 page views. Print and online advertising with The Clare Echo."
  }) + `
${siteHeader('')}

<main id="main">

  <section class="sec-hero">
    <div class="wrap">
      <p class="kicker">Print + Online</p>
      <h1>Advertise with us</h1>
      <p>We are Clare&rsquo;s most read and interactive media title, in print every Thursday
      and online every hour. Talk to us about reaching the whole county.</p>
    </div>
  </section>

  <section class="band band--tight">
    <div class="wrap">
      <div class="adv-stats">
        <div><b>100,000+</b><span>Page views a week</span></div>
        <div><b>100,000+</b><span>People reached every week</span></div>
        <div><b>13,500+</b><span>Papers printed every week</span></div>
      </div>

      <div class="notice-grid divided" style="margin-top:clamp(30px,4vw,44px)">
        <div>
          <div class="sec-head"><h2>Print</h2></div>
          <p style="font-size:15px;line-height:1.65;color:var(--ink-soft)">
            Over <b>13,500 papers printed every week</b> and read across the county &mdash;
            Ennis, Shannon, Kilrush, Ennistymon and every parish between. Booked sizes run
            from a full page down to a front-page banner.</p>
          <a class="pill" style="margin-top:18px" href="{{B}}subscribe.html">See advert sizes${ico.chev}</a>
        </div>
        <div>
          <div class="sec-head"><h2>Online</h2></div>
          <p style="font-size:15px;line-height:1.65;color:var(--ink-soft)">
            Post your content on the most viewed news website in the county, with a
            <b>guaranteed 1,000+ page views</b> to your advert or article. Displays on
            desktop, mobile and tablet.</p>
        </div>
        <div>
          <div class="sec-head"><h2>Performance</h2></div>
          <p style="font-size:15px;line-height:1.65;color:var(--ink-soft)">
            Your advert has a much higher chance of being seen with us. Our average
            <b>click-through rate is 0.4%</b> &mdash; well above the display average.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="band band--tight band--wash">
    <div class="wrap">
      <div class="sec-head"><h2>Talk to one of our advertising team today</h2></div>
      <div class="adv-team">
        ${AD_TEAM.map(p => `<div class="adv-person">
          <span class="av" aria-hidden="true">${esc(initials(p.name))}</span>
          <div>
            <b>${esc(p.name)}</b>
            <span>${esc(p.role)}</span>
            <a href="mailto:${p.email}">${p.email}</a>
          </div>
        </div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="band band--tight">
    <div class="wrap sec-split">
      <div>
        <div class="sec-head"><h2>Contact us</h2></div>
        <form class="adv-form" id="adv-form" novalidate>
          <div><label for="ad-name">Name</label><input id="ad-name" name="name" type="text" autocomplete="name" required></div>
          <div><label for="ad-email">Email</label><input id="ad-email" name="email" type="email" autocomplete="email" required></div>
          <div><label for="ad-phone">Phone</label><input id="ad-phone" name="phone" type="tel" autocomplete="tel"></div>
          <div><label for="ad-dept">Department</label>
            <select id="ad-dept" name="department">
              <option>Advertising &mdash; print</option>
              <option>Advertising &mdash; online</option>
              <option>Sponsored content</option>
              <option>Job Watch</option>
              <option>Something else</option>
            </select>
          </div>
          <div class="full"><label for="ad-msg">Message</label><textarea id="ad-msg" name="message"></textarea></div>
          <div class="full"><button class="btn btn--primary" type="submit">Send${ico.arrow}</button></div>
        </form>
        <p class="adv-ok" id="adv-ok">${ico.check}<span>Thanks &mdash; one of the team will come back to you.</span></p>
      </div>

      <aside>
        <div class="adv-office">
          <h3>Pop into the office</h3>
          <address>
            The Clare Echo<br>
            Unit 9, Clare Road Mall<br>
            Clare Road, Ennis<br>
            Co. Clare, V95 AK7P
          </address>
          <a href="tel:+353851488435">+353 85 148 8435</a>
          <a href="mailto:ross@clareecho.ie">ross@clareecho.ie</a>
        </div>
        <div class="adslot" style="margin-top:20px">
          <span>Advertisement</span>
          <div class="adslot-box"><b>MPU slot</b><em>300 &times; 250</em></div>
        </div>
      </aside>
    </div>
  </section>

  ${newsletter()}
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

function buildSubscribe() {
  return head({
    title: 'Subscribe — The Clare Echo',
    desc: 'Local news matters. Subscribe to The Clare Echo from €3 a month or €69.99 a year and back independent journalism in County Clare.'
  }) + `
${siteHeader('')}

<main id="main">
  <section class="band">
    <div class="wrap">
      ${subsPanel()}
    </div>
  </section>

  <section class="band band--tight band--wash">
    <div class="wrap">
      <div class="sec-head"><h2>What a subscription gets you</h2></div>
      <ul class="de-list" style="max-width:640px;margin-inline:auto;gap:14px">
        <li style="color:var(--ink-soft)">${ico.check}<span>Unlimited access to every story on clareecho.ie, on any device</span></li>
        <li style="color:var(--ink-soft)">${ico.check}<span><b>Echo Premium</b> &mdash; the investigations and long reads held for subscribers</span></li>
        <li style="color:var(--ink-soft)">${ico.check}<span>The full <a href="{{B}}digital-edition.html" style="color:var(--blue);font-weight:650">digital edition</a> every Thursday, page for page</span></li>
        <li style="color:var(--ink-soft)">${ico.check}<span>Every edition since 2018, fully searchable</span></li>
        <li style="color:var(--ink-soft)">${ico.check}<span>Newsletters and podcast extras</span></li>
      </ul>
      <p style="margin-top:30px;text-align:center;font-size:13px;color:var(--slate)">
        Cancel any time. Student and over-66 rates available &mdash;
        <a href="{{B}}advertise.html" style="color:var(--blue);font-weight:650">talk to us</a>.
      </p>
    </div>
  </section>

  ${newsletter()}
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

function buildDigital() {
  const covers = withFile(latest).slice(0, 4);
  return head({ title: 'Digital Edition — The Clare Echo', desc: 'Read every page of The Clare Echo online, published each Wednesday night.' }) + `
${siteHeader('')}

<main id="main">
  <section class="sec-hero">
    <div class="wrap">
      <p class="kicker">Every Thursday</p>
      <h1>Digital Edition</h1>
      <p>The complete paper &mdash; notices, fixtures, planning lists, the lot &mdash; published online the night before it reaches the shelves.</p>
    </div>
  </section>

  <section class="band band--tight">
    <div class="wrap">
      <div class="sec-head"><h2>Recent editions</h2><span class="sub">Archive back to 2018</span></div>
      <div class="cards" style="gap:28px 24px">
        ${covers.map((p, i) => `<a href="{{B}}subscribe.html" class="card">
          <div class="ph" style="aspect-ratio:1/1.38;border:1px solid var(--line)">
            <img src="{{B}}assets/img/${p.file}-sm.webp" alt="" loading="lazy" decoding="async" style="object-position:top">
          </div>
          <h3 class="hl" style="margin-top:14px;font-size:16px">Issue ${402 - i}</h3>
          <p class="meta"><time datetime="${p.date}">${fmtDate(p.date)}</time></p>
        </a>`).join('\n        ')}
      </div>
    </div>
  </section>

  ${newsletter()}
</main>

${footer()}
${drawer()}
${searchOverlay()}
${tail()}`;
}

/* ---------------------------------------------------------------- write */
function write(rel, html, depth) {
  const B = depth ? '../'.repeat(depth) : '';
  const out = html.replace(/\{\{B\}\}/g, B);
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out, 'utf8');
  return out.length;
}

let bytes = 0, pages = 0;
bytes += write('index.html', buildHome(), 0); pages++;
bytes += write('subscribe.html', buildSubscribe(), 0); pages++;
bytes += write('advertise.html', buildAdvertise(), 0); pages++;
bytes += write('obituaries.html', buildObituaries(), 0); pages++;
TOPICS.forEach(t => { bytes += write(`topic/${t.slug}.html`, buildTopic(t), 1); pages++; });
bytes += write('digital-edition.html', buildDigital(), 0); pages++;
Object.keys(SECTION_META).forEach(slug => {
  const html = slug === 'podcasts' ? buildPodcastIndex() : buildSection(slug);
  bytes += write(`section/${slug}.html`, html, 1); pages++;
});
shows.forEach(s => { bytes += write(`podcast/${s.slug}.html`, buildShow(s), 1); pages++; });
bytes += write('youtube.html', buildYouTube(), 0); pages++;

const podEpisodes = shows.flatMap(s => s.episodes);
const stories = feed.concat(podEpisodes, extra.pod, extra.opinion, extra.business, extra.arts);
bytes += write('contributors.html', buildContributors(), 0); pages++;
const done = new Set();
stories.forEach(p => {
  if (done.has(p.slug)) return;
  done.add(p.slug);
  if (!p.body) { p.body = [p.excerpt]; p.read = 1; }
  bytes += write(`story/${p.slug}.html`, buildStory(p), 1); pages++;
});

/* search index */
const index = [];
const seenIdx = new Set();
stories.forEach(p => {
  if (seenIdx.has(p.slug)) return;
  seenIdx.add(p.slug);
  index.push({ t: p.title, s: catOf(p), u: `story/${p.slug}.html` });
});
fs.writeFileSync(path.join(ROOT, 'data/search.json'), JSON.stringify(index), 'utf8');

/* favicon */
fs.writeFileSync(path.join(ROOT, 'assets/favicon.svg'),
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="12" fill="#0080FF"/>
<text x="32" y="43" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="31" font-weight="900" letter-spacing="-1.5" fill="#fff">CE</text>
</svg>`, 'utf8');

console.log(`built ${pages} pages · ${(bytes / 1024 / 1024).toFixed(2)} MB html · ${index.length} search entries`);
