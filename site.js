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

// Sender lokale Markdown-links gennem sidens renderer i stedet for browserens rå tekstvisning.
document.querySelectorAll('a[href$=".md"]').forEach(function (link) {
  var file = link.getAttribute('href');
  if (file.indexOf('://') !== -1) return;
  link.href = 'markdown.html?file=' + encodeURIComponent(file);
  link.target = '_blank';
  link.rel = 'noopener';
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

// Giver kursusdagens originale PDF et enkelt sæt forrige/næste-kontroller.
document.querySelectorAll('[data-pdf-slideshow]').forEach(function (show) {
  var canvas = show.querySelector('[data-pdf-canvas]');
  var pageInput = show.querySelector('[data-pdf-page]');
  var pageCount = show.querySelector('[data-pdf-count]');
  var fullscreenButton = show.querySelector('[data-pdf-fullscreen]');
  var total = Number(show.getAttribute('data-pages')) || 1;
  var page = 1;
  var pdf = null;
  var stage = canvas.parentNode;
  var linkLayer = document.createElement('div');
  linkLayer.className = 'pdf-links';
  stage.appendChild(linkLayer);

  if (!window.pdfjsLib) return;
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  window.pdfjsLib.getDocument(show.getAttribute('data-pdf')).promise.then(function (document) {
    pdf = document;
    total = document.numPages;
    pageInput.max = total;
    pageCount.textContent = 'af ' + total;
    showPage(1);
  });

  function showPage(nextPage) {
    page = Math.min(total, Math.max(1, nextPage));
    pageInput.value = page;
    pageCount.textContent = 'af ' + total;
    if (!pdf) return;
    pdf.getPage(page).then(function (pdfPage) {
      var viewport = pdfPage.getViewport({ scale: 1.4 });
      var context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      pdfPage.render({ canvasContext: context, viewport: viewport });
      visLinks(pdfPage, viewport);
    });
  }

  // Diassene har noter, der peger over på kursets egne aktiviteter. Canvas kan ikke
  // klikkes, så lænkerne fra PDF'en lægges som usynlige felter oven på diasset.
  function visLinks(pdfPage, viewport) {
    linkLayer.textContent = '';
    if (!pdfPage.getAnnotations) return;
    pdfPage.getAnnotations({ intent: 'display' }).then(function (annotations) {
      annotations.forEach(function (annotation) {
        if (annotation.subtype !== 'Link' || !annotation.url) return;
        var kasse = viewport.convertToViewportRectangle(annotation.rect);
        var venstre = Math.min(kasse[0], kasse[2]);
        var top = Math.min(kasse[1], kasse[3]);
        var bredde = Math.abs(kasse[2] - kasse[0]);
        var hoejde = Math.abs(kasse[3] - kasse[1]);
        var link = document.createElement('a');
        link.className = 'pdf-link';
        link.href = annotation.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.title = 'Åbn aktiviteten i en ny fane';
        link.setAttribute('aria-label', 'Åbn aktiviteten i en ny fane');
        link.style.left = (venstre / viewport.width * 100) + '%';
        link.style.top = (top / viewport.height * 100) + '%';
        link.style.width = (bredde / viewport.width * 100) + '%';
        link.style.height = (hoejde / viewport.height * 100) + '%';
        linkLayer.appendChild(link);
      });
      placerLinkLag();
    });
  }

  // Canvas skaleres af CSS, så laget skal følge dets faktiske størrelse.
  function placerLinkLag() {
    linkLayer.style.left = canvas.offsetLeft + 'px';
    linkLayer.style.top = canvas.offsetTop + 'px';
    linkLayer.style.width = canvas.offsetWidth + 'px';
    linkLayer.style.height = canvas.offsetHeight + 'px';
  }

  window.addEventListener('resize', placerLinkLag);

  show.querySelector('[data-pdf-prev]').addEventListener('click', function () { showPage(page - 1); });
  show.querySelector('[data-pdf-next]').addEventListener('click', function () { showPage(page + 1); });
  pageInput.addEventListener('change', function () { showPage(Number(pageInput.value)); });
  fullscreenButton.addEventListener('click', function () {
    if (document.fullscreenElement === show) {
      document.exitFullscreen();
    } else if (show.requestFullscreen) {
      show.requestFullscreen();
    } else {
      show.classList.toggle('pdf-is-fullscreen');
    }
  });
  document.addEventListener('fullscreenchange', function () {
    var isFullscreen = document.fullscreenElement === show;
    show.classList.toggle('pdf-is-fullscreen', isFullscreen);
    fullscreenButton.textContent = isFullscreen ? 'Luk stort' : 'Vis stort';
    window.setTimeout(placerLinkLag, 60);
  });
});

// Sidernes rækkefølger. Bruges af pagineringen nederst på siderne og af
// det afsluttende bladre-dias i diasvisningen. Modulerne og kursusdagene
// er hver sin kæde.
var PAGE_SEQUENCES = [
  [
    { file: 'index.html', title: 'Forside' },
    { file: 'modul-1-lovable.html', title: 'Modul 1: Byg en app med Lovable' },
    { file: 'modul-2-github-claude.html', title: 'Modul 2: GitHub + Claude Code' },
    { file: 'modul-3-ai-i-hverdagen.html', title: 'Modul 3: AI i din arbejdsdag' },
    { file: 'modul-4-automatisering.html', title: 'Modul 4: Automatisér din egen hverdag' },
    { file: 'modul-5-andre-modaliteter.html', title: 'Modul 5: Fra dokument til podcast' },
    { file: 'modul-6-forstaa-ai.html', title: 'Modul 6: Forstå AI' },
    { file: 'flere-vaerktoejer.html', title: 'Flere værktøjer at prøve' }
  ],
  [
    { file: 'dag-1.html', title: 'Dag 1' },
    { file: 'dag-2.html', title: 'Dag 2' },
    { file: 'dag-3.html', title: 'Dag 3' },
    { file: 'dag-4.html', title: 'Dag 4' },
    { file: 'proeven.html', title: 'Prøven' }
  ]
];

var pageFile = location.pathname.split('/').pop() || 'index.html';
var pageIndex = -1;
var PAGE_SEQUENCE = [];
PAGE_SEQUENCES.forEach(function (seq) {
  seq.forEach(function (p, i) {
    if (p.file === pageFile) { PAGE_SEQUENCE = seq; pageIndex = i; }
  });
});
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
    { label: 'Kursusdage', children: [
      { file: 'dag-1.html', label: 'Dag 1' },
      { file: 'dag-2.html', label: 'Dag 2' },
      { file: 'dag-3.html', label: 'Dag 3' },
      { file: 'dag-4.html', label: 'Dag 4' },
      { file: 'proeven.html', label: 'Prøven' }
    ] },
    { file: 'modul-1-lovable.html', label: 'Modul 1: Lovable' },
    { file: 'modul-2-github-claude.html', label: 'Modul 2: GitHub + Claude' },
    { file: 'modul-3-ai-i-hverdagen.html', label: 'Modul 3: Hverdagen' },
    { file: 'modul-4-automatisering.html', label: 'Modul 4: Automatisering' },
    { file: 'modul-5-andre-modaliteter.html', label: 'Modul 5: NotebookLM' },
    { file: 'modul-6-forstaa-ai.html', label: 'Modul 6: Teorien' },
    { label: 'Mere', children: [
      { file: 'oversigt.html', label: 'Oversigt og stikord' },
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
        document.querySelectorAll('.nav-group.open').forEach(function (g) {
          if (g !== group) {
            g.classList.remove('open');
            g.querySelector('.nav-group-btn').setAttribute('aria-expanded', 'false');
          }
        });
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

// Navigation inden for siden: en indholdsfortegnelse bygget af sektionernes
// overskrifter. Fast i margenen på brede skærme, sammenklappelig boks på små.
(function () {
  var main = document.querySelector('main');
  if (!main) return;
  var sections = Array.prototype.filter.call(main.querySelectorAll(':scope > section'), function (s) {
    return s.id && s.querySelector(':scope > h2');
  });
  if (sections.length < 3) return;

  function buildList() {
    var ul = document.createElement('ul');
    sections.forEach(function (s) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + s.id;
      a.textContent = s.querySelector(':scope > h2').textContent;
      a.setAttribute('data-target', s.id);
      li.appendChild(a);
      ul.appendChild(li);
    });
    return ul;
  }

  var inline = document.createElement('nav');
  inline.className = 'toc toc-inline';
  inline.setAttribute('aria-label', 'Indhold på siden');
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'toc-toggle';
  toggle.textContent = 'Indhold på siden';
  toggle.setAttribute('aria-expanded', 'false');
  inline.appendChild(toggle);
  inline.appendChild(buildList());
  toggle.addEventListener('click', function () {
    var open = inline.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  var hero = main.querySelector('header.hero');
  if (hero) { hero.insertAdjacentElement('afterend', inline); }
  else { main.insertBefore(inline, main.firstChild); }

  var side = document.createElement('nav');
  side.className = 'toc toc-side';
  side.setAttribute('aria-label', 'På denne side');
  var title = document.createElement('div');
  title.className = 'toc-title';
  title.textContent = 'På denne side';
  side.appendChild(title);
  side.appendChild(buildList());
  document.body.appendChild(side);

  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          document.querySelectorAll('.toc a').forEach(function (a) {
            a.classList.toggle('current', a.getAttribute('data-target') === entry.target.id);
          });
        }
      });
    }, { rootMargin: '-15% 0px -70% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }
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

  function bigBox(el) {
    return el.classList.contains('exercise') || el.classList.contains('explain') ||
      el.classList.contains('note') || el.classList.contains('prompt') ||
      el.classList.contains('figure') || el.tagName === 'OL' || el.tagName === 'UL';
  }

  function chunkText(els) {
    return els.reduce(function (sum, e) { return sum + (e.textContent || '').length; }, 0);
  }

  // Et indbygget PDF-diasshow kan ikke klones med sin funktion, så i
  // diasvisningen bliver det til en knap, der hopper ned til det rigtige.
  function pdfJump(section) {
    var box = document.createElement('div');
    box.className = 'slide-jump';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Bladr i diasshowet på siden';
    btn.addEventListener('click', function () {
      close();
      section.scrollIntoView();
    });
    box.appendChild(btn);
    return box;
  }

  /**
   * Deler siden op i dias ved at klone sektionernes indhold ned i overlayet.
   * Sektioner med data-ingen-dias springes over: en klonet formular ville give
   * to radiogrupper med samme name, så et valg i overlayet afvælger i den
   * rigtige formular.
   * @returns {Array<{kicker: string, id: string, els: Element[]}>} Ét objekt pr. dias.
   */
  function buildSlides() {
    var list = [];
    var hero = document.querySelector('header.hero');
    if (hero) list.push({ kicker: '', id: '', els: [hero.cloneNode(true)] });
    main.querySelectorAll(':scope > section').forEach(function (section) {
      if (section.hasAttribute('data-ingen-dias')) return;
      var h2 = section.querySelector(':scope > h2');
      var kicker = h2 ? h2.textContent : '';
      var chunks = [];
      var cur = [];
      var curText = 0;
      function flush() { if (cur.length) { chunks.push(cur); cur = []; curText = 0; } }
      // Overskrifter, der står alene, rykkes med over på næste dias.
      function takeHeadings() {
        if (cur.length && cur.every(function (e) { return e.tagName === 'H3'; })) {
          var heads = cur;
          cur = [];
          curText = 0;
          return heads;
        }
        flush();
        return [];
      }
      Array.prototype.forEach.call(section.children, function (el) {
        if (el === h2) return;
        if (el.classList.contains('pdf-slideshow')) {
          cur.push(pdfJump(section));
          flush();
          return;
        }
        if (el.classList.contains('grid')) {
          var heads = takeHeadings();
          var cards = Array.prototype.slice.call(el.children);
          for (var i = 0; i < cards.length; i += 2) {
            var g = document.createElement('div');
            g.className = 'grid';
            cards.slice(i, i + 2).forEach(function (c) { g.appendChild(c.cloneNode(true)); });
            chunks.push(i === 0 ? heads.concat([g]) : [g]);
          }
          return;
        }
        if (el.tagName === 'TABLE') {
          var th = takeHeadings();
          chunkTable(el).forEach(function (c, n) { chunks.push(n === 0 ? th.concat(c) : c); });
          return;
        }
        if (el.classList.contains('source')) {
          if (!cur.length && chunks.length) { chunks[chunks.length - 1].push(el.cloneNode(true)); }
          else { cur.push(el.cloneNode(true)); }
          return;
        }
        if (el.tagName === 'H3') {
          if (!cur.every(function (e) { return e.tagName === 'H3'; })) flush();
          cur.push(el.cloneNode(true));
          return;
        }
        if (el.classList.contains('figure') && !cur.length && chunks.length) {
          // Et billede lige efter en kort boks deler dias med den.
          var last = chunks[chunks.length - 1];
          if (last.length === 1 && bigBox(last[0]) && !last[0].classList.contains('figure') &&
              chunkText(last) < 300) {
            last.push(el.cloneNode(true));
            return;
          }
        }
        if (bigBox(el)) {
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
      chunks.forEach(function (els) { list.push({ kicker: kicker, id: section.id, els: els }); });
    });
    // Afsluttende dias: bladr videre til forrige eller næste modul,
    // som åbner direkte i diasvisning.
    if (pagePrev || pageNext) {
      var wrap = document.createElement('div');
      wrap.className = 'pagination slide-pagination';
      if (pagePrev) wrap.appendChild(paginationLink(pagePrev, 'prev', '#diasvisning'));
      if (pageNext) wrap.appendChild(paginationLink(pageNext, 'next', '#diasvisning'));
      list.push({ kicker: 'Videre herfra', id: '', els: [wrap] });
    }
    return list;
  }

  // Finder det dias, der viser et bestemt afsnit eller element på siden.
  function slideFor(id) {
    for (var i = 0; i < slides.length; i++) {
      var s = slides[i];
      if (s.id === id) return i;
      for (var j = 0; j < s.els.length; j++) {
        var el = s.els[j];
        if (el.id === id || (el.querySelector && el.querySelector('[id="' + id + '"]'))) return i;
      }
    }
    return -1;
  }

  // Diasnummeret står i adressen, så Tilbage fra et link lander på samme dias.
  function remember() {
    history.replaceState(null, '', location.pathname + location.search + '#diasvisning-' + (index + 1));
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
    inner.classList.toggle('only-figure', s.els.length === 1 && s.els[0].classList.contains('figure'));
    inner.querySelectorAll('.copy, .print-btn').forEach(function (b) { b.remove(); });
    overlay.querySelector('.slide-page').value = index + 1;
    overlay.querySelector('.slide-total').textContent = 'af ' + slides.length;
    overlay.querySelector('.slide-stage').scrollTop = 0;
    remember();
  }

  function go(n) {
    if (!overlay) return;
    index = Math.min(slides.length - 1, Math.max(0, n));
    render();
  }

  function step(d) { go(index + d); }

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.classList.remove('slides-open');
    history.replaceState(null, '', location.pathname + location.search);
  }

  function open(start) {
    if (overlay) return;
    slides = buildSlides();
    if (!slides.length) return;
    index = Math.min(slides.length - 1, Math.max(0, (start || 1) - 1));
    overlay = document.createElement('div');
    overlay.className = 'slide-overlay';
    overlay.innerHTML =
      '<div class="slide-stage"><div class="slide-inner"></div></div>' +
      '<div class="slide-controls">' +
      '<span class="slide-foot">© 2026 Jesper Qvist, qvisty.github.io/AI-i-praksis</span>' +
      '<span class="slide-nav">' +
      '<button type="button" class="slide-prev">Forrige</button>' +
      '<span class="slide-count"><input type="number" class="slide-page" min="1" aria-label="Gå til dias">' +
      ' <span class="slide-total"></span></span>' +
      '<button type="button" class="slide-next">Næste</button>' +
      '</span>' +
      '<button type="button" class="slide-exit">Luk</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('slides-open');
    overlay.querySelector('.slide-prev').addEventListener('click', function () { step(-1); });
    overlay.querySelector('.slide-next').addEventListener('click', function () { step(1); });
    overlay.querySelector('.slide-exit').addEventListener('click', close);
    overlay.querySelector('.slide-page').addEventListener('change', function (e) {
      var n = parseInt(e.target.value, 10);
      if (n) go(n - 1); else render();
    });
    // Links til et andet sted på samme side hopper til det dias, der viser stedet.
    overlay.querySelector('.slide-stage').addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || !a.hash || a.target === '_blank') return;
      if (a.pathname !== location.pathname || a.search !== location.search) return;
      var id = decodeURIComponent(a.hash.slice(1));
      if (/^dias(visning)?(-\d+)?$/.test(id)) return;
      e.preventDefault();
      var n = slideFor(id);
      if (n !== -1) { go(n); return; }
      close();
      var target = document.getElementById(id);
      if (target) target.scrollIntoView();
    });
    render();
  }

  document.addEventListener('keydown', function (e) {
    if (!overlay) return;
    if (e.target && e.target.classList && e.target.classList.contains('slide-page')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape') { close(); }
  });

  var toggle = document.createElement('button');
  toggle.className = 'slides-toggle';
  toggle.type = 'button';
  toggle.textContent = 'Diasvisning';
  toggle.addEventListener('click', function () { open(1); });
  nav.appendChild(toggle);

  // Åbn diasvisningen direkte med #diasvisning eller #diasvisning-12 i adressen.
  // Det gamle #dias virker stadig på sider, hvor intet afsnit hedder dias.
  var startHash = location.hash.match(/^#diasvisning(?:-(\d+))?$/);
  if (startHash) open(startHash[1] ? parseInt(startHash[1], 10) : 1);
  else if (location.hash === '#dias' && !document.getElementById('dias')) open(1);
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

// Link til det formelle kursus hos UCL i sidefoden på alle sider.
(function () {
  var foot = document.querySelector('footer .inner');
  if (!foot) return;
  foot.appendChild(document.createTextNode(' '));
  var a = document.createElement('a');
  a.href = 'https://www.ucl.dk/efteruddannelser-og-kurser/efteruddannelser/akademimoduler/ai-i-praksis';
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'Kurset hos UCL';
  foot.appendChild(a);
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
