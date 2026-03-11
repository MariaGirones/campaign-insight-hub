/**
 * searchUI.js
 * Feature 5 — Creator Search UI
 *
 * Manages the #search section: input box, live results, and
 * a detail card for whichever creator / post / campaign matched.
 */

import { search } from './search.js';

export function initSearchUI() {
  const input      = document.getElementById('searchInput');
  const clearBtn   = document.getElementById('searchClearBtn');
  const resultBox  = document.getElementById('searchResult');

  if (!input) return;

  // ── Input: search on Enter or after 400 ms idle ────────────
  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (!q) { clearResult(resultBox); return; }
    debounce = setTimeout(() => runSearch(q, resultBox), 400);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(debounce);
      const q = input.value.trim();
      if (q) runSearch(q, resultBox);
    }
    if (e.key === 'Escape') {
      input.value = '';
      clearResult(resultBox);
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearResult(resultBox);
    input.focus();
  });

  // Re-run last search when new data is saved (in case it now matches)
  document.addEventListener('creators:matched', () => {
    const q = input.value.trim();
    if (q) runSearch(q, resultBox);
  });
}

// ── Search runner ──────────────────────────────────────────────

function runSearch(query, resultBox) {
  const result = search(query);
  renderResult(result, resultBox);
}

// ── Renderers ──────────────────────────────────────────────────

function renderResult(result, box) {
  box.innerHTML = '';
  box.hidden = false;

  switch (result.type) {
    case 'creator':  box.appendChild(creatorCard(result)); break;
    case 'post':     box.appendChild(postCard(result));    break;
    case 'campaign': box.appendChild(campaignCard(result)); break;
    case 'multiple': box.appendChild(multipleCard(result)); break;
    default:         box.appendChild(notFoundCard(result.query)); break;
  }
}

function clearResult(box) {
  box.innerHTML = '';
  box.hidden = true;
}

// ── Creator card ───────────────────────────────────────────────

function creatorCard({ creator, allPosts }) {
  const wrap = el('div', 'search-card');

  wrap.innerHTML = `
    <div class="search-card-header">
      <div class="search-avatar">${avatarInitial(creator.username)}</div>
      <div>
        <p class="search-card-title">${creator.username || '—'}</p>
        <p class="search-card-sub">${creator.instagramId ? 'IG ID: ' + creator.instagramId : 'No IG ID'}</p>
      </div>
      <span class="search-type-badge">Creator</span>
    </div>

    <div class="search-campaigns">
      ${(creator.campaigns ?? []).map(c => `<span class="pill pill-ok">${c}</span>`).join('') || '<span class="pill pill-warn">No campaign</span>'}
    </div>

    <div class="search-metrics">
      ${metricBox('Likes',    fmt(creator.totalLikes))}
      ${metricBox('Comments', fmt(creator.totalComments))}
      ${metricBox('Views',    fmt(creator.totalViews))}
      ${metricBox('Reach',    fmt(creator.totalReach))}
      ${metricBox('Avg ER',   creator.avgEngagementRate ? (creator.avgEngagementRate * 100).toFixed(2) + '%' : '—')}
      ${metricBox('Posts',    creator.totalPosts)}
    </div>

    ${allPosts.length ? postsTable(allPosts) : ''}
  `;

  return wrap;
}

// ── Post card ──────────────────────────────────────────────────

