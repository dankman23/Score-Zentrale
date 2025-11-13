#!/usr/bin/env python3
"""
Gemini Invoice Parser
Nutzt Google Gemini 2.0 Flash für flexibles PDF-Parsing
"""

import sys
import os
import json
import base64
from datetime import datetime
import tempfile

# Google Generative AI
try:
    import google.generativeai as genai
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "google-generativeai nicht installiert. Bitte: pip install google-generativeai"
    }))
    sys.exit(1)

# Konfiguriere API Key
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', '')

if not GOOGLE_API_KEY:
    print(json.dumps({
        "success": False,
        "error": "GOOGLE_API_KEY Umgebungsvariable nicht gesetzt"
    }), file=sys.stdout)
    sys.exit(0)

genai.configure(api_key=GOOGLE_API_KEY)


def parse_invoice_with_gemini(pdf_base64: str, filename: str = "", email_context: dict = None) -> dict:
    """
    Parst eine Rechnung mit Gemini AI
    
    Args:
        pdf_base64: Base64-kodierter PDF-Inhalt
        filename: Dateiname für Hinweise
        email_context: Dict mit from, subject, body
    
    Returns:
        dict mit Parsing-Ergebnissen
    """
    try:
        # Decode Base64
        pdf_bytes = base64.b64decode(pdf_base64)
        
        # Erstelle temporäre Datei
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(pdf_bytes)
            tmp_path = tmp_file.name
        
        try:
            # Email-Kontext aufbauen
            context_text = ""
            if email_context:
                context_text = "\n\nZUSÄTZLICHER KONTEXT AUS E-MAIL:\n"
                if email_context.get('from'):
                    context_text += f"Absender: {email_context['from']}\n"
                if email_context.get('subject'):
                    context_text += f"Betreff: {email_context['subject']}\n"
                if email_context.get('body'):
                    body = email_context['body'][:500]
                    context_text += f"E-Mail-Text: {body}\n"
            
            # Prompt für deutsche Lieferantenrechnungen
            prompt = f"""Extrahiere die folgenden Informationen aus dieser deutschen Lieferantenrechnung (EK-Rechnung):
            - Rechnungsnummer
            - Rechnungsdatum (Format: YYYY-MM-DD)
            - Lieferantenname (Firma)
            - Gesamtbetrag (Brutto, mit MwSt)
            - Nettobetrag (ohne MwSt)
            - Mehrwertsteuerbetrag
            - MwSt-Satz (z.B. 19, 7, 0)
            
            {context_text}
            
            WICHTIG: 
            - Nutze auch die Informationen aus dem E-Mail-Kontext oben.
            - Der Lieferantenname kann z.B. aus dem E-Mail-Absender stammen.
            - Bei deutschen Beträgen: 1.234,56 € = 1234.56
            - Falls keine Beträge gefunden werden, setze sie auf 0
            
            Formatiere die Antwort als JSON-Objekt:
            {{
              "rechnungsnummer": "string",
              "datum": "YYYY-MM-DD",
              "lieferant": "string",
              "gesamtbetrag": number,
              "nettobetrag": number,
              "mehrwertsteuer": number,
              "mwstSatz": number
            }}
            
            Gib NUR das JSON zurück, keine Erklärungen."""
            
            # Upload PDF zu Gemini
            model = genai.GenerativeModel('gemini-2.0-flash-exp')
            
            # Gemini File API für PDFs
            uploaded_file = genai.upload_file(tmp_path, mime_type='application/pdf')
            
            # Generate Content
            response = model.generate_content([prompt, uploaded_file])
            
            # Parse Response
            text = response.text.strip()
            
            # Remove markdown code blocks
            text = text.replace('```json', '').replace('```', '').strip()
            
            # Parse JSON
            data = json.loads(text)
            
            # Validierung und Bereinigung
            gesamtbetrag = float(data.get('gesamtbetrag', 0))
            nettobetrag = float(data.get('nettobetrag', 0))
            mehrwertsteuer = float(data.get('mehrwertsteuer', 0))
            
            # Wenn netto fehlt aber brutto da ist, berechne
            if gesamtbetrag > 0 and nettobetrag == 0:
                mwst_satz = int(data.get('mwstSatz', 19))
                nettobetrag = gesamtbetrag / (1 + mwst_satz / 100)
                mehrwertsteuer = gesamtbetrag - nettobetrag
            
            # Cleanup
            try:
                genai.delete_file(uploaded_file.name)
            except:
                pass
            
            return {
                "success": True,
                "lieferant": data.get('lieferant', 'Unbekannt'),
                "rechnungsnummer": data.get('rechnungsnummer', 'Unbekannt'),
                "datum": data.get('datum', datetime.now().strftime('%Y-%m-%d')),
                "gesamtbetrag": round(gesamtbetrag, 2),
                "nettobetrag": round(nettobetrag, 2),
                "steuerbetrag": round(mehrwertsteuer, 2),
                "steuersatz": int(data.get('mwstSatz', 19)),
                "kreditor": None,
                "parsing_method": "gemini-ai",
                "confidence": 80 if gesamtbetrag > 0 else 50
            }
            
        finally:
            # Cleanup temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
                
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"JSON Parse Error: {str(e)}",
            "confidence": 0
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "confidence": 0
        }


def main():
    """
    CLI Interface
    Erwartet JSON via stdin mit: { "pdf_base64": "...", "filename": "...", "email_context": {...} }
    """
    try:
        input_data = json.loads(sys.stdin.read())
        pdf_base64 = input_data.get('pdf_base64', '')
        filename = input_data.get('filename', '')
        email_context = input_data.get('email_context', None)
        
        if not pdf_base64:
            result = {
                "success": False,
                "error": "Kein PDF Base64 bereitgestellt"
            }
        else:
            result = parse_invoice_with_gemini(pdf_base64, filename, email_context)
        
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
