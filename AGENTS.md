# Agentinstruks for AI i praksis

## Formaal
Dette repository er kursussiden for **AI i praksis**. Arbejd altid videre i den eksisterende HTML/CSS/JavaScript-struktur. Der er ingen buildproces.

## Den centrale arbejdsdeling
- `dag-1.html` til `dag-4.html` er de fire kursusdage og skal følge **UCL-underviserens originale materiale**.
- Den originale rækkefølge styres af den relevante PDF i `filer/Ai-i-praksis-dag1/`, `filer/Ai-i-praksis-dag2/`, `filer/Ai-i-praksis-dag3/` eller `filer/Ai-i-praksis-dag4/`.
- `modul-1-lovable.html` til `modul-4-automatisering.html` er Jesper Qvists egne praksisudvidelser og tanker. De må supplere dagssiden, men må ikke fremstilles som UCL-materiale.
- Når en dagsside kobler til et modul, skal det fremgå tydeligt, at det er en udvidelse. Brug for eksempel en kolonne eller et afsnit med overskriften **Mine udvidelser**.
- UCL-sporet skal kunne følges alene. Jespers udvidelser skal ligge som relevante ekstra spor ved de tilsvarende temaer.

## Når der kommer materiale til en ny dag
1. Find den relevante UCL-PDF i dag-mappen, og læs slideoverskrifterne i rækkefølge.
2. Lav eller opdater dagssiden med et eksplicit UCL-program. Brug slideintervaller eller andre tydelige markører, så siden kan bruges som dagskort.
3. Gruppér nye materialer efter deres funktion i dagen: forberedelse, øvelse, grundforklaring, opsamling eller valgfri fordybelse.
4. Link Jespers egne moduler ind, hvor de konkret udvider UCL-temaet. Prioritér Modul 1 på Dag 1, men brug andre moduler, når de passer bedre.
5. Lad være med at blande alle materialer ind i programmet. Deltageren skal kunne se, hvad der er UCL’s hovedforløb, hvad der er en øvelse, og hvad der er ekstra.
6. Publicér kun den dag, der arbejdes på. Andre nye dag-mapper kan ligge lokalt, indtil de er klar.

## Markdown-materialer
- Markdown-filer ligger i den relevante `filer/Ai-i-praksis-dagN/`-mappe.
- Gør hver fil læsbar som et selvstændigt arbejdsark eller læsetip:
  - én tydelig `#`-overskrift
  - `##`-afsnit ved flere dele
  - nummererede lister til rækkefølger og opgaver
  - punktopstillinger til krav, eksempler og valg
  - klikbare links med beskrivende linktekst
  - blockquotes til anbefalinger, sikkerhedsnoter og prioriteringer
- Bevar det faglige indhold og den oprindelige kilde. Ret kun sprog, struktur og tydelige fejl, medmindre andet er aftalt.
- Markér klart, om noget er **prioriteret**, **valgfrit** eller **ikke pensum**. Når flere kilder dækker samme stof, anbefal én hovedkilde og saml resten som supplerende læsning.
- Praktiske arbejdsark skal have en klar opgave, konkrete trin og en kort refleksion eller kontrol af resultatet.
- Brug kun ufølsomme, offentlige eller fiktive data i øvelsesbeskrivelser. Mind om manuel kontrol, når AI arbejder med tal, planer, oversættelser eller sikkerhed.

## Rendering af Markdown
- Direkte `.md`-links skal sendes gennem `markdown.html?file=...`, så deltageren får rendered Markdown i stedet for rå tekst.
- Brug `encodeURIComponent` til filstien i links, og test især filnavne med mellemrum, danske tegn, parenteser og tankestreger.
- Relative links og billeder i Markdown skal fortsat virke fra den mappe, hvor Markdown-filen ligger.
- Bevar sanitering af rendered HTML. Tillad aldrig rå brugerindhold at blive indsat usaneret i siden.

## Diasvisning
- UCL-PDF’en skal kunne downloades fra dagssiden.
- Hvis den vises på siden, skal PDF.js-visningen bevare forrige/næste, sidetal og en fuldskærmsfunktion.
- Knapperne skal skelne tydeligt mellem **Download** og **Vis stort**.
- Brug ikke en ustabil iframe som eneste diasvisning. Bevar en fallback til download.

## Stil og sprog
- Skriv på dansk, medmindre et kildemateriale eller en titel naturligt er på engelsk.
- Bevar sidens eksisterende design, komponenter og CSS-klasser. Lav små, målrettede ændringer.
- Brug ikke frameworks eller buildværktøjer til denne statiske side.
- Undgå at præsentere valgfri læsning som lektier.
- Brug ikke personfølsomme eller fortrolige oplysninger i eksempler.

## Før commit og push
- Kør `get_errors` på alle ændrede HTML-, CSS- og JavaScript-filer.
- Kør `node --check site.js`, når JavaScript er ændret.
- Kør `git diff --check`.
- Kontrollér lokale links og assets, især dagspdf’er, Markdown-filer og billeder.
- Se `git status --short`, og stage kun den dag og de materialer, der er klar til publicering.
- Push til `main` efter aftale. GitHub Pages udgives automatisk fra `main`.
- Commitbeskeder skal kort beskrive ændringen på dansk.

## Vigtige filer
- `dag-1.html` til `dag-4.html`: UCL’s dagsforløb med Jespers udvidelser
- `filer/Ai-i-praksis-dagN/`: kildemateriale til den enkelte dag
- `modul-1-lovable.html` til `modul-4-automatisering.html`: egne praksisudvidelser
- `markdown.html`: rendered visning af lokale Markdown-filer
- `site.js`: navigation, diasvisning, Markdown-link-routing og interaktion
- `style.css`: fælles styling
- `README.md`: repository-overblik og udgivelsesinformation
