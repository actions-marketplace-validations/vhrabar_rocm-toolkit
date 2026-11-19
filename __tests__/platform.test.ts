import { jest } from '@jest/globals'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  type OsRelease,
  detectPlatform,
  osFromNodePlatform,
  parseOsRelease,
  resolveDistro
} from '../src/platform.js'

/** /etc/os-release copied from the container images named in each file. */
const FIXTURES = path.join(process.cwd(), '__tests__/fixtures/os-release')
const fixture = (name: string): string =>
  fs.readFileSync(path.join(FIXTURES, name), 'utf8')

/** Directories under stable.repo.amd.com/rocm/core/packages/ except azl3. */
const AMD_REPO_DISTROS = [
  'debian12',
  'debian13',
  'rhel10',
  'rhel8',
  'rhel9',
  'sles15',
  'sles16',
  'ubuntu2204',
  'ubuntu2404',
  'ubuntu2604'
]

const UBUNTU = 'NAME="Ubuntu"\nVERSION_ID="24.04"\nID=ubuntu\nID_LIKE=debian\n'

describe('parseOsRelease', () => {
  it('reads ID, ID_LIKE and VERSION_ID, stripping quotes', () => {
    expect(parseOsRelease(UBUNTU)).toEqual({
      id: 'ubuntu',
      idLike: ['debian'],
      versionId: '24.04'
    })
    expect(parseOsRelease(fixture('almalinux-9'))).toEqual({
      id: 'almalinux',
      idLike: ['rhel', 'centos', 'fedora'],
      versionId: '9.9'
    })
  })

  it('returns empty values when fields are missing', () => {
    expect(parseOsRelease('')).toEqual({ id: '', idLike: [], versionId: '' })
  })
})

const SUPPORTED_FIXTURES: [string, string, string][] = [
  ['ubuntu-24.04', 'ubuntu2404', 'apt'],
  ['debian-12', 'debian12', 'apt'],
  ['manylinux_2_28', 'rhel8', 'dnf'],
  ['manylinux_2_34', 'rhel9', 'dnf'],
  ['almalinux-8', 'rhel8', 'dnf'],
  ['almalinux-9', 'rhel9', 'dnf'],
  ['almalinux-10', 'rhel10', 'dnf'],
  ['rockylinux-8', 'rhel8', 'dnf'],
  ['rockylinux-9', 'rhel9', 'dnf'],
  ['rockylinux-10', 'rhel10', 'dnf'],
  ['centos-stream-9', 'rhel9', 'dnf'],
  ['centos-stream-10', 'rhel10', 'dnf'],
  ['oraclelinux-9', 'rhel9', 'dnf'],
  ['ubi-9', 'rhel9', 'dnf'],
  ['opensuse-leap-15.6', 'sles15', 'zypper'],
  ['opensuse-leap-16.0', 'sles16', 'zypper'],
  ['sles-bci-15.6', 'sles15', 'zypper'],
  ['sles-bci-16.0', 'sles16', 'zypper']
]
const UNSUPPORTED_FIXTURES = [
  'fedora-43',
  'amazonlinux-2023',
  'opensuse-tumbleweed'
]

describe('resolveDistro with real os-release files', () => {
  it.each(SUPPORTED_FIXTURES)(
    '%s -> %s (%s)',
    (file, distro, packageManager) => {
      expect(resolveDistro(parseOsRelease(fixture(file)))).toEqual({
        distro,
        packageManager
      })
    }
  )

  it.each(UNSUPPORTED_FIXTURES)('rejects %s', (file) => {
    expect(() => resolveDistro(parseOsRelease(fixture(file)))).toThrow(
      /Unsupported distribution/
    )
  })

  it('has an expectation for every fixture file', () => {
    const covered = [
      ...SUPPORTED_FIXTURES.map(([f]) => f),
      ...UNSUPPORTED_FIXTURES
    ]
    expect(fs.readdirSync(FIXTURES).sort()).toEqual(covered.sort())
  })
})

describe('resolveDistro', () => {
  const release = (
    id: string,
    versionId: string,
    idLike: string[] = []
  ): OsRelease => ({
    id,
    idLike,
    versionId
  })

  it.each([
    ['ubuntu', '22.04', 'ubuntu2204'],
    ['ubuntu', '24.04', 'ubuntu2404'],
    ['ubuntu', '26.04', 'ubuntu2604'],
    ['debian', '12', 'debian12'],
    ['debian', '13', 'debian13']
  ])('%s %s -> %s (exact match)', (id, versionId, expected) => {
    expect(resolveDistro(release(id, versionId))).toEqual({
      distro: expected,
      packageManager: 'apt'
    })
  })

  it('maps every AMD repo directory except azl3', () => {
    const reached = [
      release('ubuntu', '22.04'),
      release('ubuntu', '24.04'),
      release('ubuntu', '26.04'),
      release('debian', '12'),
      release('debian', '13'),
      release('rhel', '8.10'),
      release('rhel', '9.6'),
      release('rhel', '10.0'),
      release('sles', '15.6'),
      release('sles', '16.0')
    ].map((r) => resolveDistro(r).distro)
    expect(reached.sort()).toEqual(AMD_REPO_DISTROS)
  })

  it('accepts an unlisted RHEL rebuild through ID_LIKE', () => {
    expect(
      resolveDistro(release('eurolinux', '9.4', ['rhel', 'centos', 'fedora']))
    ).toEqual({ distro: 'rhel9', packageManager: 'dnf' })
  })

  it('does not use ID_LIKE for Ubuntu and Debian derivatives', () => {
    expect(() =>
      resolveDistro(release('linuxmint', '22', ['ubuntu', 'debian']))
    ).toThrow(/Unsupported distribution "linuxmint 22"/)
  })

  it.each([
    ['ubuntu', '20.04'],
    ['ubuntu', '24.10'],
    ['debian', '11'],
    ['rhel', '7.9'],
    ['almalinux', '11.0'],
    ['sles', '12.5'],
    ['', '']
  ])('rejects %j %j and lists what is supported', (id, versionId) => {
    expect(() => resolveDistro(release(id, versionId))).toThrow(
      /Unsupported distribution ".*"\. Supported: ubuntu 22\.04\/24\.04\/26\.04; debian 12\/13; rhel 8\/9\/10 \(also almalinux, rocky, centos, ol\); sles 15\/16 \(also opensuse-leap\)\./
    )
  })
})

describe('detectPlatform', () => {
  it('maps linux using os-release', () => {
    expect(detectPlatform('linux', 'x64', () => UBUNTU)).toEqual({
      os: 'linux',
      arch: 'x64',
      distro: 'ubuntu2404',
      packageManager: 'apt'
    })
    expect(
      detectPlatform('linux', 'x64', () => fixture('manylinux_2_28'))
    ).toEqual({
      os: 'linux',
      arch: 'x64',
      distro: 'rhel8',
      packageManager: 'dnf'
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
