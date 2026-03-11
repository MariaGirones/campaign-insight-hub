/**
 * goalAnalyzer.js
 * Analyzes campaign data and directly answers the user's goals.
 * Works with any column names — falls back to whatever numeric data exists.
 * No external API. Always free.
 */

export function analyzeGoals(campaignName, normalizedRows, goals) {
  const stats = buildStats(normalizedRows);
  const text  = generateAnswer(campaignName, stats, goals || '');
  return { text, source: 'rules' };
}

// ── Stats builder ─────────────────────────────────────────────

const KNOWN_SCHEMA = new Set([
  'likes', 'comments', 'views', 'saves', 'shares',
  'reach', 'impressions', 'engagementRate',
  'username', 'instagramId', 'postUrl', 'postId', 'campaign', 'date', '_raw',
]);

function buildStats(rows) {
  if (!rows.length) return null;

  // Detect extra numeric fields present in the data
  const extraKeys = Object.keys(rows[0])
    .filter(k => !KNOWN_SCHEMA.has(k) && typeof rows[0][k] === 'number');

  // Per-creator aggregation
  const map = {};
  for (const r of rows) {
    const u = (r.username || '').replace(/^@/, '') || '(unknown)';
    if (!map[u]) {
      map[u] = {
        username: u, likes: 0, comments: 0, views: 0,
        saves: 0, shares: 0, reach: 0, posts: 0, erValues: [],
        extras: Object.fromEntries(extraKeys.map(k => [k, 0])),
      };
    }
    map[u].likes    += r.likes    || 0;
    map[u].comments += r.comments || 0;
    map[u].views    += r.views    || 0;
    map[u].saves    += r.saves    || 0;
    map[u].shares   += r.shares   || 0;
    map[u].reach    += r.reach    || 0;
    map[u].posts    += 1;
    if (r.engagementRate > 0) map[u].erValues.push(r.engagementRate);
    for (const k of extraKeys) map[u].extras[k] += r[k] || 0;
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

  // Extra field totals per creator (for fallback display)
  const extraTotals = {};
  for (const k of extraKeys) {
    extraTotals[k] = creators.reduce((s, c) => s + (c.extras[k] || 0), 0);
  }

  const hasStandardMetrics = totals.likes > 0 || totals.views > 0 ||
                             totals.comments > 0 || totals.reach > 0;

  return {
    creators, totals, extraKeys, extraTotals, hasStandardMetrics,
    byLikes:    [...creators].sort((a, b) => b.likes    - a.likes),
    byViews:    [...creators].sort((a, b) => b.views    - a.views),
    byComments: [...creators].sort((a, b) => b.comments - a.comments),
    byER:       [...creators].filter(c => c.avgER > 0).sort((a, b) => b.avgER - a.avgER),
    bySaves:    [...creators].sort((a, b) => b.saves    - a.saves),
    byReach:    [...creators].filter(c => c.reach > 0).sort((a, b) => b.reach - a.reach),
    // Extra field rankings
    byExtra: Object.fromEntries(
      extraKeys.map(k => [
        k,
        [...creators].sort((a, b) => (b.extras[k] || 0) - (a.extras[k] || 0)),
      ])
    ),
  };
}

// ── Answer generator ──────────────────────────────────────────

function generateAnswer(campaignName, stats, goals) {
  if (!stats) return `**${campaignName}** — no data found.`;

  const { totals, byLikes, byViews, byER, bySaves, byReach,
          creators, extraKeys, extraTotals, byExtra, hasStandardMetrics } = stats;
  const lines = [];

  // Header
  lines.push(`**${campaignName}** — ${totals.posts} post${totals.posts !== 1 ? 's' : ''}, ${creators.length} creator${creators.length !== 1 ? 's' : ''}`);

  // ── If no standard metrics: show extra numeric columns instead ──
  if (!hasStandardMetrics) {
    if (extraKeys.length) {
      lines.push(`- *Standard columns (likes/views/etc.) not detected. Showing available numeric data:*`);
      for (const k of extraKeys) {
        const ranked = byExtra[k];
        if (extraTotals[k] > 0 && ranked.length) {
          lines.push(`- **${k}**: total **${fmt(extraTotals[k])}** · top creator: **${ranked[0].username}** (${fmt(ranked[0].extras[k])})`);
        }
      }
    } else {
      lines.push(`- No numeric data detected in this file. Check that the file has metric columns.`);
    }
    if (goals?.trim()) lines.push(`\n*Goals: "${goals.trim().slice(0, 120)}"*`);
    return lines.join('\n');
  }

  // ── Keyword detection ─────────────────────────────────────────
  const asksER      = /engagement.?rate|er\b|engag/i.test(goals);
  const asksViews   = /view|watch|play|impression/i.test(goals);
  const asksLikes   = /like|heart|reaction/i.test(goals);
  const asksReach   = /reach|audience|account/i.test(goals);
  const asksSaves   = /save|bookmark/i.test(goals);
  const asksWorst   = /worst|lowest|least|bottom|weakest/i.test(goals);
  const asksCompare = /compar|vs\b|versus|against|rank/i.test(goals);
  const asksAvg     = /average|avg|typical|normal|overall/i.test(goals);
  const asksTotal   = /total|sum|all together|combined/i.test(goals);
  const hasGoal     = asksER || asksViews || asksLikes || asksReach || asksSaves;

  // ── Answer specific questions ─────────────────────────────────

  if (asksER) {
    if (byER.length) {
      lines.push(`- Best engagement rate: **${byER[0].username}** at **${pct(byER[0].avgER)}**`);
      if (asksWorst && byER.length > 1)
        lines.push(`- Lowest engagement rate: **${byER[byER.length - 1].username}** at **${pct(byER[byER.length - 1].avgER)}**`);
      if (byER.length > 1 && asksCompare)
        lines.push(`- Others: ${byER.slice(1, 4).map(c => `${c.username} (${pct(c.avgER)})`).join(', ')}`);
      if (totals.avgER > 0)
        lines.push(`- Campaign avg ER: **${pct(totals.avgER)}** — ${erLabel(totals.avgER)}`);
    } else {
      lines.push(`- No engagement rate data found.`);
    }
  }

  if (asksViews) {
    if (totals.views > 0) {
      lines.push(`- Most views: **${byViews[0].username}** with **${fmt(byViews[0].views)}**`);
      if (asksWorst && byViews.length > 1)
        lines.push(`- Fewest views: **${byViews[byViews.length - 1].username}** with **${fmt(byViews[byViews.length - 1].views)}**`);
      if (asksTotal) lines.push(`- Total views: **${fmt(totals.views)}**`);
      if (asksAvg)   lines.push(`- Avg per post: **${fmt(Math.round(totals.views / totals.posts))}**`);
    } else {
      lines.push(`- No view data found.`);
    }
  }

  if (asksLikes) {
    if (totals.likes > 0) {
      lines.push(`- Most likes: **${byLikes[0].username}** with **${fmt(byLikes[0].likes)}**`);
      if (asksWorst && byLikes.length > 1)
        lines.push(`- Fewest likes: **${byLikes[byLikes.length - 1].username}** with **${fmt(byLikes[byLikes.length - 1].likes)}**`);
      if (asksTotal) lines.push(`- Total likes: **${fmt(totals.likes)}**`);
    } else {
      lines.push(`- No like data found.`);
    }
  }

  if (asksReach) {
    if (totals.reach > 0) {
      lines.push(`- Highest reach: **${byReach[0].username}** with **${fmt(byReach[0].reach)}**`);
      if (asksTotal) lines.push(`- Total reach: **${fmt(totals.reach)}**`);
    } else {
      lines.push(`- No reach data found.`);
    }
  }

  if (asksSaves) {
    if (totals.saves > 0)
      lines.push(`- Most saves: **${bySaves[0].username}** with **${fmt(bySaves[0].saves)}**`);
    else
      lines.push(`- No save data found.`);
  }

  if (asksCompare && !asksER) {
    const ranked = byLikes.slice(0, 6).map((c, i) =>
      `${i + 1}. **${c.username}** — ${fmt(c.likes)} likes${c.avgER > 0 ? ', ' + pct(c.avgER) + ' ER' : ''}${totals.views > 0 ? ', ' + fmt(c.views) + ' views' : ''}`
    );
    lines.push(`\n**Ranking:**\n${ranked.join('\n')}`);
  }

  // ── General overview (no goal detected) ──────────────────────

  if (!hasGoal) {
    if (totals.likes > 0 || totals.comments > 0)
      lines.push(`- **${fmt(totals.likes)} likes** · **${fmt(totals.comments)} comments**${totals.saves ? ' · **' + fmt(totals.saves) + ' saves**' : ''}`);
    if (totals.views > 0)
      lines.push(`- **${fmt(totals.views)} views**${totals.reach ? ' · **' + fmt(totals.reach) + '** reach' : ''}`);
    if (totals.avgER > 0)
      lines.push(`- Avg engagement rate: **${pct(totals.avgER)}** — ${erLabel(totals.avgER)}`);
    if (byLikes.length && totals.likes > 0)
      lines.push(`- Top by likes: **${byLikes[0].username}** (${fmt(byLikes[0].likes)})`);
    if (byER.length)
      lines.push(`- Top by engagement rate: **${byER[0].username}** (${pct(byER[0].avgER)})`);
    if (byViews.length && totals.views > 0)
      lines.push(`- Top by views: **${byViews[0].username}** (${fmt(byViews[0].views)})`);
    // Also show extra numeric fields if present
    for (const k of extraKeys) {
      if (extraTotals[k] > 0) {
        const top = byExtra[k][0];
        lines.push(`- **${k}** total: ${fmt(extraTotals[k])} · top: **${top.username}** (${fmt(top.extras[k])})`);
      }
    }
  }

  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function pct(r) {
  return (r * 100).toFixed(2) + '%';
}

function erLabel(r) {
  return r >= 0.06 ? 'excellent' : r >= 0.03 ? 'good' : r >= 0.01 ? 'average' : 'below average';
}
