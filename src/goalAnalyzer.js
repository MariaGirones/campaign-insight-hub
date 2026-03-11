/**
 * goalAnalyzer.js
 * Analyzes campaign data and directly answers the user's goals.
 * Keyword-driven — detects what was asked and responds to it specifically.
 * No external API. Always free.
 */

export function analyzeGoals(campaignName, normalizedRows, goals) {
  const stats = buildStats(normalizedRows);
  const text  = generateAnswer(campaignName, stats, goals || '');
  return { text, source: 'rules' };
}

// ── Stats builder ─────────────────────────────────────────────

function buildStats(rows) {
  // Per-creator aggregation
  const map = {};
  for (const r of rows) {
    const u = (r.username || '').replace(/^@/, '') || '(unknown)';
    if (!map[u]) map[u] = { username: u, likes: 0, comments: 0, views: 0,
                             saves: 0, shares: 0, reach: 0, posts: 0, erValues: [] };
    map[u].likes    += r.likes    || 0;
    map[u].comments += r.comments || 0;
    map[u].views    += r.views    || 0;
    map[u].saves    += r.saves    || 0;
    map[u].shares   += r.shares   || 0;
    map[u].reach    += r.reach    || 0;
    map[u].posts    += 1;
    if (r.engagementRate > 0) map[u].erValues.push(r.engagementRate);
  }

  const creators = Object.values(map).map(c => ({
    ...c,
    avgER: c.erValues.length
      ? c.erValues.reduce((s, v) => s + v, 0) / c.erValues.length
      : 0,
  }));

  const totals = {
    likes:    creators.reduce((s, c) => s + c.likes,    0),
    comments: creators.reduce((s, c) => s + c.comments, 0),
    views:    creators.reduce((s, c) => s + c.views,    0),
    saves:    creators.reduce((s, c) => s + c.saves,    0),
    shares:   creators.reduce((s, c) => s + c.shares,   0),
    reach:    creators.reduce((s, c) => s + c.reach,    0),
    posts:    rows.length,
  };

  const erAll = rows.map(r => r.engagementRate).filter(v => v > 0);
  totals.avgER = erAll.length ? erAll.reduce((s, v) => s + v, 0) / erAll.length : 0;

  // Sorted rankings
  const byLikes    = [...creators].sort((a, b) => b.likes    - a.likes);
  const byViews    = [...creators].sort((a, b) => b.views    - a.views);
  const byComments = [...creators].sort((a, b) => b.comments - a.comments);
  const byER       = [...creators].filter(c => c.avgER > 0).sort((a, b) => b.avgER - a.avgER);
  const bySaves    = [...creators].sort((a, b) => b.saves    - a.saves);
  const byReach    = [...creators].filter(c => c.reach > 0).sort((a, b) => b.reach - a.reach);
  const byPosts    = [...creators].sort((a, b) => b.posts    - a.posts);

  return { creators, totals, byLikes, byViews, byComments, byER, bySaves, byReach, byPosts };
}

// ── Answer generator ──────────────────────────────────────────

