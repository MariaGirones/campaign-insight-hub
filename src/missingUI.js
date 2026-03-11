/**
 * missingUI.js
 * Feature 6 — Missing Data Detection UI
 *
 * Renders a report per campaign showing:
 *  - Submission progress bar
 *  - List of creators who submitted
 *  - List of creators who are missing / have no data
 *
 * Also supports uploading a roster CSV to check against a
 * specific campaign.
 */

import { detectMissing, detectMissingFromRoster } from './missingDetector.js';
import { loadCampaigns }                           from './store.js';
import { parseCSV, readFileAsText }               from './csvParser.js';
import { normalizeData }                           from './normalizer.js';

export function initMissingUI() {
  // Re-run whenever new data is saved
  document.addEventListener('creators:matched', () => renderMissingSection());

  // Initial render (in case store already has data)
  renderMissingSection();

  // Roster upload
  document.getElementById('rosterFileInput')
    .addEventListener('change', handleRosterUpload);
}

// ── Main render ────────────────────────────────────────────────

function renderMissingSection() {
  const container = document.getElementById('missingReports');
  const reports   = detectMissing();

  if (!reports.length) {
    container.innerHTML = '<p class="missing-empty">No campaign data stored yet. Upload a CSV to get started.</p>';
    return;
  }

  container.innerHTML = '';
  reports.forEach(report => container.appendChild(buildReportCard(report)));
}

// ── Report card ────────────────────────────────────────────────

function buildReportCard(report) {
  const card = document.createElement('div');
  card.className = 'missing-card';

  const statusClass = report.submittedPct === 100 ? 'complete'
    : report.submittedPct >= 50 ? 'partial' : 'low';

  const missingRows = report.missing.map(m => `
    <div class="missing-row missing-row-bad">
      <span class="missing-indicator">&#9679;</span>
      <span class="missing-username">${m.username}</span>
      <span class="missing-igid">${m.instagramId !== '—' ? 'ID: ' + m.instagramId : ''}</span>
      <span class="missing-reason ${m.reason}">${m.reason === 'no_data' ? 'Not in store' : 'No posts'}</span>
    </div>`
  ).join('');

  const submittedRows = report.submitted.map(c => `
    <div class="missing-row missing-row-ok">
      <span class="missing-indicator ok">&#10003;</span>
      <span class="missing-username">${c.username}</span>
      <span class="missing-igid">${c.instagramId ? 'ID: ' + c.instagramId : ''}</span>
      <span class="missing-reason ok">Submitted</span>
    </div>`
  ).join('');

  card.innerHTML = `
    <div class="missing-card-header">
      <span class="missing-campaign-name">${report.campaign}</span>
      <span class="missing-badge missing-badge-${statusClass}">
        ${report.submitted.length} / ${report.total} submitted
      </span>
    </div>

    <div class="missing-progress-wrap">
      <div class="missing-progress-bar">
        <div class="missing-progress-fill missing-fill-${statusClass}"
             style="width:${report.submittedPct}%"></div>
      </div>
      <span class="missing-pct">${report.submittedPct}%</span>
    </div>

    ${report.missing.length ? `
      <div class="missing-group">
        <p class="missing-group-label">Missing (${report.missing.length})</p>
        ${missingRows}
      </div>` : ''}

    ${report.submitted.length ? `
      <details class="missing-submitted-detail">
        <summary>Submitted (${report.submitted.length})</summary>
        <div class="missing-group">${submittedRows}</div>
      </details>` : ''}
  `;

  return card;
}

// ── Roster upload ──────────────────────────────────────────────

async function handleRosterUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const campaignSelect  = document.getElementById('rosterCampaignSelect');
  const rosterStatus    = document.getElementById('rosterStatus');
  const rosterResult    = document.getElementById('rosterResult');
  const campaignName    = campaignSelect.value;

  if (!campaignName) {
    rosterStatus.textContent = 'Please select a campaign first.';
    rosterStatus.hidden = false;
    return;
  }

  try {
    const text = await readFileAsText(file);
    const csv  = parseCSV(text);
    const { normalizedRows } = normalizeData(csv);

    const report = detectMissingFromRoster(campaignName, normalizedRows);

    rosterStatus.hidden = true;
    rosterResult.innerHTML = '';
    rosterResult.appendChild(buildReportCard(report));
    rosterResult.hidden = false;
  } catch (err) {
    rosterStatus.textContent = 'Error: ' + err.message;
    rosterStatus.hidden = false;
  }

  // Reset input so the same file can be re-uploaded
  e.target.value = '';
}

// ── Populate campaign selector ─────────────────────────────────

export function refreshCampaignSelector() {
  const select    = document.getElementById('rosterCampaignSelect');
  const campaigns = loadCampaigns();

  select.innerHTML = '<option value="">— Select campaign —</option>';
  campaigns.forEach(c => {
    const opt = document.createElement('option');
    opt.value       = c.name;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}
