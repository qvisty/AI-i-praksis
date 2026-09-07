"""Lægger små henvisningsnoter ind på udvalgte dias i kursets PDF-diassæt.

Noterne står i dias-noter.json og peger fra et bestemt dias over på den
aktivitet i Jespers egne moduler, der udvider eller kan erstatte UCL-punktet.
Scriptet finder selv et tomt sted på diasset, tegner noten der og lægger en
klikbar lænke ovenpå.

Værktøjet er en engangsting til indholdet, ikke en del af sidens udgivelse.
Selve kursussiden er stadig ren HTML, CSS og JavaScript uden buildproces.

Kør:  python scripts/dias-noter.py            (skriver noterne ind i PDF'erne)
      python scripts/dias-noter.py --tjek     (viser kun hvor noterne ville lande)

Kræver: pypdf, reportlab, pypdfium2 og Pillow.
"""

import argparse
import io
import json
import os
import shutil
import sys

import pypdfium2 as pdfium
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link
from reportlab.lib.colors import Color, HexColor
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as rl_canvas

ROOD = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATAFIL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dias-noter.json")

BLAEK = HexColor("#00454E")          # samme mørkegrønne som UCL-skabelonen
ERSTAT_FARVE = HexColor("#8A3324")   # tydeligt anderledes, når noten erstatter
PAPIR = Color(1, 1, 1)

NOTE_BREDDE_MAKS = 320.0
NOTE_BREDDE_MIN = 190.0
POLSTRING = 9.0
HJOERNE = 5.0
KANT_MARGEN = 26.0                   # mindste afstand til diassets kant


def registrer_skrifter():
    """Registrerer Calibri, så noterne matcher diassene. Falder tilbage til Helvetica.

    :returns: navnene på (normal, fed) skrifttype.
    """
    fonte = os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "Fonts")
    normal = os.path.join(fonte, "calibri.ttf")
    fed = os.path.join(fonte, "calibrib.ttf")
    if os.path.exists(normal) and os.path.exists(fed):
        pdfmetrics.registerFont(TTFont("NoteTekst", normal))
        pdfmetrics.registerFont(TTFont("NoteFed", fed))
        return "NoteTekst", "NoteFed"
    return "Helvetica", "Helvetica-Bold"


def optaget_kort(side, bredde, hoejde, oploesning=2):
    """Laver et gitter over, hvor der allerede står noget på diasset.

    Baggrunden i skabelonen er lys og næsten ensfarvet, mens tekst, tabeller og
    billeder er markant mørkere eller mere mættede. Et felt regnes for optaget,
    hvis blot én pixel i feltet afviger tydeligt fra sidens dominerende farve.

    :param side: siden fra pypdfium2.
    :param bredde: sidens bredde i punkter.
    :param hoejde: sidens højde i punkter.
    :param oploesning: felter pr. punkt i gitteret.
    :returns: (gitter, kolonner, raekker) hvor gitter[r][k] er True hvis optaget.
    """
    billede = side.render(scale=2).to_pil().convert("RGB")
    px_pr_pkt = billede.width / bredde

    smaa = billede.resize(
        (max(1, int(bredde * oploesning)), max(1, int(hoejde * oploesning))),
        Image.BOX,
    )
    dominerende = max(smaa.getcolors(smaa.width * smaa.height), key=lambda c: c[0])[1]

    kolonner, raekker = smaa.size
    data = smaa.load()
    gitter = [[False] * kolonner for _ in range(raekker)]
    for r in range(raekker):
        for k in range(kolonner):
            farve = data[k, r]
            afstand = sum(abs(farve[i] - dominerende[i]) for i in range(3))
            lys = 0.299 * farve[0] + 0.587 * farve[1] + 0.114 * farve[2]
            gitter[r][k] = afstand > 60 or lys < 170
    del px_pr_pkt
    return gitter, kolonner, raekker


def er_frit(gitter, kolonner, raekker, x, y, bredde, hoejde, oploesning=2):
    """Tjekker om et rektangel i punktkoordinater er tomt på diasset.

    :param x: venstre kant i punkter, målt fra sidens venstre side.
    :param y: nederste kant i punkter, målt fra sidens bund.
    :returns: True hvis hele rektanglet er frit.
    """
    k0 = max(0, int(x * oploesning))
    k1 = min(kolonner, int((x + bredde) * oploesning) + 1)
    # PDF regner y nedefra, billedet oppefra.
    r0 = max(0, int((raekker / oploesning - y - hoejde) * oploesning))
    r1 = min(raekker, int((raekker / oploesning - y) * oploesning) + 1)
    for r in range(r0, r1):
        raekke = gitter[r]
        for k in range(k0, k1):
            if raekke[k]:
                return False
    return True


def find_plads(gitter, kolonner, raekker, sidebredde, sidehoejde, bredde, hoejde):
    """Finder et tomt sted til noten, helst nederst til venstre.

    :returns: (x, y) i punkter, eller None hvis diasset er fyldt.
    """
    luft = 5.0
    y_kandidater = [y for y in range(int(KANT_MARGEN), int(sidehoejde * 0.62), 4)]
    x_kandidater = [x for x in range(int(KANT_MARGEN), int(sidebredde - bredde - KANT_MARGEN), 8)]
    for y in y_kandidater:
        for x in x_kandidater:
            if er_frit(gitter, kolonner, raekker, x - luft, y - luft,
                       bredde + 2 * luft, hoejde + 2 * luft):
                return float(x), float(y)
    return None


def bryd_tekst(tekst, skrift, stoerrelse, bredde):
    """Deler teksten op i linjer, der er smalle nok til noten.

    :returns: liste med linjer.
    """
    return simpleSplit(tekst, skrift, stoerrelse, bredde)


