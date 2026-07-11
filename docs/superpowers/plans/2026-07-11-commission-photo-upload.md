# Commission Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client attach up to 5 inspiration photos in the commission form; they upload to a free image host from the browser and their links arrive in the Web3Forms commission email.

**Architecture:** All logic lives in the existing runtime script `site/form.js` (the DC export bundles the form markup, so the upload UI is *injected* by `form.js` the same way the budget dropdown already is). Photos upload client-side to ImgBB and the resulting URLs are appended to the outgoing message. No backend, no build step.

**Tech Stack:** Vanilla ES5-style JS (matches existing `form.js`), ImgBB upload API (Cloudinary unsigned upload as fallback), Web3Forms (existing), verified via local `http-server` + Claude-in-Chrome page evaluation.

## Global Constraints

- Host: **ImgBB** primary (`https://api.imgbb.com/1/upload`, FormData `key`+`image`, returns `data.display_url`). Fallback: Cloudinary unsigned upload — swap only if ImgBB browser CORS fails.
- Public ImgBB upload key lives as a constant `IMGBB_KEY` in `site/form.js` (same pattern as `ACCESS_KEY`). Build/test with `'YOUR_IMGBB_KEY'`; owner drops in the real key.
- Limits: images only (`jpg|jpeg|png|webp|heic`), max **5** photos, max **10 MB** each.
- Photos are **optional** and must **never block** the inquiry.
- Survival pattern: injected DOM has stable ids; handlers delegated to `document`; re-injected by the existing maintenance tick (DC re-renders drop listeners, keep nodes).
- New payload: add `photo_links` field (newline-joined URLs) AND append the links to `message`.
- Verification is browser-based (local `http-server` + page eval). No unit-test harness exists.
- **Nothing deploys to production (push to `main`) without owner review.**

---

### Task 1: Inject the optional upload zone UI

**Files:**
- Modify: `site/form.js` (add constants + UI injection inside `enhanceForm()`)

**Interfaces:**
- Produces: DOM `#ww-photo-zone` containing `#ww-photo-input` (hidden file input), `#ww-photo-prompt`, `#ww-photo-thumbs`; module state `photos` array + `photoSeq`.

- [ ] **Step 1: Add module constants + state** near the top of the IIFE, after the existing `var sending = false;`:

```js
  var IMGBB_KEY = 'YOUR_IMGBB_KEY'; // public upload key — replace with real ImgBB key
  var ALLOWED = /^image\/(jpe?g|png|webp|heic)$/i;
  var MAX_PHOTOS = 5, MAX_BYTES = 10 * 1024 * 1024;
  var photos = [];   // { id, file, url, status:'uploading'|'ready'|'error', objUrl, promise }
  var photoSeq = 0;
```

- [ ] **Step 2: Inject the zone** — inside `enhanceForm()`, after the block that injects `#ww-photo-hint`, add:

```js
    if (!document.getElementById('ww-photo-zone')) {
      var taForZone = document.querySelector('textarea');
      var anchor = document.getElementById('ww-photo-hint') || taForZone;
      if (anchor && anchor.parentNode) {
        var zone = document.createElement('div');
        zone.id = 'ww-photo-zone';
        zone.setAttribute('role', 'button');
        zone.setAttribute('tabindex', '0');
        zone.setAttribute('aria-label', 'Add inspiration photos (optional)');
        zone.style.cssText = 'margin:0 0 14px;border:1.5px dashed rgba(201,162,75,.55);border-radius:8px;padding:16px;text-align:center;cursor:pointer;color:#968D80;font:14px Manrope,sans-serif;';
        zone.innerHTML =
          '<input id="ww-photo-input" type="file" accept="image/*" multiple style="display:none">' +
          '<div id="ww-photo-prompt"><span style="color:#C9A24B;font-size:18px">⌆</span> Drag photos here or tap to add <span style="opacity:.7">— optional</span></div>' +
          '<div id="ww-photo-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px"></div>';
        anchor.parentNode.insertBefore(zone, anchor.nextSibling);
      }
    }
```

- [ ] **Step 3: Verify render + survival.** Start `npx http-server site -p 8961 -c-1`; load `http://localhost:8961/index.html`; after ~8s eval:

