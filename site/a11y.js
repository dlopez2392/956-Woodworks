/* a11y.js — 956 Woodworks
 *
 * Accessibility pass for the runtime-injected image-slot photos. The DC
 * bundle's <image-slot> renders <img> elements inside shadow DOM with no alt
 * text; this script derives a description from nearby page context and applies
 * it. Runs on index.html and gallery.html (the pages with image-slots).
 *
 * Alt sources, in order:
 *   - gallery page: the .g-item's .g-cap caption ("Custom Furniture", ...)
 *   - home page:    per-slot map / the closest section heading
 *   - fallback:     generic brand description
 *
 * The DC runtime re-renders patch DOM in place and never touch alt, but slots
 * hydrate late (after the state JSON fetch), so we re-apply a few times over
 * the first ~15s, same pattern as the other runtime fixes.
 */
(function () {
  var HOME_ALTS = {
    'ww-hero': 'Hand-turned wooden piece on a workbench at 956 Woodworks',
    'ww-about': 'Finished custom wood coffee table styled in a living room',
    'ww-about-room': 'Living room scene showing the space before the custom piece',
    'ww-cat-1': 'Custom furniture by 956 Woodworks',
    'ww-cat-2': 'Woodturned bowls by 956 Woodworks',
    'ww-cat-3': 'Handmade kitchen goods by 956 Woodworks',
    'ww-cat-4': 'Small-batch shop pieces by 956 Woodworks'
  };

  function altFor(slot) {
    if (HOME_ALTS[slot.id]) return HOME_ALTS[slot.id];
    var item = slot.closest ? slot.closest('.g-item') : null;
    var cap = item && item.querySelector('.g-cap');
    var t = cap && cap.textContent.trim().replace(/\s+/g, ' ');
    if (t) return t + ' — handcrafted by 956 Woodworks';
    if (/^process-/.test(slot.id)) return 'Woodworking process at the 956 Woodworks shop';
    if (/^ww-g/.test(slot.id)) return 'Recent handcrafted work by 956 Woodworks';
    return 'Handcrafted woodwork by 956 Woodworks';
  }

  function apply() {
    // The DC boot rebuilds <html> attributes, dropping the static lang="en" —
    // re-assert it (matters for screen reader pronunciation and SEO).
    if (document.documentElement.lang !== 'en') document.documentElement.lang = 'en';
    var slots = document.querySelectorAll('image-slot');
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i], r = s.shadowRoot;
      if (!r) continue;
      var imgs = r.querySelectorAll('img');
      if (!imgs.length) continue;
      // decorative loader slots: hide from the accessibility tree entirely
      if (s.id === 'ww-loader' || s.id === 'g-loader') {
        if (s.getAttribute('aria-hidden') !== 'true') s.setAttribute('aria-hidden', 'true');
        continue;
      }
      var alt = altFor(s);
      for (var j = 0; j < imgs.length; j++) {
        var img = imgs[j];
        if (img.classList.contains('ghost')) {
          // duplicate used for reframe preview — decorative
          if (img.alt !== '') img.alt = '';
          if (img.getAttribute('aria-hidden') !== 'true') img.setAttribute('aria-hidden', 'true');
        } else if (img.alt !== alt) {
          img.alt = alt;
        }
      }
    }
  }

  function labelForms() {
    // Commission form fields only carry placeholders (not announced reliably,
    // and gone once the user types) — mirror them into aria-label.
    var fields = document.querySelectorAll('input, textarea, select');
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.getAttribute('aria-label') || f.labels && f.labels.length) continue;
      if (f.tagName === 'SELECT') {
        f.setAttribute('aria-label', 'Type of piece');
      } else if (f.placeholder) {
        // textarea placeholder is a long prompt; shorten to its lead phrase
        var p = f.placeholder.split(/[—-]/)[0].trim();
        f.setAttribute('aria-label', p || f.placeholder);
      }
    }
  }

  var n = 0;
  var t = setInterval(function () {
    apply();
    labelForms();
    if (++n >= 10) clearInterval(t); // ~15s of retries covers late hydration
  }, 1500);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
