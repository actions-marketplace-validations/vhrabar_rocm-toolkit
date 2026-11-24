import { readFileSync } from 'node:fs'
import { knownRepoDirs } from '../src/platform.js'
import {
  aptVersions,
  compareVersions,
  findNew,
  formatReport,
  hasFindings,
  legacyVersions,
  repoDirs,
  rpmVersions,
  tarballVersions,
  type Pages,
  type Supported
} from '../src/upstream.js'
import { LEGACY_VERSIONS, MULTIARCH_VERSIONS } from '../src/versions.js'

// Snapshots of AMD's pages from 2026-11-24, trimmed
const fixture = (name: string): string =>
  readFileSync(`__tests__/fixtures/upstream/${name}`, 'utf8')

const pages: Pages = {
  apt: fixture('Packages'),
  rpm: fixture('rpm.html'),
  tarball: fixture('tarball.html'),
  packages: fixture('packages.html'),
  legacy: fixture('amdgpu-install.html')
}

const supported: Supported = {
  multiarch: MULTIARCH_VERSIONS,
  legacy: LEGACY_VERSIONS,
  repoDirs: knownRepoDirs()
}

describe('parsers', () => {
  it('reads versions from the apt Packages index', () => {
    expect(aptVersions(pages.apt)).toEqual(['10.0.0', '10.1.0', '10.2.0'])
  })

  it('reads versions from the RPM listing', () => {
    expect(rpmVersions(pages.rpm)).toEqual(['10.0.0', '10.1.0', '10.2.0'])
  })

  it('reads versions from the tarball page', () => {
    expect(tarballVersions(pages.tarball)).toEqual([
      '10.0.0',
      '10.1.0',
      '10.2.0'
    ])
  })

  it('reads legacy installer directories, adding .0 where missing', () => {
    const versions = legacyVersions(pages.legacy)
    expect(versions).toEqual(expect.arrayContaining(['7.2.0', '7.2.4']))
    expect(versions).not.toContain('30.10.3')
  })

  it('reads distro directories', () => {
    expect(repoDirs(pages.packages)).toEqual(
      expect.arrayContaining(['ubuntu2404', 'rhel10', 'sles16', 'azl3'])
    )
  })

  it('orders versions numerically', () => {
    expect(['10.10.0', '10.2.0', '9.0.0'].sort(compareVersions)).toEqual([
      '9.0.0',
      '10.2.0',
      '10.10.0'
    ])
  })
})

describe('findNew', () => {
  it('finds nothing when the supported list matches upstream', () => {
    const findings = findNew(pages, supported)
    expect(hasFindings(findings)).toBe(false)
    expect(formatReport(findings, supported)).toBe('Nothing new upstream.')
  })

  it('reports a version removed from the supported list', () => {
    const findings = findNew(pages, {
      ...supported,
      multiarch: ['10.0.0', '10.1.0'],
      legacy: ['6.2.2', '7.0.1', '7.2.3']
    })
    expect([...findings.multiarch]).toEqual([
      ['10.2.0', ['apt', 'rpm', 'tarball']]
    ])
    expect(findings.legacy).toEqual(['7.2.4'])
    expect(formatReport(findings, supported)).toContain('| 10.2.0 |')
  })

  it('reports a distro directory the action does not know', () => {
    const findings = findNew(
      { ...pages, packages: pages.packages + '<a href="ubuntu2810/">' },
      supported
    )
    expect(findings.repoDirs).toEqual(['ubuntu2810'])
  })

  it('fails loudly when a page no longer parses', () => {
    expect(() =>
      findNew({ ...pages, tarball: '<html></html>' }, supported)
    ).toThrow(/tarball/)
  })
})
