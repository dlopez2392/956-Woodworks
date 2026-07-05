/* faq.js — 956 Woodworks
 *
 * Injects a "Common questions" accordion section between Care and Contact on the
 * home page. Content is static (approved by the shop). Built at runtime because
 * the DC export bundles the page markup; a re-export can fold this into the
 * source later. Matching FAQPage JSON-LD lives in index.html's static <head>
 * for Google rich results.
 */
(function () {
  var ITEMS = [
    ['How long does a custom piece take?',
     'Lead time depends on the piece and my current queue, but most commissions run about 3&ndash;6 weeks from approved design and deposit. Larger furniture and restorations can take longer &mdash; I&rsquo;ll give you a realistic timeline before we start.'],
    ['How does the commission process work?',
     'Reach out with what you have in mind, and we&rsquo;ll talk through size, wood, style, and budget. I confirm a quote and timeline, a deposit reserves your spot, then I build it (sharing progress along the way) with the balance due on completion.'],
    ['Do you require a deposit?',
     'Yes &mdash; a 50% deposit reserves your spot on the schedule and covers materials, with the balance due on completion. Deposits are non-refundable once materials have been purchased.'],
    ['What woods and finishes do you offer?',
     'Common species include walnut, oak, maple, mesquite, and cherry (others by request and availability). Finishes range from food-safe oil &amp; wax for kitchen goods to durable hardwax-oil or polyurethane for furniture &mdash; I&rsquo;ll recommend the best option for how the piece will be used.'],
    ['Do you ship, or is it local pickup?',
     'Local pickup in the Rio Grande Valley (the 956) is free, and local delivery may be available for larger pieces. Smaller items like bowls, boards, and kitchen goods can be shipped at cost &mdash; just ask and I&rsquo;ll quote it.'],
    ['Can you build to my exact size or match existing furniture?',
     'Absolutely &mdash; custom sizing is the whole point. Send photos, measurements, and any inspiration, and I&rsquo;ll design around your space.'],
    ['Do you do restoration and repairs?',
     'Yes &mdash; refinishing, repairs, and bringing old or heirloom pieces back to life is a big part of what I do. Send photos and I&rsquo;ll tell you what&rsquo;s possible.'],
    ['How do I care for my piece?',
     'Every piece comes with care guidance, and there are full guides on this site for <a href="cutting-board-care.html">cutting boards</a>, <a href="rolling-pin-care.html">rolling pins</a>, and <a href="furniture-care.html">furniture &amp; woodwork</a>. A little oiling and gentle cleaning keeps it looking great for years.'],
    ['What payment methods do you accept?',
     'Cash, Cash App, Zelle, and PayPal.']
  ];

  var CSS =
    '#faq .faq-head{text-align:center;margin:0 auto clamp(36px,5vw,60px)}' +
    '#faq .faq-eyebrow{font-family:"Manrope",sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#C6A15B;font-weight:600;margin-bottom:16px}' +
    '#faq .faq-title{font-family:"Cormorant Garamond",serif;font-weight:400;font-size:clamp(34px,4.5vw,58px);line-height:1.05;margin:0;color:#EDE7DE}' +
    '#faq .faq-wrap{max-width:820px;margin:0 auto}' +
    '#faq .faq-item{border-bottom:1px solid rgba(237,231,222,.12)}' +
    '#faq .faq-q{width:100%;display:flex;align-items:center;justify-content:space-between;gap:20px;background:none;border:0;cursor:pointer;text-align:left;padding:26px 4px;color:#EDE7DE;font-family:"Cormorant Garamond",serif;font-size:clamp(20px,2.3vw,27px);font-weight:500;line-height:1.25;transition:color .2s}' +
    '#faq .faq-q:hover{color:#C6A15B}' +
    '#faq .faq-ic{flex:none;width:30px;height:30px;border-radius:999px;border:1px solid rgba(198,161,91,.5);color:#C6A15B;display:flex;align-items:center;justify-content:center;font-family:"Manrope",sans-serif;font-size:20px;line-height:1;transition:transform .3s ease,background .2s}' +
    '#faq .faq-q[aria-expanded=true] .faq-ic{transform:rotate(45deg);background:rgba(198,161,91,.12)}' +
    '#faq .faq-a{overflow:hidden;max-height:0;transition:max-height .35s cubic-bezier(.16,1,.3,1)}' +
    '#faq .faq-a-inner{padding:0 4px 28px;color:#B7AE9F;font-family:"Manrope",sans-serif;font-size:15px;line-height:1.7;max-width:66ch}' +
    '#faq .faq-a-inner a{color:#C6A15B;text-decoration:none;border-bottom:1px solid rgba(198,161,91,.35)}' +
    '#faq .faq-a-inner a:hover{border-bottom-color:#C6A15B}';

  function build() {
    if (document.getElementById('faq')) return true;
    var care = document.getElementById('care');
    var contact = document.getElementById('contact');
    if (!care || !contact || care.parentElement !== contact.parentElement) return false;

    var style = document.createElement('style');
    style.setAttribute('data-faq', '');
    style.textContent = CSS;
    document.body.appendChild(style);

    var sec = document.createElement('section');
    sec.id = 'faq';
    sec.setAttribute('data-screen-label', 'FAQ');
    sec.style.cssText = 'max-width:1320px;margin:0 auto;padding:clamp(80px,12vw,150px) clamp(20px,5vw,64px)';

    var html = '<div class="faq-head"><div class="faq-eyebrow">Good to know</div>' +
               '<h2 class="faq-title">Common questions</h2></div><div class="faq-wrap">';
    for (var i = 0; i < ITEMS.length; i++) {
      html += '<div class="faq-item">' +
        '<button class="faq-q" aria-expanded="false"><span>' + ITEMS[i][0] + '</span><span class="faq-ic" aria-hidden="true">+</span></button>' +
        '<div class="faq-a"><div class="faq-a-inner">' + ITEMS[i][1] + '</div></div>' +
        '</div>';
    }
    html += '</div>';
    sec.innerHTML = html;
    contact.parentElement.insertBefore(sec, contact);

    var qs = sec.querySelectorAll('.faq-q');
    qs.forEach(function (q) {
      q.addEventListener('click', function () {
        var isOpen = q.getAttribute('aria-expanded') === 'true';
        qs.forEach(function (o) {
          o.setAttribute('aria-expanded', 'false');
          o.nextElementSibling.style.maxHeight = '0';
        });
        if (!isOpen) {
          q.setAttribute('aria-expanded', 'true');
          var panel = q.nextElementSibling;
          panel.style.maxHeight = panel.scrollHeight + 'px';
        }
      });
    });
    window.addEventListener('resize', function () {
      sec.querySelectorAll('.faq-q[aria-expanded=true]').forEach(function (q) {
        q.nextElementSibling.style.maxHeight = q.nextElementSibling.scrollHeight + 'px';
      });
    });
    return true;
  }

  var n = 0, t = setInterval(function () { if (build() || ++n > 60) clearInterval(t); }, 300);
})();
