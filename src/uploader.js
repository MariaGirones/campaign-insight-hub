import { parseCSV, readFileAsText } from './csvParser.js';
import { parsePDF }                 from './pdfParser.js';
import { initColumns }              from './duplicateFinder.js';

export function initUploader() {
  const dropZone   = document.getElementById('drop-zone');
  const fileInput  = document.getElementById('file-input');
  const statusEl   = document.getElementById('upload-status');
  const resetBtn   = document.getElementById('reset-btn');

  // Click anywhere on drop zone to open file picker
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  resetBtn.addEventListener('click', reset);

  async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'csv' && ext !== 'pdf') {
      showStatus('Only CSV and PDF files are supported.', 'err');
      return;
    }

    showStatus('Parsing file\u2026', 'loading');

    try {
      let result;
      if (ext === 'pdf') {
        result = await parsePDF(file);
      } else {
        const text = await readFileAsText(file);
        result = parseCSV(text);
      }

      if (!result.headers.length || !result.rows.length) {
        showStatus('No data found in this file.', 'err');
        return;
      }

      showStatus(
        `\u2713 ${file.name} \u2014 ${result.rows.length} rows, ${result.headers.length} columns`,
        'ok'
      );
      initColumns(result.headers, result.rows);

    } catch (err) {
      showStatus('Failed to parse file: ' + err.message, 'err');
    }
  }

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className   = 'upload-status ' + type;
  }

  function reset() {
    fileInput.value    = '';
    statusEl.className = 'upload-status hidden';
    statusEl.textContent = '';
    document.getElementById('columns-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
  }
}
