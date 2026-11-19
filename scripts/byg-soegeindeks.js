#!/usr/bin/env node
/**
 * Bygger søgeindekset soegeindeks.json til søgefunktionen (soeg.js).
 *
 * Indekset indeholder ét dokument pr. afsnit på siderne, pr. afsnit i
 * Markdown-materialerne og pr. side eller dias i de PDF'er, siderne linker til.
 * Kun materialer, der kan nås via links fra deltagersiderne, kommer med.
 * Undervisersiden og alt, der kun linkes derfra, holdes ude.
 *
 * PDF-tekst udtrækkes med pdftotext (Poppler). Teksten gemmes i
 * scripts/soegeindeks-pdf-cache.json, så indekset kan bygges uden pdftotext,
 * så længe PDF'erne ikke er ændret.
 *
 * Kør:  node scripts/byg-soegeindeks.js          (skriver soegeindeks.json)
 *       node scripts/byg-soegeindeks.js --tjek   (fejler, hvis indekset er forældet)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROD = path.resolve(__dirname, '..');
const INDEKSFIL = path.join(ROD, 'soegeindeks.json');
const CACHEFIL = path.join(__dirname, 'soegeindeks-pdf-cache.json');
const TJEK = process.argv.includes('--tjek');

// Sider, der ikke er for deltagerne eller ikke har eget indhold.
const UDELAD_SIDER = new Set(['underviser.html', 'resultater.html', 'markdown.html', 'evaluering.html']);

const ENTITETER = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…',
  ndash: '–', mdash: '—', rarr: '→', larr: '←', laquo: '«', raquo: '»', shy: '',
  aelig: 'æ', oslash: 'ø', aring: 'å', AElig: 'Æ', Oslash: 'Ø', Aring: 'Å', times: '×', copy: '©'
};

/**
 * Oversætter HTML-entiteter til almindelige tegn.
 * @param {string} tekst Tekst med entiteter.
 * @returns {string} Afkodet tekst.
 */
function afkod(tekst) {
  return tekst.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (hel, navn) {
    if (navn[0] === '#') {
      const kode = navn[1].toLowerCase() === 'x' ? parseInt(navn.slice(2), 16) : parseInt(navn.slice(1), 10);
      return String.fromCodePoint(kode);
    }
    return Object.prototype.hasOwnProperty.call(ENTITETER, navn) ? ENTITETER[navn] : hel;
  });
}

/**
 * Samler mellemrum og linjeskift til ét mellemrum.
 * @param {string} tekst Rå tekst.
 * @returns {string} Ryddet tekst.
 */
function ryd(tekst) {
  return tekst.replace(/\s+/g, ' ').trim();
}

/**
 * Fjerner alle tags og returnerer den læsbare tekst.
 * @param {string} html HTML-udsnit.
 * @returns {string} Ren tekst.
 */
