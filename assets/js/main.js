/* The Clare Echo — front-end behaviour. No dependencies. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  /* ---------- live date in the utility bar ---------- */
  (function () {
    var el = $('[data-today]');
    if (!el) return;
    el.textContent = new Date().toLocaleDateString('en-IE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  })();

  /* ---------- sticky nav shadow + mini logo ---------- */
  (function () {
    var nav = $('.brandbar');
    if (!nav) return;
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    nav.parentNode.insertBefore(sentinel, nav);
    new IntersectionObserver(function (entries) {
      nav.classList.toggle('is-stuck', !entries[0].isIntersecting);
    }, { rootMargin: '0px' }).observe(sentinel);
  })();

  /* ---------- mobile drawer ---------- */
  (function () {
    var drawer = $('#drawer'), scrim = $('#scrim'), open = $('#burger'), close = $('#drawer-close');
    if (!drawer || !open) return;
    var lastFocus = null;

    function setOpen(on) {
      drawer.classList.toggle('is-on', on);
      scrim.classList.toggle('is-on', on);
      document.body.classList.toggle('is-locked', on);
      open.setAttribute('aria-expanded', String(on));
      if (on) { drawer.removeAttribute('inert'); } else { drawer.setAttribute('inert', ''); }
      if (on) {
        lastFocus = document.activeElement;
        // visibility flips at 0s on open, so focus lands reliably
        requestAnimationFrame(function () { close.focus(); });
      } else if (lastFocus) {
        lastFocus.focus();
      }
    }
    drawer.setAttribute('inert', '');
    open.addEventListener('click', function () { setOpen(true); });
    close.addEventListener('click', function () { setOpen(false); });
    scrim.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-on')) setOpen(false);
    });
    $$('a', drawer).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
  })();

  /* ---------- search overlay ---------- */
  (function () {
    var panel = $('#search'), input = $('#search-input'), results = $('#search-results');
    var openers = $$('[data-search-open]'), closer = $('#search-close');
    if (!panel || !input) return;
    var index = [], loaded = false, lastFocus = null;
    // index paths are site-root relative; recover the base from the index URL
    // so results resolve from /section/ and /story/ pages too
    var base = panel.dataset.index.replace(/data\/search\.json$/, '');

    function load() {
      if (loaded) return Promise.resolve();
      loaded = true;
      return fetch(panel.dataset.index)
        .then(function (r) { return r.json(); })
        .then(function (d) { index = d; })
        .catch(function () { index = []; });
    }
    function setOpen(on) {
      panel.classList.toggle('is-on', on);
      document.body.classList.toggle('is-locked', on);
      if (on) {
        panel.removeAttribute('inert');
        lastFocus = document.activeElement;
        load();
        requestAnimationFrame(function () { input.focus(); input.select(); });
      } else {
        panel.setAttribute('inert', '');
        if (lastFocus) lastFocus.focus();
      }
    }
    panel.setAttribute('inert', '');
    openers.forEach(function (b) { b.addEventListener('click', function () { setOpen(true); }); });
    if (closer) closer.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-on')) setOpen(false);
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) &&
          !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); setOpen(true);
      }
    });
    $$('[data-search-term]', panel).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        input.value = a.dataset.searchTerm;
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
    });

    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        load().then(function () {
          var q = input.value.trim().toLowerCase();
          if (q.length < 2) { results.innerHTML = ''; return; }
          var hits = index.filter(function (it) {
            return (it.t + ' ' + it.s).toLowerCase().indexOf(q) > -1;
          }).slice(0, 8);
          if (!hits.length) {
            results.innerHTML = '<p class="search-empty">No stories match &ldquo;' +
              q.replace(/[<>&]/g, '') + '&rdquo;. Try a place name, club or reporter.</p>';
            return;
          }
          results.innerHTML = hits.map(function (it) {
            return '<a href="' + base + it.u + '"><span class="sr-sec">' + esc(it.s) +
              '</span><span class="sr-t">' + esc(it.t) + '</span></a>';
          }).join('');
        });
      }, 110);
    });
  })();

  /* ---------- headline ticker ---------- */
  (function () {
    var track = $('#ticker-track');
    if (!track) return;
    var items = $$('.ticker-item', track);
    if (items.length < 2) return;
    var dots = $$('#ticker-dots button');
    var i = 0, timer = null, paused = false;

    function show(n) {
      i = (n + items.length) % items.length;
      items.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
      dots.forEach(function (d, k) { d.setAttribute('aria-current', String(k === i)); });
    }
    function tick() { if (!paused) show(i + 1); }
    show(0);
    dots.forEach(function (d, k) {
      d.addEventListener('click', function () { show(k); restart(); });
    });
    function restart() { clearInterval(timer); if (!reduced) timer = setInterval(tick, 5200); }
    var strip = track.closest('.ticker');
    strip.addEventListener('mouseenter', function () { paused = true; });
    strip.addEventListener('mouseleave', function () { paused = false; });
    strip.addEventListener('focusin', function () { paused = true; });
    strip.addEventListener('focusout', function () { paused = false; });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearInterval(timer); } else { restart(); }
    });
    restart();
  })();

  /* ---------- newsletter ---------- */
  (function () {
    var form = $('#nl-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = $('#nl-ok');
      form.style.display = 'none';
      if (ok) ok.classList.add('is-on');
    });
  })();

  /* ---------- reading progress ---------- */
  (function () {
    var bar = $('#progress'), body = $('[data-progress-target]');
    if (!bar || !body) return;
    var raf = 0;
    function update() {
      raf = 0;
      var r = body.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var p = total > 0 ? (-r.top) / total : 0;
      bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, p)) + ')';
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  })();

  /* ---------- share ---------- */
  (function () {
    $$('[data-share]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var url = location.href, title = document.title;
        if (btn.dataset.share === 'native' && navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () {});
          return;
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            var live = $('#share-live');
            if (live) live.textContent = 'Link copied to clipboard';
            btn.classList.add('is-done');
            setTimeout(function () { btn.classList.remove('is-done'); }, 1800);
          });
        }
      });
    });
  })();

  /* ---------- load more (section pages) ---------- */
  (function () {
    var btn = $('#loadmore');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var hidden = $$('.stream [hidden]');
      hidden.slice(0, 6).forEach(function (el) { el.removeAttribute('hidden'); });
      if ($$('.stream [hidden]').length === 0) btn.parentNode.removeChild(btn);
    });
  })();

  /* ---------- load more (podcast episodes) ---------- */
  (function () {
    var btn = $('#loadmore-epi');
    if (!btn) return;
    btn.addEventListener('click', function () {
      $$('.epi-list [hidden]').slice(0, 10).forEach(function (el) { el.removeAttribute('hidden'); });
      if ($$('.epi-list [hidden]').length === 0) btn.parentNode.removeChild(btn);
    });
  })();

  /* ---------- subscribe: annual / monthly ---------- */
  (function () {
    var tabs = $$('[data-plan-tab]');
    if (!tabs.length) return;
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
        $$('.plan').forEach(function (p) {
          if (p.id === 'plan-' + t.dataset.planTab) p.removeAttribute('hidden');
          else p.setAttribute('hidden', '');
        });
      });
    });
  })();

  /* ---------- advertise enquiry ---------- */
  (function () {
    var form = $('#adv-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = $('#adv-ok');
      form.style.display = 'none';
      if (ok) ok.classList.add('is-on');
    });
  })();

  /* ---------- podcast series tabs ---------- */
  (function () {
    var tabs = $$('[data-media-tab]');
    if (!tabs.length) return;

    function select(slug) {
      tabs.forEach(function (t) {
        var on = t.dataset.mediaTab === slug;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
      });
      $$('.media-panel').forEach(function (p) {
        if (p.id === 'panel-' + slug) { p.removeAttribute('hidden'); }
        else { p.setAttribute('hidden', ''); }
      });
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { select(t.dataset.mediaTab); });
    });
    // roving focus, as a tablist should
    var list = tabs[0].parentNode;
    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
      if (n < 0 && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      n = (n + tabs.length) % tabs.length;
      tabs[n].focus();
      select(tabs[n].dataset.mediaTab);
    });
    tabs.forEach(function (t, i) { t.tabIndex = i === 0 ? 0 : -1; });
  })();

  /* ---------- reveal on scroll ---------- */
  (function () {
    if (reduced || !('IntersectionObserver' in window)) {
      $$('.rv').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    $$('.rv').forEach(function (el) { io.observe(el); });
  })();
})();
