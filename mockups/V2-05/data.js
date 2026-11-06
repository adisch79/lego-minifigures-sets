/* Shared sample data for the V2-05 admin mockups.
   Shapes follow supabase/migrations: allowlist(email, added_at), profiles(user_id, display_name, created_at),
   admins(user_id), marks(kind, target_id, state, updated_at), wanted_alerts(created_at, sent_at).
   Figure ids and names are real entries from app/public/catalog.json; emails are invented placeholders. */
var IMG = '../../app/public/img/';
var CARD = '../../app/public/cards/';
var NOW = new Date('2026-11-06T18:30:00');

var SERIES = {
  '71045': 'Series 25', '71046': 'Series 26', '71047': 'Dungeons & Dragons', '71048': 'Series 27',
  '71039': 'Marvel Series 2', '71038': 'Disney 100', '71037': 'Series 24', '71034': 'Series 23'
};

/* allowlist rows joined with profiles; signedIn = profile row exists */
var PEOPLE = [
  { email: 'owner@example.com', name: 'Owner', added: '2026-11-02T09:00', signedIn: '2026-11-02T09:04', admin: true, last: '2026-11-06T18:12' },
  { email: 'collector1@example.com', name: 'Maya', added: '2026-11-02T09:10', signedIn: '2026-11-02T20:41', last: '2026-11-06T17:55' },
  { email: 'collector2@example.com', name: 'Tom', added: '2026-11-03T11:30', signedIn: '2026-11-03T12:02', last: '2026-11-06T08:20' },
  { email: 'minifig.collector.longname@example.com', name: '', added: '2026-11-03T11:31', signedIn: '2026-11-04T07:15', last: '2026-11-05T22:47' },
  { email: 'collector3@example.com', name: 'Noa', added: '2026-11-04T16:00', signedIn: '2026-11-05T19:26', last: '2026-11-06T16:03' },
  { email: 'collector4@example.com', name: '', added: '2026-11-05T10:12', signedIn: null },
  { email: 'collector5@example.com', name: '', added: '2026-11-06T14:48', signedIn: null }
];

/* Wanted marks joined with wanted_alerts. alert: 'sent' (sent_at set), 'queued' (row created, not yet sent),
   'none' (no alert row, e.g. the hourly cap of 20 was reached) */
var WANTED = [
  { who: 'collector1@example.com', kind: 'figure', id: '71048-8', name: 'Bogeyman', at: '2026-11-06T17:55', alert: 'queued' },
  { who: 'collector3@example.com', kind: 'figure', id: '71047-7', name: 'Mind Flayer', at: '2026-11-06T16:03', alert: 'sent' },
  { who: 'collector1@example.com', kind: 'figure', id: '71047-7', name: 'Mind Flayer', at: '2026-11-06T15:40', alert: 'sent' },
  { who: 'collector3@example.com', kind: 'series', id: '71046', name: 'Series 26 Minifigures', at: '2026-11-06T15:12', alert: 'sent' },
  { who: 'collector2@example.com', kind: 'figure', id: '71039-2', name: 'Moon Knight', at: '2026-11-06T08:20', alert: 'sent' },
  { who: 'collector2@example.com', kind: 'figure', id: '71048-10', name: 'Pirate Quartermaster', at: '2026-11-06T08:18', alert: 'sent' },
  { who: 'minifig.collector.longname@example.com', kind: 'figure', id: '71045-3', name: 'Vampire Knight', at: '2026-11-05T22:47', alert: 'none' },
  { who: 'collector1@example.com', kind: 'figure', id: '71045-3', name: 'Vampire Knight', at: '2026-11-05T21:02', alert: 'sent' },
  { who: 'collector3@example.com', kind: 'figure', id: '71038-6', name: 'Dr. Facilier', at: '2026-11-05T19:40', alert: 'sent' },
  { who: 'collector1@example.com', kind: 'figure', id: '71046-11', name: 'Orion', at: '2026-11-05T18:15', alert: 'sent' },
  { who: 'collector2@example.com', kind: 'figure', id: '71047-7', name: 'Mind Flayer', at: '2026-11-04T13:30', alert: 'sent' },
  { who: 'minifig.collector.longname@example.com', kind: 'figure', id: '71037-6', name: 'T-Rex Costume Fan', at: '2026-11-04T07:30', alert: 'sent' },
  { who: 'collector2@example.com', kind: 'figure', id: '71034-1', name: 'Nutcracker', at: '2026-11-03T12:10', alert: 'sent' },
  { who: 'collector1@example.com', kind: 'series', id: '71047', name: 'Dungeons & Dragons', at: '2026-11-03T09:00', alert: 'sent' }
];

function seriesOf(w) { return w.kind === 'series' ? w.id : w.id.split('-')[0]; }
function art(w) { return w.kind === 'series' ? CARD + w.id + '.png' : IMG + seriesOf(w) + '/' + w.id + '.webp'; }
function person(email) { for (var i = 0; i < PEOPLE.length; i++) if (PEOPLE[i].email === email) return PEOPLE[i]; return { email: email, name: '' }; }
function label(p) { return p.name || p.email.split('@')[0]; }
function initial(p) { return (p.name || p.email).charAt(0).toUpperCase(); }
function ago(iso) {
  var m = Math.round((NOW - new Date(iso)) / 60000);
  if (m < 60) return m + ' min ago';
  var h = Math.round(m / 60); if (h < 24) return h + ' h ago';
  var d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago';
}
function stamp(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toTimeString().slice(0, 5);
}
var ALERT_TXT = { sent: 'Alert sent', queued: 'Queued', none: 'Not sent' };
function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
var AV_TONES = ['', ' ink', ' y'];
function avatar(p, i) {
  if (!p.signedIn) return '<span class="av ghost">' + initial(p) + '</span>';
  return '<span class="av' + AV_TONES[(i || 0) % 3] + '">' + initial(p) + '</span>';
}
var X_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
var PLUS_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';

/* Shared header band: brand, Admin tag, signed-in chip from V2-02 direction A */
function header(sub) {
  return '<header class="band"><div class="wrap band-top">' +
    '<a class="brand" href="#"><span class="brand-mark"><i></i></span><span><b>Minifigures</b><small>Collector vault</small></span></a>' +
    '<span class="adm-tag">Admin</span>' +
    '<div class="controls"><a class="back" href="#">Back to the vault</a>' +
    '<button class="me" title="owner@example.com"><span class="av">O</span><span class="addr">owner@example.com</span></button></div>' +
    '</div>' + (sub || '') + '</header>';
}