function generateAnswer(campaignName, stats, goals) {
  const g    = goals.toLowerCase();
  const { totals, byLikes, byViews, byER, byComments, bySaves, byReach, byPosts, creators } = stats;
  const lines = [];

  // Header
  lines.push(`**${campaignName}** — ${totals.posts} post${totals.posts !== 1 ? 's' : ''}, ${creators.length} creator${creators.length !== 1 ? 's' : ''}`);

  // ── Answer specific goals ─────────────────────────────────

  const asksER      = /engagement.?rate|er\b|engag/i.test(goals);
  const asksViews   = /view|watch|play|impression/i.test(goals);
  const asksLikes   = /like|heart|reaction/i.test(goals);
  const asksReach   = /reach|audience|account/i.test(goals);
  const asksSaves   = /save|bookmark/i.test(goals);
  const asksTop     = /best|top|highest|most|winner|leading/i.test(goals);
  const asksWorst   = /worst|lowest|least|bottom|weakest/i.test(goals);
  const asksCompare = /compar|vs\b|versus|against|benchmark/i.test(goals);
  const asksWho     = /who|which creator|which influencer/i.test(goals);
  const asksAvg     = /average|avg|typical|normal|overall/i.test(goals);
  const asksTotal   = /total|sum|all together|combined/i.test(goals);

  // Engagement rate question
  if (asksER || (asksWho && !asksViews && !asksLikes)) {
    if (byER.length) {
      const best = byER[0];
      lines.push(`- Best engagement rate: **${best.username}** at **${pct(best.avgER)}** (${best.posts} post${best.posts !== 1 ? 's' : ''})`);
      if (asksWorst && byER.length > 1) {
        const worst = byER[byER.length - 1];
        lines.push(`- Lowest engagement rate: **${worst.username}** at **${pct(worst.avgER)}**`);
      }
      if (byER.length > 1 && (asksTop || asksCompare)) {
        const others = byER.slice(1, 4).map(c => `${c.username} ${pct(c.avgER)}`).join(', ');
        lines.push(`- Others: ${others}`);
      }
      if (totals.avgER > 0 && (asksAvg || asksCompare)) {
        const label = totals.avgER >= 0.06 ? 'excellent' : totals.avgER >= 0.03 ? 'good' : totals.avgER >= 0.01 ? 'average' : 'below average';
        lines.push(`- Campaign avg ER: **${pct(totals.avgER)}** — ${label} for influencer marketing`);
      }
    } else {
      lines.push(`- No engagement rate data found in this file.`);
    }
  }

  // Views question
  if (asksViews) {
    if (totals.views > 0) {
      lines.push(`- Most views: **${byViews[0].username}** with **${fmt(byViews[0].views)}**`);
      if (asksWorst && byViews.length > 1)
        lines.push(`- Fewest views: **${byViews[byViews.length - 1].username}** with **${fmt(byViews[byViews.length - 1].views)}**`);
      if (asksTotal)
        lines.push(`- Total views across campaign: **${fmt(totals.views)}**`);
      if (asksAvg)
        lines.push(`- Avg views per post: **${fmt(Math.round(totals.views / totals.posts))}**`);
    } else {
      lines.push(`- No view data found in this file.`);
    }
  }

  // Likes question
  if (asksLikes) {
    if (totals.likes > 0) {
      lines.push(`- Most likes: **${byLikes[0].username}** with **${fmt(byLikes[0].likes)}**`);
      if (asksWorst && byLikes.length > 1)
        lines.push(`- Fewest likes: **${byLikes[byLikes.length - 1].username}** with **${fmt(byLikes[byLikes.length - 1].likes)}**`);
      if (asksTotal)
        lines.push(`- Total likes: **${fmt(totals.likes)}**`);
    } else {
      lines.push(`- No like data found in this file.`);
    }
  }

  // Reach question
  if (asksReach) {
    if (totals.reach > 0) {
      lines.push(`- Highest reach: **${byReach[0].username}** with **${fmt(byReach[0].reach)}**`);
      if (asksTotal)
        lines.push(`- Total reach: **${fmt(totals.reach)}**`);
    } else {
      lines.push(`- No reach data found in this file.`);
    }
  }

  // Saves question
  if (asksSaves) {
    if (totals.saves > 0) {
      lines.push(`- Most saves: **${bySaves[0].username}** with **${fmt(bySaves[0].saves)}**`);
    } else {
      lines.push(`- No save data found in this file.`);
    }
  }

  // ── If no specific goal detected: show general overview ──────

  if (!asksER && !asksViews && !asksLikes && !asksReach && !asksSaves) {
    // General summary
    if (totals.likes > 0)
      lines.push(`- Total: **${fmt(totals.likes)} likes** · **${fmt(totals.comments)} comments**${totals.saves ? ' · **' + fmt(totals.saves) + ' saves**' : ''}`);
    if (totals.views > 0)
      lines.push(`- Total views: **${fmt(totals.views)}**${totals.reach ? ' · reach: **' + fmt(totals.reach) + '**' : ''}`);
    if (totals.avgER > 0) {
      const label = totals.avgER >= 0.06 ? 'excellent' : totals.avgER >= 0.03 ? 'good' : totals.avgER >= 0.01 ? 'average' : 'below average';
      lines.push(`- Avg engagement rate: **${pct(totals.avgER)}** (${label})`);
    }
    if (byLikes.length)
      lines.push(`- Top by likes: **${byLikes[0].username}** (${fmt(byLikes[0].likes)})`);
    if (byER.length)
      lines.push(`- Top by ER: **${byER[0].username}** (${pct(byER[0].avgER)})`);
    if (totals.views > 0 && byViews.length)
      lines.push(`- Top by views: **${byViews[0].username}** (${fmt(byViews[0].views)})`);
  }

  // ── Compare / benchmark addendum ─────────────────────────────
  if (asksCompare && creators.length > 1 && !asksER) {
    const ranked = byLikes.slice(0, 5).map((c, i) => `${i + 1}. **${c.username}** — ${fmt(c.likes)} likes, ${c.avgER > 0 ? pct(c.avgER) + ' ER' : 'no ER'}`);
    lines.push(`\n**Full ranking:**\n${ranked.join('\n')}`);
  }

  return lines.join('\n');
}

// ── Tiny helpers ──────────────────────────────────────────────

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function pct(r) {
  return (r * 100).toFixed(2) + '%';
}
