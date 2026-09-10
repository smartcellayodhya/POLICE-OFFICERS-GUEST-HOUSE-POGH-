'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'hi' | 'en';

export const translations = {
  hi: {
    // Navigation
    dashboard: 'डैशबोर्ड',
    matrix: 'कमरों की स्थिति',
    bookings: 'बुकिंग पंजिका',
    settings: 'सेटिंग्स',
    
    // User & Roles
    admin: 'प्रशासक',
    officer: 'ड्यूटी अधिकारी',
    logout: 'लॉग आउट',
    language: 'भाषा',
    changeLanguage: 'भाषा बदलें',
    
    // Header & Brand
    portalTitle: 'पुलिस ऑफिसर्स गेस्ट हाउस',
    ayodhyaPolice: 'अयोध्या पुलिस',
    sspOffice: 'कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या',
    cloudSynced: 'क्लाउड सिंक सक्रिय',
    localStorage: 'लोकल स्टोरेज',
    
    // Actions & Buttons
    newBooking: 'नई बुकिंग',
    exportExcel: 'एक्सेल एक्सपोर्ट',
    allotmentLetter: 'आवंटन पत्र',
    whatsapp: 'व्हाट्सएप',
    edit: 'संशोधन',
    delete: 'हटाएं',
    cancel: 'निरस्त करें',
    restore: 'बहाल करें',
    save: 'सुरक्षित करें',
    close: 'बंद करें',
    print: 'प्रिंट',
    pdf: 'पीडीएफ',
    search: 'नाम, मोबाइल, संदर्भ या तिथि खोजें...',
    clearFilter: 'साफ़ करें',
    thisMonth: 'इस माह',
    lastMonth: 'गत माह',
    fromDate: 'कब से:',
    toDate: 'कब तक:',
    
    // Status
    all: 'सभी',
    confirmed: 'आरक्षित',
    checkedIn: 'उपस्थित',
    checkedOut: 'चेक-आउट',
    cancelled: 'निरस्त',
    status: 'स्थिति:',
    
    // Metrics
    totalBookings: 'कुल बुकिंग',
    activeGuests: 'वर्तमान में उपस्थित',
    monthlyBookings: 'इस माह बुकिंग',
    totalRevenue: 'कुल निर्धारित किराया',
    
    // Room Matrix
    available: 'उपलब्ध',
    booked: 'आरक्षित',
    today: 'आज',
    groundFloor: 'भू-तल',
    firstFloor: 'प्रथम तल',
    
    // Form Labels
    guestName: 'गेस्ट का नाम',
    mobileNumber: 'मोबाइल नंबर',
    reference: 'संदर्भ (रेफरेंस)',
    checkIn: 'आगमन (चेक-इन)',
    checkOut: 'प्रस्थान (चेक-आउट)',
    rooms: 'कमरे',
    roomRent: 'प्रति रूम प्रति दिन किराया (₹)',
    mealStatus: 'भोजन व्यवस्था',
    notes: 'विशेष विवरण (रिमार्क्स)',
    applyToAll: 'इस प्रवास के सभी दिवसों पर लागू करें',
  },
  en: {
    // Navigation
    dashboard: 'Dashboard',
    matrix: 'Room Status',
    bookings: 'Bookings Directory',
    settings: 'Settings',
    
    // User & Roles
    admin: 'Administrator',
    officer: 'Duty Officer',
    logout: 'Sign Out',
    language: 'Language',
    changeLanguage: 'Change Language',
    
    // Header & Brand
    portalTitle: 'Police Officers Guest House',
    ayodhyaPolice: 'Ayodhya Police',
    sspOffice: 'Office of SSP, Ayodhya District',
    cloudSynced: 'Cloud Synced',
    localStorage: 'Local Storage',
    
    // Actions & Buttons
    newBooking: 'New Booking',
    exportExcel: 'Export Excel',
    allotmentLetter: 'Official Letter',
    whatsapp: 'WhatsApp',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    restore: 'Restore',
    save: 'Save Changes',
    close: 'Close',
    print: 'Print',
    pdf: 'PDF',
    search: 'Search by name, mobile, reference...',
    clearFilter: 'Clear',
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    fromDate: 'From:',
    toDate: 'To:',
    
    // Status
    all: 'All',
    confirmed: 'Confirmed',
    checkedIn: 'In House',
    checkedOut: 'Checked Out',
    cancelled: 'Cancelled',
    status: 'Status:',
    
    // Metrics
    totalBookings: 'Total Bookings',
    activeGuests: 'In-House Guests',
    monthlyBookings: 'This Month',
    totalRevenue: 'Total Revenue',
    
    // Room Matrix
    available: 'Available',
    booked: 'Booked',
    today: 'Today',
    groundFloor: 'Ground Floor',
    firstFloor: 'First Floor',
    
    // Form Labels
    guestName: 'Guest Name',
    mobileNumber: 'Mobile Number',
    reference: 'Reference',
    checkIn: 'Check-in Date',
    checkOut: 'Check-out Date',
    rooms: 'Suits',
    roomRent: 'Room Rent per Day (₹)',
    mealStatus: 'Meal Status',
    notes: 'Remarks / Notes',
    applyToAll: 'Apply to all days of this stay',
  },
};

export type TranslationKey = keyof typeof translations.hi;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'hi',
  setLanguage: () => {},
  t: (key: TranslationKey) => translations.hi[key] || key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('hi');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pogh_language') as Language;
      if (saved === 'hi' || saved === 'en') {
        setLanguageState(saved);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pogh_language', lang);
    }
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.hi[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
