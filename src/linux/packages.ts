import type { Component } from '../inputs.js'
import { majorMinor } from './prefix.js'

export const REPO_BASE = 'https://stable.repo.amd.com/rocm/core/packages'

/**
 * Map components x gfx to package names. An empty gfx list means all
 * architectures, which uses the version-only package names.
 */
export function packageNames(
  version: string,
  gfx: readonly string[],
  components: readonly Component[]
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
        for (const a of archs) names.push(`amdrocm-core-dev${mm}${a}`)
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
