import * as fs from 'node:fs'
import * as path from 'node:path'
import { parseVersion } from '../versions.js'

/** Package-name suffix and install directory use MAJOR.MINOR only. */
export function majorMinor(version: string): string {
  const v = parseVersion(version)
  return `${v.major}.${v.minor}`
}

export function installPrefix(version: string): string {
  return `/opt/rocm/core-${majorMinor(version)}`
}

/** Fail unless the install left a compiler driver in `<prefix>/bin`. */
export function requireHipcc(prefix: string): void {
  const hipcc = path.posix.join(prefix, 'bin', 'hipcc')
  if (!fs.existsSync(hipcc)) {
    throw new Error(
      `Installation finished but ${hipcc} does not exist. ` +
        `Include the "dev" or "sdk" component to get the compiler.`
    )
  }
}
