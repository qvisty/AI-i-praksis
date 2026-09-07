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

import qrcode
import pypdfium2 as pdfium
from PIL import Image, ImageChops, ImageDraw, ImageStat
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
IKON_PLADS = 16.0                    # plads til lænkeikonet i overskriftslinjen


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
    """Laver en maske over, hvor der allerede står noget på diasset.

    Baggrunden er næsten ensfarvet, mens tekst, tabeller og billeder afviger
    tydeligt fra den. Testen måler kun afstanden til sidens dominerende farve,
    så den også virker på dias med mørk baggrund og lys tekst.

    Masken er et Pillow-billede, så opslag sker i C og ikke i Python-løkker.
    Uden det tager det store diassæt mange minutter.

    :param side: siden fra pypdfium2.
    :param bredde: sidens bredde i punkter.
    :param hoejde: sidens højde i punkter.
    :param oploesning: felter pr. punkt i masken.
    :returns: (maske, miniature) hvor hvide felter i masken er optaget.
    """
    billede = side.render(scale=2).to_pil().convert("RGB")
    smaa = billede.resize(
        (max(1, int(bredde * oploesning)), max(1, int(hoejde * oploesning))),
        Image.BOX,
    )
    dominerende = max(smaa.getcolors(smaa.width * smaa.height), key=lambda c: c[0])[1]

    forskel = ImageChops.difference(smaa, Image.new("RGB", smaa.size, dominerende))
    roed, groen, blaa = forskel.split()
    stoerste = ImageChops.lighter(ImageChops.lighter(roed, groen), blaa)
    maske = stoerste.point(lambda vaerdi: 255 if vaerdi > 18 else 0)
    return maske, smaa


def baggrund_er_moerk(billede, sidehoejde, x, y, bredde, hoejde, oploesning=2):
    """Afgør om baggrunden bag noten er mørk, så noten kan vende farverne om.

    :param billede: den nedskalerede gengivelse af diasset.
    :returns: True hvis området er mørkt.
    """
    kasse = til_billedkasse(billede.width, billede.height, sidehoejde,
                           x, y, bredde, hoejde, oploesning)
    if kasse is None:
        return False
    udsnit = billede.crop(kasse).convert("L")
    return ImageStat.Stat(udsnit).mean[0] < 140


def til_billedkasse(kolonner, raekker, sidehoejde, x, y, bredde, hoejde, oploesning=2):
    """Regner et rektangel i punkter om til billedkoordinater.

    PDF måler y nedefra, billedet oppefra.

    :returns: (venstre, top, hoejre, bund) eller None hvis rektanglet er tomt.
    """
    venstre = max(0, int(x * oploesning))
    hoejre = min(kolonner, int((x + bredde) * oploesning) + 1)
    top = max(0, int((sidehoejde - y - hoejde) * oploesning))
    bund = min(raekker, int((sidehoejde - y) * oploesning) + 1)
    if hoejre <= venstre or bund <= top:
        return None
    return (venstre, top, hoejre, bund)


def er_frit(maske, sidehoejde, x, y, bredde, hoejde, oploesning=2):
    """Tjekker om et rektangel i punktkoordinater er tomt på diasset.

    :param x: venstre kant i punkter, målt fra sidens venstre side.
    :param y: nederste kant i punkter, målt fra sidens bund.
    :returns: True hvis hele rektanglet er frit.
    """
    kasse = til_billedkasse(maske.width, maske.height, sidehoejde,
                            x, y, bredde, hoejde, oploesning)
    if kasse is None:
        return False
    return maske.crop(kasse).getbbox() is None


def markér_optaget(maske, sidehoejde, x, y, bredde, hoejde, oploesning=2, luft=6.0):
    """Markerer en netop placeret note som optaget, så den næste ikke lander ovenpå."""
    kasse = til_billedkasse(maske.width, maske.height, sidehoejde,
                            x - luft, y - luft, bredde + 2 * luft, hoejde + 2 * luft,
                            oploesning)
    if kasse is None:
        return
    ImageDraw.Draw(maske).rectangle(kasse, fill=255)


