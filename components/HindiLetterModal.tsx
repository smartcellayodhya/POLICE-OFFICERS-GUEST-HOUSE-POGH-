'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Booking } from '@/lib/types';
import { formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import { getWhatsAppUrl } from '@/lib/whatsapp';
import { extractGroupIdFromNotes, extractDispatchNoFromNotes } from '@/lib/bookingUtils';
import { X, Printer, Download, Share2, Copy, Check } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  const [copied, setCopied] = useState(false);

  // Dynamic In-Charge / Contact Person (Editable and persists in localStorage)
  const [contactPerson, setContactPerson] = useState<string>('उ0नि0 यदुनाथ मो0न0-8317041684');
  const [isEditingContact, setIsEditingContact] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pogh_contact_person');
      if (saved) setContactPerson(saved);
    }
  }, []);

  if (!isOpen || !booking) return null;

  // Determine full date range
  const allGuestBookings = relatedBookings.length > 0 ? relatedBookings : [booking];
  const sortedDates = allGuestBookings.map((b) => b.booking_date).sort();
  const checkInDate = sortedDates[0];
  const checkOutDate = sortedDates[sortedDates.length - 1];
  const totalDays = sortedDates.length;

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
  
  // Single room rent per day directly from booking data (entered in New Booking modal)
  const bookingRent = Number(booking.total_amount);
  const hasRentAmount = !isNaN(bookingRent) && bookingRent > 0;
  const rentDisplay = hasRentAmount ? `₹${bookingRent.toLocaleString('en-IN')}/-` : 'As Per Applicable';

  const todayHindi = formatToHindiDate(new Date());
  const cinHindi = formatToHindiDate(checkInDate);
  const coutHindi = formatToHindiDate(checkOutDate);

  const letterDetails = {
    guest_name: booking.guest_name,
    mobile_number: booking.mobile_number,
    reference: booking.reference,
    booking_ref_no: bookingRef,
    dispatch_no: dispatchNo,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    check_in_time: '12:00 PM',
    check_out_time: '12:00 PM',
    suits: suitNames,
    total_days: totalDays,
    total_amount: hasRentAmount ? bookingRent : 0,
    meal_type_status: booking.meal_type_status || 'PAID',
    contact_person: contactPerson,
    dates: sortedDates,
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
      pdf.save(`POGH_Letter_${bookingRef}_${booking.guest_name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('Error downloading PDF. You can also use the Print button to Save as PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleWhatsApp = () => {
    const url = getWhatsAppUrl(letterDetails);
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    const text = `सेवा में, श्री ${booking.guest_name} (मो०नं०- ${booking.mobile_number})\nपत्रांक: पी.ओ.जी.एच. / 2026 / ${dispatchNo}\nबुकिंग संदर्भ: ${bookingRef}\nपुलिस ऑफिसर्स गेस्ट हाउस, अयोध्या में आपका सूट आरक्षित कर दिया गया है।\nदिनांक: ${cinHindi} से ${coutHindi} तक (${suitsDisplay}).\nसंपर्क: ${contactPerson}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        
        {/* Modal Action Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-amber-500 no-print">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">Official Hindi Booking Letter</h3>
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
                placeholder="उदा. उ0नि0 यदुनाथ मो0न0-8317041684"
                className="bg-slate-950 text-amber-300 text-xs px-2 py-0.5 rounded border border-slate-700 focus:border-amber-400 outline-none w-48 sm:w-56 font-sans font-semibold"
                title="आवंटन पत्र पर छपने वाले प्रभारी का नाम व नंबर यहाँ बदलें"
              />
            </div>


            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              title="Share confirmation on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition shadow-sm disabled:opacity-50"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Exporting...' : 'PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm"
              title="Print Document"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Letter Preview Area */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex justify-center">
          
          {/* A4 Printable Document Paper */}
          <div
            id="printable-letter"
            ref={printRef}
            className="w-full max-w-[210mm] bg-white p-6 sm:p-10 shadow-lg border border-slate-200 text-slate-900 font-hindi leading-relaxed text-sm select-text"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            {/* Top Police Decorative Double Border */}
            <div
              className="border-t-2 border-b border-blue-900 pb-0.5 mb-5"
              style={{ borderColor: '#1e3a8a', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            />

            {/* Emblem and Official Header */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/up_police_logo.png"
                  alt="UP Police Emblem"
                  className="w-full h-full object-contain drop-shadow-sm"
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
                अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक <strong>{cinHindi}</strong> से{' '}
                <strong>{coutHindi}</strong> तक आपके प्रवास हेतु <strong>{numRooms}</strong> रूम आरक्षित कर दिया गया है, जिसका विवरण निम्नवत है:-
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
                  <span className="col-span-2">दि० {cinHindi} से {coutHindi} तक</span>
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
                  <span className="col-span-2">{cinHindi} (12:00 PM) / {coutHindi} (12:00 PM)</span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">कुल दिन</span>
                  <span className="col-span-2">{totalDays} दिन</span>
                </div>
                <div className="grid grid-cols-3 p-2 hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">भोजन व्यवस्था स्थिति</span>
                  <span className="col-span-2 font-semibold text-emerald-700">{booking.meal_type_status || 'PAID'}</span>
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
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 no-print">
          <button
            onClick={handleCopyText}
            className="flex items-center gap-1 text-slate-600 hover:text-slate-900 underline transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
