import os
import pandas as pd

def update_ongoing_csv_file(csv_path: str, new_data_df: pd.DataFrame) -> bool:
    """
    Aktualisieren der großen CSV-Datei
    
    Args:
        csv_path (str): Der Pfad zur großen CSV-Datei
        new_data_df (pd.DataFrame): Die neuen Daten, die hinzugefügt werden.
    Returns:
        success (bool): Ob das Aktualisieren der Datei erfolgreich war.
    """
    try:
        if not os.path.isfile(csv_path):
            new_data_df.to_csv(csv_path, index=False, sep=';', encoding='utf-8', header=False)
        else:
            new_data_df.to_csv(csv_path, mode='a', header=False, index=False, sep=';', encoding='utf-8')
        return True
    except OSError as e:
        print(f"Die große CSV Datei konnte nicht aktualisiert werden: {e}")
        return False
    except Exception as e:
        print(f"Ein Fehler ist beim Aktualisieren der großen CSV Datei aufgetreten: {e}")
        return False
        

def save_csv_files(ongoing_csv_path: str, specific_csv_path: str, new_data_df: pd.DataFrame) -> bool:
    """
    Wir erstellen pro AB eine neue CSV Datei. Zusätzlich wird eine große CSV-Datei mit allen Bestellungen
    "zum Überblick" weitergeführt.
    Args:
        ongoing_csv_path (str): Der Pfad zur großen CSV-Datei
        specific_csv_path (str): Der Pfad für die AB-Spezifische CSV-Datei
        new_data_df (pd.DataFrame): Die neuen Daten, die hinzugefügt werden.
    Returns:
        success (bool): Ob das Speichern und Aktualisieren der Dateien erfolgreich war.
    """
    if not update_ongoing_csv_file(ongoing_csv_path, new_data_df) or not create_csv_file(specific_csv_path, new_data_df):
        return False
    else:
        return True
    
    
def create_csv_file(csv_path: str, new_data_df: pd.DataFrame) -> bool:
    """Wir erstellen die AB-Spezifische Datei"""
    try:
        new_data_df.to_csv(csv_path, index=False, sep=';', encoding='utf-8', header=False)
        return True
    except OSError as e:
        print(f"Die CSV Datei konnte nicht gespeichert werden: {e}")
        return False
    except Exception as e:
        print(f"Ein Fehler ist beim Speichern der CSV Datei aufgetreten: {e}")
        return False
