// Used by .github/scripts/check-upstream.ts, not bundled. No imports:
// Node's type stripping cannot resolve the `.js` specifiers used in src/.
const CORE = 'https://stable.repo.amd.com/rocm/core'

export const SOURCES = {
  apt: `${CORE}/packages/ubuntu2404/dists/stable/main/binary-amd64/Packages`,
  rpm: `${CORE}/packages/rhel9/x86_64/`,
  tarball: `${CORE}/tarball/`,
  packages: `${CORE}/packages/`,
  legacy: 'https://repo.radeon.com/amdgpu-install/'
} as const

export type Pages = Record<keyof typeof SOURCES, string>

export const IGNORED_DIRS: readonly string[] = ['azl3']

export interface Supported {
  multiarch: readonly string[]
  legacy: readonly string[]
  repoDirs: readonly string[]
}

export interface Findings {
  /** New 10.x+ version -> the sources that list it. */
  multiarch: Map<string, string[]>
  legacy: string[]
  repoDirs: string[]
}

function all(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((m) => m[1] as string)
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareVersions)
}

/** `Version: 10.2.0-2` in the `Package: amdrocm10.2` stanza. */
export function aptVersions(packages: string): string[] {
  return sorted(
    all(
      packages,
      /^Package: amdrocm\d+\.\d+\n(?:.+\n)*?Version: (\d+\.\d+\.\d+)-/gm
    )
  )
}

/** `amdrocm10.2-10.2.0-2.x86_64.rpm`. */
export function rpmVersions(listing: string): string[] {
  return sorted(all(listing, /amdrocm\d+\.\d+-(\d+\.\d+\.\d+)-[^"/]*\.rpm/g))
}

/** `therock-dist-linux-multiarch-10.2.0.tar.gz` in the page's file list. */
export function tarballVersions(page: string): string[] {
  return sorted(all(page, /therock-dist-[\w-]+?-(\d+\.\d+\.\d+)\.tar\.gz/g))
}

/** `href="7.2/"` -> 7.2.0, `href="7.2.4/"` -> 7.2.4. ROCm 5-9 only. */
export function legacyVersions(listing: string): string[] {
  return sorted(
    all(listing, /href="([5-9]\.\d+(?:\.\d+)?)\/"/g).map((v) =>
      v.split('.').length === 2 ? `${v}.0` : v
    )
  )
}

/** `href="ubuntu2404/"`. */
export function repoDirs(listing: string): string[] {
  return [...new Set(all(listing, /href="([a-z]+\d+)\/"/g))]
}

export function findNew(pages: Pages, supported: Supported): Findings {
  const upstream: Record<string, string[]> = {
    apt: aptVersions(pages.apt),
    rpm: rpmVersions(pages.rpm),
    tarball: tarballVersions(pages.tarball)
  }
  for (const [name, list] of Object.entries(upstream)) {
    // Nothing parsed means AMD changed the page, not that nothing shipped
    if (list.length === 0) {
      throw new Error(`No ROCm versions found in the ${name} listing`)
    }
  }
  const dirs = repoDirs(pages.packages)
  if (dirs.length === 0) throw new Error('No repo directories found')

  const multiarch = new Map<string, string[]>()
  for (const v of sorted(Object.values(upstream).flat())) {
    if (supported.multiarch.includes(v)) continue
    multiarch.set(
      v,
      Object.keys(upstream).filter((name) => upstream[name]?.includes(v))
    )
  }

  const newest = sorted(supported.legacy).at(-1) ?? '0.0.0'
  const legacy = legacyVersions(pages.legacy).filter(
    (v) => compareVersions(v, newest) > 0
  )

  const repo = dirs.filter(
    (d) => !supported.repoDirs.includes(d) && !IGNORED_DIRS.includes(d)
  )

  return { multiarch, legacy, repoDirs: repo }
}

export function hasFindings(f: Findings): boolean {
  return f.multiarch.size > 0 || f.legacy.length > 0 || f.repoDirs.length > 0
}

export function formatReport(f: Findings, supported: Supported): string {
  if (!hasFindings(f)) return 'Nothing new upstream.'
  const lines = [
    'AMD publishes ROCm builds or repo directories the action does not support yet.',
    ''
  ]
  if (f.multiarch.size > 0) {
    lines.push('## New ROCm versions (10.x and later)', '')
    lines.push('| Version | Listed in |', '| --- | --- |')
    for (const [v, where] of f.multiarch) {
      lines.push(`| ${v} | ${where.join(', ')} |`)
    }
    lines.push('')
  }
  if (f.legacy.length > 0) {
    lines.push('## New legacy versions (amdgpu-install)', '')
    for (const v of f.legacy) lines.push(`- ${v}`)
    lines.push('')
  }
  if (f.repoDirs.length > 0) {
    lines.push('## New distro directories under `rocm/core/packages/`', '')
    for (const d of f.repoDirs) lines.push(`- \`${d}\``)
    lines.push('')
  }
  lines.push('## Sources', '')
  for (const url of Object.values(SOURCES)) lines.push(`- ${url}`)
  lines.push(
    '',
    `Supported now: ${[...supported.legacy, ...supported.multiarch].join(', ')}`,
    '',
    '_Updated by the weekly `Upstream check` workflow._'
  )
  return lines.join('\n')
}
