/* ui-polish.js — 956 Woodworks
 *
 * Two small UI upgrades for the deployed site (loaded on index.html and
 * gallery.html):
 *
 * 1. Mobile header spacing: at phone widths the wordmark runs into the phone
 *    pill. Scale the wordmark down and tighten the pill below 430px.
 * 2. Sticky "Commission a piece" pill on phones (home page only — it targets
 *    the #contact section): fades in after scrolling past the hero, hides
 *    again while the contact section is on screen.
 *
 * Same survival pattern as the other runtime fixes: injected nodes survive DC
 * re-renders, listeners go on document/window, and a slow tick re-injects if
 * anything is ever dropped.
 */
(function () {
  var CSS =
    '@media (max-width: 430px) {' +
    '  nav > a:first-child { transform: scale(.82); transform-origin: left center; }' +
    '  nav a[href^="tel:"] { font-size: 11px !important; padding: 8px 12px !important; }' +
    '}' +
    '#ww-sticky-cta {' +
    '  position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px));' +
    '  transform: translateX(-50%) translateY(90px);' +
    '  z-index: 999999; display: none;' +
    '  background: #C9A24B; color: #17130F;' +
    '  font: 600 12px/1 Manrope, system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase;' +
    '  padding: 15px 28px; border-radius: 999px; text-decoration: none;' +
    '  box-shadow: 0 8px 28px rgba(0,0,0,.5);' +
    '  opacity: 0; pointer-events: none;' +
    '  transition: transform .28s ease, opacity .28s ease;' +
    '}' +
    '#ww-sticky-cta.ww-on { transform: translateX(-50%) translateY(0); opacity: 1; pointer-events: auto; }' +
    '@media (max-width: 768px) { #ww-sticky-cta { display: block; } }';

  function ensure() {
    if (!document.getElementById('ww-ui-polish-css')) {
      var st = document.createElement('style');
      st.id = 'ww-ui-polish-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    if (document.getElementById('contact') && !document.getElementById('ww-sticky-cta')) {
      var a = document.createElement('a');
      a.id = 'ww-sticky-cta';
      a.href = '#contact';
      a.textContent = 'Commission a piece';
      document.body.appendChild(a);
    }
  }

  function update() {
    var cta = document.getElementById('ww-sticky-cta');
    if (!cta) return;
    var contact = document.getElementById('contact');
    var contactVisible = false;
    if (contact) {
      var r = contact.getBoundingClientRect();
      contactVisible = r.top < window.innerHeight && r.bottom > 0;
    }
    var on = window.scrollY > 600 && !contactVisible;
    cta.classList.toggle('ww-on', on);
  }

  // Smooth-scroll instead of the default jump. Delegated: survives re-renders.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('#ww-sticky-cta');
    if (!a) return;
    var contact = document.getElementById('contact');
    if (contact) {
      e.preventDefault();
      contact.scrollIntoView({ behavior: 'smooth' });
    }
  });

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });

  ensure();
  update();
  var n = 0;
  var t = setInterval(function () {
    ensure();
    update();
    if (++n >= 10) {
      clearInterval(t);
      setInterval(ensure, 10000);
    }
  }, 1500);
})();
