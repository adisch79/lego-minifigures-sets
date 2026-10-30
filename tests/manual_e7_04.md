# Manual checks for E7-04 (site robustness + a11y)

Serve `site/` (`python -m http.server -d site`) and open `series.html?id=<id>`.

## DevTools snippet (edge data)
Run in the console on `index.html` BEFORE it renders is not possible, so run it, then re-trigger render by typing in the search box.
For `series.html`, use a Local Override or paste into the console and reload via `location.reload()` is NOT enough;
instead edit `site/data.js` locally (do not commit) or use Sources > Overrides with this mutation appended:

```js
// Appended after window.CATALOG is defined
(function () {
  const c = window.CATALOG;
  c[0].year = null;                         // series with null year
  delete c[1].bag; delete c[1].group;       // series with no bag/group (empty cover, no hero)
  c[0].figures[1].img = null;               // figure with no image (slide + thumb placeholder)
})();
```

## Checklist
- [ ] Tile/header for the null-year series shows no "null", "undefined" or dangling " · "; searching "null" matches nothing.
- [ ] Series with no bag/group: tile shows the colour background, no broken image, no request for the page URL as an image.
- [ ] Figure with null img: slide shows "No image"; thumb shows its number.
- [ ] Tab order: back link, prev/next arrows, track, thumbs; each shows a yellow focus ring.
- [ ] Focused track or page: Right/Left moves exactly one figure and the page does not also scroll.
- [ ] Ctrl/Alt/Cmd/Shift + arrows do nothing (browser history shortcuts still work).
- [ ] Arrows typed in an input/textarea/contenteditable are ignored.
- [ ] Reduced motion (DevTools > Rendering > Emulate prefers-reduced-motion): arrows, thumbs and strip scroll jump instantly; tile hover does not move.
- [ ] Resize the window (and rotate on mobile emulation) on figure 5 or later: the same figure stays centred, URL hash unchanged.
- [ ] `series.html?id=<id>#4` opens on figure 4 and it is not inert (can be focused/selected).
- [ ] Accessibility tree: only the current slide is exposed; carousel region labelled "<series> minifigures"; slides "i of n"; active thumb has aria-current; counter announces changes politely.
- [ ] Network/console: no favicon.ico 404 on either page.
