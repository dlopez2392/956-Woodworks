#!/usr/bin/env node
// Sync the image-slot state from the editor source of truth (root
// .image-slots.state.json) into the deployable site/ folder.
//
// Run this after ANY image change in the DC editor or after re-exporting site/:
//   node tools/sync-image-state.js
//
// It writes:
//   site/.image-slots.state.json          full state (runtime fallback)
//   site/.image-slots.home.state.json     ww-* / process-* slots (index.html)
//   site/.image-slots.gallery.state.json  gal-* slots (gallery.html)
//   .image-slots.state.backup.json        safety copy (per CLAUDE.md)
//
// index.html and gallery.html carry an inline <head> script that redirects the
// runtime's fetch of .image-slots.state.json to their per-page file (falling
// back to the full file if the page file is missing). If the per-page files go
// STALE (this script not run after an image change), the live site shows OLD
// images — so always run this.
//
// Optional recompression: if `sharp` is resolvable, jpeg/png slot images are
// converted to webp (same dimensions, q80) when that makes them smaller.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const STATE = '.image-slots.state.json';

let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* recompression skipped */ }

(async () => {
  const state = JSON.parse(fs.readFileSync(path.join(ROOT, STATE), 'utf8'));
  const ids = Object.keys(state);
  console.log(`root state: ${ids.length} slots`);

  if (sharp) {
    let saved = 0, n = 0;
    for (const [id, v] of Object.entries(state)) {
      const u = typeof v === 'string' ? v : v.u;
      if (!u || !/^data:image\/(jpeg|png);/.test(u)) continue;
      const buf = Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
      const meta = await sharp(buf).metadata();
      const out = await sharp(buf).webp({ quality: 80, effort: 6 }).toBuffer();
      const om = await sharp(out).metadata();
      if (om.width !== meta.width || om.height !== meta.height || out.length >= buf.length) continue;
      const newU = 'data:image/webp;base64,' + out.toString('base64');
      if (typeof state[id] === 'string') state[id] = newU; else state[id].u = newU;
      saved += buf.length - out.length; n++;
    }
    if (n) {
      console.log(`recompressed ${n} jpeg/png slots to webp, saved ${(saved / 1024 / 1024).toFixed(2)}MB`);
      fs.writeFileSync(path.join(ROOT, STATE), JSON.stringify(state));
    }
  } else {
    console.log('sharp not installed — skipping jpeg/png -> webp recompression');
  }

  const home = {}, gallery = {};
  const unknown = [];
  for (const [id, v] of Object.entries(state)) {
    if (id.startsWith('gal-')) gallery[id] = v;
    else if (id.startsWith('ww-') || id.startsWith('process-')) home[id] = v;
    else { home[id] = v; gallery[id] = v; unknown.push(id); }
  }
  if (unknown.length) {
    console.log(`WARNING: unknown id prefixes put in BOTH page files: ${unknown.join(', ')}`);
  }

  fs.writeFileSync(path.join(SITE, STATE), JSON.stringify(state));
  fs.writeFileSync(path.join(SITE, '.image-slots.home.state.json'), JSON.stringify(home));
  fs.writeFileSync(path.join(SITE, '.image-slots.gallery.state.json'), JSON.stringify(gallery));
  fs.writeFileSync(path.join(ROOT, '.image-slots.state.backup.json'), JSON.stringify(state));

  const mb = f => (fs.statSync(f).size / 1024 / 1024).toFixed(2) + 'MB';
  console.log(`site full: ${mb(path.join(SITE, STATE))}`);
  console.log(`home (${Object.keys(home).length} slots): ${mb(path.join(SITE, '.image-slots.home.state.json'))}`);
  console.log(`gallery (${Object.keys(gallery).length} slots): ${mb(path.join(SITE, '.image-slots.gallery.state.json'))}`);
  console.log('backup updated: .image-slots.state.backup.json');
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
