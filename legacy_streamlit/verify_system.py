import os
import sys
from datetime import date, timedelta

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from database import BookingDatabase, SUITS
    from app_utils import format_date_to_str, parse_str_to_date, get_dates_in_range
    from pdf_generator import generate_hindi_letter_pdf, REGULAR_FONT_PATH
    import pandas as pd
    print("[SUCCESS] All modules imported successfully!")
except Exception as e:
    safe_e = str(e).encode('ascii', 'backslashreplace').decode('ascii')
    print(f"[FAIL] Module import failed: {safe_e}")
    sys.exit(1)

def run_tests():
    success = True
    print("\n--- Running POGH System Verification Tests ---\n")

    # 1. Date Utilities Test
    print("Testing Date Utilities...")
    try:
        test_date = date(2026, 8, 5)
        formatted = format_date_to_str(test_date)
        if formatted != "05-Aug-2026":
            print(f"  [FAIL] Date formatting failed: expected '05-Aug-2026', got '{formatted}'")
            success = False
        else:
            print("  [SUCCESS] Date formatting OK")

        parsed = parse_str_to_date("05-Aug-2026")
        if parsed != test_date:
            print(f"  [FAIL] Date parsing failed: expected {test_date}, got {parsed}")
            success = False
        else:
            print("  [SUCCESS] Date parsing OK")

        # Test case-insensitivity in parsing
        parsed_upper = parse_str_to_date("05-AUG-2026")
        if parsed_upper != test_date:
            print(f"  [FAIL] Uppercase date parsing failed: expected {test_date}, got {parsed_upper}")
            success = False
        else:
            print("  [SUCCESS] Uppercase date parsing OK")

        dates_range = get_dates_in_range("05-Aug-2026", "07-Aug-2026")
        expected_range = ["05-Aug-2026", "06-Aug-2026"]
        if dates_range != expected_range:
            print(f"  [FAIL] Date range failed: expected {expected_range}, got {dates_range}")
            success = False
        else:
            print("  [SUCCESS] Date range generation OK")
    except Exception as e:
        print(f"  [FAIL] Exception in Date Utilities test: {e}")
        success = False

    # 2. Database Integration Test (Local Mode)
    print("\nTesting Database (Local Mode fallback)...")
    db = None
    try:
        # Force Local Mode for verification test by cleaning settings or secrets mock
        db = BookingDatabase()
        db.mode = "Local"  # Ensure it tests local CSV logic
        db._init_local_csv()
        print(f"  - Database initialized in mode: {db.mode}")

        # Clean existing test data if any
        db.delete_booking("15-Dec-2030", "Test Guest", "9999999999")

        # Save test booking
        allocations = {"Suit 1": 800.0, "Suit 2": 0.0, "Suit 3": 0.0, "Suit 4": 0.0}
        db.save_booking(
            date_str="15-Dec-2030",
            guest_name="Test Guest",
            mobile="9999999999",
            reference="SSP SIR",
            suit_allocations=allocations,
            meal_status="PAID"
        )
        
        # Reload and check
        df = db.load_data()
        test_rows = df[(df["Guest Name"] == "Test Guest") & (df["Date"] == "15-Dec-2030")]
        if len(test_rows) == 0:
            print("  [FAIL] Failed to save booking: Row not found in CSV database.")
            success = False
        else:
            row = test_rows.iloc[0]
            if float(row["Suit 1"]) != 800.0 or float(row["TOTAL AMOUNT"]) != 800.0:
                print(f"  [FAIL] Database value check failed: Suit 1={row['Suit 1']}, Total={row['TOTAL AMOUNT']}")
                success = False
            else:
                print("  [SUCCESS] Booking save and retrieval OK")

        # Check conflict detection
        conflicts = db.check_conflicts(["15-Dec-2030"], ["Suit 1"])
        if len(conflicts) == 0:
            print("  [FAIL] Conflict detection failed: Suit 1 should be detected as booked on 15-Dec-2030.")
            success = False
        else:
            safe_conf = str(conflicts[0]).encode('ascii', 'backslashreplace').decode('ascii')
            print(f"  [SUCCESS] Conflict detection OK (Found conflict: {safe_conf})")
            
        # Exclude active guest check for edits
        no_conflicts = db.check_conflicts(["15-Dec-2030"], ["Suit 1"], exclude_guest_name="Test Guest", exclude_mobile="9999999999")
        if len(no_conflicts) > 0:
            print("  [FAIL] Conflict exclusion failed: Guest should not conflict with themselves during updates.")
            success = False
        else:
            print("  [SUCCESS] Conflict exclusion for updates OK")

        # Delete booking and verify clean up
        db.delete_booking("15-Dec-2030", "Test Guest", "9999999999")
        df_after_delete = db.load_data()
        test_rows_after = df_after_delete[(df_after_delete["Guest Name"] == "Test Guest") & (df_after_delete["Date"] == "15-Dec-2030")]
        if len(test_rows_after) > 0:
            print("  [FAIL] Delete booking failed: row still exists.")
            success = False
        else:
            print("  [SUCCESS] Delete booking OK")

    except Exception as e:
        print(f"  [FAIL] Exception in Database test: {e}")
        success = False

    # 3. PDF Generator Test
    print("\nTesting PDF Letter Generator...")
    try:
        pdf_details = {
            "guest_name": "विनय कुमार",
            "mobile_number": "9876543210",
            "check_in_date": "05-Aug-2026",
            "check_out_date": "07-Aug-2026",
            "num_rooms": 1,
            "suit_numbers": "Suit 1",
            "check_in_time": "12:00 PM",
            "check_out_time": "12:00 PM",
            "total_days": 2,
            "rate_per_day": "800.00",
            "total_amount": "1600.00",
            "booking_generated_date": "04-Aug-2026"
        }
        
        print("  - Attempting to compile PDF (will download Devanagari font if not cached)...")
        pdf_bytes = generate_hindi_letter_pdf(pdf_details)
        if not pdf_bytes or len(pdf_bytes) < 1000:
            print(f"  [FAIL] PDF generation failed: invalid bytes size {len(pdf_bytes) if pdf_bytes else 0}")
            success = False
        else:
            print(f"  [SUCCESS] PDF generation OK (Generated {len(pdf_bytes)} bytes)")
            
            # Save a sample verification letter
            output_name = "sample_hindi_letter_verification.pdf"
            with open(output_name, "wb") as f:
                f.write(pdf_bytes)
            print(f"  - Saved test letter to: {os.path.abspath(output_name)}")
            
            # Verify font download
            if os.path.exists(REGULAR_FONT_PATH):
                print(f"  - Devanagari Font cached at: {os.path.abspath(REGULAR_FONT_PATH)}")
            else:
                print("  [FAIL] Devanagari font was not saved to expected directory.")
                success = False

    except Exception as e:
        safe_e = str(e).encode('ascii', 'backslashreplace').decode('ascii')
        print(f"  [FAIL] Exception in PDF Generation test: {safe_e}")
        success = False

    print("\n-----------------------------------------")
    if success:
        print("[SUCCESS] All core verification tests PASSED!")
        return 0
    else:
        print("[FAIL] Some verification tests FAILED.")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
