from abc import ABC, abstractmethod
import pandas as pd

class BaseParser(ABC):
    @abstractmethod
    def parse(self, pdf_path: str) -> tuple[pd.DataFrame, str]:
        """Parse a PDF and return a DataFrame and identifier (e.g., invoice/order number)"""
        pass
