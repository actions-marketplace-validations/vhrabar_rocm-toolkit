import * as core from '@actions/core'
import * as fs from 'node:fs'
import * as os from 'node:os'
import { parseInputs, type Inputs } from './inputs.js'
import { applyEnv, buildEnv } from './env.js'
import { installMultiArch } from './linux.js'
import { detectPlatform, type Platform } from './platform.js'
import { parseVersion, selectScheme, type Scheme } from './versions.js'

export interface Plan {
  inputs: Inputs
  platform: Platform
  scheme: Scheme
}

export function readRawInputs(): Parameters<typeof parseInputs>[0] {
  return {
    version: core.getInput('version'),
    gfx: core.getInput('gfx'),
    components: core.getInput('components'),
    useCache: core.getInput('use-cache'),
    logFileSuffix: core.getInput('log-file-suffix')
  }
}

export function makePlan(
  raw: Parameters<typeof parseInputs>[0],
  platform: Platform
): Plan {
  const inputs = parseInputs(raw)
  const scheme = selectScheme(parseVersion(inputs.version))
  return { inputs, platform, scheme }
}

export async function run(): Promise<void> {
  try {
    const platform = detectPlatform(process.platform, os.arch(), () =>
      fs.readFileSync('/etc/os-release', 'utf8')
    )
    const plan = makePlan(readRawInputs(), platform)
    core.info(
      `Plan: ROCm ${plan.inputs.version} on ${plan.platform.os} ` +
        `(${plan.scheme}, gfx: ${plan.inputs.gfx.join(',') || 'all'})`
    )
    if (plan.platform.os === 'linux' && plan.scheme === 'multiarch') {
      const root = await installMultiArch(plan.inputs, plan.platform.distro)
      applyEnv(buildEnv(root, 'linux'), 'linux', plan.inputs.version)
      return
    }
    throw new Error(
      `No install flow for ${plan.platform.os} / ${plan.scheme} yet.`
    )
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}
