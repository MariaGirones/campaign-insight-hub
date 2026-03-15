/**
 * worker.js — runs in a background thread
 * Receives a File, reads and parses it, posts result back.
 * The main thread stays fully responsive throughout.
 */

function parseLine(line) {
  const fields = [];
  const chars  = [];
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { chars.push('"'); i++; }
      else inQuotes = !inQuotes;
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

self.onmessage = async function (e) {
  try {
    const file = e.data.file;
    const text = await file.text();

    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g,   '\n')
      .split('\n')
      .filter(l => l.trim() !== '');

    if (!lines.length) {
      self.postMessage({ ok: false, error: 'The file appears to be empty.' });
      return;
    }

    const headers = parseLine(lines[0]);
    if (!headers.length || headers.every(h => h === '')) {
      self.postMessage({ ok: false, error: 'Could not read column headers.' });
      return;
    }

    const rows    = [];
    const rawRows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      rawRows.push(values);
      const row = {};
      headers.forEach((h, k) => { row[h] = values[k] ?? ''; });
      rows.push(row);
    }

    self.postMessage({ ok: true, headers, rows, rawRows });

  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};
