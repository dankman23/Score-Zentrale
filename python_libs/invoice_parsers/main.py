import os
import sys
import shutil
from datetime import datetime
import pandas as pd
from typing import Literal

import pdfplumber

from file_handlers.pdf_handler import get_parser
from file_handlers.csv_manager import save_csv_files


def main():
    if len(sys.argv) < 6:
        print("Falsche Anzahl an Argumenten. Erwartete Argumente:")
        print("main.py pfad_ordner_mit_pdfs pfad_ordner_bearbeitete_pdfs pfad_ordner_tabellen pfad_gesammelte_tabelle dokument_typ")
        return

    ORDNER_MIT_PDFS = sys.argv[1]
    ORDNER_BEARBEITETE_PDFS = sys.argv[2]
    ORDNER_TABELLEN = sys.argv[3]
    GESAMMELTE_TABELLE = sys.argv[4]
    dokument_typ_str = sys.argv[5]
    if dokument_typ_str not in ["AB", "invoice"]:
        print("Ungültiger Dokumenttyp. Erwartet: 'AB' oder 'invoice'")
        return
    DOKUMENT_TYP: Literal['AB', 'invoice'] = dokument_typ_str  # type: ignore # "AB" or "invoice"
    pdf_files = [f for f in os.listdir(ORDNER_MIT_PDFS) if f.lower().endswith(".pdf")]

    for pdf_file in pdf_files:
        pdf_path = os.path.join(ORDNER_MIT_PDFS, pdf_file)
        print(f"Verarbeite Datei: {pdf_file}")

        # Identify the company and get the appropriate parser
        firma, erfolgreich_firma_ausgelesen = identify_company(pdf_path)
        if not erfolgreich_firma_ausgelesen:
            print(f"Firma konnte nicht erkannt werden. Überspringe Datei: {pdf_file}")
            continue

        parser = get_parser(firma, DOKUMENT_TYP)
        if not parser:
            print(f"Kein Parser verfügbar für {firma} und Typ {DOKUMENT_TYP}. Überspringe Datei.")
            continue

        # Parse the PDF
        df, identifier = parser.parse(pdf_path)
        if df.empty:
            print(f"Keine Daten extrahiert aus {pdf_file}. Überspringe Datei.")
            continue
        identifier = identifier.replace(" ", "-").replace("/", "-").replace("\\", "-").replace(":", "-")
        # Save data to specific and ongoing CSV files
        specific_csv_path = os.path.join(ORDNER_TABELLEN, f"{identifier}_{datetime.now().strftime('%Y-%m-%d_%H.%M.%S')}.csv")
        # print("Path: ", specific_csv_path)
        success = save_csv_files(ongoing_csv_path=GESAMMELTE_TABELLE, specific_csv_path=specific_csv_path, new_data_df=df)

        if not success:
            print(f"Fehler beim Speichern der Daten für {pdf_file}. Überspringe Datei.")
            continue

        # Move processed PDF to the archive folder
        try:
            archive_name = f"{os.path.splitext(pdf_file)[0]}_{identifier}_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.pdf"
            shutil.move(pdf_path, os.path.join(ORDNER_BEARBEITETE_PDFS, archive_name))
            print(f"Datei {pdf_file} erfolgreich verarbeitet und verschoben.")
        except shutil.Error as e:
            print(f"Fehler beim Verschieben der Datei {pdf_file}: {e}")


def identify_company(pdf_path: str) -> tuple[str, bool]:
    try:
        with open(pdf_path, "rb") as f:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    text = text  + page.extract_text().lower() + "\n"
            if "klingspor" in text:
                return "Klingspor", True
            elif "saint-gobain" in text:
                return "Norton", True
            elif "starcke" in text:
                return "Starcke", True
            elif "vsm" in text:
                return "VSM", True
            elif "rhodius" in text:
                return "Rhodius", True
            elif "august rüggeberg" in text:
                return "Pferd", True
            elif "cumi awuko" in text:
                return "Awuko", True
            elif "robert bosch" in text:
                return "Bosch", True
            elif "plastimex" in text:
                return "Plastimex", True
            else:
                return "", False
    except Exception as e:
        print(f"Fehler beim Erkennen der Firma: {e}")
        return "", False


if __name__ == "__main__":
    main()
