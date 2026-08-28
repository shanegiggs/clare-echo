# The Clare Echo — website redesign

A complete, modern rebuild of [clareecho.ie](https://www.clareecho.ie/) as a static site.
178 pages, no framework, no build step beyond a Node generator.

**Preview:** `clare-echo` in `.claude/launch.json` → http://localhost:5126

---

## Design

| | |
|---|---|
| Typeface | **Inter** — self-hosted variable woff2, latin + latin-ext (Irish fadas render properly) |
| Primary | `#0080FF` |
| Slate | `#597785` |
| Ink | `#000000` (text sits on `#0A0C0E` for a softer black) |
| Paper | `#FFFFFF` |
| Gold | `#B8862B` — Premium only, so the paywall never competes with the brand blue |

The logo is the client's **master vector** (`assets/brand/logo-horizontal.svg` and
`logo-stacked.svg`), inlined once per page as a `<symbol>` and placed with `<use>`.
Document CSS cannot reach inside a `<use>` shadow tree, so the fills are inline styles:
the wordmark takes `currentColor` and the arcs `var(--logo-arc)`. Both inherit through,
so one sprite reproduces both official files — black type with blue arcs, and the
all-white knockout — with no second copy of the artwork. Horizontal is the default; stacked runs in the footer
and, knocked out white, in the blue brand bar. Sized by height via `--logo-h`. Favicon is a blue tile with "CE".

Headline tracking sits around `-0.022em` at body scale, opening to `-0.036em` on the
largest display sizes — deliberately looser than the tight-grotesque default so long
Irish place names and club names stay readable.

Layout is a hairline-ruled editorial grid: rules sit in the *middle of the column gap*
(`.divided`) rather than eating one column's width, so every track keeps the width its
`fr` value asked for.

## Header

Three tiers, on a client reference: a black **utility bar** (date, e-paper, job watch,
directory, a blue Subscribe chip, log in), a blue **brand bar** with the burger left, the
white mark centred and search right, and a white **section row** in caps with pipe rules.

The reference came in two variants — grey-on-white utility bar and white-on-black. Black
won: the grey version sits near 4:1 at 11px caps, the black one clears 9:1. The compact
scale won too, taking the header from ~210px to 139px.

The **brand bar is the sticky element**, not the section row: it keeps the mark, search
and the burger (which opens every section) in reach, while the section row is free to
scroll away. The burger is not redundant with the visible sections — the row shows the
main ones, the drawer has the lot.

News and Sport carry **dropdowns** (`SUBNAV` in `tools/build.js`). These are desktop-only
by necessity: below 1081px the section row scrolls horizontally, and an `overflow` container
cannot show an overflowing panel — so `.seclist` only drops its overflow at the wide
breakpoint, and the drawer carries the same sub-sections everywhere else.

The Echo's WordPress has no taxonomy for most sub-sections yet, so each `topic/*` page
matches the real story text by place name or subject. Every one of the 16 is populated
with genuine articles today and will pick up more as the archive grows.

## Pages

- `index.html` — a **story well plus a persistent sidebar** across the top
  (client direction, referencing Euronews):
  - well: lead story with copy left / picture right, then a 3-up card row, a 2-up
    row with the picture leading, and a second 3-up — hairline rules between
  - sidebar: boxed **Latest news** module (timestamps, internal scroll, "See more"
    pill), **Most read today**, and a labelled **MPU ad slot** so the client can see
    where inventory sits
  - then full-width bands: county grid, Premium, Sport with a Match Centre, a dark
    **Podcasts** band on the Euronews videos model (client reference) with series tabs,
    a featured episode and a rail, a **YouTube** row, a **Local News Matters**
    subscribe panel with an annual/monthly toggle, Business/Arts/Opinion digests,
    newsletter
- `section/{news,sport,business,arts,opinion,podcasts,premium}.html` — section hero,
  chip nav, featured block, story stream with load-more, most-read + promo rail
- `story/*.html` — 146 article and episode pages: standfirst, byline, share, captioned hero,
  pull quote, **Premium paywall gate**, tags, read-next, most-read rail, reading progress
- `section/podcasts.html` — index of the three shows, each with a banner and its three
  latest episodes
- `podcast/{the-water-break,the-business-chamber,the-electoral-chair}.html` — show pages
  on the RTÉ model (client reference): banner hero with the show name and a Listen /
  Download-Subscribe pair, episode count and blurb, then the episode list with a
  "Load more" beyond ten, an MPU slot and a "More Echo podcasts" rail
- `youtube.html` — the channel's 15 most recent uploads
- `advertise.html` — real reach figures, the sales team, office address and an enquiry form
- `obituaries.html` — family notices: an honest empty state with the real office contact,
  and the four standard notice types, ready for content
- `topic/*.html` — 16 sub-section pages under News and Sport
- `subscribe.html`, `digital-edition.html`

## Brand book

`brand/styleguide.html` is the graphic-design style guide — logo lockups and misuse,
colour with CMYK and nearest-Pantone, a print type scale in points with InDesign tracking
values, the seven-column page grid, advert sizes, photography and caption rules, social
templates and a pre-press checklist. It is written for print and graphics, not the website,
though every colour and type value in it is the one the site is built from.

Published as an Artifact:
<https://claude.ai/code/artifact/3428dec4-9c13-4939-8222-13c359b028b1>

The source file has no `<html>`/`<body>` wrapper because the Artifact host supplies one.
To view it locally, regenerate the wrapper and open `/brand/_preview.html`:

