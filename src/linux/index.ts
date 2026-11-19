import * as core from '@actions/core'
import type { Inputs } from '../inputs.js'
import { apt } from './apt.js'
import { fetchCheckedKey } from './key.js'
import { packageNames } from './packages.js'
import { installPrefix, requireHipcc } from './prefix.js'
import type { PackageManager } from './types.js'

/**
 * Install ROCm 10.x from the multi-arch package repo. The steps are the same
 * on every distro; only the package manager differs. Returns the prefix.
 */
export async function installMultiArch(
  inputs: Inputs,
  distro: string,
  pm: PackageManager = apt
): Promise<string> {
  const packages = packageNames(inputs.version, inputs.gfx, inputs.components)
  core.startGroup(`Configure the AMD ROCm ${pm.kind} repository`)
  await pm.ensurePrereqs()
  await pm.addRepo(distro, await fetchCheckedKey())
  core.endGroup()

  core.startGroup(`Install ${packages.join(' ')}`)
  await pm.install(packages)
  core.endGroup()

  const prefix = installPrefix(inputs.version)
  requireHipcc(prefix)
  return prefix
}
