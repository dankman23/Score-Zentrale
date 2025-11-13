from helpers.date_helpers import zahlbar_bis_x_tage_nach_datum
from helpers.helpers import divide_nettoEk_by_menge

from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS

class InvoicePlastimexParser(BaseParser):
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
            lieferant = "MK PLASTIMEX sp. z o.o."
            zahlbar_bis = ""
            belegdatum = ""
            artikelnummer = [] # SKU
            artikelnummer_lieferant = [] # Artikelnummer des Lieferanten - Nicht die EAN
            artikelname = []
            hinweis = []
            menge = []
            netto_ek = [] # Kosten der gesamten POS
            MwST = "0" # Nur bei Plastimex 0 wegen EU
            zahlungsbedingung = 14


            for i, line in enumerate(lines):
                if line.startswith("Data wystawienia:"):
                    belegdatum = lines[i+1].strip()
                    zahlbar_bis = zahlbar_bis_x_tage_nach_datum(belegdatum, zahlungsbedingung)

                if line.startswith("Faktura VAT") and not fremdbelegnummer_eingangsrechnung:
                    fremdbelegnummer_eingangsrechnung = line.split(" ")[-1]

                if len(line.split()) > 4 and line.split()[0].isnumeric() and "," in line.split()[-1]:
                    netto_ek.append(line.split()[-1])
                    menge.append(line.split()[-6])
                    artikelnummer_lieferant.append(line.split()[-7])
                    artikelname.append(" ".join(line.split()[1:-7]))
                    bestellnummer.append(belegdatum)
                    fremdbelegnummer_lieferantenbestellung.append("N/A")
                    hinweis.append("N/A")
                    artikelnummer.append("N/A")


                
            if len(artikelnummer) < len(artikelname):
                artikelnummer.append("N/A")
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

