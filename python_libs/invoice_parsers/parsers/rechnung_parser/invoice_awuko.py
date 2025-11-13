from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS
from helpers.date_helpers import zahlbar_bis_x_tage_nach_datum
from helpers.helpers import divide_nettoEk_by_menge

class InvoiceAwukoParser(BaseParser):
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
            lieferant = "CUMI AWUKO Abrasives GmbH"
            zahlbar_bis = ""
            belegdatum = ""
            artikelnummer = [] # SKU
            artikelnummer_lieferant = [] # Artikelnummer des Lieferanten - Nicht die EAN
            artikelname = []
            hinweis = []
            menge = []
            netto_ek = [] # Kosten der gesamten POS
            MwST = "19" # Nur bei Plastimex 0
            zahlungsbedingung = 30


            for i, line in enumerate(lines):
                if line.startswith("Rechnung Nr.") and fremdbelegnummer_eingangsrechnung == "":
                    fremdbelegnummer_eingangsrechnung = line.split()[-1]
                    belegdatum = lines[i-1].split()[-1]
                    zahlbar_bis = zahlbar_bis_x_tage_nach_datum(belegdatum, zahlungsbedingung)

                if len(line.split()) > 3 and line.split()[0][:-1].isnumeric() and line.split()[0][-1] == "." and not "50933" in line and not "köln" in line.lower() and not "34346" in line:
                    if len(artikelnummer) < len(artikelname):
                        artikelnummer.append("N/A")
                    if len(artikelnummer_lieferant) < len(artikelname):
                        artikelnummer_lieferant.append("N/A")
                    if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                        fremdbelegnummer_lieferantenbestellung.append("N/A")
                    if len(bestellnummer) < len(artikelname):
                        bestellnummer.append("N/A")
                    if len(hinweis) < len(artikelname):
                        hinweis.append("N/A")
                    
                    artikelname.append(line.split()[1])
                    artikelname[-1] += " " + lines[i+1]
                    menge.append(line.split()[2])
                    netto_ek.append(line.split()[-1])

                if line.startswith("Artikelnr.:"):
                    artikelnummer_lieferant.append(line.split()[1])
                
                if line.startswith("LS") and "Ihre Artikelnr." in line:
                    artikelnummer.append(line.split()[-1])

                if line.startswith("Unser Auftrag:"):
                    fremdbelegnummer_lieferantenbestellung.append(line.split()[1])
                    bestellnummer.append(" ".join(line.split()[5:-1]))
                
            if len(artikelnummer) < len(artikelname):
                artikelnummer.append("N/A")
            if len(artikelnummer_lieferant) < len(artikelname):
                artikelnummer_lieferant.append("N/A")
            if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                fremdbelegnummer_lieferantenbestellung.append("N/A")
            if len(bestellnummer) < len(artikelname):
                bestellnummer.append("N/A")
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
