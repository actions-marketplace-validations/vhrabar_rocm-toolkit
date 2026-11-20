export type Os = 'linux' | 'windows'

export type PackageManagerKind = 'apt' | 'dnf' | 'zypper'

export interface Platform {
  os: Os
  arch: string
  /** AMD repo directory on Linux, e.g. ubuntu2404. Empty on Windows. */
  distro: string
  packageManager?: PackageManagerKind
  /**
   * Set on Linux when AMD publishes no package repo for the distro -> tarball
   */
  noPackageRepo?: string
}

export interface OsRelease {
  id: string
  idLike: string[]
  versionId: string
}

export interface LinuxDistro {
  distro: string
  packageManager: PackageManagerKind
}

/**
 * A distro family as AMD packages it under `rocm/core/packages/<repo><ver>/`.
 */
interface Family {
  repo: string
  packageManager: PackageManagerKind
  /** `ID` values of the family. */
  ids: readonly string[]
  like?: string
  match: 'exact' | 'major'
  versions: readonly string[]
}

const FAMILIES: readonly Family[] = [
  {
    repo: 'ubuntu',
    packageManager: 'apt',
    ids: ['ubuntu'],
    match: 'exact',
    versions: ['22.04', '24.04', '26.04']
  },
  {
    repo: 'debian',
    packageManager: 'apt',
    ids: ['debian'],
    match: 'exact',
    versions: ['12', '13']
  },
  {
    // Oracle Linux and UBI list only `fedora` in ID_LIKE, so they need their
    // ID here. Fedora and Amazon Linux (also ID_LIKE=fedora) stay unsupported.
    repo: 'rhel',
    packageManager: 'dnf',
    ids: ['rhel', 'almalinux', 'rocky', 'centos', 'ol'],
    like: 'rhel',
    match: 'major',
    versions: ['8', '9', '10']
  },
  {
    // Tumbleweed also matches `suse` but is rejected by its date VERSION_ID.
    repo: 'sles',
    packageManager: 'zypper',
    ids: ['sles', 'opensuse-leap'],
    like: 'suse',
    match: 'major',
    versions: ['15', '16']
  }
]

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
    idLike: (fields.get('ID_LIKE') ?? '').split(/\s+/).filter(Boolean),
    versionId: fields.get('VERSION_ID') ?? ''
  }
}

function findFamily(release: OsRelease): Family | undefined {
  return (
    FAMILIES.find((f) => f.ids.includes(release.id)) ??
    FAMILIES.find((f) => f.like && release.idLike.includes(f.like))
  )
}

function supportedList(): string {
  return FAMILIES.map((f) => {
    const others = f.ids.filter((id) => id !== f.repo)
    const alias = others.length > 0 ? ` (also ${others.join(', ')})` : ''
    return `${f.repo} ${f.versions.join('/')}${alias}`
  }).join('; ')
}

/** Map os-release data to the AMD repo directory and its package manager. */
export function resolveDistro(release: OsRelease): LinuxDistro {
  const family = findFamily(release)
  const version =
    family?.match === 'major'
      ? (release.versionId.split('.')[0] ?? '')
      : release.versionId
  if (!family || !family.versions.includes(version)) {
    const name = `${release.id} ${release.versionId}`.trim() || 'unknown'
    throw new Error(
      `Unsupported distribution "${name}". Supported: ${supportedList()}.`
    )
  }
  return {
    distro: `${family.repo}${version.replace('.', '')}`,
    packageManager: family.packageManager
  }
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
  try {
    return { os, arch, ...resolveDistro(parseOsRelease(readOsRelease())) }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { os, arch, distro: '', noPackageRepo: reason }
  }
}
