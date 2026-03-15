/**
 * csvParser.js
 * Parses a CSV string into an array of row objects.
 * Handles quoted fields, commas inside quotes, and Windows line endings.
 * Processing is chunked so the browser stays responsive on large files.
 */

/**
 * Parse a single CSV line respecting quoted fields.
 * Uses array + join instead of string concat to avoid O(n²) allocation.
 */
function parseLine(line) {
  const fields = [];
  const chars  = [];
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        chars.push('"');
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(chars.join('').trim());
      chars.length = 0;
    } else {
      chars.push(ch);
    }
  }

  fields.push(chars.join('').trim());
  return fields;
}

/**
 * Parse a full CSV string asynchronously.
 * Yields to the browser every CHUNK rows so the tab never freezes.
 *
 * @param {string} csvText  Raw CSV content.
 * @returns {Promise<{ headers: string[], rows: Object[], rawRows: string[][] }>}
 */
export async function parseCSV(csvText) {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim() !== '');

  if (lines.length === 0) {
    throw new Error('The CSV file appears to be empty.');
  }

  const headers = parseLine(lines[0]);

  if (headers.length === 0 || headers.every(h => h === '')) {
    throw new Error('Could not read column headers from the file.');
  }

  const rows    = [];
  const rawRows = [];
  const CHUNK   = 500; // rows per batch before yielding

  for (let i = 1; i < lines.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, lines.length);

    for (let j = i; j < end; j++) {
      const values = parseLine(lines[j]);
      rawRows.push(values);

      const row = {};
      headers.forEach((h, k) => { row[h] = values[k] ?? ''; });
      rows.push(row);
    }

    // Give the browser a breath so it doesn't freeze
    await new Promise(r => setTimeout(r, 0));
  }

  return { headers, rows, rawRows };
}

/**
 * Read a File object and return its text content.
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsText(file, 'UTF-8');
  });
}
