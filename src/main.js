/**
 * main.js
 * Application entry point.
 * Initialises all feature modules as they are built.
 */

import { initUploader } from './uploader.js';
import { normalizeData, normalizationSummary } from './normalizer.js';

// Internal fields to show in the normalized preview (in order)
const NORM_DISPLAY_FIELDS = [
  'username', 'instagramId', 'postId', 'campaign', 'date',
  'likes', 'comments', 'views', 'saves', 'shares', 'reach', 'engagementRate',
];

document.addEventListener('DOMContentLoaded', () => {
  initUploader();

  document.addEventListener('csv:loaded', e => {
    const csvResult = e.detail;
    console.log('[Campaign Hub] CSV loaded:', csvResult);

    // ── Feature 2: normalize ──────────────────────────────────
    const { normalizedRows, headerMap, unmappedHeaders } = normalizeData(csvResult);
    console.log('[Campaign Hub] Normalized:', normalizedRows);

    renderNormalizedPreview(normalizedRows, headerMap, unmappedHeaders);

    // Future features receive normalized data via this event
    document.dispatchEvent(
      new CustomEvent('data:normalized', { detail: { normalizedRows } })
    );
  });
});

// ── Render normalized table ────────────────────────────────────
function renderNormalizedPreview(rows, headerMap, unmappedHeaders) {
  const container   = document.getElementById('normContainer');
  const countEl     = document.getElementById('normCount');
  const summaryEl   = document.getElementById('normSummary');
  const table       = document.getElementById('normTable');

  // Summary pills
  const mappedFields = [...new Set(Object.values(headerMap))];
  summaryEl.innerHTML = buildSummaryHTML(mappedFields, unmappedHeaders);

  // Only show fields that actually have data
  const activeFields = NORM_DISPLAY_FIELDS.filter(f =>
    rows.some(r => r[f] !== '' && r[f] !== 0)
  );

  // Header
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  activeFields.forEach(f => {
    const th = document.createElement('th');
    th.textContent = f;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  // Body
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

  countEl.textContent = `(${rows.length} rows)`;
  container.hidden = false;
}

function buildSummaryHTML(mapped, unmapped) {
  const pills = mapped.map(f =>
    `<span class="pill pill-ok">${f}</span>`
  ).join('');

  const missing = unmapped.map(f =>
    `<span class="pill pill-warn">${f}</span>`
  ).join('');

  return `
    <div class="summary-group">
      <span class="summary-label">Mapped:</span> ${pills}
    </div>
    ${unmapped.length ? `<div class="summary-group"><span class="summary-label">Unmapped:</span> ${missing}</div>` : ''}
  `;
}
