/**
 * uploader.js
 * Handles all UI interactions for the CSV upload section.
 * Emits a custom event 'csv:loaded' on the document when parsing succeeds.
 */

import { parseCSV, readFileAsText } from './csvParser.js';

const ALLOWED_TYPE = 'text/csv';
const ALLOWED_EXT      = '.csv';

export function initUploader() {
  const uploadArea      = document.getElementById('uploadArea');
  const fileInput       = document.getElementById('fileInput');
  const browseBtn       = document.getElementById('browseBtn');
  const uploadStatus    = document.getElementById('uploadStatus');
  const statusFilename  = document.getElementById('statusFilename');
  const statusInfo      = document.getElementById('statusInfo');
  const previewContainer = document.getElementById('previewContainer');
  const previewCount    = document.getElementById('previewCount');
  const previewTable    = document.getElementById('previewTable');
  const clearBtn        = document.getElementById('clearBtn');

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
    // Validate extension (MIME type can be unreliable on Windows)
    const isCSV =
      file.type === ALLOWED_TYPE ||
      file.name.toLowerCase().endsWith(ALLOWED_EXT);

    if (!isCSV) {
      showStatus(file.name, 'Only CSV files are supported.', true);
      return;
    }

    showStatus(file.name, 'Reading file…');

    try {
      const text   = await readFileAsText(file);
      const result = parseCSV(text);

      showStatus(
        file.name,
        `${result.rows.length} rows · ${result.headers.length} columns detected`
      );

      renderPreview(result.headers, result.rows);

      // Notify the rest of the app
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

    const card = uploadStatus.querySelector('.status-card');
    card.classList.toggle('error', isError);
  }

  function renderPreview(headers, rows) {
    // Header row
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    // Body rows (all rows — table wrapper scrolls)
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

    previewCount.textContent = `(${rows.length} rows)`;
    previewContainer.hidden = false;
  }

  function resetUI() {
    fileInput.value         = '';
    uploadStatus.hidden     = true;
    previewContainer.hidden = true;
    previewTable.innerHTML  = '';
    uploadArea.classList.remove('drag-over');

    // Clear downstream sections (Features 2, 3, …)
    const normContainer = document.getElementById('normContainer');
    const normTable     = document.getElementById('normTable');
    const normSummary   = document.getElementById('normSummary');
    if (normContainer)  normContainer.hidden  = true;
    if (normTable)      normTable.innerHTML   = '';
    if (normSummary)    normSummary.innerHTML = '';

    // Notify all other modules to reset
    document.dispatchEvent(new CustomEvent('ui:cleared'));
  }
}
