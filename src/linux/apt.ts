import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { repoUrl } from './packages.js'
import { asRoot } from './root.js'
import type { PackageManager } from './types.js'

export const KEYRING_PATH = '/etc/apt/keyrings/amdrocm.gpg'
export const SOURCES_PATH = '/etc/apt/sources.list.d/amdrocm.sources'
export const APT_GET: readonly string[] = [
  'env',
  'DEBIAN_FRONTEND=noninteractive',
  'apt-get'
]

/**
 * Packages the multi-arch flow needs that bare container images lack:
 * `gpg` for the key check and `--dearmor`, `ca-certificates` for apt.
 */
export const APT_PREREQS: readonly string[] = ['ca-certificates', 'gpg']

/** Whether `pkg` is installed according to dpkg. Needs no root. */
export async function isInstalled(pkg: string): Promise<boolean> {
  const { exitCode, stdout } = await exec.getExecOutput(
    'dpkg-query',
    ['-W', '-f=${Status}', pkg],
    { silent: true, ignoreReturnCode: true }
  )
  return exitCode === 0 && stdout.trim() === 'install ok installed'
}

/**
 * Install those of `packages` that are missing. Does nothing when all are
 * present (hosted runners), so it only touches apt in bare containers.
 * Without ca-certificates apt silently ignores https repos, so this must run
 * before they are added rather than being inferred from a failure.
 */
export async function ensurePackages(
  packages: readonly string[]
): Promise<void> {
  const missing: string[] = []
  for (const pkg of packages) if (!(await isInstalled(pkg))) missing.push(pkg)
  if (missing.length === 0) return

  core.info(`Installing missing prerequisites: ${missing.join(' ')}`)
  await asRoot([...APT_GET, 'update'])
  await asRoot([
    ...APT_GET,
    'install',
    '-y',
    '--no-install-recommends',
    ...missing
  ])
}

export function buildSources(distro: string): string {
  return [
    'Types: deb',
    `URIs: ${repoUrl(distro, 'apt')}`,
    'Suites: stable',
    'Components: main',
    'Architectures: amd64',
    `Signed-By: ${KEYRING_PATH}`,
    ''
  ].join('\n')
}

export const apt: PackageManager = {
  kind: 'apt',

  async ensurePrereqs() {
    await ensurePackages(APT_PREREQS)
  },

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
