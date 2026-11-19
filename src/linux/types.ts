import type { PackageManagerKind } from '../platform.js'

/**
 * What differs between distros when installing from the AMD package repo.
 * Everything else (key check, package names, prefix) is shared.
 */
export interface PackageManager {
  readonly kind: PackageManagerKind
  /** Install the tools the key check and repo setup need, if missing. */
  ensurePrereqs(): Promise<void>
  /** Trust the checked key file and register the repo for `distro`. */
  addRepo(distro: string, keyFile: string): Promise<void>
  /** Refresh metadata and install `packages`. */
  install(packages: readonly string[]): Promise<void>
}
