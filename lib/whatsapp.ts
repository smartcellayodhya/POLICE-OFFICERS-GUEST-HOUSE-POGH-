import { formatToHindiDate } from './dateUtils';
import { LetterDetails } from './types';

export function generateWhatsAppMessage(details: LetterDetails): string {
  const cin_h = formatToHindiDate(details.check_in_date);
  const cout_h = formatToHindiDate(details.check_out_date);
  const suitsList = details.suits.join(', ');
  const dispLine = details.dispatch_no ? `पत्रांक: पी.ओ.जी.एच. / 2026 / ${details.dispatch_no}\n` : '';
  const refLine = details.booking_ref_no ? `बुकिंग संदर्भ: ${details.booking_ref_no}\n` : '';

  const rentLine = details.total_amount && details.total_amount > 0
    ? `- प्रति रूम प्रति दिन किराया: ₹${details.total_amount}/-\n`
    : `- प्रति रूम प्रति दिन किराया: As Per Applicable\n`;

  return (
`सेवा में,
श्री ${details.guest_name || '___________'}
मो0नं0- ${details.mobile_number || '___________'}

${dispLine}${refLine}विषय: पुलिस ऑफिसर्स गेस्ट हाउस में सूट आरक्षित किये जाने की पुष्टि के संबंध में।

महोदय,
  अवगत कराना है कि पुलिस ऑफिसर्स गेस्ट हाउस में दिनांक ${cin_h} से ${cout_h} तक आपके प्रवास हेतु ${details.suits.length} रूम आरक्षित कर दिया गया है।

बुकिंग विवरण:
- गेस्ट का नाम: ${details.guest_name}
- कब से कब तक: दि० ${cin_h} से ${cout_h} तक
- रूम की संख्या: ${details.suits.length}
- सूट नम्बर: ${suitsList}
- कुल दिन: ${details.total_days} दिन
- भोजन व्यवस्था: ${details.meal_type_status}
${rentLine}
संपर्क सूत्र ऑफिसर्स गेस्ट हाउस- ${details.contact_person || 'उ0नि0 यदुनाथ मो0न0-8317041684'}

हम आपके स्वागत के लिए उत्सुक हैं और आशा करते हैं कि आपका प्रवास सुखद रहेगा।`
  );
}

export function getWhatsAppUrl(details: LetterDetails): string {
  let cleanMobile = (details.mobile_number || '').replace(/\D/g, '');
  if (cleanMobile.length === 10) {
    cleanMobile = '91' + cleanMobile;
  }
  const msg = generateWhatsAppMessage(details);
  return `https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`;
}
