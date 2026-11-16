// Story V2-15: the footer line shown under the home, series and About pages (mockup C, mockups/V2-15/c.html).
export default function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="wrap">
        <span>
          <b>Minifig Hunt</b> &middot; Fan-made site, not affiliated with the LEGO Group
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
