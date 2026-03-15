/** Escape HTML to prevent XSS */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Main entry — render everything */
export function renderResults(dupes, headers, rows, selectedCols) {
  const totalDupeValues = Object.values(dupes).reduce((s, a) => s + a.length, 0);
  const colsAffected    = Object.values(dupes).filter(a => a.length > 0).length;

  // Build a set of row indices that are affected (0-based)
  const dupeRowSet = buildDupeRowSet(dupes, rows, selectedCols);

  renderSummary(totalDupeValues, dupeRowSet.size, colsAffected, selectedCols.length);
  renderDetail(dupes, selectedCols);
  document.getElementById('results-table-wrap').innerHTML = '';
}

/** Summary stat strip at the top */
function renderSummary(totalDupeValues, affectedRows, colsAffected, colsChecked) {
  const el       = document.getElementById('results-summary');
  const hasDupes = totalDupeValues > 0;

  if (!hasDupes) {
    el.innerHTML = `
      <div class="summary-card clean">
        <div class="summary-clean-msg">
          No duplicates found &mdash; all ${colsChecked} column${colsChecked !== 1 ? 's' : ''} are clean.
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="summary-card has-dupes">
      <div class="summary-stat">
        <div class="stat-num">${totalDupeValues}</div>
        <div class="stat-label">Duplicate values</div>
      </div>
      <div class="summary-stat">
        <div class="stat-num">${affectedRows}</div>
        <div class="stat-label">Affected rows</div>
      </div>
      <div class="summary-stat">
        <div class="stat-num">${colsAffected}</div>
        <div class="stat-label">Column${colsAffected !== 1 ? 's' : ''} affected</div>
      </div>
    </div>`;
}

/** One card per column that has duplicates */
function renderDetail(dupes, selectedCols) {
  const el = document.getElementById('results-detail');
  el.innerHTML = '';

  for (const col of selectedCols) {
    const entries = dupes[col] ?? [];
    if (!entries.length) continue;

    const type = detectTypeFromName(col);

    const card = document.createElement('div');
    card.className = 'dupe-card';
    card.innerHTML = `
      <div class="dupe-card-head">
        <span class="dupe-col-name">${esc(col)}</span>
        ${type ? `<span class="type-badge type-${type}">${type}</span>` : ''}
        <span class="dupe-count">${entries.length} duplicate${entries.length !== 1 ? 's' : ''}</span>
      </div>
      <ul class="dupe-list">
        ${entries.map(e => `
          <li class="dupe-item">
            <span class="dupe-value">${esc(e.original)}</span>
            <span class="dupe-times">&times;${e.count}</span>
            <span class="dupe-rows">rows ${e.rowIndices.join(', ')}</span>
          </li>`).join('')}
      </ul>`;
    el.appendChild(card);
  }
}

/** Full data table showing only affected rows with fixed columns: #, name, e-mail, username */
function renderTable(headers, rows, dupes, selectedCols, dupeRowSet) {
  const wrap = document.getElementById('results-table-wrap');

  if (!dupeRowSet.size) {
    wrap.innerHTML = '';
    return;
  }

  // Map: column → Set of lowercased duplicate values (for highlight)
  const dupeValSets = {};
  for (const col of selectedCols) {
    dupeValSets[col] = new Set((dupes[col] ?? []).map(e => e.original.toLowerCase()));
  }

  // Build fixed display columns: name · e-mail · username (instagram/tiktok/username)
  // Label comes from the type, not the raw PDF column name.
  const typeLabel = { name: 'name', email: 'e-mail', instagram: 'username', tiktok: 'username', username: 'username' };
  const seen = new Set();
  const displayCols = [];
  for (const h of headers) {
    const t = detectTypeFromName(h);
    if (!t || seen.has(t)) continue; // one column per type max (skip duplicates)
    seen.add(t);
    displayCols.push({ label: typeLabel[t], col: h });
  }
  // Fall back to selected columns if nothing detected
  if (!displayCols.length) {
    selectedCols.forEach(c => displayCols.push({ label: c, col: c }));
  }

  const displayRows = [...dupeRowSet].sort((a, b) => a - b);
  const MAX_ROWS    = 200;
  const shown       = displayRows.slice(0, MAX_ROWS);
  const capped      = displayRows.length > MAX_ROWS;

  wrap.innerHTML = `
    <div class="table-label">
      Affected rows (${displayRows.length}${capped ? `, showing first ${MAX_ROWS}` : ''})
    </div>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th>
            ${displayCols.map(c => `<th>${esc(c.label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${shown.map(i => {
            const row   = rows[i];
            const cells = displayCols.map(({ col }) => {
              const val    = row[col] !== undefined ? String(row[col]) : '';
              const isDupe = dupeValSets[col]?.has(val.trim().toLowerCase());
              return `<td class="${isDupe ? 'cell-dupe' : ''}">${esc(val)}</td>`;
            }).join('');
            return `<tr class="row-dupe"><td class="row-num">${i + 2}</td>${cells}</tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

/** Build set of 0-based row indices that have at least one duplicate value */
function buildDupeRowSet(dupes, rows, selectedCols) {
  const set = new Set();
  for (const col of selectedCols) {
    const dupeVals = new Set((dupes[col] ?? []).map(e => e.original.toLowerCase()));
    rows.forEach((row, i) => {
      const val = String(row[col] ?? '').trim().toLowerCase();
      if (val && dupeVals.has(val)) set.add(i);
    });
  }
  return set;
}

/** Re-derive semantic type from column name (mirrors duplicateFinder logic) */
function detectTypeFromName(header) {
  const h = header.toLowerCase().replace(/[\s_\-]/g, '');
  if (/name|nombre|creator|influencer/.test(h))           return 'name';
  if (/email|mail|correo/.test(h))                       return 'email';
  if (/instagram|^ig$/.test(h))                          return 'instagram';
  if (/tiktok|^tt$/.test(h))                             return 'tiktok';
  if (/username|usuario|handle|user|account/.test(h))    return 'username';
  return null;
}
