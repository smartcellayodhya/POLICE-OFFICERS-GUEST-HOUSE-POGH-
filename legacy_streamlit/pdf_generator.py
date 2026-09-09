import os
import requests
import streamlit as st
from fpdf import FPDF
from app_utils import to_hindi_date, clean_and_format_rate

FONT_DIR = "fonts"
REGULAR_FONT_URL = "https://raw.githubusercontent.com/googlefonts/noto-fonts/master/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"
BOLD_FONT_URL = "https://raw.githubusercontent.com/googlefonts/noto-fonts/master/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Bold.ttf"

REGULAR_FONT_PATH = os.path.join(FONT_DIR, "NotoSansDevanagari-Regular.ttf")
BOLD_FONT_PATH = os.path.join(FONT_DIR, "NotoSansDevanagari-Bold.ttf")

def download_fonts():
    """Downloads the required Hindi Devanagari TrueType fonts if not present locally."""
    if not os.path.exists(FONT_DIR):
        os.makedirs(FONT_DIR)
        
    for font_path, url, name in [
        (REGULAR_FONT_PATH, REGULAR_FONT_URL, "Regular"),
        (BOLD_FONT_PATH, BOLD_FONT_URL, "Bold")
    ]:
        if not os.path.exists(font_path):
            try:
                # Use a progress bar or status in Streamlit if running within app context
                print(f"Downloading Noto Sans Devanagari {name} font...")
                response = requests.get(url, timeout=30)
                if response.status_code == 200:
                    with open(font_path, "wb") as f:
                        f.write(response.content)
                    print(f"Font {name} downloaded successfully.")
                else:
                    print(f"Failed to download {name} font. Status code: {response.status_code}")
            except Exception as e:
                print(f"Exception during font download of {name}: {e}")

def get_fallback_font():
    """Returns a tuple of font paths. If downloading failed, returns None to fallback to system fonts."""
    download_fonts()
    if os.path.exists(REGULAR_FONT_PATH):
        # If bold font failed to download, use regular as fallback for bold
        bold_path = BOLD_FONT_PATH if os.path.exists(BOLD_FONT_PATH) else REGULAR_FONT_PATH
        return REGULAR_FONT_PATH, bold_path
    return None, None

class HindiLetterPDF(FPDF):
    def header(self):
        # Draw a double line at the top to give a premium header look
        self.set_draw_color(30, 58, 138)  # Police Navy Blue
        self.set_line_width(0.5)
        self.line(10, 10, 200, 10)
        self.line(10, 11.5, 200, 11.5)
        
    def footer(self):
        # Add page number at bottom
        self.set_y(-15)
        self.set_text_color(156, 163, 175) # Gray
        try:
            self.set_font("NotoSansDevanagari", "", 8)
        except Exception:
            self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

