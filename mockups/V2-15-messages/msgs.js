/* Shared sample data for the V2-15 admin "Messages" mockups.
   Shape follows docs/design/V2-15-about-contact.md section "Admin page": date, name (optional), email,
   message (plain text), read flag. Newest first; the real list holds up to 200.
   Names, emails and texts are invented samples, not real people. */
var NOW = new Date('2026-11-16T14:00:00');
var CARD = '../../app/public/cards/';

var MSGS = [
  { id: 8, at: '2026-11-16T13:42:00', name: 'Lena Hartmann', email: 'lena.hartmann@example.de', read: true,
    text: 'Hi! The Series 27 page shows the Bogeyman twice when I sort by "Newest". Refreshing fixes it for a moment, then it comes back. Firefox 132 on Windows.' },
  { id: 7, at: '2026-11-16T09:15:00', name: '', email: 'brickfan_1987@example.com', read: false,
    text: 'Could you add the Dungeons & Dragons promo figure (the Szass Tam polybag)? It is not a CMF but everyone I know collects it with the series.' },
  { id: 6, at: '2026-11-15T21:03:00', name: 'Tomas Okafor', email: 'tomas.okafor@example.org', read: false,
    text: 'Long-time collector here, and I have to say this site is the first one that made me actually finish a series instead of giving up halfway.\n\nA bit of background: I started with Series 1 back in 2010, bought blind bags at the corner shop and felt every one of them for the shape of the accessories. By Series 10 I had a spreadsheet with 400 rows, three colours of highlighting and a tab nobody but me understood. When the boxes went cardboard in 2021 the feel-the-bag trick died and I mostly stopped.\n\nA friend sent me the link last month. The wanted list is exactly what I needed: I marked the 14 figures I am missing across Series 21 to 25, and on Saturday at the Brick Fair in Leeds I found 9 of them in one afternoon because I could just show my phone to the traders.\n\nTwo small wishes, only if they are easy:\n1. A way to note duplicates I have for swaps.\n2. A printable checklist per series, for fairs where the signal is bad.\n\nEither way, thank you for building this. It brought the fun back.' },
  { id: 5, at: '2026-11-14T17:48:00', name: 'Aiko Tanaka', email: 'aiko.t@example.jp', read: true,
    text: 'Small correction: in the Disney 100 series the figure listed as "Mrs. Incredible" is officially "Elastigirl" on the LEGO box (71038-14).' },
  { id: 4, at: '2026-11-12T08:30:00', name: 'Marco Bellini', email: 'marco.bellini@example.it', read: true,
    text: 'Is there a way to get an invite? My daughter and I collect together and would love to share one wanted list.' },
  { id: 3, at: '2026-11-09T19:22:00', name: 'Sophie Laurent', email: 's.laurent@example.fr', read: true,
    text: 'The new card art is beautiful. The round series frame with the head count is a really nice touch.' },
  { id: 2, at: '2026-11-04T12:05:00', name: 'Jon Price', email: 'jprice@example.co.uk', read: true,
    text: 'Telegram alert arrived twice for the same Nutcracker mark yesterday evening. Not a big deal, just letting you know.' },
  { id: 1, at: '2026-10-28T15:40:00', name: 'Dana Weiss', email: 'dana.weiss@example.com', read: true,
    text: 'Thank you! Found the last Series 24 figure thanks to your list.' }
];

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function who(m) { return m.name || m.email; }
function initial(m) { return (m.name || m.email).charAt(0).toUpperCase(); }
/* Three avatar tones, picked from the email so a sender keeps one colour */
function tone(m) { var h = 0; for (var i = 0; i < m.email.length; i++) h = (h * 31 + m.email.charCodeAt(i)) >>> 0; return ['', 't-ink', 't-y'][h % 3]; }
function ago(iso) {
  var m = Math.round((NOW - new Date(iso)) / 60000);
  if (m < 60) return m + ' min ago';
  var h = Math.round(m / 60);
  if (h < 24) return h + ' h ago';
  var d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : d + ' days ago';
}
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function stamp(iso) {
  var d = new Date(iso);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function short(iso) {
  var d = new Date(iso);
  if (NOW - d < 864e5 && d.getDate() === NOW.getDate()) return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return d.getDate() + ' ' + MONTHS[d.getMonth()];
}
function unread() { return MSGS.filter(function (m) { return !m.read; }).length; }
function mailto(m) { return 'mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent('Re: your message to Minifig Hunt'); }

/* Shared header band, same markup as Admin.tsx Band() */
function band(hero) {
  return '<header class="band"><div class="wrap"><div class="band-top">' +
    '<a class="brand" href="#"><span class="brand-mark"><img src="../../app/public/favicon.svg" alt="" width="36" height="36"></span>' +
    '<span><b>Minifig Hunt</b><small>Collectible Minifigures</small></span></a>' +
    '<span class="aw-tag">Admin</span>' +
    '<a class="back" href="#"><span aria-hidden="true">&larr;</span> <span class="back-t">Back to the hunt</span></a>' +
    '<div class="acct"><button type="button" class="me" aria-label="Account"><span class="av">O</span><span class="addr">owner@example.com</span></button></div>' +
    '</div>' + hero + '</div></header>';
}

/* Inline icons */
var IC = {
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  bin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  reply: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v5"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};
