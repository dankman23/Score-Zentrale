import datetime

def letzter_tag_der_woche(jahr: int, kw: int):
    
    if jahr < 100:
        # Wenn nur die letzten beiden Ziffern des Jahres angegeben sind, wird das Jahr berechnet
        current_year = datetime.datetime.now().year
        current_year_last_two_digits = current_year % 100
        if jahr == current_year_last_two_digits:
            jahr = current_year
        elif jahr > current_year_last_two_digits:
            jahr = current_year - current_year_last_two_digits + jahr
        else:
            jahr = current_year - current_year_last_two_digits + 100 + jahr


    erster_tag_des_jahres = datetime.date(jahr, 1, 1)
    
    tage_bis_montag = (7 - erster_tag_des_jahres.weekday()) % 7
    
    erster_montag = erster_tag_des_jahres + datetime.timedelta(days=tage_bis_montag)
    
    montag_der_kw = erster_montag + datetime.timedelta(weeks=kw - 1)
    
    letzter_tag = montag_der_kw + datetime.timedelta(days=6)
    
    return letzter_tag.strftime('%d.%m.%y')


def zahlbar_bis_x_tage_nach_datum(datum: str, anzahl_tage: int, format = "%d.%m.%Y") -> str:
    """
    Berechnet das "Zahlbar bis"-Datum 30 Tage nach dem Belegdatum
    Args:
        datum (str): Das Belegdatum im Format "dd.mm.yyyy"
    Returns:
        str: Das "Zahlbar bis"-Datum im Format "dd.mm.yyyy"
    
    """
    belegdatum_datetime = datetime.datetime.strptime(datum, format)

    # Berechnung des "Zahlbar bis"-Datums
    zahlbar_bis = belegdatum_datetime + datetime.timedelta(days=anzahl_tage)

    return zahlbar_bis.strftime("%d.%m.%Y")

