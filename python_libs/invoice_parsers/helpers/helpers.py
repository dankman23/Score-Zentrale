def divide_nettoEk_by_menge(netto_ek:str, menge:str) -> str:
    """
    Divides the nettoEk by menge and returns the result.
    If menge is 0, returns 0 to avoid division by zero.
    Args:
        netto_ek (str): The nettoEk value as a string.
        menge (str): The menge value as a string.
    Returns:
        str: The result of the division as a string.
    """
    if menge == "N/A" or netto_ek == "N/A":
        return "N/A"
    
    try:
        netto_ek_value = float(
            netto_ek.replace(".", "").replace(",", ".")
        )
        menge_value = float(
            menge.replace(".", "").replace(",", ".")
        )
    except ValueError:
        print("Error converting netto_ek or menge to float")
        return "N/A"
    if menge_value == 0:
        return "0"
    price_per_item = round(netto_ek_value / menge_value, 3)
    netto_ek = str(price_per_item).replace(".", ",")
    return netto_ek