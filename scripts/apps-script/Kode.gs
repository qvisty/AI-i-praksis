/**
 * Evaluering for kurset "AI i praksis".
 *
 * doPost tilføjer ét svar som en række i fanebladet "svar".
 * doGet eksporterer alle svar som JSON, men kun mod et token der ligger i
 * Script Properties under LAESE_TOKEN og aldrig i kodelageret.
 *
 * Scriptet skal være BUNDET til regnearket (Udvidelser → Apps Script), og
 * udrulles som web app med "Kør som: mig" og "Adgang: Alle". Netop den
 * kombination gør, at arket kan forblive privat, mens anonyme svar kan lande.
 *
 * Denne fil er en referencekopi. Den kørende kode lever i Apps Script.
 */

var ARK_SVAR = 'svar';
var ARK_NOEGLE = 'noegle';
var MAX_TEGN = 2000;
var TILLADTE_DAGE = ['1', '2', '3', '4', 'samlet'];

/** Kolonnerne i fanebladet "svar", i den rækkefølge opsaetArk() skriver dem. */
var KOLONNER = [
  'tidspunkt_iso', 'tidspunkt_dk', 'hold', 'dag', 'dag_label',
  'anvendelighed_1_10', 'tempo', 'kan_selv', 'brugt_siden_sidst',
  'bedste_ting', 'gik_i_staa', 'en_aendring', 'noget_andet',
  'dag1_sikkerhed', 'dag1_tvivl', 'dag2_bedste_oevelse', 'dag2_skepsis',
  'dag3_eksempler', 'dag3_bedre_eksempel', 'dag4_proeveklar', 'dag4_mangler',
  'samlet_resultat', 'samlet_bedste_dag', 'samlet_manglede', 'samlet_droppes',
  'samlet_anbefaling', 'samlet_hvorfor', 'samlet_proeven', 'samlet_citat_ok',
  'kontakt_navn', 'kontakt_mail',
  'ekstra_json', 'svar_id', 'skema_version'
];

/**
 * Nøglearket: forklarer hver kolonne, så arket kan læses og analyseres uden
 * yderligere kontekst — også af en sprogmodel med adgang til filen.
 * Rækkefølgen er: kolonne, spørgsmål, svarmuligheder, hvilken_beslutning.
 */
