import { renderResults } from './resultsUI.js';

let _headers = [];
let _rows    = [];

/** Called by uploader once a file is parsed */
export function initColumns(headers, rows) {
  _headers = headers;
  _rows    = rows;

  const detected = headers.map(h => ({
    column: h,
    type:   detectType(h, rows),
  }));

  renderColumnSelector(detected);
  document.getElementById('columns-section').classList.remove('hidden');
  document.getElementById('results-section').classList.add('hidden');
}

/** Infer a semantic type for a column by name and value sniffing */
function detectType(header, rows) {
  const h = header.toLowerCase().replace(/[\s_\-]/g, '');

  if (/email|e-?mail/.test(h))                           return 'email';
  if (/instagram|^ig$|ighandle|igusername/.test(h))      return 'instagram';
  if (/tiktok|^tt$|tthandle|ttusername/.test(h))         return 'tiktok';
  if (/username|handle|^user$|account|creator/.test(h))  return 'username';

  // Value sniffing on first 30 non-empty cells
  const sample = rows
    .slice(0, 30)
    .map(r => String(r[header] ?? '').trim())
    .filter(Boolean);

  if (!sample.length) return null;

  const emailCount  = sample.filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)).length;
  const handleCount = sample.filter(v => /^@\S+$/.test(v)).length;

  if (emailCount  / sample.length >= 0.5) return 'email';
  if (handleCount / sample.length >= 0.5) return 'username';

  return null;
}

/** Render checkboxes for each column */
function renderColumnSelector(detected) {
  const list = document.getElementById('column-list');
  list.innerHTML = '';

  detected.forEach(({ column, type }) => {
    const autoDetected = type !== null;

    const label = document.createElement('label');
    label.className = 'col-chip' + (autoDetected ? ' on' : '');
    label.title     = column;

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.value   = column;
    cb.checked = autoDetected;
    cb.addEventListener('change', () => label.classList.toggle('on', cb.checked));

    const name = document.createElement('span');
    name.className   = 'col-name';
    name.textContent = column;

    label.appendChild(cb);
    label.appendChild(name);

    if (type) {
      const badge = document.createElement('span');
      badge.className   = `type-badge type-${type}`;
      badge.textContent = type;
      label.appendChild(badge);
    }

    list.appendChild(label);
  });

  document.getElementById('find-btn').onclick = runFind;
}

function runFind() {
  const list     = document.getElementById('column-list');
  const selected = [...list.querySelectorAll('input:checked')].map(cb => cb.value);

  if (!selected.length) return;

  const dupes = findDuplicates(_rows, selected);
  renderResults(dupes, _headers, _rows, selected);
  document.getElementById('results-section').classList.remove('hidden');
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Core duplicate detection: returns { [column]: DupeEntry[] } */
export function findDuplicates(rows, columns) {
  const result = {};

  for (const col of columns) {
    const map = new Map(); // normalized value → { original, count, rowIndices }

    rows.forEach((row, i) => {
      const raw = row[col];
      if (raw === undefined || raw === null) return;

      const original  = String(raw).trim();
      if (!original)  return;

      const key = original.toLowerCase();

      if (!map.has(key)) {
        map.set(key, { original, count: 0, rowIndices: [] });
      }
      const entry = map.get(key);
      entry.count++;
      entry.rowIndices.push(i + 2); // row 1 = header, so data starts at 2
    });

    result[col] = [...map.values()]
      .filter(e => e.count > 1)
      .sort((a, b) => b.count - a.count);
  }

  return result;
}
