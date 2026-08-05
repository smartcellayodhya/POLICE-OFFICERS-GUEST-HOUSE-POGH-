import streamlit as st
import pandas as pd
from datetime import datetime, date, timedelta
import os

from database import BookingDatabase, SUITS, DEFAULT_RATES, COLUMNS
from app_utils import (
    format_date_to_str,
    parse_str_to_date,
    get_dates_in_range,
    generate_whatsapp_link,
    export_dataframe_to_excel,
    to_hindi_date,
    clean_and_format_rate
)
from pdf_generator import generate_hindi_letter_pdf

# ─── Page Config ────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="POGH Booking & Letter System",
    page_icon="👮",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─── Global CSS ─────────────────────────────────────────────────────────────
st.markdown("""
<style>
/* ── Google Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');

html, body, [class*="css"] {
    font-family: 'Inter', 'Noto Sans Devanagari', sans-serif;
    background-color: #F8FAFC !important;
}

/* ── Main Header ── */
.main-header {
    background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
    padding: 30px 40px;
    border-radius: 12px;
    border-bottom: 4px solid #D97706;
    color: white;
    text-align: center;
    margin-bottom: 28px;
    box-shadow: 0 4px 20px rgba(15, 23, 42, 0.15);
}
.main-header h1 {
    color: #FFFFFF;
    margin: 0 0 8px 0;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}
.main-header p {
    color: #94A3B8;
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.5px;
}

/* ── Status Banners ── */
.banner-green {
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    color: #166534;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.banner-yellow {
    background: #FFFBEB;
    border: 1px solid #FEF3C7;
    color: #92400E;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* ── Metric Cards ── */
.metric-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    margin-bottom: 28px;
}
.metric-card {
    background: #FFFFFF;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    border-left: 5px solid #64748B;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.metric-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
.metric-card.total-bookings { border-left-color: #0F172A; }
.metric-card.occupied { border-left-color: #EF4444; }
.metric-card.free { border-left-color: #10B981; }
.metric-card.revenue { border-left-color: #D97706; }

.metric-card .value {
    font-size: 32px;
    font-weight: 700;
    color: #0F172A;
    line-height: 1.2;
}
.metric-card.occupied .value { color: #DC2626; }
.metric-card.free .value { color: #15803D; }
.metric-card.revenue .value { color: #B45309; }

.metric-card .label {
    font-size: 13px;
    color: #64748B;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 6px;
}

/* ── Sidebar Styling ── */
section[data-testid="stSidebar"] {
    background-color: #F8FAFC !important;
    border-right: 1px solid #E2E8F0;
    padding-top: 15px;
}
section[data-testid="stSidebar"] h2 {
    color: #0F172A !important;
    font-size: 20px;
    font-weight: 700;
}
.sidebar-divider {
    border: none;
    border-top: 2px solid #E2E8F0;
    margin: 18px 0;
}
.sidebar-header-badge {
    background-color: #0F172A;
    color: #FFFFFF;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 1px;
    padding: 8px 16px;
    border-radius: 8px;
    text-align: center;
    margin-bottom: 20px;
    border: 1px solid #D97706; /* gold accent border */
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.section-label {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin: 10px 0 8px 0;
    display: flex;
    align-items: center;
    gap: 6px;
}

/* Sidebar inputs container card look */
section[data-testid="stSidebar"] [data-testid="stVerticalBlockBorderWrapper"] {
    background-color: #FFFFFF !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05) !important;
    border: 1px solid #E2E8F0 !important;
    padding: 16px !important;
    margin-bottom: 12px !important;
}

/* Form controls styling (Global) */
div[data-testid="stTextInput"] label,
div[data-testid="stSelectbox"] label,
div[data-testid="stMultiSelect"] label,
div[data-testid="stDateInput"] label,
div[data-testid="stNumberInput"] label {
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #475569 !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px !important;
}
div[data-testid="stTextInput"] input,
div[data-testid="stSelectbox"] select,
div[data-testid="stMultiSelect"] div[role="button"],
div[data-testid="stDateInput"] input,
div[data-testid="stTextArea"] textarea {
    border-radius: 8px !important;
    border: 1px solid #CBD5E1 !important;
    background-color: #FFFFFF !important;
    color: #0F172A !important;
    padding: 6px 12px !important;
    transition: border-color 0.2s, box-shadow 0.2s;
}
div[data-testid="stTextInput"] input:focus,
div[data-testid="stSelectbox"] select:focus,
div[data-testid="stDateInput"] input:focus,
div[data-testid="stMultiSelect"] div[role="button"]:focus-within {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
}

/* Primary Button Override */
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%) !important;
    color: #FFFFFF !important;
    border: none !important;
    border-radius: 8px !important;
    font-weight: 700 !important;
    font-size: 15px !important;
    padding: 12px 24px !important;
    width: 100%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 4px 14px 0 rgba(37, 99, 235, 0.3) !important;
}
.stButton > button[kind="primary"]:hover {
    transform: scale(1.02) translateY(-1px) !important;
    box-shadow: 0 6px 20px 0 rgba(37, 99, 235, 0.4) !important;
}
.stButton > button[kind="primary"]:active {
    transform: scale(0.98) !important;
}

/* ── Occupancy Table Styling ── */
.occupancy-table-container {
    overflow-x: auto;
    border: 1px solid #E2E8F0;
    border-radius: 10px;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
    margin-top: 15px;
}
.occupancy-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
    background: #FFFFFF;
}
.occupancy-table th {
    background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
    color: #FFFFFF;
    font-weight: 600;
    padding: 14px 16px;
    border-bottom: 2px solid #E2E8F0;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
}
.occupancy-table td {
    padding: 12px 16px;
    border-bottom: 1px solid #F1F5F9;
    color: #334155;
    vertical-align: middle;
}
.occupancy-table tr:hover {
    background-color: #F8FAFC;
}
.occupancy-table tr.today-row {
    background-color: rgba(59, 130, 246, 0.05) !important;
    border-left: 4px solid #3B82F6;
}
.occupancy-table tr.today-row td {
    font-weight: 600;
    color: #1E40AF;
}

/* Status Badges */
.badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}
.badge.vacant {
    background-color: rgba(16, 185, 129, 0.08);
    color: #10B981;
    border: 1px solid rgba(16, 185, 129, 0.3);
}
.badge.booked {
    background-color: rgba(239, 68, 68, 0.08);
    color: #EF4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
}
.badge.booked .price {
    background-color: #EF4444;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 6px;
    font-size: 11px;
    font-weight: 700;
}

/* ── Media Queries for Responsive Display on All Screen Sizes ── */
@media (max-width: 768px) {
    .main-header {
        padding: 20px 15px !important;
        margin-bottom: 20px !important;
    }
    .main-header h1 {
        font-size: 22px !important;
    }
    .main-header p {
        font-size: 13px !important;
    }
    .metric-card {
        padding: 15px !important;
    }
    .metric-card .value {
        font-size: 26px !important;
    }
    .occupancy-table th, .occupancy-table td {
        padding: 10px 12px !important;
        font-size: 13px !important;
    }
    section[data-testid="stSidebar"] [data-testid="stVerticalBlockBorderWrapper"] {
        padding: 12px !important;
        margin-bottom: 10px !important;
    }
}
</style>
""", unsafe_allow_html=True)

