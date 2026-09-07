/**
 * Evalueringsformularen for kurset "AI i praksis".
 *
 * Hele spørgeskemaet er defineret som data i EVAL_KONFIG. Formularen bygges ud
 * fra det objekt, så et nyt spørgsmål kun kræver en ændring her — ikke i HTML.
 * Feltets id er samtidig kolonnenavnet i regnearket.
 *
 * Svarene sendes til en Google Apps Script web app, der skriver én række i et
 * privat regneark. Se filer/evaluering-opsaetning.md for opsætningen.
 */
(function () {
  'use strict';

  var EVAL_KONFIG = {
    // UNDERVISER: Indsæt /exec-adressen fra din Apps Script-udrulning herunder.
    // Den giver kun skriveadgang, så den må gerne stå i repoet. Læse-tokenet må ikke.
    endpoint: 'https://script.google.com/macros/s/AKfycbyuCchb-oRLHrRN0nMST0epZyX02BZwy-ldclm9I3jcTYdazqXWZmrZXwHyBxo8e0WX/exec',

    hold: '3526',
    skemaVersion: 1,
    maxTegn: 2000,

    dage: [
      { vaerdi: '1', label: 'Dag 1' },
      { vaerdi: '2', label: 'Dag 2' },
      { vaerdi: '3', label: 'Dag 3' },
      { vaerdi: '4', label: 'Dag 4' },
      { vaerdi: 'samlet', label: 'Samlet evaluering' }
    ],

    // Stilles hver dag. ikkePaaDage skjuler et felt uden at fjerne kolonnen.
    faelles: [
      {
        id: 'anvendelighed_1_10', type: 'skala10', paakraevet: true,
        tekst: 'På en skala fra 1 til 10: hvor meget af det, du har lavet i dag, kan du bruge i dit arbejde inden for de næste 14 dage?',
        lavLabel: 'Intet af det', hoejLabel: 'Næsten det hele'
      },
      {
        id: 'tempo', type: 'valg', paakraevet: true,
        tekst: 'Hvordan var tempoet i dag?',
        valg: ['For langsomt', 'Passende', 'For hurtigt']
      },
      {
        id: 'kan_selv', type: 'valg', paakraevet: true,
        tekst: 'Kunne du gøre dagens vigtigste øvelse igen i morgen — alene?',
        valg: ['Ja, på egen hånd', 'Ja, hvis jeg har siden eller mine noter ved hånden', 'Nej, ikke endnu']
      },
      {
        id: 'brugt_siden_sidst', type: 'valg', paakraevet: true, ikkePaaDage: ['1'],
        tekst: 'Har du brugt noget fra sidste kursusdag på dit arbejde siden da?',
        valg: ['Ja, flere gange', 'Ja, én gang', 'Nej, jeg nåede det ikke', 'Nej, jeg vidste ikke hvad jeg skulle bruge det til']
      },
      {
        id: 'bedste_ting', type: 'tekst', paakraevet: true, ikkePaaDage: ['samlet'],
        tekst: 'Nævn én konkret ting fra i dag, du vil bruge først — og hvad du vil bruge den til.'
      },
      {
        id: 'gik_i_staa', type: 'tekst', paakraevet: true, ikkePaaDage: ['samlet'],
        tekst: 'Hvor gik du i stå i dag, eller hvad forstod du ikke?',
        hjaelp: 'Skriv gerne præcis hvilket trin eller hvilket ord. Skriv "ingenting", hvis alt sad lige i skabet.'
      },
      {
        id: 'en_aendring', type: 'tekst', paakraevet: true,
        tekst: 'Nævn én ting, jeg skal gøre anderledes næste kursusdag.'
      },
      {
        id: 'noget_andet', type: 'tekst', paakraevet: false, sidst: true,
        tekst: 'Noget andet, jeg skal vide?'
      },
      {
        id: 'kontakt_navn', type: 'kortTekst', paakraevet: false, sidst: true,
        tekst: 'Dit navn',
        // Kontaktfelterne staar allersidst med vilje: er svarene skrevet
        // foerst, farver navnefeltet ikke det, man toer skrive.
        foerTekst: 'Du må meget gerne være anonym — svarene er lige så værdifulde, ' +
          'og de fleste udfylder ikke det her. Men skriver du navn og mail, kan jeg ' +
          'vende tilbage, hvis du har stillet et spørgsmål, eller hvis du har nævnt ' +
          'noget, jeg gerne vil høre mere om.',
        foerLabel: 'Vil du gerne have svar?'
      },
      {
        id: 'kontakt_mail', type: 'kortTekst', paakraevet: false, sidst: true,
        tekst: 'Din mail'
      }
    ],

    perDag: {
      '1': [
        {
          id: 'dag1_sikkerhed', type: 'valg', paakraevet: true,
          tekst: 'Efter i dag: hvor sikker er du på, hvad en sprogmodel egentlig gør, når den svarer?',
          valg: ['Jeg kunne forklare det for en kollega', 'Jeg har fat i det, men ikke skarpt', 'Stadig ret uklart']
        },
        {
          id: 'dag1_tvivl', type: 'tekst', paakraevet: false,
          tekst: 'Hvad var du mest i tvivl om, da du gik hjem?'
        }
      ],
      '2': [
        {
          id: 'dag2_bedste_oevelse', type: 'valg', paakraevet: true,
          tekst: 'Hvilken af dagens øvelser gav dig mest?',
          valg: ['Billedøvelsen', 'Musikøvelsen', 'Begge lige meget', 'Ingen af dem']
        },
        {
          id: 'dag2_skepsis', type: 'tekst', paakraevet: false,
          tekst: 'Hvad tager du med fra snakken om etik og ophavsret — noget du vil gøre anderledes på jobbet?'
        }
      ],
      '3': [
        {
          id: 'dag3_eksempler', type: 'valg', paakraevet: true,
          tekst: 'Hvor godt passede dagens eksempler til dit eget fag?',
          valg: ['Meget godt', 'Nogenlunde', 'Ramte ved siden af']
        },
        {
          id: 'dag3_bedre_eksempel', type: 'tekst', paakraevet: false,
          tekst: 'Hvilket eksempel fra dit eget arbejde skulle jeg have brugt i stedet?'
        }
      ],
      '4': [
        {
          id: 'dag4_proeveklar', type: 'valg', paakraevet: true,
          tekst: 'Hvor klar føler du dig til prøven?',
          valg: ['Klar', 'Jeg mangler at få styr på et par ting', 'Slet ikke klar']
        },
        {
          id: 'dag4_mangler', type: 'tekst', paakraevet: false,
          tekst: 'Hvad mangler du helt konkret, før du er klar til prøven?'
        }
      ],
      'samlet': [
        {
          id: 'samlet_resultat', type: 'tekst', paakraevet: true,
          tekst: 'Hvad har du konkret lavet eller ændret på dit arbejde, som du ikke havde gjort uden kurset?'
        },
        {
          id: 'samlet_bedste_dag', type: 'valg', paakraevet: true,
          tekst: 'Hvilken kursusdag gav dig mest?',
          valg: ['Dag 1', 'Dag 2', 'Dag 3', 'Dag 4']
        },
        {
          id: 'samlet_manglede', type: 'tekst', paakraevet: false,
          tekst: 'Hvad manglede der, som du havde forventet eller håbet på?'
        },
        {
          id: 'samlet_droppes', type: 'tekst', paakraevet: false,
          tekst: 'Hvad kunne vi have droppet, uden at du havde mistet noget?'
        },
        {
          id: 'samlet_anbefaling', type: 'valg', paakraevet: true,
          tekst: 'Ville du anbefale kurset til en kollega med samme job som dig?',
          valg: ['Ja', 'Måske', 'Nej']
        },
        {
          id: 'samlet_hvorfor', type: 'tekst', paakraevet: true,
          tekst: 'Hvorfor det svar?'
        },
        {
          id: 'samlet_proeven', type: 'valg', paakraevet: true,
          tekst: 'Hvor klar føler du dig til prøven?',
          valg: ['Klar', 'Mangler et par ting', 'Slet ikke klar']
        },
        {
          id: 'samlet_citat_ok', type: 'afkrydsning', paakraevet: false,
          tekst: 'Jeg må gerne citeres anonymt fra mine svar i en kursusbeskrivelse.'
        }
      ]
    },

    // Ordlyd der afviger på den samlede evaluering. Samme id, samme kolonne.
    overskriv: {
      'samlet': {
        anvendelighed_1_10: 'På en skala fra 1 til 10: hvor meget af hele kurset kan du bruge i dit arbejde?',
        tempo: 'Hvordan var tempoet i kurset som helhed?',
        kan_selv: 'Kunne du selv køre kursets vigtigste øvelser igen — alene?',
        en_aendring: 'Nævn den ene vigtigste ting, jeg skal ændre til næste hold.',
        brugt_siden_sidst: 'Har du brugt noget fra kurset på dit arbejde undervejs?'
      }
    }
  };

  var KLADDE_PRAEFIKS = 'ai-i-praksis:evaluering:' + EVAL_KONFIG.hold + ':';
  var KLADDE_LEVETID = 24 * 60 * 60 * 1000;

  var valgtDag = null;
  var svarState = {};
  var svarId = null;
  var gemTimer = null;
  var sidsteNyttelast = null;

  var vaelgerHolder = document.getElementById('dag-vaelger');
  var formHolder = document.getElementById('eval-form-holder');
  var statusBoks = document.getElementById('eval-status');
  var kladdeLinje = document.getElementById('eval-kladde');

  if (!vaelgerHolder || !formHolder || !statusBoks) return;

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
   * Slår en dag op i konfigurationen.
   * @param {string} vaerdi Dagens værdi, fx "2" eller "samlet".
   * @returns {Object|null} Dagsobjektet, eller null hvis værdien er ukendt.
   */
  function findDag(vaerdi) {
    for (var i = 0; i < EVAL_KONFIG.dage.length; i++) {
      if (EVAL_KONFIG.dage[i].vaerdi === vaerdi) return EVAL_KONFIG.dage[i];
    }
    return null;
  }

  /**
   * Læser den ønskede dag fra adressen. Ugyldige eller manglende værdier giver
   * null, så deltageren får vælgeren i stedet for en tilfældig dag — en forkert
   * dag i regnearket er værre end et ekstra klik.
   * @returns {string|null} Dagens værdi, eller null.
   */
  function laesDagFraAdresse() {
    var raa = null;
    try {
      raa = new URLSearchParams(window.location.search).get('dag');
    } catch (fejl) {
      var match = window.location.search.match(/[?&]dag=([^&]*)/);
      raa = match ? decodeURIComponent(match[1]) : null;
    }
    if (!raa) return null;
    var dag = findDag(raa);
    return dag ? dag.vaerdi : null;
  }

  /**
   * Genererer et id for besvarelsen. Id'et laves én gang pr. kladde, ikke pr.
   * afsendelse, så en gentaget afsendelse kan kasseres som dublet serverside.
   * @returns {string} Et rimeligt unikt id.
   */
  function nytSvarId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * Samler de felter der skal vises for en given dag, med den ordlyd dagen
   * kræver. Valgfri fritekst placeres til sidst.
   * @param {string} dag Dagens værdi.
   * @returns {Object[]} Felterne i visningsrækkefølge.
   */
  function felterForDag(dag) {
    var overskriv = EVAL_KONFIG.overskriv[dag] || {};
    var faelles = EVAL_KONFIG.faelles.filter(function (felt) {
      return !(felt.ikkePaaDage && felt.ikkePaaDage.indexOf(dag) !== -1);
    });
    var alle = faelles.concat(EVAL_KONFIG.perDag[dag] || []);

    var sidst = alle.filter(function (f) { return f.sidst; });
    var resten = alle.filter(function (f) { return !f.sidst; });

    return resten.concat(sidst).map(function (felt) {
      if (!overskriv[felt.id]) return felt;
      var kopi = {};
      for (var n in felt) { if (felt.hasOwnProperty(n)) kopi[n] = felt[n]; }
      kopi.tekst = overskriv[felt.id];
      return kopi;
    });
  }

  /* ---------- Kladde ---------- */

  /**
   * Nøglen til dagens kladde. Én nøgle pr. dag, så en halvfærdig dag 2 ikke
   * overskrives af dag 3.
   * @param {string} dag Dagens værdi.
   * @returns {string} localStorage-nøglen.
   */
  function kladdeNoegle(dag) {
    return KLADDE_PRAEFIKS + dag;
  }

  /**
   * Gemmer de indtastede svar lokalt, så en genindlæsning ikke koster arbejde.
   * Fejler stille i privat browsing, hvor localStorage kan kaste.
   */
  function gemKladde() {
    if (!valgtDag) return;
    try {
      window.localStorage.setItem(kladdeNoegle(valgtDag), JSON.stringify({
        gemt: Date.now(),
        svar_id: svarId,
        svar: svarState
      }));
    } catch (fejl) { /* ingen kladde er bedre end en fejlbesked */ }
  }

  /**
   * Henter dagens kladde, hvis den findes og er under et døgn gammel.
   * @param {string} dag Dagens værdi.
   * @returns {Object|null} Kladden, eller null.
   */
  function hentKladde(dag) {
    try {
      var raa = window.localStorage.getItem(kladdeNoegle(dag));
      if (!raa) return null;
      var kladde = JSON.parse(raa);
      if (!kladde || !kladde.gemt || Date.now() - kladde.gemt > KLADDE_LEVETID) return null;
      return kladde;
    } catch (fejl) {
      return null;
    }
  }

  /**
   * Sletter dagens kladde.
   * @param {string} dag Dagens værdi.
   */
  function rydKladde(dag) {
    try { window.localStorage.removeItem(kladdeNoegle(dag)); } catch (fejl) { /* ingenting */ }
  }

  /** Gemmer kladden med en kort forsinkelse, så hvert tastetryk ikke skriver. */
  function gemKladdeSnart() {
    if (gemTimer) window.clearTimeout(gemTimer);
    gemTimer = window.setTimeout(gemKladde, 400);
  }

  /* ---------- Dagsvælger ---------- */

  /**
   * Tegner chip-knapperne til valg af kursusdag.
   */
  function tegnDagVaelger() {
    vaelgerHolder.innerHTML = '';
    var raekke = el('div', 'valg-raekke dag-vaelger');
    raekke.setAttribute('role', 'radiogroup');
    raekke.setAttribute('aria-label', 'Hvilken dag evaluerer du?');

    EVAL_KONFIG.dage.forEach(function (dag) {
      var label = el('label', 'valg');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'dag';
      input.value = dag.vaerdi;
      input.checked = dag.vaerdi === valgtDag;
      input.addEventListener('change', function () {
        if (input.checked) vaelgDag(dag.vaerdi, true);
      });
      label.appendChild(input);
      label.appendChild(el('span', 'valg-boks', dag.label));
      raekke.appendChild(label);
    });

    vaelgerHolder.appendChild(raekke);
  }

  /**
   * Skifter til en ny dag: bevarer de fælles svar, rydder de dagsspecifikke,
   * opdaterer adressen og tegner formularen igen.
   * @param {string} dag Dagens værdi.
   * @param {boolean} [fraKlik] Sandt hvis deltageren selv skiftede dag.
   */
  function vaelgDag(dag, fraKlik) {
    var faellesIder = EVAL_KONFIG.faelles.map(function (f) { return f.id; });
    var bevaret = {};
    faellesIder.forEach(function (id) {
      if (svarState[id] !== undefined) bevaret[id] = svarState[id];
    });

    valgtDag = dag;
    svarState = bevaret;
    svarId = nytSvarId();

    var kladde = hentKladde(dag);
    if (kladde && kladde.svar) {
      for (var id in kladde.svar) {
        if (kladde.svar.hasOwnProperty(id)) svarState[id] = kladde.svar[id];
      }
      if (kladde.svar_id) svarId = kladde.svar_id;
      visKladdeLinje(true);
    } else {
      visKladdeLinje(false);
    }

    try {
      window.history.replaceState(null, '', 'evaluering.html?dag=' + encodeURIComponent(dag));
    } catch (fejl) { /* replaceState virker ikke over file:// */ }

    ryddStatus();
    tegnDagVaelger();
    tegnForm();

    if (fraKlik && formHolder.firstChild) {
      formHolder.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Viser eller skjuler linjen om, at en påbegyndt besvarelse er hentet frem.
   * @param {boolean} vis Sandt hvis linjen skal vises.
   */
  function visKladdeLinje(vis) {
    if (!kladdeLinje) return;
    kladdeLinje.innerHTML = '';
    kladdeLinje.hidden = !vis;
    if (!vis) return;

    kladdeLinje.appendChild(document.createTextNode('Vi har hentet dine påbegyndte svar frem. '));
    var knap = el('button', 'knap-tekst', 'Ryd dem og start forfra');
    knap.type = 'button';
    knap.addEventListener('click', function () {
      rydKladde(valgtDag);
      svarState = {};
      svarId = nytSvarId();
      visKladdeLinje(false);
      tegnForm();
    });
    kladdeLinje.appendChild(knap);
  }

  /* ---------- Formularen ---------- */

  /**
   * Bygger ét spørgsmålsfelt som et fieldset med legend, input og fejlplads.
   * @param {Object} felt Feltets definition fra konfigurationen.
   * @returns {HTMLElement} Det færdige fieldset.
   */
  function byggFelt(felt) {
    var saet = el('fieldset', 'eval-felt');
    saet.setAttribute('data-id', felt.id);

    var legend = el('legend', null, felt.tekst);
    if (!felt.paakraevet) {
      legend.appendChild(el('span', 'eval-valgfri', ' (valgfrit)'));
    }
    saet.appendChild(legend);

    if (felt.hjaelp) saet.appendChild(el('p', 'eval-hjaelp', felt.hjaelp));

    if (felt.type === 'skala10') saet.appendChild(byggSkala(felt));
    else if (felt.type === 'valg') saet.appendChild(byggValg(felt));
    else if (felt.type === 'afkrydsning') saet.appendChild(byggAfkrydsning(felt));
    else if (felt.type === 'kortTekst') saet.appendChild(byggKortTekst(felt));
    else saet.appendChild(byggTekst(felt));

    var fejl = el('p', 'eval-fejl');
    fejl.id = 'fejl-' + felt.id;
    fejl.setAttribute('role', 'alert');
    fejl.hidden = true;
    saet.appendChild(fejl);

    return saet;
  }

  /**
   * Bygger en radiogruppe med chip-knapper.
   * @param {Object} felt Feltets definition.
   * @returns {HTMLElement} Rækken af valgmuligheder.
   */
  function byggValg(felt) {
    var raekke = el('div', 'valg-raekke');
    felt.valg.forEach(function (mulighed) {
      var label = el('label', 'valg');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = felt.id;
      input.value = mulighed;
      input.checked = svarState[felt.id] === mulighed;
      input.addEventListener('change', function () {
        if (!input.checked) return;
        svarState[felt.id] = mulighed;
        fjernFejl(felt.id);
        gemKladdeSnart();
      });
      label.appendChild(input);
      label.appendChild(el('span', 'valg-boks', mulighed));
      raekke.appendChild(label);
    });
    return raekke;
  }

  /**
   * Bygger skalaen fra 1 til 10 med etiketter i hver ende.
   * @param {Object} felt Feltets definition.
   * @returns {HTMLElement} Skalaen pakket ind sammen med sine endetekster.
   */
  function byggSkala(felt) {
    var pakke = el('div');
    var raekke = el('div', 'valg-raekke skala');

    for (var tal = 1; tal <= 10; tal++) {
      var vaerdi = String(tal);
      var label = el('label', 'valg');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = felt.id;
      input.value = vaerdi;
      input.checked = svarState[felt.id] === vaerdi;
      input.setAttribute('aria-label', vaerdi + ' ud af 10');
      // Både feltet og værdien skal fanges her: var er funktionsscoped, så en
      // handler der kigger på det ydre input ville altid ramme det sidste tal.
      (function (knap, v) {
        knap.addEventListener('change', function () {
          if (!knap.checked) return;
          svarState[felt.id] = v;
          fjernFejl(felt.id);
          gemKladdeSnart();
        });
      }(input, vaerdi));
      label.appendChild(input);
      label.appendChild(el('span', 'valg-boks', vaerdi));
      raekke.appendChild(label);
    }

    pakke.appendChild(raekke);
    var ender = el('div', 'skala-ender');
    ender.appendChild(el('span', null, '1 — ' + (felt.lavLabel || 'Slet ikke')));
    ender.appendChild(el('span', null, '10 — ' + (felt.hoejLabel || 'I høj grad')));
    pakke.appendChild(ender);
    return pakke;
  }

  /**
   * Bygger et fritekstfelt.
   * @param {Object} felt Feltets definition.
   * @returns {HTMLElement} Tekstfeltet.
   */
  function byggTekst(felt) {
    var omraade = document.createElement('textarea');
    omraade.name = felt.id;
    omraade.id = 'felt-' + felt.id;
    omraade.rows = 3;
    omraade.value = svarState[felt.id] || '';
    omraade.setAttribute('aria-describedby', 'fejl-' + felt.id);
    omraade.addEventListener('input', function () {
      svarState[felt.id] = omraade.value;
      fjernFejl(felt.id);
      gemKladdeSnart();
    });
    return omraade;
  }

  /**
   * Bygger et kort tekstfelt på én linje, brugt til navn og mail.
   * @param {Object} felt Feltets definition.
   * @returns {HTMLElement} Inputfeltet.
   */
  function byggKortTekst(felt) {
    var input = document.createElement('input');
    input.type = felt.id === 'kontakt_mail' ? 'email' : 'text';
    input.name = felt.id;
    input.id = 'felt-' + felt.id;
    input.className = 'eval-kort';
    input.autocomplete = felt.id === 'kontakt_mail' ? 'email' : 'name';
    input.value = svarState[felt.id] || '';
    input.setAttribute('aria-describedby', 'fejl-' + felt.id);
    input.addEventListener('input', function () {
      svarState[felt.id] = input.value;
      fjernFejl(felt.id);
      gemKladdeSnart();
    });
    return input;
  }

  /**
   * Bygger et enkelt afkrydsningsfelt, fx samtykke til citat.
   * @param {Object} felt Feltets definition.
   * @returns {HTMLElement} Afkrydsningsfeltet med sin etiket.
   */
  function byggAfkrydsning(felt) {
    var label = el('label', 'eval-afkryds');
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.name = felt.id;
    input.checked = svarState[felt.id] === 'ja';
    input.addEventListener('change', function () {
      svarState[felt.id] = input.checked ? 'ja' : 'nej';
      gemKladdeSnart();
    });
    label.appendChild(input);
    label.appendChild(el('span', null, 'Ja tak'));
    return label;
  }

  /**
   * Tegner hele formularen for den valgte dag. Uden en valgt dag vises intet,
   * så ingen kan komme til at indsende svar uden dag.
   */
  function tegnForm() {
    formHolder.innerHTML = '';
    if (!valgtDag) return;

    var dag = findDag(valgtDag);
    var form = el('form', 'eval-form');
    form.noValidate = true;

    var opsamling = el('div', 'eval-opsamling');
    opsamling.setAttribute('role', 'alert');
    opsamling.hidden = true;
    form.appendChild(opsamling);

    felterForDag(valgtDag).forEach(function (felt) {
      if (felt.foerTekst) {
        var intro = el('div', 'explain eval-intro');
        if (felt.foerLabel) intro.appendChild(el('span', 'label', felt.foerLabel));
        intro.appendChild(el('p', null, felt.foerTekst));
        form.appendChild(intro);
      }
      form.appendChild(byggFelt(felt));
    });

    var knapper = el('div', 'eval-knapper');
    var send = el('button', 'knap knap-primaer', 'Send min evaluering');
    send.type = 'submit';
    knapper.appendChild(send);
    knapper.appendChild(el('span', 'eval-hjaelp', 'Du bestemmer selv, om du vil skrive navn og mail.'));
    form.appendChild(knapper);

    form.addEventListener('submit', function (haendelse) {
      haendelse.preventDefault();
      indsend(form, opsamling, send, dag);
    });

    formHolder.appendChild(form);
  }

  /* ---------- Validering ---------- */

  /**
   * Fjerner fejlmarkeringen på ét felt.
   * @param {string} id Feltets id.
   */
  function fjernFejl(id) {
    var saet = formHolder.querySelector('[data-id="' + id + '"]');
    if (!saet) return;
    saet.removeAttribute('data-fejl');
    var fejl = saet.querySelector('.eval-fejl');
    if (fejl) { fejl.hidden = true; fejl.textContent = ''; }
    var felt = saet.querySelector('textarea, input.eval-kort');
    if (felt) felt.removeAttribute('aria-invalid');
  }

  /**
   * Markerer ét felt som fejlbehæftet med en dansk forklaring.
   * @param {string} id Feltets id.
   * @param {string} besked Fejlteksten.
   * @returns {HTMLElement|null} Feltets fieldset, så det første kan få fokus.
   */
  function visFejl(id, besked) {
    var saet = formHolder.querySelector('[data-id="' + id + '"]');
    if (!saet) return null;
    saet.setAttribute('data-fejl', 'ja');
    var fejl = saet.querySelector('.eval-fejl');
    if (fejl) { fejl.textContent = besked; fejl.hidden = false; }
    var felt = saet.querySelector('textarea, input.eval-kort');
    if (felt) felt.setAttribute('aria-invalid', 'true');
    return saet;
  }

  /**
   * Kontrollerer alle synlige felter og markerer dem der mangler.
   * @returns {{fejl: number, foerste: HTMLElement|null}} Antal fejl og det første fejlende felt.
   */
  function valider() {
    var antal = 0;
    var foerste = null;

    felterForDag(valgtDag).forEach(function (felt) {
      fjernFejl(felt.id);
      var vaerdi = svarState[felt.id];

      var erTekst = felt.type === 'tekst' || felt.type === 'kortTekst';

      if (erTekst && typeof vaerdi === 'string' && vaerdi.trim().length > EVAL_KONFIG.maxTegn) {
        var forLangt = visFejl(felt.id, 'Skriv gerne kortere — der er plads til ' + EVAL_KONFIG.maxTegn + ' tegn.');
        antal++;
        if (!foerste) foerste = forLangt;
        return;
      }

      if (!felt.paakraevet) return;

      var tom = vaerdi === undefined || vaerdi === null || String(vaerdi).trim() === '';
      if (!tom) return;

      var besked = erTekst
        ? 'Skriv gerne bare én sætning.'
        : (felt.type === 'skala10' ? 'Vælg et tal fra 1 til 10.' : 'Vælg et af svarene.');
      var markeret = visFejl(felt.id, besked);
      antal++;
      if (!foerste) foerste = markeret;
    });

    return { fejl: antal, foerste: foerste };
  }

  /* ---------- Afsendelse ---------- */

  /**
   * Sender ét evalueringssvar. Forsøger først en aflæselig POST, så deltageren
   * kan få en ægte kvittering. Fejler den på grund af CORS eller et mellemled,
   * sendes den igen "blindt": rækken lander stadig, men uden kvittering.
   * Dubletter fanges serverside på svar_id.
   * @param {Object} nyttelast Svarene inklusive svar_id, dag og hold.
   * @returns {Promise<string>} 'ok' eller 'ok-uden-kvittering'.
   */
  function sendSvar(nyttelast) {
    var krop = JSON.stringify(nyttelast);

    // text/plain er CORS-sikker, så der udløses ingen preflight.
    return fetch(EVAL_KONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: krop,
      redirect: 'follow'
    }).then(function (svar) {
      if (!svar.ok) throw new Error('http ' + svar.status);
      return svar.json();
    }).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.fejl) || 'ukendt fejl');
      return 'ok';
    }).catch(function () {
      return fetch(EVAL_KONFIG.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: krop
      }).then(function () { return 'ok-uden-kvittering'; });
    });
  }

  /**
   * Validerer og sender formularen, og viser undervejs den rette tilstand.
   * @param {HTMLFormElement} form Formularen.
   * @param {HTMLElement} opsamling Boksen med den samlede fejlbesked.
   * @param {HTMLButtonElement} send Send-knappen.
   * @param {Object} dag Det valgte dagsobjekt.
   */
  function indsend(form, opsamling, send, dag) {
    var resultat = valider();

    if (resultat.fejl > 0) {
      opsamling.textContent = resultat.fejl === 1
        ? 'Der mangler svar på ét spørgsmål. Det er markeret herunder.'
        : 'Der mangler svar på ' + resultat.fejl + ' spørgsmål. De er markeret herunder.';
      opsamling.hidden = false;
      if (resultat.foerste) {
        resultat.foerste.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var foersteFelt = resultat.foerste.querySelector('textarea, input');
        if (foersteFelt) foersteFelt.focus({ preventScroll: true });
      }
      return;
    }

    opsamling.hidden = true;

    var reneSvar = {};
    felterForDag(valgtDag).forEach(function (felt) {
      var vaerdi = svarState[felt.id];
      if (vaerdi === undefined || vaerdi === null) {
        reneSvar[felt.id] = felt.type === 'afkrydsning' ? 'nej' : '';
      } else {
        reneSvar[felt.id] = typeof vaerdi === 'string' ? vaerdi.trim() : vaerdi;
      }
    });

    sidsteNyttelast = {
      hold: EVAL_KONFIG.hold,
      dag: dag.vaerdi,
      dag_label: dag.label,
      svar_id: svarId,
      skema_version: EVAL_KONFIG.skemaVersion,
      svar: reneSvar
    };

    if (!EVAL_KONFIG.endpoint) {
      visFejlTilstand('Formularen er ikke koblet til endnu. Underviseren mangler at indsætte adressen til datamodtageren.');
      return;
    }

    send.disabled = true;
    send.textContent = 'Sender…';
    visStatus('sender');

    sendSvar(sidsteNyttelast).then(function (udfald) {
      rydKladde(valgtDag);
      formHolder.innerHTML = '';
      if (kladdeLinje) kladdeLinje.hidden = true;
      visKvittering(udfald, dag);
    }).catch(function () {
      send.disabled = false;
      send.textContent = 'Send min evaluering';
      visFejlTilstand('Svaret kunne ikke sendes. Måske er nettet nede et øjeblik.');
    });
  }

  /* ---------- Tilstande ---------- */

  /** Rydder statusboksen. */
  function ryddStatus() {
    statusBoks.innerHTML = '';
  }

  /**
   * Viser en simpel arbejdstilstand.
   * @param {string} tilstand Tilstandens navn.
   */
  function visStatus(tilstand) {
    ryddStatus();
    if (tilstand !== 'sender') return;
    var boks = el('div', 'note');
    boks.appendChild(el('span', 'label', 'Sender'));
    boks.appendChild(document.createTextNode('Dit svar er på vej. Det tager et øjeblik.'));
    statusBoks.appendChild(boks);
  }

  /**
   * Viser kvitteringen efter en gennemført afsendelse.
   * @param {string} udfald 'ok' eller 'ok-uden-kvittering'.
   * @param {Object} dag Det dagsobjekt der blev evalueret.
   */
  function visKvittering(udfald, dag) {
    ryddStatus();
    var boks = el('div', 'exercise');
    boks.appendChild(el('span', 'label', 'Tak'));

    if (udfald === 'ok') {
      boks.appendChild(el('p', null, 'Dit svar på ' + dag.label.toLowerCase() + ' er registreret. Tak — det bliver læst, og det bliver brugt.'));
    } else {
      boks.appendChild(el('p', null, 'Dit svar er sendt. Vi kunne ikke få en kvittering retur, men det er registreret. Bliver du i tvivl, så send igen — dobbelte svar bliver kasseret automatisk.'));
    }

    var retur = el('p');
    var link = el('a', null, 'Tilbage til forsiden');
    link.href = 'index.html';
    retur.appendChild(link);
    boks.appendChild(retur);

    statusBoks.appendChild(boks);
    statusBoks.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Viser fejltilstanden med mulighed for at prøve igen eller kopiere svarene.
   * @param {string} besked Den forklarende tekst.
   */
  function visFejlTilstand(besked) {
    ryddStatus();
    var boks = el('div', 'note');
    boks.appendChild(el('span', 'label', 'Svaret blev ikke sendt'));
    boks.appendChild(el('p', null, besked + ' Dine svar står der stadig, og de er gemt her på maskinen.'));

    var knapper = el('div', 'eval-knapper');

    var igen = el('button', 'knap', 'Prøv igen');
    igen.type = 'button';
    igen.addEventListener('click', function () {
      var form = formHolder.querySelector('form');
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    knapper.appendChild(igen);

    var kopi = el('button', 'knap', 'Kopiér mine svar som tekst');
    kopi.type = 'button';
    kopi.addEventListener('click', function () {
      var tekst = svarSomTekst();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tekst).then(function () {
          kopi.textContent = 'Kopieret ✓';
          window.setTimeout(function () { kopi.textContent = 'Kopiér mine svar som tekst'; }, 2000);
        }).catch(function () { /* tekstfeltet nedenfor er stadig der */ });
      }
      var felt = boks.querySelector('.eval-kopi');
      if (!felt) {
        felt = document.createElement('textarea');
        felt.className = 'eval-kopi';
        felt.readOnly = true;
        boks.appendChild(el('p', 'eval-hjaelp', 'Send teksten til underviseren, eller gem den til i morgen.'));
        boks.appendChild(felt);
      }
      felt.value = tekst;
      felt.select();
    });
    knapper.appendChild(kopi);

    boks.appendChild(knapper);
    statusBoks.appendChild(boks);
    statusBoks.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * Skriver de indtastede svar ud som ren tekst, så de kan gemmes eller sendes
   * manuelt, hvis afsendelsen ikke lykkes.
   * @returns {string} Spørgsmål og svar i læsbar form.
   */
  function svarSomTekst() {
    var dag = findDag(valgtDag);
    var linjer = ['Evaluering — ' + (dag ? dag.label : ''), 'Hold ' + EVAL_KONFIG.hold, ''];
    felterForDag(valgtDag).forEach(function (felt) {
      var vaerdi = svarState[felt.id];
      if (vaerdi === undefined || vaerdi === null || String(vaerdi).trim() === '') return;
      linjer.push('Spørgsmål: ' + felt.tekst);
      linjer.push('Svar: ' + String(vaerdi).trim());
      linjer.push('');
    });
    return linjer.join('\n');
  }

  /* ---------- Start ---------- */

  tegnDagVaelger();
  var fraAdressen = laesDagFraAdresse();
  if (fraAdressen) {
    vaelgDag(fraAdressen, false);
  }

  window.addEventListener('beforeunload', function () {
    if (gemTimer) { window.clearTimeout(gemTimer); gemKladde(); }
  });
}());
