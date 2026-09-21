interface ExportPDFOptions {
  element: HTMLElement;
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Downloads a DOM element as a high-quality, full-page A4 PDF.
 * Specifically engineered to prevent mobile viewport clipping,
 * mobile scroll cutoffs, and multi-page overflow.
 * Libraries (jsPDF, html2canvas) are dynamically loaded on-demand
 * to keep the initial page bundle lightweight and fast.
 */
export async function downloadElementAsPDF({
  element,
  filename,
  orientation = 'portrait',
}: ExportPDFOptions): Promise<void> {
  // Dynamically load heavy libraries only when export is requested
  const [html2canvasModule, jsPDFModule] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const html2canvas = html2canvasModule.default;
  const jsPDF = jsPDFModule.default;

  const isLandscape = orientation === 'landscape';
  // Standard A4 width at 96 DPI: 794px portrait, 1123px landscape
  const standardA4WidthPx = isLandscape ? 1123 : 794;

  // 1. Create a detached off-screen container with fixed desktop A4 dimensions.
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

  // 2. Clone the element and guarantee it is 100% visible and measurable
  const clone = element.cloneNode(true) as HTMLElement;
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.opacity = '1';
  clone.style.boxSizing = 'border-box';
  clone.style.width = `${standardA4WidthPx}px`;
  clone.style.minWidth = `${standardA4WidthPx}px`;
  clone.style.maxWidth = `${standardA4WidthPx}px`;
  clone.style.margin = '0';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.background = '#FFFFFF';
  clone.style.height = 'auto';
  clone.style.overflow = 'visible';
  clone.style.transform = 'none';

  // Ensure box-sizing border-box across all descendants
  clone.querySelectorAll('*').forEach((el) => {
    (el as HTMLElement).style.boxSizing = 'border-box';
  });

  // Also unhide any nested children having 'hidden' class
  clone.querySelectorAll('.hidden').forEach((el) => {
    el.classList.remove('hidden');
    (el as HTMLElement).style.display = 'block';
    (el as HTMLElement).style.visibility = 'visible';
  });

  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    // Wait for fonts to be ready
    if (typeof document !== 'undefined' && (document as any).fonts && (document as any).fonts.ready) {
      try {
        await (document as any).fonts.ready;
      } catch (e) {
        // Fallback
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Strip borders or filters from images
    clone.querySelectorAll('img').forEach((img) => {
      img.style.border = 'none';
      img.style.outline = 'none';
      img.style.boxShadow = 'none';
      img.style.filter = 'none';
    });

    // Wait for embedded images to finish loading
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

    const renderHeight = Math.max(clone.scrollHeight, clone.offsetHeight, 600);
    // 3. Render full canvas at 2x Retina resolution
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      width: standardA4WidthPx,
      height: renderHeight,
      windowWidth: standardA4WidthPx + 100,
      windowHeight: Math.max(1200, renderHeight + 100),
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    });

    // 4. Multi-page capable A4 PDF generation with smart row-safe page breaking
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfPageWidth = isLandscape ? 297 : 210;
    const pdfPageHeight = isLandscape ? 210 : 297;
    const margin = 8; // 8mm margin
    const maxUsableWidth = pdfPageWidth - margin * 2;
    const maxUsableHeight = pdfPageHeight - margin * 2;

    const pageRatio = maxUsableHeight / maxUsableWidth;
    const nominalPageHeightPx = standardA4WidthPx * pageRatio;
    const scale = canvas.width / standardA4WidthPx;

    // Collect safe DOM split points (e.g. table rows or blocks) relative to clone
    const cloneRect = clone.getBoundingClientRect();
    const candidateElements = Array.from(
      clone.querySelectorAll('tr, .page-break, [data-pdf-block]')
    );
    const safeDomBreakPoints: number[] = [];
    candidateElements.forEach((el) => {
      const r = el.getBoundingClientRect();
      const relTop = r.top - cloneRect.top;
      if (relTop > 20) {
        safeDomBreakPoints.push(Math.round(relTop));
      }
    });
    safeDomBreakPoints.sort((a, b) => a - b);

    const totalDomHeight = Math.max(clone.scrollHeight, clone.offsetHeight);

    // If total content fits on a single page, render directly
    if (totalDomHeight <= nominalPageHeightPx + 40) {
      const imgWidth = maxUsableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      // Multi-page document: slice page-by-page at safe row boundaries (never cut through a row)
      let currentDomY = 0;
      let pageIndex = 0;

      while (currentDomY < totalDomHeight) {
        const targetDomY = currentDomY + nominalPageHeightPx;
        let breakDomY = totalDomHeight;

        if (targetDomY < totalDomHeight) {
          // Look for the largest safe break point before targetDomY
          let chosenBreak = -1;
          for (let i = safeDomBreakPoints.length - 1; i >= 0; i--) {
            const pt = safeDomBreakPoints[i];
            if (pt <= targetDomY && pt > currentDomY + nominalPageHeightPx * 0.55) {
              chosenBreak = pt;
              break;
            }
          }
          breakDomY = chosenBreak !== -1 ? chosenBreak : targetDomY;
        }

        const sliceStartCanvasY = Math.round(currentDomY * scale);
        const sliceEndCanvasY = Math.min(canvas.height, Math.round(breakDomY * scale));
        const sliceHeightCanvas = Math.max(1, sliceEndCanvasY - sliceStartCanvasY);

        // Render this slice onto an isolated page canvas
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightCanvas;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            sliceStartCanvasY,
            canvas.width,
            sliceHeightCanvas,
            0,
            0,
            canvas.width,
            sliceHeightCanvas
          );
        }

        const sliceHeightMm = (sliceHeightCanvas / canvas.width) * maxUsableWidth;
        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);

        if (pageIndex > 0) {
          pdf.addPage();
        }
        pdf.addImage(pageImgData, 'JPEG', margin, margin, maxUsableWidth, sliceHeightMm, undefined, 'FAST');

        pageIndex++;
        currentDomY = breakDomY;
      }
    }

    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(safeFilename);
  } finally {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }
}

