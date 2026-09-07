# Evaluering: opsætning og drift

Evalueringen på kurset består af tre dele: en formular på `evaluering.html`, et privat Google-regneark, og en låst resultatside på `resultater.html`. Ingen af delene kræver en server — regnearket gør arbejdet, og et lille Google Apps Script binder det sammen.

Førstegangsopsætningen tager omkring et kvarter og skal kun laves én gang pr. regneark.

> **Grundprincippet:** skriveadgangen er offentlig, fordi deltagerne skal kunne svare anonymt uden at logge ind. Læseadgangen er beskyttet af et token, som Apps Script kontrollerer på serversiden. Regnearket deles aldrig med nogen.

## Sådan sætter du det op første gang

1. **Opret regnearket.** Gå til [Google Sheets](https://sheets.google.com), lav et nyt tomt ark, og kald det for eksempel »AI i praksis — evaluering«. Del det ikke med nogen.
2. **Åbn Apps Script.** I regnearket: **Udvidelser → Apps Script**. Scriptet skal være bundet til netop dette ark — det er derfor koden ikke indeholder nogen ark-id'er.
3. **Indsæt koden.** Slet indholdet af `Code.gs`, og indsæt hele indholdet af `scripts/apps-script/Kode.gs` fra repoet. Gem.
4. **Kør `opsaetArk()`.** Vælg funktionen `opsaetArk` i rullemenuen øverst, og klik **Kør**. Google beder om godkendelse første gang — det er dit eget script, der beder om adgang til dit eget ark. Funktionen opretter fanebladene `svar` og `noegle`, skriver overskrifterne, og genererer et læse-token.
5. **Gem tokenet.** Åbn **Udførelseslog** (eller Vis → Log). Tokenet står der. Kopiér det ind i din password manager med det samme. Det vises kun i loggen.
6. **Udrul som web app.** Klik **Udrul → Ny udrulning → vælg type: Web app.**
   - *Beskrivelse:* `Evaluering v1`
   - *Kør som:* **Mig (din konto)**
   - *Hvem har adgang:* **Alle**
7. **Kopiér `/exec`-adressen** fra udrulningsvinduet.
8. **Sæt adressen ind i koden.** Åbn `evaluering.js` i repoet og indsæt adressen i `endpoint`. Gør det samme i `resultater.js` i konstanten `ENDPOINT`. Commit og push — siden er live på GitHub Pages kort efter.
9. **Test det.** Åbn `evaluering.html?dag=1`, udfyld formularen, og send. Der skal komme en grøn kvittering, og en ny række i fanebladet `svar`. Åbn derefter `resultater.html`, lås op med tokenet, og se at svaret er der.

> **Vigtigt om trin 6:** kombinationen »Kør som: mig« + »Adgang: Alle« er dét, der gør, at regnearket kan forblive helt privat, mens hvem som helst kan indsende et svar. Scriptet skriver på dine vegne; deltagerne får aldrig adgang til arket.

## Sådan opdaterer du koden senere

Ret koden i Apps Script, og vælg derefter **Udrul → Administrér udrulninger → rediger den eksisterende udrulning → Version: Ny version → Udrul.**

Vælg **ikke** »Ny udrulning«. Det giver en ny `/exec`-adresse, og så skal både `evaluering.js` og `resultater.js` rettes.

## Sådan skifter du token

1. I Apps Script: **Projektindstillinger → Scriptegenskaber →** ret værdien af `LAESE_TOKEN`.
2. Gem den nye værdi i din password manager.
3. På resultatsiden: klik **Lås igen**, eller luk fanen. Det gamle token virker ikke længere.

Der skal ikke udrulles en ny version for at skifte token — scriptegenskaber læses ved hvert kald.

## Sådan tilføjer du et spørgsmål

1. **I `evaluering.js`:** tilføj feltet i `EVAL_KONFIG.faelles` (hvis det skal stilles hver dag) eller i `EVAL_KONFIG.perDag['3']` (hvis det kun hører til én dag). Feltets `id` bliver kolonnenavnet.
2. **I regnearket:** tilføj en kolonne i fanebladet `svar` med præcis samme navn som `id`. Rækkefølgen er ligegyldig — koden slår kolonner op på navn, ikke på position.
3. **I fanebladet `noegle`:** tilføj en række med kolonnenavn, spørgsmålets fulde ordlyd, svarmulighederne, og hvilken beslutning svaret skal informere. Den sidste kolonne er den vigtigste: det er den, der gør analysen handlingsanvisende.
4. **Kør `opdaterKolonner()`** i Apps Script. Den tilføjer de kolonner fra `KOLONNER`, der mangler i arket, og skriver nøglearket igen. Det er nødvendigt, fordi `opsaetArk()` ikke rører en headerrække, der allerede indeholder svar.
5. **Hvis feltet er fritekst:** tilføj også `id`'et i `FRITEKST_FELTER` i `resultater.js`, så svarene vises på resultatsiden. Er det et lukket spørgsmål, du vil se en fordeling for, tilføjes det i `FORDELING_FELTER`.

> Haster det midt i et forløb, kan et nyt svar også lande i kolonnen `ekstra_json` uden ændringer i arket. Forfrem det til en rigtig kolonne, når du bruger det anden gang.

## Sådan starter du et nyt hold

Ret `hold` i `EVAL_KONFIG` i `evaluering.js`. Alle hold bor i samme ark og kan filtreres på kolonnen `hold`. Der er ingen grund til at oprette et nyt regneark.

## Sådan lader du en AI-assistent læse arket

Resultatsidens knap **Kopiér alt som analyse-prompt** dækker de fleste behov. Vil du grave dybere, kan du give en assistent adgang til regnearket gennem en Google Drive-forbindelse:

- Arket forbliver privat. Du deler det ikke — assistenten læser det gennem din egen konto.
- Fanebladet `noegle` forklarer hver kolonne, hvad spørgsmålet lød, og hvad svaret skal afgøre. Assistenten kan derfor analysere uden yderligere kontekst fra dig.
- Bed om det samme som analyse-prompten: temaer med ordrette citater, modsigelser fremhævet frem for glattet ud, og konkrete ændringer der kan laves på under en time.

## Hvad koden faktisk gør

- `doPost` modtager ét svar. Den kontrollerer at dagen er gyldig, tager en lås så to samtidige svar ikke skriver oven i hinanden, og tjekker om `svar_id` allerede findes. Gør det det, skrives der ikke igen — det er dét, der forhindrer dubletter, når en deltager sender to gange.
- `doGet` kræver et korrekt token. Er det forkert, venter den 0,7 sekunder og returnerer `{"ok":false}` uden data overhovedet.
- Fritekst afkortes ved 2000 tegn, så arket ikke kan fyldes med skrald.

> **Ærligt om misbrug:** `/exec`-adressen er offentlig, så en beslutsom person kan indsende falske rækker. Dagsvalidering, tegnloftet og dublettjekket begrænser det, men fuld beskyttelse er ikke mulig på en statisk offentlig side. Det, der betyder noget, er læseadgangen — og den er beskyttet serverside. Bliver der spammet, udruller du en ny version med en ny adresse.

## Sikkerhedsregler

> Del aldrig regnearket. Del aldrig tokenet. Deltagernes svar er anonyme, og det skal de blive ved med at være.

- `/exec`-adressen **må** stå i repoet. Den giver kun skriveadgang.
- Læse-tokenet **må ikke** stå i repoet, i en commit, i en kommentar eller i en `noindex`-fil. Alt på GitHub er offentligt.
- Navn og mail er **frivillige** og står allersidst i formularen, efter alle svar er skrevet. Placeringen er bevidst: et navnefelt tidligt i skemaet får folk til at pakke kritikken ind.
- Navn og mail sendes **ikke** med i analyse-prompten. De vises kun i sektionen "Vil gerne have svar" på resultatsiden, så du kan skrive tilbage. Behandl resten af svarene som anonyme.
- Bed aldrig om mere identificerende end det. Anonymiteten er grunden til, at folk skriver ærligt.
