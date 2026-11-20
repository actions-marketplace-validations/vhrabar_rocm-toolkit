import * as exec from '@actions/exec'

/**
 * What `hipcc` needs from the host to compile and link,
 * and AMD's RPMs do not pull in.
 */
export const HIPCC_HOST_PACKAGES: readonly string[] = ['gcc-c++']

/** Whether `pkg` is installed according to rpm. Needs no root. */
export async function isRpmInstalled(pkg: string): Promise<boolean> {
  const { exitCode } = await exec.getExecOutput('rpm', ['-q', '--quiet', pkg], {
    silent: true,
    ignoreReturnCode: true
  })
  return exitCode === 0
}

/** Those of `packages` that rpm does not report as installed, in order. */
export async function missingRpms(
  packages: readonly string[]
): Promise<string[]> {
  const missing: string[] = []
  for (const pkg of packages)
    if (!(await isRpmInstalled(pkg))) missing.push(pkg)
  return missing
}
