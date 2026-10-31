import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the page title', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'Minifig Vault' }),
    ).toBeTruthy()
  })
})
