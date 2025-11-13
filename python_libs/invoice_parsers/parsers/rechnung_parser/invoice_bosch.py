from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS
from helpers.date_helpers import zahlbar_bis_x_tage_nach_datum
from helpers.helpers import divide_nettoEk_by_menge

class InvoiceBoschParser(BaseParser):
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
            lieferant = "Robert Bosch Power Tools GmbH"
            zahlbar_bis = ""
            belegdatum = ""
            artikelnummer = [] # SKU - Gibt es hier nicht
            artikelnummer_lieferant = [] # Artikelnummer des Lieferanten - Nicht die EAN
            artikelname = []
            hinweis = []
            menge = []
            netto_ek = [] # Kosten der gesamten POS
            MwST = "19" # Nur bei Plastimex 0
            zahlungsbedingung = 14

            auftragskosten = ""
            letzte_bestellnummer = ""
            letzte_fremdbelegnummer_lieferantenbestellung = ""

            for i, line in enumerate(lines):
                if line == "70538 Stuttgart, Deutschland" and belegdatum == "":
                    belegdatum = lines[i+1].split()[-2]
                    zahlbar_bis = zahlbar_bis_x_tage_nach_datum(belegdatum, zahlungsbedingung)
                    fremdbelegnummer_eingangsrechnung = lines[i+1].split()[-1]

                if line.startswith("Ihre Bestellung ") and not "Auftragspauschale" in lines[i-1]:
                    letzte_bestellnummer = line.split()[-1]

                if line.startswith("Unser(e) Standardauftr"):
                    letzte_fremdbelegnummer_lieferantenbestellung = ", ".join(line.split()[2:])

                if len(line.split()) > 4 and line.split()[0].isnumeric() and line.split()[1].replace(".", "").isnumeric() and line.split()[2].isnumeric():
                    if len(artikelnummer) < len(artikelname):
                        artikelnummer.append("N/A")
                    if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                        fremdbelegnummer_lieferantenbestellung.append(letzte_fremdbelegnummer_lieferantenbestellung)
                    if len(bestellnummer) < len(artikelname):
                        bestellnummer.append(letzte_bestellnummer)
                    if len(hinweis) < len(artikelname):
                        hinweis.append("N/A")

                    artikelnummer_lieferant.append(line.split()[1])
                    menge.append(line.split()[2])
                    netto_ek.append(line.split()[-1])
                    j = 1
                    while lines[i+j].split()[0].isnumeric() == False and not ("(D)" in lines[i+j] or "(L)" in lines[i+j]):
                        j += 1

                    artikelname.append(" ".join(lines[i+1:i+j]).strip())

                if line.startswith("Auftragspauschale"):
                    auftragskosten = lines[i+1].split()[-1]

                
            if len(artikelnummer) < len(artikelname):
                artikelnummer.append("N/A")
            if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                fremdbelegnummer_lieferantenbestellung.append(letzte_fremdbelegnummer_lieferantenbestellung)
            if len(bestellnummer) < len(artikelname):
                bestellnummer.append(letzte_bestellnummer)
            if len(hinweis) < len(artikelname):
                hinweis.append("N/A")

            bestellnummer.append(letzte_bestellnummer)
            fremdbelegnummer_lieferantenbestellung.append(letzte_fremdbelegnummer_lieferantenbestellung)
            hinweis.append("N/A")
            artikelnummer.append("N/A")
            artikelnummer_lieferant.append("N/A")
            artikelname.append("Auftragspauschale")
            menge.append("1")
            netto_ek.append(auftragskosten)



            artikel_data = []
            for i in range(len(artikelname)):
                netto_ek[i] = divide_nettoEk_by_menge(netto_ek[i], menge[i])
                artikel_data.append([bestellnummer[i], fremdbelegnummer_eingangsrechnung, fremdbelegnummer_lieferantenbestellung[i], lieferant, zahlbar_bis, belegdatum, artikelnummer[i], artikelnummer_lieferant[i], artikelname[i], hinweis[i], menge[i], netto_ek[i], MwST])
            df = pd.DataFrame(artikel_data, columns=INVOICE_COLUMNS)

            return df, fremdbelegnummer_eingangsrechnung

        except Exception as e:
            print(f"Fehler beim Parsen der Rechnung: {e}")
            return pd.DataFrame(), ""

