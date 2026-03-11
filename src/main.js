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
import { initSearchUI }             from './searchUI.js';
import { initMissingUI, refreshCampaignSelector } from './missingUI.js';
import { analyzeGoals } from './goalAnalyzer.js';

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
  initMissingUI();  // Feature 6

  // Keep roster campaign selector in sync when new data arrives
  document.addEventListener('creators:matched', () => refreshCampaignSelector());

  // ── csv uploaded ───────────────────────────────────────────
  document.addEventListener('csv:loaded', e => {
    const csvResult     = e.detail;
    const campaignName  = csvResult.campaignName || '';

    // Feature 2 — normalize (campaign name always comes from filename)
    const { normalizedRows, headerMap, detectedNumericFields, detectedTextFields } = normalizeData(csvResult, campaignName);
    renderNormalizedPreview(normalizedRows, headerMap, detectedNumericFields, detectedTextFields);

    // Goals analysis — free, rule-based, runs immediately
    const goals = document.getElementById('goalsInput')?.value?.trim() ?? '';
    renderInsights(campaignName, normalizedRows, goals);

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
    const insightsContainer = document.getElementById('insightsContainer');
    if (insightsContainer) insightsContainer.hidden = true;
    document.dispatchEvent(new CustomEvent('creators:cleared'));
  });
});

// ── Insights renderer ──────────────────────────────────────────

function renderInsights(campaignName, normalizedRows, goals) {
  const container = document.getElementById('insightsContainer');
  const loading   = document.getElementById('insightsLoading');
  const content   = document.getElementById('insightsContent');
  const sourceEl  = document.getElementById('insightsSource');

  if (!container) return;

  const { text } = analyzeGoals(campaignName, normalizedRows, goals);
  loading.hidden       = true;
  sourceEl.textContent = '';
  content.innerHTML    = markdownToHTML(text);
  container.hidden     = false;
}

/** Minimal markdown renderer: bold, bullet lists, line breaks */
function markdownToHTML(md) {
  return md
    .split('\n')
    .map(line => {
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      line = line.replace(/\*(.+?)\*/g, '<em>$1</em>');
      if (/^[-•]\s/.test(line)) return `<li>${line.slice(2)}</li>`;
      if (line.trim() === '')   return '<br>';
      return `<p>${line}</p>`;
    })
    .join('')
    .replace(/(<li>.*<\/li>)+/g, match => `<ul>${match}</ul>`);
}

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
