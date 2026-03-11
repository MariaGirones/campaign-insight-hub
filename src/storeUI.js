/**
 * storeUI.js
 * Feature 4 — Data Storage UI
 *
 * Listens for creators:matched → saves to store → refreshes stats panel.
 * Handles Export JSON and Clear All Stored Data buttons.
 */

import {
  saveCreators,
  loadCampaigns,
  loadCreators,
  clearStore,
  storeSummary,
} from './store.js';

export function initStoreUI() {
  refreshStats();

  // Auto-save whenever new creators are matched
  document.addEventListener('creators:matched', e => {
    const { creators } = e.detail;
    const result = saveCreators(creators);
    console.log('[Store] Saved:', result);
    refreshStats();
    renderCampaignList();
  });

  // Clear store button — double-click to confirm (avoids browser confirm() issues)
  const clearBtn = document.getElementById('clearStoreBtn');
  let clearPending = false;
  clearBtn.addEventListener('click', () => {
    if (!clearPending) {
      clearPending = true;
      clearBtn.textContent = 'Click again to confirm';
      clearBtn.classList.add('btn-danger-confirm');
      setTimeout(() => {
        clearPending = false;
        clearBtn.textContent = 'Clear All Stored Data';
        clearBtn.classList.remove('btn-danger-confirm');
      }, 2500);
    } else {
      clearPending = false;
      clearBtn.textContent = 'Clear All Stored Data';
      clearBtn.classList.remove('btn-danger-confirm');
      clearStore();
      refreshStats();
      renderCampaignList();
    }
  });

  // Initial render (data may already exist from a previous session)
  renderCampaignList();
}

// ── Stats panel ────────────────────────────────────────────────

function refreshStats() {
  const s = storeSummary();

  document.getElementById('statCreators').textContent  = s.creators;
  document.getElementById('statPosts').textContent     = s.posts;
  document.getElementById('statCampaigns').textContent = s.campaigns;
  document.getElementById('statUploads').textContent   = s.totalUploads;

  const metaEl = document.getElementById('storeMeta');
  if (s.lastSaved) {
    const d = new Date(s.lastSaved);
    metaEl.textContent = `Last saved: ${d.toLocaleString()}`;
  } else {
    metaEl.textContent = 'No data saved yet.';
  }
}

// ── Campaign list ──────────────────────────────────────────────

function renderCampaignList() {
  const container = document.getElementById('campaignList');
  const campaigns = loadCampaigns();

  if (!campaigns.length) {
    container.innerHTML = '';
    return;
  }

  const creators = loadCreators();
  const creatorIndex = Object.fromEntries(creators.map(c => [c.id, c]));

  container.innerHTML = campaigns.map(camp => {
    const campCreators = camp.creatorIds
      .map(id => creatorIndex[id])
      .filter(Boolean);

    const creatorPills = campCreators
      .map(c => `<span class="pill pill-ok">${c.username || c.id}</span>`)
      .join('');

    return `
      <div class="campaign-card">
        <div class="campaign-card-header">
          <span class="campaign-name">${camp.name}</span>
          <span class="campaign-badge">${camp.creatorIds.length} creator${camp.creatorIds.length !== 1 ? 's' : ''} · ${camp.postIds.length} post${camp.postIds.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="campaign-creators">${creatorPills}</div>
      </div>
    `;
  }).join('');
}

