/**
 * GPU target -> tarball family. The client families are published for both
 * Windows and Linux (stable.repo.amd.com/rocm/core/tarball/).
 */
export const CLIENT_FAMILIES: Readonly<Record<string, string>> = {
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

/**
 * Data-centre families, published for Linux only. Each holds exactly the
 * target mapped here, per the `.kpack/<lib>_<gfx>.kpack` files in its 10.1.0
 * tarball.
 */
export const DCGPU_FAMILIES: Readonly<Record<string, string>> = {
  gfx942: 'gfx94X-dcgpu',
  gfx950: 'gfx950-dcgpu',
  gfx1250: 'gfx125X-dcgpu'
}

export const MULTIARCH_FAMILY = 'multiarch'

/**
 * One family -> that tarball. No target ("all") or targets from several
 * families -> the multiarch tarball, which contains them all.
 */
export function selectFamily(
  gfx: readonly string[],
  families: Readonly<Record<string, string>>,
  platform: string
): string {
  if (gfx.length === 0) return MULTIARCH_FAMILY
  const selected = new Set<string>()
  for (const target of gfx) {
    const family = families[target]
    if (!family) {
      throw new Error(
        `There is no ${platform} build for GPU target "${target}". ` +
          `Supported targets: ${Object.keys(families).join(', ')}.`
      )
    }
    selected.add(family)
  }
  return selected.size === 1 ? ([...selected][0] as string) : MULTIARCH_FAMILY
}
