/**
 * missingDetector.js
 * Feature 6 — Missing Data Detection
 *
 * Given a campaign, compares the list of creators that SHOULD have
 * submitted analytics (the "roster") against those that HAVE posts
 * stored in the system.
 *
 * The roster can come from two sources (checked in order):
 *   1. A separate "roster" CSV the user uploads (username/id list).
 *   2. The creators already stored across ALL campaigns — used to
 *      detect who participated in other campaigns but is missing
 *      from a specific one.
 *
 * Output per campaign:
 * {
 *   campaign    : string           — campaign name
 *   submitted   : CreatorRecord[]  — have at least one post
 *   missing     : MissingRecord[]  — expected but no post found
 *   submittedPct: number           — 0-100
 * }
 *
 * MissingRecord:
 * {
 *   username   : string
 *   instagramId: string
 *   reason     : 'no_posts' | 'no_data'
 * }
 */

import { loadCampaigns, loadCreators, loadPosts } from './store.js';

// ── Core detector ──────────────────────────────────────────────

/**
 * Analyse all stored campaigns for missing creator data.
 * @returns {Object[]}  array of campaign reports
 */
export function detectMissing() {
  const campaigns = loadCampaigns();
  const creators  = loadCreators();
  const posts     = loadPosts();

  const creatorIndex = Object.fromEntries(creators.map(c => [c.id, c]));

  return campaigns.map(camp => {
    // All creators who are expected to have contributed to this campaign
    const expected = camp.creatorIds.map(id => creatorIndex[id]).filter(Boolean);

    // Check which expected creators have at least one post in this campaign
    const submitted = [];
    const missing   = [];

    for (const creator of expected) {
      const hasPosts = posts.some(
        p => p.creatorId === creator.id && p.campaign === camp.name
      );

      if (hasPosts) {
        submitted.push(creator);
      } else {
        missing.push({
          username:    creator.username    || '—',
          instagramId: creator.instagramId || '—',
          id:          creator.id,
          reason:      'no_posts',
        });
      }
    }

    const total        = expected.length;
    const submittedPct = total > 0 ? Math.round((submitted.length / total) * 100) : 0;

    return {
      campaign:     camp.name,
      total,
      submitted,
      missing,
      submittedPct,
    };
  });
}

/**
 * Run missing detection against a manually provided roster list.
 * The roster is an array of normalized rows from a "roster CSV"
 * that only contains usernames / instagram IDs (no metrics required).
 *
 * @param {string}   campaignName
 * @param {Object[]} rosterRows   — normalized rows from a roster upload
 * @returns {Object}  single campaign report
 */
export function detectMissingFromRoster(campaignName, rosterRows) {
  const posts    = loadPosts();
  const creators = loadCreators();
  const creatorIndex = Object.fromEntries(creators.map(c => [c.id, c]));

  const submitted = [];
  const missing   = [];

  for (const row of rosterRows) {
    const username    = String(row.username    ?? '').toLowerCase().replace(/^@/, '');
    const instagramId = String(row.instagramId ?? '').trim();

    // Find the stored creator matching this roster entry
    const creator = creators.find(c =>
      (instagramId && c.instagramId === instagramId) ||
      (username    && c.username?.toLowerCase().replace(/^@/, '') === username)
    );

    const hasPosts = creator
      ? posts.some(p => p.creatorId === creator.id && p.campaign === campaignName)
      : false;

    if (hasPosts && creator) {
      submitted.push(creator);
    } else {
      missing.push({
        username:    row.username    || username || '—',
        instagramId: row.instagramId || instagramId || '—',
        id:          creator?.id ?? null,
        reason:      creator ? 'no_posts' : 'no_data',
      });
    }
  }

  const total        = rosterRows.length;
  const submittedPct = total > 0 ? Math.round((submitted.length / total) * 100) : 0;

  return { campaign: campaignName, total, submitted, missing, submittedPct };
}
