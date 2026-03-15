import { parsePDF }    from './pdfParser.js';
import { initColumns } from './duplicateFinder.js';

export function initUploader() {
  const dropZone  = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const statusEl  = document.getElementById('upload-status');

  dropZone.addEventListener('click',    () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave',() => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

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
        result = await parseCSVInWorker(file);
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

  /** Offload CSV parsing to a Web Worker so the UI never freezes */
  function parseCSVInWorker(file) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL('./worker.js', import.meta.url)
      );

      worker.onmessage = e => {
        worker.terminate();
        if (e.data.ok) resolve(e.data);
        else           reject(new Error(e.data.error));
      };

      worker.onerror = e => {
        worker.terminate();
        reject(new Error(e.message || 'Worker error'));
      };

      worker.postMessage({ file });
    });
  }

  function showStatus(msg, type) {
    statusEl.className = 'upload-status ' + type;
    if (type === 'ok') {
      statusEl.innerHTML = `
        <span class="status-msg">${msg}</span>
        <button class="status-clear-btn" aria-label="Clear all">Clear all</button>`;
      statusEl.querySelector('.status-clear-btn').addEventListener('click', reset);
    } else {
      statusEl.textContent = msg;
    }
  }

  function reset() {
    fileInput.value      = '';
    statusEl.className   = 'upload-status hidden';
    statusEl.innerHTML   = '';
    document.getElementById('columns-section').classList.add('hidden');
    document.getElementById('results-section').classList.add('hidden');
  }
}
