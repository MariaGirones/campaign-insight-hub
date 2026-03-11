/**
 * matcherUI.js
 * Feature 3 — Creator Matching UI
 *
 * Renders the matched creator cards in the #matchSection panel.
 * Exposes initMatcherUI() which listens for 'creators:matched'.
 */

export function initMatcherUI() {
  document.addEventListener('creators:matched', e => {
    renderCreatorCards(e.detail.creators);
  });

  document.addEventListener('creators:cleared', () => {
    const section = document.getElementById('matchSection');
    if (section) section.hidden = true;
  });
}

// ── Render ─────────────────────────────────────────────────────

function renderCreatorCards(creators) {
  const section    = document.getElementById('matchSection');
  const countEl    = document.getElementById('matchCount');
  const grid       = document.getElementById('creatorGrid');

  grid.innerHTML = '';

  creators.forEach(creator => {
    grid.appendChild(buildCard(creator));
  });

  countEl.textContent = `${creators.length} creator${creators.length !== 1 ? 's' : ''} matched`;
  section.hidden = false;
}

function buildCard(c) {
  const card = document.createElement('div');
  card.className = 'creator-card';
  card.dataset.creatorId = c.id;

  const engPct = c.avgEngagementRate
    ? (c.avgEngagementRate * 100).toFixed(2) + '%'
    : '—';

  const campaigns = c.campaigns.length
    ? c.campaigns.map(n => `<span class="pill pill-ok">${n}</span>`).join(' ')
    : '<span class="pill pill-warn">No campaign</span>';

  card.innerHTML = `
    <div class="card-header">
      <div class="card-avatar">${avatarInitial(c.username)}</div>
      <div class="card-title-block">
        <p class="card-username">${c.username || '—'}</p>
        <p class="card-igid">${c.instagramId ? 'ID: ' + c.instagramId : 'No IG ID'}</p>
      </div>
      <div class="card-posts-badge">${c.totalPosts} post${c.totalPosts !== 1 ? 's' : ''}</div>
    </div>

    <div class="card-campaigns">${campaigns}</div>

    <div class="card-metrics">
      ${metric('Likes',    fmt(c.totalLikes))}
      ${metric('Comments', fmt(c.totalComments))}
      ${metric('Views',    fmt(c.totalViews))}
      ${metric('Reach',    fmt(c.totalReach))}
      ${metric('Eng. Rate', engPct)}
    </div>

    <details class="card-posts-detail">
      <summary>View posts (${c.totalPosts})</summary>
      <div class="posts-list">
        ${c.posts.map(postRow).join('')}
      </div>
    </details>
  `;

  return card;
}

function postRow(post) {
  const engPct = post.engagementRate
    ? (post.engagementRate * 100).toFixed(2) + '%'
    : '—';
  const label = post.postId || post.postUrl || '(no id)';
  const link  = post.postUrl
    ? `<a class="post-link" href="${post.postUrl}" target="_blank" rel="noopener">${label}</a>`
    : `<span>${label}</span>`;

  return `
    <div class="post-row">
      <div class="post-id">${link}</div>
      <div class="post-stats">
        <span>${fmt(post.likes)} likes</span>
        <span>${fmt(post.comments)} cmt</span>
        <span>${fmt(post.views)} views</span>
        <span>${engPct} ER</span>
        <span class="post-date">${post.date || ''}</span>
      </div>
    </div>
  `;
}

// ── Tiny helpers ───────────────────────────────────────────────

function metric(label, value) {
  return `
    <div class="metric">
      <span class="metric-value">${value}</span>
      <span class="metric-label">${label}</span>
    </div>
  `;
}

function avatarInitial(username) {
  const clean = String(username ?? '').replace(/^@/, '');
  return clean ? clean[0].toUpperCase() : '?';
}

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
