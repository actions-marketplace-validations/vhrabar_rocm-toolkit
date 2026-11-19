import type { PackageManagerKind } from '../platform.js'
import { apt } from './apt.js'
import { dnf } from './dnf.js'
import type { PackageManager } from './types.js'

/**
 * Package managers that have an install flow.
 */
const MANAGERS: Partial<Record<PackageManagerKind, PackageManager>> = {
  apt,
  dnf
}

export function packageManagerFor(
  kind: PackageManagerKind | undefined
): PackageManager | undefined {
  return kind ? MANAGERS[kind] : undefined
}
