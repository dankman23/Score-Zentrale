from helpers.date_helpers import zahlbar_bis_x_tage_nach_datum
from helpers.helpers import divide_nettoEk_by_menge

from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS

class InvoiceVSMParser(BaseParser):
    def parse(self, pdf_path: str) -> tuple[pd.DataFrame, str]:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    text = text  + page.extract_text() + "\n"
            lines = text.split('\n')
            # print(lines)


            bestellnummer = ""
            fremdbelegnummer_eingangsrechnung = "" # Rechnungsnummer des Lieferanten ohne Datum
            fremdbelegnummer_lieferantenbestellung = "" # Auftragsnummer des Lieferanten ohne Datum
            lieferant = "VSM · Vereinigte Schmirgel- und Maschinen-Fabriken AG"
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


            letzte_pos = 0

            for i, line in enumerate(lines):
                if line.startswith("Rechnungs-Nr.:"):
                    fremdbelegnummer_eingangsrechnung = line.split(":")[1].strip()

                if line.startswith("Datum"):
                    belegdatum = line.split()[1].strip()
                    zahlbar_bis = zahlbar_bis_x_tage_nach_datum(belegdatum, zahlungsbedingung, format="%d.%m.%y")

                if line.startswith("Ihre Bestellung"):
                    bestellnummer = line.split()[2]
                    fremdbelegnummer_lieferantenbestellung = line.split()[-1]

                if len(line.split()) > 3 and line.split()[0].isnumeric() and line.split()[1].isnumeric() and int(line.split()[0]) == letzte_pos + 1:
                    if len(artikelnummer) < len(artikelname):
                        artikelnummer.append("N/A")
                    if len(hinweis) < len(artikelname):
                        hinweis.append("N/A")
                    letzte_pos += 1
                    netto_ek.append(line.split()[-1])
                    menge.append(line.split()[-5])
                    artikelnummer_lieferant.append(line.split()[1] + " / " + lines[i+1].split()[0])
                    artikelname.append(" ".join(line.split()[2:-5]))
                    if not lines[i+1].startswith("Ihre Nr."):
                        artikelname[-1] += " " + lines[i+1]
                
                if line.startswith("Ihre Nr."):
                    artikelnummer.append(line.split()[-1])




                
            if len(artikelnummer) < len(artikelname):
                artikelnummer.append("N/A")
            if len(hinweis) < len(artikelname):
                hinweis.append("N/A")


            artikel_data = []
            for i in range(len(artikelname)):
                netto_ek[i] = divide_nettoEk_by_menge(netto_ek[i], menge[i])
                artikel_data.append([bestellnummer, fremdbelegnummer_eingangsrechnung, fremdbelegnummer_lieferantenbestellung, lieferant, zahlbar_bis, belegdatum, artikelnummer[i], artikelnummer_lieferant[i], artikelname[i], hinweis[i], menge[i], netto_ek[i], MwST])
            df = pd.DataFrame(artikel_data, columns=INVOICE_COLUMNS)

            return df, fremdbelegnummer_eingangsrechnung

        except Exception as e:
            print(f"Fehler beim Parsen der Rechnung: {e}")
            return pd.DataFrame(), ""