def maal_note(note, skrifter):
    """Beregner notens mål og de linjer, der skal tegnes.

    :returns: (bredde, hoejde, overskrift, linjer).
    """
    tekst_skrift, fed_skrift = skrifter
    overskrift = "%s  ·  %s" % (note["type"].upper(), note["titel"])
    bredde_overskrift = pdfmetrics.stringWidth(overskrift, fed_skrift, 8.2) + 2 * POLSTRING
    bredde = min(NOTE_BREDDE_MAKS, max(NOTE_BREDDE_MIN, bredde_overskrift))
    linjer = bryd_tekst(note["tekst"], tekst_skrift, 9.0, bredde - 2 * POLSTRING)
    if len(linjer) > 2:
        bredde = NOTE_BREDDE_MAKS
        linjer = bryd_tekst(note["tekst"], tekst_skrift, 9.0, bredde - 2 * POLSTRING)
    hoejde = POLSTRING + 10.0 + len(linjer) * 11.5 + POLSTRING - 2
    return bredde, hoejde, overskrift, linjer


def tegn_note(note, skrifter, sidebredde, sidehoejde, x, y, bredde, hoejde, overskrift, linjer):
    """Tegner én note på en gennemsigtig side og returnerer den som PDF-bytes."""
    tekst_skrift, fed_skrift = skrifter
    buffer = io.BytesIO()
    c = rl_canvas.Canvas(buffer, pagesize=(sidebredde, sidehoejde))
    farve = ERSTAT_FARVE if note["type"] == "erstat" else BLAEK
    c.setFillColor(farve)
    c.roundRect(x, y, bredde, hoejde, HJOERNE, stroke=0, fill=1)

    c.setFillColor(PAPIR)
    c.setFont(fed_skrift, 8.2)
    c.drawString(x + POLSTRING, y + hoejde - POLSTRING - 8.0, overskrift)

    c.setFont(tekst_skrift, 9.0)
    linje_y = y + hoejde - POLSTRING - 20.0
    for linje in linjer:
        c.drawString(x + POLSTRING, linje_y, linje)
        linje_y -= 11.5

    c.save()
    buffer.seek(0)
    return buffer


def behandl_diassaet(saet, basisurl, kun_tjek):
    """Skriver alle noter for ét diassæt ind i PDF'en.

    :returns: liste med linjer til rapporten.
    """
    sti = os.path.join(ROOD, saet["fil"])
    rapport = []
    if not os.path.exists(sti):
        return ["MANGLER: " + saet["fil"]]

    skrifter = registrer_skrifter()
    dokument = pdfium.PdfDocument(sti)
    laeser = PdfReader(sti)
    noter = {n["dias"]: n for n in saet["noter"]}

    placeringer = {}
    for nummer, note in sorted(noter.items()):
        if nummer < 1 or nummer > len(laeser.pages):
            rapport.append("  dias %s findes ikke i %s" % (nummer, saet["fil"]))
            continue
        side_pdfium = dokument[nummer - 1]
        maal = laeser.pages[nummer - 1].mediabox
        sidebredde = float(maal.width)
        sidehoejde = float(maal.height)
        bredde, hoejde, overskrift, linjer = maal_note(note, skrifter)
        gitter, kolonner, raekker = optaget_kort(side_pdfium, sidebredde, sidehoejde)
        plads = find_plads(gitter, kolonner, raekker, sidebredde, sidehoejde, bredde, hoejde)
        if plads is None:
            rapport.append("  dias %-3s INGEN PLADS  %s" % (nummer, note["titel"]))
            continue
        x, y = plads
        placeringer[nummer] = {
            "note": note,
            "x": x,
            "y": y,
            "bredde": bredde,
            "hoejde": hoejde,
            "overskrift": overskrift,
            "linjer": linjer,
            "sidebredde": sidebredde,
            "sidehoejde": sidehoejde,
        }
        rapport.append("  dias %-3s %-6s x=%5.0f y=%5.0f  %s" %
                       (nummer, note["type"], x, y, note["titel"]))

    if kun_tjek:
        return rapport

    skriver = PdfWriter()
    if laeser.metadata:
        skriver.add_metadata(laeser.metadata)
    for i, side in enumerate(laeser.pages, start=1):
        p = placeringer.get(i)
        if p:
            overlag = PdfReader(tegn_note(
                p["note"], skrifter, p["sidebredde"], p["sidehoejde"],
                p["x"], p["y"], p["bredde"], p["hoejde"], p["overskrift"], p["linjer"],
            )).pages[0]
            side.merge_page(overlag)
        skriver.add_page(side)

    for nummer, p in placeringer.items():
        skriver.add_annotation(
            page_number=nummer - 1,
            annotation=Link(
                rect=(p["x"], p["y"], p["x"] + p["bredde"], p["y"] + p["hoejde"]),
                url=basisurl + p["note"]["url"],
            ),
        )

    midlertidig = sti + ".ny"
    with open(midlertidig, "wb") as f:
        skriver.write(f)
    shutil.move(midlertidig, sti)
    rapport.append("  skrevet: %s (%s noter)" % (saet["fil"], len(placeringer)))
    return rapport


def main():
    """Kører alle diassæt igennem og skriver en kort rapport."""
    parser = argparse.ArgumentParser(description="Lægger henvisningsnoter på kursets dias.")
    parser.add_argument("--tjek", action="store_true",
                        help="vis kun hvor noterne ville lande, uden at ændre filerne")
    argumenter = parser.parse_args()

    with open(DATAFIL, encoding="utf-8") as f:
        data = json.load(f)

    for saet in data["diassaet"]:
        print(saet["fil"])
        for linje in behandl_diassaet(saet, data["basisurl"], argumenter.tjek):
            print(linje)
    return 0


if __name__ == "__main__":
    sys.exit(main())
