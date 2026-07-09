#!/usr/bin/env node
// Build on-demand hi-res lightbox assets for the gallery.
//
// Source of truth: .image-slots.gallery.hires.state.json at repo root
//   { "<slot-id>": "data:image/webp;base64,...", ... }  (1200px masters)
//
// Emits into site/:
//   hires/<slot-id>.webp                  real webp files (lightbox loads on demand)
//   .image-slots.gallery.hires.json       manifest: ["gal-208", ...] ids that have hi-res
//
// The gallery grid still loads the fast 660px state file; lightbox.js fetches
// the manifest once (tiny) and swaps in hires/<id>.webp only when a photo with
// a hi-res version is opened. Run after changing the hi-res masters.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MASTER = path.join(ROOT, '.image-slots.gallery.hires.state.json');
const SITE = path.join(ROOT, 'site');
const HIRES_DIR = path.join(SITE, 'hires');

if (!fs.existsSync(MASTER)) { console.error('missing', MASTER); process.exit(1); }
const masters = JSON.parse(fs.readFileSync(MASTER, 'utf8'));

fs.mkdirSync(HIRES_DIR, { recursive: true });
// clean stale files
for (const f of fs.readdirSync(HIRES_DIR)) if (f.endsWith('.webp')) fs.unlinkSync(path.join(HIRES_DIR, f));

const ids = [];
let total = 0;
for (const [id, dataUrl] of Object.entries(masters)) {
  if (!/^data:image\/webp;base64,/.test(dataUrl)) { console.log('skip (not webp):', id); continue; }
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  fs.writeFileSync(path.join(HIRES_DIR, id + '.webp'), buf);
  ids.push(id);
  total += buf.length;
}
ids.sort();
fs.writeFileSync(path.join(SITE, '.image-slots.gallery.hires.json'), JSON.stringify(ids));
console.log(`Wrote ${ids.length} hires webp files (${(total / 1024 / 1024).toFixed(2)}MB total) + manifest.`);
console.log('ids:', ids.join(', '));
