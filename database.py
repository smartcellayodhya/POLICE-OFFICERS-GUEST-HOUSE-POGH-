import os
import pandas as pd
import streamlit as st

# We use gspread for Google Sheets integration
GSPREAD_IMPORT_ERROR = None
try:
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
    GSPREAD_AVAILABLE = True
except ImportError as e:
    GSPREAD_AVAILABLE = False
    GSPREAD_IMPORT_ERROR = str(e)

DB_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_FILE = os.path.join(DB_DIR, "pogh_bookings.csv")

# Columns as specified by user requirements
COLUMNS = [
    "Date",
    "Guest Name",
    "Mobile Number",
    "Reference",
    "Suit 1",
    "Suit 2",
    "Suit 3",
    "Suit 4",
    "TOTAL AMOUNT",
    "MEAL TYPE STATUS",
    "CLICK BOOKING LETTER"
]

SUITS = ["Suit 1", "Suit 2", "Suit 3", "Suit 4"]
DEFAULT_RATES = {
    "Suit 1": 800.0,
    "Suit 2": 800.0,
    "Suit 3": 1200.0,
    "Suit 4": 1200.0
}

class BookingDatabase:
    def __init__(self):
        self.mode = "Local"  # "GoogleSheets" or "Local"
        self.connection_error = None
        self.gc = None
        self.sh = None
        self.worksheet = None
        self.sheet_name = "POGH_Bookings"
        self.sheet_title = "POGH_Bookings"
        self.init_connection()

    def init_connection(self):
        """Initializes connection to Google Sheets. Falls back to Local CSV on failure."""
        if not GSPREAD_AVAILABLE:
            self.mode = "Local"
            self.connection_error = f"Library import failed: {GSPREAD_IMPORT_ERROR}"
            return

        scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
        creds = None
        creds_path = os.path.join(DB_DIR, "credentials.json")

        # ── Priority 1: local credentials.json (most common for local dev) ──
        if os.path.exists(creds_path):
            try:
                creds = ServiceAccountCredentials.from_json_keyfile_name(creds_path, scope)
                print(f"Using credentials.json for Google Sheets auth: {creds_path}")
            except Exception as e:
                print(f"credentials.json load error: {e}")
                creds = None

        # ── Priority 2: Streamlit Secrets (for cloud deployment) ──
        if creds is None:
            try:
                if "gcp_service_account" in st.secrets:
                    secret_info = dict(st.secrets["gcp_service_account"])
                    creds = ServiceAccountCredentials.from_json_keyfile_dict(secret_info, scope)
                    print("Using Streamlit Secrets for Google Sheets auth.")
            except Exception as e:
                print(f"Streamlit Secrets load error: {e}")
                import traceback
                traceback.print_exc()
                creds = None

        if creds is None:
            self.connection_error = "credentials.json not found in project folder."
            self.mode = "Local"
            self._init_local_csv()
            return

        try:
            self.gc = gspread.authorize(creds)

            # Spreadsheet ID hardcoded (user's sheet), overridable via secrets
            spreadsheet_id = "1oWMoMvjEI5t0W7juNa45LUdq4bn_CwVWQlRZn9x3doE"
            try:
                secrets_id = st.secrets.get("spreadsheet_id", "")
                if secrets_id:
                    spreadsheet_id = secrets_id
            except Exception:
                pass  # No secrets.toml, use default ID

            try:
                self.sh = self.gc.open_by_key(spreadsheet_id)
            except Exception as e:
                print(f"open_by_key failed: {e}. Trying by name...")
                try:
                    self.sh = self.gc.open(self.sheet_name)
                except gspread.SpreadsheetNotFound:
                    self.sh = self.gc.create(self.sheet_name)

            self.sheet_title = self.sh.title

            try:
                self.worksheet = self.sh.get_worksheet(0)
                if not self.worksheet:
                    self.worksheet = self.sh.add_worksheet(title="Bookings", rows="1000", cols="20")
            except Exception:
                self.worksheet = self.sh.add_worksheet(title="Bookings", rows="1000", cols="20")

            # Write headers if missing
            headers = self.worksheet.row_values(1)
            if not headers or headers[0] != "Date":
                self.worksheet.insert_row(COLUMNS, 1)

            self.mode = "GoogleSheets"
            print(f"Google Sheets connected: {self.sheet_title}")

        except Exception as e:
            # Silently log error to terminal or warning in streamlit and fallback
            self.connection_error = str(e)
            print(f"Google Sheets connection failed: {e}. Falling back to Local Mode.")
            self.mode = "Local"

        # Initialize local database file if in Local mode
        if self.mode == "Local":
            self._init_local_csv()

    def _init_local_csv(self):
        """Creates the local CSV file with appropriate headers if it doesn't exist."""
        if not os.path.exists(CSV_FILE):
            df = pd.DataFrame(columns=COLUMNS)
            df.to_csv(CSV_FILE, index=False)

    def load_data(self) -> pd.DataFrame:
        """Loads all booking data. Handles live sync with Google Sheets or local CSV."""
        if self.mode == "GoogleSheets":
            try:
                # Refresh data from Google Sheets
                records = self.worksheet.get_all_records(expected_headers=COLUMNS)
                if not records:
                    return pd.DataFrame(columns=COLUMNS)
                
                df = pd.DataFrame(records)
                # Ensure all columns are present
                for col in COLUMNS:
                    if col not in df.columns:
                        df[col] = ""
                
                # Clean and convert numeric columns
                for col in SUITS + ["TOTAL AMOUNT"]:
                    df[col] = pd.to_numeric(df[col].replace('', 0), errors='coerce').fillna(0)
                
                return df[COLUMNS]
            except Exception as e:
                print(f"Failed to fetch from Google Sheets: {e}. Falling back to local cache.")
                # If Google Sheets fails, we try to load local CSV as backup
                self._init_local_csv()
                return pd.read_csv(CSV_FILE)
        else:
            self._init_local_csv()
            df = pd.read_csv(CSV_FILE)
            # Ensure proper types
            for col in SUITS + ["TOTAL AMOUNT"]:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            df = df.fillna("")
            return df[COLUMNS]

    def check_conflicts(self, dates_list, requested_suits, exclude_guest_name=None, exclude_mobile=None) -> list:
        """
        Checks if any of the requested suits are already booked on the specified dates.
        Returns a list of conflict messages if conflicts exist, otherwise empty list.
        """
        df = self.load_data()
        conflicts = []
        
        # Filter for rows matching any of the target dates
        matching_rows = df[df["Date"].isin(dates_list)]
        
        for idx, row in matching_rows.iterrows():
            # If we are updating a booking, we ignore conflict with the current guest
            if exclude_guest_name and exclude_mobile:
                if str(row["Guest Name"]).strip().lower() == exclude_guest_name.strip().lower() and \
                   str(row["Mobile Number"]).strip() == str(exclude_mobile).strip():
                    continue
            
            for suit in requested_suits:
                val = row.get(suit, 0)
                # If there's a non-zero price or booked status in that cell, it is booked
                if val and float(val) != 0:
                    conflicts.append(
                        f"{suit} is already booked on {row['Date']} by {row['Guest Name']} ({row['Mobile Number']})"
                    )
        
        return conflicts

    def save_booking(self, date_str, guest_name, mobile, reference, suit_allocations, meal_status):
        """
        Saves or updates a single day booking.
        suit_allocations is a dictionary like: {"Suit 1": 800.0, "Suit 2": 0.0, ...}
        """
        df = self.load_data()
        
        # Calculate numeric sum for local mode (only sum positive rates)
        total_val = sum(max(suit_allocations.get(s, 0.0), 0.0) for s in SUITS)
        
        # Clean mobile number
        mobile_str = str(mobile).strip()
        
        # Search for existing booking for the exact same date and guest name + mobile
        # (This lets us update allocations without overwriting separate entries)
        match_mask = (
            (df["Date"] == date_str) & 
            (df["Guest Name"].str.strip().str.lower() == guest_name.strip().lower()) &
            (df["Mobile Number"].astype(str).str.strip() == mobile_str)
        )
        
        new_row_data = {
            "Date": date_str,
            "Guest Name": guest_name.strip(),
            "Mobile Number": mobile_str,
            "Reference": reference.strip(),
            "Suit 1": suit_allocations.get("Suit 1", 0.0),
            "Suit 2": suit_allocations.get("Suit 2", 0.0),
            "Suit 3": suit_allocations.get("Suit 3", 0.0),
            "Suit 4": suit_allocations.get("Suit 4", 0.0),
            "TOTAL AMOUNT": total_val,
            "MEAL TYPE STATUS": meal_status,
            "CLICK BOOKING LETTER": "GENERATE"
        }

        if self.mode == "GoogleSheets":
            try:
                # Find matching row index in Google Sheets
                # Note: get_all_records returns list of dicts. Google Sheets rows are 1-indexed,
                # row 1 is header. So match is records list index + 2.
                records = self.worksheet.get_all_records(expected_headers=COLUMNS)
                match_index = -1
                for idx, r in enumerate(records):
                    if r["Date"] == date_str and \
                       str(r["Guest Name"]).strip().lower() == guest_name.strip().lower() and \
                       str(r["Mobile Number"]).strip() == mobile_str:
                        match_index = idx + 2  # +2 accounts for 1-based index and header row
                        break
                
                # Write row data to sheet
                # If we use Google Sheets, we can write the TOTAL AMOUNT column as a formula!
                # Google Sheets columns: Date (A), Guest Name (B), Mobile (C), Reference (D),
                # Suit 1 (E), Suit 2 (F), Suit 3 (G), Suit 4 (H), TOTAL AMOUNT (I)...
                # Formula at row R: =SUMIF(E{R}:H{R}, ">0")
                if match_index != -1:
                    # Update existing row
                    new_row_data["TOTAL AMOUNT"] = f'=SUMIF(E{match_index}:H{match_index}, ">0")'
                    row_values = [new_row_data[col] for col in COLUMNS]
                    self.worksheet.update(f"A{match_index}:K{match_index}", [row_values], value_input_option="USER_ENTERED")
                else:
                    # Append new row
                    next_row = len(records) + 2
                    new_row_data["TOTAL AMOUNT"] = f'=SUMIF(E{next_row}:H{next_row}, ">0")'
                    row_values = [new_row_data[col] for col in COLUMNS]
                    self.worksheet.append_row(row_values, value_input_option="USER_ENTERED")
            except Exception as e:
                print(f"Error saving to Google Sheets: {e}. Saving locally instead.")
                # Fallback to local write
                self._save_local(date_str, guest_name, mobile_str, match_mask, new_row_data)
        else:
            self._save_local(date_str, guest_name, mobile_str, match_mask, new_row_data)

    def _save_local(self, date_str, guest_name, mobile_str, match_mask, new_row_data):
        """Saves data to the local CSV file."""
        df = pd.read_csv(CSV_FILE)
        
        # Ensure correct column types
        for col in SUITS + ["TOTAL AMOUNT"]:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
            
        # Re-check match mask on loaded DataFrame to prevent stale updates
        match_mask = (
            (df["Date"] == date_str) & 
            (df["Guest Name"].str.strip().str.lower() == guest_name.strip().lower()) &
            (df["Mobile Number"].astype(str).str.strip() == mobile_str)
        )
        
        if df[match_mask].any().any():
            # Update matching row(s)
            idx_list = df[match_mask].index
            for idx in idx_list:
                for col in COLUMNS:
                    df.at[idx, col] = new_row_data[col]
        else:
            # Append new row
            new_df = pd.DataFrame([new_row_data])
            df = pd.concat([df, new_df], ignore_index=True)
            
        df.to_csv(CSV_FILE, index=False)

    def delete_booking(self, date_str, guest_name, mobile):
        """Deletes a specific booking row matching date, guest name, and mobile number."""
        mobile_str = str(mobile).strip()
        if self.mode == "GoogleSheets":
            try:
                records = self.worksheet.get_all_records(expected_headers=COLUMNS)
                for idx, r in enumerate(records):
                    if r["Date"] == date_str and \
                       str(r["Guest Name"]).strip().lower() == guest_name.strip().lower() and \
                       str(r["Mobile Number"]).strip() == mobile_str:
                        # Delete the row. row index is idx + 2
                        self.worksheet.delete_rows(idx + 2)
                        break
            except Exception as e:
                print(f"Error deleting from Google Sheets: {e}")
                self._delete_local(date_str, guest_name, mobile_str)
        else:
            self._delete_local(date_str, guest_name, mobile_str)

    def _delete_local(self, date_str, guest_name, mobile_str):
        """Deletes booking row from local CSV."""
        if os.path.exists(CSV_FILE):
            df = pd.read_csv(CSV_FILE)
            match_mask = ~(
                (df["Date"] == date_str) & 
                (df["Guest Name"].str.strip().str.lower() == guest_name.strip().lower()) &
                (df["Mobile Number"].astype(str).str.strip() == mobile_str)
            )
            df = df[match_mask]
            df.to_csv(CSV_FILE, index=False)
