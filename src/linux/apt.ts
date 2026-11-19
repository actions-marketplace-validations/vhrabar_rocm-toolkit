import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { REPO_BASE } from './packages.js'
import { asRoot } from './root.js'
import type { PackageManager } from './types.js'

export const KEYRING_PATH = '/etc/apt/keyrings/amdrocm.gpg'
export const SOURCES_PATH = '/etc/apt/sources.list.d/amdrocm.sources'
export const APT_GET: readonly string[] = [
  'env',
  'DEBIAN_FRONTEND=noninteractive',
  'apt-get'
]

export function buildSources(distro: string): string {
  return [
    'Types: deb',
    `URIs: ${REPO_BASE}/${distro}`,
    'Suites: stable',
    'Components: main',
    'Architectures: amd64',
    `Signed-By: ${KEYRING_PATH}`,
    ''
  ].join('\n')
}

export const apt: PackageManager = {
  kind: 'apt',

  async addRepo(distro, keyFile) {
    await asRoot(['mkdir', '-p', path.posix.dirname(KEYRING_PATH)])
    await asRoot([
      'gpg',
      '--batch',
      '--yes',
      '--dearmor',
      '-o',
      KEYRING_PATH,
      keyFile
    ])
    await asRoot(['chmod', '0644', KEYRING_PATH])

    const tmp = path.join(
      process.env['RUNNER_TEMP'] ?? os.tmpdir(),
      'amdrocm.sources'
    )
    fs.writeFileSync(tmp, buildSources(distro))
    await asRoot(['install', '-m', '0644', tmp, SOURCES_PATH])
  },

  async install(packages) {
    await asRoot([...APT_GET, 'update'])
    await asRoot([
      ...APT_GET,
      'install',
      '-y',
      '--no-install-recommends',
      ...packages
    ])
  }
}
