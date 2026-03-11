/**
 * store.js
 * Feature 4 — Data Storage
 *
 * Persists creators, posts, and campaigns in localStorage so data
 * survives page refreshes and can be accumulated across multiple
 * CSV uploads.
 *
 * Storage keys:
 *   hub:creators   — Map<creatorId, CreatorRecord>
 *   hub:posts      — Map<postId, PostRecord>
 *   hub:campaigns  — Map<campaignName, CampaignRecord>
 *   hub:meta       — { lastSaved, totalUploads }
 *
 * All data is serialised as JSON.  The store never holds raw File
 * objects or _raw rows — only clean serialisable data.
 */

const KEYS = {
  creators:  'hub:creators',
  posts:     'hub:posts',
  campaigns: 'hub:campaigns',
  meta:      'hub:meta',
};

// ── Low-level helpers ──────────────────────────────────────────

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('[Store] Could not save to localStorage:', e.message);
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Persist an array of matched creator objects (from matcher.js).
 * Merges with existing data: new posts are added, existing records
 * are updated with the latest metrics.
 *
 * @param {Object[]} creators  — output of matchCreators()
 * @returns {{ savedCreators: number, savedPosts: number, savedCampaigns: number }}
 */
export function saveCreators(creators) {
  const creatorMap  = load(KEYS.creators);
  const postMap     = load(KEYS.posts);
  const campaignMap = load(KEYS.campaigns);

  for (const creator of creators) {
    // ── Upsert creator record ────────────────────────────────
    const existing = creatorMap[creator.id] ?? {};

    // Merge alias lists (union)
    const aliasSet = new Set([
      ...(existing.aliases ?? []),
      ...(creator.aliases  ?? []),
    ]);

    // Merge campaign lists (union)
    const campaignSet = new Set([
      ...(existing.campaigns ?? []),
      ...(creator.campaigns  ?? []),
    ]);

    creatorMap[creator.id] = {
      id:               creator.id,
      instagramId:      creator.instagramId || existing.instagramId || '',
      username:         creator.username    || existing.username    || '',
      aliases:          [...aliasSet],
      campaigns:        [...campaignSet],
      totalPosts:       creator.totalPosts,
      totalLikes:       creator.totalLikes,
      totalComments:    creator.totalComments,
      totalViews:       creator.totalViews,
      totalSaves:       creator.totalSaves,
      totalShares:      creator.totalShares,
      totalReach:       creator.totalReach,
      avgEngagementRate: creator.avgEngagementRate,
      lastUpdated:      new Date().toISOString(),
    };

    // ── Upsert each post ─────────────────────────────────────
    for (const post of creator.posts) {
      const postKey = post.postId || post.postUrl || `${creator.id}-${post.date}`;
      if (!postKey) continue;

      postMap[postKey] = {
        postId:        post.postId,
        postUrl:       post.postUrl,
        creatorId:     creator.id,
        username:      creator.username,
        campaign:      post.campaign,
        date:          post.date,
        likes:         post.likes,
        comments:      post.comments,
        views:         post.views,
        saves:         post.saves,
        shares:        post.shares,
        reach:         post.reach,
        impressions:   post.impressions,
        engagementRate: post.engagementRate,
        savedAt:       new Date().toISOString(),
      };

      // ── Upsert campaign record ───────────────────────────
      if (post.campaign) {
        const camp = campaignMap[post.campaign] ?? {
          name:        post.campaign,
          creatorIds:  [],
          postIds:     [],
          firstSeen:   new Date().toISOString(),
        };

        if (!camp.creatorIds.includes(creator.id)) {
          camp.creatorIds.push(creator.id);
        }
        if (!camp.postIds.includes(postKey)) {
          camp.postIds.push(postKey);
        }
        camp.lastUpdated = new Date().toISOString();
        campaignMap[post.campaign] = camp;
      }
    }
  }

  // ── Persist ───────────────────────────────────────────────
  save(KEYS.creators,  creatorMap);
  save(KEYS.posts,     postMap);
  save(KEYS.campaigns, campaignMap);

  // Update meta
  const meta = load(KEYS.meta);
  meta.lastSaved     = new Date().toISOString();
  meta.totalUploads  = (meta.totalUploads ?? 0) + 1;
  save(KEYS.meta, meta);

  return {
    savedCreators:  Object.keys(creatorMap).length,
    savedPosts:     Object.keys(postMap).length,
    savedCampaigns: Object.keys(campaignMap).length,
  };
}

/**
 * Load all stored creators as an array, sorted by totalReach desc.
 * @returns {Object[]}
 */
export function loadCreators() {
  const map = load(KEYS.creators);
  return Object.values(map).sort(
    (a, b) => (b.totalReach || b.totalViews || 0) - (a.totalReach || a.totalViews || 0)
  );
}

/**
 * Load all stored posts as an array.
 * @returns {Object[]}
 */
export function loadPosts() {
  return Object.values(load(KEYS.posts));
}

/**
 * Load all stored campaigns as an array.
 * @returns {Object[]}
 */
export function loadCampaigns() {
  return Object.values(load(KEYS.campaigns));
}

/**
 * Load store meta info.
 * @returns {{ lastSaved: string, totalUploads: number }}
 */
export function loadMeta() {
  return load(KEYS.meta);
}

/**
 * Find a post by postId, postUrl, or partial match.
 * @param {string} query
 * @returns {Object|null}
 */
export function findPost(query) {
  if (!query) return null;
  const q = query.trim();
  const posts = loadPosts();

  // Exact postId match
  let found = posts.find(p => p.postId === q);
  if (found) return found;

  // URL match — extract short code
  const urlMatch = q.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (urlMatch) {
    found = posts.find(p => p.postId === urlMatch[1]);
    if (found) return found;
  }

  // Partial postUrl match
  found = posts.find(p => p.postUrl && p.postUrl.includes(q));
  return found ?? null;
}

/**
 * Find a stored creator by username, instagramId, or postId.
 * @param {string} query
 * @returns {Object|null}
 */
export function findStoredCreator(query) {
  if (!query) return null;
  const q     = query.trim().toLowerCase().replace(/^@/, '');
  const creators = loadCreators();

  for (const c of creators) {
    if (c.instagramId === query) return c;
    if (c.username?.toLowerCase().replace(/^@/, '') === q) return c;
    if (c.aliases?.some(a => a.toLowerCase().replace(/^@/, '') === q)) return c;
  }

  // Fall back to post search
  const post = findPost(query);
  if (post) return creators.find(c => c.id === post.creatorId) ?? null;

  return null;
}

/**
 * Wipe all stored data.
 */
export function clearStore() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

/**
 * Return a summary object for display.
 * @returns {{ creators: number, posts: number, campaigns: number, lastSaved: string }}
 */
export function storeSummary() {
  const meta = loadMeta();
  return {
    creators:   Object.keys(load(KEYS.creators)).length,
    posts:      Object.keys(load(KEYS.posts)).length,
    campaigns:  Object.keys(load(KEYS.campaigns)).length,
    lastSaved:  meta.lastSaved ?? null,
    totalUploads: meta.totalUploads ?? 0,
  };
}
