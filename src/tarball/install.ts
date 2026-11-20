import * as core from '@actions/core'
import * as fs from 'node:fs'
import { MARKER_FILE, downloadAndExtract, type Fetcher } from './download.js'

export interface TarballTarget {
  /** Tarball to download. */
  url: string
  /** Directory the tarball is extracted into; it becomes the ROCm root. */
  prefix: string
  /** The compiler driver that must exist after extraction. */
  hipcc: string
  /**
   * Identifies what is installed (e.g. "gfx120X-all 10.1.0").
   */
  stamp: string
  /** The platform's `path.join` (win32 or posix), for the marker path. */
  join: (...parts: string[]) => string
}

/**
 * Install a ROCm tarball into `prefix`, idempotently: an install with the
 * same stamp is kept, anything else in `prefix` is replaced.
 */
export async function installTarball(
  target: TarballTarget,
  fetcher: Fetcher
): Promise<void> {
  const { url, prefix, hipcc, stamp } = target
  const marker = target.join(prefix, MARKER_FILE)

  const upToDate =
    fs.existsSync(hipcc) &&
    fs.existsSync(marker) &&
    fs.readFileSync(marker, 'utf8').trim() === stamp
  if (upToDate) {
    core.info(`ROCm ${stamp} is already installed in ${prefix}`)
    return
  }

  if (fs.existsSync(prefix)) {
    core.info(`Removing the previous install in ${prefix}`)
    fs.rmSync(prefix, { recursive: true, force: true })
  }
  fs.mkdirSync(prefix, { recursive: true })

  core.startGroup(`Download and extract ${url}`)
  const started = Date.now()
  await downloadAndExtract(url, prefix, fetcher)
  core.info(`Done in ${Math.round((Date.now() - started) / 1000)} s`)
  core.endGroup()

  if (!fs.existsSync(hipcc)) {
    throw new Error(
      `Extraction finished but ${hipcc} does not exist. ` +
        `The tarball layout may have changed.`
    )
  }
  fs.writeFileSync(marker, `${stamp}\n`)
}