var NOEGLE = [
  ['kolonne', 'spoergsmaal', 'svarmuligheder', 'hvilken_beslutning'],
  ['tidspunkt_iso', 'Hvornår svaret blev afgivet', 'ISO 8601, UTC', 'Sortering og tidslinje'],
  ['tidspunkt_dk', 'Samme tidspunkt, dansk tid', 'dd-mm-åååå tt:mm', 'Læsbarhed'],
  ['hold', 'Hvilket hold svaret hører til', 'Holdnummer', 'Adskiller flere forløb i samme ark'],
  ['dag', 'Hvilken kursusdag der evalueres', '1, 2, 3, 4 eller samlet', 'Gruppering'],
  ['dag_label', 'Samme dag skrevet ud', 'Dag 1 … Samlet evaluering', 'Læsbarhed'],
  ['anvendelighed_1_10', 'På en skala fra 1 til 10: hvor meget af det, du har lavet i dag, kan du bruge i dit arbejde inden for de næste 14 dage?', '1 (intet af det) til 10 (næsten det hele)', 'Den ene talserie der følges på tværs af dagene. Falder den, skal indholdet gøres mere jobnært — ikke sjovere.'],
  ['tempo', 'Hvordan var tempoet i dag?', 'For langsomt / Passende / For hurtigt', 'Om øvelserne skal have mere eller mindre tid næste gang'],
  ['kan_selv', 'Kunne du gøre dagens vigtigste øvelse igen i morgen — alene?', 'Ja, på egen hånd / Ja, hvis jeg har siden eller mine noter ved hånden / Nej, ikke endnu', 'Om underviseren underviste eller blot demonstrerede. Mange "nej" betyder mere hands-on-tid, ikke flere slides.'],
  ['brugt_siden_sidst', 'Har du brugt noget fra sidste kursusdag på dit arbejde siden da?', 'Ja, flere gange / Ja, én gang / Nej, jeg nåede det ikke / Nej, jeg vidste ikke hvad jeg skulle bruge det til', 'Det eneste svar der måler om kurset sætter sig. De to nej-varianter adskiller manglende tid fra manglende konkret opgave — to forskellige rettelser. Stilles ikke på dag 1.'],
  ['bedste_ting', 'Nævn én konkret ting fra i dag, du vil bruge først — og hvad du vil bruge den til.', 'Fritekst', 'Hvilke øvelser der skal blive, og hvilke eksempler der virker'],
  ['gik_i_staa', 'Hvor gik du i stå i dag, eller hvad forstod du ikke?', 'Fritekst, "ingenting" er et gyldigt svar', 'Hvor der skal sættes ind i starten af næste dag'],
  ['en_aendring', 'Nævn én ting, jeg skal gøre anderledes næste kursusdag.', 'Fritekst', 'Den eneste ønskeplads. Ét ønske pr. deltager tvinger prioritering frem.'],
  ['noget_andet', 'Noget andet, jeg skal vide?', 'Fritekst, valgfri', 'Sikkerhedsventil for det spørgeskemaet ikke ramte'],
  ['dag1_sikkerhed', 'Efter i dag: hvor sikker er du på, hvad en sprogmodel egentlig gør, når den svarer?', 'Jeg kunne forklare det for en kollega / Jeg har fat i det, men ikke skarpt / Stadig ret uklart', 'Om grundforklaringen holder, eller skal gentages i starten af dag 2'],
  ['dag1_tvivl', 'Hvad var du mest i tvivl om, da du gik hjem?', 'Fritekst', 'Konkret liste til opsamlingen dag 2'],
  ['dag2_bedste_oevelse', 'Hvilken af dagens øvelser gav dig mest?', 'Billedøvelsen / Musikøvelsen / Begge lige meget / Ingen af dem', 'Hvor de 45 minutter skal ligge på næste hold'],
  ['dag2_skepsis', 'Hvad tager du med fra snakken om etik og ophavsret — noget du vil gøre anderledes på jobbet?', 'Fritekst', 'Om etiksporet er blevet til handling eller kun til holdning'],
  ['dag3_eksempler', 'Hvor godt passede dagens eksempler til dit eget fag?', 'Meget godt / Nogenlunde / Ramte ved siden af', 'Om eksempelbanken holder for netop dette hold'],
  ['dag3_bedre_eksempel', 'Hvilket eksempel fra dit eget arbejde skulle jeg have brugt i stedet?', 'Fritekst', 'Fodrer eksempelbanken med deltagernes eget stof'],
  ['dag4_proeveklar', 'Hvor klar føler du dig til prøven?', 'Klar / Jeg mangler at få styr på et par ting / Slet ikke klar', 'Om der skal lægges ekstra prøveforberedelse ind'],
  ['dag4_mangler', 'Hvad mangler du helt konkret, før du er klar til prøven?', 'Fritekst', 'Indholdet i den ekstra forberedelse'],
  ['samlet_resultat', 'Hvad har du konkret lavet eller ændret på dit arbejde, som du ikke havde gjort uden kurset?', 'Fritekst', 'Pengespørgsmålet: måler kursets faktiske effekt'],
  ['samlet_bedste_dag', 'Hvilken kursusdag gav dig mest?', 'Dag 1 / Dag 2 / Dag 3 / Dag 4', 'Hvilken dag der er skabelonen, og hvilken der skal bygges om'],
  ['samlet_manglede', 'Hvad manglede der, som du havde forventet eller håbet på?', 'Fritekst', 'Hul mellem kursusbeskrivelse og virkelighed'],
  ['samlet_droppes', 'Hvad kunne vi have droppet, uden at du havde mistet noget?', 'Fritekst', 'Skaber plads i programmet i stedet for kun at tilføje'],
  ['samlet_anbefaling', 'Ville du anbefale kurset til en kollega med samme job som dig?', 'Ja / Måske / Nej', 'Anbefalingsvilje, gjort specifik i stedet for høflig'],
  ['samlet_hvorfor', 'Hvorfor det svar?', 'Fritekst', 'Begrundelsen er mere værd end tallet'],
  ['samlet_proeven', 'Hvor klar føler du dig til prøven?', 'Klar / Mangler et par ting / Slet ikke klar', 'Sammenlignes med dag4_proeveklar: rykkede den sidste dag noget?'],
  ['samlet_citat_ok', 'Må svarene citeres anonymt i en kursusbeskrivelse?', 'ja / nej', 'Samtykke, så citater kan bruges uden tvivl'],
  ['kontakt_navn', 'Dit navn (frivilligt)', 'Fritekst, oftest tom', 'Kun til at kunne svare tilbage. Må ikke indgå i analysen — svarene behandles som anonyme.'],
  ['kontakt_mail', 'Din mail (frivilligt)', 'Fritekst, oftest tom', 'Kun til at kunne svare tilbage. Må ikke indgå i analysen — svarene behandles som anonyme.'],
  ['ekstra_json', 'Spørgsmål tilføjet midt i et forløb', 'JSON-objekt', 'Sikkerhedsventil. Forfremmes til rigtig kolonne, når det bruges anden gang.'],
  ['svar_id', 'Klientgenereret id for besvarelsen', 'uuid', 'Sikrer at en gentaget afsendelse ikke giver en dublet'],
  ['skema_version', 'Version af spørgsmålssættet', 'Heltal', 'Gør det muligt at se hvilke svar der kan sammenlignes']
];

