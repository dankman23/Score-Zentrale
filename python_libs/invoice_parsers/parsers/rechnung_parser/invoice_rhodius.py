from operator import le
from helpers.date_helpers import zahlbar_bis_x_tage_nach_datum
from helpers.helpers import divide_nettoEk_by_menge

from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS

class InvoiceRhodiusParser(BaseParser):
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
            lieferant = "RHODIUS Abrasives GmbH"
            zahlbar_bis = ""
            belegdatum = ""
            artikelnummer = [] # SKU
            artikelnummer_lieferant = [] # Artikelnummer des Lieferanten - Nicht die EAN
            artikelname = []
            hinweis = []
            menge = []
            netto_ek = [] # Kosten der gesamten POS
            MwST = "19" # Nur bei Plastimex 0
            zahlungsbedingung = 14

            lieferkosten = ""
            letzte_pos = 0

            for i, line in enumerate(lines):
                if "Rechnung: " in line and fremdbelegnummer_eingangsrechnung == "":
                    index_rechnung = line.index("Rechnung: ")
                    index_datum = line.index("Datum : ")
                    fremdbelegnummer_eingangsrechnung = line[index_rechnung + 10:index_datum].strip()
                    belegdatum = line[index_datum:].split()[2]
                    zahlbar_bis = zahlbar_bis_x_tage_nach_datum(belegdatum, zahlungsbedingung)
                    continue
                    
                if line.startswith("VK-Auftrag"):
                    fremdbelegnummer_lieferantenbestellung.append(line.split()[2] + " " + line.split()[3])
                    bestellnummer.append(line.split()[-1])
                    continue

                if len(line.split()) > 3 and line.split()[0].isnumeric() and line.split()[1].isnumeric() and int(line.split()[0]) == letzte_pos + 1:
                    if len(artikelnummer) < len(artikelname):
                        artikelnummer.append("N/A")
                    if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                        fremdbelegnummer_lieferantenbestellung.append(fremdbelegnummer_lieferantenbestellung[-1])
                    if len(bestellnummer) < len(artikelname):
                        bestellnummer.append(bestellnummer[-1])
                    if len(hinweis) < len(artikelname):
                        hinweis.append("N/A")
                    letzte_pos += 1
                    artikelnummer_lieferant.append(line.split()[1])
                    for data in line.split()[2:]:
                        if data.isnumeric():
                            artikelnummer_lieferant[-1] += ", " + data
                        else:
                            menge.append(data)
                            break
                    netto_ek.append(line.split()[-1])
                
                    j = 1
                    while not lines[i+j].split()[0].isnumeric() and not lines[i+j].startswith("AU20"):
                        j += 1

                    artikelname.append(" ".join(lines[i+1:i+j]))
                
                if line.startswith("PORTO / FRACHTKOSTEN"):
                    lieferkosten = lines[i-1].split()[-1]
                    
                
            if len(artikelnummer) < len(artikelname):
                artikelnummer.append("N/A")
            if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                fremdbelegnummer_lieferantenbestellung.append(fremdbelegnummer_lieferantenbestellung[-1])
            if len(bestellnummer) < len(artikelname):
                bestellnummer.append(bestellnummer[-1])
            if len(hinweis) < len(artikelname):
                hinweis.append("N/A")


            bestellnummer.append(bestellnummer[-1])
            fremdbelegnummer_lieferantenbestellung.append("N/A")
            lieferant = "RHODIUS Abrasives GmbH"
            artikelnummer.append("N/A")
            artikelnummer_lieferant.append("900101")
            artikelname.append("Porto / Frachtkosten")
            hinweis.append("N/A")
            menge.append("1")
            netto_ek.append(lieferkosten)

            artikel_data = []
            for i in range(len(artikelname)):
                netto_ek[i] = divide_nettoEk_by_menge(netto_ek[i], menge[i])
                artikel_data.append([bestellnummer[i], fremdbelegnummer_eingangsrechnung, fremdbelegnummer_lieferantenbestellung[i], lieferant, zahlbar_bis, belegdatum, artikelnummer[i], artikelnummer_lieferant[i], artikelname[i], hinweis[i], menge[i], netto_ek[i], MwST])
            df = pd.DataFrame(artikel_data, columns=INVOICE_COLUMNS)

            return df, fremdbelegnummer_eingangsrechnung

        except Exception as e:
            print(f"Fehler beim Parsen der Rechnung: {e}")
            return pd.DataFrame(), ""

