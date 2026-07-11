/* form.js — 956 Woodworks Commission Request
 *
 * The exported form's Send button opens a mailto: (unreliable on phones/webmail,
 * so leads were being lost). This intercepts the click before that runs and
 * POSTs the request to Web3Forms, which emails it to 956woodwork@gmail.com.
 * Shows inline success/validation feedback and keeps the "email me directly"
 * fallback. The source submitForm has the same behavior for future re-exports.
 */
(function () {
  var ACCESS_KEY = 'd4fe1e0a-bd30-4257-94ff-f921f5935338';
  var CONTACT_EMAIL = '956woodwork@gmail.com';
  var sending = false;

  // Commission inspiration-photo upload (optional). Photos upload client-side
  // to ImgBB (free) and their links ride along in the Web3Forms message.
  var IMGBB_KEY = 'YOUR_IMGBB_KEY'; // public upload key — replace with real ImgBB key
  var ALLOWED = /^image\/(jpe?g|png|webp|heic)$/i;
  var MAX_PHOTOS = 5, MAX_BYTES = 10 * 1024 * 1024;
  var photos = [];   // { id, file, url, status:'uploading'|'ready'|'error', objUrl, promise }
  var photoSeq = 0;

  function fields(scope) {
    return {
      name: scope.querySelector('input[placeholder="Your name"]'),
      email: scope.querySelector('input[placeholder="Your email"]'),
      type: scope.querySelector('select:not(#ww-budget)'),
      budget: scope.querySelector('#ww-budget'),
      msg: scope.querySelector('textarea')
    };
  }

  // Optional budget range + "text me photos" hint. Injected siblings survive
  // the DC runtime's re-renders (listeners don't, but neither needs one); the
  // enhance loop below re-injects if a future render ever drops them.
  var BUDGETS = ['Budget (optional)', 'Under $200', '$200 – $500', '$500 – $1,500', '$1,500+', 'Not sure yet'];
  function enhanceForm() {
    var type = document.querySelector('select:not(#ww-budget)');
    var ta = document.querySelector('textarea');
    if (!type || !ta || type.parentElement !== ta.parentElement) return;
    if (!document.getElementById('ww-budget')) {
      var b = type.cloneNode(false); // copies the input styling, not the options
      b.removeAttribute('data-dc-tpl');
      b.id = 'ww-budget';
      b.setAttribute('aria-label', 'Budget range (optional)');
      for (var i = 0; i < BUDGETS.length; i++) {
        var o = document.createElement('option');
        o.value = i === 0 ? '' : BUDGETS[i];
        o.textContent = BUDGETS[i];
        b.appendChild(o);
      }
      ta.parentElement.insertBefore(b, ta);
    }
    if (!document.getElementById('ww-photo-hint')) {
      var p = document.createElement('p');
      p.id = 'ww-photo-hint';
      p.style.cssText = 'margin:-6px 0 14px;font-family:Manrope,sans-serif;font-size:13px;color:#968D80;';
      p.innerHTML = 'Have inspiration photos? Text them to ' +
        '<a href="sms:9562921696" style="color:#C6A15B;text-decoration:none;">956-292-1696</a>' +
        ' — it helps me quote faster.';
      ta.parentElement.insertBefore(p, ta.nextSibling);
    }
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
          '<div id="ww-photo-prompt"><span style="color:#C9A24B;font-size:16px;letter-spacing:1px;">＋</span> Drag photos here or tap to add <span style="opacity:.7">— optional</span></div>' +
          '<div id="ww-photo-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px"></div>';
        anchor.parentNode.insertBefore(zone, anchor.nextSibling);
      }
    }
    // "Text Me" next to the DM on Instagram CTA, cloned so it matches.
    if (!document.getElementById('ww-sms-btn')) {
      var dm = null, as = document.querySelectorAll('a');
      for (var j = 0; j < as.length; j++) {
        if (/dm on instagram/i.test(as[j].textContent || '')) { dm = as[j]; break; }
      }
      if (dm) {
        var sms = dm.cloneNode(false);
        sms.removeAttribute('data-dc-tpl');
        sms.id = 'ww-sms-btn';
        sms.href = 'sms:9562921696';
        sms.removeAttribute('target');
        sms.removeAttribute('rel');
        sms.textContent = 'Text Me';
        dm.parentElement.insertBefore(sms, dm);
      }
    }
  }

  function noteEl(btn) {
    var row = btn.parentElement;
    return row && row.querySelector('p');
  }
  function say(btn, text, color) {
    var p = noteEl(btn);
    if (p) { p.textContent = text; p.style.color = color || '#968D80'; }
  }

  // ── Commission photo upload helpers ──────────────────────────────────────
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

  // Refresh the now-inaccurate "Opens your email app" helper text once present.
  function fixHelper() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      if (!/send request/i.test(btns[i].textContent || '')) continue;
      var p = noteEl(btns[i]);
      if (p && /opens your email app/i.test(p.textContent || '')) {
        p.innerHTML = 'Sent straight to my inbox &mdash; or write me directly at ' +
          '<a href="mailto:' + CONTACT_EMAIL + '" style="color:#C6A15B;text-decoration:none;">' + CONTACT_EMAIL + '</a>';
      }
    }
  }
  var hn = 0, ht = setInterval(function () {
    fixHelper();
    enhanceForm();
    if (++hn > 30) {
      clearInterval(ht);
      setInterval(enhanceForm, 10000); // maintenance: re-inject if a re-render drops the extras
    }
  }, 500);

  function isContactSendButton(btn) {
    if (!btn || !/send request|sending|sent/i.test(btn.textContent || '')) return false;
    var row = btn.parentElement;
    return !!(row && /email me directly|956woodwork/i.test(row.textContent || ''));
  }

  async function submit(btn) {
    if (sending) return;
    var scope = (btn.closest && btn.closest('section')) || document;
    var f = fields(scope);
    var name = (f.name && f.name.value || '').trim();
    var email = (f.email && f.email.value || '').trim();
    var type = (f.type && f.type.value || '').trim();
    var budget = (f.budget && f.budget.value || '').trim();
    var msg = (f.msg && f.msg.value || '').trim();

    if (!name || !email || !msg) { say(btn, 'Please add your name, email, and a message.', '#E0A33A'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say(btn, 'That email address looks off — mind checking it?', '#E0A33A'); return; }

    if (photos.length) {
      say(btn, 'Finishing photo uploads…', '#968D80');
      await Promise.race([
        Promise.all(photos.map(function (p) { return p.promise || Promise.resolve(); })),
        new Promise(function (res) { setTimeout(res, 15000); })
      ]);
    }
    var photoLinks = photos.filter(function (p) { return p.status === 'ready' && p.url; }).map(function (p) { return p.url; });

    sending = true;
    var orig = btn.textContent;
    btn.textContent = 'Sending…';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';

    try {
      var res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: 'Commission request' + (name ? ' from ' + name : ''),
          from_name: name,
          name: name,
          email: email,
          piece_type: type,
          budget: budget || '(not specified)',
          message: msg + (photoLinks.length ? '\n\nInspiration photos:\n' + photoLinks.join('\n') : ''),
          photo_links: photoLinks.join('\n')
        })
      });
      var j = await res.json();
      if (j && j.success) {
        var first = name.split(' ')[0];
        say(btn, 'Thanks, ' + first + '! Your request was sent — I’ll be in touch soon.', '#8FBF6F');
        btn.textContent = 'Sent ✓';
        if (f.name) f.name.value = '';
        if (f.email) f.email.value = '';
        if (f.budget) f.budget.value = '';
        if (f.msg) f.msg.value = '';
        photos.forEach(function (p) { if (p.objUrl) URL.revokeObjectURL(p.objUrl); });
        photos = []; renderThumbs();
      } else {
        say(btn, 'Sorry, that didn’t go through. Please email me directly at ' + CONTACT_EMAIL + '.', '#E07A5A');
        btn.textContent = orig;
      }
    } catch (err) {
      say(btn, 'Sorry, that didn’t go through. Please email me directly at ' + CONTACT_EMAIL + '.', '#E07A5A');
      btn.textContent = orig;
    } finally {
      sending = false;
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
    }
  }

  // Capture phase so this runs before the component's mailto handler.
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('button');
    if (!isContactSendButton(btn)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    submit(btn);
  }, true);

  bindPhotoHandlers();
})();
