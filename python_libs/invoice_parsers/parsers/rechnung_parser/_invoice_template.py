from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS

class InvoiceTemplateParser(BaseParser):
    def parse(self, pdf_path: str) -> tuple[pd.DataFrame, str]:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    text = text  + page.extract_text() + "\n"
            lines = text.split('\n')
            # print(lines)


            ### TODO: Hier die spezifischen Parsing-Regeln für die Rechnung einfügen 
            bestellnummer = []
            fremdbelegnummer_eingangsrechnung = "" # Rechnungsnummer des Lieferanten ohne Datum
            fremdbelegnummer_lieferantenbestellung: list[str] = [] # Auftragsnummer des Lieferanten ohne Datum
            lieferant = "KLINGSPOR Schleifsysteme GmbH & Co.KG"
            zahlbar_bis = ""
            belegdatum = ""
            artikelnummer = [] # SKU
            artikelnummer_lieferant = [] # Artikelnummer des Lieferanten - Nicht die EAN
            artikelname = []
            hinweis = []
            menge = []
            netto_ek = [] # Kosten der gesamten POS
            MwST = "19" # Nur bei Plastimex 0
            zahlungsbedingung = 60


            for i, line in enumerate(lines):
                pass

                
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
                artikel_data.append([bestellnummer[i], fremdbelegnummer_eingangsrechnung, fremdbelegnummer_lieferantenbestellung[i], lieferant, zahlbar_bis, belegdatum, artikelnummer[i], artikelnummer_lieferant[i], artikelname[i], hinweis[i], menge[i], netto_ek[i], MwST])
            df = pd.DataFrame(artikel_data, columns=INVOICE_COLUMNS)

            return df, fremdbelegnummer_eingangsrechnung

        except Exception as e:
            print(f"Fehler beim Parsen der Rechnung: {e}")
            return pd.DataFrame(), ""