function htmlTilTekst(html) {
  return ryd(afkod(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|canvas|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')));
}

/**
 * Laver et anker-id af en overskrift. Samme regel bruges i markdown.html.
 * @param {string} tekst Overskriftens tekst.
 * @returns {string} Id med små bogstaver og bindestreger.
 */
function slug(tekst) {
  return tekst.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'afsnit';
}

/**
 * Koder en filsti til brug i et link, én del ad gangen.
 * @param {string} sti Filsti med skråstreger.
 * @returns {string} URL-kodet sti.
 */
function kodSti(sti) {
  return sti.split('/').map(encodeURIComponent).join('/');
}

/**
 * Finder en lokal fil ud fra et link og den fil, linket står i.
 * @param {string} href Linkets adresse.
 * @param {string} fraMappe Mappen med filen, linket står i, relativt til roden.
 * @returns {string|null} Sti relativt til roden, eller null for eksterne links.
 */
function lokalSti(href, fraMappe) {
  if (!href || /^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('//')) return null;
  let ren = href.split('#')[0].split('?')[0];
  try { ren = decodeURIComponent(ren); } catch (fejl) { /* behold rå */ }
  const sti = path.posix.normalize(path.posix.join(fraMappe, ren));
  if (sti.startsWith('..')) return null;
  return fs.existsSync(path.join(ROD, sti)) ? sti : null;
}

/**
 * Giver en kort dagsbetegnelse ud fra en sti, fx "Dag 4".
 * @param {string} sti Filsti.
 * @returns {string} Dagsbetegnelse eller tom tekst.
 */
function dagAf(sti) {
  const m = sti.match(/Ai-i-praksis-dag(\d)/);
  return m ? 'Dag ' + m[1] : '';
}

const docs = [];
const mdFundet = new Map();   // sti -> linktekst
const pdfFundet = new Map();  // sti -> { titel, kontekst }
const diasshows = new Map();  // pdf-sti -> { side, sektion, kontekst }

/**
 * Tilføjer ét søgedokument.
 * @param {object} d Dokumentets felter.
 */
function tilfoej(d) {
  if (!d.x || d.x.split(' ').length < 3) return;
  const doc = { id: docs.length, t: d.t, k: d.k, u: d.u, y: d.y };
  if (d.h) doc.h = d.h;
  doc.x = d.x;
  if (d.b) doc.b = 1;
  docs.push(doc);
}

/**
 * Registrerer links til Markdown og PDF i et HTML-udsnit.
 * @param {string} html HTML-udsnit.
 * @param {string} kontekst Hvor linket står, fx "Dag 4".
 */
function samlLinks(html, kontekst) {
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const sti = lokalSti(afkod(m[1]), '.');
    if (!sti) continue;
    const tekst = htmlTilTekst(m[2]);
    if (sti.endsWith('.md') && !mdFundet.has(sti)) mdFundet.set(sti, tekst);
    if (sti.toLowerCase().endsWith('.pdf') && !pdfFundet.has(sti)) pdfFundet.set(sti, { titel: tekst, kontekst: kontekst });
  }
}

// ---------- Sider ----------

const sider = fs.readdirSync(ROD).filter(function (f) {
  return f.endsWith('.html') && !UDELAD_SIDER.has(f);
}).sort();

sider.forEach(function (fil) {
  const html = fs.readFileSync(path.join(ROD, fil), 'utf8');
  const titelMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  let sidenavn = titelMatch ? htmlTilTekst(titelMatch[1]) : fil;
  if (fil === 'index.html') sidenavn = 'Forside';
  const main = (html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [null, html])[1];

  const hero = main.match(/<header\b[^>]*class="hero[^"]*"[^>]*>([\s\S]*?)<\/header>/i);
  if (hero) {
    const h1 = hero[1].match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
    tilfoej({ t: h1 ? htmlTilTekst(h1[1]) : sidenavn, k: sidenavn, u: fil, y: 'side', x: htmlTilTekst(hero[1]) });
  }

  const sektionRe = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  let s;
  while ((s = sektionRe.exec(main))) {
    const idMatch = s[1].match(/\bid="([^"]+)"/);
    const id = idMatch ? idMatch[1] : '';
    const krop = s[2];
    const h2 = krop.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i) || krop.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const titel = h2 ? htmlTilTekst(h2[1]) : sidenavn;
    const underoverskrifter = [];
    const hRe = /<h[34]\b[^>]*>([\s\S]*?)<\/h[34]>/gi;
    let h;
    while ((h = hRe.exec(krop))) underoverskrifter.push(htmlTilTekst(h[1]));
    samlLinks(krop, sidenavn);

    const show = krop.match(/data-pdf-slideshow[^>]*data-pdf="([^"]+)"/i);
    if (show) {
      const pdfSti = lokalSti(afkod(show[1]), '.');
      if (pdfSti && id) diasshows.set(pdfSti, { side: fil, sektion: id, kontekst: sidenavn + ' · ' + titel });
    }

    tilfoej({
      t: titel,
      k: sidenavn,
      u: fil + (id ? '#' + id : ''),
      y: 'side',
      h: underoverskrifter.filter(function (x) { return x !== titel; }).join(' · '),
      x: htmlTilTekst(krop)
    });
  }
});

