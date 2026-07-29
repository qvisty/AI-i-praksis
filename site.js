// Sætter en "Kopiér"-knap på alle prompt-bokse, så deltagerne kan kopiere med ét klik.
document.querySelectorAll('.prompt[data-copy]').forEach(function (box) {
  var text = box.textContent.trim();
  var btn = document.createElement('button');
  btn.className = 'copy';
  btn.type = 'button';
  btn.textContent = 'Kopiér';
  btn.addEventListener('click', function () {
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = 'Kopieret ✓';
      setTimeout(function () { btn.textContent = 'Kopiér'; }, 2000);
    });
  });
  box.appendChild(btn);
});

// Sætter en "Print handout"-knap på alle øvelsessektioner. Knappen printer
// sektionen som et rent A4-ark med sidehoved, klar til kopiering.
document.querySelectorAll('main section').forEach(function (section) {
  var exercise = section.querySelector('.exercise');
  if (!exercise) return;
  var btn = document.createElement('button');
  btn.className = 'print-btn';
  btn.type = 'button';
  btn.textContent = 'Print handout';
  btn.addEventListener('click', function () {
    var head = document.createElement('div');
    head.className = 'handout-head';
    var brand = document.createElement('strong');
    brand.textContent = 'AI i praksis';
    var module = document.createElement('span');
    module.textContent = document.title;
    head.appendChild(brand);
    head.appendChild(module);
    section.insertBefore(head, section.firstChild);
    var foot = document.createElement('div');
    foot.className = 'handout-foot';
    foot.textContent = '© 2026 Jesper Qvist. AI i praksis, qvisty.github.io/AI-i-praksis';
    section.appendChild(foot);
    document.body.classList.add('print-handout');
    section.classList.add('print-target');
    var cleanup = function () {
      document.body.classList.remove('print-handout');
      section.classList.remove('print-target');
      head.remove();
      foot.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  });
  exercise.appendChild(btn);
});

// Sidernes rækkefølge. Bruges af pagineringen nederst på siderne og af
// det afsluttende bladre-dias i diasvisningen.
var PAGE_SEQUENCE = [
  { file: 'index.html', title: 'Forside' },
  { file: 'modul-1-lovable.html', title: 'Modul 1: Byg en app med Lovable' },
  { file: 'modul-2-github-claude.html', title: 'Modul 2: GitHub + Claude Code' },
  { file: 'modul-3-ai-i-hverdagen.html', title: 'Modul 3: AI i din arbejdsdag' },
  { file: 'modul-4-automatisering.html', title: 'Modul 4: Automatisér din egen hverdag' },
  { file: 'modul-5-andre-modaliteter.html', title: 'Modul 5: Fra dokument til podcast' },
  { file: 'modul-6-forstaa-ai.html', title: 'Modul 6: Forstå AI' },
  { file: 'flere-vaerktoejer.html', title: 'Flere værktøjer at prøve' }
];

var pageFile = location.pathname.split('/').pop() || 'index.html';
var pageIndex = -1;
PAGE_SEQUENCE.forEach(function (p, i) { if (p.file === pageFile) pageIndex = i; });
var pagePrev = pageIndex > 0 ? PAGE_SEQUENCE[pageIndex - 1] : null;
var pageNext = pageIndex >= 0 && pageIndex < PAGE_SEQUENCE.length - 1 ? PAGE_SEQUENCE[pageIndex + 1] : null;

function paginationLink(page, dir, hash) {
  var a = document.createElement('a');
  a.href = page.file + (hash || '');
  a.className = dir === 'next' ? 'pag-next' : 'pag-prev';
  var d = document.createElement('span');
  d.className = 'dir';
  d.textContent = dir === 'next' ? 'Næste' : 'Forrige';
  var t = document.createElement('span');
  t.className = 'ptitle';
  t.textContent = page.title;
  a.appendChild(d);
  a.appendChild(t);
  return a;
}

// Paginering på de almindelige sider: forrige-link øverst, begge retninger nederst.
(function () {
  var main = document.querySelector('main');
  if (!main || pageIndex < 0) return;
  if (pagePrev || pageNext) {
    var bar = document.createElement('nav');
    bar.className = 'pagination';
    bar.setAttribute('aria-label', 'Bladring mellem modulerne');
    if (pagePrev) bar.appendChild(paginationLink(pagePrev, 'prev'));
    if (pageNext) bar.appendChild(paginationLink(pageNext, 'next'));
    main.appendChild(bar);
  }
  if (pagePrev) {
    var top = document.createElement('nav');
    top.className = 'pagination pagination-top';
    top.setAttribute('aria-label', 'Tilbage til forrige modul');
    top.appendChild(paginationLink(pagePrev, 'prev'));
    main.insertBefore(top, main.firstChild);
  }
})();

// Menuen bygges ét sted, så ingen sider bliver glemt i navigationen.
// Undervisersiden holdes bevidst udenfor og nås via forsidens sidefod.
(function () {
  var inner = document.querySelector('nav .inner');
  if (!inner) return;
  var MENU = [
    { file: 'index.html', label: 'Forside' },
    { file: 'modul-1-lovable.html', label: 'Modul 1: Lovable' },
    { file: 'modul-2-github-claude.html', label: 'Modul 2: GitHub + Claude' },
    { file: 'modul-3-ai-i-hverdagen.html', label: 'Modul 3: Hverdagen' },
    { file: 'modul-4-automatisering.html', label: 'Modul 4: Automatisering' },
    { file: 'modul-5-andre-modaliteter.html', label: 'Modul 5: NotebookLM' },
    { file: 'modul-6-forstaa-ai.html', label: 'Modul 6: Teorien' },
    { label: 'Mere', children: [
      { file: 'flere-vaerktoejer.html', label: 'Flere værktøjer' },
      { file: 'teknik.html', label: 'Til de tekniske' },
      { file: 'papirklips.html', label: 'Fordybelse: Papirklipsen' },
      { file: 'evaluering.html', label: 'Evaluering' }
    ] }
  ];
  Array.prototype.slice.call(inner.querySelectorAll('a:not(.brand)')).forEach(function (a) { a.remove(); });
  MENU.forEach(function (item) {
    if (item.children) {
      var group = document.createElement('div');
      group.className = 'nav-group';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-group-btn';
      btn.textContent = item.label;
      btn.setAttribute('aria-expanded', 'false');
      var drop = document.createElement('div');
      drop.className = 'nav-dropdown';
      var groupActive = false;
      item.children.forEach(function (c) {
        var a = document.createElement('a');
        a.href = c.file;
        a.textContent = c.label;
        if (c.file === pageFile) { a.className = 'active'; groupActive = true; }
        drop.appendChild(a);
      });
      if (groupActive) btn.classList.add('active');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = group.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      group.appendChild(btn);
      group.appendChild(drop);
      inner.appendChild(group);
    } else {
      var a = document.createElement('a');
      a.href = item.file;
      a.textContent = item.label;
      if (item.file === pageFile) a.className = 'active';
      inner.appendChild(a);
    }
  });
  document.addEventListener('click', function () {
    document.querySelectorAll('.nav-group.open').forEach(function (g) {
      g.classList.remove('open');
      g.querySelector('.nav-group-btn').setAttribute('aria-expanded', 'false');
    });
  });
})();

// Diasvisning: deler sidens indhold op i små bidder og viser dem som dias,
// der kan bladres med piletaster eller knapper, som i en præsentation.
(function () {
  var nav = document.querySelector('nav .inner');
  var main = document.querySelector('main');
  if (!nav || !main) return;

  var overlay = null;
  var slides = [];
  var index = 0;

  // Lange tabeller deles op med fire rækker pr. dias, med overskriftsrækken gentaget.
  function chunkTable(table) {
    var rows = Array.prototype.slice.call(table.querySelectorAll('tr'));
    var header = rows.length && rows[0].querySelector('th') ? rows[0] : null;
    var body = header ? rows.slice(1) : rows;
    var out = [];
    for (var i = 0; i < body.length; i += 4) {
      var t = document.createElement('table');
      t.className = table.className;
      if (header) t.appendChild(header.cloneNode(true));
      body.slice(i, i + 4).forEach(function (r) { t.appendChild(r.cloneNode(true)); });
      out.push([t]);
    }
    return out;
  }

  function buildSlides() {
    var list = [];
    var hero = document.querySelector('header.hero');
    if (hero) list.push({ kicker: '', els: [hero.cloneNode(true)] });
    main.querySelectorAll(':scope > section').forEach(function (section) {
      var h2 = section.querySelector(':scope > h2');
      var kicker = h2 ? h2.textContent : '';
      var chunks = [];
      var cur = [];
      var curText = 0;
      function flush() { if (cur.length) { chunks.push(cur); cur = []; curText = 0; } }
      Array.prototype.forEach.call(section.children, function (el) {
        if (el === h2) return;
        if (el.classList.contains('grid')) {
          flush();
          var cards = Array.prototype.slice.call(el.children);
          for (var i = 0; i < cards.length; i += 2) {
            var g = document.createElement('div');
            g.className = 'grid';
            cards.slice(i, i + 2).forEach(function (c) { g.appendChild(c.cloneNode(true)); });
            chunks.push([g]);
          }
          return;
        }
        if (el.tagName === 'TABLE') {
          flush();
          chunkTable(el).forEach(function (c) { chunks.push(c); });
          return;
        }
        if (el.classList.contains('source')) {
          if (!cur.length && chunks.length) { chunks[chunks.length - 1].push(el.cloneNode(true)); }
          else { cur.push(el.cloneNode(true)); }
          return;
        }
        if (el.tagName === 'H3') {
          flush();
          cur.push(el.cloneNode(true));
          return;
        }
        var big = el.classList.contains('exercise') || el.classList.contains('explain') ||
          el.classList.contains('note') || el.classList.contains('prompt') ||
          el.classList.contains('figure') || el.tagName === 'OL' || el.tagName === 'UL';
        if (big) {
          if (curText > 250) flush();
          cur.push(el.cloneNode(true));
          flush();
          return;
        }
        cur.push(el.cloneNode(true));
        curText += (el.textContent || '').length;
        if (curText > 550) flush();
      });
      flush();
      chunks.forEach(function (els) { list.push({ kicker: kicker, els: els }); });
    });
    // Afsluttende dias: bladr videre til forrige eller næste modul,
    // som åbner direkte i diasvisning.
    if (pagePrev || pageNext) {
      var wrap = document.createElement('div');
      wrap.className = 'pagination slide-pagination';
      if (pagePrev) wrap.appendChild(paginationLink(pagePrev, 'prev', '#dias'));
      if (pageNext) wrap.appendChild(paginationLink(pageNext, 'next', '#dias'));
      list.push({ kicker: 'Videre herfra', els: [wrap] });
    }
    return list;
  }

  function render() {
    var inner = overlay.querySelector('.slide-inner');
    inner.innerHTML = '';
    var s = slides[index];
    if (s.kicker) {
      var k = document.createElement('div');
      k.className = 'kicker';
      k.textContent = s.kicker;
      inner.appendChild(k);
    }
    s.els.forEach(function (el) { inner.appendChild(el); });
    inner.querySelectorAll('.copy, .print-btn').forEach(function (b) { b.remove(); });
    overlay.querySelector('.slide-count').textContent = (index + 1) + ' / ' + slides.length;
    overlay.querySelector('.slide-stage').scrollTop = 0;
  }

  function step(d) {
    if (!overlay) return;
    index = Math.min(slides.length - 1, Math.max(0, index + d));
    render();
  }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.classList.remove('slides-open');
  }

  function open() {
    if (overlay) return;
    slides = buildSlides();
    if (!slides.length) return;
    index = 0;
    overlay = document.createElement('div');
    overlay.className = 'slide-overlay';
    overlay.innerHTML =
      '<div class="slide-stage"><div class="slide-inner"></div></div>' +
      '<div class="slide-controls">' +
      '<span class="slide-foot">© 2026 Jesper Qvist, qvisty.github.io/AI-i-praksis</span>' +
      '<span class="slide-nav">' +
      '<button type="button" class="slide-prev">Forrige</button>' +
      '<span class="slide-count"></span>' +
      '<button type="button" class="slide-next">Næste</button>' +
      '</span>' +
      '<button type="button" class="slide-exit">Luk</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('slides-open');
    overlay.querySelector('.slide-prev').addEventListener('click', function () { step(-1); });
    overlay.querySelector('.slide-next').addEventListener('click', function () { step(1); });
    overlay.querySelector('.slide-exit').addEventListener('click', close);
    render();
  }

  document.addEventListener('keydown', function (e) {
    if (!overlay) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape') { close(); }
  });

  var toggle = document.createElement('button');
  toggle.className = 'slides-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Diasvisning';
  toggle.addEventListener('click', open);
  nav.appendChild(toggle);

  // Åbn diasvisningen direkte med #dias i adressen, praktisk til projektoren.
  if (location.hash === '#dias') open();
})();

// Sammenklappelig menu på smalle skærme: menupunkterne samles i en boks,
// der foldes ud og ind med en burger-knap. På brede skærme ændres intet.
(function () {
  var navEl = document.querySelector('nav');
  var inner = document.querySelector('nav .inner');
  if (!navEl || !inner) return;
  var brand = inner.querySelector('.brand');
  var wrap = document.createElement('div');
  wrap.className = 'nav-links';
  Array.prototype.slice.call(inner.children).forEach(function (el) {
    if (el !== brand) wrap.appendChild(el);
  });
  var burger = document.createElement('button');
  burger.className = 'nav-burger';
  burger.type = 'button';
  burger.setAttribute('aria-label', 'Menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.appendChild(document.createElement('span'));
  burger.appendChild(document.createElement('span'));
  burger.appendChild(document.createElement('span'));
  inner.appendChild(burger);
  inner.appendChild(wrap);
  burger.addEventListener('click', function () {
    var open = navEl.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
})();

// Toner sektionerne blidt ind, når de ruller ind i billedet.
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion && 'IntersectionObserver' in window) {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('main section').forEach(function (el) {
    el.classList.add('reveal');
    observer.observe(el);
  });
}
