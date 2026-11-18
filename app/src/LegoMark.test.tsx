import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WithMark, splitMark } from './LegoMark'
import SiteFooter from './SiteFooter'

afterEach(cleanup)

describe('WithMark', () => {
  it('inserts the registered sign after each LEGO word', () => {
    const { container } = render(
      <h1>
        <WithMark text="The LEGO Batman Movie Series 2" />
      </h1>,
    )
    const sups = container.querySelectorAll('sup.r')
    expect(sups).toHaveLength(1)
    expect(sups[0].textContent).toBe('\u00ae')
    expect(container.querySelector('h1')?.innerHTML).toBe('The LEGO<sup class="r">\u00ae</sup> Batman Movie Series 2')
  })

  it('marks every LEGO word when there are several', () => {
    const { container } = render(<WithMark text="LEGO meets LEGO" />)
    expect(container.querySelectorAll('sup.r')).toHaveLength(2)
    expect(container.textContent).toBe('LEGO\u00ae meets LEGO\u00ae')
  })

  it('leaves names without LEGO unchanged', () => {
    const { container } = render(<WithMark text="Series 25" />)
    expect(container.querySelector('sup')).toBeNull()
    expect(container.textContent).toBe('Series 25')
  })

  it('does not match LEGO inside a longer word', () => {
    expect(splitMark('LEGOLAND Knight')).toEqual(['LEGOLAND Knight'])
    expect(splitMark('MEGALEGO')).toEqual(['MEGALEGO'])
    const { container } = render(<WithMark text="LEGOLAND Knight" />)
    expect(container.querySelector('sup')).toBeNull()
  })
})

describe('SiteFooter', () => {
  it('renders the Fair Play disclaimer with a mark on each LEGO word', () => {
    const { container } = render(<SiteFooter />)
    const txt = container.querySelector('.txt')
    expect(txt?.textContent?.replace(/\s+/g, ' ')).toBe(
      'Minifig Hunt is a fan-made site. LEGO\u00ae is a trademark of the LEGO\u00ae Group of companies which does not sponsor, authorize or endorse this site.',
    )
    expect(txt?.querySelectorAll('sup.r')).toHaveLength(2)
    expect(container.querySelector('.badge')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('keeps the three site links', () => {
    render(<SiteFooter />)
    const nav = screen.getByRole('navigation', { name: 'Site' })
    const links = Array.from(nav.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')])
    expect(links).toEqual([
      ['About', '#about'],
      ['Contact', '#about/write'],
      ['Buy me a coffee', '#about/support'],
    ])
  })
})