// ---------- Markdown ----------

/**
 * Fjerner Markdown-syntaks fra en linje, så kun den læsbare tekst er tilbage.
 * @param {string} linje Markdown-tekst.
 * @returns {string} Ren tekst.
 */
function mdTilTekst(linje) {
  return htmlTilTekst(linje
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, '$1$2')
    .replace(/^\s{0,3}(>\s?)+/, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
}

const mdKoe = Array.from(mdFundet.keys());
const mdBehandlet = new Set();

while (mdKoe.length) {
  const sti = mdKoe.shift();
  if (mdBehandlet.has(sti)) continue;
  mdBehandlet.add(sti);
  const raa = fs.readFileSync(path.join(ROD, sti), 'utf8');
  const mappe = path.posix.dirname(sti);

  // Links videre til andre materialer.
  const linkRe = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let lm;
  while ((lm = linkRe.exec(raa))) {
    const maal = lokalSti(lm[1], mappe);
    if (!maal) continue;
    if (maal.endsWith('.md') && !mdBehandlet.has(maal)) mdKoe.push(maal);
    if (maal.toLowerCase().endsWith('.pdf') && !pdfFundet.has(maal)) {
      pdfFundet.set(maal, { titel: path.posix.basename(maal, '.pdf'), kontekst: dagAf(maal) || 'Materiale' });
    }
  }

  const url = 'markdown.html?file=' + encodeURIComponent(sti);
  let titel = path.posix.basename(sti, '.md');
  const brugte = {};
  const afsnit = [];
  let aktuelt = { titel: '', anker: '', h: [], x: [] };
  let iKode = false;

  raa.split(/\r?\n/).forEach(function (linje) {
    if (/^\s*(```|~~~)/.test(linje)) { iKode = !iKode; return; }
    const hm = !iKode && linje.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!hm) { aktuelt.x.push(iKode ? linje : mdTilTekst(linje)); return; }
    const niveau = hm[1].length;
    const tekst = mdTilTekst(hm[2]);
    if (niveau === 1) { titel = tekst; return; }
    // Samme nummerering af dubletter som markdown.html, der giver alle h2-h6 et id.
    let anker = slug(tekst);
    if (brugte[anker]) { brugte[anker] += 1; anker = anker + '-' + brugte[anker]; } else { brugte[anker] = 1; }
    if (niveau === 2) {
      afsnit.push(aktuelt);
      aktuelt = { titel: tekst, anker: anker, h: [], x: [] };
    } else {
      aktuelt.h.push(tekst);
      aktuelt.x.push(tekst);
    }
  });
  afsnit.push(aktuelt);

  const kontekst = 'Materiale' + (dagAf(sti) ? ' · ' + dagAf(sti) : '') + ' · ' + titel;
  afsnit.forEach(function (a) {
    tilfoej({
      t: a.titel || titel,
      k: kontekst,
      u: url + (a.anker ? '#' + a.anker : ''),
      y: 'materiale',
      h: a.h.join(' · '),
      x: ryd(a.x.join(' '))
    });
  });
}

// ---------- PDF ----------

let cache = {};
if (fs.existsSync(CACHEFIL)) cache = JSON.parse(fs.readFileSync(CACHEFIL, 'utf8'));
const nyCache = {};
let harPdftotext = true;
const advarsler = [];

/**
 * Henter teksten pr. side i en PDF, fra cachen eller med pdftotext.
 * @param {string} sti PDF'ens sti relativt til roden.
 * @returns {string[]} Teksten pr. side.
 */
function pdfSider(sti) {
  const fuld = path.join(ROD, sti);
  const hash = crypto.createHash('sha1').update(fs.readFileSync(fuld)).digest('hex');
  if (cache[sti] && cache[sti].sha1 === hash) {
    nyCache[sti] = cache[sti];
    return cache[sti].sider;
  }
  if (harPdftotext) {
    try {
      const ud = execFileSync('pdftotext', ['-enc', 'UTF-8', fuld, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const sider = ud.split('\f').map(function (side) { return side.replace(/[ \t]+\n/g, '\n').trim(); });
      if (sider.length && !sider[sider.length - 1]) sider.pop();
      nyCache[sti] = { sha1: hash, sider: sider };
      return sider;
    } catch (fejl) {
      if (fejl.code === 'ENOENT') harPdftotext = false;
      else throw fejl;
    }
  }
  if (cache[sti]) {
    advarsler.push(sti + ' er ændret, men pdftotext findes ikke. Den gamle tekst bruges.');
    nyCache[sti] = cache[sti];
    return cache[sti].sider;
  }
  advarsler.push(sti + ' kunne ikke læses, fordi pdftotext ikke findes. Den er ikke med i søgningen.');
  return [];
}

/**
 * Finder første meningsfulde linje på en side, til brug som titel.
 * @param {string} tekst Sidens tekst med linjeskift.
 * @returns {string} Den første linje, højst 90 tegn.
 */
function foersteLinje(tekst) {
  const linjer = tekst.split('\n').map(ryd).filter(function (l) { return l.length > 2 && !/^\d+$/.test(l); });
  const linje = linjer[0] || '';
  return linje.length > 90 ? linje.slice(0, 87).replace(/\s+\S*$/, '') + '…' : linje;
}

const allePdf = new Set([].concat(Array.from(diasshows.keys()), Array.from(pdfFundet.keys())));
Array.from(allePdf).sort().forEach(function (sti) {
  const sider = pdfSider(sti);
  const show = diasshows.get(sti);
  let iBilag = false;
  sider.forEach(function (raa, i) {
    const nr = i + 1;
    if (show && /^\s*Bilag: til opslag/.test(raa)) iBilag = true;
    // Undervisersider i arbejdsarkene skal ikke findes af deltagerne.
    if (/^\s*KUN TIL UNDERVISEREN/.test(raa)) return;
    const tekst = ryd(raa);
    const overskrift = foersteLinje(raa);
    if (show) {
      tilfoej({
        t: (overskrift || 'Dias ' + nr),
        k: show.kontekst + ' · dias ' + nr + (iBilag ? ' (bilag)' : ''),
        u: show.side + '?dias=' + nr + '#' + show.sektion,
        y: 'dias',
        x: tekst,
        b: iBilag
      });
    } else {
      const info = pdfFundet.get(sti);
      const flere = sider.length > 1;
      tilfoej({
        t: overskrift || info.titel,
        k: 'PDF · ' + (info.titel || path.posix.basename(sti)) + (flere ? ' · side ' + nr : '') + (info.kontekst ? ' · ' + info.kontekst : ''),
        u: kodSti(sti) + (flere ? '#page=' + nr : ''),
        y: 'materiale',
        x: tekst
      });
    }
  });
});

// ---------- Skriv ----------

const indhold = JSON.stringify({ version: 1, docs: docs }) + '\n';
const cacheIndhold = JSON.stringify(nyCache) + '\n';
advarsler.forEach(function (a) { console.warn('Advarsel: ' + a); });

if (TJEK) {
  const nu = fs.existsSync(INDEKSFIL) ? fs.readFileSync(INDEKSFIL, 'utf8') : '';
  if (nu !== indhold) {
    console.error('Søgeindekset er forældet. Kør: node scripts/byg-soegeindeks.js');
    process.exit(1);
  }
  console.log('Søgeindekset er opdateret (' + docs.length + ' dokumenter).');
} else {
  fs.writeFileSync(INDEKSFIL, indhold);
  fs.writeFileSync(CACHEFIL, cacheIndhold);
  console.log('Skrev soegeindeks.json: ' + docs.length + ' dokumenter, ' +
    Math.round(Buffer.byteLength(indhold) / 1024) + ' kB.');
}
