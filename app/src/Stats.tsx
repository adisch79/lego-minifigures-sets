// Series, figure and year counts from the loaded catalog. Shared by the home header and the About page.
import type { Series } from './catalog'

/** Callers render this only with a non-empty catalog, so the year range is never Infinity. */
export default function Stats({ series }: { series: Series[] }) {
  const figures = series.reduce((sum, s) => sum + s.figureCount, 0)
  const years = series.map((s) => s.year)
  return (
    <div className="stats">
      <div>
        <strong>{series.length}</strong>Series
      </div>
      <div>
        <strong>{figures}</strong>Figures
      </div>
      <div>
        <strong>
          {Math.min(...years)}
          <span>-{Math.max(...years)}</span>
        </strong>
        Years
      </div>
    </div>
  )
}
