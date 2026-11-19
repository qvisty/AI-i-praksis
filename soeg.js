// Søgning på tværs af hele kursussiden.
//
// Tilføjer en Søg-knap i menuen. Første gang søgningen åbnes, hentes
// søgebiblioteket MiniSearch og soegeindeks.json, som bygges med
// scripts/byg-soegeindeks.js. Alt foregår i browseren, uden server.
(function () {
  var nav = document.querySelector('nav .inner');
  if (!nav || document.querySelector('.soeg-knap')) return;

  var MINISEARCH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/minisearch/7.1.2/umd/index.min.js';
  var INDEKS_URL = 'soegeindeks.json';
  var MAKS_RESULTATER = 40;

  // Små, hyppige ord, der ikke siger noget om indholdet.
  var STOPORD = {};
  ('og i at er det en et til på som de med for af den har ikke du jeg kan vi om så der var men ' +
   'hvad hvor man dig din dit dine os jer sig fra eller når også skal vil være bliver blev kun nu her ' +
   'hvordan hvorfor sådan meget mere the a an of to in and is for on with are').split(' ').forEach(function (o) { STOPORD[o] = true; });

  // Ord, der betyder det samme. Begge veje skrives ud, så søgningen finder begge.
  var SYNONYMER = {};
  [
    ['ai', 'ki'],
    ['llm', 'sprogmodel'],
    ['bias', 'skævhed'],
    ['vandmærke', 'watermark', 'mærkning'],
    ['ophavsret', 'copyright'],
    ['persondata', 'gdpr', 'personoplysninger'],
    ['prøven', 'eksamen'],
    ['rag', 'kildeforankring'],
    ['automatisering', 'automation'],
    ['hallucination', 'hallucinationer', 'opdigter'],
    ['agent', 'agenter'],
    ['prompt', 'prompting'],
    ['bæredygtighed', 'klima', 'strømforbrug'],
    ['forordning', 'forordningen', 'act']
  ].forEach(function (gruppe) {
    gruppe.forEach(function (ord) {
      SYNONYMER[ord] = gruppe.filter(function (andet) { return andet !== ord; });
    });
  });

  var TYPER = { side: 'Side', dias: 'Dias', materiale: 'Materiale' };
  var FILTRE = [
    { id: 'alt', tekst: 'Alt' },
    { id: 'side', tekst: 'Sider' },
    { id: 'dias', tekst: 'Dias' },
    { id: 'materiale', tekst: 'Materialer' }
  ];

  var VOKALER = 'aeiouyæåø';
  var S_ENDELSER = 'abcdfghjklmnoprtvyzå';
  var TRIN1 = ['erendes', 'erende', 'hedens', 'ethed', 'erede', 'heden', 'heder', 'endes', 'ernes',
    'erens', 'erets', 'ered', 'ende', 'erne', 'eres', 'eren', 'erer', 'heds', 'enes', 'eret',
    'hed', 'ene', 'ere', 'ens', 'ers', 'ets', 'en', 'er', 'es', 'et', 'e'];

  /**
   * Dansk ordstamme efter Snowball-algoritmen, så "agenter", "agenten" og
   * "agent" findes som det samme ord.
   * @param {string} ord Ord med små bogstaver.
   * @returns {string} Ordets stamme.
   */
  function stamme(ord) {
    if (ord.length < 3 || /\d/.test(ord)) return ord;
    var r1 = ord.length;
    for (var i = 1; i < ord.length; i++) {
      if (VOKALER.indexOf(ord[i]) === -1 && VOKALER.indexOf(ord[i - 1]) !== -1) { r1 = i + 1; break; }
    }
    if (r1 < 3) r1 = 3;
    var w = ord;
    var iR1 = function (endelse) { return w.length - endelse.length >= r1 && w.slice(-endelse.length) === endelse; };
    var konsonantpar = function () {
      if (['gd', 'dt', 'gt', 'kt'].some(iR1)) w = w.slice(0, -1);
    };

    var fjernet = false;
    for (var j = 0; j < TRIN1.length; j++) {
      if (iR1(TRIN1[j])) { w = w.slice(0, -TRIN1[j].length); fjernet = true; break; }
    }
    if (!fjernet && iR1('s') && S_ENDELSER.indexOf(w[w.length - 2]) !== -1) w = w.slice(0, -1);
    konsonantpar();
    if (w.slice(-4) === 'igst') w = w.slice(0, -2);
    if (iR1('løst')) {
      w = w.slice(0, -1);
    } else {
      var trin3 = ['elig', 'lig', 'els', 'ig'];
      for (var k = 0; k < trin3.length; k++) {
        if (iR1(trin3[k])) { w = w.slice(0, -trin3[k].length); konsonantpar(); break; }
      }
    }
    var sidste = w[w.length - 1];
    if (w.length - 2 >= r1 && VOKALER.indexOf(sidste) === -1 && sidste === w[w.length - 2]) w = w.slice(0, -1);
    return w;
  }

  /**
   * Gør et ord klar til indekset: små bogstaver, ingen stopord, dansk stamme.
   * @param {string} ord Et ord fra teksten eller søgefeltet.
   * @returns {string|null} Stammen, eller null hvis ordet skal springes over.
   */
  function behandl(ord) {
    var lille = ord.toLowerCase().normalize('NFC');
    if (!lille || STOPORD[lille]) return null;
    return stamme(lille);
  }

  /**
   * Escaper tekst, så den kan sættes ind som HTML.
   * @param {string} tekst Rå tekst.
   * @returns {string} Sikker HTML.
   */
  function esc(tekst) {
    return String(tekst).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var ORD_RE = /[\p{L}\p{N}]+/gu;

  /**
   * Markerer de ord i en tekst, hvis stamme er blandt de fundne termer.
   * @param {string} tekst Teksten der vises.
   * @param {Object<string, boolean>} termer Fundne stammer.
   * @returns {string} HTML med <mark> om de fundne ord.
   */
  function marker(tekst, termer) {
    var ud = '';
    var sidst = 0;
    tekst.replace(ORD_RE, function (ord, pos) {
      if (termer[behandl(ord)]) {
        ud += esc(tekst.slice(sidst, pos)) + '<mark>' + esc(ord) + '</mark>';
        sidst = pos + ord.length;
      }
      return ord;
    });
    return ud + esc(tekst.slice(sidst));
  }

  /**
   * Finder et kort uddrag omkring det første fundne ord i teksten.
   * @param {string} tekst Hele dokumentets tekst.
   * @param {Object<string, boolean>} termer Fundne stammer.
   * @param {string} [titel] Resultatets titel, der ikke skal gentages.
   * @returns {string} HTML-uddrag med markeringer.
   */
  function uddrag(tekst, termer, titel) {
    // Dias og PDF-sider starter med deres egen overskrift. Den står allerede som titel.
    var ren = titel ? titel.replace(/…$/, '') : '';
    if (ren && tekst.indexOf(ren) === 0 && tekst.length > ren.length + 40) tekst = tekst.slice(ren.length).trim();
    var foerste = -1;
    var m;
    ORD_RE.lastIndex = 0;
    while ((m = ORD_RE.exec(tekst))) {
      if (termer[behandl(m[0])]) { foerste = m.index; break; }
    }
    ORD_RE.lastIndex = 0;
    var start = foerste > 70 ? tekst.lastIndexOf(' ', foerste - 60) + 1 : 0;
    var slut = Math.min(tekst.length, start + 230);
    if (slut < tekst.length) slut = tekst.lastIndexOf(' ', slut) > start ? tekst.lastIndexOf(' ', slut) : slut;
    return (start > 0 ? '…' : '') + marker(tekst.slice(start, slut), termer) + (slut < tekst.length ? '…' : '');
  }

  // ---------- Knappen ----------

  var knap = document.createElement('button');
  knap.type = 'button';
  knap.className = 'soeg-knap';
  knap.setAttribute('aria-label', 'Søg på hele siden');
  knap.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Søg</span><kbd>/</kbd>';
  nav.insertBefore(knap, nav.querySelector('.nav-burger'));

  var motor = null;
  var indlaesning = null;
  var overlay, felt, statusLinje, liste, filterBar;
  var resultater = [];
  var filter = 'alt';
  var aktiv = -1;
  var timer = null;

  /**
   * Henter et script én gang.
   * @param {string} src Scriptets adresse.
   * @returns {Promise<void>} Løses, når scriptet er indlæst.
   */
  function hentScript(src) {
    return new Promise(function (ok, fejl) {
      if (window.MiniSearch) { ok(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { ok(); };
      s.onerror = fejl;
      document.head.appendChild(s);
    });
  }

  /**
   * Henter søgebiblioteket og indekset og bygger søgemotoren.
   * @returns {Promise<void>} Løses, når der kan søges.
   */
  function indlaes() {
    if (indlaesning) return indlaesning;
    indlaesning = Promise.all([
      hentScript(MINISEARCH_URL),
      fetch(INDEKS_URL).then(function (r) {
        if (!r.ok) throw new Error('Indekset blev ikke fundet');
        return r.json();
      })
    ]).then(function (svar) {
      motor = new window.MiniSearch({
        idField: 'id',
        fields: ['t', 'h', 'x'],
        storeFields: ['t', 'k', 'u', 'y', 'b', 'x'],
        processTerm: behandl,
        searchOptions: {
          boost: { t: 3, h: 2, x: 1 },
          prefix: function (term) { return term.length >= 3; },
          fuzzy: function (term) { return term.length >= 5 ? 0.2 : false; },
          boostDocument: function (id, term, felter) {
            var vaegt = felter.y === 'side' ? 1.2 : felter.y === 'dias' ? 1 : 0.85;
            return felter.b ? vaegt * 0.35 : vaegt;
          }
        }
      });
      motor.addAll(svar[1].docs);
    });
    indlaesning.catch(function () { indlaesning = null; });
    return indlaesning;
  }

  /**
   * Bygger en forespørgsel, hvor hvert ord kan matche sine synonymer.
   * @param {string[]} ord Søgeordene.
   * @param {string} kombiner "AND" eller "OR".
   * @returns {object} Forespørgsel til MiniSearch.
   */
  function forespoergsel(ord, kombiner) {
    return {
      combineWith: kombiner,
      queries: ord.map(function (o) {
        return SYNONYMER[o] ? { combineWith: 'OR', queries: [o].concat(SYNONYMER[o]) } : o;
      })
    };
  }

  /**
   * Søger og begrænser, hvor mange hit der vises fra den samme kilde.
   * @param {string} q Søgeteksten.
   * @returns {{hits: object[], delvis: boolean}} De sorterede hit.
   */
  function soeg(q) {
    var ord = (q.toLowerCase().match(ORD_RE) || []).filter(function (o) { return !STOPORD[o]; });
    if (!ord.length) return { hits: [], delvis: false };
    var hits = motor.search(forespoergsel(ord, 'AND'));
    var delvis = false;
    if (!hits.length && ord.length > 1) {
      hits = motor.search(forespoergsel(ord, 'OR'));
      delvis = hits.length > 0;
    }
    var hel = q.trim().toLowerCase();
    hits.forEach(function (h) {
      if (hel.length > 2 && h.t.toLowerCase().indexOf(hel) !== -1) h.score *= 1.6;
    });
    hits.sort(function (a, b) { return b.score - a.score; });

    var perKilde = {};
    var udvalgte = [];
    hits.forEach(function (h) {
      var kilde = h.y === 'dias' ? h.u.replace(/\?dias=\d+/, '') : h.u.split('#')[0];
      var loft = h.y === 'dias' ? 6 : 4;
      perKilde[kilde] = (perKilde[kilde] || 0) + 1;
      if (perKilde[kilde] <= loft && udvalgte.length < MAKS_RESULTATER * 2) udvalgte.push(h);
    });
    return { hits: udvalgte, delvis: delvis };
  }

  // ---------- Dialogen ----------

  /**
   * Bygger søgedialogen første gang, den skal bruges.
   */
  function bygDialog() {
    overlay = document.createElement('div');
    overlay.className = 'soeg-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="soeg-panel" role="dialog" aria-modal="true" aria-label="Søg på siden">' +
        '<div class="soeg-top">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
          '<input type="search" class="soeg-felt" placeholder="Søg i sider, dias og materialer" autocomplete="off" spellcheck="false" ' +
            'role="combobox" aria-expanded="true" aria-controls="soeg-liste" aria-autocomplete="list">' +
          '<button type="button" class="soeg-luk" aria-label="Luk søgningen">Luk</button>' +
        '</div>' +
        '<div class="soeg-filtre" role="group" aria-label="Vis kun"></div>' +
        '<p class="soeg-status" aria-live="polite"></p>' +
        '<ul class="soeg-liste" id="soeg-liste" role="listbox" aria-label="Resultater"></ul>' +
        '<p class="soeg-hjaelp"><kbd>↑</kbd><kbd>↓</kbd> vælg · <kbd>Enter</kbd> åbn · <kbd>Esc</kbd> luk</p>' +
      '</div>';
    document.body.appendChild(overlay);
    felt = overlay.querySelector('.soeg-felt');
    statusLinje = overlay.querySelector('.soeg-status');
    liste = overlay.querySelector('.soeg-liste');
    filterBar = overlay.querySelector('.soeg-filtre');

    FILTRE.forEach(function (f) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.filter = f.id;
      b.setAttribute('aria-pressed', f.id === filter ? 'true' : 'false');
      b.textContent = f.tekst;
      b.addEventListener('click', function () {
        filter = f.id;
        tegn();
        felt.focus();
      });
      filterBar.appendChild(b);
    });

    overlay.addEventListener('click', function (e) { if (e.target === overlay) luk(); });
    overlay.querySelector('.soeg-luk').addEventListener('click', luk);
    felt.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(koer, 120);
    });
    felt.addEventListener('keydown', function (e) {
      var synlige = liste.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!synlige.length) return;
        aktiv = e.key === 'ArrowDown' ? Math.min(synlige.length - 1, aktiv + 1) : Math.max(0, aktiv - 1);
        markerAktiv();
      } else if (e.key === 'Enter') {
        var maal = synlige[aktiv >= 0 ? aktiv : 0];
        if (maal) { e.preventDefault(); maal.click(); }
      }
    });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); luk(); }
      if (e.key === 'Tab') holdFokus(e);
    });
    liste.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      var maal = new URL(a.href, location.href);
      if (maal.pathname === location.pathname && maal.search === location.search) luk(true);
    });
  }

  /**
   * Holder tastaturfokus inde i dialogen, mens den er åben.
   * @param {KeyboardEvent} e Tab-tastetrykket.
   */
  function holdFokus(e) {
    var fokuserbare = overlay.querySelectorAll('input, button, a[href]');
    var foerste = fokuserbare[0];
    var sidste = fokuserbare[fokuserbare.length - 1];
    if (e.shiftKey && document.activeElement === foerste) { e.preventDefault(); sidste.focus(); }
    else if (!e.shiftKey && document.activeElement === sidste) { e.preventDefault(); foerste.focus(); }
  }

  /**
   * Fremhæver det valgte resultat og ruller det frem.
   */
  function markerAktiv() {
    var synlige = liste.querySelectorAll('a');
    synlige.forEach(function (a, i) { a.classList.toggle('aktiv', i === aktiv); a.setAttribute('aria-selected', i === aktiv ? 'true' : 'false'); });
    if (synlige[aktiv]) {
      synlige[aktiv].scrollIntoView({ block: 'nearest' });
      felt.setAttribute('aria-activedescendant', synlige[aktiv].id);
    }
  }

  /**
   * Kører søgningen på det, der står i feltet.
   */
  function koer() {
    var q = felt.value.trim();
    try { sessionStorage.setItem('ai-i-praksis-soeg', q); } catch (e) { /* ikke vigtigt */ }
    if (q.length < 2) {
      resultater = [];
      statusLinje.textContent = q ? 'Skriv mindst to bogstaver.' : 'Søg i alle kursusdage, moduler, dias og materialer.';
      liste.innerHTML = '';
      opdaterFiltre({});
      return;
    }
    if (!motor) {
      statusLinje.textContent = 'Indlæser søgningen …';
      indlaes().then(koer, function () {
        statusLinje.textContent = 'Søgningen kunne ikke indlæses. Prøv at genindlæse siden.';
      });
      return;
    }
    var svar = soeg(q);
    resultater = svar.hits;
    resultater.delvis = svar.delvis;
    resultater.q = q;
    tegn();
  }

  /**
   * Opdaterer filterknapperne med antal hit pr. type.
   * @param {Object<string, number>} antal Antal hit pr. type.
   */
  function opdaterFiltre(antal) {
    filterBar.querySelectorAll('button').forEach(function (b) {
      var f = b.dataset.filter;
      var tekst = FILTRE.filter(function (x) { return x.id === f; })[0].tekst;
      var n = f === 'alt' ? resultater.length : (antal[f] || 0);
      b.textContent = resultater.length ? tekst + ' (' + n + ')' : tekst;
      b.setAttribute('aria-pressed', f === filter ? 'true' : 'false');
      b.disabled = resultater.length > 0 && n === 0 && f !== 'alt';
    });
  }

  /**
   * Tegner resultatlisten for det valgte filter.
   */
  function tegn() {
    var antal = {};
    resultater.forEach(function (h) { antal[h.y] = (antal[h.y] || 0) + 1; });
    if (filter !== 'alt' && !antal[filter]) filter = 'alt';
    opdaterFiltre(antal);
    if (!resultater.q) return;
    var vist = resultater.filter(function (h) { return filter === 'alt' || h.y === filter; }).slice(0, MAKS_RESULTATER);
    aktiv = -1;
    felt.removeAttribute('aria-activedescendant');
    if (!vist.length) {
      statusLinje.innerHTML = 'Ingen resultater for <strong>' + esc(resultater.q) + '</strong>. Prøv et andet eller kortere ord.';
      liste.innerHTML = '';
      return;
    }
    statusLinje.textContent = (resultater.delvis ? 'Ingen hit med alle ordene. Her er hit med nogle af dem: ' : '') +
      resultater.length + (resultater.length === 1 ? ' resultat' : ' resultater') +
      (resultater.length > vist.length && filter === 'alt' ? ', de ' + vist.length + ' bedste vises' : '') + '.';
    liste.innerHTML = vist.map(function (h, i) {
      var termer = {};
      h.terms.forEach(function (t) { termer[t] = true; });
      return '<li><a id="soeg-hit-' + i + '" role="option" href="' + esc(h.u) + '">' +
        '<span class="soeg-meta"><span class="soeg-type soeg-type-' + h.y + '">' + TYPER[h.y] + '</span>' +
        (h.b ? '<span class="soeg-type soeg-bilag">Bilag</span>' : '') +
        '<span class="soeg-kontekst">' + esc(h.k) + '</span></span>' +
        '<strong class="soeg-titel">' + marker(h.t, termer) + '</strong>' +
        '<span class="soeg-uddrag">' + uddrag(h.x, termer, h.t) + '</span>' +
        '</a></li>';
    }).join('');
  }

  /**
   * Åbner søgedialogen.
   */
  function aabn() {
    if (document.documentElement.classList.contains('laast')) return;
    if (!overlay) bygDialog();
    overlay.hidden = false;
    document.documentElement.classList.add('soeg-aaben');
    if (!felt.value) {
      try { felt.value = sessionStorage.getItem('ai-i-praksis-soeg') || ''; } catch (e) { /* ikke vigtigt */ }
    }
    felt.focus();
    felt.select();
    koer();
    indlaes().catch(function () { /* vises, når der søges */ });
  }

  /**
   * Lukker søgedialogen.
   * @param {boolean} [navigerer] Sand, når et resultat på samme side er valgt.
   */
  function luk(navigerer) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.documentElement.classList.remove('soeg-aaben');
    if (navigerer !== true) knap.focus();
  }

  knap.addEventListener('click', aabn);
  knap.addEventListener('mouseenter', function () { indlaes().catch(function () {}); }, { once: true });
  document.addEventListener('keydown', function (e) {
    var maal = e.target;
    var skriver = maal && (maal.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(maal.tagName));
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      aabn();
    } else if (e.key === '/' && !skriver && !e.ctrlKey && !e.metaKey && !e.altKey &&
               !document.querySelector('.slide-overlay')) {
      e.preventDefault();
      aabn();
    }
  });
})();
