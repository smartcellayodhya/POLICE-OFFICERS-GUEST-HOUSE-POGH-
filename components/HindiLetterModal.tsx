'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Booking } from '@/lib/types';
import { formatToHindiDate, formatToDisplayDate, formatToISODate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import {
  extractGroupIdFromNotes,
  extractDispatchNoFromNotes,
  extractCheckInDateFromNotes,
  extractCheckOutDateFromNotes,
  extractRatePerRoomFromNotes,
} from '@/lib/bookingUtils';
import { X, Printer, Download, Share2 } from 'lucide-react';
import { downloadElementAsPDF, printDocumentDirectly } from '@/lib/pdfUtils';

interface HindiLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  relatedBookings?: Booking[];
}

export const HindiLetterModal: React.FC<HindiLetterModalProps> = ({
  isOpen,
  onClose,
  booking,
  relatedBookings = [],
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  // Dynamic In-Charge / Contact Person (Editable and persists in localStorage)
  const [contactPerson, setContactPerson] = useState<string>('उ0नि0 यदुनाथ मो0न0-8317041684');
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [checkInTime, setCheckInTime] = useState('12:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('12:00 PM');

  useEffect(() => {
    if (booking) {
      setCheckInTime(booking.check_in_time || '12:00 PM');
      setCheckOutTime(booking.check_out_time || '12:00 PM');
    }
  }, [booking]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pogh_contact_person');
      if (saved) setContactPerson(saved);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !booking) return null;

  // Determine full date range and stay duration
  const allGuestBookings = relatedBookings.length > 0 ? relatedBookings : [booking];
  const sortedDates = allGuestBookings.map((b) => b.booking_date).sort();

  const notesCin = extractCheckInDateFromNotes(booking.notes);
  const notesCout = extractCheckOutDateFromNotes(booking.notes);

  const checkInDate = notesCin || sortedDates[0];
  let checkOutDate = notesCout || sortedDates[sortedDates.length - 1];

  // If there's only 1 booking record and no notesCout, default next-day checkout for overnight stays
  if (!notesCout && sortedDates.length === 1) {
    const nextDay = new Date(checkInDate + 'T00:00:00');
    nextDay.setDate(nextDay.getDate() + 1);
    checkOutDate = formatToISODate(nextDay);
  }

  // Calculate actual nights / days (e.g. 12th to 13th = 1 day!)
  const dCin = new Date(checkInDate + 'T00:00:00');
  const dCout = new Date(checkOutDate + 'T00:00:00');
  const diffDays = Math.round((dCout.getTime() - dCin.getTime()) / 86400000);
  const totalDays = diffDays > 0 ? diffDays : 1;

  // Reference and dispatch number
  const bookingRef =
    booking.group_id ||
    extractGroupIdFromNotes(booking.notes) ||
    `POGH-2026-${String(booking.id).slice(0, 4).toUpperCase()}`;

  const dispatchNo =
    booking.dispatch_no ||
    extractDispatchNoFromNotes(booking.notes) ||
    bookingRef.replace('POGH-2026-', '') ||
    '001';

  // Identify suits booked
  const suitNames: string[] = [];
  let dailyRate = 0;
  if (booking.suit_1 > 0) {
    suitNames.push('Suit 1');
    dailyRate += Number(booking.suit_1);
  }
  if (booking.suit_2 > 0) {
    suitNames.push('Suit 2');
    dailyRate += Number(booking.suit_2);
  }
  if (booking.suit_3 > 0) {
    suitNames.push('Suit 3');
    dailyRate += Number(booking.suit_3);
  }
  if (booking.suit_4 > 0) {
    suitNames.push('Suit 4');
    dailyRate += Number(booking.suit_4);
  }

  const suitsDisplay = suitNames.length > 0 ? suitNames.join(', ') : 'Suit 1';
  const numRooms = suitNames.length || 1;
  
  // Single room rent per day
  const metaRoomRate = extractRatePerRoomFromNotes(booking.notes);
  const suitRateFound = Math.max(Number(booking.suit_1) || 0, Number(booking.suit_2) || 0, Number(booking.suit_3) || 0, Number(booking.suit_4) || 0);
  const bookingRent = metaRoomRate > 0
    ? metaRoomRate
    : (suitRateFound > 1
      ? suitRateFound
      : (numRooms > 1 && Number(booking.total_amount) > 1500
        ? Math.round(Number(booking.total_amount) / numRooms)
        : Number(booking.total_amount)));

  const hasRentAmount = !isNaN(bookingRent) && bookingRent > 0;
  const rentDisplay = hasRentAmount ? `₹${bookingRent.toLocaleString('en-IN')}/-` : 'लागू नियमानुसार';

  const getMealLabel = (st?: string) => {
    if (st === 'PAID') return 'सशुल्क';
    if (st === 'COMPLIMENTARY') return 'शासकीय / वीआईपी';
    if (st === 'NOT REQUIRED') return 'लागू नहीं';
    if (st === 'FREE') return 'निःशुल्क';
    if (st === 'PENDING') return 'लंबित';
    return st || 'सशुल्क';
  };

  const todayHindi = formatToHindiDate(new Date());
  const cinHindi = formatToHindiDate(checkInDate);
  const coutHindi = formatToHindiDate(checkOutDate);

  const isSingleDay = checkInDate === checkOutDate;

  const letterDetails = {
    guest_name: booking.guest_name,
    mobile_number: booking.mobile_number,
    reference: booking.reference,
    booking_ref_no: bookingRef,
    dispatch_no: dispatchNo,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
    suits: suitNames,
    total_days: totalDays,
    total_amount: hasRentAmount ? bookingRent : 0,
    meal_type_status: booking.meal_type_status || 'PAID',
    contact_person: contactPerson,
    dates: sortedDates,
  };

  const handlePrint = () => {
    if (printRef.current) {
      printDocumentDirectly(printRef.current, `POGH_Letter_${bookingRef}`);
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPDF({
        element: printRef.current,
        filename: `POGH_Letter_${bookingRef}_${booking.guest_name.replace(/\s+/g, '_')}.pdf`,
      });
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('पीडीएफ तैयार करने में समस्या आई। आप प्रिंट (Print) बटन से भी पीडीएफ सुरक्षित कर सकते हैं।');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsApp = () => {
    const url = getWhatsAppUrl(letterDetails);
    window.open(url, '_blank');
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-1 sm:my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Modal Action Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-amber-500 no-print">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">आधिकारिक कक्ष आवंटन पत्र</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono">
                {bookingRef}
              </span>
            </div>
            <p className="text-xs text-slate-300 font-hindi">
              वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या - आधिकारिक आवंटन पत्र (पत्रांक: {dispatchNo})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* In-Charge / Contact Person Editor (No-Print) */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
              <span className="text-[11px] text-amber-400 font-bold whitespace-nowrap">प्रभारी:</span>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => {
                  setContactPerson(e.target.value);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('pogh_contact_person', e.target.value);
                  }
                }}
                placeholder="प्रभारी का नाम व संपर्क"
                className="bg-slate-950 text-amber-300 text-xs px-2.5 py-1 rounded border border-slate-700 focus:border-amber-400 outline-none w-48 sm:w-56 font-sans font-semibold"
                title="प्रभारी का नाम व मोबाइल नंबर"
              />
            </div>


            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              title="व्हाट्सएप पर शेयर करें"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition shadow-sm disabled:opacity-50"
              title="पीडीएफ डाउनलोड करें"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'डाउनलोड हो रहा है...' : 'PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm"
              title="दस्तावेज़ प्रिंट करें"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="बंद करें"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Letter Preview Area */}
        <div className="p-2 sm:p-6 md:p-8 overflow-y-auto bg-slate-100 flex justify-center">
          
          {/* A4 Printable Document Paper */}
          <div
            id="printable-letter"
            ref={printRef}
            className="w-full max-w-[210mm] bg-white p-4 sm:p-8 shadow-lg border border-slate-200 text-slate-900 font-hindi leading-relaxed text-sm select-text"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            {/* Top Police Decorative Double Border */}
            <div
              className="border-t-2 border-b border-blue-900 pb-0.5 mb-5"
              style={{ borderColor: '#1e3a8a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            />

            {/* Emblem and Official Header */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-1.5 flex items-center justify-center border-0 border-none outline-none shadow-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/up_police_logo.png"
                  alt="UP Police Emblem"
                  className="w-full h-full object-contain border-0 border-none outline-none shadow-none"
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', filter: 'none' }}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-blue-900 tracking-wide">
                कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
              </h1>
              <h2 className="text-sm font-semibold text-slate-700 mt-0.5">
                पुलिस ऑफिसर्स गेस्ट हाउस, जनपद अयोध्या (उ0प्र0)
              </h2>
            </div>

            <div className="border-b border-slate-300 mb-4" />

            {/* Auto Dispatch Number & Hindi Date */}
            <div className="flex justify-between items-center text-xs font-semibold text-slate-800 mb-4">
              <div>
                पत्रांक: <span className="font-bold text-blue-900">पी.ओ.जी.एच. / 2026 / {dispatchNo}</span>
              </div>
              <div>दिनांक: {todayHindi}</div>
            </div>

            {/* Recipient */}
            <div className="mb-4 space-y-0.5">
              <div className="font-bold text-slate-900">सेवा में,</div>
              <div className="pl-6 font-semibold text-slate-800 text-base">
                {booking.guest_name.startsWith('श्री') ? booking.guest_name : `श्री ${booking.guest_name}`}
              </div>
              <div className="pl-6 text-sm text-slate-950 font-black font-mono">
                मो०नं०- {booking.mobile_number}
              </div>
            </div>

            {/* Subject */}
            <div
              className="mb-4 p-2 bg-slate-50 border-l-4 border-blue-900 text-slate-900 font-bold text-xs sm:text-sm"
              style={{ borderLeftColor: '#1e3a8a', backgroundColor: '#f8fafc', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              विषय: पुलिस ऑफिसर्स गेस्ट हाउस में सूट आरक्षित किये जाने की पुष्टि के संबंध में।
            </div>

            {/* Salutation and Body */}
            <div className="mb-4 space-y-2 text-slate-800">
              <p className="font-semibold">महोदय,</p>
              <p className="indent-8 text-justify leading-relaxed">
                {isSingleDay ? (
                  <>
                    अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक <strong>{cinHindi} को (01 दिवस हेतु)</strong> आपके प्रवास हेतु <strong>{numRooms}</strong> रूम आरक्षित कर दिया गया है, जिसका विवरण निम्नवत है:-
                  </>
                ) : (
                  <>
                    अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक <strong>{cinHindi}</strong> से{' '}
                    <strong>{coutHindi}</strong> तक (कुल <strong>{totalDays > 9 ? totalDays : `0${totalDays}`} दिवस हेतु</strong>) आपके प्रवास हेतु <strong>{numRooms}</strong> रूम आरक्षित कर दिया गया है, जिसका विवरण निम्नवत है:-
                  </>
                )}
              </p>
            </div>

            {/* Structured Booking Details Table */}
            <div className="mb-4 overflow-hidden rounded-lg border border-slate-300 shadow-xs">
              <div
                className="bg-blue-900 text-white font-bold text-xs grid grid-cols-3 p-2.5"
                style={{ backgroundColor: '#1e3a8a', color: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
              >
                <span className="col-span-1 text-white">विवरण</span>
                <span className="col-span-2 text-white">सूचना</span>
              </div>
              <div className="divide-y divide-slate-200 text-xs text-slate-800 bg-white">
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">गेस्ट का नाम</span>
                  <span className="col-span-2 font-bold text-slate-900">
                    {booking.guest_name.startsWith('श्री') ? booking.guest_name : `श्री ${booking.guest_name}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">कब से कब तक</span>
                  <span className="col-span-2">
                    {isSingleDay ? `दि० ${cinHindi} (01 दिवस)` : `दि० ${cinHindi} से ${coutHindi} तक (${totalDays > 9 ? totalDays : `0${totalDays}`} दिवस)`}
                  </span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">रूम की संख्या</span>
                  <span className="col-span-2">{numRooms} रूम</span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">सूट नम्बर</span>
                  <span className="col-span-2 font-bold text-blue-900">{suitsDisplay}</span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">चेक-इन / चेक-आउट</span>
                  <span className="col-span-2">{cinHindi} ({checkInTime}) / {coutHindi} ({checkOutTime})</span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">कुल दिन</span>
                  <span className="col-span-2">{totalDays} दिन ({totalDays} रात्रि)</span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">भोजन व्यवस्था स्थिति</span>
                  <span className="col-span-2 font-semibold text-emerald-700">{getMealLabel(booking.meal_type_status)}</span>
                </div>
                <div
                  className="grid grid-cols-3 p-2 bg-amber-50/60 font-bold text-slate-900"
                  style={{ backgroundColor: '#fef3c7', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
                >
                  <span className="font-semibold text-amber-900">प्रति रूम प्रति दिन किराया</span>
                  <span className="col-span-2 text-amber-950 font-sans text-sm font-bold">
                    {rentDisplay}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Person (Clean text without any buttons inside letter) */}
            <div className="mb-3.5 p-2 bg-slate-50 rounded border border-slate-200 text-xs font-bold text-slate-900 leading-normal">
              संपर्क सूत्र ऑफिसर्स गेस्ट हाउस- {contactPerson}
            </div>

            {/* Closing Salutation */}
            <p className="mb-3.5 text-xs text-slate-700 italic">
              हम आपके स्वागत के लिए उत्सुक हैं और आशा करते हैं कि आपका प्रवास सुखद रहेगा।
            </p>

            {/* Bottom Row: Left has प्रतिलिपि, Right has आज्ञा से / वरिष्ठ पुलिस अधीक्षक */}
            <div className="flex items-start justify-between gap-6 pt-1">
              {/* Left Side: प्रतिलिपि */}
              <div className="flex-1 text-xs text-slate-800 space-y-1">
                <div className="font-bold text-slate-900">प्रतिलिपि:</div>
                <p className="pl-3 leading-relaxed text-[11px] text-slate-700">
                  प्रभारी पुलिस ऑफिसर्स गेस्ट हाउस, पुलिस लाइन, अयोध्या को संबंधित से समन्वय स्थापित करते हुए आवश्यक कार्यवाही हेतु प्रेषित।
                </p>
              </div>

              {/* Right Side: आज्ञा से / वरिष्ठ पुलिस अधीक्षक */}
              <div className="text-center text-xs font-bold text-slate-900 flex-shrink-0 min-w-[140px]">
                <div className="space-y-0.5">
                  <div>आज्ञा से</div>
                  <div className="h-6" />
                  <div>वरिष्ठ पुलिस अधीक्षक</div>
                  <div>जनपद अयोध्या</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-end text-xs text-slate-500 no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs"
          >
            बंद करें (Close)
          </button>
        </div>

      </div>
    </div>
  );
};
