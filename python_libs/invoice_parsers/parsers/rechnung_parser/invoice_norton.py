from helpers.date_helpers import zahlbar_bis_x_tage_nach_datum
from helpers.helpers import divide_nettoEk_by_menge

from parsers.base_parser import BaseParser
import pandas as pd
import pdfplumber
from helpers.constants import INVOICE_COLUMNS

class InvoiceNortonParser(BaseParser):
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
            lieferant = "Saint-Gobain Abrasives GmbH"
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

            letzte_pos = 0


            for i, line in enumerate(lines):
                if "RECHNUNGSDATUM" in line and belegdatum == "":
                    belegdatum = line.split()[-1]
                    zahlbar_bis = zahlbar_bis_x_tage_nach_datum(belegdatum, zahlungsbedingung)
                    continue

                if "RECHNUNGSNUMMER" in line:
                    fremdbelegnummer_eingangsrechnung = line.split()[-1]
                    continue
                
                if len(line.split()) > 3 and line.split()[0].isnumeric() and int(line.split()[0]) == letzte_pos + 1 and not "50937" in line and not "Koeln" in line:
                    if len(artikelnummer) < len(artikelname):
                        artikelnummer.append("N/A")
                    if len(fremdbelegnummer_lieferantenbestellung) < len(artikelname):
                        fremdbelegnummer_lieferantenbestellung.append("N/A")
                    if len(bestellnummer) < len(artikelname):
                        bestellnummer.append("N/A")
                    if len(hinweis) < len(artikelname):
                        hinweis.append("N/A")
                    
                    letzte_pos = int(line.split()[0])
                    artikelnummer_lieferant.append(line.split()[1])
                    menge.append(line.split()[2])
                    
                    if not "Saint-Gobain Abrasives GmbH" in lines[i+1]:
                        j = 0
                        while lines[i+j][0].isnumeric():
                            j += 1
                        netto_ek.append(lines[i+j-1].split()[-1])
                        
                        if "BISHERIGE / KUNDEN ART. NR.:"in lines[i+j]:
                            j += 1

                        k = 0
                        while not "Nettogewicht" in lines[i+j+k]:
                            k += 1
                        
                        artikelname.append(" ".join(lines[i+j:i+j+k]))

                    else:
                        # Es gibt einen Seitenumbruch
                        new_i = i
                        while lines[new_i] != "PRODUKTBEZEICHNUNG":
                            # also müssen wir ab dem neuen Tabellenheader wieder anfangen
                            new_i += 1

                        j = 1
                        while lines[new_i+j][0].isnumeric():
                            j += 1
                        
                        if line.split()[-1] != "ST":
                            netto_ek.append(line.split()[-1])
                        else:
                            netto_ek.append(lines[new_i+j-1].split()[-1])
                        
                        if "BISHERIGE / KUNDEN ART. NR.:"in lines[new_i+j]:
                            j += 1

                        k = 0
                        while not "Nettogewicht" in lines[new_i+j+k]:
                            k += 1
                        
                        artikelname.append(" ".join(lines[new_i+j:new_i+j+k]))

                if line.startswith("Auftragsnummer:"):
                    fremdbelegnummer_lieferantenbestellung.append(line.split()[1])
                    bestellnummer.append(line.split()[-1])

                if line.startswith("SKU"):
                    artikelnummer.append(line.split()[-1])
                
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

