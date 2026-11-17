export type Os = 'linux' | 'windows'

export interface Platform {
  os: Os
  arch: string
  /** Repo path segment on Linux, e.g. ubuntu2404. Empty on Windows. */
  distro: string
}

export interface OsRelease {
  id: string
  versionId: string
}

const SUPPORTED_DISTROS: Readonly<Record<string, readonly string[]>> = {
  ubuntu: ['22.04', '24.04', '26.04'],
  debian: ['12', '13']
}

export function parseOsRelease(text: string): OsRelease {
  const fields = new Map<string, string>()
  for (const line of text.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (match) {
      fields.set(match[1] as string, (match[2] as string).replace(/^"|"$/g, ''))
    }
  }
  return {
    id: fields.get('ID') ?? '',
    versionId: fields.get('VERSION_ID') ?? ''
  }
}

/** Map os-release data to the apt repo distro name, e.g. ubuntu2404. */
export function distroName(release: OsRelease): string {
  const versions = SUPPORTED_DISTROS[release.id]
  if (!versions || !versions.includes(release.versionId)) {
    const supported = Object.entries(SUPPORTED_DISTROS)
      .map(([id, v]) => `${id} ${v.join('/')}`)
      .join(', ')
    throw new Error(
      `Unsupported distribution "${release.id} ${release.versionId}". ` +
        `Supported: ${supported}.`
    )
  }
  return `${release.id}${release.versionId.replace('.', '')}`
}

export function osFromNodePlatform(nodePlatform: string): Os {
  if (nodePlatform === 'linux') return 'linux'
  if (nodePlatform === 'win32') return 'windows'
  throw new Error(
    `Unsupported operating system "${nodePlatform}". Use Linux or Windows.`
  )
}

export function detectPlatform(
  nodePlatform: string,
  arch: string,
  readOsRelease: () => string
): Platform {
  const os = osFromNodePlatform(nodePlatform)
  if (os === 'windows') return { os, arch, distro: '' }
  return { os, arch, distro: distroName(parseOsRelease(readOsRelease())) }
}