def find_plads(maske, sidebredde, sidehoejde, bredde, hoejde):
    """Finder et tomt sted til noten, helst nederst til venstre.

    :returns: (x, y) i punkter, eller None hvis diasset er fyldt.
    """
    luft = 5.0
    top = int(sidehoejde - hoejde - KANT_MARGEN)
    if top <= int(KANT_MARGEN):
        return None
    x_slut = max(int(KANT_MARGEN) + 1, int(sidebredde - bredde - KANT_MARGEN))
    for y in range(int(KANT_MARGEN), top, 4):
        for x in range(int(KANT_MARGEN), x_slut, 8):
            if er_frit(maske, sidehoejde, x - luft, y - luft,
                       bredde + 2 * luft, hoejde + 2 * luft):
                return float(x), float(y)
    return None


def bryd_tekst(tekst, skrift, stoerrelse, bredde):
    """Deler teksten op i linjer, der er smalle nok til noten.

    :returns: liste med linjer.
    """
    return simpleSplit(tekst, skrift, stoerrelse, bredde)


def maal_note(note, skrifter, loft=None):
    """Beregner notens mål og de linjer, der skal tegnes.

    :param loft: største tilladte bredde, når pladsen på diasset er trang.
    :returns: (bredde, hoejde, overskrift, linjer).
    """
    tekst_skrift, fed_skrift = skrifter
    overskrift = "%s  ·  %s" % (note["type"].upper(), note["titel"])
    bredde_overskrift = (pdfmetrics.stringWidth(overskrift, fed_skrift, 8.2)
                         + 2 * POLSTRING + IKON_PLADS)
    maks = NOTE_BREDDE_MAKS if loft is None else loft
    bredde = min(maks, max(min(NOTE_BREDDE_MIN, maks), bredde_overskrift))
    linjer = bryd_tekst(note["tekst"], tekst_skrift, 9.0, bredde - 2 * POLSTRING)
    if len(linjer) > 2 and bredde < maks:
        bredde = maks
        linjer = bryd_tekst(note["tekst"], tekst_skrift, 9.0, bredde - 2 * POLSTRING)
    hoejde = POLSTRING + 10.0 + len(linjer) * 11.5 + POLSTRING - 2
    return bredde, hoejde, overskrift, linjer


def tegn_laenkeikon(c, x, y, farve):
    """Tegner det lille »åbn i ny fane«-ikon, der viser at noten kan klikkes.

    :param c: reportlab-lærredet.
    :param x: venstre kant af ikonet i punkter.
    :param y: nederste kant af ikonet i punkter.
    :param farve: stregfarven.
    """
    c.saveState()
    c.setStrokeColor(farve)
    c.setLineWidth(0.85)
    c.setLineCap(1)
    # vinduet, åbent i øverste højre hjørne
    c.line(x, y, x + 6.4, y)
    c.line(x, y, x, y + 6.4)
    c.line(x, y + 6.4, x + 3.0, y + 6.4)
    c.line(x + 6.4, y, x + 6.4, y + 3.0)
    # pilen ud af vinduet
    c.line(x + 3.7, y + 2.7, x + 8.8, y + 7.8)
    c.line(x + 8.8, y + 7.8, x + 8.8, y + 4.3)
    c.line(x + 8.8, y + 7.8, x + 5.3, y + 7.8)
    c.restoreState()


