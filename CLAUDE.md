# 956 Woodworks — persistent rules

## Image slots must NEVER be renumbered or reused
Every `<image-slot id="...">` (in Gallery.dc.html and elsewhere) stores its photo
in `.image-slots.state.json`, keyed by that exact id. This file is the ONLY
source of truth for uploaded photos.

- When adding new gallery items/slots, always use a fresh, never-before-used id
  (e.g. bump a counter like gal-201, gal-202, gal-203...). NEVER renumber or
  reassign existing slot ids, even when reordering, removing, or inserting items
  in the defs array — position-based ids (gal-1, gal-2... by array index) is
  what caused image mixups before. Ids must be permanent and stable for the
  life of the project.
- Before editing Gallery.dc.html's defs array, check `.image-slots.state.json`
  for which ids currently hold photos, and never delete or repurpose a filled id.
- Whenever exporting/bundling the site for deployment (Vercel, Hostinger, etc.),
  always copy `.image-slots.state.json` into the `site/` export folder too —
  the pages fetch it at runtime for images. Forgetting this makes all photos
  disappear on the deployed site even though nothing was lost.
- **After ANY image change or re-export, run `node tools/sync-image-state.js`.**
  Since the Jul 2026 performance pass the deployed pages fetch per-page state
  files (`site/.image-slots.home.state.json` = ww-*/process-* slots for
  index.html, `site/.image-slots.gallery.state.json` = gal-* slots for
  gallery.html) via an inline `<head>` fetch-redirect script; the full
  `site/.image-slots.state.json` remains as fallback only when a page file is
  MISSING — it does NOT protect against page files being STALE. Skipping the
  sync script after an image change means the live site keeps showing OLD
  images. The script copies root state → site/, splits per page, and updates
  the backup, all in one step.
- Keep `.image-slots.state.backup.json` up to date as an extra safety copy
  whenever the state file changes.
- The user has been burned multiple times by images "disappearing" (they were
  actually fine, just orphaned by id changes). Be extremely careful and
  conservative here — verify with an actual contact-sheet/visual check before
  telling the user anything is missing or restored.
