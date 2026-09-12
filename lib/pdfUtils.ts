import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExportPDFOptions {
  element: HTMLElement;
  filename: string;
}

/**
 * Downloads a DOM element as a high-quality, full-page A4 PDF.
 * Specifically engineered to prevent mobile viewport clipping,
 * mobile scroll cutoffs, and multi-page overflow.
 */
export async function downloadElementAsPDF({ element, filename }: ExportPDFOptions): Promise<void> {
  // Standard A4 width at 96 DPI is 794px
  const standardA4WidthPx = 794;

  // 1. Create a detached off-screen container with fixed desktop A4 dimensions.
  // This guarantees that regardless of mobile screen width (e.g. 360px),
  // the letter/receipt is rendered at full desktop A4 proportions without squishing or line wrapping.
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = `${standardA4WidthPx}px`;
  container.style.minWidth = `${standardA4WidthPx}px`;
  container.style.maxWidth = `${standardA4WidthPx}px`;
  container.style.background = '#FFFFFF';
  container.style.zIndex = '-99999';
  container.style.overflow = 'visible';
  container.style.boxSizing = 'border-box';
  container.style.pointerEvents = 'none';

  // 2. Clone the element
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${standardA4WidthPx}px`;
  clone.style.minWidth = `${standardA4WidthPx}px`;
  clone.style.maxWidth = `${standardA4WidthPx}px`;
  clone.style.padding = '28px 36px';
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.background = '#FFFFFF';
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    // Allow paint cycle for fonts and layout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Strip any borders or filters from images inside clone before capturing
    clone.querySelectorAll('img').forEach((img) => {
      img.style.border = 'none';
      img.style.outline = 'none';
      img.style.boxShadow = 'none';
      img.style.filter = 'none';
    });

    // Wait for any embedded images (e.g. emblem/crest) inside the clone to finish loading
    const images = Array.from(clone.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // 3. Render full canvas starting from (0,0) with no scroll offset
    const canvas = await html2canvas(clone, {
      scale: 2, // 2x Retina scale for crystal clear Hindi typography
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      width: standardA4WidthPx,
      height: clone.scrollHeight,
      windowWidth: 1200,
      windowHeight: 1600,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    // 4. Fit cleanly onto a single A4 page
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfPageWidth = 210;
    const pdfPageHeight = 297;
    const margin = 6; // 6mm margin around document
    const maxUsableWidth = pdfPageWidth - margin * 2; // 198mm
    const maxUsableHeight = pdfPageHeight - margin * 2; // 285mm

    const imgAspect = canvas.width / canvas.height;
    let renderWidth = maxUsableWidth;
    let renderHeight = renderWidth / imgAspect;

    // Proportionally scale to fit on single page if height exceeds printable height
    if (renderHeight > maxUsableHeight) {
      renderHeight = maxUsableHeight;
      renderWidth = renderHeight * imgAspect;
    }

    const xOffset = margin + (maxUsableWidth - renderWidth) / 2;
    const yOffset = margin;

    pdf.addImage(imgData, 'PNG', xOffset, yOffset, renderWidth, renderHeight, undefined, 'FAST');
    pdf.save(filename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Prints a document element directly via an isolated iframe.
 * Prevents the main application DOM (RoomMatrix, BookingsTable)
 * from inflating the document height and creating repeated duplicate pages.
 */
export function printDocumentDirectly(
  element: HTMLElement,
  title = 'POGH Document',
  isMultiPage = false
): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // Extract all existing styles to preserve fonts, Tailwind utilities, and colors
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
  let stylesHtml = '';
  styles.forEach((style) => {
    stylesHtml += style.outerHTML;
  });

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="hi">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap" rel="stylesheet">
        ${stylesHtml}
        <style>
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            font-family: 'Noto Sans Devanagari', 'Inter', sans-serif !important;
            height: auto !important;
            overflow: visible !important;
            color: #0f172a !important;
          }
          #print-root {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            ${
              isMultiPage
                ? ''
                : 'page-break-after: avoid !important; page-break-inside: avoid !important; break-after: avoid !important; break-inside: avoid !important;'
            }
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div id="print-root">
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Iframe print failed, falling back to window.print()', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2500);
    }
  }, 350);
}
