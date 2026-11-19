// Story V2-15: the footer shown under the home, series and About pages.
// Story V2-18: approved option C "Ink band" (mockups/V2-18/footer.html): ink band, yellow (R) badge, Fair Play disclaimer.
// SOURCE: https://www.lego.com/en-us/legal/notices-and-policies/fair-play
// (disclaimer sentence "LEGO(R) is a trademark of the LEGO Group of companies which does not sponsor, authorize or
// endorse this site" and "the LEGO trademark should always appear with a (R) symbol each time it is used"), fetched 2026-11-18.
export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <span className="badge" aria-hidden="true">
          &reg;
        </span>
        <span className="txt">
          <b>Minifig Hunt</b> is a fan-made site. LEGO<sup className="r">&reg;</sup> is a trademark of the LEGO
          <sup className="r">&reg;</sup> Group of companies which does not sponsor, authorize or endorse this site.
        </span>
        <nav aria-label="Site">
          <a href="#about">About</a>
          <a href="#about/write">Contact</a>
          <a href="#about/support">Buy me a coffee</a>
        </nav>
      </div>
    </footer>
  )
}
