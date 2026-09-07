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

    var billede = document.createElement('img');
    billede.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    billede.alt = '';
    billede.loading = 'lazy';
    knap.appendChild(billede);

    var trekant = document.createElement('span');
    trekant.className = 'video-play';
    trekant.setAttribute('aria-hidden', 'true');
    knap.appendChild(trekant);

    knap.addEventListener('click', function () {
      var ramme = document.createElement('iframe');
      ramme.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      ramme.title = titel || 'YouTube-video';
      ramme.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
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
      var afspiller = byggAfspiller(id, link.textContent.trim());
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