/**
 * Sanitizes an HTML element for print rendering by stripping
 * script tags, iframes, and inline event handlers to prevent XSS.
 */
function sanitizeHtmlForPrint(source: HTMLElement): string {
  const clone = source.cloneNode(true) as HTMLElement;

  // 1. Remove dangerous executable tags
  const dangerousTags = clone.querySelectorAll('script, iframe, object, embed');
  dangerousTags.forEach((el) => el.remove());

  // 2. Strip all inline event handlers (e.g. onclick, onload, onerror)
  const allElements = clone.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrNames = el.getAttributeNames();
    for (const attr of attrNames) {
      const lower = attr.toLowerCase();
      const val = el.getAttribute(attr)?.trim().toLowerCase() || '';
      if (lower.startsWith('on') || val.startsWith('javascript:')) {
        el.removeAttribute(attr);
      }
    }
  });

  return clone.innerHTML;
}

/**
 * Prints a document element directly via an isolated iframe.
 * Prevents the main application DOM (RoomMatrix, BookingsTable)
 * from inflating the document height and creating repeated duplicate pages.
 */
export function printDocumentDirectly(
  element: HTMLElement,
  title = 'POGH Document',
  isMultiPage = false,
  orientation: 'portrait' | 'landscape' = 'portrait'
): void {
  // Mobile browsers block hidden iframe print. Automatically download high-quality PDF on mobile.
  const isMobile =
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768);

  if (isMobile) {
    const safeTitle = title.replace(/[^a-zA-Z0-9_\u0900-\u097F]/g, '_');
    downloadElementAsPDF({
      element,
      filename: `${safeTitle}.pdf`,
      orientation,
    }).catch((err) => {
      console.warn('Mobile direct PDF download failed, falling back to window.print', err);
      window.print();
    });
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = orientation === 'landscape' ? '1400px' : '1024px';
  iframe.style.height = orientation === 'landscape' ? '900px' : '1024px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
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

  const cleanElement = element.cloneNode(true) as HTMLElement;
  cleanElement.classList.remove('hidden');
  cleanElement.style.display = 'block';
  cleanElement.style.visibility = 'visible';
  cleanElement.querySelectorAll('.hidden').forEach((el) => {
    el.classList.remove('hidden');
    (el as HTMLElement).style.display = 'block';
  });

  const sanitizedContent = sanitizeHtmlForPrint(cleanElement);

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
            size: A4 ${orientation};
            margin: ${orientation === 'landscape' ? '6mm 8mm 6mm 8mm' : '8mm 10mm 8mm 10mm'};
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
          ${sanitizedContent}
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
