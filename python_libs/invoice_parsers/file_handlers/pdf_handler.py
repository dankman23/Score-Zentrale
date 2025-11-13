from typing import Literal

#from parsers.auftrags_parser.pferd_parser import PferdParser
from parsers.rechnung_parser.invoice_pferd import InvoicePferdParser
from parsers.rechnung_parser.invoice_klingspor import InvoiceKlingsporParser
from parsers.rechnung_parser.invoice_norton import InvoiceNortonParser
from parsers.rechnung_parser.invoice_rhodius import InvoiceRhodiusParser
from parsers.rechnung_parser.invoice_vsm import InvoiceVSMParser
from parsers.rechnung_parser.invoice_starcke import InvoiceStarckeParser
from parsers.rechnung_parser.invoice_awuko import InvoiceAwukoParser
from parsers.rechnung_parser.invoice_bosch import InvoiceBoschParser
from parsers.rechnung_parser.invoice_plastimex import InvoicePlastimexParser
from parsers.base_parser import BaseParser

PARSER_REGISTRY = {
    "Invoice_pferd": InvoicePferdParser,
    "Invoice_klingspor": InvoiceKlingsporParser,
    "Invoice_norton": InvoiceNortonParser,
    "Invoice_rhodius": InvoiceRhodiusParser,
    "Invoice_vsm": InvoiceVSMParser,
    "Invoice_starcke": InvoiceStarckeParser,
    "Invoice_awuko": InvoiceAwukoParser,
    "Invoice_bosch": InvoiceBoschParser,
    "Invoice_plastimex": InvoicePlastimexParser,
    # Add other parsers here
}

def get_parser(firma: str, document_type: Literal["AB", "invoice"]) -> BaseParser | None:
    """
    Get the parser for the given company and document type
    Args:
        firma (str): The company name
        document_type (str): The document type ("AB" or "invoice")
    Returns:
        BaseParser: The parser for the given company and document type
    """
    key = f"{'Invoice' if document_type == 'invoice' else ''}_{firma.lower()}"
    parser = PARSER_REGISTRY.get(key, None)
    if not parser:
        return None
    return parser()