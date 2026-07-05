/* compare-slider.js — 956 Woodworks
 *
 * Fix for the homepage before/after slider ("In the room" / "Finished piece").
 * The exported DC runtime does not bind the slider handle's onPointerDown
 * template handler, so the divider never dragged. This is a self-contained
 * stopgap for the already-exported site/index.html: it captures the live DC
 * component instance and wires pointerdown on the compare container to the
 * component's own _compareDrag(), which updates state.comparePos — the single
 * source of truth — so drags survive the component's periodic re-renders.
 *
 * The source (956 Woodworks.dc.html) has the same fix inside componentDidMount
 * and sets window.__compareBound; when a future re-export includes it, this
 * script no-ops so nothing double-binds. Safe to load on any page.
 */
(function () {
  function ready() {
    var r = window.__dcRegistry;
    return r && r.Root && r.Root.Logic && r.Root.Logic.prototype;
  }

  function start() {
    if (window.__compareBound) return; // component already handles it

    var proto = window.__dcRegistry.Root.Logic.prototype;
    if (typeof proto.renderVals !== 'function') return;

    // The DC runtime doesn't expose the mounted instance, but renderVals() runs
    // on every render with `this` bound to it — grab it there.
    var inst = null;
    if (!proto.__cmpWrap) {
      proto.__cmpWrap = true;
      var orig = proto.renderVals;
      proto.renderVals = function () { inst = this; return orig.apply(this, arguments); };
    }

    var bound = false;
    function bind() {
      if (bound || !inst || !inst._compareEl) return;
      bound = true;
      inst._compareEl.addEventListener('pointerdown', function (e) {
        var h = inst._compareEl.querySelector('[style*=ew-resize]');
        if (h && (e.target === h || h.contains(e.target))) inst._compareDrag(e);
      });
    }

    // renderVals fires on the component's own ~1.2s and 6s re-renders; poll
    // until the instance (and its container ref) exist, then wire once.
    bind();
    var t = setInterval(function () { bind(); if (bound) clearInterval(t); }, 200);
    setTimeout(function () { clearInterval(t); }, 20000);
  }

  (function wait(n) {
    if (ready()) return start();
    if (n > 200) return;
    setTimeout(function () { wait(n + 1); }, 50);
  })(0);
})();
