(function () {
  'use strict';

  var DATA = window.ARCHIVE_DATA || { kids: [], entries: [] };
  var KIDS = DATA.kids || [];
  var ENTRIES = DATA.entries || [];

  var PALETTE = [
    { swatch: 'var(--accent-blue)', deep: 'var(--accent-blue-deep)' },
    { swatch: 'var(--accent-pink)', deep: 'var(--accent-pink-deep)' },
    { swatch: 'var(--accent-green)', deep: 'var(--accent-green-deep)' },
    { swatch: 'var(--accent-sand)', deep: 'var(--accent-sand-deep)' },
    { swatch: 'var(--accent-lavender)', deep: 'var(--accent-lavender-deep)' }
  ];

  var KID_BY_ID = {};
  KIDS.forEach(function (k, i) {
    KID_BY_ID[k.id] = { name: k.name || ('Child ' + k.id), color: PALETTE[i % PALETTE.length] };
  });

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ---------------- utils ----------------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mediaBase(e) { return '../' + e.y + '/' + e.m + '/' + e.d + '/' + e.id + '/' + e.id; }
  function thumbSrc(e) { return mediaBase(e) + '_thumb.jpg'; }
  function largeSrc(e) { return mediaBase(e) + '_large.jpg'; }
  function originalSrc(e) { return mediaBase(e) + '.jpg'; }
  function videoSrc(e) { return mediaBase(e) + '.mp4'; }
  function photoHref(e) { return '#/photo/' + e.id; }

  var ENTRY_BY_ID = new Map();
  ENTRIES.forEach(function (e) { ENTRY_BY_ID.set(e.id, e); });

  function dateLabel(y, m, d) {
    return MONTH_NAMES[m - 1] + ' ' + d + ', ' + y;
  }

  function groupBy(arr, keyFn) {
    var map = new Map();
    arr.forEach(function (item) {
      var k = keyFn(item);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    });
    return map;
  }

  function lazyImg(src, cls) {
    return '<img class="lazy-img' + (cls ? ' ' + cls : '') + '" data-src="' + src + '" alt="">';
  }

  var lazyObserver = new IntersectionObserver(function (entriesObserved) {
    entriesObserved.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var img = entry.target;
      img.addEventListener('load', function () { img.classList.add('loaded'); }, { once: true });
      img.src = img.dataset.src;
      lazyObserver.unobserve(img);
    });
  }, { rootMargin: '500px' });

  function observeLazy(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.lazy-img'), function (img) {
      lazyObserver.observe(img);
    });
  }

  function kidTagsHtml(e) {
    if (!e.k || !e.k.length) return '';
    return '<div class="kid-tags">' + e.k.map(function (id) {
      var kid = KID_BY_ID[id];
      if (!kid) return '';
      return '<span class="kid-tag" style="background:' + kid.color.swatch + '">' + esc(kid.name) + '</span>';
    }).join('') + '</div>';
  }

  // ---------------- filter state ----------------

  var filterState = { included: new Set(), exact: false };

  (function loadFilter() {
    try {
      var saved = JSON.parse(localStorage.getItem('archive-filter') || 'null');
      if (saved) {
        filterState.included = new Set(saved.included || []);
        filterState.exact = !!saved.exact;
      }
    } catch (e) { /* ignore */ }
  })();

  function saveFilter() {
    try {
      localStorage.setItem('archive-filter', JSON.stringify({
        included: Array.from(filterState.included),
        exact: filterState.exact
      }));
    } catch (e) { /* ignore */ }
  }

  function matchesFilter(e) {
    if (filterState.included.size === 0) return true;
    var k = new Set(e.k || []);
    for (var it = filterState.included.values(), r; !(r = it.next()).done;) {
      if (!k.has(r.value)) return false;
    }
    if (filterState.exact && k.size !== filterState.included.size) return false;
    return true;
  }

  var typeState = 'all'; // 'all' | 'photo' | 'video'

  function matchesType(e) {
    if (typeState === 'photo') return !e.v;
    if (typeState === 'video') return !!e.v;
    return true;
  }

  function filteredEntries() {
    return ENTRIES.filter(matchesFilter);
  }

  function filterLabel() {
    if (filterState.included.size === 0) return 'Everyone';
    var names = Array.from(filterState.included).map(function (id) {
      return KID_BY_ID[id] ? KID_BY_ID[id].name : ('#' + id);
    });
    return (filterState.exact ? 'Only ' : '') + names.join(' & ');
  }

  // ---------------- shared popover plumbing ----------------

  var openPopovers = [];

  function registerPopover(toggleBtn, panel) {
    toggleBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var willOpen = panel.hidden;
      openPopovers.forEach(function (p) { if (p !== panel) p.hidden = true; });
      panel.hidden = !willOpen;
    });
    document.addEventListener('click', function (ev) {
      if (!panel.hidden && !panel.contains(ev.target) && ev.target !== toggleBtn) {
        panel.hidden = true;
      }
    });
    openPopovers.push(panel);
  }

  // ---------------- kid filter UI ----------------

  function initKidFilterUI() {
    var checksEl = document.getElementById('kid-filter-checks');
    var exactInput = document.getElementById('kid-filter-exact-input');
    var toggleBtn = document.getElementById('kid-filter-toggle');
    var panel = document.getElementById('kid-filter-panel');
    var clearBtn = document.getElementById('kid-filter-clear');
    var labelEl = document.getElementById('kid-filter-label');

    if (!KIDS.length) {
      document.getElementById('kid-filter').style.display = 'none';
      return;
    }

    checksEl.innerHTML = KIDS.map(function (k, i) {
      var color = PALETTE[i % PALETTE.length];
      return '<label class="kid-chip-check">' +
        '<input type="checkbox" data-kid-id="' + k.id + '">' +
        '<span class="kid-swatch" style="background:' + color.swatch + '"></span>' +
        esc(k.name || ('Child ' + k.id)) +
        '</label>';
    }).join('');

    function syncControls() {
      Array.prototype.forEach.call(checksEl.querySelectorAll('input[type=checkbox]'), function (cb) {
        cb.checked = filterState.included.has(Number(cb.getAttribute('data-kid-id')));
      });
      exactInput.checked = filterState.exact;
      labelEl.textContent = filterLabel();
    }

    checksEl.addEventListener('change', function (ev) {
      var id = Number(ev.target.getAttribute('data-kid-id'));
      if (ev.target.checked) filterState.included.add(id);
      else filterState.included.delete(id);
      saveFilter();
      syncControls();
      render();
    });

    exactInput.addEventListener('change', function () {
      filterState.exact = exactInput.checked;
      saveFilter();
      syncControls();
      render();
    });

    clearBtn.addEventListener('click', function () {
      filterState.included = new Set();
      filterState.exact = false;
      saveFilter();
      syncControls();
      render();
    });

    registerPopover(toggleBtn, panel);
    syncControls();
  }

  // ---------------- header search UI ----------------

  function initSearchUI() {
    var toggleBtn = document.getElementById('search-toggle');
    var panel = document.getElementById('search-popover');
    var dateInput = document.getElementById('date-jump-input');
    var captionInput = document.getElementById('caption-search-input');
    var typeFilterEl = document.getElementById('type-filter');
    var resultsEl = document.getElementById('search-results');
    var countEl = document.getElementById('search-count');
    var debounceTimer = null;

    registerPopover(toggleBtn, panel);

    document.getElementById('date-jump-go').addEventListener('click', function () {
      var v = dateInput.value;
      if (!v) return;
      var p = v.split('-');
      panel.hidden = true;
      location.hash = '#/calendar/' + Number(p[0]) + '/' + Number(p[1]) + '/' + Number(p[2]);
    });

    typeFilterEl.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-type]');
      if (!btn) return;
      typeState = btn.getAttribute('data-type');
      Array.prototype.forEach.call(typeFilterEl.querySelectorAll('button'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      runSearch();
    });

    captionInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(runSearch, 150);
    });

    function runSearch() {
      var q = captionInput.value.trim().toLowerCase();
      if (!q) { resultsEl.innerHTML = ''; countEl.textContent = ''; return; }
      var matches = filteredEntries().filter(function (e) {
        return matchesType(e) && e.c && e.c.toLowerCase().indexOf(q) !== -1;
      });
      matches.reverse();
      countEl.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es');
      var shown = matches.slice(0, 100);
      resultsEl.innerHTML = shown.map(function (e) {
        return '<a class="result-row" href="' + photoHref(e) + '">' +
          lazyImg(thumbSrc(e), 'thumb') +
          '<span class="r-caption">' + esc(e.c) + '</span>' +
          '<span class="r-date">' + dateLabel(e.y, e.m, e.d) + '</span></a>';
      }).join('');
      observeLazy(resultsEl);
      if (matches.length > shown.length) {
        countEl.textContent += ' (showing first ' + shown.length + ')';
      }
    }
  }

  // ---------------- router ----------------

  var view = document.getElementById('view');
  var wallObserver = null;
  var wallScrollHandler = null;
  var galleryTimer = null;

  function cleanupActiveView() {
    if (wallObserver) { wallObserver.disconnect(); wallObserver = null; }
    if (wallScrollHandler) { window.removeEventListener('scroll', wallScrollHandler); wallScrollHandler = null; }
    if (galleryTimer) { clearInterval(galleryTimer); galleryTimer = null; }
  }

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    return h.split('/').filter(Boolean);
  }

  function setActiveTab(name) {
    Array.prototype.forEach.call(document.querySelectorAll('#tabs a'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === name);
    });
  }

  function render() {
    cleanupActiveView();
    var parts = parseHash();
    var route = parts[0] || 'calendar';
    setActiveTab(route === 'calendar' ? 'calendar' : route);
    view.innerHTML = '';

    if (route === 'calendar') {
      if (parts.length <= 1) renderYears();
      else if (parts.length === 2) renderMonths(Number(parts[1]));
      else if (parts.length === 3) renderDays(Number(parts[1]), Number(parts[2]));
      else renderDayEntries(Number(parts[1]), Number(parts[2]), Number(parts[3]));
    } else if (route === 'wall') {
      renderWall();
    } else if (route === 'gallery') {
      renderGallery();
    } else if (route === 'photo') {
      renderPhoto(Number(parts[1]));
    } else {
      renderYears();
    }
    window.scrollTo(0, 0);
  }

  function h(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d;
  }

  // ---------------- calendar: years ----------------

  function renderYears() {
    var entries = filteredEntries();
    var byYear = groupBy(entries, function (e) { return e.y; });
    var years = Array.from(byYear.keys()).sort(function (a, b) { return b - a; });

    var header = '<div class="view-header"><h1>' + (KIDS.length ? esc(KIDS.map(function (k) { return k.name; }).join(' & ')) : 'Family Archive') + '</h1></div>';

    if (!years.length) {
      view.appendChild(h(header + '<div class="empty-state">No entries match the current filter.</div>'));
      return;
    }

    var cards = years.map(function (y) {
      var group = byYear.get(y);
      var rep = group[group.length - 1];
      return '<a class="period-card" href="#/calendar/' + y + '">' +
        '<div class="thumb-wrap">' + lazyImg(thumbSrc(rep)) + '</div>' +
        '<div class="period-meta"><span class="period-label">' + y + '</span>' +
        '<span class="period-count">' + group.length + '</span></div></a>';
    }).join('');

    view.appendChild(h(header + '<div class="card-grid">' + cards + '</div>'));
    observeLazy(view);
  }

  // ---------------- calendar: months ----------------

  function renderMonths(year) {
    var entries = filteredEntries().filter(function (e) { return e.y === year; });
    var byMonth = groupBy(entries, function (e) { return e.m; });

    var header = '<div class="view-header"><div><div class="crumbs"><a href="#/calendar">Home</a> / ' + year + '</div>' +
      '<h1>' + year + '</h1></div></div>';

    var cards = [];
    for (var m = 1; m <= 12; m++) {
      var group = byMonth.get(m);
      if (!group || !group.length) {
        cards.push('<div class="period-card disabled"><div class="thumb-wrap"></div>' +
          '<div class="period-meta"><span class="period-label">' + MONTH_NAMES[m - 1] + '</span></div></div>');
        continue;
      }
      var rep = group[group.length - 1];
      cards.push('<a class="period-card" href="#/calendar/' + year + '/' + m + '">' +
        '<div class="thumb-wrap">' + lazyImg(thumbSrc(rep)) + '</div>' +
        '<div class="period-meta"><span class="period-label">' + MONTH_NAMES[m - 1] + '</span>' +
        '<span class="period-count">' + group.length + '</span></div></a>');
    }

    view.appendChild(h(header + '<div class="card-grid">' + cards.join('') + '</div>'));
    observeLazy(view);
  }

  // ---------------- calendar: days (real calendar grid) ----------------

  function renderDays(year, month) {
    var entries = filteredEntries().filter(function (e) { return e.y === year && e.m === month; });
    var byDay = groupBy(entries, function (e) { return e.d; });

    var header = '<div class="view-header"><div><div class="crumbs"><a href="#/calendar">Home</a> / ' +
      '<a href="#/calendar/' + year + '">' + year + '</a> / ' + MONTH_NAMES[month - 1] + '</div>' +
      '<h1>' + MONTH_NAMES[month - 1] + ' ' + year + '</h1></div></div>';

    var firstDow = new Date(year, month - 1, 1).getDay();
    var daysInMonth = new Date(year, month, 0).getDate();

    var cells = DOW_NAMES.map(function (n) { return '<div class="dow">' + n + '</div>'; }).join('');
    for (var i = 0; i < firstDow; i++) cells += '<div class="day-cell blank"></div>';

    for (var d = 1; d <= daysInMonth; d++) {
      var group = byDay.get(d);
      if (group && group.length) {
        var rep = group[group.length - 1];
        cells += '<a class="day-cell has-entries" href="#/calendar/' + year + '/' + month + '/' + d + '">' +
          lazyImg(thumbSrc(rep)) +
          '<span class="day-num">' + d + '</span>' +
          '<span class="day-count">' + group.length + '</span></a>';
      } else {
        cells += '<div class="day-cell empty-day"><span class="day-num">' + d + '</span></div>';
      }
    }

    view.appendChild(h(header + '<div class="month-calendar">' + cells + '</div>'));
    observeLazy(view);
  }

  // ---------------- calendar: single day entries ----------------

  function renderDayEntries(year, month, day) {
    var all = filteredEntries();
    var dateKeys = [];
    var seen = new Set();
    all.forEach(function (e) {
      var k = e.y + '-' + e.m + '-' + e.d;
      if (!seen.has(k)) { seen.add(k); dateKeys.push(k); }
    });
    var currentKey = year + '-' + month + '-' + day;
    var idx = dateKeys.indexOf(currentKey);
    var prevKey = idx > 0 ? dateKeys[idx - 1] : null;
    var nextKey = (idx >= 0 && idx < dateKeys.length - 1) ? dateKeys[idx + 1] : null;

    function linkFor(key) {
      if (!key) return null;
      var p = key.split('-');
      return '#/calendar/' + p[0] + '/' + p[1] + '/' + p[2];
    }

    var dayEntries = all.filter(function (e) { return e.y === year && e.m === month && e.d === day; });

    var header = '<div class="view-header"><div><div class="crumbs"><a href="#/calendar">Home</a> / ' +
      '<a href="#/calendar/' + year + '">' + year + '</a> / ' +
      '<a href="#/calendar/' + year + '/' + month + '">' + MONTH_NAMES[month - 1] + '</a></div>' +
      '<h1>' + dateLabel(year, month, day) + '</h1></div></div>';

    var nav = '<div class="day-nav">' +
      (prevKey ? '<a href="' + linkFor(prevKey) + '">&#8592; Previous day</a>' : '<a class="disabled">&#8592;</a>') +
      (nextKey ? '<a href="' + linkFor(nextKey) + '">Next day &#8594;</a>' : '<a class="disabled">&#8594;</a>') +
      '</div>';

    if (!dayEntries.length) {
      view.appendChild(h(header + nav + '<div class="empty-state">No entries on this day match the current filter.</div>'));
      return;
    }

    var cards = dayEntries.map(function (e) {
      var media = e.v
        ? '<div class="media-wrap">' + lazyImg(largeSrc(e)) + '<div class="play-badge">&#9658;</div></div>'
        : '<div class="media-wrap">' + lazyImg(largeSrc(e)) + '</div>';
      return '<a class="entry-card" href="' + photoHref(e) + '">' + media +
        '<div class="entry-body">' + kidTagsHtml(e) +
        (e.c ? '<p class="caption">' + esc(e.c) + '</p>' : '') +
        '<span class="detail-link">View comments &#8594;</span></div></a>';
    }).join('');

    view.appendChild(h(header + nav + '<div class="entry-masonry">' + cards + '</div>'));
    observeLazy(view);
  }

  // ---------------- single photo ----------------

  function renderPhoto(id) {
    var e = ENTRY_BY_ID.get(id);
    if (!e) {
      view.appendChild(h('<div class="empty-state">That photo isn\'t there any more.</div>'));
      return;
    }

    var back = '<a class="crumbs back-link" href="#/calendar/' + e.y + '/' + e.m + '/' + e.d + '">' +
      '&#8592; ' + dateLabel(e.y, e.m, e.d) + '</a>';

    var media = e.v
      ? '<video controls preload="none" poster="' + largeSrc(e) + '" playsinline><source src="' + videoSrc(e) + '" type="video/mp4"></video>'
      : '<img src="' + originalSrc(e) + '" alt="">';

    var comments = (e.cs || []).map(function (c) {
      return '<div class="comment"><p>' + esc(c.t) + '</p>' + (c.n ? '<span>' + esc(c.n) + '</span>' : '') + '</div>';
    }).join('');

    var html = '<div class="photo-page">' + back +
      '<div class="photo-media">' + media + '</div>' +
      kidTagsHtml(e) +
      (e.c ? '<p class="photo-caption">' + esc(e.c) + '</p>' : '') +
      '<div class="photo-comments">' +
      (comments || '<p class="no-comments">No comments yet.</p>') +
      '</div></div>';

    view.appendChild(h(html));
  }

  // ---------------- megawall ----------------

  function renderWall() {
    var header = '<div class="view-header"><h1>The Wall</h1><span class="crumbs">' +
      filteredEntries().length + ' photos</span></div>';
    var container = h(header + '<div class="masonry" id="masonry"></div><div class="wall-sentinel" id="wall-sentinel"></div><div class="wall-status" id="wall-status"></div>' +
      '<div class="wall-timeline" id="wall-timeline"><div class="wall-timeline-track" id="wall-timeline-track"></div></div>' +
      '<div class="wall-timeline-now" id="wall-timeline-now"></div>');
    view.appendChild(container);

    var pool = filteredEntries().slice().reverse(); // newest first
    var masonryEl = document.getElementById('masonry');
    var statusEl = document.getElementById('wall-status');
    var sentinel = document.getElementById('wall-sentinel');
    var timelineTrack = document.getElementById('wall-timeline-track');
    var nowPill = document.getElementById('wall-timeline-now');
    var BATCH = 60;
    var rendered = 0;

    if (!pool.length) {
      statusEl.textContent = 'No photos match the current filter.';
      return;
    }

    function appendBatch() {
      var next = pool.slice(rendered, rendered + BATCH);
      if (!next.length) {
        statusEl.textContent = "That's everything.";
        if (wallObserver) { wallObserver.disconnect(); wallObserver = null; }
        return;
      }
      var frag = document.createDocumentFragment();
      next.forEach(function (e, j) {
        var tile = document.createElement('a');
        tile.className = 'masonry-tile';
        tile.href = photoHref(e);
        tile.dataset.i = rendered + j;
        tile.innerHTML = lazyImg(largeSrc(e)) +
          (e.v ? '<div class="play-badge">&#9658;</div>' : '') +
          (e.c ? '<div class="tile-caption">' + esc(e.c) + '</div>' : '');
        frag.appendChild(tile);
      });
      masonryEl.appendChild(frag);
      observeLazy(masonryEl);
      rendered += next.length;
      statusEl.textContent = 'Showing ' + rendered + ' of ' + pool.length;
    }

    function ensureObserver() {
      if (wallObserver) return;
      wallObserver = new IntersectionObserver(function (entriesObserved) {
        if (entriesObserved.some(function (en) { return en.isIntersecting; })) appendBatch();
      }, { rootMargin: '600px' });
      wallObserver.observe(sentinel);
    }

    function jumpTo(idx) {
      masonryEl.innerHTML = '';
      rendered = Math.max(0, Math.min(idx, pool.length - 1));
      appendBatch();
      ensureObserver();
      var top = masonryEl.getBoundingClientRect().top + window.pageYOffset - 90;
      window.scrollTo(0, Math.max(0, top));
    }

    appendBatch();
    ensureObserver();

    // -------- timeline scrubber --------

    var yearMarks = [];
    var seenYears = {};
    pool.forEach(function (e, i) {
      if (!seenYears[e.y]) { seenYears[e.y] = true; yearMarks.push({ year: e.y, index: i }); }
    });

    if (yearMarks.length > 1) {
      var span = Math.max(1, pool.length - 1);
      timelineTrack.innerHTML = yearMarks.map(function (mark) {
        var pct = (mark.index / span) * 100;
        return '<button type="button" class="wall-timeline-tick" data-index="' + mark.index +
          '" style="top:' + pct.toFixed(2) + '%">' + mark.year + '</button>';
      }).join('');

      timelineTrack.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.wall-timeline-tick');
        if (!btn) return;
        jumpTo(Number(btn.getAttribute('data-index')));
      });

      var ticks = Array.prototype.slice.call(timelineTrack.querySelectorAll('.wall-timeline-tick'));
      var hideTimer = null;
      var ticking = false;

      function updateTimeline() {
        ticking = false;
        var refY = 110;
        var candidates = [0.5, 0.25, 0.75, 0.1, 0.9];
        var tile = null;
        for (var c = 0; c < candidates.length && !tile; c++) {
          var el = document.elementFromPoint(window.innerWidth * candidates[c], refY);
          if (el) tile = el.closest('.masonry-tile');
        }
        if (!tile) return;
        var idx = Number(tile.dataset.i);

        var current = ticks[0];
        ticks.forEach(function (t) {
          if (Number(t.getAttribute('data-index')) <= idx) current = t;
        });
        ticks.forEach(function (t) { t.classList.toggle('current', t === current); });

        var e = pool[idx];
        if (e) {
          nowPill.textContent = MONTH_NAMES[e.m - 1] + ' ' + e.y;
          nowPill.style.top = current.getBoundingClientRect().top + 'px';
          nowPill.classList.add('visible');
        }
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () { nowPill.classList.remove('visible'); }, 1200);
      }

      wallScrollHandler = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(updateTimeline);
      };
      window.addEventListener('scroll', wallScrollHandler, { passive: true });
      updateTimeline();
    }
  }

  // ---------------- gallery wall ----------------

  var GALLERY_SIZES = ['lg', 'sm', 'sm', 'md', 'sm', 'sm', 'md', 'sm'];
  var GALLERY_COUNT = 8;
  var GALLERY_INTERVAL_MS = 7000;

  function renderGallery() {
    var pool = filteredEntries();
    var header = '<div class="view-header"><h1>Gallery Wall</h1></div>';

    if (pool.length < 3) {
      view.appendChild(h(header + '<div class="empty-state">Not enough photos match the current filter for the gallery wall.</div>'));
      return;
    }

    var n = Math.min(GALLERY_COUNT, pool.length);
    var shown = sample(pool, n);

    var tiles = shown.map(function (e, i) {
      var size = GALLERY_SIZES[i % GALLERY_SIZES.length];
      return '<div class="gallery-tile size-' + size + '" data-idx="' + i + '">' +
        '<img src="' + largeSrc(e) + '" alt="">' +
        (e.c ? '<div class="tile-caption">' + esc(e.c) + '</div>' : '') +
        '</div>';
    }).join('');

    view.appendChild(h(header +
      '<div class="gallery-toolbar"><button type="button" class="shuffle-btn" id="shuffle-all-btn">Shuffle all</button></div>' +
      '<div class="gallery-grid" id="gallery-grid">' + tiles + '</div>' +
      '<p class="gallery-note">Refreshes itself every few seconds. Photos link to their day when you click them.</p>'));

    var grid = document.getElementById('gallery-grid');

    function bindTile(tileEl, i) {
      tileEl.style.cursor = 'pointer';
      tileEl.onclick = function () {
        var e = shown[i];
        if (e) location.hash = photoHref(e);
      };
    }

    function swapTile(tileEl, next) {
      var img = tileEl.querySelector('img');
      var captionEl = tileEl.querySelector('.tile-caption');
      img.classList.remove('loaded');
      img.addEventListener('load', function onLoad() {
        img.classList.add('loaded');
        img.removeEventListener('load', onLoad);
      });
      img.src = largeSrc(next);
      if (next.c) {
        if (!captionEl) {
          captionEl = document.createElement('div');
          captionEl.className = 'tile-caption';
          tileEl.appendChild(captionEl);
        }
        captionEl.textContent = next.c;
      } else if (captionEl) {
        captionEl.remove();
      }
    }

    Array.prototype.forEach.call(grid.querySelectorAll('.gallery-tile'), function (tileEl, i) {
      bindTile(tileEl, i);
      var img = tileEl.querySelector('img');
      img.addEventListener('load', function () { img.classList.add('loaded'); });
      if (img.complete) img.classList.add('loaded');
    });

    document.getElementById('shuffle-all-btn').addEventListener('click', function () {
      var pool2 = filteredEntries();
      if (pool2.length < 3) return;
      var fresh = sample(pool2, Math.min(GALLERY_COUNT, pool2.length));
      shown = fresh;
      Array.prototype.forEach.call(grid.querySelectorAll('.gallery-tile'), function (tileEl, i) {
        if (shown[i]) swapTile(tileEl, shown[i]);
      });
    });

    galleryTimer = setInterval(function () {
      if (document.visibilityState === 'hidden') return;
      var pool2 = filteredEntries();
      if (pool2.length <= shown.length) return;
      var idx = Math.floor(Math.random() * shown.length);
      var currentIds = new Set(shown.map(function (e) { return e.id; }));
      var candidates = pool2.filter(function (e) { return !currentIds.has(e.id); });
      if (!candidates.length) return;
      var next = candidates[Math.floor(Math.random() * candidates.length)];
      shown[idx] = next;
      var tileEl = grid.querySelector('.gallery-tile[data-idx="' + idx + '"]');
      if (tileEl) swapTile(tileEl, next);
    }, GALLERY_INTERVAL_MS);
  }

  function sample(arr, n) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy.slice(0, n);
  }

  // ---------------- boot ----------------

  document.addEventListener('DOMContentLoaded', function () {
    if (KIDS.length) {
      var name = KIDS.map(function (k) { return k.name; }).join(' & ');
      document.title = name + ' – Family Archive';
      document.getElementById('brand-link').textContent = name;
    }
    initKidFilterUI();
    initSearchUI();
    window.addEventListener('hashchange', render);
    render();
  });
})();
