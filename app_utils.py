import io
import urllib.parse
from datetime import datetime, date, timedelta
import pandas as pd

# Hindi month names mapping by month number
HINDI_MONTHS_NUM = {
    1: "जनवरी", 2: "फरवरी", 3: "मार्च", 4: "अप्रैल", 5: "मई", 6: "जून",
    7: "जुलाई", 8: "अगस्त", 9: "सितम्बर", 10: "अक्टूबर", 11: "नवम्बर", 12: "दिसम्बर"
}

def parse_str_to_date(date_val):
    """Parses any date object or string into a datetime.date object."""
    if not date_val:
        return None
    if isinstance(date_val, (date, datetime)):
        return date_val.date() if isinstance(date_val, datetime) else date_val
    if isinstance(date_val, pd.Timestamp):
        return date_val.date()
        
    date_str = str(date_val).strip()
    if not date_str or date_str.lower() in ("none", "nan", "nat", ""):
        return None

    # Try pandas multi-format parser first
    try:
        ts = pd.to_datetime(date_str, errors='coerce')
        if pd.notna(ts):
            return ts.date()
    except Exception:
        pass

    # Try explicit format matching
    formats = [
        "%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d",
        "%d-%m-%Y", "%b %d, %Y", "%d %b %Y"
    ]
    
    # Capitalize 3-letter month if present (e.g. 05-aug-2026 -> 05-Aug-2026)
    parts = date_str.replace("/", "-").split("-")
    if len(parts) == 3 and len(parts[1]) == 3 and parts[1].isalpha():
        parts[1] = parts[1].capitalize()
        date_str = "-".join(parts)

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass

    return None

def to_hindi_date(date_val) -> str:
    """Converts any date (date object or string) to Hindi format e.g. '04 अगस्त 2026'."""
    d = parse_str_to_date(date_val)
    if d:
        hindi_month = HINDI_MONTHS_NUM.get(d.month, "")
        return f"{d.day:02d} {hindi_month} {d.year}"
    return str(date_val) if date_val else ""

def format_date_to_str(date_obj) -> str:
    """Converts a date object or string to standard 'DD-MMM-YYYY' format."""
    d = parse_str_to_date(date_obj)
    if d:
        return d.strftime("%d-%b-%Y")
    return str(date_obj) if date_obj else ""

def get_dates_in_range(check_in_date, check_out_date) -> list:
    """
    Returns a list of date strings (Format: DD-MMM-YYYY) representing the nights stayed.
    If Check-in is 05-Aug and Check-out is 07-Aug, it returns ['05-Aug-2026', '06-Aug-2026'].
    If Check-in equals Check-out (e.g. daycare), returns [check_in_date] to block that single date.
    """
    check_in_date = parse_str_to_date(check_in_date)
    check_out_date = parse_str_to_date(check_out_date)
        
    if not check_in_date or not check_out_date:
        return []
        
    dates = []
    current_date = check_in_date
    
    if check_in_date == check_out_date:
        dates.append(format_date_to_str(check_in_date))
    else:
        while current_date < check_out_date:
            dates.append(format_date_to_str(current_date))
            current_date += timedelta(days=1)
            
    return dates

def generate_whatsapp_link(details: dict) -> str:
    """Generates a WhatsApp Web API link containing the booking details in Hindi."""
    mobile = str(details.get("mobile_number", "")).strip()
    
    clean_mobile = "".join(filter(str.isdigit, mobile))
    if len(clean_mobile) == 10:
        clean_mobile = "91" + clean_mobile
        
    cin_h = to_hindi_date(details.get('check_in_date'))
    cout_h = to_hindi_date(details.get('check_out_date'))
    raw_rate = clean_and_format_rate(details.get("rate_per_day", ""))
    rate_line = f"- प्रति रूम प्रति दिन किराया: ₹{raw_rate}/-\n" if raw_rate else ""

    hindi_msg = (
        f"सेवा में,\n"
        f"श्री {details.get('guest_name', '___________')}\n"
        f"मो0नं0- {details.get('mobile_number', '___________')}\n\n"
        f"विषय: पुलिस ऑफिसर्स गेस्ट हाउस में सूट आरक्षित किये जाने की पुष्टि के संबंध में।\n\n"
        f"महोदय,\n"
        f"  अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक {cin_h} से "
        f"{cout_h} तक आपके प्रवास हेतु {details.get('num_rooms')} रूम आरक्षित कर दिया गया है।\n\n"
        f"बुकिंग विवरण:\n"
        f"- गेस्ट का नाम: {details.get('guest_name')}\n"
        f"- कब से कब तक: दि० {cin_h} से {cout_h} तक\n"
        f"- रूम की संख्या: {details.get('num_rooms')}\n"
        f"- सूट नम्बर: {details.get('suit_numbers')}\n"
        f"- कुल दिन: {details.get('total_days')} दिन\n"
        f"{rate_line}"
        f"- कुल किराया: ₹{details.get('total_amount', '0.0')}/-\n\n"
        f"संपर्क सूत्र ऑफिसर्स गेस्ट हाउस- उ0नि0 यदुनाथ मो0न0-8317041684\n\n"
        f"हम आपके स्वागत के लिए उत्सुक हैं और आशा करते हैं कि आपका प्रवास सुखद रहेगा।"
    )
    
    encoded_text = urllib.parse.quote(hindi_msg)
    return f"https://wa.me/{clean_mobile}?text={encoded_text}"

def export_dataframe_to_excel(df: pd.DataFrame) -> bytes:
    """Exports the pandas DataFrame to Excel format in bytes."""
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='POGH Bookings')
        
        workbook = writer.book
        worksheet = writer.sheets['POGH Bookings']
        
        for cell in worksheet[1]:
            cell.font = cell.font.copy(bold=True)
            
        for col in worksheet.columns:
            max_len = max(len(str(cell.value or '')) for cell in col)
            col_letter = col[0].column_letter
            worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)
            
    return output.getvalue()

def clean_and_format_rate(rate_val) -> str:
    """Cleans a rate input of currency symbols and formats it cleanly."""
    if rate_val is None:
        return ""
    cleaned = str(rate_val).replace("Rs.", "").replace("Rs", "").replace("₹", "").strip()
    return cleaned
