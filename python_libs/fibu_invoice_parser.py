#!/usr/bin/env python3
"""
FIBU Invoice Parser
Integriert die vorhandenen Python-Parser für EK-Rechnungen
"""

import sys
import os
import json
import base64
from io import BytesIO
from datetime import datetime
import tempfile

# Add invoice_parsers to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'invoice_parsers'))

import pdfplumber
from parsers.base_parser import BaseParser
from parsers.rechnung_parser.invoice_klingspor import InvoiceKlingsporParser
from parsers.rechnung_parser.invoice_pferd import InvoicePferdParser
from parsers.rechnung_parser.invoice_vsm import InvoiceVSMParser
from parsers.rechnung_parser.invoice_starcke import InvoiceStarckeParser


PARSER_REGISTRY = {
    "klingspor": InvoiceKlingsporParser,
    "pferd": InvoicePferdParser,
    "rüggeberg": InvoicePferdParser,
    "ruggeberg": InvoicePferdParser,
    "vsm": InvoiceVSMParser,
    "starcke": InvoiceStarckeParser,
}


def identify_company(pdf_path: str) -> tuple[str, bool]:
    """
    Identifiziert den Lieferanten aus dem PDF-Text
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text = ""
            for page in pdf.pages[:2]:  # Nur erste 2 Seiten für Performance
                page_text = page.extract_text()
                if page_text:
                    text += page_text.lower() + "\n"
        
        # Mapping für Firma -> Parser-Key
        if "klingspor" in text:
            return "klingspor", True
        elif "august rüggeberg" in text or "pferd" in text:
            return "pferd", True
        elif "starcke" in text:
            return "starcke", True
        elif "vsm" in text or "vereinigte schmirgel" in text:
            return "vsm", True
        else:
            return "", False
            
    except Exception as e:
        print(f"Fehler beim Identifizieren: {e}", file=sys.stderr)
        return "", False


def parse_invoice_from_base64(pdf_base64: str, filename: str = "") -> dict:
    """
    Parst eine Rechnung aus Base64-kodiertem PDF
    
    Args:
        pdf_base64: Base64-kodierter PDF-Inhalt
        filename: Dateiname für Hinweise
    
    Returns:
        dict mit:
        - success: bool
        - lieferant: str
        - rechnungsnummer: str
        - datum: str (ISO format)
        - gesamtbetrag: float
        - nettobetrag: float
        - positions: list (optional, für spätere Erweiterung)
        - parsing_method: str
        - confidence: int
        - error: str (bei Fehler)
    """
    try:
        # Decode Base64
        pdf_bytes = base64.b64decode(pdf_base64)
        
        # Erstelle temporäre Datei
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(pdf_bytes)
            tmp_path = tmp_file.name
        
        try:
            # 1. Identifiziere Firma
            firma_key, found = identify_company(tmp_path)
            
            if not found:
                return {
                    "success": False,
                    "error": "Lieferant konnte nicht identifiziert werden",
                    "confidence": 0
                }
            
            # 2. Hole passenden Parser
            parser_class = PARSER_REGISTRY.get(firma_key)
            if not parser_class:
                return {
                    "success": False,
                    "error": f"Kein Parser verfügbar für {firma_key}",
                    "confidence": 0
                }
            
            # 3. Parse PDF
            parser = parser_class()
            df, identifier = parser.parse(tmp_path)
            
            if df.empty:
                return {
                    "success": False,
                    "error": "Keine Daten aus PDF extrahiert",
                    "confidence": 20
                }
            
            # 4. Extrahiere Rechnungsdaten
            # DataFrame hat Spalten: siehe INVOICE_COLUMNS
            first_row = df.iloc[0]
            
            lieferant = first_row['lieferant'] if 'lieferant' in df.columns else firma_key
            rechnungsnummer = identifier or first_row.get('fremdbelegnummer_eingangsrechnung', 'Unbekannt')
            datum_str = first_row.get('belegdatum', '')
            
            # Parse Datum
            try:
                # Format: DD.MM.YYYY
                if '.' in datum_str:
                    parts = datum_str.split('.')
                    datum = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                else:
                    datum = datetime.now().strftime('%Y-%m-%d')
            except:
                datum = datetime.now().strftime('%Y-%m-%d')
            
            # Berechne Gesamtbetrag aus allen Positionen
            # WICHTIG: netto_ek ist bereits PREIS PRO STÜCK (durch divide_nettoEk_by_menge)
            gesamtbetrag_netto = 0.0
            if 'netto_ek' in df.columns and 'menge' in df.columns:
                for _, row in df.iterrows():
                    try:
                        # Parse deutsche Zahlenformatierung: 1.234,56 -> 1234.56
                        netto_str = str(row['netto_ek'])
                        if netto_str == "N/A":
                            continue
                        # netto_ek ist Komma-formatiert: 123,45
                        netto = float(netto_str.replace(',', '.'))
                        
                        menge_str = str(row['menge'])
                        if menge_str == "N/A":
                            continue
                        # menge kann Punkt oder Komma haben: 1.234,5 oder 10
                        menge = float(menge_str.replace('.', '').replace(',', '.'))
                        
                        gesamtbetrag_netto += netto * menge
                    except Exception as e:
                        print(f"Fehler bei Betragsberechnung: {e}", file=sys.stderr)
                        pass
            
            # MwSt (meistens 19%)
            mwst_satz = 19
            if 'MwST' in df.columns:
                try:
                    mwst_satz = int(df.iloc[0]['MwST'])
                except:
                    pass
            
            gesamtbetrag_brutto = gesamtbetrag_netto * (1 + mwst_satz / 100)
            
            # Kreditor-Mapping (hardcoded für bekannte Lieferanten)
            kreditor_mapping = {
                "klingspor": "70004",
                "pferd": "70005",
                "rüggeberg": "70005",
                "ruggeberg": "70005",
                "starcke": "70006",
                "vsm": "70009"
            }
            
            kreditor = kreditor_mapping.get(firma_key, None)
            
            return {
                "success": True,
                "lieferant": lieferant,
                "rechnungsnummer": rechnungsnummer,
                "datum": datum,
                "gesamtbetrag": round(gesamtbetrag_brutto, 2),
                "nettobetrag": round(gesamtbetrag_netto, 2),
                "steuerbetrag": round(gesamtbetrag_brutto - gesamtbetrag_netto, 2),
                "steuersatz": mwst_satz,
                "kreditor": kreditor,
                "parsing_method": f"python-{firma_key}-parser",
                "confidence": 95,
                "positions_count": len(df)
            }
            
        finally:
            # Cleanup
            try:
                os.unlink(tmp_path)
            except:
                pass
                
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "confidence": 0
        }


def main():
    """
    CLI Interface für direkte Nutzung
    Erwartet JSON via stdin mit: { "pdf_base64": "...", "filename": "..." }
    Gibt JSON via stdout zurück
    """
    try:
        # Lese Input von stdin
        input_data = json.loads(sys.stdin.read())
        pdf_base64 = input_data.get('pdf_base64', '')
        filename = input_data.get('filename', '')
        
        if not pdf_base64:
            result = {
                "success": False,
                "error": "Kein PDF Base64 bereitgestellt"
            }
        else:
            result = parse_invoice_from_base64(pdf_base64, filename)
        
        # Output als JSON
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": f"Script-Fehler: {str(e)}"
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
