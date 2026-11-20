import * as exec from '@actions/exec'
import * as io from '@actions/io'

/** How privileged commands are run: as-is (already root) or through sudo. */
export type Elevation = 'direct' | 'sudo'

/**
 * Decide how to run privileged commands. Job containers usually run as root
 * and ship no sudo, so run directly there; otherwise go through sudo.
 */
export async function resolveElevation(): Promise<Elevation> {
  if (process.getuid?.() === 0) return 'direct'
  if (await io.which('sudo', false)) return 'sudo'
  throw new Error(
    'Installing ROCm needs root privileges: run the job as root ' +
      '(e.g. in a container) or make sudo available on the runner'
  )
}

/** Run a command that needs root privileges. */
export async function asRoot(args: string[]): Promise<void> {
  const [cmd, ...rest] = args
  if (cmd === undefined) throw new Error('asRoot: no command given')
  if ((await resolveElevation()) === 'direct') await exec.exec(cmd, rest)
  else await exec.exec('sudo', args)
}