def tegn_note(note, skrifter, sidebredde, sidehoejde, x, y, bredde, hoejde,
              overskrift, linjer, moerk_baggrund=False):
    """Tegner én note på en gennemsigtig side og returnerer den som PDF-bytes.

    :param moerk_baggrund: byt farverne om, når diasset selv er mørkt.
    """
    tekst_skrift, fed_skrift = skrifter
    buffer = io.BytesIO()
    c = rl_canvas.Canvas(buffer, pagesize=(sidebredde, sidehoejde))
    farve = ERSTAT_FARVE if note["type"] == "erstat" else BLAEK
    flade, blaek = (PAPIR, farve) if moerk_baggrund else (farve, PAPIR)
    c.setFillColor(flade)
    c.roundRect(x, y, bredde, hoejde, HJOERNE, stroke=0, fill=1)

    c.setFillColor(blaek)
    c.setFont(fed_skrift, 8.2)
    c.drawString(x + POLSTRING, y + hoejde - POLSTRING - 8.0, overskrift)

    c.setFillColor(blaek)
    tegn_laenkeikon(c, x + bredde - POLSTRING - 9.5, y + hoejde - POLSTRING - 9.0, blaek)

    c.setFillColor(blaek)
    c.setFont(tekst_skrift, 9.0)
    linje_y = y + hoejde - POLSTRING - 20.0
    for linje in linjer:
        c.drawString(x + POLSTRING, linje_y, linje)
        linje_y -= 11.5

    c.save()
    buffer.seek(0)
    return buffer


def allerede_noteret(laeser, basisurl):
    """Ser efter noter fra en tidligere kørsel, så de ikke bliver stablet oven på hinanden.

    :param laeser: den åbnede PDF.
    :param basisurl: kursussidens adresse, som noternes lænker peger på.
    :returns: True hvis PDF'en allerede indeholder mindst én note.
    """
    for side in laeser.pages:
        for annotation in side.get("/Annots", []) or []:
            try:
                handling = annotation.get_object().get("/A", {})
                if str(handling.get("/URI", "")).startswith(basisurl):
                    return True
            except Exception:
                continue
    return False


def hent_skabelonbilleder(laeser, sidenummer, mappe, sidebredde, sidehoejde):
    """Trækker diassættets egen baggrund og logo ud af et eksisterende dias.

    :param laeser: den åbnede PDF.
    :param sidenummer: det dias, skabelonen hentes fra (1-baseret).
    :param mappe: mappe til de udpakkede billeder.
    :returns: (baggrundssti, logosti), hvor begge kan være None.
    """
    os.makedirs(mappe, exist_ok=True)
    baggrund = None
    logo = None
    try:
        billeder = laeser.pages[sidenummer - 1].images
    except Exception:
        return None, None
    sideforhold = sidebredde / sidehoejde
    for billede in billeder:
        sti = os.path.join(mappe, billede.name)
        with open(sti, "wb") as f:
            f.write(billede.data)
        try:
            with Image.open(sti) as aabnet:
                bredde, hoejde = aabnet.size
        except Exception:
            continue
        forhold = bredde / max(1, hoejde)
        if abs(forhold - sideforhold) < 0.25 and bredde * hoejde > 200000:
            baggrund = sti
        elif forhold > 2.0:
            logo = sti
    return baggrund, logo


def dominerende_farve(dokument, sidenummer):
    """Finder diassættets grundfarve, når der ikke er et baggrundsbillede at genbruge.

    :returns: (r, g, b) i 0-1.
    """
    billede = dokument[sidenummer - 1].render(scale=0.5).to_pil().convert("RGB")
    lille = billede.resize((40, 24), Image.BOX)
    farve = max(lille.getcolors(40 * 24), key=lambda c: c[0])[1]
    return tuple(k / 255.0 for k in farve)


