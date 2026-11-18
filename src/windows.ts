import * as core from '@actions/core'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as https from 'node:https'
import type { IncomingMessage } from 'node:http'
import * as path from 'node:path'
import type { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Inputs } from './inputs.js'
import { parseVersion } from './versions.js'

export const TARBALL_BASE = 'https://stable.repo.amd.com/rocm/core/tarball'
export const MARKER_FILE = '.setup-rocm'

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

export interface Fetcher {
  get(url: string): Promise<Readable>
  spawnTar(args: string[]): { stdin: Writable; done: Promise<void> }
}

export function httpGet(url: string, redirects = 3): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        if (redirects === 0) {
          reject(new Error(`Too many redirects downloading ${url}`))
          return
        }
        resolve(
          httpGet(new URL(res.headers.location, url).toString(), redirects - 1)
        )
        return
      }
      if (status !== 200) {
        res.resume()
        reject(new Error(`Download failed: HTTP ${status} for ${url}`))
        return
      }
      res.setTimeout(120_000, () =>
        res.destroy(new Error(`Download stalled: no data for 120 s (${url})`))
      )
      resolve(res)
    })
    request.on('error', reject)
  })
}

export const defaultFetcher: Fetcher = {
  get: httpGet,
  spawnTar(args) {
    const tar = path.win32.join(
      process.env['SystemRoot'] ?? 'C:\\Windows',
      'System32',
      'tar.exe'
    )
    const child = spawn(tar, args, { stdio: ['pipe', 'inherit', 'inherit'] })
    const done = new Promise<void>((resolve, reject) => {
      child.on('error', reject)
      child.on('close', (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`tar exited with code ${code}`))
      )
    })
    return { stdin: child.stdin, done }
  }
}

/** Stream the download straight into tar */
export async function downloadAndExtract(
  url: string,
  dest: string,
  fetcher: Fetcher = defaultFetcher
): Promise<void> {
  const body = await fetcher.get(url)
  const tar = fetcher.spawnTar(['-xzf', '-', '-C', dest])
  await Promise.all([pipeline(body, tar.stdin), tar.done])
}

/** Install the ROCm 10.x tarball on Windows. Returns the install prefix. */
export async function installWindows(
  inputs: Inputs,
  fetcher: Fetcher = defaultFetcher
): Promise<string> {
  const family = windowsFamily(inputs.gfx)
  const prefix = windowsPrefix(inputs.version, process.env['SystemDrive'])
  const hipcc = path.win32.join(prefix, 'bin', 'hipcc.exe')
  const marker = path.win32.join(prefix, MARKER_FILE)
  const stamp = `${family} ${inputs.version}`

  if (inputs.components.some((c) => c !== 'dev')) {
    core.warning(
      'Input "components" has no effect on Windows; the tarball is installed ' +
        'whole.'
    )
  }

  const upToDate =
    fs.existsSync(hipcc) &&
    fs.existsSync(marker) &&
    fs.readFileSync(marker, 'utf8').trim() === stamp
  if (upToDate) {
    core.info(`ROCm ${stamp} is already installed in ${prefix}`)
    return prefix
  }

  if (fs.existsSync(prefix)) {
    core.info(`Removing the previous install in ${prefix}`)
    fs.rmSync(prefix, { recursive: true, force: true })
  }
  fs.mkdirSync(prefix, { recursive: true })

  const url = tarballUrl(inputs.version, family)
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
  return prefix
}
