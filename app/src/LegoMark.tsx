// Story V2-18: the LEGO trademark must carry a registered sign each time it is shown.
// SOURCE: https://www.lego.com/en-us/legal/notices-and-policies/fair-play
// ("the LEGO trademark should always appear with a (R) symbol each time it is used"), fetched 2026-11-18.
// Visible text only: alt text, aria-labels, document.title and the catalog data stay unchanged.
import { Fragment } from 'react'

// Whole word LEGO only: "LEGOLAND" or "MEGALEGO" are left alone.
const WORD = /\bLEGO\b/g

/** Splits `text` on the whole word LEGO; returns the plain parts with each LEGO word kept in place. */
export function splitMark(text: string): string[] {
  const parts: string[] = []
  let last = 0
  for (const m of text.matchAll(WORD)) {
    const end = (m.index ?? 0) + m[0].length
    parts.push(text.slice(last, end))
    last = end
  }
  parts.push(text.slice(last))
  return parts
}

/** Renders `text` with a superscript (R) sign after every whole word LEGO. */
export function WithMark({ text }: { text: string }) {
  const parts = splitMark(text)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <sup className="r">&reg;</sup>}
        </Fragment>
      ))}
    </>
  )
}
