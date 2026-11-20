import * as core from '@actions/core'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { repoUrl } from './packages.js'
import { asRoot } from './root.js'
import { HIPCC_HOST_PACKAGES, missingRpms } from './rpm.js'
import type { PackageManager } from './types.js'

export const REPO_FILE_PATH = '/etc/zypp/repos.d/amdrocm.repo'
export const REPO_ID = 'amdrocm'

/** Never prompt: an unknown key or a conflict fails instead of hanging. */
export const ZYPPER: readonly string[] = ['zypper', '--non-interactive']
const NO_RECOMMENDS = '--no-recommends'

/**
 * Present in every SLES 15/16 and openSUSE Leap image checked
 * but cheap to verify fo SHRs
 */
export const ZYPPER_PREREQS: readonly string[] = ['ca-certificates', 'gpg2']

/**
 * The repo definition for `distr'.
 */
export function buildRepoFile(distro: string): string {
  return [
    `[${REPO_ID}]`,
    'name=AMD ROCm',
    'enabled=1',
    'autorefresh=1',
    `baseurl=${repoUrl(distro, 'zypper')}`,
    'type=rpm-md',
    'gpgcheck=1',
    'repo_gpgcheck=1',
    'pkg_gpgcheck=1',
    ''
  ].join('\n')
}

export const zypper: PackageManager = {
  kind: 'zypper',

  async ensurePrereqs() {
    const missing = await missingRpms(ZYPPER_PREREQS)
    if (missing.length === 0) return
    core.info(`Installing missing prerequisites: ${missing.join(' ')}`)
    await asRoot([...ZYPPER, 'install', NO_RECOMMENDS, ...missing])
  },

  async addRepo(distro, keyFile) {
    await asRoot(['rpm', '--import', keyFile])

    const tmp = path.join(
      process.env['RUNNER_TEMP'] ?? os.tmpdir(),
      'amdrocm.repo'
    )
    fs.writeFileSync(tmp, buildRepoFile(distro))
    await asRoot(['install', '-m', '0644', tmp, REPO_FILE_PATH])
  },

  async install(packages) {
    // Fetch and verify the AMD metadata first - > fail signature
    await asRoot([...ZYPPER, 'refresh', REPO_ID])
    await asRoot([
      ...ZYPPER,
      'install',
      NO_RECOMMENDS,
      ...packages,
      ...HIPCC_HOST_PACKAGES
    ])
  }
}
