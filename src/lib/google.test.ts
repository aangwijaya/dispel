import { describe, expect, it } from 'vitest'
import { parseOAuthCallback } from './google'

describe('parseOAuthCallback', () => {
  it('reads the PKCE code from the query', () => {
    expect(parseOAuthCallback('http://localhost:52423/?code=abc123')).toEqual({ ok: true, code: 'abc123' })
  })

  it('reads a code from the hash fragment', () => {
    expect(parseOAuthCallback('http://localhost:52423/#code=hash456')).toEqual({ ok: true, code: 'hash456' })
  })

  it('prefers the query code over the hash', () => {
    expect(parseOAuthCallback('http://localhost:52423/?code=query#code=hash')).toEqual({ ok: true, code: 'query' })
  })

  it('returns the provider error description', () => {
    expect(
      parseOAuthCallback('http://localhost:52423/?error=access_denied&error_description=User%20denied%20access'),
    ).toEqual({ ok: false, error: 'User denied access' })
  })

  it('returns the bare provider error when there is no description', () => {
    expect(parseOAuthCallback('http://localhost:52423/?error=server_error')).toEqual({
      ok: false,
      error: 'server_error',
    })
  })

  it('reports a callback without a code or error', () => {
    expect(parseOAuthCallback('http://localhost:52423/')).toEqual({
      ok: false,
      error: 'Google did not return a sign-in code.',
    })
  })

  it('reports an unreadable callback', () => {
    expect(parseOAuthCallback('not a url')).toEqual({
      ok: false,
      error: 'Google sign-in returned an unreadable response.',
    })
  })
})
