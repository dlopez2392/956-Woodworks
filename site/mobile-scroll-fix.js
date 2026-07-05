/* mobile-scroll-fix.js — 956 Woodworks
 *
 * The deployed DC export embeds image-slot.js as a gzipped blob in its bundler
 * manifest, so the source fix (image-slot.js: `.frame img { touch-action:pan-y }`)
 * won't take effect until the next re-export. Until then every filled photo's
 * <img> still computes touch-action:none inside its shadow DOM, which stops
 * mobile users from scrolling the page by swiping on a photo (a real problem
 * when an image fills the screen).
 *
 * This injects an override <style> into each image-slot shadow root so touches
 * on photos scroll the page vertically again. It is idempotent and stays
 * harmless once the source fix ships (pan-y == pan-y). Safe on any page.
 */
(function () {
  var CSS = '.frame img{touch-action:pan-y !important}';

  function patch() {
    var slots = document.querySelectorAll('image-slot');
    for (var i = 0; i < slots.length; i++) {
      var sr = slots[i].shadowRoot;
      if (!sr || sr.__touchFixed) continue;
      var st = document.createElement('style');
      st.textContent = CSS;
      sr.appendChild(st);
      sr.__touchFixed = true;
    }
  }

  patch();
  // Slots can hydrate a little after first paint; re-sweep briefly, then stop.
  var n = 0;
  var t = setInterval(function () { patch(); if (++n > 40) clearInterval(t); }, 1000);
  document.addEventListener('DOMContentLoaded', patch);
  window.addEventListener('load', patch);
})();
