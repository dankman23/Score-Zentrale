import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS
from helpers.date_helpers import zahlbar_bis_x_tage_nach_datum
from helpers.helpers import divide_nettoEk_by_menge

from parsers.base_parser import BaseParser


class InvoicePferdParser(BaseParser):
    def parse(self, pdf_path: str) -> tuple[pd.DataFrame, str]:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    text = text  + page.extract_text() + "\n"
            lines = text.split('\n')

            bestellnummer = ""
            fremdbelegnummer_eingangsrechnung = "" # Rechnungsnummer des Lieferanten ohne Datum
            fremdbelegnummer_lieferantenbestellung = [] # Auftragsnummer des Lieferanten ohne Datum
            lieferant = "August Rüggeberg GmbH & Co. KG"
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

            auftragskosten = ""
            neueste_auftragsnummer = ""

            # print(lines)
            for i, line in enumerate(lines):
                if "Nummer/Datum" in line:
                    fremdbelegnummer_eingangsrechnung = lines[i+1].split()[-3]
                    belegdatum = lines[i+1].split()[-1]
                    zahlbar_bis = zahlbar_bis_x_tage_nach_datum(belegdatum, zahlungsbedingung)
                    continue
                
                if "Referenznummer/Datum" in line:
                    bestellnummer = lines[i+1].strip()
                    continue

                if "Auftragsnummer/Datum" in line:
                    neueste_auftragsnummer = lines[i+1].split()[-3]
                    continue

                if line.startswith("Auftragskosten ") and not "Standardabwicklung" in line:
                    auftragskosten = line.split()[-1]
                    continue

                if line.startswith("Auftrag "):
                    neueste_auftragsnummer = line.split()[1]

                if len(line.split()) > 2 and line.split()[0].isnumeric() and line.split()[1].isnumeric() and not "50937" in line and not "- % " in line:
                    if len(artikelnummer) < len(artikelname):
                        artikelnummer.append("N/A")
                    if len(hinweis) < len(artikelname):
                        hinweis.append("")
                    fremdbelegnummer_lieferantenbestellung.append(neueste_auftragsnummer)
                    artikelname.append(" ".join(line.split()[2:]))
                    artikelnummer_lieferant.append(line.split()[1])
                    continue

                if line.startswith("Kundenartikelnummer "):
                    artikelnummer.append(line.split()[1])

                if "- % " in line:
                    netto_ek.append(line.split()[-1])
                    menge.append(line.split()[0])
                    

            if len(artikelnummer) < len(artikelname):
                artikelnummer.append("N/A")
            if len(hinweis) < len(artikelname):
                hinweis.append("")
            

            # Die Zeile für die Auftragskosten wird als letztes hinzugefügt
            fremdbelegnummer_lieferantenbestellung.append("N/A")
            netto_ek.append(auftragskosten)
            artikelnummer.append("N/A")
            artikelnummer_lieferant.append("N/A")
            artikelname.append("Auftragskosten")
            hinweis.append("N/A")
            menge.append(1)

            artikel_data = []
            for i in range(len(artikelname)):
                netto_ek[i] = divide_nettoEk_by_menge(netto_ek[i], menge[i])
                artikel_data.append([bestellnummer, fremdbelegnummer_eingangsrechnung, fremdbelegnummer_lieferantenbestellung[i], lieferant, zahlbar_bis, belegdatum, artikelnummer[i], artikelnummer_lieferant[i], artikelname[i], hinweis[i], menge[i], netto_ek[i], MwST])
            df = pd.DataFrame(artikel_data, columns=INVOICE_COLUMNS)

            return df, fremdbelegnummer_eingangsrechnung

        except Exception as e:
            print(f"Fehler beim Parsen der Rechnung: {e}")
            return pd.DataFrame(), ""