/**
 * Henter et navngivet faneblad i det regneark, scriptet er bundet til.
 * @param {string} navn Fanebladets navn.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} Fanebladet.
 */
function hentArk_(navn) {
  var bog = SpreadsheetApp.getActiveSpreadsheet();
  var ark = bog.getSheetByName(navn);
  if (!ark) throw new Error('Fanebladet "' + navn + '" findes ikke. Kør opsaetArk() først.');
  return ark;
}

/**
 * Pakker et objekt som JSON-svar med korrekt MIME-type.
 * @param {Object} objekt Data der skal returneres.
 * @returns {GoogleAppsScript.Content.TextOutput} Svaret.
 */
function jsonSvar_(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Renser og afkorter en enkelt svarværdi, så arket ikke kan fyldes med skrald.
 * @param {*} vaerdi Rå værdi fra formularen.
 * @returns {string} Renset værdi.
 */
function rens_(vaerdi) {
  if (vaerdi === null || vaerdi === undefined) return '';
  var tekst = String(vaerdi).replace(/\u0000/g, '').trim();
  return tekst.length > MAX_TEGN ? tekst.slice(0, MAX_TEGN) + ' […afkortet]' : tekst;
}

/**
 * Undersøger om et svar_id allerede findes, så gentagne forsøg ikke giver dubletter.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} ark Svar-fanebladet.
 * @param {number} kolonne 1-baseret kolonnenummer for svar_id.
 * @param {string} svarId Id'et der skal slås op.
 * @returns {boolean} Sandt hvis svaret allerede er gemt.
 */
function svarFindes_(ark, kolonne, svarId) {
  if (!svarId || kolonne < 1 || ark.getLastRow() < 2) return false;
  var vaerdier = ark.getRange(2, kolonne, ark.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < vaerdier.length; i++) {
    if (String(vaerdier[i][0]) === svarId) return true;
  }
  return false;
}

/**
 * Modtager ét evalueringssvar og tilføjer det som en række.
 * Kolonnerne slås op i headerrækken, så rækkefølgen i arket må gerne ændres.
 * @param {GoogleAppsScript.Events.DoPost} e Hændelsen fra web app'en.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON med ok eller fejl.
 */
function doPost(e) {
  var laas = LockService.getScriptLock();
  try {
    laas.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    var svar = data.svar || {};

    if (TILLADTE_DAGE.indexOf(String(data.dag)) === -1) {
      return jsonSvar_({ ok: false, fejl: 'ugyldig dag' });
    }

    var ark = hentArk_(ARK_SVAR);
    var header = ark.getRange(1, 1, 1, ark.getLastColumn()).getValues()[0];
    var svarIdKolonne = header.indexOf('svar_id') + 1;
    var svarId = rens_(data.svar_id);

    if (svarFindes_(ark, svarIdKolonne, svarId)) {
      // Gentaget forsøg efter en usikker afsendelse. Meld ok uden at skrive igen.
      return jsonSvar_({ ok: true, dublet: true });
    }

    var nu = new Date();
    var kendte = {
      tidspunkt_iso: nu.toISOString(),
      tidspunkt_dk: Utilities.formatDate(nu, 'Europe/Copenhagen', 'dd-MM-yyyy HH:mm'),
      hold: rens_(data.hold),
      dag: rens_(data.dag),
      dag_label: rens_(data.dag_label),
      svar_id: svarId,
      skema_version: data.skema_version || 1
    };

    var raekke = header.map(function (navn) {
      if (kendte.hasOwnProperty(navn)) return kendte[navn];
      if (navn === 'anvendelighed_1_10') {
        var tal = parseInt(svar[navn], 10);
        return isNaN(tal) ? '' : tal;
      }
      if (navn === 'ekstra_json') return JSON.stringify(data.ekstra || {});
      return rens_(svar[navn]);
    });

    ark.appendRow(raekke);
    return jsonSvar_({ ok: true });
  } catch (fejl) {
    return jsonSvar_({ ok: false, fejl: String(fejl) });
  } finally {
    try { laas.releaseLock(); } catch (ignoreret) { /* låsen var allerede sluppet */ }
  }
}

/**
 * Eksporterer alle svar som JSON, men kun til den der kender læse-tokenet.
 * Tokenet ligger i Script Properties under LAESE_TOKEN og må aldrig i repoet.
 * @param {GoogleAppsScript.Events.DoGet} e Hændelsen fra web app'en.
 * @returns {GoogleAppsScript.Content.TextOutput} JSON med svar, eller en afvisning uden data.
 */
function doGet(e) {
  var forventet = PropertiesService.getScriptProperties().getProperty('LAESE_TOKEN');
  var givet = (e && e.parameter && e.parameter.token) || '';

  if (!forventet || givet !== forventet) {
    Utilities.sleep(700); // gør gætteri langsomt og uinteressant
    return jsonSvar_({ ok: false, fejl: 'Forkert adgangskode.' });
  }

  var ark = hentArk_(ARK_SVAR);
  var alt = ark.getDataRange().getValues();
  var header = alt.shift() || [];
  var raekker = alt
    .filter(function (r) { return r.join('').trim() !== ''; })
    .map(function (r) {
      var o = {};
      header.forEach(function (navn, i) {
        var v = r[i];
        o[navn] = v instanceof Date ? v.toISOString() : v;
      });
      return o;
    });

  var noegle = [];
  var noegleArk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ARK_NOEGLE);
  if (noegleArk && noegleArk.getLastRow() > 1) {
    noegle = noegleArk.getDataRange().getValues();
  }

  return jsonSvar_({
    ok: true,
    hentet: new Date().toISOString(),
    kolonner: header,
    svar: raekker,
    noegle: noegle
  });
}

