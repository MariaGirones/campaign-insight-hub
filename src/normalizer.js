/**
 * normalizer.js
 * Feature 2 — Data Normalization
 *
 * Takes raw CSV rows (any column naming convention) and maps them
 * into a consistent internal schema used by every downstream feature.
 *
 * Internal schema per post row:
 * {
 *   username      : string   — e.g. "@influencer_a"
 *   instagramId   : string   — numeric account ID
 *   postUrl       : string   — full instagram.com/p/... URL
 *   postId        : string   — short code, e.g. "ABC111"
 *   campaign      : string   — campaign name / label
 *   date          : string   — ISO date string
 *   likes         : number
 *   comments      : number
 *   views         : number
 *   saves         : number
 *   shares        : number
 *   reach         : number
 *   impressions   : number
 *   engagementRate: number   — ratio 0–1 (calculated if not present)
 *   _raw          : Object   — original row preserved for debugging
 * }
 */

// ── Field alias map ────────────────────────────────────────────
// Keys are the internal field names; values are arrays of possible
// CSV column names (case-insensitive, spaces/underscores ignored).

const FIELD_ALIASES = {
  username:       ['username', 'user', 'handle', 'creator', 'influencer', 'account'],
  instagramId:    ['instagram_id', 'instagramid', 'ig_id', 'user_id', 'userid', 'account_id'],
  postUrl:        ['post_url', 'posturl', 'url', 'link', 'post_link', 'permalink'],
  postId:         ['post_id', 'postid', 'shortcode', 'short_code', 'media_id', 'id'],
  campaign:       ['campaign', 'campaign_name', 'campaignname', 'project', 'brand'],
  date:           ['date', 'post_date', 'published', 'published_at', 'created_at', 'timestamp'],
  likes:          ['likes', 'like_count', 'likecount', 'hearts', 'reactions'],
  comments:       ['comments', 'comment_count', 'commentcount', 'replies'],
  views:          ['views', 'view_count', 'viewcount', 'plays', 'video_views', 'videoviews'],
  saves:          ['saves', 'save_count', 'savecount', 'bookmarks'],
  shares:         ['shares', 'share_count', 'sharecount', 'reposts'],
  reach:          ['reach', 'unique_reach', 'accounts_reached'],
  impressions:    ['impressions', 'impression_count', 'total_impressions'],
  engagementRate: ['engagement_rate', 'engagementrate', 'er', 'eng_rate'],
};

// ── Helpers ────────────────────────────────────────────────────

/** Normalise a column header for fuzzy matching */
function normalizeKey(str) {
  return str.toLowerCase().replace(/[\s_\-\.]+/g, '');
}

/**
 * Build a lookup map: normalizedHeader → internalFieldName
 * @param {string[]} headers
 * @returns {Object}
 */
function buildHeaderMap(headers) {
  const map = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const key = normalizeKey(alias);
      // If a CSV header matches, record it
      const match = headers.find(h => normalizeKey(h) === key);
      if (match && !map[match]) {
        map[match] = field;
      }
    }
  }
  return map;
}

/** Parse a numeric string, stripping %, commas, spaces */
function toNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  const clean = String(val).replace(/[,%\s]/g, '');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/** Ensure username starts with @ */
function normalizeUsername(val) {
  if (!val) return '';
  const s = String(val).trim();
  return s.startsWith('@') ? s : `@${s}`;
}

/** Extract post short-code from a URL if postId is missing */
function extractPostId(postUrl) {
  if (!postUrl) return '';
  const match = postUrl.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}

// ── Core normalizer ────────────────────────────────────────────

/**
 * Normalize a single raw row object into the internal schema.
 * @param {Object} raw
 * @param {Object} headerMap  — output of buildHeaderMap()
 * @returns {Object}
 */
