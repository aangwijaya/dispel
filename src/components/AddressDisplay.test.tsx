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

  it('emphasises the whole value when it is too short', () => {
    const html = renderToStaticMarkup(<AddressDisplay value="0x1234" />)
    expect(html).toContain('<b>0x1234</b>')
  })

  it('emphasises the first and last four characters and keeps the middle visible', () => {
    const html = renderToStaticMarkup(<AddressDisplay value={ADDRESS} />)
    expect(html).toContain('<b>0x12</b>')
    expect(html).toContain('<b>A9F2</b>')
    expect(html).toContain(ADDRESS.slice(4, -4))
    expect(html.match(/<b>/g)).toHaveLength(2)
  })

  it('trims surrounding whitespace', () => {
    const html = renderToStaticMarkup(<AddressDisplay value={`  ${ADDRESS}  `} />)
    expect(html).not.toContain('&nbsp;')
    expect(html).toContain(ADDRESS.slice(4, -4))
  })
})
