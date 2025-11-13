from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS
from helpers.helpers import divide_nettoEk_by_menge
class InvoiceStarckeParser(BaseParser):
    def parse(self, pdf_path: str) -> tuple[pd.DataFrame, str]:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    text = text  + page.extract_text() + "\n"
            lines = text.split('\n')
            # print(lines)


            bestellnummer = []
            fremdbelegnummer_eingangsrechnung = "" # Rechnungsnummer des Lieferanten ohne Datum
            fremdbelegnummer_lieferantenbestellung: list[str] = [] # Auftragsnummer des Lieferanten ohne Datum
            lieferant = "STARCKE GmbH & Co. KG"
            zahlbar_bis = ""
            belegdatum = ""
            artikelnummer = [] # SKU
            artikelnummer_lieferant = [] # Artikelnummer des Lieferanten - Nicht die EAN
            artikelname = []
            hinweis = []
            menge = []
            netto_ek = [] # Kosten der gesamten POS
            MwST = "19" # Nur bei Plastimex 0
            # zahlungsbedingung = 60


            for i, line in enumerate(lines):
                if line.startswith("Zahlung:"):
                    zahlbar_bis = line.split()[-4]

                if line == "Nr." and belegdatum == "":
                    belegdatum = lines[i+1].split()[-1]
                    fremdbelegnummer_eingangsrechnung = lines[i+1].split()[-4]

                if line.startswith("Auftrags-Nr.:"):
                    fremdbelegnummer_lieferantenbestellung.append(line.split()[-2] + " " + line.split()[-1])

                if line.startswith("Bestell-Nr/"):
                    bestellnummer.append(line.split()[-1])

                if len(line.split()) > 3 and line.split()[0].isnumeric() and not "50933" in line and not "koeln" in line.lower():
                    if len(artikelnummer) < len(artikelname):
                        artikelnummer.append("N/A")
                    if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                        fremdbelegnummer_lieferantenbestellung.append(fremdbelegnummer_lieferantenbestellung[-1])
                    if len(bestellnummer) < len(artikelname):
                        bestellnummer.append(bestellnummer[-1])
                    if len(hinweis) < len(artikelname):
                        hinweis.append("N/A")

                    artikelnummer_lieferant.append(line.split()[1])
                    netto_ek.append(line.split()[-1])
                    artikelname.append(" ")
                    count_preise = 0
                    menge_fertig = False
                    for element in reversed(line.split()):
                        if "," in element and not "%" in element:
                            count_preise += 1
                        if count_preise == 2 and element.isnumeric() and not menge_fertig:
                            menge.append(element)
                            menge_fertig = True
                        if element == artikelnummer_lieferant[-1]:
                            break
                        if menge_fertig:
                            artikelname[-1] = element + " " + artikelname[-1]
                    artikelname[-1] = lines[i+1] + " " + artikelname[-1]
                
                if line.startswith("Kd-Artikel-Nr.:"):
                    artnum = line.split()[-1]
                    if "/" in artnum:
                        artnum = artnum.split("/")[0]
                    artikelnummer.append(artnum)
                        


                
            if len(artikelnummer) < len(artikelname):
                artikelnummer.append("N/A")
            if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                fremdbelegnummer_lieferantenbestellung.append(fremdbelegnummer_lieferantenbestellung[-1])
            if len(bestellnummer) < len(artikelname):
                bestellnummer.append(bestellnummer[-1])
            if len(hinweis) < len(artikelname):
                hinweis.append("N/A")


            artikel_data = []
            for i in range(len(artikelname)):
                netto_ek[i] = divide_nettoEk_by_menge(netto_ek[i], menge[i])
                artikel_data.append([bestellnummer[i], fremdbelegnummer_eingangsrechnung, fremdbelegnummer_lieferantenbestellung[i], lieferant, zahlbar_bis, belegdatum, artikelnummer[i], artikelnummer_lieferant[i], artikelname[i], hinweis[i], menge[i], netto_ek[i], MwST])
            df = pd.DataFrame(artikel_data, columns=INVOICE_COLUMNS)

            return df, fremdbelegnummer_eingangsrechnung

        except Exception as e:
            print(f"Fehler beim Parsen der Rechnung: {e}")
            return pd.DataFrame(), ""

