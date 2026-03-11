/**
 * pdfParser.js
 * Extracts tabular data from a PDF file using PDF.js (loaded via CDN).
 *
 * Strategy:
 *  1. Load all text items from every page with their x,y positions.
 *  2. Group items that share the same y-coordinate (± threshold) into rows.
 *  3. Within each row, sort items left-to-right by x position.
 *  4. Find the section of rows that looks most like a table
 *     (consistent column count, contains numbers).
 *  5. Treat the first row of that section as headers.
 *  6. Return { headers, rows } — same shape as csvParser.
 *
 * Works best with text-based PDFs (not scanned images / photos).
 */

const PDFJS_SRC    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const Y_SNAP      = 4;   // px tolerance — items within this dy = same row
const MIN_COLS    = 2;   // minimum cells to count a line as a table row
const NUM_THRESH  = 0.4; // fraction of cells that must be numeric to keep a row

let _pdfjs = null;

// ── Load PDF.js from CDN once ──────────────────────────────────

async function getPDFJS() {
  if (_pdfjs) return _pdfjs;

  await new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${PDFJS_SRC}"]`)) {
      resolve(); return;
    }
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load PDF.js library. Check your internet connection.'));
    document.head.appendChild(s);
  });

  _pdfjs = window['pdfjs-dist/build/pdf'];
  _pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return _pdfjs;
}

// ── Text extraction helpers ────────────────────────────────────

function snapY(y) {
  return Math.round(y / Y_SNAP) * Y_SNAP;
}

function extractRows(textItems) {
  const buckets = new Map();

  for (const item of textItems) {
    const text = item.str.trim();
    if (!text) continue;
    const x = item.transform[4];
    const y = snapY(item.transform[5]);
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y).push({ text, x });
  }

  // Sort top-to-bottom (PDF y-axis: larger y = higher on page)
  return [...buckets.entries()]
    .sort(([ya], [yb]) => yb - ya)
    .map(([, cells]) =>
      cells
        .sort((a, b) => a.x - b.x)
        .map(c => c.text)
    )
    .filter(row => row.length >= MIN_COLS);
}

function isNumericish(v) {
  return !isNaN(parseFloat(String(v).replace(/[,%\s%]/g, '')));
}

// Score a block of rows on how "table-like" it is
function tableScore(rows) {
  if (rows.length < 2) return 0;
  const numericFraction = rows
    .slice(1)
    .filter(r => r.filter(isNumericish).length / r.length >= NUM_THRESH)
    .length / (rows.length - 1);
  const colCounts = rows.map(r => r.length);
  const avgCols   = colCounts.reduce((a, b) => a + b, 0) / colCounts.length;
  return numericFraction * avgCols * rows.length;
}

// Find the contiguous block of rows with the highest table score
function findBestTableBlock(rows) {
  let best = null;
  let bestScore = 0;

  // Try every starting row, greedily extend while score improves
  for (let start = 0; start < rows.length; start++) {
    const block = [];
    for (let end = start; end < rows.length; end++) {
      block.push(rows[end]);
      const score = tableScore(block);
      if (score > bestScore) {
        bestScore = score;
        best = [...block];
      }
    }
  }

  return best;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Parse a PDF File and return tabular data.
 * @param {File} file
 * @returns {Promise<{ headers: string[], rows: Object[], rawRows: string[][] }>}
 */
export async function parsePDF(file) {
  const lib = await getPDFJS();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

  // Collect text items from all pages
  let allRows = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page        = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const rows        = extractRows(textContent.items);
    allRows = allRows.concat(rows);
  }

  const tableBlock = findBestTableBlock(allRows);

  if (!tableBlock || tableBlock.length < 2) {
    throw new Error(
      'Could not find a data table in this PDF.\n' +
      'Make sure the PDF is text-based (not a scanned image) and contains a table.'
    );
  }

  const headers = tableBlock[0];
  const rawRows = tableBlock.slice(1);

  // Build row objects aligned to headers (pad/trim as needed)
  const rows = rawRows.map(values => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? '';
    });
    return obj;
  });

  return { headers, rows, rawRows };
}
