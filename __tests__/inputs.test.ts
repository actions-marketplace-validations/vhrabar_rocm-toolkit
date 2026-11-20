import {
  parseBoolean,
  parseComponents,
  parseGfx,
  parseInputs
} from '../src/inputs.js'

describe('parseGfx', () => {
  it('parses, lowercases, dedupes and sorts', () => {
    expect(parseGfx('gfx1201, GFX1200,gfx1200')).toEqual(['gfx1200', 'gfx1201'])
  })

  it('maps "all" to an empty list', () => {
    expect(parseGfx('all')).toEqual([])
  })

  it('rejects "all" mixed with targets', () => {
    expect(() => parseGfx('all,gfx1200')).toThrow(/cannot be combined/)
  })

  it.each(['', ' , ', 'gfx', 'gfx12', 'gfx1200;id', 'navi', '$(id)'])(
    'rejects %j',
    (input) => {
      expect(() => parseGfx(input)).toThrow()
    }
  )
})

describe('parseComponents', () => {
  it('accepts known components', () => {
    expect(parseComponents('dev, opencl,dev')).toEqual(['dev', 'opencl'])
  })

  it('rejects unknown components', () => {
    expect(() => parseComponents('dev,kernel')).toThrow(/Invalid component/)
  })
})

describe('parseBoolean', () => {
  it('parses true and false', () => {
    expect(parseBoolean('x', 'TRUE')).toBe(true)
    expect(parseBoolean('x', 'false')).toBe(false)
  })

  it('rejects anything else', () => {
    expect(() => parseBoolean('use-cache', 'yes')).toThrow(/use-cache/)
  })
})

describe('parseInputs', () => {
  const base = {
    version: '10.1.0',
    gfx: 'gfx1200',
    components: 'dev',
    useCache: 'true',
    logFileSuffix: 'log.txt'
  }

  it('returns normalized inputs', () => {
    expect(parseInputs(base)).toEqual({
      version: '10.1.0',
      gfx: ['gfx1200'],
      components: ['dev'],
      useCache: true,
      logFileSuffix: 'log.txt'
    })
  })

  it('falls back to defaults for empty optional values', () => {
    const result = parseInputs({
      version: '10.2.0',
      gfx: '',
      components: '',
      useCache: '',
      logFileSuffix: ''
    })
    expect(result.gfx).toEqual([])
    expect(result.components).toEqual(['dev'])
    expect(result.useCache).toBe(true)
  })

  it.each(['', '   '])('requires a version (%j)', (version) => {
    expect(() => parseInputs({ ...base, version })).toThrow(
      /Input "version" is required: pin .* e\.g\. 10\.2\.0\. Supported: 6\.2\.2, .*10\.2\.0\./
    )
  })

  it('rejects an unsafe log suffix', () => {
    expect(() => parseInputs({ ...base, logFileSuffix: '../x' })).toThrow(
      /log-file-suffix/
    )
  })

  it('rejects an unsupported version', () => {
    expect(() => parseInputs({ ...base, version: '8.0.0' })).toThrow()
  })
})