```js
(() => {
  const z = document.getElementById('ww-photo-zone');
  const inp = document.getElementById('ww-photo-input');
  return { zone: !!z, input: !!inp, accept: inp && inp.accept, afterHint: z && z.previousElementSibling && z.previousElementSibling.id };
})()
```
Expected: `{ zone:true, input:true, accept:"image/*", afterHint:"ww-photo-hint" }`. Wait ~11s (through a DC maintenance tick) and re-eval; zone still present (not duplicated: `document.querySelectorAll('#ww-photo-zone').length === 1`).

- [ ] **Step 4: Commit**

```bash
git add site/form.js
git commit -m "feat(form): inject optional commission photo upload zone"
```

---

### Task 2: File selection, validation, thumbnails, remove

**Files:**
- Modify: `site/form.js` (add handlers + `handleFiles`, `renderThumbs`, `removePhoto`, `photoMsg`; bind once)

**Interfaces:**
- Consumes: `#ww-photo-zone`, `#ww-photo-input`, `#ww-photo-thumbs`, `photos`, `photoSeq` (Task 1).
- Produces: `handleFiles(FileList)`, `renderThumbs()`, `removePhoto(id)`, `photoMsg(text)`, `bindPhotoHandlers()`; each thumbnail carries a `[data-ww-rmphoto=<id>]` remove button. (Upload is stubbed here — status goes straight to `ready` so previews are testable without a key.)

- [ ] **Step 1: Add the helpers** at IIFE top level (after the existing helper functions):

```js
  function photoMsg(t) {
    var zone = document.getElementById('ww-photo-zone'); if (!zone) return;
    var m = document.getElementById('ww-photo-msg');
    if (!m) { m = document.createElement('div'); m.id = 'ww-photo-msg'; m.style.cssText = 'margin:6px 0 0;font-size:12px;color:#E0A33A;'; zone.appendChild(m); }
    m.textContent = t; clearTimeout(m._t); m._t = setTimeout(function () { if (m) m.textContent = ''; }, 4000);
  }

  function renderThumbs() {
    var c = document.getElementById('ww-photo-thumbs'); if (!c) return;
    c.innerHTML = photos.map(function (p) {
      var ring = p.status === 'error' ? '2px solid #E07A5A' : (p.status === 'ready' ? '2px solid #8FBF6F' : '1px solid rgba(237,231,222,.25)');
      var dim = p.status === 'uploading' ? 'opacity:.6;' : '';
      return '<div style="position:relative;width:64px;height:64px;border-radius:6px;overflow:hidden;border:' + ring + ';' + dim + '">' +
        '<img src="' + p.objUrl + '" alt="" style="width:100%;height:100%;object-fit:cover">' +
        (p.status === 'uploading' ? '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#EDE7DE;font-size:12px">…</div>' : '') +
        '<button type="button" data-ww-rmphoto="' + p.id + '" aria-label="Remove photo" style="position:absolute;top:-1px;right:-1px;width:18px;height:18px;border:0;border-radius:0 0 0 6px;background:rgba(23,19,15,.85);color:#EDE7DE;font-size:12px;line-height:1;cursor:pointer">×</button>' +
        '</div>';
    }).join('');
    var prompt = document.getElementById('ww-photo-prompt');
    if (prompt) prompt.style.display = photos.length ? 'none' : '';
  }

  function removePhoto(id) {
    for (var i = 0; i < photos.length; i++) { if (photos[i].id === id) { if (photos[i].objUrl) URL.revokeObjectURL(photos[i].objUrl); photos.splice(i, 1); break; } }
    renderThumbs();
  }

  function uploadOne(p) { p.status = 'ready'; p.url = 'stub://' + p.id; p.promise = Promise.resolve(); renderThumbs(); return p.promise; } // replaced in Task 3

  function handleFiles(list) {
    var files = [].slice.call(list || []);
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (photos.length >= MAX_PHOTOS) { photoMsg('Up to ' + MAX_PHOTOS + ' photos.'); break; }
      if (!ALLOWED.test(f.type)) { photoMsg('Images only (jpg, png, webp, heic).'); continue; }
      if (f.size > MAX_BYTES) { photoMsg('“' + f.name + '” is over 10 MB.'); continue; }
      var p = { id: 'p' + (++photoSeq), file: f, url: null, status: 'uploading', objUrl: URL.createObjectURL(f), promise: null };
      photos.push(p); renderThumbs(); uploadOne(p);
    }
  }

  var photoHandlersBound = false;
  function bindPhotoHandlers() {
    if (photoHandlersBound) return; photoHandlersBound = true;
    document.addEventListener('click', function (e) {
      var rm = e.target.closest && e.target.closest('[data-ww-rmphoto]');
      if (rm) { e.preventDefault(); e.stopPropagation(); removePhoto(rm.getAttribute('data-ww-rmphoto')); return; }
      var zone = e.target.closest && e.target.closest('#ww-photo-zone');
      if (zone) { var inp = document.getElementById('ww-photo-input'); if (inp) inp.click(); }
    });
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'ww-photo-input') { handleFiles(e.target.files); e.target.value = ''; }
    });
    document.addEventListener('dragover', function (e) { if (e.target.closest && e.target.closest('#ww-photo-zone')) e.preventDefault(); });
    document.addEventListener('drop', function (e) { var z = e.target.closest && e.target.closest('#ww-photo-zone'); if (z) { e.preventDefault(); handleFiles(e.dataTransfer.files); } });
  }
```

