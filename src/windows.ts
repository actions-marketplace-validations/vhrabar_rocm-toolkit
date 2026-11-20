import * as core from '@actions/core'
import * as path from 'node:path'
import type { Inputs } from './inputs.js'
import {
  TARBALL_BASE,
  httpGet,
  spawnTar,
  type Fetcher
} from './tarball/download.js'
import { installTarball } from './tarball/install.js'
import { parseVersion } from './versions.js'

/**
 * GPU target -> tarball family, Linux-only targets are not listed.
 */
const FAMILIES: Readonly<Record<string, string>> = {
  gfx1010: 'gfx101X-dgpu',
  gfx1011: 'gfx101X-dgpu',
  gfx1012: 'gfx101X-dgpu',
  gfx1030: 'gfx103X-all',
  gfx1031: 'gfx103X-all',
  gfx1032: 'gfx103X-all',
  gfx1033: 'gfx103X-all',
  gfx1034: 'gfx103X-all',
  gfx1035: 'gfx103X-all',
  gfx1036: 'gfx103X-all',
  gfx1100: 'gfx110X-all',
  gfx1101: 'gfx110X-all',
  gfx1102: 'gfx110X-all',
  gfx1103: 'gfx110X-all',
  gfx1150: 'gfx1150',
  gfx1151: 'gfx1151',
  gfx1152: 'gfx1152',
  gfx1153: 'gfx1153',
  gfx1200: 'gfx120X-all',
  gfx1201: 'gfx120X-all',
  gfx908: 'gfx908',
  gfx90a: 'gfx90a'
}

export const MULTIARCH_FAMILY = 'multiarch'

/**
 * One family -> that tarball. No target ("all") or several families -> m-arch
 */
export function windowsFamily(gfx: readonly string[]): string {
  if (gfx.length === 0) return MULTIARCH_FAMILY
  const families = new Set<string>()
  for (const target of gfx) {
    const family = FAMILIES[target]
    if (!family) {
      throw new Error(
        `There is no Windows build for GPU target "${target}". ` +
          `Supported targets: ${Object.keys(FAMILIES).join(', ')}.`
      )
    }
    families.add(family)
  }
  return families.size === 1 ? ([...families][0] as string) : MULTIARCH_FAMILY
}

export function tarballUrl(version: string, family: string): string {
  return `${TARBALL_BASE}/therock-dist-windows-${family}-${version}.tar.gz`
}

/** C:\rocm\core-v */
export function windowsPrefix(version: string, drive = 'C:'): string {
  const v = parseVersion(version)
  return `${drive}\\rocm\\core-${v.major}.${v.minor}`
}

export const defaultFetcher: Fetcher = {
  get: httpGet,
  spawnTar(args) {
    const tar = path.win32.join(
      process.env['SystemRoot'] ?? 'C:\\Windows',
      'System32',
      'tar.exe'
    )
    return spawnTar(tar, args)
  }
}

/** Install the ROCm 10.x tarball on Windows. Returns the install prefix. */
export async function installWindows(
  inputs: Inputs,
  fetcher: Fetcher = defaultFetcher
): Promise<string> {
  const family = windowsFamily(inputs.gfx)
  const prefix = windowsPrefix(inputs.version, process.env['SystemDrive'])
  const hipcc = path.win32.join(prefix, 'bin', 'hipcc.exe')
  const stamp = `${family} ${inputs.version}`

  if (inputs.components.some((c) => c !== 'dev')) {
    core.warning(
      'Input "components" has no effect on Windows; the tarball is installed ' +
        'whole.'
    )
  }

  await installTarball(
    {
      url: tarballUrl(inputs.version, family),
      prefix,
      hipcc,
      stamp,
      join: path.win32.join
    },
    fetcher
  )
  return prefix
}
