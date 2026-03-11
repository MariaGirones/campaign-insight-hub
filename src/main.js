/**
 * main.js
 * Application entry point.
 * Initialises all feature modules as they are built.
 */

import { initUploader }   from './uploader.js';
import { normalizeData }  from './normalizer.js';
import { matchCreators }  from './matcher.js';
import { initMatcherUI }  from './matcherUI.js';
import { initStoreUI }    from './storeUI.js';
import { initSearchUI }   from './searchUI.js';

// Internal fields to show in the normalized preview (in order)
const NORM_DISPLAY_FIELDS = [
  'username', 'instagramId', 'postId', 'campaign', 'date',
  'likes', 'comments', 'views', 'saves', 'shares', 'reach', 'engagementRate',
];

document.addEventListener('DOMContentLoaded', () => {
  initUploader();
  initMatcherUI();
  initStoreUI();    // Feature 4
  initSearchUI();   // Feature 5

  // ── csv uploaded ───────────────────────────────────────────
  document.addEventListener('csv:loaded', e => {
    const csvResult = e.detail;

    // Feature 2 — normalize
    const { normalizedRows, headerMap, detectedNumericFields, detectedTextFields } = normalizeData(csvResult);
    renderNormalizedPreview(normalizedRows, headerMap, detectedNumericFields, detectedTextFields);

    document.dispatchEvent(
      new CustomEvent('data:normalized', { detail: { normalizedRows } })
    );

    // Feature 3 — match creators
    const creators = matchCreators(normalizedRows);
    console.log('[Campaign Hub] Creators matched:', creators);

    document.dispatchEvent(
      new CustomEvent('creators:matched', { detail: { creators } })
    );
    // Feature 4 — storeUI listens to creators:matched and auto-saves
  });

  // ── clear pressed ──────────────────────────────────────────
  document.addEventListener('ui:cleared', () => {
    document.dispatchEvent(new CustomEvent('creators:cleared'));
  });
});

// ── Render normalized table ────────────────────────────────────
function renderNormalizedPreview(rows, headerMap, detectedNumericFields = [], detectedTextFields = []) {
  const container = document.getElementById('normContainer');
  const countEl   = document.getElementById('normCount');
  const summaryEl = document.getElementById('normSummary');
  const table     = document.getElementById('normTable');

  const mappedInternalFields = [...new Set(Object.values(headerMap))];
  summaryEl.innerHTML = buildSummaryHTML(mappedInternalFields, detectedNumericFields, detectedTextFields);

  // Show: known schema fields that have data + every extra column (numeric + text)
  const knownActive = NORM_DISPLAY_FIELDS.filter(f =>
    rows.some(r => r[f] !== '' && r[f] !== 0)
  );
  const activeFields = [...knownActive, ...detectedNumericFields, ...detectedTextFields];

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  activeFields.forEach(f => {
    const th = document.createElement('th');
    th.textContent = f;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = document.createElement('tr');
    activeFields.forEach(f => {
      const td = document.createElement('td');
      let val = row[f];
      if (f === 'engagementRate' && val) val = (val * 100).toFixed(2) + '%';
      td.textContent = val ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.innerHTML = '';
  table.appendChild(thead);
  table.appendChild(tbody);

  countEl.textContent = `(${rows.length} rows · ${activeFields.length} columns)`;
  container.hidden = false;
}

function buildSummaryHTML(mapped, numericExtra, textExtra) {
  const mappedPills = mapped.map(f =>
    `<span class="pill pill-ok">${f}</span>`
  ).join('');

  const numPills = numericExtra.map(f =>
    `<span class="pill pill-detected">${f}</span>`
  ).join('');

  const txtPills = textExtra.map(f =>
    `<span class="pill pill-warn">${f}</span>`
  ).join('');

  return `
    <div class="summary-group">
      <span class="summary-label">Recognised:</span> ${mappedPills}
    </div>
    ${numericExtra.length ? `<div class="summary-group"><span class="summary-label">Extra numbers:</span> ${numPills}</div>` : ''}
    ${textExtra.length    ? `<div class="summary-group"><span class="summary-label">Extra text:</span> ${txtPills}</div>`    : ''}
  `;
}