- [ ] **Step 2: Call `bindPhotoHandlers()`** once, at the same place the existing click/tick listeners are set up (top level of the IIFE, near the bottom):

```js
  bindPhotoHandlers();
```

- [ ] **Step 3: Verify validation + previews.** Reload `http://localhost:8961/index.html`; after hydration eval (synthesizes files without a real picker):

```js
(() => {
  function file(name, type, bytes) { const b = new Blob([new Uint8Array(bytes)], { type }); return new File([b], name, { type }); }
  // 2 valid + 1 wrong-type + 1 oversize
  const list = [file('a.jpg','image/jpeg',10), file('b.png','image/png',10), file('c.pdf','application/pdf',10), file('d.jpg','image/jpeg',11*1024*1024)];
  window.__wwHandle = null;
  // call the internal handler via a synthetic change on the input
  const inp = document.getElementById('ww-photo-input');
  const dt = new DataTransfer(); list.forEach(f => dt.items.add(f)); inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return null;
})()
```
Then eval: `document.querySelectorAll('#ww-photo-thumbs [data-ww-rmphoto]').length` → expected **2** (only the valid images). `document.getElementById('ww-photo-msg').textContent` → non-empty (last rejection message). `document.getElementById('ww-photo-prompt').style.display` → `"none"`.

- [ ] **Step 4: Verify remove.** Eval: click the first thumb's remove button, then count:

```js
(() => { const b = document.querySelector('#ww-photo-thumbs [data-ww-rmphoto]'); b.click(); return document.querySelectorAll('#ww-photo-thumbs [data-ww-rmphoto]').length; })()
```
Expected: **1**.

- [ ] **Step 5: Commit**

```bash
git add site/form.js
git commit -m "feat(form): photo selection, validation, thumbnails, remove"
```

---

### Task 3: Real background upload to ImgBB (+ failure handling)

**Files:**
- Modify: `site/form.js` (replace the stub `uploadOne` with the real ImgBB upload)

**Interfaces:**
- Consumes: `IMGBB_KEY`, `photos`, `renderThumbs` (Tasks 1–2).
- Produces: `uploadOne(p)` sets `p.url` (hosted URL) + `p.status` and stores `p.promise` (resolves when done, success or fail).

- [ ] **Step 1: Replace the stub `uploadOne`** with:

```js
  function uploadOne(p) {
    var fd = new FormData();
    fd.append('key', IMGBB_KEY);
    fd.append('image', p.file);
    p.promise = fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.success && j.data && (j.data.display_url || j.data.url)) { p.url = j.data.display_url || j.data.url; p.status = 'ready'; }
        else { p.status = 'error'; }
      })
      .catch(function () { p.status = 'error'; })
      .then(function () { renderThumbs(); });
    return p.promise;
  }
```

- [ ] **Step 2: Verify CORS + a real upload.** Temporarily set `IMGBB_KEY` to the owner's real key locally (do NOT commit the real key). Reload; add one real image via the picker manually (or the synthetic-file eval from Task 2 Step 3 but with real image bytes); after ~3s eval:

```js
(() => { const p = document.querySelectorAll('#ww-photo-thumbs > div'); const ring = p.length ? getComputedStyle(p[0]).borderColor : null; return { count: p.length, firstRing: ring }; })()
```
Expected: a thumbnail with a green-ish ring (status `ready`) and, in the Network tab / `performance.getEntriesByType('resource')`, a successful `api.imgbb.com/1/upload` POST. If the request is blocked by CORS, switch `uploadOne` to Cloudinary unsigned upload (`https://api.cloudinary.com/v1_1/<cloud>/image/upload`, FormData `file` + `upload_preset`, read `secure_url`) and re-verify. Revert `IMGBB_KEY` to `'YOUR_IMGBB_KEY'` before committing.

- [ ] **Step 3: Verify failure path.** With `IMGBB_KEY='YOUR_IMGBB_KEY'` (invalid), add an image; the upload returns `success:false` → thumbnail shows an error ring and the inquiry is still sendable. Eval after ~3s: first thumb border color is red-ish (`#E07A5A`).

- [ ] **Step 4: Commit**

```bash
git add site/form.js
git commit -m "feat(form): upload commission photos to ImgBB in background"
```

---

### Task 4: Submission integration, reset, mobile + regression

**Files:**
- Modify: `site/form.js` (extend `submit()` to await uploads and append links; extend success-reset to clear photos)

**Interfaces:**
- Consumes: `photos`, `say` (existing feedback helper), the existing Web3Forms POST in `submit()`.
- Produces: outgoing payload gains `photo_links`; `message` gets the links appended; success resets `photos`.

- [ ] **Step 1: Await uploads + collect links** — in `submit()`, immediately BEFORE the `sending = true;` line, add:

```js
    if (photos.length) {
      say(btn, 'Finishing photo uploads…', '#968D80');
      await Promise.race([
        Promise.all(photos.map(function (p) { return p.promise || Promise.resolve(); })),
        new Promise(function (res) { setTimeout(res, 15000); })
      ]);
    }
    var photoLinks = photos.filter(function (p) { return p.status === 'ready' && p.url; }).map(function (p) { return p.url; });
```

- [ ] **Step 2: Include links in the payload.** In the `JSON.stringify({ ... })` body, add after `message: msg,`... — change the `message` and add `photo_links`:

```js
          message: msg + (photoLinks.length ? '\n\nInspiration photos:\n' + photoLinks.join('\n') : ''),
          photo_links: photoLinks.join('\n'),
```
(Replace the existing `message: msg` line accordingly; keep all other fields.)

- [ ] **Step 3: Clear photos on success.** In the success branch (where `f.name.value=''` etc. run), add:

```js
        photos.forEach(function (p) { if (p.objUrl) URL.revokeObjectURL(p.objUrl); });
        photos = []; renderThumbs();
```

- [ ] **Step 4: Verify end-to-end** (real ImgBB key set locally). Fill name/email/message, add 1–2 real photos, wait for green rings, click Send. Expected: button shows "Finishing photo uploads…" then success message; a real email arrives at 956woodwork@gmail.com containing the inquiry AND working photo links; the form + thumbnails reset. Also send with an image whose upload failed — inquiry still sends, no photo link for that one. Revert key to placeholder before commit.

- [ ] **Step 5: Verify mobile layout + regression.** In a 390px same-origin iframe (project's method), the zone and thumbnails wrap cleanly; existing fields, budget dropdown, Text-Me button, validation, and success/reset still work.

- [ ] **Step 6: Commit**

```bash
git add site/form.js
git commit -m "feat(form): attach uploaded photo links to Web3Forms submission"
```

---

## Post-plan: activation + deploy (owner-gated)

- [ ] Owner pastes real `IMGBB_KEY` into `site/form.js`; commit.
- [ ] Final local end-to-end with the real key (email received with photo links).
- [ ] Owner review → push to `main` → verify live on 956woodworks.com.
- [ ] Update `CLAUDE.md` (note the photo-upload flow + ImgBB key location) and project memory.

## Self-review notes

- Spec coverage: approach (T3), UX zone/thumbnails/mobile (T1,T2,T4), limits (T2), submission `photo_links`+message (T4), failure never-blocks (T3,T4), config key (Global + T3), survival (T1 verify), out-of-scope respected (no per-photo notes). Covered.
- The stub `uploadOne` in T2 is intentional (lets previews be tested without a key) and is fully replaced in T3 — not a placeholder.