function postCard({ post, creator }) {
  const wrap = el('div', 'search-card');

  const postLabel = post.postUrl
    ? `<a class="post-link" href="${post.postUrl}" target="_blank" rel="noopener">${post.postId || post.postUrl}</a>`
    : (post.postId || '—');

  wrap.innerHTML = `
    <div class="search-card-header">
      <div class="search-avatar search-avatar-post">&#9654;</div>
      <div>
        <p class="search-card-title">${postLabel}</p>
        <p class="search-card-sub">
          ${creator ? `By ${creator.username}` : 'Unknown creator'}
          ${post.campaign ? ' &middot; ' + post.campaign : ''}
          ${post.date     ? ' &middot; ' + post.date     : ''}
        </p>
      </div>
      <span class="search-type-badge search-type-post">Post</span>
    </div>

    <div class="search-metrics">
      ${metricBox('Likes',    fmt(post.likes))}
      ${metricBox('Comments', fmt(post.comments))}
      ${metricBox('Views',    fmt(post.views))}
      ${metricBox('Saves',    fmt(post.saves))}
      ${metricBox('Shares',   fmt(post.shares))}
      ${metricBox('Reach',    fmt(post.reach))}
      ${metricBox('ER',       post.engagementRate ? (post.engagementRate * 100).toFixed(2) + '%' : '—')}
    </div>
  `;

  return wrap;
}

// ── Campaign card ──────────────────────────────────────────────

function campaignCard({ campaign, campCreators = [] }) {
  const wrap = el('div', 'search-card');

  const creatorPills = campCreators
    .map(c => `<span class="pill pill-ok">${c.username || c.id}</span>`)
    .join('');

  wrap.innerHTML = `
    <div class="search-card-header">
      <div class="search-avatar search-avatar-campaign">&#9733;</div>
      <div>
        <p class="search-card-title">${campaign.name}</p>
        <p class="search-card-sub">${campaign.creatorIds.length} creators · ${campaign.postIds.length} posts</p>
      </div>
      <span class="search-type-badge search-type-campaign">Campaign</span>
    </div>
    <div class="search-campaigns">${creatorPills}</div>
  `;

  return wrap;
}

// ── Multiple results card ──────────────────────────────────────

function multipleCard({ results, query }) {
  const wrap = el('div', 'search-card');

  const items = results.map(c => `
    <div class="multi-item">
      <span class="search-avatar search-avatar-sm">${avatarInitial(c.username)}</span>
      <span class="multi-username">${c.username}</span>
      <span class="multi-meta">${(c.campaigns ?? []).join(', ') || 'No campaign'}</span>
    </div>
  `).join('');

  wrap.innerHTML = `
    <p class="search-multi-title">${results.length} creators match "<strong>${query}</strong>"</p>
    <div class="multi-list">${items}</div>
  `;

  return wrap;
}

// ── Not found ──────────────────────────────────────────────────

function notFoundCard(query) {
  const wrap = el('div', 'search-card search-card-empty');
  wrap.innerHTML = `
    <p class="search-not-found">No results for "<strong>${query}</strong>"</p>
    <p class="search-not-found-hint">Try: @username, post URL, post ID, or campaign name</p>
  `;
  return wrap;
}

// ── Posts table (inside creator card) ─────────────────────────

function postsTable(posts) {
  const rows = posts.map(p => {
    const label = p.postUrl
      ? `<a class="post-link" href="${p.postUrl}" target="_blank" rel="noopener">${p.postId || 'view'}</a>`
      : (p.postId || '—');
    const er = p.engagementRate ? (p.engagementRate * 100).toFixed(2) + '%' : '—';
    return `
      <tr>
        <td>${label}</td>
        <td>${p.campaign || '—'}</td>
        <td>${fmt(p.likes)}</td>
        <td>${fmt(p.comments)}</td>
        <td>${fmt(p.views)}</td>
        <td>${er}</td>
        <td>${p.date || '—'}</td>
      </tr>`;
  }).join('');

  return `
    <div class="search-posts-wrap">
      <p class="search-posts-label">Posts (${posts.length})</p>
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Post</th><th>Campaign</th><th>Likes</th>
            <th>Comments</th><th>Views</th><th>ER</th><th>Date</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Tiny helpers ───────────────────────────────────────────────

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function metricBox(label, value) {
  return `<div class="metric"><span class="metric-value">${value}</span><span class="metric-label">${label}</span></div>`;
}

function avatarInitial(username) {
  const s = String(username ?? '').replace(/^@/, '');
  return s ? s[0].toUpperCase() : '?';
}

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
