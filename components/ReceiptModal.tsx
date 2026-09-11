'use client';

import React, { useRef, useState } from 'react';
import { Booking } from '@/lib/types';
import { formatToHindiDate, formatToDisplayDate } from '@/lib/dateUtils';
import { extractGroupIdFromNotes, extractDispatchNoFromNotes } from '@/lib/bookingUtils';
import { X, Printer, Download, Receipt, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  relatedBookings?: Booking[];
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  booking,
  relatedBookings = [],
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [paymentMode, setPaymentMode] = useState<string>('CASH'); // CASH | UPI | GOVT
  const [inchargeName, setInchargeName] = useState<string>('उ0नि0 यदुनाथ (प्रभारी POGH)');

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !booking) return null;

  // Determine full date range
  const allGuestBookings = relatedBookings.length > 0 ? relatedBookings : [booking];
  const sortedDates = allGuestBookings.map((b) => b.booking_date).sort();
  const checkInDate = sortedDates[0];
  const checkOutDate = sortedDates[sortedDates.length - 1];
  const totalDays = sortedDates.length;

  const bookingRef =
    booking.group_id ||
    extractGroupIdFromNotes(booking.notes) ||
    `POGH-2026-${String(booking.id).slice(0, 4).toUpperCase()}`;

  const dispatchNo =
    booking.dispatch_no ||
    extractDispatchNoFromNotes(booking.notes) ||
    bookingRef.replace('POGH-2026-', '') ||
    '001';

  const receiptNo = `RCP-2026-${dispatchNo}`;

  // Suits booked
  const suitNames: string[] = [];
  if (booking.suit_1 > 0) suitNames.push('Suit 1');
  if (booking.suit_2 > 0) suitNames.push('Suit 2');
  if (booking.suit_3 > 0) suitNames.push('Suit 3');
  if (booking.suit_4 > 0) suitNames.push('Suit 4');
  const suitsDisplay = suitNames.length > 0 ? suitNames.join(', ') : 'Suit 1';
  const numRooms = suitNames.length || 1;

  const dailyRent = Number(booking.total_amount) || 0;
  const totalRentAmount = dailyRent * totalDays;

  const todayHindi = formatToHindiDate(new Date());
  const cinHindi = formatToHindiDate(checkInDate);
  const coutHindi = formatToHindiDate(checkOutDate);

  const checkInTime = booking.check_in_time || '12:00 PM';
  const checkOutTime = booking.check_out_time || '12:00 PM';

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
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`POGH_Receipt_${receiptNo}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('रसीद डाउनलोड करने में त्रुटि उत्पन्न हुई।');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-1 sm:my-6 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        
        {/* Action Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-amber-500 no-print">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-400 text-slate-950">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">आधिकारिक किराया भुगतान रसीद</h3>
              <p className="text-xs text-slate-300">
                रसीद सं०: <span className="font-mono text-amber-400 font-bold">{receiptNo}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Mode Selector */}
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="bg-slate-800 text-amber-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 outline-none font-semibold"
              title="Payment Mode"
            >
              <option value="CASH">नकद (Cash)</option>
              <option value="UPI">ऑनलाइन (UPI/Netbanking)</option>
              <option value="GOVT">शासकीय कटौती (Govt Allotment)</option>
            </select>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-600 text-white transition shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'डाउनलोड हो रहा है...' : 'PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm"
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

        {/* Scrollable Receipt Area */}
        <div className="p-2 sm:p-6 md:p-8 overflow-y-auto bg-slate-100 flex justify-center">
          
          {/* Printable Receipt Card */}
          <div
            ref={printRef}
            className="w-full max-w-[210mm] bg-white p-4 sm:p-8 shadow-md border-2 border-slate-800 text-slate-900 font-hindi text-sm select-text"
            style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
          >
            {/* Header with Emblem */}
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
              <div className="w-14 h-14 mx-auto mb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/up_police_logo.png"
                  alt="UP Police Crest"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-blue-900">
                कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
              </h1>
              <h2 className="text-sm font-bold text-slate-800">
                पुलिस ऑफिसर्स गेस्ट हाउस (POGH) • किराया एवं शुल्क रसीद
              </h2>
              <p className="text-[11px] text-slate-600">
                OFFICIAL CASH / RENT PAYMENT RECEIPT
              </p>
            </div>

            {/* Receipt Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold pb-3 mb-3 border-b border-slate-200">
              <div>
                <p>रसीद संख्या: <span className="font-bold text-blue-900 font-mono">{receiptNo}</span></p>
                <p className="mt-0.5">बुकिंग संदर्भ: <span className="font-bold text-slate-900 font-mono">{bookingRef}</span></p>
              </div>
              <div className="text-right">
                <p>दिनांक: <span className="font-bold text-slate-900">{todayHindi}</span></p>
                <p className="mt-0.5">भुगतान माध्यम: <span className="font-bold text-emerald-800">{paymentMode === 'CASH' ? 'नकद (Cash)' : paymentMode === 'UPI' ? 'ऑनलाइन (UPI)' : 'शासकीय'}</span></p>
              </div>
            </div>

            {/* Guest Details */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 text-xs space-y-1.5">
              <div className="grid grid-cols-2">
                <p><span className="font-bold text-slate-700">अतिथि का नाम:</span> <span className="font-bold text-slate-900 text-sm">{booking.guest_name}</span></p>
                <p className="text-right"><span className="font-bold text-slate-700">मोबाइल नं०:</span> <span className="font-bold font-mono">{booking.mobile_number}</span></p>
              </div>
              <div className="grid grid-cols-2">
                <p><span className="font-bold text-slate-700">किसके संदर्भ से:</span> {booking.reference}</p>
                <p className="text-right"><span className="font-bold text-slate-700">आवंटित सूट:</span> <span className="font-bold text-blue-900">{suitsDisplay}</span></p>
              </div>
              <div className="grid grid-cols-2 pt-1 border-t border-slate-200">
                <p><span className="font-bold text-slate-700">प्रवास अवधि:</span> {cinHindi} ({checkInTime}) से {coutHindi} ({checkOutTime})</p>
                <p className="text-right"><span className="font-bold text-slate-700">कुल दिन:</span> <span className="font-bold">{totalDays} दिवस</span></p>
              </div>
            </div>

            {/* Charges Table with horizontal scroll safety on mobile */}
            <div className="overflow-x-auto w-full mb-4">
              <table className="w-full min-w-[450px] sm:min-w-0 text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold text-left">
                    <th className="p-2 border border-slate-300">क्र०</th>
                    <th className="p-2 border border-slate-300">मद / विवरण</th>
                    <th className="p-2 border border-slate-300 text-center">दिन</th>
                    <th className="p-2 border border-slate-300 text-right">दर (प्रति दिन)</th>
                    <th className="p-2 border border-slate-300 text-right">कुल धनराशि (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-300 text-center font-bold">1</td>
                    <td className="p-2 border border-slate-300">
                      कमरा किराया: {suitsDisplay} ({numRooms} रूम)
                    </td>
                    <td className="p-2 border border-slate-300 text-center">{totalDays}</td>
                    <td className="p-2 border border-slate-300 text-right font-mono">
                      {dailyRent > 0 ? `₹${dailyRent}` : 'लागू अनुसार'}
                    </td>
                    <td className="p-2 border border-slate-300 text-right font-bold font-mono">
                      {dailyRent > 0 ? `₹${totalRentAmount}` : 'लागू अनुसार'}
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 border border-slate-300 text-center font-bold">2</td>
                    <td className="p-2 border border-slate-300">
                      भोजन व्यवस्था शुल्क
                    </td>
                    <td className="p-2 border border-slate-300 text-center">-</td>
                    <td className="p-2 border border-slate-300 text-right">{booking.meal_type_status}</td>
                    <td className="p-2 border border-slate-300 text-right font-bold">
                      {booking.meal_type_status === 'FREE' ? 'निःशुल्क' : 'सशुल्क'}
                    </td>
                  </tr>
                  <tr className="bg-amber-50/80 font-bold text-sm">
                    <td colSpan={4} className="p-2.5 border border-slate-300 text-right text-slate-900">
                      कुल प्राप्त धनराशि (Total Amount):
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-mono text-base font-bold text-blue-900">
                      {totalRentAmount > 0 ? `₹${totalRentAmount.toLocaleString('en-IN')}/-` : 'As Applicable'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Signature Blocks */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-b border-slate-400 w-40 mx-auto mb-1" />
                <p className="font-bold text-slate-800">हस्ताक्षर अतिथि / अधिकारी</p>
                <p className="text-[11px] text-slate-500">(Guest / Officer Signature)</p>
              </div>

              <div>
                <div className="border-b border-slate-400 w-40 mx-auto mb-1" />
                <p className="font-bold text-blue-950">{inchargeName}</p>
                <p className="text-[11px] text-slate-500">कार्यालय वरिष्ठ पुलिस अधीक्षक, अयोध्या</p>
              </div>
            </div>

            {/* Bottom note */}
            <div className="mt-6 pt-2 border-t border-slate-300 text-[10px] text-slate-500 text-center">
              यह रसीद पुलिस ऑफिसर्स गेस्ट हाउस, जनपद अयोध्या द्वारा कंप्यूटर से स्वतः उत्पन्न है।
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
