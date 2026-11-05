// Shared builders for the V2-03 "mark owned / wanted" mockups.
// Real data from app/public/catalog.json (series 71048 figures, six newest series for home tiles).
// Each direction passes hooks (D.*) that add its own controls; the base markup reuses the app's
// classes from app/src/index.css so the frames look like the real pages.
(function () {
  var IMG = '../../app/public/';
  var SEARCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  var KEY = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-3 3 3 3m-6 0 2 2"/></svg>';
  var LONG = 'minifig.collector.longname@example.com';

  // Home tiles: real series, invented marks for the demo collection.
  // own = figures marked owned, want = figures marked wanted, mark = series-level badge (separate).
  var HOME = [
    { id: '71053', name: 'Shrek', year: 2026, n: 12, own: 0, want: 0, mark: null },
    { id: '71052', name: 'Series 29 Minifigures', year: 2026, n: 12, own: 12, want: 0, mark: 'owned' },
    { id: '71051', name: 'Series 28 Minifigures', year: 2026, n: 12, own: 5, want: 2, mark: null },
    { id: '71050', name: 'Spider-Man - Across the Spider-Verse', year: 2025, n: 12, own: 0, want: 0, mark: null },
    { id: '71049', name: 'Formula 1', year: 2025, n: 12, own: 3, want: 0, mark: 'wanted' },
    { id: '71048', name: 'Series 27 Minifigures', year: 2025, n: 12, own: 7, want: 2, mark: null }
  ];
  // Series 71048 figures; one figure per state in the first rows so the phone crop shows them all.
  var FIGS = [
    [1, 'Hamster Costume Fan', 'owned'], [2, 'Wolfpack Beastmaster', 'wanted'], [3, 'Jetpack Racer', 'saving'],
    [4, 'Astronomer Kid', 'failed'], [5, 'Plush Toy Collector', 'owned'], [6, 'Pterodactyl Costume Fan', 'none'],
    [7, 'Longboarder', 'owned'], [8, 'Bogeyman', 'owned'], [9, 'Cupid', 'wanted'],
    [10, 'Pirate Quartermaster', 'owned'], [11, 'Cat Lover', 'owned'], [12, 'Steampunk Inventor', 'owned']
  ].map(function (f) { return { no: f[0], name: f[1], state: f[2], img: IMG + 'img/71048/71048-' + f[0] + '.webp' }; });

  function brand() {
    return '<a class="brand" href="#" aria-label="Minifig Vault home"><span class="brand-mark" aria-hidden="true"><i></i></span>' +
      '<span><b>Minifig Vault</b><small>Collectible Minifigures</small></span></a>';
  }
  function acct(signedIn) {
    return '<div class="acct">' + (signedIn
      ? '<button class="me" title="' + LONG + '"><span class="av">M</span><span class="addr">' + LONG + '</span><svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'
      : '<button class="pill-in">' + KEY + '<span class="t">Sign in</span></button>') + '</div>';
  }
  function homeHeader(o) {
    return '<header class="band"><div class="wrap"><div class="band-top">' + brand() +
      '<div class="controls"><label class="field"><span class="sr">Search series</span>' + SEARCH +
      '<input type="search" placeholder="Search series, year, figure"></label>' +
      '<label><span class="sr">Sort series</span><select><option>Newest first</option></select></label>' + (o.ctl || '') + '</div>' +
      acct(o.signedIn) + '</div>' + (o.bandExtra || '') + '</div></header>';
  }

  function tile(D, s, o, i) {
    return '<li class="tile ' + (o.signedIn && D.tileClass ? D.tileClass(s) : '') + '"><a class="tile-link" href="#">' +
      '<div class="art"><img src="' + IMG + 'cards/' + s.id + '.png" alt="' + s.name + ' series card">' + (o.signedIn && D.tileArt ? D.tileArt(s) : '') + '</div></a>' +
      '<div class="meta"><div class="meta-row"><span class="num">No. ' + s.id + ' / ' + s.year + '</span>' +
      (o.signedIn && D.tileBadge ? D.tileBadge(s) : '<span class="count-badge">' + s.n + ' figures</span>') + '</div>' +
      '<h2><a href="#">' + s.name + '</a></h2>' + (o.signedIn && D.tileMeta ? D.tileMeta(s) : '') + '</div></li>';
  }

  // o: { signedIn, ids, empty, rule, ctl, bandExtra, before }
  function home(D, o) {
    var list = o.ids ? HOME.filter(function (s) { return o.ids.indexOf(s.id) >= 0; }) : HOME;
    var body = o.empty ? '<li class="empty">' + o.empty + '</li>' : list.map(function (s, i) { return tile(D, s, o, i); }).join('');
    return homeHeader(o) + (o.before || '') + '<main class="wrap">' + (o.rule || '<div class="rule"><span><b>52</b> series</span><span>Newest first</span></div>') +
      '<ul class="grid">' + body + '</ul></main>';
  }

  function fig(D, f, o) {
    var st = o.signedIn ? f.state : 'none';
    return '<li class="fig ' + (o.signedIn && D.figClass ? D.figClass(st) : '') + '">' +
      '<span class="fig-no" aria-hidden="true">' + f.no + '</span>' +
      '<div class="pic"><img src="' + f.img + '" alt="' + f.name + ' minifigure">' + (o.signedIn && D.figPic ? D.figPic(st, f) : '') + '</div>' +
      '<h3><span class="sr">Figure ' + f.no + ': </span>' + f.name + '</h3>' + (o.signedIn && D.figFoot ? D.figFoot(st, f) : '') + '</li>';
  }

  // o: { signedIn, heroExtra, stage, ruleRight, before, after, figsClass }
  function series(D, o) {
    return '<header class="band"><div class="wrap"><div class="band-top">' + brand() +
      '<a class="back" href="#"><span aria-hidden="true">&larr;</span> <span class="back-t">All series</span></a>' + acct(o.signedIn) + '</div>' +
      '<section class="hero"><div class="art-stage"><img class="flat" src="' + IMG + 'cards/71048.png" alt="Series 27 card">' + (o.stage || '') + '</div>' +
      '<div class="spill" aria-hidden="true">' +
      '<img src="' + FIGS[0].img + '" style="left:20px;top:30px;transform:rotate(-8deg)" alt="">' +
      '<img src="' + FIGS[6].img + '" style="left:120px;top:150px;transform:rotate(6deg)" alt="">' +
      '<img src="' + FIGS[11].img + '" style="left:30px;top:270px;transform:rotate(-4deg)" alt=""></div>' +
      '<div class="hero-copy"><p class="eyebrow">Collectible Minifigures</p><h1>Series 27 Minifigures</h1>' +
      '<div class="facts"><span class="fact dark">No. 71048</span><span class="fact">2025</span><span class="fact">12 to collect</span></div>' +
      (o.heroExtra || '') + '</div></section></div></header>' +
      '<main class="wrap"><div class="rule rule-series"><h2>Inside the series</h2>' + (o.ruleRight || '') + '</div>' + (o.before || '') +
      '<ul class="figs ' + (o.figsClass || '') + '">' + FIGS.map(function (f) { return fig(D, f, o); }).join('') + '</ul></main>' + (o.after || '');
  }

  // The same figure in all five states, side by side.
  function states(D, labels) {
    var base = FIGS[5];
    return '<div class="wrap"><ul class="figs figs-states">' + ['none', 'owned', 'wanted', 'saving', 'failed'].map(function (st, i) {
      return '<li class="st-col"><p class="st-cap">' + labels[i] + '</p><ul class="figs-one">' +
        fig(D, { no: base.no, name: base.name, img: base.img, state: st }, { signedIn: true }) + '</ul></li>';
    }).join('') + '</ul></div>';
  }

  function board(meta, list) {
    var html = '<div class="board-head"><p class="dir">' + meta.dir + '</p><h1>' + meta.title + '</h1><p>' + meta.intro + '</p></div>';
    list.forEach(function (s, i) {
      html += '<section class="state"><div class="state-label"><span class="no">' + String(i + 1).padStart(2, '0') +
        '</span><h2>' + s.title + '</h2><p>' + s.note + '</p></div>' +
        '<div class="frame ' + (s.cls || '') + '" style="--h:' + (s.h || 700) + 'px;--hm:' + (s.hm || 900) + 'px">' + s.html + '</div></section>';
    });
    document.getElementById('board').innerHTML = html;
  }

  window.K = { HOME: HOME, FIGS: FIGS, home: home, series: series, states: states, board: board };
})();
