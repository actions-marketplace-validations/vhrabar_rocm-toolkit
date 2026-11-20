import { spawn } from 'node:child_process'
import * as https from 'node:https'
import type { IncomingMessage } from 'node:http'
import type { Readable, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const TARBALL_BASE = 'https://stable.repo.amd.com/rocm/core/tarball'
export const MARKER_FILE = '.setup-rocm'

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

/** Start `tar` at an absolute path with its stdin open for the archive. */
export function spawnTar(
  tar: string,
  args: string[]
): { stdin: Writable; done: Promise<void> } {
  const child = spawn(tar, args, { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise<void>((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`tar exited with code ${code}`))
    )
  })
  return { stdin: child.stdin, done }
}

/** Stream the download straight into tar */
export async function downloadAndExtract(
  url: string,
  dest: string,
  fetcher: Fetcher
): Promise<void> {
  const body = await fetcher.get(url)
  const tar = fetcher.spawnTar(['-xzf', '-', '-C', dest])
  await Promise.all([pipeline(body, tar.stdin), tar.done])
}
