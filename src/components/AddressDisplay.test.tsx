import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AddressDisplay } from './AddressDisplay'

const ADDRESS = '0x12abcdef1234567890abcdef1234567890A9F2'

describe('AddressDisplay', () => {
  it('renders a dash for empty values', () => {
    expect(renderToStaticMarkup(<AddressDisplay value={null} />)).toContain('—')
    expect(renderToStaticMarkup(<AddressDisplay value={undefined} />)).toContain('—')
    expect(renderToStaticMarkup(<AddressDisplay value="   " />)).toContain('—')
  })

  it('highlights the whole value when it is too short', () => {
    const html = renderToStaticMarkup(<AddressDisplay value="0x1234" />)
    expect(html).toContain('text-accent')
    expect(html).toContain('0x1234')
  })

  it('highlights the first and last four characters and keeps the middle visible', () => {
    const html = renderToStaticMarkup(<AddressDisplay value={ADDRESS} />)
    expect(html).toContain('0x12')
    expect(html).toContain('A9F2')
    expect(html).toContain(ADDRESS.slice(4, -4))
    expect(html.match(/text-accent/g)).toHaveLength(2)
  })

  it('trims surrounding whitespace', () => {
    const html = renderToStaticMarkup(<AddressDisplay value={`  ${ADDRESS}  `} />)
    expect(html).not.toContain('&nbsp;')
    expect(html).toContain(ADDRESS.slice(4, -4))
  })
})
