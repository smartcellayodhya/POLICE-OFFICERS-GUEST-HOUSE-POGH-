---
title: Police Officers Guest House Pogh
emoji: 👮
colorFrom: blue
colorTo: indigo
sdk: streamlit
sdk_version: 1.35.0
app_file: app.py
pinned: false
---

# Police Officers Guest House (POGH) Booking & Letter Generator Management System

A production-ready Web Application for managing bookings at the Police Officers Guest House (POGH) in Ayodhya. Built using Python (Streamlit), with integrated live synchronization to **Google Sheets API** (and automatic local CSV fallback).

---

## Key Features

1. **Live Google Sheets Synchronization:** Stores and fetches all bookings in real time. Automatically falls back to a local database (`pogh_bookings.csv`) if API credentials are not set.
2. **Interactive Room Booking Grid:** Replicates a manual police guest house ledger. Booked suits display in **Red (#D9534F)** showing the room price, and the row for **Today's Date** is highlighted in **Green** for visual orientation.
3. **One-Click Hindi Letter Generator:** Generates high-quality, printable PDF confirmation letters in the official Hindi layout and font (Noto Sans Devanagari), complete with signature blocks and dispatch fields.
4. **Real-time Conflict Detection:** Prevents double-booking a specific Suit on any overlapping date.
5. **WhatsApp Web Confirmation Alerts:** Formulates a pre-filled Hindi booking confirmation alert and provides a one-click link to send via WhatsApp Web.
6. **Excel Exporter:** Instantly download the filtered or complete database as a formatted `.xlsx` spreadsheet.

---

## Project Structure

```text
E:\soft\
├── .streamlit/
│   ├── config.toml           # Theme and styling configuration
│   └── secrets.toml.example  # Template for Google Sheets connection secrets
├── fonts/
│   └── (Auto-downloaded Noto Sans Devanagari TTF fonts)
├── app.py                    # Main Streamlit web dashboard
├── database.py               # Database manager (Google Sheets / CSV Fallback)
├── pdf_generator.py          # Hindi PDF Confirmation Letter engine
├── utils.py                  # Helper functions for WhatsApp, Excel export, and date math
└── requirements.txt          # Python dependencies
```

---

## Setup Instructions

### Step 1: Install Python Dependencies
Ensure Python 3.8+ is installed. Run the following command in your terminal:

```bash
pip install -r requirements.txt
```

*Note: The app uses `fpdf2` and `uharfbuzz` for complex Devanagari text shaping in Hindi.*

### Step 2: Configure Google Sheets (Optional but Recommended)
If you want to sync the app with a live Google Sheet:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project, enable the **Google Sheets API** and **Google Drive API**.
3. Create a **Service Account** and generate a credentials key in JSON format.
4. Share your Google Sheet with the Service Account email (e.g., `your-service-account-email@your-project.iam.gserviceaccount.com`) giving it **Editor** permissions.
5. Copy the JSON key details and add them to:
   - **Option A:** A file named `credentials.json` in the root folder `E:\soft\`.
   - **Option B (Recommended for Streamlit):** Create `.streamlit/secrets.toml` (copying from `.streamlit/secrets.toml.example`) and fill in the details.

*If you do not perform this setup, the app will run in **Local Mode** using a local CSV file, displaying a notification banner.*

### Step 3: Run the Application
Start the Streamlit local server:

```bash
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501) in your browser.

---

## Operating Instructions

1. **Book a Suit:** Fill in the guest name, mobile, reference, date range, and select the suits to book. The app automatically checks for double-bookings. Click **Submit Booking**.
2. **Review Bookings:** Access the **Interactive Booking Grid** tab to view date-wise occupancy or **Raw Bookings Database** to search and filter bookings.
3. **Generate Official Confirmation:** Go to the **Confirmation Letter & WhatsApp Engine** tab. Select the booking from the dropdown. Adjust check-in/check-out times, then:
   - Click **Download Confirmation Letter (PDF)** to save the official Hindi PDF confirmation.
   - Click **Send Confirmation via WhatsApp Web** to draft and send a message template automatically.
   - Click **Delete Booking** to cancel allocations.
