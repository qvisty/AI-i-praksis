// Adgangslås for hele kursussiden.
//
// Siden starter låst: hver HTML-fil har klassen "laast" på <html>, og
// style.css skjuler alt indhold, så længe klassen er der. Denne fil viser
// loginboksen, tjekker adgangskoden og fjerner klassen, når koden er rigtig.
//
// Bemærk: dette er en statisk side uden server. Låsen holder tilfældige
// besøgende ude, men den er ikke rigtig sikkerhed. Læg aldrig fortrolige
// oplysninger på siden.
(function () {
  var STORAGE_KEY = 'ai-i-praksis-adgang';
  var SALT = 'ai-i-praksis:';
  // sha256(SALT + adgangskoden i små bogstaver). Selve koden står ikke i filen.
  var EXPECTED = '43b5f6f4c006593a0e1607bcd1657bfc3dff1f2fdce0041240a335a854d72fab';

  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  /**
   * Roterer et 32-bit tal til højre.
   * @param {number} x Tallet der roteres.
   * @param {number} n Antal bit.
   * @returns {number} Det roterede tal.
   */
  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  /**
   * Oversætter en tekst til UTF-8-bytes.
   * @param {string} text Teksten der kodes.
   * @returns {number[]} Bytes som tal mellem 0 og 255.
   */
  function utf8Bytes(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) {
        bytes.push(c);
      } else if (c < 0x800) {
        bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c < 0xd800 || c >= 0xe000) {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else {
        i++;
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (text.charCodeAt(i) & 0x3ff));
        bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      }
    }
    return bytes;
  }

  /**
   * Beregner SHA-256 af en tekst. Skrevet i ren JavaScript, så låsen også
   * virker, når siden åbnes lokalt uden https, hvor crypto.subtle mangler.
   * @param {string} text Teksten der hashes.
   * @returns {string} Hashen som 64 hexadecimale tegn.
   */
  function sha256(text) {
    var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bytes = utf8Bytes(text);
    var bitLength = bytes.length * 8;

    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0,
      (bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff, (bitLength >>> 8) & 0xff, bitLength & 0xff);

    var w = new Array(64);
    for (var offset = 0; offset < bytes.length; offset += 64) {
      var t;
      for (t = 0; t < 16; t++) {
        w[t] = (bytes[offset + t * 4] << 24) | (bytes[offset + t * 4 + 1] << 16) |
          (bytes[offset + t * 4 + 2] << 8) | bytes[offset + t * 4 + 3];
      }
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }

      var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + K[t] + w[t]) | 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }

    var out = '';
    for (var j = 0; j < 8; j++) {
      out += ('00000000' + (h[j] >>> 0).toString(16)).slice(-8);
    }
    return out;
  }

  /**
   * Hasher en indtastet adgangskode. Mellemrum omkring koden og store
   * bogstaver ignoreres, så deltagerne ikke falder over tastefejl på mobilen.
   * @param {string} value Den indtastede kode.
   * @returns {string} Hashen der sammenlignes med den forventede.
   */
  function hashPassword(value) {
    return sha256(SALT + String(value).trim().toLowerCase());
  }

  /**
   * Læser den gemte adgang fra browseren.
   * @returns {string|null} Den gemte hash, eller null hvis der ingen er.
   */
  function readStored() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || window.sessionStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  /**
   * Husker adgangen på denne enhed, så koden kun skal skrives én gang.
   * @param {string} hash Hashen der gemmes.
   */
  function remember(hash) {
    try {
      window.localStorage.setItem(STORAGE_KEY, hash);
    } catch (err) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, hash);
      } catch (err2) {
        // Browseren blokerer lagring. Så må koden skrives igen næste gang.
      }
    }
  }

  /**
   * Låser siden op ved at fjerne klassen laast fra <html> og rydde loginboksen.
   */
  function unlock() {
    document.documentElement.classList.remove('laast');
    var boks = document.querySelector('.adgang');
    if (boks) boks.parentNode.removeChild(boks);
  }

  /**
   * Bygger loginboksen og håndterer indtastningen.
   */
  function showGate() {
    var boks = document.createElement('div');
    boks.className = 'adgang';

    var form = document.createElement('form');
    form.className = 'laas';

    var title = document.createElement('h1');
    title.textContent = 'AI i praksis';

    var lead = document.createElement('p');
    lead.className = 'eval-hjaelp';
    lead.textContent = 'Siden er kun for kursets deltagere. Skriv adgangskoden for at fortsætte.';

    var label = document.createElement('label');
    label.className = 'adgang-label';
    label.setAttribute('for', 'adgang-kode');
    label.textContent = 'Adgangskode';

    var input = document.createElement('input');
    input.type = 'password';
    input.id = 'adgang-kode';
    input.autocomplete = 'current-password';
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('spellcheck', 'false');

    var button = document.createElement('button');
    button.type = 'submit';
    button.className = 'knap knap-primaer';
    button.textContent = 'Lås op';

    var error = document.createElement('p');
    error.className = 'eval-fejl';
    error.setAttribute('role', 'alert');
    error.hidden = true;
    error.textContent = 'Forkert adgangskode. Prøv igen.';

    form.appendChild(title);
    form.appendChild(lead);
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(button);
    form.appendChild(error);
    boks.appendChild(form);
    document.body.appendChild(boks);
    input.focus();

    input.addEventListener('input', function () {
      error.hidden = true;
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var hash = hashPassword(input.value);
      if (hash !== EXPECTED) {
        error.hidden = false;
        input.value = '';
        input.focus();
        return;
      }
      remember(hash);
      unlock();
    });
  }

  /**
   * Starter låsen: låser op med det samme, hvis adgangen allerede er husket.
   */
  function init() {
    if (readStored() === EXPECTED) {
      unlock();
      return;
    }
    showGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
