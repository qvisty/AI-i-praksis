# AI i praksis

**Kursussiden er live her: <https://qvisty.github.io/AI-i-praksis/>**

Kursusside for kurset **AI i praksis**, et hands-on AI-kursus for voksne i arbejde.
Siden bruges i stedet for slides og udgives med GitHub Pages.

## Sidens opbygning

| Fil | Indhold |
| --- | --- |
| `index.html` | Forside: kursets idé, program og forberedelse |
| `modul-1-lovable.html` | Modul 1: Byg en app med Lovable (praksis først, forklaring bagefter) |
| `modul-2-github-claude.html` | Modul 2: GitHub + Claude Code |
| `modul-3-ai-i-hverdagen.html` | Modul 3: AI i din arbejdsdag (mails, referater, regneark) |
| `modul-4-automatisering.html` | Modul 4: Automatisering i egen infrastruktur (Power Automate, Google, Zapier) |
| `modul-5-andre-modaliteter.html` | Modul 5: Komplekst indhold i andre modaliteter (NotebookLM, podcast, Copilot) |
| `modul-6-forstaa-ai.html` | Modul 6: Teoretisk oplæg (AI'ens historie, ordbog, de store diskussioner) |
| `flere-vaerktoejer.html` | Ekstra idékatalog: 12 værktøjer, korte kursusøvelser og valgkriterier |
| `underviser.html` | Underviserside: forberedelse, talenoter, evaluering, hjemmeopgaver og værktøjskasse. Kun linket fra forsidens sidefod. Skjules ved at slette det link |
| `evaluering.html` | Deltagernes evalueringsside: egen formular for dag 1-4 og en samlet evaluering. Dagen kan forvælges med `?dag=2` |
| `evaluering.js` | Spørgsmålene som konfiguration, formularlogik, kladde i localStorage og afsendelse |
| `resultater.html` og `resultater.js` | Underviserens resultatside: token-låst, med nøgletal, grafer og en færdig analyse-prompt. Bevidst ikke i menuen |
| `papirklips.html` | Fordybelse: papirklips-tankeeksperimentet, appen Paperclip og zero human companies. Linket fra modul 6 |
| `teknik.html` | Til de tekniske: fire dybe spor med git, Claude Code i terminalen, webhooks og lokal AI. Linket fra modul 2 og 4 |
| `oversigt.html` | Oversigt og stikord: selvopdaterende indholdsfortegnelse over alle sider plus alfabetisk stikordsregister |
| `dag-1.html` til `dag-4.html` | Kursusgangene: UCL-underviserens dagsforløb med Jesper Qvists egne praksisudvidelser, materialer og hjemmeopgaver |
| `proeven.html` | Prøven: skeletside til erhvervscasen og den mundtlige prøve |
| `AGENTS.md` | Arbejdsaftaler for Claude Code og andre coding agents: UCL-spor, egne udvidelser, Markdown-materialer og publicering |
| `style.css` | Fælles design (lyst/mørkt tema, øvelses- og forklaringsbokse, animationer) |
| `site.js` | "Kopiér"-knapper, print af handouts, diasvisning og indtoning ved scroll |
| `adgang.js` | Adgangslåsen: loginboks, tjek af adgangskoden og oplåsning af siden |
| `scripts/check-links.js` | Lokalt check af HTML-links og anchors uden ekstra dependencies |
| `scripts/apps-script/Kode.gs` | Referencekopi af det Google Apps Script, der modtager evalueringssvar. Indeholder ingen hemmeligheder |
| `filer/evaluering-opsaetning.md` | Opsætning og drift af evalueringen: regneark, udrulning, token og nye spørgsmål |
| `assets/` | Håndlavede SVG-illustrationer til hver side |

## Adgangskode

Hele siden er låst bag en fælles adgangskode, som deltagerne får på kurset.
Koden står ikke i repositoriet, kun dens saltede SHA-256-hash i `adgang.js`.

Sådan virker låsen:

- Hver HTML-fil starter med `<html lang="da" class="laast">`, og `style.css` skjuler
  alt indhold, så længe klassen er der. `adgang.js` fjerner klassen ved rigtig kode.
- Adgangen huskes i `localStorage`, så koden kun skal skrives én gang pr. browser.
- Store og små bogstaver samt mellemrum omkring koden ignoreres.

Ny adgangskode sættes ved at udskifte `EXPECTED` i `adgang.js`. Hashen beregnes med:

```bash
node -e "const c=require('crypto');console.log(c.createHash('sha256').update('ai-i-praksis:'+process.argv[1].trim().toLowerCase()).digest('hex'))" DINKODE
```

Husk, at koden er en dørlås, ikke rigtig sikkerhed. Alt på siden ligger stadig i et
offentligt repository og kan hentes direkte af den, der kender filnavnene. Læg derfor
aldrig fortrolige oplysninger eller persondata på siden.

## Udgivelse

Siden udgives med GitHub Pages direkte fra `main` og ligger på
<https://qvisty.github.io/AI-i-praksis/>. Opsætningen findes under **Settings, Pages**
med kilden **Deploy from a branch**, branchen `main` og mappen `/ (root)`.
Hvert push til `main` udgives automatisk efter et øjebliks tid.

## Redigering

Alt indhold er ren HTML/CSS/JavaScript uden byggetrin. Læs `AGENTS.md`, før du ændrer
kursusdagene. Følg altid UCL-PDF’en som hovedforløb, og læg egne moduler ind som tydeligt
markerede udvidelser. Nye dag-materialer formatteres som læsbar Markdown og publiceres kun,
når den pågældende dag er klar. Nye moduler laves nemmest ved at kopiere en eksisterende
modulside og tilføje et link i navigationen og på forsiden.
