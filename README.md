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
| `evaluering.html` | Deltagernes evalueringsside. Indsæt formularlinket i `FORMULAR_URL` i filen, se undervisersiden |
| `papirklips.html` | Fordybelse: papirklips-tankeeksperimentet, appen Paperclip og zero human companies. Linket fra modul 6 |
| `teknik.html` | Til de tekniske: fire dybe spor med git, Claude Code i terminalen, webhooks og lokal AI. Linket fra modul 2 og 4 |
| `style.css` | Fælles design (lyst/mørkt tema, øvelses- og forklaringsbokse, animationer) |
| `site.js` | "Kopiér"-knapper, print af handouts, diasvisning og indtoning ved scroll |
| `assets/` | Håndlavede SVG-illustrationer til hver side |

## Udgivelse

Siden udgives med GitHub Pages direkte fra `main` og ligger på
<https://qvisty.github.io/AI-i-praksis/>. Opsætningen findes under **Settings, Pages**
med kilden **Deploy from a branch**, branchen `main` og mappen `/ (root)`.
Hvert push til `main` udgives automatisk efter et øjebliks tid.

## Redigering

Alt indhold er ren HTML/CSS uden byggetrin. Redigér filerne direkte (evt. i GitHubs
webeditor) og commit. Nye moduler laves nemmest ved at kopiere en eksisterende modulside
og tilføje et link i navigationen og på forsiden.