```bash
node -e "const f=require('fs');f.writeFileSync('brand/_preview.html','<!doctype html><html><head><meta charset=utf-8><meta name=viewport content=\"width=device-width,initial-scale=1\"></head><body>'+f.readFileSync('brand/styleguide.html','utf8')+'</body></html>')"
```


**Deployed:** the guide is also published to GitHub Pages from a separate repo,
[shanegiggs/clare-echo-styleguide](https://github.com/shanegiggs/clare-echo-styleguide)
— live at <https://shanegiggs.github.io/clare-echo-styleguide/>. Regenerate that repo's
standalone `index.html` (the Artifact source has no `<head>`) with:

```bash
node tools/build-styleguide.js ../clare-echo-styleguide
```

Figures marked † in the guide (trim size, advert dimensions, Pantone matches, stock weight)
are proposals taken from the current paper and need confirming against the printer's spec
sheet and a physical Pantone guide.

## Content

Every headline, photo, byline, date and body paragraph is **real Clare Echo editorial**,
pulled from their public WordPress REST API (`/wp-json/wp/v2/posts`) — 120 stories across
News, Sport, Premium, Business, Arts, Opinion and the podcasts. Bylines were resolved from
the article pages. Images were downloaded and re-encoded to WebP at two widths
(1400 / 700) with `sharp`.

Subscription pricing, the advertising reach figures, the sales team and the office
address are all the Echo's own, taken from their live subscribe and `advertise_with_us`
pages. `PLANS` in `tools/build.js` is the single source for the prices, shared by the
homepage panel and the subscribe page.

**Placeholder, not real:** the "Issue 402" number and the Digital Edition covers (which
reuse story photos). Everything else is theirs.

## Media

`tools/fetch-media.js` builds `data/podcasts.json` and `data/youtube.json`. Podcasts come
from the Echo's WordPress podcast category, grouped into their three real series —
**The Water Break** (30 episodes, Clare GAA), **The Business Chamber** (4, Joe Melody with
Ennis Chamber of Commerce) and **The Electoral Chair** (5, Páraic McMahon, Mark Dunphy,
Gerry Reidy and Joe Melody). Hosts and affiliations are taken from the episode copy, not
invented.

YouTube comes from the channel's public RSS feed (`/feeds/videos.xml?channel_id=…`) — no
API key — and thumbnails are pulled local and re-encoded, so the page never calls
i.ytimg.com. The channel id resolves from the `@handle` page via `"externalId"`.

```bash
node tools/fetch-media.js   # then clean.js and build.js
```

## Build

```bash
node tools/clean.js    # lift photo captions out of the copy (idempotent)
node tools/build.js    # generate all 178 pages + search index + favicon
node tools/links.js    # verify every internal link resolves
```

`tools/clean.js` exists because the WordPress excerpts and first body paragraphs open with
the photo caption — `"*Seán Kennedy returned from injury… Photograph: Gerard O'Neill.
KILMALEY have been…"`. It anchors on the credit marker (or the Echo's `||`/`*` caption
flags), finds where the story's all-caps lede begins, and files the caption under the
picture where it belongs. 60 of 120 stories needed it.

## Screenshots

`tools/capture.js` drives headless Edge over CDP:

```bash
node tools/capture.js                          # 10 section spots × 3 viewports
CAP_FULL=1 node tools/capture.js               # whole-page shots
CAP_PAGE=section/sport.html node tools/capture.js
CAP_REDUCED=1 node tools/capture.js            # motion-off pass
```

Start Edge first with `--headless=new --remote-debugging-port=9222`. This exists because
the in-app preview pane stops compositing when it isn't displayed, so its screenshots
time out. Prefix runs with `MSYS_NO_PATHCONV=1` in Git Bash or it rewrites `CAP_PAGE`
into a Windows path.

## Notes for the next person

- **Nothing is hidden behind JavaScript.** The scroll reveal is gated on `html.js`, so
  with JS off every story is still on the page. For a news site that is not optional.
- `[hidden]` is forced with `!important` — several blocks set `display` on the same
  elements and would otherwise win.
- Search is client-side over `data/search.json`; result paths are site-root relative and
  the base is recovered from the index URL, so they resolve from `/section/` and `/story/`
  pages too. Deploying under a subpath needs no change.
- Drawer and search overlay use `inert` plus explicit `visibility 0s linear 0s` on open —
  a plain `transition: visibility` flips at 50% of the duration and silently eats `focus()`.
- Below 1080px the sticky bar becomes a swipeable section rail; the masthead already
  carries the brand, so `.nav-mini` is hidden rather than duplicating the logo.
- The homepage sidebar drops below the well at 1080px and its three modules run
  side by side; the `.rail-scroll` height cap is lifted there so nothing is hidden.
  `.cards--3` deliberately stays three-across from 1080px down to 620px — dropping
  it to two would strand the third card alone in an empty row.
- `.card > a` is a flex column with `margin-top:auto` on the meta, so bylines sit on
  a shared baseline across a row no matter how deep each headline runs.
- A `<use>` shadow tree is unreachable from document CSS, so the logo's fills are inline
  styles using `currentColor` and `var(--logo-arc)` — both inherit through where a class
  selector would not. And the referencing `<svg>` must use a **zero-origin** viewBox: a
  non-zero `min-x`/`min-y` there offsets the `<use>` and crops the mark.
- A logo standing on a fixed-colour stage takes `.logo--ink` / `.logo--paper`, never the
  theme's `--ink` token — otherwise it disappears on a hard-coded white panel in dark mode.
- `assets/img/raw/` holds the original downloads and is gitignored.
