/**
 * uploader.js
 * Handles all UI interactions for the file upload section.
 * Accepts CSV and PDF files. Emits 'csv:loaded' on the document
 * when parsing succeeds (same payload shape regardless of file type).
 */

import { parseCSV, readFileAsText } from './csvParser.js';
import { parsePDF }                 from './pdfParser.js';

const ACCEPTED_EXTS = ['.csv', '.pdf'];

function isAccepted(file) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTS.some(ext => name.endsWith(ext));
}

function fileType(file) {
  if (file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'csv';
}

export function initUploader() {
  const uploadArea       = document.getElementById('uploadArea');
  const fileInput        = document.getElementById('fileInput');
  const browseBtn        = document.getElementById('browseBtn');
  const uploadStatus     = document.getElementById('uploadStatus');
  const statusFilename   = document.getElementById('statusFilename');
  const statusInfo       = document.getElementById('statusInfo');
  const previewContainer = document.getElementById('previewContainer');
  const previewCount     = document.getElementById('previewCount');
  const previewTable     = document.getElementById('previewTable');
  const clearBtn         = document.getElementById('clearBtn');

  // ── Open file picker ───────────────────────────────────────
  browseBtn.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('click', e => {
    if (e.target !== browseBtn) fileInput.click();
  });

  // ── File input change ──────────────────────────────────────
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
  });

  // ── Drag & drop ────────────────────────────────────────────
  uploadArea.addEventListener('dragover', e => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // ── Clear button ───────────────────────────────────────────
  clearBtn.addEventListener('click', resetUI);

  // ── Core handler ──────────────────────────────────────────
  async function handleFile(file) {
    if (!isAccepted(file)) {
      showStatus(file.name, 'Only CSV and PDF files are supported.', true);
      return;
    }

    const type = fileType(file);
    showStatus(file.name, `Reading ${type.toUpperCase()} file…`);

    try {
      let result;

      if (type === 'pdf') {
        showStatus(file.name, 'Loading PDF parser…');
        result = await parsePDF(file);
      } else {
        const text = await readFileAsText(file);
        result = parseCSV(text);
      }

      showStatus(
        file.name,
        `${result.rows.length} rows · ${result.headers.length} columns detected`
      );

      renderPreview(result.headers, result.rows);

      document.dispatchEvent(
        new CustomEvent('csv:loaded', { detail: result })
      );
    } catch (err) {
      showStatus(file.name, err.message, true);
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  function showStatus(filename, info, isError = false) {
    statusFilename.textContent = filename;
    statusInfo.textContent     = info;
    uploadStatus.hidden        = false;
    uploadStatus.querySelector('.status-card').classList.toggle('error', isError);
  }

  function renderPreview(headers, rows) {
    const thead   = document.createElement('thead');
    const headRow = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(h => {
        const td = document.createElement('td');
        td.textContent = row[h] ?? '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    previewTable.innerHTML = '';
    previewTable.appendChild(thead);
    previewTable.appendChild(tbody);
    previewCount.textContent = `(${rows.length} rows · ${headers.length} columns)`;
    previewContainer.hidden = false;
  }

  function resetUI() {
    fileInput.value         = '';
    uploadStatus.hidden     = true;
    previewContainer.hidden = true;
    previewTable.innerHTML  = '';
    uploadArea.classList.remove('drag-over');

    const normContainer = document.getElementById('normContainer');
    const normTable     = document.getElementById('normTable');
    const normSummary   = document.getElementById('normSummary');
    if (normContainer) normContainer.hidden  = true;
    if (normTable)     normTable.innerHTML   = '';
    if (normSummary)   normSummary.innerHTML = '';

    document.dispatchEvent(new CustomEvent('ui:cleared'));
  }
}
