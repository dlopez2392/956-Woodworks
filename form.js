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

  function fields(scope) {
    return {
      name: scope.querySelector('input[placeholder="Your name"]'),
      email: scope.querySelector('input[placeholder="Your email"]'),
      type: scope.querySelector('select'),
      msg: scope.querySelector('textarea')
    };
  }

  function noteEl(btn) {
    var row = btn.parentElement;
    return row && row.querySelector('p');
  }
  function say(btn, text, color) {
    var p = noteEl(btn);
    if (p) { p.textContent = text; p.style.color = color || '#6E665C'; }
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
  var hn = 0, ht = setInterval(function () { fixHelper(); if (++hn > 30) clearInterval(ht); }, 500);

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
    var msg = (f.msg && f.msg.value || '').trim();

    if (!name || !email || !msg) { say(btn, 'Please add your name, email, and a message.', '#E0A33A'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { say(btn, 'That email address looks off — mind checking it?', '#E0A33A'); return; }

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
          message: msg
        })
      });
      var j = await res.json();
      if (j && j.success) {
        var first = name.split(' ')[0];
        say(btn, 'Thanks, ' + first + '! Your request was sent — I’ll be in touch soon.', '#8FBF6F');
        btn.textContent = 'Sent ✓';
        if (f.name) f.name.value = '';
        if (f.email) f.email.value = '';
        if (f.msg) f.msg.value = '';
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
})();
