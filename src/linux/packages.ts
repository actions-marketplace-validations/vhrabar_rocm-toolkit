import type { Component } from '../inputs.js'
import type { PackageManagerKind } from '../platform.js'
import { majorMinor } from './prefix.js'

export const REPO_BASE = 'https://stable.repo.amd.com/rocm/core/packages'

/**
 * Repo URL for `distro`, metadata is one step belowe
 */
export function repoUrl(distro: string, kind: PackageManagerKind): string {
  return kind === 'apt'
    ? `${REPO_BASE}/${distro}`
    : `${REPO_BASE}/${distro}/x86_64/`
}

/**
 * Name of the `dev` component's package. AMD follows each format's own
 * convention: `-dev` for .deb, `-devel` for RPM (rhel8/9/10 and sles15/16
 * listings).
 */
const DEV_PACKAGE: Readonly<Record<PackageManagerKind, string>> = {
  apt: 'amdrocm-core-dev',
  dnf: 'amdrocm-core-devel',
  zypper: 'amdrocm-core-devel'
}

/**
 * Map components x gfx to the package names of `kind`. An empty gfx list
 * means all architectures, which uses the version-only package names.
 */
export function packageNames(
  version: string,
  gfx: readonly string[],
  components: readonly Component[],
  kind: PackageManagerKind
): string[] {
  const mm = majorMinor(version)
  const archs = gfx.length > 0 ? gfx.map((g) => `-${g}`) : ['']
  const names: string[] = []
  for (const component of components) {
    switch (component) {
      case 'runtime':
        for (const a of archs) names.push(`amdrocm${mm}${a}`)
        break
      case 'dev':
        for (const a of archs) names.push(`${DEV_PACKAGE[kind]}${mm}${a}`)
        break
      case 'sdk':
        for (const a of archs) names.push(`amdrocm-core-sdk${mm}${a}`)
        break
      case 'developer-tools':
        names.push(`amdrocm-developer-tools${mm}`)
        break
      case 'opencl':
        names.push(`amdrocm-opencl${mm}`)
        break
    }
  }
  return [...new Set(names)]
}
