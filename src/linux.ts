import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { Component, Inputs } from './inputs.js'
import { parseVersion } from './versions.js'

export const REPO_BASE = 'https://stable.repo.amd.com/rocm/core/packages'
export const KEY_URL = 'https://stable.repo.amd.com/rocm/gpg/packages.gpg'
/** Primary key fingerprint of the AMD package signing key (see docs/RESEARCH.md). */
export const KEY_FINGERPRINT = 'D0F004A0025A1145C7807FCD0701EAC4D5E02107'
export const KEYRING_PATH = '/etc/apt/keyrings/amdrocm.gpg'
export const SOURCES_PATH = '/etc/apt/sources.list.d/amdrocm.sources'

/** Package-name suffix and install directory use MAJOR.MINOR only. */
export function majorMinor(version: string): string {
  const v = parseVersion(version)
  return `${v.major}.${v.minor}`
}

export function installPrefix(version: string): string {
  return `/opt/rocm/core-${majorMinor(version)}`
}

export function buildSources(distro: string): string {
  return [
    'Types: deb',
    `URIs: ${REPO_BASE}/${distro}`,
    'Suites: stable',
    'Components: main',
    'Architectures: amd64',
    `Signed-By: ${KEYRING_PATH}`,
    ''
  ].join('\n')
}

/**
 * Map components x gfx to apt package names. An empty gfx list means all
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

/** Extract fingerprints from `gpg --show-keys --with-colons` output. */
export function parseFingerprints(colonOutput: string): string[] {
  return colonOutput
    .split('\n')
    .filter((line) => line.startsWith('fpr:'))
    .map((line) => line.split(':')[9] ?? '')
    .filter((fpr) => fpr.length > 0)
}

async function sudo(args: string[]): Promise<void> {
  await exec.exec('sudo', args)
}

async function installKey(): Promise<void> {
  const keyFile = await tc.downloadTool(KEY_URL)
  const shown = await exec.getExecOutput(
    'gpg',
    ['--show-keys', '--with-colons', keyFile],
    { silent: true }
  )
  if (!parseFingerprints(shown.stdout).includes(KEY_FINGERPRINT)) {
    throw new Error(
      `The downloaded AMD signing key does not match the expected fingerprint ` +
        `${KEY_FINGERPRINT}. Refusing to trust it.`
    )
  }
  await sudo(['mkdir', '-p', path.posix.dirname(KEYRING_PATH)])
  await sudo([
    'gpg',
    '--batch',
    '--yes',
    '--dearmor',
    '-o',
    KEYRING_PATH,
    keyFile
  ])
  await sudo(['chmod', '0644', KEYRING_PATH])
}

async function installSources(distro: string): Promise<void> {
  const tmp = path.join(
    process.env['RUNNER_TEMP'] ?? os.tmpdir(),
    'amdrocm.sources'
  )
  fs.writeFileSync(tmp, buildSources(distro))
  await sudo(['install', '-m', '0644', tmp, SOURCES_PATH])
}

/** Install ROCm 10.x from the multi-arch apt repo. Returns the install prefix. */
export async function installMultiArch(
  inputs: Inputs,
  distro: string
): Promise<string> {
  const packages = packageNames(inputs.version, inputs.gfx, inputs.components)
  core.startGroup('Configure the AMD ROCm apt repository')
  await installKey()
  await installSources(distro)
  core.endGroup()

  core.startGroup(`Install ${packages.join(' ')}`)
  const apt = ['env', 'DEBIAN_FRONTEND=noninteractive', 'apt-get']
  await sudo([...apt, 'update'])
  await sudo([...apt, 'install', '-y', '--no-install-recommends', ...packages])
  core.endGroup()

  const prefix = installPrefix(inputs.version)
  const hipcc = path.posix.join(prefix, 'bin', 'hipcc')
  if (!fs.existsSync(hipcc)) {
    throw new Error(
      `Installation finished but ${hipcc} does not exist. ` +
        `Include the "dev" or "sdk" component to get the compiler.`
    )
  }
  return prefix
}
