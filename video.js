/**
 * Indlejrede YouTube-afspillere.
 *
 * Der indsættes ikke en iframe med det samme. I stedet vises et miniaturebillede
 * med en afspilknap, og selve afspilleren hentes først, når deltageren klikker.
 * Det holder siden let, og YouTube får ingen besked om, at siden er åbnet, før
 * man rent faktisk vil se videoen. Afspilleren bruger youtube-nocookie.com.
 *
 * To måder at få en afspiller:
 *   1. Sæt data-video på et link:  <a href="https://youtu.be/ID" data-video>…</a>
 *      Attributten må gerne have en værdi, som så bliver videoens navn:
 *      data-video="Deepfake-eksempel". Ellers gættes navnet ud fra konteksten.
 *   2. Lad et afsnit indeholde ét YouTube-link og intet andet. Så bliver det
 *      automatisk til en afspiller — det dækker materialernes "Se videoen på
 *      YouTube"-linjer, uden at hvert enkelt link inde i en brødtekst gør det.
 */
(function (global) {
  'use strict';

  /**
   * Trækker video-id'et ud af en YouTube-adresse.
   * @param {string} adresse Hele URL'en.
   * @returns {string|null} Id'et, eller null hvis adressen ikke er en YouTube-video.
   */
  function videoId(adresse) {
    if (!adresse) return null;
    var kort = adresse.match(/^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{6,})/);
    if (kort) return kort[1];
    var lang = adresse.match(/^https?:\/\/(?:www\.)?youtube\.com\/watch\?[^#]*\bv=([A-Za-z0-9_-]{6,})/);
    if (lang) return lang[1];
    var indlejret = adresse.match(/^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,})/);
    return indlejret ? indlejret[1] : null;
  }

  /**
   * Finder et navn til videoen, der siger noget om indholdet.
   * Linkteksten er tit bare "Se videoen på YouTube", som intet fortæller en
   * skærmlæser. Derfor bruges den nærmeste overskrift før linket, hvis der er
   * en, og ellers sidens titel.
   * @param {HTMLAnchorElement} link Linket til videoen.
   * @returns {string} Et beskrivende navn.
   */
  function beskrivelse(link) {
    // Et navn skrevet direkte i data-video vinder altid over gætteriet.
    var angivet = (link.getAttribute('data-video') || '').trim();
    if (angivet) return angivet;

    var knude = link;
    while (knude && knude !== document.body) {
      var forrige = knude.previousElementSibling;
      while (forrige) {
        if (/^H[1-4]$/.test(forrige.tagName)) return forrige.textContent.trim();
        var indeni = forrige.querySelector('h1, h2, h3, h4');
        if (indeni) return indeni.textContent.trim();
        forrige = forrige.previousElementSibling;
      }
      knude = knude.parentElement;
    }

    var tekst = link.textContent.trim();
    // Rene opfordringer siger intet om videoen. Så er sidens titel bedre.
    if (!/^(se|hør|klik|her|videoen|videoeksemplet)\b/i.test(tekst) && tekst.split(/\s+/).length > 1) {
      return tekst;
    }
    return document.title.replace(/\s*\|\s*AI i praksis\s*$/, '').trim() || tekst;
  }

  /**
   * Bygger afspilleren som et miniaturebillede med en knap foran.
   * Først ved klik udskiftes den med den rigtige iframe.
   * @param {string} id Videoens YouTube-id.
   * @param {string} titel Beskrivende tekst til skærmlæsere.
   * @returns {HTMLElement} Elementet der kan indsættes på siden.
   */
  function byggAfspiller(id, titel) {
    var pakke = document.createElement('div');
    pakke.className = 'video';

    var knap = document.createElement('button');
    knap.type = 'button';
    knap.className = 'video-start';
    knap.setAttribute('aria-label', 'Afspil videoen' + (titel ? ': ' + titel : ''));

    // maxresdefault er i 16:9 og skarpt nok til en projektor, men findes ikke
    // for alle videoer. Falder vi tilbage til hqdefault, som altid findes.
    var billede = document.createElement('img');
    billede.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
    billede.alt = '';
    billede.loading = 'lazy';
    billede.addEventListener('error', function reserve() {
      billede.removeEventListener('error', reserve);
      billede.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    });
    knap.appendChild(billede);

    var trekant = document.createElement('span');
    trekant.className = 'video-play';
    trekant.setAttribute('aria-hidden', 'true');
    knap.appendChild(trekant);

    knap.addEventListener('click', function () {
      // Attributterne følger YouTubes eget indlejringseksempel. Dertil:
      // playsinline, så iPhone ikke river videoen ud i fuldskærm af sig selv,
      // og rel=0, så de foreslåede videoer til sidst holder sig til samme kanal.
      var ramme = document.createElement('iframe');
      ramme.src = 'https://www.youtube-nocookie.com/embed/' + id +
        '?autoplay=1&rel=0&playsinline=1';
      ramme.title = titel || 'YouTube-video';
      ramme.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; ' +
        'gyroscope; picture-in-picture; web-share';
      ramme.referrerPolicy = 'strict-origin-when-cross-origin';
      ramme.allowFullscreen = true;
      ramme.setAttribute('frameborder', '0');
      pakke.replaceChild(ramme, knap);
      ramme.focus();
    });

    pakke.appendChild(knap);
    return pakke;
  }

  /**
   * Finder de links der skal have en afspiller, og indsætter den efter
   * linkets afsnit. Kan køres flere gange på samme element uden at dublere.
   * @param {ParentNode} [rod] Elementet der gennemsøges. Standard er hele siden.
   */
  function opgrader(rod) {
    var omraade = rod || document;
    var links = omraade.querySelectorAll('a[href*="youtube.com/watch"], a[href*="youtu.be/"], a[data-video]');

    Array.prototype.forEach.call(links, function (link) {
      if (link.getAttribute('data-video-klar')) return;

      var id = videoId(link.getAttribute('href') || '');
      if (!id) return;

      var afsnit = link.closest('p, li, div');
      if (!afsnit) return;

      // Uden data-video kræver vi, at linket står alene i sit afsnit. Ellers
      // ville hvert link midt i en brødtekst sprænge teksten med en afspiller.
      var alene = afsnit.tagName === 'P' && afsnit.textContent.trim() === link.textContent.trim();
      if (!link.hasAttribute('data-video') && !alene) return;

      link.setAttribute('data-video-klar', 'ja');
      var afspiller = byggAfspiller(id, beskrivelse(link));
      afsnit.parentNode.insertBefore(afspiller, afsnit.nextSibling);
    });
  }

  global.AIPVideo = { opgrader: opgrader, videoId: videoId };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { opgrader(); });
  } else {
    opgrader();
  }
}(window));
