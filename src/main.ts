import * as core from '@actions/core'
import * as fs from 'node:fs'
import * as os from 'node:os'
import { parseInputs, type Inputs } from './inputs.js'
import { applyEnv, buildEnv } from './env.js'
import { installLegacy } from './legacy.js'
import { installMultiArch } from './linux.js'
import { installWindows } from './windows.js'
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

/**
 * Validate inputs first so a bad input is reported even on an unsupported
 * platform, then detect the platform.
 */
export function makePlan(
  raw: Parameters<typeof parseInputs>[0],
  detect: () => Platform
): Plan {
  const inputs = parseInputs(raw)
  const scheme = selectScheme(parseVersion(inputs.version))
  return { inputs, platform: detect(), scheme }
}

export async function run(): Promise<void> {
  try {
    const plan = makePlan(readRawInputs(), () =>
      detectPlatform(process.platform, os.arch(), () =>
        fs.readFileSync('/etc/os-release', 'utf8')
      )
    )
    core.info(
      `Plan: ROCm ${plan.inputs.version} on ${plan.platform.os} ` +
        `(${plan.scheme}, gfx: ${plan.inputs.gfx.join(',') || 'all'})`
    )
    if (plan.platform.os === 'linux' && plan.scheme === 'multiarch') {
      const root = await installMultiArch(plan.inputs, plan.platform.distro)
      applyEnv(buildEnv(root, 'linux'), 'linux', plan.inputs.version)
      return
    }
    if (plan.platform.os === 'linux' && plan.scheme === 'legacy') {
      const root = await installLegacy(plan.inputs, plan.platform.distro)
      applyEnv(buildEnv(root, 'linux'), 'linux', plan.inputs.version)
      return
    }
    if (plan.platform.os === 'windows') {
      if (plan.scheme !== 'multiarch') {
        throw new Error(
          `ROCm ${plan.inputs.version} is not available on Windows through ` +
            `this action. Windows supports ROCm 10.x only.`
        )
      }
      const root = await installWindows(plan.inputs)
      applyEnv(buildEnv(root, 'windows'), 'windows', plan.inputs.version)
      return
    }
    throw new Error(`No install flow for ${plan.platform.os} / ${plan.scheme}.`)
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error))
  }
}
