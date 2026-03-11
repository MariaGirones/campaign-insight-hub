/**
 * csvParser.js
 * Parses a CSV string into an array of row objects.
 * Handles quoted fields, commas inside quotes, and Windows line endings.
 */

/**
 * Parse a single CSV line respecting quoted fields.
 * @param {string} line
 * @returns {string[]}
 */
function parseLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // Escaped quote inside a quoted field: ""
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Parse a full CSV string.
 * @param {string} csvText  Raw CSV content.
 * @returns {{ headers: string[], rows: Object[], rawRows: string[][] }}
 */
export function parseCSV(csvText) {
  // Normalize line endings
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(line => line.trim() !== '');

  if (lines.length === 0) {
    throw new Error('The CSV file appears to be empty.');
  }

  const headers = parseLine(lines[0]);

  if (headers.length === 0 || headers.every(h => h === '')) {
    throw new Error('Could not read column headers from the file.');
  }

  const rawRows = [];
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    rawRows.push(values);

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }

  return { headers, rows, rawRows };
}

/**
 * Read a File object and return its text content.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read the file.'));
    reader.readAsText(file, 'UTF-8');
  });
}
