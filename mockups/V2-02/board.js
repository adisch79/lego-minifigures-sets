// Shared renderer for the V2-02 sign-in mockups.
// Each direction file calls renderBoard() with its own control markup per state.
(function () {
  var SEARCH =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
  // Real series cards from the app build (app/public/cards).
  var CARDS = ['71048', '71047', '71046', '71045'];

  function header(control) {
    return (
      '<header class="band"><div class="wrap"><div class="band-top">' +
      '<a class="brand" href="#" aria-label="Minifig Vault home"><span class="brand-mark" aria-hidden="true"><i></i></span>' +
      '<span><b>Minifig Vault</b><small>Collectible Minifigures</small></span></a>' +
      '<div class="controls"><label class="field"><span class="sr">Search series</span>' + SEARCH +
      '<input type="search" placeholder="Search series, year, figure" autocomplete="off"></label>' +
      '<label><span class="sr">Sort series</span><select><option>Newest first</option><option>Oldest first</option><option>A to Z</option></select></label></div>' +
      (control || '') +
      '</div></div></header>'
    );
  }

  function peek() {
    return (
      '<div class="wrap"><ul class="peek">' +
      CARDS.map(function (id) {
        return '<li><img src="../../app/public/cards/' + id + '.png" alt=""></li>';
      }).join('') +
      '</ul></div>'
    );
  }

  window.renderBoard = function (meta, states) {
    var html =
      '<div class="board-head"><p class="dir">' + meta.dir + '</p><h1>' + meta.title + '</h1><p>' + meta.intro + '</p></div>';
    states.forEach(function (s, i) {
      html +=
        '<section class="state"><div class="state-label"><span class="no">' + String(i + 1).padStart(2, '0') +
        '</span><h2>' + s.title + '</h2><p>' + s.note + '</p></div>' +
        '<div class="frame ' + (s.cls || '') + '" style="--h:' + (s.h || 460) + 'px;--hm:' + (s.hm || 600) + 'px">' +
        (s.before || '') + header(s.control) + (s.after || '') + peek() + (s.overlay || '') +
        '</div></section>';
    });
    document.getElementById('board').innerHTML = html;
  };
})();
