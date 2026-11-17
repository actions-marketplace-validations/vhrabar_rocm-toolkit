import { jest } from '@jest/globals'
import {
  detectPlatform,
  distroName,
  osFromNodePlatform,
  parseOsRelease
} from '../src/platform.js'

const UBUNTU = 'NAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\nID_LIKE=debian\n'

describe('parseOsRelease', () => {
  it('reads ID and VERSION_ID, stripping quotes', () => {
    expect(parseOsRelease(UBUNTU)).toEqual({ id: 'ubuntu', versionId: '24.04' })
  })

  it('returns empty strings when fields are missing', () => {
    expect(parseOsRelease('')).toEqual({ id: '', versionId: '' })
  })
})

describe('distroName', () => {
  it.each([
    ['ubuntu', '22.04', 'ubuntu2204'],
    ['ubuntu', '24.04', 'ubuntu2404'],
    ['ubuntu', '26.04', 'ubuntu2604'],
    ['debian', '12', 'debian12'],
    ['debian', '13', 'debian13']
  ])('%s %s -> %s', (id, versionId, expected) => {
    expect(distroName({ id, versionId })).toBe(expected)
  })

  it('rejects unsupported distros and versions', () => {
    expect(() => distroName({ id: 'fedora', versionId: '40' })).toThrow(
      /Unsupported distribution/
    )
    expect(() => distroName({ id: 'ubuntu', versionId: '20.04' })).toThrow(
      /Unsupported distribution/
    )
  })
})

describe('detectPlatform', () => {
  it('maps linux using os-release', () => {
    expect(detectPlatform('linux', 'x64', () => UBUNTU)).toEqual({
      os: 'linux',
      arch: 'x64',
      distro: 'ubuntu2404'
    })
  })

  it('does not read os-release on windows', () => {
    const read = jest.fn<() => string>()
    expect(detectPlatform('win32', 'x64', read)).toEqual({
      os: 'windows',
      arch: 'x64',
      distro: ''
    })
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects macOS', () => {
    expect(() => osFromNodePlatform('darwin')).toThrow(/Unsupported operating/)
  })
})