function normalizeRow(raw, headerMap) {
  // Map raw fields → internal fields
  const mapped = {};
  for (const [csvHeader, value] of Object.entries(raw)) {
    const field = headerMap[csvHeader];
    if (field) mapped[field] = value;
  }

  const postUrl = String(mapped.postUrl ?? '').trim();
  const postId  = String(mapped.postId  ?? '').trim() || extractPostId(postUrl);

  const likes       = toNumber(mapped.likes);
  const comments    = toNumber(mapped.comments);
  const views       = toNumber(mapped.views);
  const saves       = toNumber(mapped.saves);
  const shares      = toNumber(mapped.shares);
  const reach       = toNumber(mapped.reach);
  const impressions = toNumber(mapped.impressions);

  // Engagement rate: use raw value if provided, otherwise calculate
  let engagementRate = toNumber(mapped.engagementRate);
  if (engagementRate === 0) {
    const denominator = reach || views || impressions;
    if (denominator > 0) {
      engagementRate = (likes + comments + saves + shares) / denominator;
    }
  } else if (engagementRate > 1) {
    // Convert percentage (e.g. 4.5 → 0.045)
    engagementRate = engagementRate / 100;
  }

  return {
    username:       normalizeUsername(mapped.username),
    instagramId:    String(mapped.instagramId ?? '').trim(),
    postUrl,
    postId,
    campaign:       String(mapped.campaign    ?? '').trim(),
    date:           String(mapped.date        ?? '').trim(),
    likes,
    comments,
    views,
    saves,
    shares,
    reach,
    impressions,
    engagementRate: Math.round(engagementRate * 10000) / 10000, // 4 decimal places
    _raw: raw,
  };
}

/**
 * Detect which unmapped headers contain numeric data by sampling rows.
 * Returns an array of column names that are numeric.
 * @param {string[]} unmappedHeaders
 * @param {Object[]} rows
 * @returns {string[]}
 */
// Non-values that should not count as "filled" when detecting column types
const EMPTY_VALUES = new Set(['', 'n/a', 'na', 'null', 'undefined', '-', '--']);

function isFilledValue(v) {
  return !EMPTY_VALUES.has(String(v).toLowerCase().trim());
}

function detectNumericColumns(unmappedHeaders, rows) {
  const sample = rows.slice(0, 20);
  return unmappedHeaders.filter(header => {
    const values = sample
      .map(r => String(r[header] ?? '').replace(/[,%\s]/g, ''))
      .filter(isFilledValue);
    if (!values.length) return false;
    const numericCount = values.filter(v => !isNaN(parseFloat(v))).length;
    return numericCount / values.length >= 0.75;
  });
}

/**
 * Normalize an entire CSV parse result.
 * All columns from the file are preserved in each normalized row.
 * Known columns are mapped to internal schema fields.
 * Unknown numeric columns are converted to numbers.
 * Unknown text columns are kept as strings.
 *
 * @param {{ headers: string[], rows: Object[] }} csvResult
 * @param {string} [campaignName]  — if provided, overrides the campaign field
 *   in every row (campaign name is always the uploaded filename).
 * @returns {{
 *   normalizedRows: Object[],
 *   headerMap: Object,
 *   detectedNumericFields: string[],
 *   detectedTextFields: string[]
 * }}
 */
export function normalizeData(csvResult, campaignName) {
  const { headers, rows } = csvResult;
  const headerMap = buildHeaderMap(headers);

  const mappedCsvHeaders    = new Set(Object.keys(headerMap));
  const unmappedHeaders     = headers.filter(h => !mappedCsvHeaders.has(h));
  const detectedNumericFields = detectNumericColumns(unmappedHeaders, rows);
  const detectedTextFields    = unmappedHeaders.filter(h => !detectedNumericFields.includes(h));

  const normalizedRows = rows.map(row => {
    const base = normalizeRow(row, headerMap);

    // Campaign name is always the filename — override whatever was in the CSV
    if (campaignName) base.campaign = campaignName;

    // Attach every extra column so nothing is lost
    for (const col of detectedNumericFields) {
      base[col] = toNumber(row[col]);
    }
    for (const col of detectedTextFields) {
      base[col] = String(row[col] ?? '').trim();
    }

    return base;
  });

  return { normalizedRows, headerMap, detectedNumericFields, detectedTextFields };
}

/**
 * Return a human-readable summary of what was mapped / unmapped.
 * @param {Object} headerMap
 * @param {string[]} unmappedHeaders
 * @returns {string}
 */
export function normalizationSummary(headerMap, unmappedHeaders) {
  const mapped = Object.values(headerMap);
  const lines = [
    `Mapped fields (${mapped.length}): ${[...new Set(mapped)].join(', ')}`,
  ];
  if (unmappedHeaders.length) {
    lines.push(`Unmapped columns (${unmappedHeaders.length}): ${unmappedHeaders.join(', ')}`);
  }
  return lines.join('\n');
}
