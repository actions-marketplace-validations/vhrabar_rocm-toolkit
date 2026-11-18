export type Scheme = 'multiarch' | 'legacy'

export interface RocmVersion {
  major: number
  minor: number
  patch: number
}

// Versions the action accepts.
export const MULTIARCH_VERSIONS: readonly string[] = ['10.0.0', '10.1.0']
export const LEGACY_VERSIONS: readonly string[] = ['6.2.2', '7.0.1', '7.2.4']

export const SUPPORTED_VERSIONS: readonly string[] = [
  ...LEGACY_VERSIONS,
  ...MULTIARCH_VERSIONS
]

export const DEFAULT_VERSION: string = MULTIARCH_VERSIONS.at(-1) as string

const VERSION_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function parseVersion(input: string): RocmVersion {
  const match = VERSION_PATTERN.exec(input.trim())
  if (!match) {
    throw new Error(
      `Invalid ROCm version "${input}". Expected MAJOR.MINOR.PATCH, e.g. 10.1.0.`
    )
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  }
}

/** Legacy: <= 7.2.x. Multi-arch: >= 10. */
export function selectScheme(version: RocmVersion): Scheme {
  if (version.major >= 10) return 'multiarch'
  if (version.major < 7 || (version.major === 7 && version.minor <= 2)) {
    return 'legacy'
  }
  throw new Error(
    `ROCm ${version.major}.${version.minor}.${version.patch} uses a packaging ` +
      `scheme this action does not support. Use 10.x or 7.2.x and older.`
  )
}

export function assertSupported(input: string): RocmVersion {
  const version = parseVersion(input)
  selectScheme(version)
  const normalized = `${version.major}.${version.minor}.${version.patch}`
  if (!SUPPORTED_VERSIONS.includes(normalized)) {
    throw new Error(
      `ROCm ${normalized} is not in the supported list: ` +
        `${SUPPORTED_VERSIONS.join(', ')}.`
    )
  }
  return version
}

export function formatVersion(version: RocmVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`
}
