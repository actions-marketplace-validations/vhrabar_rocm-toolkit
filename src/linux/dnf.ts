import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { REPO_BASE } from './packages.js'
import { asRoot } from './root.js'
import type { PackageManager } from './types.js'

export const KEY_PATH = '/etc/pki/rpm-gpg/RPM-GPG-KEY-amdrocm'
export const REPO_FILE_PATH = '/etc/yum.repos.d/amdrocm.repo'
export const REPO_ID = 'amdrocm'

/**
 * Every dnf call mus pas -y
 */
export const DNF: readonly string[] = ['dnf', '-y']
const NO_WEAK_DEPS = '--setopt=install_weak_deps=False'

/**
 * `gnupg2` provides the `gpg` the key check needs and is missing on
 * almalinux:10; `ca-certificates` was present everywhere but is cheap to check.
 */
export const DNF_PREREQS: readonly string[] = ['ca-certificates', 'gnupg2']

/** Whether `pkg` is installed according to rpm. Needs no root. */
export async function isRpmInstalled(pkg: string): Promise<boolean> {
  const { exitCode } = await exec.getExecOutput('rpm', ['-q', '--quiet', pkg], {
    silent: true,
    ignoreReturnCode: true
  })
  return exitCode === 0
}

/** Install those of `packages` that are missing; no dnf call otherwise. */
export async function ensureRpmPackages(
  packages: readonly string[]
): Promise<void> {
  const missing: string[] = []
  for (const pkg of packages)
    if (!(await isRpmInstalled(pkg))) missing.push(pkg)
  if (missing.length === 0) return

  core.info(`Installing missing prerequisites: ${missing.join(' ')}`)
  await asRoot([...DNF, 'install', NO_WEAK_DEPS, ...missing])
}

/** The .repo file for `distro` (e.g. rhel9), with both signature checks on. */
export function buildRepoFile(distro: string): string {
  return [
    `[${REPO_ID}]`,
    'name=AMD ROCm',
    `baseurl=${REPO_BASE}/${distro}/x86_64/`,
    'enabled=1',
    'gpgcheck=1',
    'repo_gpgcheck=1',
    `gpgkey=file://${KEY_PATH}`,
    ''
  ].join('\n')
}

export const dnf: PackageManager = {
  kind: 'dnf',

  async ensurePrereqs() {
    await ensureRpmPackages(DNF_PREREQS)
  },

  async addRepo(distro, keyFile) {
    await asRoot(['install', '-D', '-m', '0644', keyFile, KEY_PATH])
    await asRoot(['rpm', '--import', KEY_PATH])

    const tmp = path.join(
      process.env['RUNNER_TEMP'] ?? os.tmpdir(),
      'amdrocm.repo'
    )
    fs.writeFileSync(tmp, buildRepoFile(distro))
    await asRoot(['install', '-m', '0644', tmp, REPO_FILE_PATH])
  },

  async install(packages) {
    // Fetch and verify the AMD metadata first -> chech signature
    await asRoot([...DNF, 'makecache', '--repo', REPO_ID])
    await asRoot([...DNF, 'install', NO_WEAK_DEPS, ...packages])
  }
}