def generate_hindi_letter_pdf(details: dict) -> bytes:
    """
    Generates a PDF bytes buffer containing the Hindi Booking Confirmation Letter.
    
    Expected keys in details:
    - guest_name: str
    - mobile_number: str
    - check_in_date: str (Format: DD-MMM-YYYY or DD/MM/YYYY)
    - check_out_date: str
    - num_rooms: int/str
    - suit_numbers: str (e.g. "Suit 1, Suit 2")
    - check_in_time: str (default "12:00 PM")
    - check_out_time: str (default "12:00 PM")
    - total_days: int/str
    - rate_per_day: float/str
    - total_amount: float/str (optional)
    """
    # 1. Download and get fonts
    reg_path, bold_path = get_fallback_font()
    
    # 2. Instantiate FPDF with text shaping enabled
    # We set unit in mm, format A4
    pdf = HindiLetterPDF(orientation="P", unit="mm", format="A4")
    
    # Crucial: Enable complex text shaping for Devanagari text
    try:
        pdf.set_text_shaping(True)
    except Exception as e:
        print(f"Warning: Could not enable fpdf2 text shaping: {e}. Hindi rendering may be split.")
    
    # 3. Add Fonts
    if reg_path and bold_path:
        pdf.add_font("NotoSansDevanagari", "", reg_path)
        pdf.add_font("NotoSansDevanagari", "B", bold_path)
        font_name = "NotoSansDevanagari"
    else:
        # Fallback to Helvetica if font download failed completely
        print("Warning: Noto Sans Devanagari font not found. Falling back to system fonts.")
        font_name = "Helvetica"
        
    pdf.add_page()
    pdf.set_margins(15, 20, 15)
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # ── Header Logo & Title ──
    logo_path = "up_police_logo.png"
    
    # Download the logo dynamically from GitHub if it's missing (helps deploy cleanly on Hugging Face Spaces!)
    if not os.path.exists(logo_path):
        try:
            url = "https://raw.githubusercontent.com/smartcellayodhya/POLICE-OFFICERS-GUEST-HOUSE-POGH-/main/up_police_logo.png"
            response = requests.get(url, timeout=15)
            if response.status_code == 200:
                with open(logo_path, "wb") as f:
                     f.write(response.content)
                print("UP Police logo downloaded successfully from GitHub.")
        except Exception as e:
            print(f"Error downloading UP Police logo from GitHub: {e}")
            
    has_logo = os.path.exists(logo_path)
    
    if has_logo:
        pdf.image(logo_path, x=96, y=14, w=18)
        pdf.set_y(35)
        
    pdf.set_font(font_name, "B", 16)
    pdf.set_text_color(30, 58, 138)  # Police Navy Blue
    pdf.cell(0, 10, "कार्यालय वरिष्ठ पुलिस अधीक्षक, अयोध्या", ln=True, align="C")
    
    pdf.set_font(font_name, "", 10)
    pdf.set_text_color(31, 41, 55)  # Dark Gray
    pdf.cell(0, 5, "पुलिस ऑफिसर्स गेस्ट हाउस, अयोध्या", ln=True, align="C")
    
    # Line divider
    divider_y = 53 if has_logo else 38
    pdf.set_draw_color(209, 213, 219)
    pdf.set_line_width(0.2)
    pdf.line(15, divider_y, 195, divider_y)
    
    # Position cursor below divider
    start_y = 57 if has_logo else 42
    pdf.set_y(start_y)
    
    # Dispatch Ref and Date row
    pdf.set_font(font_name, "", 10)
    gen_date_hindi = to_hindi_date(details.get('booking_generated_date', ''))
    cin_h  = to_hindi_date(details.get('check_in_date', ''))
    cout_h = to_hindi_date(details.get('check_out_date', ''))
    pdf.cell(90, 6, "पत्रांक: पी.ओ.जी.एच. / बुकिंग / 2026 / ______", ln=False)
    pdf.cell(0, 6, f"दिनांक: {gen_date_hindi}", ln=True, align="R")
    pdf.ln(8)
    
    # Recipient block
    pdf.set_font(font_name, "B", 11)
    pdf.cell(0, 6, "सेवा में,", ln=True)
    pdf.set_font(font_name, "", 11)
    # Adding indentation using cell margin
    pdf.cell(10, 6, "", ln=False)
    pdf.cell(0, 6, f"श्री {details.get('guest_name', '___________')}", ln=True)
    pdf.cell(10, 6, "", ln=False)
    pdf.cell(0, 6, f"मो०नं०- {details.get('mobile_number', '___________')}", ln=True)
    pdf.ln(6)
    
    # Subject block
    pdf.set_font(font_name, "B", 11)
    pdf.cell(15, 6, "विषय: ", ln=False)
    # Draw underline or bold for subject
    pdf.set_font(font_name, "B", 11)
    pdf.multi_cell(0, 6, "पुलिस ऑफिसर्स गेस्ट हाउस में सूट आरक्षित किये जाने की पुष्टि के संबंध में।")
    pdf.ln(4)
    
    # Salutation & Body
    pdf.set_font(font_name, "", 11)
    pdf.cell(0, 6, "महोदय,", ln=True)
    
    # Main Body Text
    body_text = (
        f"अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक {cin_h} से "
        f"{cout_h} तक आपके प्रवास हेतु {details.get('num_rooms', '___')} "
        f"रूम आरक्षित कर दिया गया है, जिसका विवरण निम्नवत है:-"
    )
    # Paragraph indentation
    pdf.set_x(25)
    pdf.multi_cell(0, 6, body_text)
    pdf.ln(6)
    
    # Booking Detail Table Header
    pdf.set_font(font_name, "B", 11)
    pdf.cell(0, 6, "बुकिंग विवरण:", ln=True)
    pdf.ln(2)
    
    # Table layout
    pdf.set_fill_color(30, 58, 138)  # Police Navy Blue table header
    pdf.set_text_color(255, 255, 255) # White text for header
    pdf.set_draw_color(209, 213, 219)
    pdf.set_line_width(0.1)
    
    # Left padding
    pdf.cell(10, 8, "", ln=False)
    pdf.cell(60, 8, " विवरण", border=1, fill=True, ln=False)
    pdf.cell(100, 8, " सूचना", border=1, fill=True, ln=True)
    
    # Restore text color for table row contents
    pdf.set_text_color(31, 41, 55)
    
    # Row list — Hindi dates for proper Devanagari rendering
    check_in_out_time = f"{cin_h} ({details.get('check_in_time', '12:00 PM')}) / {cout_h} ({details.get('check_out_time', '12:00 PM')})"

    raw_rate = clean_and_format_rate(details.get("rate_per_day", ""))

    rows = [
        ("गेस्ट का नाम", details.get("guest_name")),
        ("कब से कब तक", f"दि० {cin_h} से {cout_h} तक"),
        ("रूम की संख्या", f"{details.get('num_rooms')} रूम"),
        ("सूट नम्बर", details.get("suit_numbers")),
        ("चेक-इन / चेक-आउट तिथि व समय", check_in_out_time),
        ("कुल दिन", f"{details.get('total_days')} दिन")
    ]
    if raw_rate:
        rows.append(("प्रति रूम प्रति दिन किराया", f"₹{raw_rate}/-"))
    
    pdf.set_font(font_name, "", 10)
    for desc, val in rows:
        pdf.cell(10, 8, "", ln=False)
        pdf.cell(60, 8, f"  {desc}", border=1, ln=False)
        pdf.cell(100, 8, f"  {val}", border=1, ln=True)
    
    pdf.ln(8)
    
    # Contact Info
    pdf.set_font(font_name, "B", 10)
    pdf.cell(10, 6, "", ln=False)
    pdf.cell(0, 6, "संपर्क सूत्र ऑफिसर्स गेस्ट हाउस- उ0नि0 यदुनाथ मो0न0-8317041684", ln=True)
    pdf.ln(6)
    
    # Salutation closing
    pdf.set_font(font_name, "", 11)
    pdf.cell(20, 6, "", ln=False)
    pdf.multi_cell(0, 6, "हम आपके स्वागत के लिए उत्सुक हैं और आशा करते हैं कि आपका प्रवास सुखद रहेगा।")
    pdf.ln(12)
    
    # Sign off
    # Shift right for signature
    pdf.set_font(font_name, "B", 11)
    pdf.cell(110, 6, "", ln=False)
    pdf.cell(60, 6, "आज्ञा से", ln=True, align="C")
    pdf.ln(6)
    pdf.cell(110, 6, "", ln=False)
    pdf.cell(60, 6, "वरिष्ठ पुलिस अधीक्षक", ln=True, align="C")
    pdf.cell(110, 6, "", ln=False)
    pdf.cell(60, 6, "अयोध्या", ln=True, align="C")
    pdf.ln(10)
    
    # Copy to (प्रतिलिपि) section
    pdf.set_font(font_name, "B", 9)
    pdf.cell(0, 5, "प्रतिलिपि:", ln=True)
    pdf.set_font(font_name, "", 9)
    pdf.cell(5, 5, "", ln=False)
    pdf.multi_cell(0, 5, "प्रभारी पुलिस ऑफिसर्स गेस्ट हाउस, पुलिस लाइन, अयोध्या को संबंधित से समन्वय स्थापित करते हुए आवश्यक कार्यवाही हेतु प्रेषित।")
    
    # Output PDF bytes
    return bytes(pdf.output())
