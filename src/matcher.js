/**
 * matcher.js
 * Feature 3 — Creator Matching Engine
 *
 * Takes an array of normalized post rows and groups them into
 * Creator profiles. Each creator is identified by one or more
 * of these signals (in priority order):
 *
 *   1. instagramId  — strongest, numeric account ID never changes
 *   2. username     — @handle, case-insensitive
 *   3. postId       — can backtrack a creator from a known post
 *
 * Output — an array of Creator objects:
 * {
 *   id           : string   — stable internal key (instagramId || username)
 *   instagramId  : string
 *   username     : string
 *   aliases      : string[] — all usernames seen for this creator
 *   campaigns    : string[] — distinct campaign names
 *   posts        : Object[] — all normalized post rows belonging to this creator
 *   totalPosts   : number
 *   totalLikes   : number
 *   totalComments: number
 *   totalViews   : number
 *   totalSaves   : number
 *   totalShares  : number
 *   totalReach   : number
 *   avgEngagementRate: number
 * }
 */

// ── Helpers ────────────────────────────────────────────────────

function cleanUsername(u) {
  return String(u ?? '').toLowerCase().replace(/^@/, '').trim();
}

function sum(arr, key) {
  return arr.reduce((acc, r) => acc + (r[key] || 0), 0);
}

function avg(arr, key) {
  const nonZero = arr.filter(r => r[key] > 0);
  if (!nonZero.length) return 0;
  return nonZero.reduce((acc, r) => acc + r[key], 0) / nonZero.length;
}

// ── Core matcher ───────────────────────────────────────────────

/**
 * Match normalized rows into creator profiles.
 * @param {Object[]} normalizedRows
 * @returns {Object[]} creators
 */
export function matchCreators(normalizedRows) {
  // Map: creatorKey → { instagramId, canonicalUsername, rows[] }
  const buckets = new Map();

  // Index maps for fast lookup
  const byId       = new Map(); // instagramId → creatorKey
  const byUsername = new Map(); // cleanUsername → creatorKey

  for (const row of normalizedRows) {
    const igId     = String(row.instagramId ?? '').trim();
    const username = cleanUsername(row.username);

    // ── 1. Try to find an existing bucket ─────────────────────
    let key = null;

    if (igId)     key = byId.get(igId)       ?? null;
    if (!key && username) key = byUsername.get(username) ?? null;

    // ── 2. Create a new bucket if none found ──────────────────
    if (!key) {
      key = igId || `@${username}` || `row-${buckets.size}`;
      buckets.set(key, {
        instagramId:       igId,
        canonicalUsername: username ? `@${username}` : '',
        usernameSet:       new Set(username ? [username] : []),
        campaignSet:       new Set(),
        rows:              [],
      });
    }

    const bucket = buckets.get(key);

    // ── 3. Merge new signals into the bucket ──────────────────
    if (igId && !bucket.instagramId) {
      bucket.instagramId = igId;
      byId.set(igId, key);
    }
    if (igId) byId.set(igId, key);

    if (username) {
      bucket.usernameSet.add(username);
      if (!bucket.canonicalUsername) {
        bucket.canonicalUsername = `@${username}`;
      }
      byUsername.set(username, key);
    }

    if (row.campaign) bucket.campaignSet.add(row.campaign);

    bucket.rows.push(row);
  }

  // ── 4. Build creator objects from buckets ─────────────────
  const creators = [];

  for (const [key, bucket] of buckets) {
    const rows = bucket.rows;
    const engRate = Math.round(avg(rows, 'engagementRate') * 10000) / 10000;

    creators.push({
      id:               key,
      instagramId:      bucket.instagramId,
      username:         bucket.canonicalUsername,
      aliases:          [...bucket.usernameSet].map(u => `@${u}`),
      campaigns:        [...bucket.campaignSet],
      posts:            rows,
      totalPosts:       rows.length,
      totalLikes:       sum(rows, 'likes'),
      totalComments:    sum(rows, 'comments'),
      totalViews:       sum(rows, 'views'),
      totalSaves:       sum(rows, 'saves'),
      totalShares:      sum(rows, 'shares'),
      totalReach:       sum(rows, 'reach'),
      avgEngagementRate: engRate,
    });
  }

  // Sort by total reach desc, then likes desc
  creators.sort((a, b) =>
    (b.totalReach || b.totalViews) - (a.totalReach || a.totalViews) ||
    b.totalLikes - a.totalLikes
  );

  return creators;
}

/**
 * Find a creator by username, instagramId, postId, or postUrl.
 * @param {Object[]} creators  — output of matchCreators()
 * @param {string}   query
 * @returns {Object|null}
 */
export function findCreator(creators, query) {
  if (!query) return null;
  const q = query.trim();

  // Check if query looks like a post URL
  const urlMatch = q.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  const postIdFromUrl = urlMatch ? urlMatch[1] : null;
  const searchPostId  = postIdFromUrl ?? q;

  const cleanQ = q.toLowerCase().replace(/^@/, '');

  for (const creator of creators) {
    // Match by instagramId
    if (creator.instagramId && creator.instagramId === q) return creator;

    // Match by username (any alias)
    if (creator.aliases.some(a => a.toLowerCase().replace(/^@/, '') === cleanQ)) {
      return creator;
    }

    // Match by postId (scan all posts)
    if (creator.posts.some(p => p.postId === searchPostId)) return creator;
  }

  return null;
}
