import { codenameFor, legacyPackages, listingUrl } from './linux/legacy.js'
import { REPO_BASE, packageNames } from './linux/packages.js'
import type { Plan } from './main.js'
import { tarballUrl, windowsFamily } from './windows.js'

/**
 * Evaluate `fn` for a context line. The flow has usually already thrown for
 * the same reason, so a failure here must not hide the original error.
 */
function safe(fn: () => string): string {
  try {
    return fn()
  } catch (error) {
    return `(unknown: ${error instanceof Error ? error.message : String(error)})`
  }
}

/**
 * What the action set out to do, built with the same helpers the install
 * flows use, so a failure can be diagnosed from the message alone.
 */
export function describePlan(plan: Plan): string[] {
  const { inputs, platform, scheme } = plan
  const lines = [`ROCm:     ${inputs.version} (${scheme} flow)`]

  if (platform.os === 'windows') {
    lines.push(`Platform: windows ${platform.arch}`)
    lines.push(
      `Tarball:  ${safe(() => tarballUrl(inputs.version, windowsFamily(inputs.gfx)))}`
    )
    return lines
  }

  lines.push(
    `Platform: linux ${platform.arch}, ${platform.distro} ` +
      `(${platform.packageManager ?? 'unknown package manager'})`
  )
  if (scheme === 'legacy') {
    lines.push(
      `Installer from: ${safe(() => listingUrl(inputs.version, codenameFor(platform.distro)))}`
    )
    lines.push(`Packages: ${legacyPackages(inputs.components).join(' ')}`)
  } else {
    lines.push(`Repo:     ${REPO_BASE}/${platform.distro}`)
    lines.push(
      `Packages: ${packageNames(inputs.version, inputs.gfx, inputs.components).join(' ')}`
    )
  }
  return lines
}

/** The step's failure message: the error +plan. */
export function failureMessage(error: unknown, plan?: Plan): string {
  const message = error instanceof Error ? error.message : String(error)
  if (!plan) return message
  return [message, '', 'Install context:', ...describePlan(plan)].join('\n')
}