def byg_evalueringsside(opsaetning, url, sidebredde, sidehoejde, skrifter,
                        baggrund, logo, grundfarve, mappe):
    """Tegner det dias, der minder om at evaluere dagen.

    :param opsaetning: evalueringsblokken fra dias-noter.json.
    :param url: den fulde adresse til dagens evaluering.
    :returns: (pdf_buffer, laenkerektangel).
    """
    buffer = io.BytesIO()
    c = rl_canvas.Canvas(buffer, pagesize=(sidebredde, sidehoejde))
    tekst_skrift, fed_skrift = skrifter

    if baggrund:
        c.drawImage(baggrund, 0, 0, width=sidebredde, height=sidehoejde, mask=None)
        moerk = False
    else:
        c.setFillColorRGB(*grundfarve)
        c.rect(0, 0, sidebredde, sidehoejde, stroke=0, fill=1)
        lys = 0.299 * grundfarve[0] + 0.587 * grundfarve[1] + 0.114 * grundfarve[2]
        moerk = lys < 0.55

    blaek = PAPIR if moerk else BLAEK
    if logo and not moerk:
        c.drawImage(logo, sidebredde - 0.222 * sidebredde, 0.044 * sidehoejde,
                    width=0.1716 * sidebredde, height=0.0908 * sidehoejde, mask="auto")

    venstre = 0.1374 * sidebredde
    c.setFillColor(blaek)
    c.setFont(fed_skrift, 0.074 * sidehoejde)
    c.drawString(venstre, 0.76 * sidehoejde, "Evaluér dagen")

    c.setFont(tekst_skrift, 0.0325 * sidehoejde)
    linjer = [
        "Inden du går: to-tre minutter på, hvad der virkede, og hvad der ikke gjorde.",
        "Det er anonymt, og svarene bliver læst inden næste kursusgang.",
        "Det er dem, der afgør, hvad der bliver lavet om.",
    ]
    linje_y = 0.655 * sidehoejde
    for linje in linjer:
        c.drawString(venstre, linje_y, linje)
        linje_y -= 0.048 * sidehoejde

    knap_bredde = 0.315 * sidebredde
    knap_hoejde = 0.105 * sidehoejde
    knap_x = venstre
    knap_y = 0.235 * sidehoejde
    c.setFillColor(blaek)
    c.roundRect(knap_x, knap_y, knap_bredde, knap_hoejde, 0.018 * sidehoejde, stroke=0, fill=1)
    c.setFillColor(PAPIR if not moerk else BLAEK)
    c.setFont(fed_skrift, 0.036 * sidehoejde)
    c.drawString(knap_x + 0.028 * sidebredde, knap_y + knap_hoejde - 0.048 * sidehoejde,
                 "Åbn evalueringen")
    c.setFont(tekst_skrift, 0.026 * sidehoejde)
    kort_adresse = url.replace("https://", "").split("/evaluering")[0]
    c.drawString(knap_x + 0.028 * sidebredde, knap_y + 0.024 * sidehoejde, kort_adresse)
    tegn_laenkeikon(c, knap_x + knap_bredde - 0.045 * sidebredde,
                    knap_y + knap_hoejde - 0.05 * sidehoejde,
                    PAPIR if not moerk else BLAEK)

    qr_billede = qrcode.make(url, box_size=10, border=1)
    qr_sti = os.path.join(mappe, "qr-%s.png" % opsaetning["dag"])
    qr_billede.save(qr_sti)
    qr_side = 0.30 * sidehoejde
    qr_x = sidebredde - venstre - qr_side
    qr_y = 0.235 * sidehoejde
    c.setFillColor(PAPIR)
    c.roundRect(qr_x - 0.012 * sidebredde, qr_y - 0.022 * sidehoejde,
                qr_side + 0.024 * sidebredde, qr_side + 0.075 * sidehoejde,
                0.018 * sidehoejde, stroke=0, fill=1)
    c.drawImage(qr_sti, qr_x, qr_y + 0.03 * sidehoejde, width=qr_side, height=qr_side, mask=None)
    c.setFillColor(BLAEK)
    c.setFont(tekst_skrift, 0.024 * sidehoejde)
    c.drawCentredString(qr_x + qr_side / 2, qr_y + 0.002 * sidehoejde, "Scan og svar på telefonen")

    c.save()
    buffer.seek(0)
    laenke = (knap_x, knap_y, knap_x + knap_bredde, knap_y + knap_hoejde)
    return buffer, laenke


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
    if allerede_noteret(laeser, basisurl):
        return ["  SPRINGES OVER: %s har allerede noter. Gendan den rene udgave først, "
                "for eksempel med git checkout <commit før noterne> -- \"%s\"" %
                (saet["fil"], saet["fil"])]
    noter = {}
    for n in saet["noter"]:
        noter.setdefault(n["dias"], []).append(n)

    placeringer = {}
    for nummer, side_noter in sorted(noter.items()):
        if nummer < 1 or nummer > len(laeser.pages):
            rapport.append("  dias %s findes ikke i %s" % (nummer, saet["fil"]))
            continue
        maal = laeser.pages[nummer - 1].mediabox
        sidebredde = float(maal.width)
        sidehoejde = float(maal.height)
        maske, miniature = optaget_kort(dokument[nummer - 1], sidebredde, sidehoejde)
        for note in side_noter:
            plads = None
            for loft in (None, 175.0, 155.0, 140.0):
                bredde, hoejde, overskrift, linjer = maal_note(note, skrifter, loft)
                plads = find_plads(maske, sidebredde, sidehoejde, bredde, hoejde)
                if plads is not None:
                    break
            if plads is None:
                rapport.append("  dias %-3s INGEN PLADS  %s" % (nummer, note["titel"]))
                continue
            x, y = plads
            placeringer.setdefault(nummer, []).append({
                "note": note,
                "x": x,
                "y": y,
                "bredde": bredde,
                "hoejde": hoejde,
                "overskrift": overskrift,
                "linjer": linjer,
                "sidebredde": sidebredde,
                "sidehoejde": sidehoejde,
                "moerk": baggrund_er_moerk(miniature, sidehoejde, x, y, bredde, hoejde),
            })
            markér_optaget(maske, sidehoejde, x, y, bredde, hoejde)
            rapport.append("  dias %-3s %-6s x=%5.0f y=%5.0f  %s" %
                           (nummer, note["type"], x, y, note["titel"]))

    if kun_tjek:
        return rapport

    skriver = PdfWriter()
    if laeser.metadata:
        skriver.add_metadata(laeser.metadata)
    for i, side in enumerate(laeser.pages, start=1):
        for p in placeringer.get(i, []):
            overlag = PdfReader(tegn_note(
                p["note"], skrifter, p["sidebredde"], p["sidehoejde"],
                p["x"], p["y"], p["bredde"], p["hoejde"], p["overskrift"], p["linjer"],
                p["moerk"],
            )).pages[0]
            side.merge_page(overlag)
        skriver.add_page(side)

    for nummer, side_placeringer in placeringer.items():
        for p in side_placeringer:
            skriver.add_annotation(
                page_number=nummer - 1,
                annotation=Link(
                    rect=(p["x"], p["y"], p["x"] + p["bredde"], p["y"] + p["hoejde"]),
                    url=basisurl + p["note"]["url"],
                ),
            )

    opsaetning = saet.get("evaluering")
    if opsaetning:
        maal = laeser.pages[0].mediabox
        sidebredde = float(maal.width)
        sidehoejde = float(maal.height)
        mappe = os.path.join(ROOD, "scripts", ".skabelon")
        # Nogle diassæt har tunge billeder på hver side. At pakke dem ud tager
        # meget lang tid, og de sæt tegner alligevel deres baggrund som flader.
        if opsaetning.get("skabelonbilleder", True):
            baggrund, logo = hent_skabelonbilleder(
                laeser, opsaetning.get("skabelon_dias", 2), mappe, sidebredde, sidehoejde)
        else:
            baggrund, logo = None, None
            os.makedirs(mappe, exist_ok=True)
        grundfarve = dominerende_farve(dokument, opsaetning.get("skabelon_dias", 2))
        url = basisurl + "evaluering.html?dag=" + opsaetning["dag"]
        buffer, laenke = byg_evalueringsside(
            opsaetning, url, sidebredde, sidehoejde, skrifter,
            baggrund, logo, grundfarve, mappe)
        ny_side = PdfReader(buffer).pages[0]
        plads = opsaetning["efter_dias"]
        skriver.insert_page(ny_side, index=plads)
        skriver.add_annotation(page_number=plads, annotation=Link(rect=laenke, url=url))
        rapport.append("  evalueringsdias indsat som nr. %s" % (plads + 1))

    midlertidig = sti + ".ny"
    with open(midlertidig, "wb") as f:
        skriver.write(f)
    shutil.move(midlertidig, sti)
    antal = sum(len(v) for v in placeringer.values())
    rapport.append("  skrevet: %s (%s noter)" % (saet["fil"], antal))
    return rapport


def main():
    """Kører alle diassæt igennem og skriver en kort rapport."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

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
