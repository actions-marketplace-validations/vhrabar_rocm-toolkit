import {
  MULTIARCH_VERSIONS,
  SUPPORTED_VERSIONS,
  assertSupported,
  formatVersion
} from './versions.js'

export const COMPONENTS = [
  'runtime',
  'dev',
  'sdk',
  'developer-tools',
  'opencl'
] as const
export type Component = (typeof COMPONENTS)[number]

export interface RawInputs {
  version: string
  gfx: string
  components: string
  useCache: string
  logFileSuffix: string
}

export interface Inputs {
  version: string
  /** Empty array means all architectures. */
  gfx: string[]
  components: Component[]
  useCache: boolean
  logFileSuffix: string
}

const GFX_PATTERN = /^gfx[0-9a-f]{3,4}$/
const SUFFIX_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

export function parseGfx(input: string): string[] {
  const items = input
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
  if (items.length === 0) {
    throw new Error('Input "gfx" is empty. Use e.g. gfx1200 or "all".')
  }
  if (items.includes('all')) {
    if (items.length > 1) {
      throw new Error(
        'Input "gfx": "all" cannot be combined with other targets.'
      )
    }
    return []
  }
  for (const item of items) {
    if (!GFX_PATTERN.test(item)) {
      throw new Error(`Invalid gfx target "${item}". Expected e.g. gfx1200.`)
    }
  }
  return [...new Set(items)].sort()
}

export function parseComponents(input: string): Component[] {
  const items = input
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
  if (items.length === 0) {
    throw new Error('Input "components" is empty.')
  }
  for (const item of items) {
    if (!(COMPONENTS as readonly string[]).includes(item)) {
      throw new Error(
        `Invalid component "${item}". Allowed: ${COMPONENTS.join(', ')}.`
      )
    }
  }
  return [...new Set(items)] as Component[]
}

export function parseBoolean(name: string, input: string): boolean {
  const value = input.trim().toLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`Input "${name}" must be "true" or "false", got "${input}".`)
}

export function parseInputs(raw: RawInputs): Inputs {
  if (!raw.version.trim()) {
    throw new Error(
      `Input "version" is required: pin the ROCm version to install, e.g. ` +
        `${MULTIARCH_VERSIONS.at(-1)}. Supported: ${SUPPORTED_VERSIONS.join(', ')}.`
    )
  }
  const version = formatVersion(assertSupported(raw.version))
  const suffix = raw.logFileSuffix.trim() || 'log.txt'
  if (!SUFFIX_PATTERN.test(suffix)) {
    throw new Error(`Invalid log-file-suffix "${suffix}".`)
  }
  return {
    version,
    gfx: parseGfx(raw.gfx || 'all'),
    components: parseComponents(raw.components || 'dev'),
    useCache: parseBoolean('use-cache', raw.useCache || 'true'),
    logFileSuffix: suffix
  }
}