# ─── DB Init ────────────────────────────────────────────────────────────────
# Re-initialize DB if not present or if currently in Local mode to auto-pickup credentials.json
if "db" not in st.session_state:
    st.session_state.db = BookingDatabase()

if "edit_active" not in st.session_state:
    st.session_state.edit_active = False
if "edit_booking_data" not in st.session_state:
    st.session_state.edit_booking_data = None

db = st.session_state.db

@st.cache_data(ttl=15)
def cached_load_data():
    return db.load_data()

# ─── Header ─────────────────────────────────────────────────────────────────
st.markdown("""
<div class="main-header">
    <h1>👮 POLICE OFFICERS GUEST HOUSE (POGH)</h1>
    <p>Booking & Letter Generator Management System &nbsp;•&nbsp; Ayodhya</p>
</div>
""", unsafe_allow_html=True)

# ─── Connection Banner ───────────────────────────────────────────────────────
if db.mode == "GoogleSheets":
    st.markdown(
        f'<div class="banner-green">🟢 &nbsp;Live Google Sheets Connected &nbsp;→&nbsp; <b>{db.sheet_title}</b></div>',
        unsafe_allow_html=True
    )
else:
    ban_col1, ban_col2 = st.columns([4, 1])
    err_msg = ""
    conn_err = getattr(db, "connection_error", None)
    if conn_err:
        err_msg = f" <br><span style='font-size:12px; color:#DC2626;'>Error detail: {conn_err}</span>"
    ban_col1.markdown(
        f'<div class="banner-yellow">⚠️ &nbsp;Running in Local CSV Mode. Make sure <b>credentials.json</b> is present in project folder.{err_msg}</div>',
        unsafe_allow_html=True
    )
    if ban_col2.button("🔄 Connect Sheets", use_container_width=True):
        st.session_state.db = BookingDatabase()
        st.cache_data.clear()
        st.rerun()

# ─── Load Data ───────────────────────────────────────────────────────────────
raw_df = cached_load_data()

# ─── Quick Stats Row ─────────────────────────────────────────────────────────
total_bookings = len(raw_df)
today_str = format_date_to_str(date.today())
today_rows = raw_df[raw_df["Date"] == today_str] if total_bookings > 0 else pd.DataFrame()
suits_occupied_today = sum(1 for s in SUITS if (today_rows[s].astype(float) != 0).any()) if len(today_rows) > 0 else 0
suits_free_today = 4 - suits_occupied_today
total_revenue = raw_df["TOTAL AMOUNT"].astype(float).sum() if total_bookings > 0 else 0

