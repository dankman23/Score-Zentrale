#!/usr/bin/env python3
"""
Emergent Gemini Invoice Parser
Nutzt Emergent Universal Key über emergentintegrations
"""

import sys
import os
import json
import base64
from datetime import datetime
import tempfile
import asyncio

# Emergent Integrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "emergentintegrations nicht installiert"
    }))
    sys.exit(1)

# Konfiguriere API Key
EMERGENT_LLM_KEY = os.getenv('EMERGENT_LLM_KEY') or os.getenv('GOOGLE_API_KEY', '')

if not EMERGENT_LLM_KEY:
    print(json.dumps({
        "success": False,
        "error": "EMERGENT_LLM_KEY oder GOOGLE_API_KEY nicht gesetzt"
    }), file=sys.stdout)
    sys.exit(0)


async def parse_invoice_with_emergent_gemini(pdf_path: str, email_context: dict = None) -> dict:
    """
    Parst eine Rechnung mit Gemini via Emergent Integration
    
    Args:
        pdf_path: Pfad zur PDF-Datei
        email_context: Dict mit from, subject, body
    
    Returns:
        dict mit Parsing-Ergebnissen
    """
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
        query = f"""Extrahiere die folgenden Informationen aus dieser deutschen Lieferantenrechnung (EK-Rechnung):
        - Rechnungsnummer
        - Rechnungsdatum (Format: YYYY-MM-DD)
        - Lieferantenname (vollständiger Firmenname)
        - Gesamtbetrag (Brutto, mit MwSt) in Euro
        - Nettobetrag (ohne MwSt) in Euro
        - Mehrwertsteuerbetrag in Euro
        - MwSt-Satz (z.B. 19, 7, 0)
        
        {context_text}
        
        KRITISCH WICHTIG: 
        - Dies ist eine EINGANGSRECHNUNG (Lieferantenrechnung)
        - Der LIEFERANT ist derjenige, der die Rechnung AUSSTELLT (oben auf der Rechnung)
        - "Score Schleifwerkzeuge" ist NICHT der Lieferant! Das ist der EMPFÄNGER/KUNDE
        - Ignoriere die Empfängeradresse - suche nur nach dem Absender/Rechnungssteller
        - Nutze auch die Informationen aus dem E-Mail-Kontext.
        - Der Lieferantenname kann aus dem E-Mail-Absender stammen.
        - Bei deutschen Beträgen: 1.234,56 € = 1234.56
        - Falls keine Beträge gefunden werden, setze sie auf 0
        - Rechnungsnummer ist oft im Format: RE-123456, Invoice-789, etc.
        
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
        
        # Initialize Chat mit Gemini
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"invoice-parse-{os.urandom(4).hex()}",
            system_message="Du bist ein Experte für deutsche Buchhaltung und Rechnungsanalyse."
        ).with_model("gemini", "gemini-2.0-flash")
        
        # PDF-Datei vorbereiten
        pdf_file = FileContentWithMimeType(
            file_path=pdf_path,
            mime_type="application/pdf"
        )
        
        # Message erstellen
        user_message = UserMessage(
            text=query,
            file_contents=[pdf_file]
        )
        
        # Send Message
        response = await chat.send_message(user_message)
        text = response.strip()
        
        # Parse Response (remove markdown)
        text = text.replace('```json', '').replace('```', '').strip()
        
        # Find JSON in response
        import re
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            data = json.loads(json_match.group(0))
        else:
            return {
                "success": False,
                "error": "Kein JSON in Gemini-Response gefunden"
            }
        
        # Validierung und Bereinigung
        gesamtbetrag = float(data.get('gesamtbetrag', 0))
        nettobetrag = float(data.get('nettobetrag', 0))
        mehrwertsteuer = float(data.get('mehrwertsteuer', 0))
        
        # Wenn netto fehlt aber brutto da ist, berechne
        if gesamtbetrag > 0 and nettobetrag == 0:
            mwst_satz = int(data.get('mwstSatz', 19))
            nettobetrag = gesamtbetrag / (1 + mwst_satz / 100)
            mehrwertsteuer = gesamtbetrag - nettobetrag
        
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
            "parsing_method": "emergent-gemini",
            "confidence": 85 if gesamtbetrag > 0 else 60
        }
        
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
            # Decode Base64
            pdf_bytes = base64.b64decode(pdf_base64)
            
            # Erstelle temporäre Datei
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                tmp_file.write(pdf_bytes)
                tmp_path = tmp_file.name
            
            try:
                # Parse mit Gemini
                result = asyncio.run(parse_invoice_with_emergent_gemini(tmp_path, email_context))
            finally:
                # Cleanup
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        
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
