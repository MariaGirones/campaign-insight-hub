/**
 * search.js
 * Feature 5 — Creator Search Engine
 *
 * Searches the localStorage store (from store.js) for creators,
 * posts, or campaigns that match a free-text query.
 *
 * Accepted query formats:
 *   @username          — find creator by handle
 *   username           — same (@ is optional)
 *   123456789          — find creator by Instagram numeric ID
 *   instagram.com/p/X  — find post by URL
 *   ABC111             — find post by short-code / post ID
 *   Summer2025         — find all creators in a campaign
 *
 * Returns:
 * {
 *   type     : 'creator' | 'post' | 'campaign' | 'empty'
 *   query    : string
 *   creator  : Object | null       — matched creator record
 *   post     : Object | null       — matched post record (if query was a post)
 *   campaign : Object | null       — matched campaign record (if query was a campaign)
 *   allPosts : Object[]            — all posts belonging to the matched creator
 * }
 */

import { loadCreators, loadPosts, loadCampaigns } from './store.js';

// ── Helpers ────────────────────────────────────────────────────

function clean(s) {
  return String(s ?? '').toLowerCase().replace(/^@/, '').trim();
}

function extractShortCode(query) {
  const m = query.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : null;
}

function isNumericId(s) {
  return /^\d{6,}$/.test(s.trim());
}

// ── Core search ────────────────────────────────────────────────

/**
 * Run a search query against the store.
 * @param {string} rawQuery
 * @returns {Object} result
 */
export function search(rawQuery) {
  const query    = rawQuery.trim();
  const qClean   = clean(query);
  const shortCode = extractShortCode(query);

  if (!query) return empty(query);

  const creators  = loadCreators();
  const posts     = loadPosts();
  const campaigns = loadCampaigns();

  // ── 1. Post URL or short-code ─────────────────────────────
  const postId = shortCode ?? (isNumericId(query) ? null : null);
  if (shortCode) {
    const post = posts.find(p => p.postId === shortCode);
    if (post) {
      const creator = creators.find(c => c.id === post.creatorId) ?? null;
      return { type: 'post', query, creator, post, campaign: null, allPosts: creatorPosts(posts, creator) };
    }
  }

  // ── 2. Instagram numeric ID ───────────────────────────────
  if (isNumericId(query)) {
    const creator = creators.find(c => c.instagramId === query.trim());
    if (creator) {
      return { type: 'creator', query, creator, post: null, campaign: null, allPosts: creatorPosts(posts, creator) };
    }
    // Could also be a post ID that happens to be numeric
    const post = posts.find(p => p.postId === query.trim());
    if (post) {
      const creator2 = creators.find(c => c.id === post.creatorId) ?? null;
      return { type: 'post', query, creator: creator2, post, campaign: null, allPosts: creatorPosts(posts, creator2) };
    }
  }

  // ── 3. Username (@handle) ─────────────────────────────────
  const byUsername = creators.find(c =>
    clean(c.username) === qClean ||
    (c.aliases ?? []).some(a => clean(a) === qClean)
  );
  if (byUsername) {
    return { type: 'creator', query, creator: byUsername, post: null, campaign: null, allPosts: creatorPosts(posts, byUsername) };
  }

  // ── 4. Post ID (non-URL short-code like "ABC111") ─────────
  const byPostId = posts.find(p => p.postId === query || p.postId?.toLowerCase() === qClean);
  if (byPostId) {
    const creator = creators.find(c => c.id === byPostId.creatorId) ?? null;
    return { type: 'post', query, creator, post: byPostId, campaign: null, allPosts: creatorPosts(posts, creator) };
  }

  // ── 5. Campaign name ──────────────────────────────────────
  const byCampaign = campaigns.find(c => c.name.toLowerCase() === qClean);
  if (byCampaign) {
    const campCreators = creators.filter(c => byCampaign.creatorIds.includes(c.id));
    return { type: 'campaign', query, creator: null, post: null, campaign: byCampaign, allPosts: [], campCreators };
  }

  // ── 6. Partial / fuzzy fallback ───────────────────────────
  const partial = creators.filter(c =>
    clean(c.username).includes(qClean) ||
    (c.aliases ?? []).some(a => clean(a).includes(qClean))
  );
  if (partial.length === 1) {
    return { type: 'creator', query, creator: partial[0], post: null, campaign: null, allPosts: creatorPosts(posts, partial[0]) };
  }
  if (partial.length > 1) {
    return { type: 'multiple', query, creator: null, post: null, campaign: null, allPosts: [], results: partial };
  }

  return empty(query);
}

function creatorPosts(posts, creator) {
  if (!creator) return [];
  return posts.filter(p => p.creatorId === creator.id);
}

function empty(query) {
  return { type: 'empty', query, creator: null, post: null, campaign: null, allPosts: [] };
}
