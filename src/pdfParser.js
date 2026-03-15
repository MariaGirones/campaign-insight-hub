/**
 * pdfParser.js
 * Extracts a text table from a PDF using PDF.js.
 *
 * Strategy (no numeric heuristics):
 *  1. Pull all text items from every page with their x/y positions.
 *  2. Group items sharing the same y-coordinate (± snap) into rows.
 *  3. Find the most common column count — that is the table width.
 *  4. Keep only rows that match that width (± 1 tolerance).
 *  5. First kept row = headers, the rest = data.
 */

const PDFJS_SRC    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const Y_SNAP   = 4;  // px: items within this vertical distance share a row
const MIN_COLS = 2;  // ignore rows with fewer cells than this

let _pdfjs = null;

async function getPDFJS() {
  if (_pdfjs) return _pdfjs;

  await new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${PDFJS_SRC}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src    = PDFJS_SRC;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load PDF.js. Check your internet connection.'));
    document.head.appendChild(s);
  });

  _pdfjs = window['pdfjs-dist/build/pdf'];
  _pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return _pdfjs;
}

/** Group raw text items into rows sorted top-to-bottom, left-to-right */
function extractRows(textItems) {
  const buckets = new Map();

  for (const item of textItems) {
    const text = item.str.trim();
    if (!text) continue;
    const x = item.transform[4];
    const y = Math.round(item.transform[5] / Y_SNAP) * Y_SNAP;
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push({ text, x });
  }

  return [...buckets.entries()]
    .sort(([ya], [yb]) => yb - ya)                        // top of page first
    .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map(c => c.text))
    .filter(row => row.length >= MIN_COLS);
}

/**
 * Parse a PDF File and return tabular data.
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: Object[], rawRows: string[][] }>}
 */
export async function parsePDF(file) {
  const lib = await getPDFJS();

  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;

  // Collect rows from every page
  let allRows = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    allRows = allRows.concat(extractRows(content.items));
  }

  if (!allRows.length) {
    throw new Error('No text found in this PDF. Make sure it is not a scanned image.');
  }

  // First row = headers (the user confirmed this is always the case).
  // Do NOT filter data rows by column count — in PDFs, empty cells are completely
  // absent as text items, so a row with one empty field will have fewer columns
  // than the header. The row builder handles missing values with ''.
  const headers = allRows[0];
  const rawRows = allRows.slice(1);

  console.log('[PDF] Total extracted rows (incl. header):', allRows.length);
  console.log('[PDF] Headers:', headers);
  console.log('[PDF] First 3 data rows (raw):', rawRows.slice(0, 3));

  if (!rawRows.length) {
    throw new Error('Could not find data rows in this PDF.');
  }

  const rows = rawRows.map(values => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });

  console.log('[PDF] First 3 row objects:', rows.slice(0, 3));
  return { headers, rows, rawRows };
}
