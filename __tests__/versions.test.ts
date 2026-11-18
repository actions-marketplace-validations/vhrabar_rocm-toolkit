import {
  DEFAULT_VERSION,
  assertSupported,
  parseVersion,
  selectScheme
} from '../src/versions.js'

describe('parseVersion', () => {
  it('parses MAJOR.MINOR.PATCH', () => {
    expect(parseVersion('10.1.0')).toEqual({ major: 10, minor: 1, patch: 0 })
  })

  it.each([
    '',
    '10',
    '10.1',
    '10.1.0.1',
    'v10.1.0',
    '10.1.x',
    '10.1.0; rm -rf'
  ])('rejects %j', (input) => {
    expect(() => parseVersion(input)).toThrow(/Invalid ROCm version/)
  })
})

describe('selectScheme', () => {
  it.each([
    ['10.1.0', 'multiarch'],
    ['11.0.0', 'multiarch'],
    ['7.2.9', 'legacy'],
    ['7.0.1', 'legacy'],
    ['6.2.2', 'legacy']
  ])('%s -> %s', (v, scheme) => {
    expect(selectScheme(parseVersion(v))).toBe(scheme)
  })

  it.each(['7.3.0', '7.11.0', '8.0.0', '9.5.1'])('rejects %s', (v) => {
    expect(() => selectScheme(parseVersion(v))).toThrow(/does not support/)
  })
})

describe('assertSupported', () => {
  it('accepts the default version', () => {
    expect(() => assertSupported(DEFAULT_VERSION)).not.toThrow()
  })

  it('rejects a well-formed version that is not listed', () => {
    expect(() => assertSupported('10.9.9')).toThrow(/not in the supported list/)
  })
})
