# AI i praksis

Kursusside for kurset **AI i praksis** — et hands-on AI-kursus for voksne i arbejde.
Siden bruges i stedet for slides og udgives med GitHub Pages.

## Sidens opbygning

| Fil | Indhold |
| --- | --- |
| `index.html` | Forside: kursets idé, program og forberedelse |
| `modul-1-lovable.html` | Modul 1: Byg en app med Lovable (praksis først, forklaring bagefter) |
| `modul-2-github-claude.html` | Modul 2: GitHub + Claude Code |
| `style.css` | Fælles design (lyst/mørkt tema, øvelses- og forklaringsbokse) |
| `copy.js` | "Kopiér"-knapper på prompt-eksemplerne |
| `.github/workflows/pages.yml` | Automatisk udgivelse til GitHub Pages ved hvert push |

## Udgivelse (engangsopsætning)

1. Gå til repoets **Settings → Pages**.
2. Under **Source**: vælg **GitHub Actions**.
3. Push til repoet (eller kør workflowet manuelt under **Actions**) — siden udgives på
   `https://<brugernavn>.github.io/AI-i-praksis/`.

Herefter udgives siden automatisk, hver gang der pushes.

## Redigering

Alt indhold er ren HTML/CSS uden byggetrin — redigér filerne direkte (evt. i GitHubs
webeditor) og commit. Nye moduler laves nemmest ved at kopiere en eksisterende modulside
og tilføje et link i navigationen og på forsiden.
