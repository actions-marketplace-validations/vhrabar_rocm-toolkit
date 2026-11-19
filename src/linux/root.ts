import * as exec from '@actions/exec'

/** Run a command that needs root privileges. */
export async function asRoot(args: string[]): Promise<void> {
  await exec.exec('sudo', args)
}
