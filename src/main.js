/**
 * main.js
 * Application entry point.
 * Initialises all feature modules as they are built.
 */

import { initUploader } from './uploader.js';

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUploader();

  // Listen for parsed CSV data (future features will hook in here)
  document.addEventListener('csv:loaded', e => {
    console.log('[Campaign Hub] CSV loaded:', e.detail);
  });
});
