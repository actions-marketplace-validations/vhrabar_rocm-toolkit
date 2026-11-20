import * as exec from '@actions/exec'
import * as tc from '@actions/tool-cache'

export const KEY_URL = 'https://stable.repo.amd.com/rocm/gpg/packages.gpg'
/** Primary key fingerprint of the AMD package signing key (see docs/RESEARCH.md). */
export const KEY_FINGERPRINT = 'D0F004A0025A1145C7807FCD0701EAC4D5E02107'

/** Extract fingerprints from `gpg --show-keys --with-colons` output. */
export function parseFingerprints(colonOutput: string): string[] {
  return colonOutput
    .split('\n')
    .filter((line) => line.startsWith('fpr:'))
    .map((line) => line.split(':')[9] ?? '')
    .filter((fpr) => fpr.length > 0)
}

/**
 * Download the AMD signing key and refuse it unless it carries the expected
 * fingerprint. Returns the path of the ASCII-armored key file.
 */
export async function fetchCheckedKey(): Promise<string> {
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
  return keyFile
}