/**
 * Tilføjer de kolonner fra KOLONNER, som mangler i arket, og skriver
 * nøglearket igen. Køres manuelt, når der er kommet nye spørgsmål til et ark,
 * der allerede indeholder svar — opsaetArk() rører nemlig ikke en
 * headerrække, der allerede er skrevet. Eksisterende data flyttes ikke.
 * @returns {string} Kort besked om hvad der blev tilføjet.
 */
function opdaterKolonner() {
  var ark = hentArk_(ARK_SVAR);
  var header = ark.getRange(1, 1, 1, Math.max(1, ark.getLastColumn())).getValues()[0];
  var manglende = KOLONNER.filter(function (navn) { return header.indexOf(navn) === -1; });

  if (manglende.length) {
    ark.getRange(1, header.length + 1, 1, manglende.length)
      .setValues([manglende])
      .setFontWeight('bold');
  }

  var noegleArk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ARK_NOEGLE);
  if (noegleArk) {
    noegleArk.clear();
    noegleArk.getRange(1, 1, NOEGLE.length, 4).setValues(NOEGLE);
    noegleArk.getRange(1, 1, 1, 4).setFontWeight('bold');
    noegleArk.setFrozenRows(1);
  }

  var besked = manglende.length
    ? 'Tilføjede kolonner: ' + manglende.join(', ')
    : 'Ingen kolonner manglede.';
  Logger.log(besked);
  return besked;
}

/**
 * Køres én gang manuelt fra Apps Script-editoren: opretter de to faneblade,
 * skriver headerrækken og nøglearket, og genererer et læse-token hvis der ikke
 * allerede er et. Tokenet skrives i loggen, så det kan kopieres derfra.
 * Funktionen kan køres igen uden at ødelægge eksisterende svar.
 */
function opsaetArk() {
  var bog = SpreadsheetApp.getActiveSpreadsheet();

  var svarArk = bog.getSheetByName(ARK_SVAR) || bog.insertSheet(ARK_SVAR);
  if (svarArk.getLastRow() === 0) {
    svarArk.getRange(1, 1, 1, KOLONNER.length).setValues([KOLONNER]).setFontWeight('bold');
    svarArk.setFrozenRows(1);
  }

  var noegleArk = bog.getSheetByName(ARK_NOEGLE) || bog.insertSheet(ARK_NOEGLE);
  noegleArk.clear();
  noegleArk.getRange(1, 1, NOEGLE.length, 4).setValues(NOEGLE);
  noegleArk.getRange(1, 1, 1, 4).setFontWeight('bold');
  noegleArk.setFrozenRows(1);
  noegleArk.setColumnWidth(2, 420);
  noegleArk.setColumnWidth(3, 320);
  noegleArk.setColumnWidth(4, 420);

  var egenskaber = PropertiesService.getScriptProperties();
  var token = egenskaber.getProperty('LAESE_TOKEN');
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    egenskaber.setProperty('LAESE_TOKEN', token);
  }
  Logger.log('Læse-token (gem det i din password manager): ' + token);
}
