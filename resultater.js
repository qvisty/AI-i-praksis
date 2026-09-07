/**
 * Resultatsiden for evalueringen af "AI i praksis".
 *
 * Siden er offentligt tilgængelig HTML, men indeholder ingen data. Svarene
 * hentes først når underviseren indtaster læse-tokenet, og Apps Script
 * kontrollerer tokenet serverside. Tokenet ligger i sessionStorage, så det
 * forsvinder når fanen lukkes — det rigtige valg på en delt maskine.
 */
(function () {
  'use strict';

  // Samme /exec-adresse som i evaluering.js. Kun skriveadgang uden token.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbyuCchb-oRLHrRN0nMST0epZyX02BZwy-ldclm9I3jcTYdazqXWZmrZXwHyBxo8e0WX/exec';

  var TOKEN_NOEGLE = 'ai-i-praksis:resultat-token';
  var DAGE = [
    { vaerdi: '1', label: 'Dag 1' },
    { vaerdi: '2', label: 'Dag 2' },
    { vaerdi: '3', label: 'Dag 3' },
    { vaerdi: '4', label: 'Dag 4' },
    { vaerdi: 'samlet', label: 'Samlet' }
  ];

  var FRITEKST_FELTER = [
    'bedste_ting', 'gik_i_staa', 'en_aendring', 'noget_andet',
    'dag1_tvivl', 'dag2_skepsis', 'dag3_bedre_eksempel', 'dag4_mangler',
    'samlet_resultat', 'samlet_manglede', 'samlet_droppes', 'samlet_hvorfor'
  ];

  // Personoplysninger. Holdes ude af analyse-prompten, saa navne og mailadresser
  // ikke sendes videre til en sprogmodel. Vises kun i deres egen sektion.
  var KONTAKT_FELTER = ['kontakt_navn', 'kontakt_mail'];

  var FORDELING_FELTER = [
    { id: 'tempo', titel: 'Tempo', farver: { 'For langsomt': 'blaa', 'For hurtigt': 'gul' } },
    { id: 'kan_selv', titel: 'Kunne gøre øvelsen selv i morgen' },
    { id: 'brugt_siden_sidst', titel: 'Har brugt noget siden sidste kursusdag' }
  ];

  var laasHolder = document.getElementById('laas-holder');
  var indhold = document.getElementById('resultat-indhold');
  var filterHolder = document.getElementById('dag-filter');

  if (!laasHolder || !indhold) return;

  var alleSvar = [];
  var noegle = [];
  var aktivtFilter = 'alle';

  /* ---------- Hjælpere ---------- */

  /**
   * Opretter et element med valgfri klasse og tekst.
   * @param {string} navn Tagnavn.
   * @param {string} [klasse] Klassenavn.
   * @param {string} [tekst] Tekstindhold.
   * @returns {HTMLElement} Det nye element.
   */
  function el(navn, klasse, tekst) {
    var e = document.createElement(navn);
    if (klasse) e.className = klasse;
    if (tekst !== undefined && tekst !== null) e.textContent = tekst;
    return e;
  }

  /**
   * Formaterer et tal med dansk decimalkomma.
   * @param {number} tal Tallet.
   * @param {number} [decimaler] Antal decimaler, som standard 1.
   * @returns {string} Det formaterede tal.
   */
  function dansk(tal, decimaler) {
    var d = decimaler === undefined ? 1 : decimaler;
    return tal.toLocaleString('da-DK', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /**
   * Slår et dagslabel op.
   * @param {string} vaerdi Dagens værdi.
   * @returns {string} Labelet, eller værdien hvis dagen er ukendt.
   */
  function dagLabel(vaerdi) {
    for (var i = 0; i < DAGE.length; i++) {
      if (DAGE[i].vaerdi === vaerdi) return DAGE[i].label;
    }
    return String(vaerdi);
  }

  /**
   * Slår spørgsmålets fulde ordlyd op i nøglearket.
   * @param {string} kolonne Kolonnenavnet.
   * @returns {string} Spørgsmålet, eller kolonnenavnet hvis nøglen mangler.
   */
  function spoergsmaal(kolonne) {
    for (var i = 1; i < noegle.length; i++) {
      if (noegle[i][0] === kolonne) return String(noegle[i][1] || kolonne);
    }
    return kolonne;
  }

  /**
   * Svarene efter det aktive dagsfilter.
   * @returns {Object[]} De svar der skal vises.
   */
  function filtrerede() {
    if (aktivtFilter === 'alle') return alleSvar;
    return alleSvar.filter(function (s) { return String(s.dag) === aktivtFilter; });
  }

  /**
   * Gennemsnittet af anvendelighedsscoren i et sæt svar.
   * @param {Object[]} svar Svarene.
   * @returns {{snit: number, antal: number}} Gennemsnit og antal gyldige tal.
   */
  function gennemsnit(svar) {
    var tal = svar
      .map(function (s) { return parseInt(s.anvendelighed_1_10, 10); })
      .filter(function (t) { return !isNaN(t) && t >= 1 && t <= 10; });
    if (!tal.length) return { snit: 0, antal: 0 };
    var sum = tal.reduce(function (a, b) { return a + b; }, 0);
    return { snit: sum / tal.length, antal: tal.length };
  }

  /**
   * Tegner én søjlerække med navn, proportional bjælke og et tal til højre.
   * @param {HTMLElement} holder Elementet rækken lægges i.
   * @param {string} navn Etiketten til venstre.
   * @param {number} vaerdi Værdien der styrer bjælkens længde.
   * @param {number} maks Den største værdi i sættet, som bjælken måles mod.
   * @param {string} visning Teksten der vises til højre.
   * @param {string} [farve] Ekstra klasse: 'blaa' eller 'gul'.
   */
  function tegnBarRaekke(holder, navn, vaerdi, maks, visning, farve) {
    var raekke = el('div', 'bar-raekke');
    raekke.appendChild(el('span', 'bar-navn', navn));
    var spor = el('div', 'bar-spor');
    var fyld = el('div', 'bar-fyld' + (farve ? ' ' + farve : ''));
    fyld.style.width = (maks > 0 ? Math.round((vaerdi / maks) * 100) : 0) + '%';
    spor.appendChild(fyld);
    raekke.appendChild(spor);
    raekke.appendChild(el('span', 'bar-tal', visning));
    holder.appendChild(raekke);
  }

  /**
   * Tilføjer en overskrift og en tom søjleliste til en sektion.
   * @param {HTMLElement} holder Sektionen.
   * @param {string} titel Overskriften.
   * @returns {HTMLElement} Den tomme søjleliste.
   */
  function tilfoejListe(holder, titel) {
    if (titel) holder.appendChild(el('h3', null, titel));
    var liste = el('div', 'bar-liste');
    holder.appendChild(liste);
    return liste;
  }

  /* ---------- Låsen ---------- */

  /**
   * Tegner låseskærmen med feltet til læse-tokenet.
   * @param {string} [besked] Valgfri fejlbesked fra et tidligere forsøg.
   */
  function tegnLaas(besked) {
    laasHolder.innerHTML = '';
    indhold.innerHTML = '';
    if (filterHolder) filterHolder.innerHTML = '';

    var kort = el('div', 'laas');
    kort.appendChild(el('h2', null, 'Adgang'));
    kort.appendChild(el('p', 'eval-hjaelp', 'Indtast læse-tokenet fra din password manager. Det gemmes kun i denne fane.'));

    if (besked) {
      var fejl = el('p', 'eval-fejl', besked);
      fejl.setAttribute('role', 'alert');
      kort.appendChild(fejl);
    }

    var form = el('form');
    var felt = document.createElement('input');
    felt.type = 'password';
    felt.autocomplete = 'current-password';
    felt.setAttribute('aria-label', 'Læse-token');
    form.appendChild(felt);

    var knap = el('button', 'knap knap-primaer', 'Lås op');
    knap.type = 'submit';
    form.appendChild(knap);

    form.addEventListener('submit', function (haendelse) {
      haendelse.preventDefault();
      var token = felt.value.trim();
      if (!token) return;
      knap.disabled = true;
      knap.textContent = 'Henter…';
      hentData(token).catch(function (fejlbesked) {
        knap.disabled = false;
        knap.textContent = 'Lås op';
        tegnLaas(String(fejlbesked.message || fejlbesked));
      });
    });

    kort.appendChild(form);
    laasHolder.appendChild(kort);
    felt.focus();
  }

  /**
   * Henter svarene fra Apps Script med det angivne token.
   * @param {string} token Læse-tokenet.
   * @returns {Promise<void>} Løses når siden er tegnet.
   */
  function hentData(token) {
    if (!ENDPOINT) {
      return Promise.reject(new Error('Adressen til datamodtageren mangler i resultater.js.'));
    }

    return fetch(ENDPOINT + '?token=' + encodeURIComponent(token))
      .then(function (svar) {
        if (!svar.ok) throw new Error('Kunne ikke hente svarene (HTTP ' + svar.status + ').');
        return svar.json();
      })
      .then(function (data) {
        if (!data || !data.ok) {
          try { window.sessionStorage.removeItem(TOKEN_NOEGLE); } catch (fejl) { /* ingenting */ }
          throw new Error((data && data.fejl) || 'Adgangskoden blev afvist. Prøv igen.');
        }
        try { window.sessionStorage.setItem(TOKEN_NOEGLE, token); } catch (fejl) { /* ingenting */ }
        alleSvar = data.svar || [];
        noegle = data.noegle || [];
        tegnAlt();
      });
  }

  /* ---------- Sidens indhold ---------- */

  /** Tegner hele resultatsiden ud fra de hentede svar. */
  function tegnAlt() {
    laasHolder.innerHTML = '';

    var laasKnap = el('button', 'knap', 'Lås igen');
    laasKnap.type = 'button';
    laasKnap.addEventListener('click', function () {
      try { window.sessionStorage.removeItem(TOKEN_NOEGLE); } catch (fejl) { /* ingenting */ }
      alleSvar = [];
      noegle = [];
      tegnLaas();
    });
    laasHolder.appendChild(laasKnap);

    tegnFilter();
    tegnIndhold();
  }

  /** Tegner chip-knapperne der filtrerer visningen på kursusdag. */
  function tegnFilter() {
    if (!filterHolder) return;
    filterHolder.innerHTML = '';

    var raekke = el('div', 'valg-raekke dag-vaelger');
    var muligheder = [{ vaerdi: 'alle', label: 'Alle dage' }].concat(DAGE);

    muligheder.forEach(function (m) {
      var antal = m.vaerdi === 'alle'
        ? alleSvar.length
        : alleSvar.filter(function (s) { return String(s.dag) === m.vaerdi; }).length;

      var label = el('label', 'valg');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'dagfilter';
      input.checked = aktivtFilter === m.vaerdi;
      input.addEventListener('change', function () {
        if (!input.checked) return;
        aktivtFilter = m.vaerdi;
        tegnIndhold();
      });
      label.appendChild(input);
      label.appendChild(el('span', 'valg-boks', m.label + ' (' + antal + ')'));
      raekke.appendChild(label);
    });

    filterHolder.appendChild(raekke);
  }

  /** Tegner alle resultatsektioner for det aktive filter. */
  function tegnIndhold() {
    indhold.innerHTML = '';

    if (!alleSvar.length) {
      var tom = el('div', 'note');
      tom.appendChild(el('span', 'label', 'Ingen svar endnu'));
      tom.appendChild(document.createTextNode('Der er ikke indsendt nogen evalueringer på dette ark endnu.'));
      indhold.appendChild(tom);
      return;
    }

    tegnOverblik();
    tegnAntalPrDag();
    tegnAnvendelighed();
    tegnTrend();
    tegnFordelinger();
    tegnFritekst();
    tegnKontakt();
    tegnAnalyse();
  }

  /** Nøgletal øverst: antal svar, dage, gennemsnit og seneste svar. */
  function tegnOverblik() {
    var afsnit = el('section');
    afsnit.appendChild(el('h2', null, 'Overblik'));

    var svar = filtrerede();
    var snit = gennemsnit(svar);
    var dage = {};
    alleSvar.forEach(function (s) { dage[String(s.dag)] = true; });

    var senest = svar
      .map(function (s) { return String(s.tidspunkt_dk || s.tidspunkt_iso || ''); })
      .filter(Boolean)
      .sort();

    var tal = [
      { vaerdi: String(svar.length), navn: 'svar i visningen' },
      { vaerdi: String(Object.keys(dage).length), navn: 'dage med svar' },
      { vaerdi: snit.antal ? dansk(snit.snit) : '–', navn: 'gns. anvendelighed (1-10)' },
      { vaerdi: senest.length ? senest[senest.length - 1].split(' ')[0] : '–', navn: 'seneste svar', tekst: true }
    ];

    var grid = el('div', 'grid');
    tal.forEach(function (t) {
      var kort = el('div', 'card');
      kort.appendChild(el('div', 'noegletal-vaerdi' + (t.tekst ? ' lille' : ''), t.vaerdi));
      kort.appendChild(el('div', 'noegletal-navn', t.navn));
      grid.appendChild(kort);
    });
    afsnit.appendChild(grid);
    indhold.appendChild(afsnit);
  }

  /** Antal svar pr. kursusdag. */
  function tegnAntalPrDag() {
    var afsnit = el('section');
    afsnit.appendChild(el('h2', null, 'Antal svar pr. dag'));

    var liste = tilfoejListe(afsnit, null);
    var antal = DAGE.map(function (d) {
      return { label: d.label, n: alleSvar.filter(function (s) { return String(s.dag) === d.vaerdi; }).length };
    });
    var maks = Math.max.apply(null, antal.map(function (a) { return a.n; }).concat([1]));
    antal.forEach(function (a) {
      tegnBarRaekke(liste, a.label, a.n, maks, String(a.n));
    });

    indhold.appendChild(afsnit);
  }

  /** Fordelingen 1-10 for det aktive filter, og gennemsnittet pr. dag. */
  function tegnAnvendelighed() {
    var afsnit = el('section');
    afsnit.appendChild(el('h2', null, 'Anvendelighed'));
    afsnit.appendChild(el('p', 'eval-hjaelp', spoergsmaal('anvendelighed_1_10')));

    var svar = filtrerede();
    var fordeling = [];
    for (var i = 1; i <= 10; i++) fordeling.push(0);
    svar.forEach(function (s) {
      var t = parseInt(s.anvendelighed_1_10, 10);
      if (!isNaN(t) && t >= 1 && t <= 10) fordeling[t - 1]++;
    });

    var maks = Math.max.apply(null, fordeling.concat([1]));
    var liste = tilfoejListe(afsnit, 'Fordeling');
    fordeling.forEach(function (n, index) {
      tegnBarRaekke(liste, String(index + 1), n, maks, String(n));
    });

    var snitListe = tilfoejListe(afsnit, 'Gennemsnit pr. dag');
    DAGE.forEach(function (d) {
      var dagsSvar = alleSvar.filter(function (s) { return String(s.dag) === d.vaerdi; });
      var g = gennemsnit(dagsSvar);
      tegnBarRaekke(
        snitListe,
        d.label + ' (n=' + g.antal + ')',
        g.snit, 10,
        g.antal ? dansk(g.snit) : '–'
      );
    });

    indhold.appendChild(afsnit);
  }

  /** Udviklingen i gennemsnittet fra dag til dag, tegnet som inline SVG. */
  function tegnTrend() {
    var punkter = DAGE.map(function (d) {
      var dagsSvar = alleSvar.filter(function (s) { return String(s.dag) === d.vaerdi; });
      var g = gennemsnit(dagsSvar);
      return { label: d.label, vaerdi: g.snit, antal: g.antal };
    }).filter(function (p) { return p.antal > 0; });

    if (punkter.length < 2) return;

    var afsnit = el('section');
    afsnit.appendChild(el('h2', null, 'Udvikling'));
    afsnit.appendChild(el('p', 'eval-hjaelp', 'Gennemsnitlig anvendelighed fra dag til dag. Kun dage med svar er med.'));

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 44');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'trend-graf');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Udvikling i gennemsnitlig anvendelighed pr. kursusdag');

    var bredde = punkter.length > 1 ? 90 / (punkter.length - 1) : 0;
    var koordinater = punkter.map(function (p, i) {
      return { x: 5 + i * bredde, y: 36 - (p.vaerdi / 10) * 32, p: p };
    });

    var linje = document.createElementNS(NS, 'polyline');
    linje.setAttribute('fill', 'none');
    linje.setAttribute('stroke', 'currentColor');
    linje.setAttribute('stroke-width', '0.8');
    linje.setAttribute('vector-effect', 'non-scaling-stroke');
    linje.setAttribute('points', koordinater.map(function (k) { return k.x + ',' + k.y; }).join(' '));
    svg.appendChild(linje);

    koordinater.forEach(function (k) {
      var cirkel = document.createElementNS(NS, 'circle');
      cirkel.setAttribute('cx', String(k.x));
      cirkel.setAttribute('cy', String(k.y));
      cirkel.setAttribute('r', '1');
      cirkel.setAttribute('fill', 'currentColor');
      svg.appendChild(cirkel);

      var vaerdi = document.createElementNS(NS, 'text');
      vaerdi.setAttribute('x', String(k.x));
      vaerdi.setAttribute('y', String(Math.max(4, k.y - 2.5)));
      vaerdi.setAttribute('text-anchor', 'middle');
      vaerdi.setAttribute('font-size', '3');
      vaerdi.setAttribute('fill', 'currentColor');
      vaerdi.textContent = dansk(k.p.vaerdi);
      svg.appendChild(vaerdi);

      var navn = document.createElementNS(NS, 'text');
      navn.setAttribute('x', String(k.x));
      navn.setAttribute('y', '42');
      navn.setAttribute('text-anchor', 'middle');
      navn.setAttribute('font-size', '3');
      navn.setAttribute('fill', 'currentColor');
      navn.setAttribute('opacity', '0.7');
      navn.textContent = k.p.label;
      svg.appendChild(navn);
    });

    afsnit.appendChild(svg);
    indhold.appendChild(afsnit);
  }

  /** Fordelingen af svarene på de lukkede spørgsmål. */
  function tegnFordelinger() {
    var svar = filtrerede();

    FORDELING_FELTER.forEach(function (felt) {
      var taeller = {};
      var ialt = 0;
      svar.forEach(function (s) {
        var v = String(s[felt.id] || '').trim();
        if (!v) return;
        taeller[v] = (taeller[v] || 0) + 1;
        ialt++;
      });
      if (!ialt) return;

      var afsnit = el('section');
      afsnit.appendChild(el('h2', null, felt.titel));
      afsnit.appendChild(el('p', 'eval-hjaelp', spoergsmaal(felt.id)));

      var liste = tilfoejListe(afsnit, null);
      var navne = Object.keys(taeller).sort(function (a, b) { return taeller[b] - taeller[a]; });
      var maks = taeller[navne[0]];

      navne.forEach(function (navn) {
        var farve = felt.farver ? felt.farver[navn] : undefined;
        var andel = Math.round((taeller[navn] / ialt) * 100);
        tegnBarRaekke(liste, navn, taeller[navn], maks, taeller[navn] + ' (' + andel + '%)', farve);
      });

      indhold.appendChild(afsnit);
    });
  }

  /** Alle fritekstsvar, grupperet efter spørgsmål frem for efter deltager. */
  function tegnFritekst() {
    var svar = filtrerede();
    var afsnit = el('section');
    afsnit.appendChild(el('h2', null, 'Fritekstsvar'));

    var noget = false;

    FRITEKST_FELTER.forEach(function (id) {
      var med = svar.filter(function (s) { return String(s[id] || '').trim() !== ''; });
      if (!med.length) return;
      noget = true;

      afsnit.appendChild(el('h3', null, spoergsmaal(id)));
      var liste = el('div', 'svar-liste');
      med.forEach(function (s) {
        var kort = el('div', 'svar-kort');
        kort.appendChild(el('span', 'badge', dagLabel(String(s.dag))));
        kort.appendChild(el('p', null, String(s[id]).trim()));
        liste.appendChild(kort);
      });
      afsnit.appendChild(liste);
    });

    if (!noget) afsnit.appendChild(el('p', 'eval-hjaelp', 'Ingen fritekstsvar i den valgte visning.'));
    indhold.appendChild(afsnit);
  }

  /**
   * Viser de deltagere der frivilligt har skrevet navn eller mail, sammen med
   * det de skrev. Formaalet er, at underviseren kan svare tilbage — derfor
   * staar deres fritekstsvar med, saa der er noget at svare paa.
   */
  function tegnKontakt() {
    var med = filtrerede().filter(function (s) {
      return String(s.kontakt_navn || '').trim() !== '' || String(s.kontakt_mail || '').trim() !== '';
    });
    if (!med.length) return;

    var afsnit = el('section');
    afsnit.appendChild(el('h2', null, 'Vil gerne have svar'));
    afsnit.appendChild(el('p', 'eval-hjaelp', med.length === 1
      ? 'Én deltager har skrevet kontaktoplysninger. Navn og mail sendes ikke med i analyse-prompten.'
      : med.length + ' deltagere har skrevet kontaktoplysninger. Navn og mail sendes ikke med i analyse-prompten.'));

    var liste = el('div', 'svar-liste');
    med.forEach(function (s) {
      var kort = el('div', 'svar-kort');
      kort.appendChild(el('span', 'badge', dagLabel(String(s.dag))));

      var navn = String(s.kontakt_navn || '').trim();
      var mail = String(s.kontakt_mail || '').trim();
      var linje = el('p', 'kontakt-navn');
      linje.appendChild(document.createTextNode(navn || 'Uden navn'));
      if (mail) {
        linje.appendChild(document.createTextNode(' — '));
        var link = el('a', null, mail);
        link.href = 'mailto:' + mail;
        linje.appendChild(link);
      }
      kort.appendChild(linje);

      FRITEKST_FELTER.forEach(function (id) {
        var tekst = String(s[id] || '').trim();
        if (!tekst) return;
        kort.appendChild(el('p', 'eval-hjaelp', spoergsmaal(id)));
        kort.appendChild(el('p', null, tekst));
      });

      liste.appendChild(kort);
    });

    afsnit.appendChild(liste);
    indhold.appendChild(afsnit);
  }

  /* ---------- Analyse-prompt ---------- */

  /**
   * Bygger prompten med hele datasættet indlejret som tabulatorsepareret tekst.
   * Prompten indeholder altid ALLE svar, ikke kun det aktive filter — en
   * analyse på tværs af dagene er hele pointen.
   * @returns {string} Den færdige prompt.
   */
  function byggPrompt() {
    var kolonner = (alleSvar.length ? Object.keys(alleSvar[0]) : []).filter(function (k) {
      return KONTAKT_FELTER.indexOf(k) === -1;
    });

    var noegleLinjer = [];
    for (var i = 1; i < noegle.length; i++) {
      var r = noegle[i];
      if (!r || !r[0] || KONTAKT_FELTER.indexOf(r[0]) !== -1) continue;
      noegleLinjer.push(r[0] + ' | ' + (r[1] || '') + ' | svarmuligheder: ' + (r[2] || '–') + ' | skal afgøre: ' + (r[3] || '–'));
    }

    var dataLinjer = [kolonner.join('\t')];
    alleSvar.forEach(function (s) {
      dataLinjer.push(kolonner.map(function (k) {
        return String(s[k] === undefined || s[k] === null ? '' : s[k])
          .replace(/\t/g, ' ')
          .replace(/\r?\n/g, '⏎');
      }).join('\t'));
    });

    return [
      'Du er min kritiske ven som underviser. Jeg har afholdt kursusdage på kurset',
      '"AI i praksis" — et hands-on AI-kursus for voksne i arbejde, uden forudsætninger.',
      'Herunder er alle evalueringssvar, anonymt indsamlet.',
      '',
      'SÅDAN LÆSER DU DATA',
      'Data står som tabulatorsepareret tekst med en overskriftsrække.',
      'Én række er ét svar fra én deltager på én kursusdag.',
      'Tomme celler betyder "spørgsmålet blev ikke stillet den dag" — ikke "ubesvaret".',
      'Linjeskift inde i et fritekstsvar er erstattet med tegnet ⏎.',
      '',
      'SPØRGSMÅLENE OG HVAD DE SKAL AFGØRE',
      noegleLinjer.join('\n'),
      '',
      'DATA',
      dataLinjer.join('\n'),
      '',
      'OPGAVE — svar på dansk, i denne rækkefølge:',
      '1. Overblik: hvor mange svar pr. dag, og hvor pålideligt er billedet? Skriv',
      '   eksplicit "for få svar til at konkludere", hvis en dag har under 5 svar.',
      '2. Anvendelighedsscoren: gennemsnit pr. dag, retningen fra dag til dag, og',
      '   spredningen. Skiller en dag sig ud, så find de fritekstsvar fra netop den',
      '   dag der forklarer hvorfor.',
      '3. Tempo og "kunne du gøre det selv": hvad siger de to sammen om, hvorvidt jeg',
      '   underviste eller blot demonstrerede?',
      '4. Overførsel til jobbet: hvad viser "har du brugt noget siden sidst"? Skeln',
      '   skarpt mellem dem der manglede tid og dem der manglede en konkret opgave —',
      '   det er to forskellige problemer med hver sin løsning.',
      '5. Temaer i fritekstsvarene: de 3-5 mønstre der går igen. Til hvert tema: hvor',
      '   mange deltagere det dækker, og ét ordret citat der rammer det bedst. Citér',
      '   ordret, oversæt ikke, og pynt ikke.',
      '6. Modsigelser: hvor peger svarene i hver sin retning? Nævn dem i stedet for at',
      '   glatte ud — det er dér den svære beslutning ligger.',
      '7. De 3 vigtigste ændringer jeg skal lave inden næste kursusdag. Hver ændring',
      '   skal være så konkret, at jeg kan lave den på under en time, og du skal skrive',
      '   hvilke svar der begrunder den.',
      '8. Én ting jeg skal blive ved med at gøre, fordi den tydeligt virker.',
      '',
      'REGLER',
      '- Skriv dansk, direkte og uden smiger. Jeg skal kunne handle på det, ikke føle mig godt tilpas.',
      '- Byg ikke på antagelser ud over data. Er noget uklart, så skriv at det er uklart.',
      '- Brug ikke procenter på under 10 svar — skriv "3 ud af 7" i stedet.',
      '- Afslut med tre linjer, jeg kan sige højt til deltagerne næste kursusdag om,',
      '  hvad jeg har ændret på baggrund af deres feedback.'
    ].join('\n');
  }

  /** Tegner prompt-afsnittet med kopiknap og download. */
  function tegnAnalyse() {
    var afsnit = el('section');
    afsnit.appendChild(el('h2', null, 'Analyse'));
    afsnit.appendChild(el('p', null, 'Prompten herunder indeholder alle svar fra alle dage — også dem det aktive filter skjuler. Sæt den ind i Claude eller ChatGPT.'));

    var prompt = byggPrompt();

    var knapper = el('div', 'eval-knapper');

    var kopi = el('button', 'knap knap-primaer', 'Kopiér alt som analyse-prompt');
    kopi.type = 'button';
    kopi.addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.writeText) return;
      navigator.clipboard.writeText(prompt).then(function () {
        kopi.textContent = 'Kopieret ✓';
        window.setTimeout(function () { kopi.textContent = 'Kopiér alt som analyse-prompt'; }, 2000);
      }).catch(function () { /* teksten står nedenfor og kan markeres */ });
    });
    knapper.appendChild(kopi);

    var hent = el('button', 'knap', 'Hent som .txt');
    hent.type = 'button';
    hent.addEventListener('click', function () {
      var blob = new Blob([prompt], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'evaluering-analyse.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    knapper.appendChild(hent);

    afsnit.appendChild(knapper);

    var visning = el('div', 'prompt');
    visning.appendChild(document.createTextNode(prompt));
    afsnit.appendChild(visning);

    indhold.appendChild(afsnit);
  }

  /* ---------- Start ---------- */

  var gemt = null;
  try { gemt = window.sessionStorage.getItem(TOKEN_NOEGLE); } catch (fejl) { /* ingenting */ }

  if (gemt) {
    hentData(gemt).catch(function (fejlbesked) {
      tegnLaas(String(fejlbesked.message || fejlbesked));
    });
  } else {
    tegnLaas();
  }
}());