st.markdown(f"""
<div class="metric-container">
    <div class="metric-card total-bookings">
        <div class="value">{total_bookings}</div>
        <div class="label">Total Bookings</div>
    </div>
    <div class="metric-card occupied">
        <div class="value">{suits_occupied_today}</div>
        <div class="label">Suites Occupied Today</div>
    </div>
    <div class="metric-card free">
        <div class="value">{suits_free_today}</div>
        <div class="label">Suites Free Today</div>
    </div>
    <div class="metric-card revenue">
        <div class="value">₹{total_revenue:,.0f}</div>
        <div class="label">Total Revenue</div>
    </div>
</div>
""", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════════════
#  SIDEBAR — NEW BOOKING FORM
# ═══════════════════════════════════════════════════════════════════════════
with st.sidebar:
    is_edit = st.session_state.edit_active
    edit_data = st.session_state.edit_booking_data

    # Header Banner Badge
    if is_edit:
        st.markdown('<div class="sidebar-header-badge">📋 EDIT BOOKING ENTRY</div>', unsafe_allow_html=True)
    else:
        st.markdown('<div class="sidebar-header-badge">📋 NEW BOOKING ENTRY</div>', unsafe_allow_html=True)

    # ── CONTAINER CARD 1: Guest Info & Reference ──
    with st.container(border=True):
        st.markdown('<div class="section-label">👤 Guest & Reference Details</div>', unsafe_allow_html=True)
        
        init_name = edit_data["guest_name"] if is_edit else ""
        init_mobile = edit_data["mobile_number"] if is_edit else ""
        
        form_guest_name = st.text_input("Guest Name", value=init_name, placeholder="e.g. Ramesh Kumar").strip()
        form_mobile     = st.text_input("Mobile Number", value=init_mobile, placeholder="e.g. 9876543210", max_chars=10).strip()

        references = ["SSP SIR", "PRO Sir Ayodhya", "SP City", "SP RA", "CO Security", "Other"]
        
        init_ref_idx = 0
        init_custom_ref = ""
        if is_edit:
            ref_val = edit_data.get("reference", "")
            if ref_val in references[:-1]:
                init_ref_idx = references.index(ref_val)
            else:
                init_ref_idx = references.index("Other")
                init_custom_ref = ref_val

        form_ref_select = st.selectbox("Reference / Authority", references, index=init_ref_idx)
        if form_ref_select == "Other":
            form_ref = st.text_input("Custom Reference", value=init_custom_ref, placeholder="e.g. IG Range").strip()
        else:
            form_ref = form_ref_select

    # ── CONTAINER CARD 2: Stay Dates & Suites ──
    with st.container(border=True):
        st.markdown('<div class="section-label">📅 Stay & Room Selection</div>', unsafe_allow_html=True)
        
        init_in = parse_str_to_date(edit_data["check_in_date"]) if is_edit else date.today()
        init_out = parse_str_to_date(edit_data["check_out_date"]) if is_edit else (date.today() + timedelta(days=1))
        
        form_check_in  = st.date_input("Check-In Date",  value=init_in)
        form_check_out = st.date_input("Check-Out Date", value=init_out)

        suit_options = ["Suite 1", "Suite 2", "Suite 3", "Suite 4"]
        
        init_suits = []
        if is_edit:
            raw_suits = [s.strip() for s in edit_data.get("suit_numbers", "").split(",")]
            init_suits = [s for s in raw_suits if s in suit_options]

        init_all_suites = (len(init_suits) == 4) if is_edit else False
        book_all_suites = st.checkbox("Select All Suites (सभी सूट चुनें)", value=init_all_suites)
        
        if book_all_suites:
            selected_suits = ["Suit 1", "Suit 2", "Suit 3", "Suit 4"]
            st.markdown('<span style="font-size: 13px; color: #15803D; font-weight: 600; padding-left: 4px;">✓ All 4 Suites Selected</span>', unsafe_allow_html=True)
        else:
            selected_suit_labels = st.multiselect("Suites to Book", suit_options, label_visibility="collapsed",
                                                  default=init_suits, placeholder="Select suites...")
            selected_suits = [f"Suit {i+1}" for i, lbl in enumerate(suit_options) if lbl in selected_suit_labels]

        init_rate = clean_and_format_rate(edit_data["rate_per_day"]) if is_edit else ""
        if init_rate == "-1.0":
            init_rate = ""
        form_rate = st.text_input("Room Rate Per Day (optional)", value=init_rate, placeholder="e.g. 800").strip()

    # ── CONTAINER CARD 3: Meal Status & Submit ──
    with st.container(border=True):
        st.markdown('<div class="section-label">🍽️ Meal / Payment Status</div>', unsafe_allow_html=True)
        
        meal_options = ["PAID", "UNPAID", "COMPLIMENTARY"]
        init_meal_idx = 0
        if is_edit:
            meal_val = edit_data.get("meal_status", "UNPAID").upper()
            if meal_val in meal_options:
                init_meal_idx = meal_options.index(meal_val)
        meal_status = st.selectbox("Meal Status", meal_options, index=init_meal_idx, label_visibility="collapsed")

        # ── Validation ──
        submit_enabled  = True
        validation_msg  = ""
        conflict_messages = []

        parsed_rate = -1.0
        if form_rate:
            try:
                parsed_rate = float(form_rate)
                if parsed_rate < 0:
                    submit_enabled = False; validation_msg = "Rate must be a positive number."
            except ValueError:
                submit_enabled = False; validation_msg = "Rate must be a valid number."

        if submit_enabled:
            if not form_guest_name:
                submit_enabled = False; validation_msg = "Enter guest name."
            elif not form_mobile:
                submit_enabled = False; validation_msg = "Enter mobile number."
            elif len(form_mobile) != 10 or not form_mobile.isdigit():
                submit_enabled = False; validation_msg = "Mobile number must be exactly 10 digits."
            elif len(selected_suits) == 0:
                submit_enabled = False; validation_msg = "Select at least one suite."
            elif form_check_out < form_check_in:
                submit_enabled = False; validation_msg = "Check-out must be after check-in."

        if submit_enabled:
            dates_to_book = get_dates_in_range(form_check_in, form_check_out)
            
            exc_name = edit_data["guest_name"] if is_edit else form_guest_name
            exc_mobile = edit_data["mobile_number"] if is_edit else form_mobile
            
            conflict_messages = db.check_conflicts(
                dates_list=dates_to_book,
                requested_suits=selected_suits,
                exclude_guest_name=exc_name,
                exclude_mobile=exc_mobile
            )
            if conflict_messages:
                submit_enabled = False

        # ── Status message ──
        if conflict_messages:
            for msg in conflict_messages:
                st.error(f"⚠️ {msg}", icon=None)
        elif not submit_enabled and validation_msg:
            st.info(f"ℹ️ {validation_msg}")
        else:
            nights = len(get_dates_in_range(form_check_in, form_check_out))
            display_rate = parsed_rate if parsed_rate >= 0 else 0.0
            amt = display_rate * len(selected_suits) * max(nights, 1)
            if parsed_rate >= 0:
                st.success(f"✅ Ready — {nights} night(s) · ₹{amt:,.0f}")
            else:
                st.success(f"✅ Ready — {nights} night(s) · Rate: (Not printed)")

        # ── Submit/Update Buttons ──
        st.markdown('<div style="margin-top: 15px;"></div>', unsafe_allow_html=True)
        if is_edit:
            col_up, col_can = st.columns(2)
            if col_up.button("💾 Update", type="primary", use_container_width=True, disabled=not submit_enabled):
                dates_to_book = get_dates_in_range(form_check_in, form_check_out)
                with st.spinner("Updating..."):
                    # First delete original booking dates
                    for d_str in edit_data["original_dates"]:
                        db.delete_booking(d_str, edit_data["guest_name"], edit_data["mobile_number"])
                    # Then save new booking dates
                    for date_str in dates_to_book:
                        suit_allocations = {s: (parsed_rate if s in selected_suits else 0.0) for s in SUITS}
                        db.save_booking(
                            date_str=date_str,
                            guest_name=form_guest_name,
                            mobile=form_mobile,
                            reference=form_ref,
                            suit_allocations=suit_allocations,
                            meal_status=meal_status
                        )
                st.success("🎉 Updated!")
                st.session_state.edit_active = False
                st.session_state.edit_booking_data = None
                st.cache_data.clear()
                st.rerun()

            if col_can.button("❌ Cancel", use_container_width=True):
                st.session_state.edit_active = False
                st.session_state.edit_booking_data = None
                st.rerun()
        else:
            if st.button("💾 Confirm Booking", type="primary", use_container_width=True, disabled=not submit_enabled):
                dates_to_book = get_dates_in_range(form_check_in, form_check_out)
                with st.spinner("Saving..."):
                    for date_str in dates_to_book:
                        suit_allocations = {s: (parsed_rate if s in selected_suits else 0.0) for s in SUITS}
                        db.save_booking(
                            date_str=date_str,
                            guest_name=form_guest_name,
                            mobile=form_mobile,
                            reference=form_ref,
                            suit_allocations=suit_allocations,
                            meal_status=meal_status
                        )
                st.success("🎉 Confirmed!")
                st.cache_data.clear()
                st.rerun()

# ═══════════════════════════════════════════════════════════════════════════
#  MAIN TABS
# ═══════════════════════════════════════════════════════════════════════════
tab_grid, tab_database, tab_letter, tab_revenue = st.tabs([
    "📅  Room Occupancy Grid",
    "📁  Bookings Database",
    "✍️  Confirmation Letter",
    "📊  Monthly Revenue Tracker"
])

# ───────────────────────────────────────────────────────────────────────────
#  TAB 1 — INTERACTIVE BOOKING GRID
# ───────────────────────────────────────────────────────────────────────────
with tab_grid:
    st.markdown("### 🛏️ Live Room Occupancy Grid")

    col_gs, col_ge, _ = st.columns([1, 1, 2])
    sel_grid_start = col_gs.date_input("From Date", value=date.today() - timedelta(days=3), key="gs")
    sel_grid_end   = col_ge.date_input("To Date",   value=date.today() + timedelta(days=14), key="ge")

    # Legend
    st.markdown("""
    <div style="margin: 8px 0 20px 0; display: flex; gap: 12px; align-items: center;">
        <span class="badge vacant">🟢 Vacant</span>
        <span class="badge booked">🔴 Booked</span>
        <span style="font-size: 12px; font-weight: 600; color: #1E3A8A; background-color: #EFF6FF; border: 1px dashed #3B82F6; padding: 5px 12px; border-radius: 20px; display: inline-flex; align-items: center; gap: 4px;">📌 TODAY</span>
    </div>
    """, unsafe_allow_html=True)

    if sel_grid_end >= sel_grid_start:
        display_dates = []
        d = sel_grid_start
        while d <= sel_grid_end:
            display_dates.append(format_date_to_str(d))
            d += timedelta(days=1)

        grid_data = []
        df_bookings = raw_df.copy()
        today_str_local = format_date_to_str(date.today())

        for d_str in display_dates:
            is_today = "📌 TODAY" if d_str == today_str_local else ""
            row_dict = {"Date": f"{d_str}  {is_today}".strip(),
                        "Suit 1": "Vacant", "Suit 2": "Vacant",
                        "Suit 3": "Vacant", "Suit 4": "Vacant"}

            day_bookings = df_bookings[df_bookings["Date"] == d_str]
            for _, bk in day_bookings.iterrows():
                for s in SUITS:
                    price = bk.get(s, 0)
                    try:
                        if float(price) > 0:
                            row_dict[s] = f"₹{float(price):,.0f} — {bk['Guest Name']}"
                    except (ValueError, TypeError):
                        pass
            grid_data.append(row_dict)

        # Render occupancy grid as custom HTML table
        html_table = '<div class="occupancy-table-container"><table class="occupancy-table">'
        html_table += '<thead><tr>'
        html_table += '<th>Date</th>'
        html_table += '<th>Suite 1</th>'
        html_table += '<th>Suite 2</th>'
        html_table += '<th>Suite 3</th>'
        html_table += '<th>Suite 4</th>'
        html_table += '</tr></thead><tbody>'

        for row in grid_data:
            d_val = row["Date"]
            is_today = "📌 TODAY" in d_val
            row_class = ' class="today-row"' if is_today else ''
            html_table += f'<tr{row_class}>'
            html_table += f'<td><b>{d_val}</b></td>'

            for s in ["Suit 1", "Suit 2", "Suit 3", "Suit 4"]:
                cell_val = row[s]
                if cell_val == "Vacant":
                    html_table += '<td><span class="badge vacant">🟢 Vacant</span></td>'
                else:
                    parts = cell_val.split(" — ")
                    if len(parts) == 2:
                        price, guest = parts[0], parts[1]
                        html_table += f'<td><span class="badge booked"><span class="price">{price}</span> 🔴 {guest}</span></td>'
                    else:
                        html_table += f'<td><span class="badge booked">🔴 {cell_val}</span></td>'
            html_table += '</tr>'
        html_table += '</tbody></table></div>'
        st.markdown(html_table, unsafe_allow_html=True)
    else:
        st.error("End date must be after start date.")

# ───────────────────────────────────────────────────────────────────────────
#  TAB 2 — RAW DATABASE + SEARCH
# ───────────────────────────────────────────────────────────────────────────
with tab_database:
    st.markdown("### 🔍 Search & Filter Bookings")

    col1, col2, col3 = st.columns([2, 1, 2])
    search_query = col1.text_input("Search by Guest Name or Mobile", placeholder="Type to search...").strip()
    filter_ref   = col2.selectbox("Filter by Reference", ["All"] + references)

    db_dates    = raw_df["Date"].dropna().unique()
    parsed_dates = sorted([d for d in (parse_str_to_date(x) for x in db_dates) if d])
    min_date = parsed_dates[0]  if parsed_dates else date.today() - timedelta(days=30)
    max_date = parsed_dates[-1] if parsed_dates else date.today() + timedelta(days=30)

    date_range = col3.date_input("Date Range", value=[min_date, max_date], key="db_range")
    filter_start = date_range[0] if len(date_range) == 2 else min_date
    filter_end   = date_range[1] if len(date_range) == 2 else max_date

    filtered_df = raw_df.copy()
    if search_query:
        filtered_df = filtered_df[
            filtered_df["Guest Name"].str.contains(search_query, case=False, na=False) |
            filtered_df["Mobile Number"].astype(str).str.contains(search_query, na=False)
        ]
    if filter_ref != "All":
        filtered_df = filtered_df[filtered_df["Reference"] == filter_ref]

    def in_range(d_str):
        d = parse_str_to_date(d_str)
        return d and filter_start <= d <= filter_end

    if len(filtered_df) > 0:
        filtered_df = filtered_df[filtered_df["Date"].apply(in_range)]

    c1, c2 = st.columns([3, 1])
    c1.markdown(f"**{len(filtered_df)} record(s) found**")
    if len(filtered_df) > 0:
        excel_data = export_dataframe_to_excel(filtered_df)
        c2.download_button(
            label="📥 Export Excel",
            data=excel_data,
            file_name=f"pogh_bookings_{datetime.now().strftime('%Y%m%d')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            use_container_width=True
        )

    # Rename columns to Suite 1-4 for display consistency
    display_filtered_df = filtered_df.rename(columns={
        "Suit 1": "Suite 1",
        "Suit 2": "Suite 2",
        "Suit 3": "Suite 3",
        "Suit 4": "Suite 4"
    })
    st.dataframe(display_filtered_df, use_container_width=True, hide_index=True)

# ───────────────────────────────────────────────────────────────────────────
#  TAB 3 — CONFIRMATION LETTER
# ───────────────────────────────────────────────────────────────────────────
with tab_letter:
    st.markdown("### ✍️ Official Hindi Confirmation Letter")

    if len(raw_df) == 0:
        st.warning("No bookings yet. Add a booking from the sidebar first.")
    else:
        # Build unique bookings list
        raw_df["_parsed"] = raw_df["Date"].apply(parse_str_to_date)
        sorted_df = raw_df.sort_values("_parsed", ascending=False)

        unique_bookings = []
        seen = set()
        for _, row in sorted_df.iterrows():
            guest, mobile = row["Guest Name"], str(row["Mobile Number"])
            key = (guest, mobile)
            if key in seen:
                continue
            seen.add(key)

            g_rows = raw_df[(raw_df["Guest Name"] == guest) & (raw_df["Mobile Number"].astype(str) == mobile)]
            guest_dates = sorted([d for d in (parse_str_to_date(x) for x in g_rows["Date"].unique()) if d])
            if not guest_dates:
                continue

            check_in  = guest_dates[0]
            check_out = guest_dates[-1] + timedelta(days=1)

            suits_booked, rate_list = [], []
            for s in SUITS:
                vals = [float(v) for v in g_rows[s].dropna() if float(v) != 0]
                if vals:
                    suits_booked.append(s)
                    if vals[0] > 0:
                        rate_list.append(vals[0])

            unique_bookings.append({
                "guest_name":    guest,
                "mobile_number": mobile,
                "reference":     row["Reference"],
                "check_in_date": format_date_to_str(check_in),
                "check_out_date":format_date_to_str(check_out),
                "num_rooms":     len(suits_booked),
                "suit_numbers":  ", ".join(suits_booked).replace("Suit", "Suite"),
                "total_days":    len(guest_dates),
                "rate_per_day":  ", ".join(f"₹{r:,.0f}" for r in rate_list),
                "total_amount":  g_rows["TOTAL AMOUNT"].astype(float).sum(),
                "meal_status":   g_rows.iloc[0]["MEAL TYPE STATUS"],
                "original_dates":[format_date_to_str(d) for d in guest_dates]
            })

        options = [
            f"{b['guest_name']}  ({b['mobile_number']})  —  {b['check_in_date']} → {b['check_out_date']}  [{b['suit_numbers']}]"
            for b in unique_bookings
        ]
        sel_idx = st.selectbox("Select Booking", range(len(options)), format_func=lambda x: options[x])

        if sel_idx is not None:
            bk = unique_bookings[sel_idx]
            st.markdown("---")

            col_left, col_right = st.columns([1, 1.6])

            with col_left:
                st.markdown("#### ⚙️ Letter Settings")
                letter_date    = st.date_input("Letter Date", value=date.today())
                check_in_time  = st.text_input("Check-In Time", value="12:00 PM")
                check_out_time = st.text_input("Check-Out Time", value="12:00 PM")

                # Manual rate input override
                rate_str = clean_and_format_rate(bk["rate_per_day"])
                letter_rate = st.text_input("Rate Per Day (Leave blank to hide)", value=rate_str)

                pdf_details = {
                    "guest_name":            bk["guest_name"],
                    "mobile_number":         bk["mobile_number"],
                    "check_in_date":         bk["check_in_date"],
                    "check_out_date":        bk["check_out_date"],
                    "num_rooms":             bk["num_rooms"],
                    "suit_numbers":          bk["suit_numbers"],
                    "check_in_time":         check_in_time,
                    "check_out_time":        check_out_time,
                    "total_days":            bk["total_days"],
                    "rate_per_day":          letter_rate.strip(),
                    "total_amount":          bk["total_amount"],
                    "booking_generated_date":format_date_to_str(letter_date)
                }

                st.markdown("#### 🚀 Actions")

                # PDF Download
                try:
                    pdf_bytes = generate_hindi_letter_pdf(pdf_details)
                    st.download_button(
                        label="📄 Download PDF (Hindi)",
                        data=pdf_bytes,
                        file_name=f"POGH_Letter_{bk['guest_name'].replace(' ','_')}.pdf",
                        mime="application/pdf",
                        use_container_width=True
                    )
                except Exception as e:
                    st.error(f"PDF error: {e}")

                # WhatsApp Link
                wa_link = generate_whatsapp_link(pdf_details)
                st.link_button("💬 Send via WhatsApp", url=wa_link, use_container_width=True)

                # Edit Booking
                if st.button("✏️ Edit Booking (संशोधन करें)", use_container_width=True):
                    st.session_state.edit_active = True
                    st.session_state.edit_booking_data = bk
                    st.rerun()

                # Copy Letter Text
                letter_text = (
                    f"कार्यालय वरिष्ठ पुलिस अधीक्षक, अयोध्या\n"
                    f"पुलिस ऑफिसर्स गेस्ट हाउस, अयोध्या\n"
                    f"पत्रांक: पी.ओ.जी.एच./बुकिंग/2026/______\n"
                    f"दिनांक: {to_hindi_date(pdf_details['booking_generated_date'])}\n\n"
                    f"सेवा में,\n"
                    f"   श्री {bk['guest_name']}\n"
                    f"   मो०नं०- {bk['mobile_number']}\n\n"
                    f"विषय: पुलिस ऑफिसर्स गेस्ट हाउस में सूट आरक्षित किये जाने की पुष्टि के संबंध में।\n\n"
                    f"महोदय,\n"
                    f"   अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक {to_hindi_date(bk['check_in_date'])} से {to_hindi_date(bk['check_out_date'])} तक आपके प्रवास हेतु {bk['num_rooms']} रूम आरक्षित कर दिया गया है।\n\n"
                    f"विवरण:\n"
                    f"- गेस्ट का नाम: {bk['guest_name']}\n"
                    f"- कब से कब तक: दि० {to_hindi_date(bk['check_in_date'])} से {to_hindi_date(bk['check_out_date'])} तक\n"
                    f"- रूम की संख्या: {bk['num_rooms']} रूम\n"
                    f"- सूट नम्बर: {bk['suit_numbers']}\n"
                    f"- चेक-इन / चेक-आउट: {to_hindi_date(bk['check_in_date'])} ({check_in_time}) / {to_hindi_date(bk['check_out_date'])} ({check_out_time})\n"
                )
                if letter_rate:
                    letter_text += f"- प्रति रूम प्रति दिन किराया: ₹{letter_rate}/-\n"
                letter_text += (
                    f"\nकेयरटेकर विवरण:\n"
                    f"- उ0नि0 यदुनाथ (केयरटेकर), मो०नं०- 8317041684\n"
                    f"- पुलिस ऑफिसर्स गेस्ट हाउस, अयोध्या (अयोध्या रेंज) में आपका स्वागत है।\n\n"
                    f"भवदीय,\n"
                    f"वरिष्ठ पुलिस अधीक्षक,\n"
                    f"अयोध्या"
                )
                with st.expander("📋 Copy Letter Text (कॉपी करें)"):
                    st.code(letter_text, language="text")
 
                # Cancel Booking
                st.markdown("")
                with st.expander("❌ Cancel Booking (बुकिंग निरस्त करें)"):
                    st.warning(f"This will permanently cancel and delete all room records for **{bk['guest_name']}**.")
                    confirm_del = st.checkbox("I confirm cancellation (मैं बुकिंग निरस्त करने की पुष्टि करता हूँ)", value=False)
                    if st.button("Confirm Cancellation", type="primary", disabled=not confirm_del):
                        with st.spinner("निरस्त किया जा रहा है... (Canceling booking...)"):
                            for d_str in bk["original_dates"]:
                                db.delete_booking(d_str, bk["guest_name"], bk["mobile_number"])
                        st.success("Booking cancelled.")
                        st.cache_data.clear()
                        st.rerun()

            with col_right:
                st.markdown("#### 📄 Letter Preview")
                st.markdown(f"""
<div style="background:#fff; border:1px solid #D1D5DB; border-radius:12px; padding:32px;
            font-family:'Noto Sans Devanagari','Arial',sans-serif; line-height:1.8; color:#111;
            box-shadow:0 4px 16px rgba(0,0,0,0.07);">

  <div style="text-align:center; border-bottom:2px solid #1E3A8A; padding-bottom:12px; margin-bottom:16px;">
    <div style="font-size:17px; font-weight:700; color:#1E3A8A;">कार्यालय वरिष्ठ पुलिस अधीक्षक, अयोध्या</div>
    <div style="font-size:12px; color:#6B7280; margin-top:2px;">पुलिस ऑफिसर्स गेस्ट हाउस, अयोध्या</div>
  </div>

  <div style="display:flex; justify-content:space-between; font-size:13px; color:#374151; margin-bottom:16px;">
    <span>पत्रांक: पी.ओ.जी.एच./बुकिंग/2026/______</span>
    <span>दिनांक: {to_hindi_date(pdf_details['booking_generated_date'])}</span>
  </div>

  <div style="margin-bottom:14px; font-size:14px;">
    <b>सेवा में,</b><br>
    &nbsp;&nbsp;&nbsp;श्री {bk['guest_name']}<br>
    &nbsp;&nbsp;&nbsp;मो०नं०- {bk['mobile_number']}
  </div>

  <div style="margin-bottom:14px; font-size:14px;">
    <b>विषय:</b> पुलिस ऑफिसर्स गेस्ट हाउस में सूट आरक्षित किये जाने की पुष्टि के संबंध में।
  </div>

  <div style="margin-bottom:16px; font-size:14px;">
    <b>महोदय,</b><br>
    &nbsp;&nbsp;&nbsp;अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक <b>{to_hindi_date(bk['check_in_date'])}</b>
    से <b>{to_hindi_date(bk['check_out_date'])}</b> तक आपके प्रवास हेतु <b>{bk['num_rooms']} रूम</b> आरक्षित कर दिया गया है।
  </div>

  <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:16px;">
    <tr style="background:#1E3A8A; color:white;">
      <th style="padding:8px 12px; text-align:left;">विवरण</th>
      <th style="padding:8px 12px; text-align:left;">सूचना</th>
    </tr>
    {"".join(f'<tr style="background:{"#F8FAFC" if i%2==0 else "#fff"};"><td style="padding:7px 12px; border:1px solid #E2E8F0;">{k}</td><td style="padding:7px 12px; border:1px solid #E2E8F0;"><b>{v}</b></td></tr>' for i,(k,v) in enumerate(
        [
            ("गेस्ट का नाम", bk['guest_name']),
            ("कब से कब तक", f"दि० {to_hindi_date(bk['check_in_date'])} से {to_hindi_date(bk['check_out_date'])} तक"),
            ("रूम की संख्या", f"{bk['num_rooms']} रूम"),
            ("सूट नम्बर", bk['suit_numbers']),
            ("चेक-इन / चेक-आउट", f"{to_hindi_date(bk['check_in_date'])} ({check_in_time}) / {to_hindi_date(bk['check_out_date'])} ({check_out_time})"),
            ("कुल दिन", f"{bk['total_days']} दिन"),
        ] + ([("प्रति रूम किराया", f"₹{pdf_details['rate_per_day']}/-")] if pdf_details['rate_per_day'] else [])
    ))}
  </table>

  <div style="font-size:13px; margin-bottom:16px; font-weight:600; color:#374151;">
    संपर्क: उ०नि० यदुनाथ — मो०नं० 8317041684
  </div>

  <div style="font-size:13px; margin-bottom:24px;">
    &nbsp;&nbsp;&nbsp;हम आपके स्वागत के लिए उत्सुक हैं और आशा करते हैं कि आपका प्रवास सुखद रहेगा।
  </div>

  <div style="text-align:right; font-weight:700; font-size:14px; color:#1E3A8A;">
    आज्ञा से<br>
    वरिष्ठ पुलिस अधीक्षक<br>
    अयोध्या
  </div>

  <div style="border-top:1px solid #D1D5DB; margin-top:20px; padding-top:10px; font-size:12px; color:#6B7280;">
    <b>प्रतिलिपि:</b> प्रभारी पुलिस ऑफिसर्स गेस्ट हाउस, पुलिस लाइन, अयोध्या।
  </div>
</div>
""", unsafe_allow_html=True)

# ───────────────────────────────────────────────────────────────────────────
#  TAB 4 — MONTHLY REVENUE TRACKER
# ───────────────────────────────────────────────────────────────────────────
with tab_revenue:
    st.markdown("### 📊 Monthly Revenue Tracker (मासिक राजस्व विश्लेषण)")
    
    if len(raw_df) == 0:
        st.info("No bookings found in database yet to generate analytics.")
    else:
        # Create a working copy of raw_df with parsed dates
        df_rev = raw_df.copy()
        
        # Helper to safely parse dates for grouping
        def safe_parse_year_month(d_str):
            try:
                dt = parse_str_to_date(d_str)
                return dt.year, dt.month, dt.strftime("%B")
            except Exception:
                return None, None, None
                
        parsed_cols = df_rev["Date"].apply(safe_parse_year_month)
        df_rev["Year"] = [p[0] for p in parsed_cols]
        df_rev["MonthNum"] = [p[1] for p in parsed_cols]
        df_rev["MonthName"] = [p[2] for p in parsed_cols]
        
        # Filter out unparsed dates
        df_rev = df_rev[df_rev["Year"].notna()]
        
        if len(df_rev) == 0:
            st.info("No bookings with valid dates found.")
        else:
            # Year selector
            available_years = sorted(list(df_rev["Year"].unique()), reverse=True)
            selected_year = st.selectbox("Select Year (वर्ष चुनें)", available_years, key="rev_year_select")
            
            # Filter data for selected year
            df_year = df_rev[df_rev["Year"] == selected_year]
            
            # Group by MonthNum and MonthName to sum up revenue
            monthly_grp = df_year.groupby(["MonthNum", "MonthName"]).agg(
                total_revenue=("TOTAL AMOUNT", lambda x: pd.to_numeric(x, errors='coerce').sum()),
                total_bookings=("Date", "count")
            ).reset_index()
            
            # Sort chronologically by month number
            monthly_grp = monthly_grp.sort_values("MonthNum")
            
            # Fill in missing months with zero revenue so the chart is continuous and beautiful!
            all_months = pd.DataFrame([
                (1, "January"), (2, "February"), (3, "March"), (4, "April"),
                (5, "May"), (6, "June"), (7, "July"), (8, "August"),
                (9, "September"), (10, "October"), (11, "November"), (12, "December")
            ], columns=["MonthNum", "MonthName"])
            
            monthly_grp = pd.merge(all_months, monthly_grp, on=["MonthNum", "MonthName"], how="left")
            monthly_grp["total_revenue"] = monthly_grp["total_revenue"].fillna(0.0)
            monthly_grp["total_bookings"] = monthly_grp["total_bookings"].fillna(0).astype(int)
            
            # Sum up annual stats
            annual_revenue = monthly_grp["total_revenue"].sum()
            active_months = len(monthly_grp[monthly_grp["total_revenue"] > 0])
            avg_monthly_rev = annual_revenue / max(active_months, 1)
            
            # Highest month details
            if annual_revenue > 0:
                max_idx = monthly_grp["total_revenue"].idxmax()
                max_row = monthly_grp.loc[max_idx]
                highest_month_str = f"{max_row['MonthName']} (₹{max_row['total_revenue']:,.0f})"
            else:
                highest_month_str = "N/A"
                
            # Display metrics cards
            st.markdown(f"""
            <div class="metric-container" style="margin-top: 15px;">
                <div class="metric-card" style="border-left-color: #2563eb;">
                    <div class="value">₹{annual_revenue:,.0f}</div>
                    <div class="label">Annual Revenue ({selected_year})</div>
                </div>
                <div class="metric-card" style="border-left-color: #10B981;">
                    <div class="value">₹{avg_monthly_rev:,.0f}</div>
                    <div class="label">Monthly Average</div>
                </div>
                <div class="metric-card" style="border-left-color: #D97706;">
                    <div class="value">{highest_month_str}</div>
                    <div class="label">Highest Earning Month</div>
                </div>
                <div class="metric-card" style="border-left-color: #64748B;">
                    <div class="value">{monthly_grp['total_bookings'].sum()}</div>
                    <div class="label">Total Room Nights Booked</div>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            st.markdown("---")
            
            # ── Graphical Chart ──
            st.markdown("#### 📈 Monthly Revenue Chart")
            chart_data = pd.DataFrame({
                "Month": monthly_grp["MonthName"],
                "Revenue (₹)": monthly_grp["total_revenue"]
            }).set_index("Month")
            st.bar_chart(chart_data, color="#2563eb")
            
            st.markdown("---")
            
            # ── Detailed Breakdown Table ──
            st.markdown("#### 📋 Detailed Monthly Summary Table")
            
            table_rows = ""
            for _, r in monthly_grp.iterrows():
                rev_val = r['total_revenue']
                table_rows += f"""
                <tr>
                    <td><b>{r['MonthName']}</b></td>
                    <td><span style="font-weight:700; color:{'#1E40AF' if rev_val > 0 else '#64748B'};">₹{rev_val:,.0f}</span></td>
                    <td>{r['total_bookings']}</td>
                </tr>
                """
                
            st.markdown(f"""
            <div class="occupancy-table-container">
                <table class="occupancy-table">
                    <thead>
                        <tr>
                            <th>Month (महीना)</th>
                            <th>Total Revenue (कुल राजस्व)</th>
                            <th>Booked Days (कुल बुकिंग दिवस)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {table_rows}
                    </tbody>
                </table>
            </div>
            """, unsafe_allow_html=True)
