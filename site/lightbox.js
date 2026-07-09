/* lightbox.js — 956 Woodworks
 *
 * Tap/click a photo to view it enlarged in an overlay, with prev/next, Escape,
 * arrow keys, and backdrop-to-close. Photos live inside image-slot shadow DOM;
 * we read the rendered <img> source (the full, uncropped image). Skips the hero
 * background and the before/after comparison images. Prev/next browses the
 * other photos in the same section. Loaded on index.html + gallery.html.
 *
 * Hi-res on demand: the gallery grid loads fast ~660px photos. Slots listed in
 * .image-slots.gallery.hires.json have a crisp 1200px version at
 * hires/<id>.webp. The lightbox shows the 660px instantly, then swaps in the
 * hi-res file once it loads — so page loads stay light and only opened photos
 * pull their hi-res copy. Falls back silently if the manifest/file is absent.
 */
(function () {
  var SKIP = { 'ww-hero': 1, 'ww-about': 1, 'ww-about-room': 1, 'ww-loader': 1 };
  var HIRES_MANIFEST = '.image-slots.gallery.hires.json';

  // Lazily-loaded set of slot ids that have a hi-res file (fetched on first open).
  var hiresSet = null, hiresP = null;
  function loadManifest() {
    if (hiresP) return hiresP;
    hiresP = fetch(HIRES_MANIFEST)
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (a) { hiresSet = {}; (a || []).forEach(function (id) { hiresSet[id] = 1; }); })
      .catch(function () { hiresSet = {}; });
    return hiresP;
  }
  function hiresUrl(slot) {
    return (slot && hiresSet && hiresSet[slot.id]) ? 'hires/' + slot.id + '.webp' : null;
  }

  function imgOf(s) { return s.shadowRoot && s.shadowRoot.querySelector('.frame img'); }
  function srcOf(s) { var i = imgOf(s); return i && (i.currentSrc || i.src); }
  function eligible(s) {
    return s && s.tagName === 'IMAGE-SLOT' && s.hasAttribute('data-filled') &&
      !SKIP[s.id] && !(s.closest && s.closest('a')) && srcOf(s);
  }
  function groupOf(slot) {
    var scope = (slot.closest && slot.closest('section')) || document;
    return [].slice.call(scope.querySelectorAll('image-slot')).filter(eligible);
  }

  var ov, imgEl, countEl, capEl, group = [], idx = 0, renderToken = 0;

  // Piece category from the gallery card's caption (e.g. "Custom Furniture");
  // home-page photos have no captions and show none.
  function capOf(slot) {
    var item = slot.closest && slot.closest('.g-item');
    var c = item && item.querySelector('.g-cap');
    return c ? c.textContent.trim().replace(/\s+/g, ' ') : '';
  }

  function ensure() {
    if (ov) return;
    ov = document.createElement('div');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Photo viewer');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:rgba(12,9,7,.95);opacity:0;transition:opacity .22s ease;touch-action:none;';
    var btn = 'border:0;cursor:pointer;color:#EDE7DE;background:rgba(255,255,255,.07);border-radius:999px;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML =
      '<button data-lb="close" aria-label="Close" style="' + btn + 'position:absolute;top:16px;right:18px;width:46px;height:46px;font-size:24px;">&times;</button>' +
      '<button data-lb="prev" aria-label="Previous" style="' + btn + 'position:absolute;left:14px;top:50%;transform:translateY(-50%);width:50px;height:50px;font-size:28px;">&#8249;</button>' +
      '<button data-lb="next" aria-label="Next" style="' + btn + 'position:absolute;right:14px;top:50%;transform:translateY(-50%);width:50px;height:50px;font-size:28px;">&#8250;</button>' +
      '<div data-lb="cap" style="position:absolute;bottom:44px;left:0;right:0;text-align:center;color:#EDE7DE;font:400 17px/1.3 \'Cormorant Garamond\',Georgia,serif;letter-spacing:.5px;"></div>' +
      '<div data-lb="count" style="position:absolute;bottom:20px;left:0;right:0;text-align:center;color:#C6A15B;font:600 12px/1 system-ui,sans-serif;letter-spacing:2px;"></div>' +
      '<img data-lb="img" alt="956 Woodworks piece" style="max-width:92vw;max-height:80vh;object-fit:contain;border-radius:6px;box-shadow:0 24px 70px rgba(0,0,0,.65);">';
    document.body.appendChild(ov);
    imgEl = ov.querySelector('[data-lb=img]');
    countEl = ov.querySelector('[data-lb=count]');
    capEl = ov.querySelector('[data-lb=cap]');
    ov.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-lb');
      if (a === 'close' || e.target === ov) close();
      else if (a === 'prev') go(-1);
      else if (a === 'next') go(1);
    });
  }

  function preload(slot) { var u = hiresUrl(slot); if (u) { var i = new Image(); i.src = u; } }

  function render() {
    var slot = group[idx];
    var token = ++renderToken;
    // Show the fast grid image immediately (from cache) ...
    imgEl.src = srcOf(slot) || '';
    var cap = capOf(slot);
    capEl.textContent = cap;
    imgEl.alt = cap ? cap + ' — handcrafted by 956 Woodworks' : '956 Woodworks piece';
    var multi = group.length > 1;
    ov.querySelector('[data-lb=prev]').style.display = multi ? 'flex' : 'none';
    ov.querySelector('[data-lb=next]').style.display = multi ? 'flex' : 'none';
    countEl.textContent = multi ? (idx + 1) + ' / ' + group.length : '';
    // ... then upgrade to the crisp hi-res file once it has loaded, unless the
    // user has already navigated to another photo.
    var hu = hiresUrl(slot);
    if (hu) {
      var pre = new Image();
      pre.onload = function () { if (token === renderToken) imgEl.src = hu; };
      pre.src = hu;
    }
    if (multi) { preload(group[(idx + 1) % group.length]); preload(group[(idx - 1 + group.length) % group.length]); }
  }
  function go(d) { if (group.length) { idx = (idx + d + group.length) % group.length; render(); } }

  function open(slot) {
    ensure();
    group = groupOf(slot);
    idx = Math.max(0, group.indexOf(slot));
    render();
    // Manifest may not be loaded on the very first open; re-render once it is so
    // the first-opened photo also upgrades to hi-res.
    loadManifest().then(function () { if (ov && ov.style.display === 'flex') render(); });
    ov.style.display = 'flex';
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(function () { ov.style.opacity = '1'; });
  }
  function close() {
    if (!ov) return;
    ov.style.opacity = '0';
    document.documentElement.style.overflow = '';
    setTimeout(function () { if (ov) ov.style.display = 'none'; }, 220);
  }

  document.addEventListener('click', function (e) {
    if (ov && ov.style.display === 'flex') return; // overlay handles its own clicks
    var slot = e.target && e.target.closest && e.target.closest('image-slot');
    if (!slot && e.composedPath) {
      var p = e.composedPath();
      for (var i = 0; i < p.length; i++) { if (p[i].tagName === 'IMAGE-SLOT') { slot = p[i]; break; } }
    }
    if (!eligible(slot)) return;
    open(slot);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!ov || ov.style.display !== 'flex') return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
  });
})();
