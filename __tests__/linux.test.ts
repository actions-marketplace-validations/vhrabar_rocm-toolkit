import { jest } from '@jest/globals'

const core = { startGroup: jest.fn(), endGroup: jest.fn() }
const execMock = {
  exec: jest.fn<(cmd: string, args?: string[]) => Promise<number>>(),
  getExecOutput:
    jest.fn<
      (
        cmd: string,
        args?: string[],
        opts?: unknown
      ) => Promise<{ stdout: string }>
    >()
}
const tc = { downloadTool: jest.fn<(url: string) => Promise<string>>() }
const fsMock = {
  writeFileSync: jest.fn(),
  existsSync: jest.fn<(p: string) => boolean>()
}
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/exec', () => execMock)
jest.unstable_mockModule('@actions/tool-cache', () => tc)
jest.unstable_mockModule('node:fs', () => ({ ...fsMock, default: fsMock }))

const linux = await import('../src/linux.js')

const GOOD_KEY = `pub:-:4096:1:0701EAC4D5E02107:::::scESC:::::::
fpr:::::::::${linux.KEY_FINGERPRINT}:
sub:-:4096:1:FA296B056C5BB456::::::s:::::::
fpr:::::::::C367239A86C9B62AF49C921EFA296B056C5BB456:
`

describe('installPrefix / majorMinor', () => {
  it('uses MAJOR.MINOR only', () => {
    expect(linux.majorMinor('10.1.0')).toBe('10.1')
    expect(linux.installPrefix('10.1.0')).toBe('/opt/rocm/core-10.1')
    expect(linux.installPrefix('10.0.0')).toBe('/opt/rocm/core-10.0')
  })
})

describe('buildSources', () => {
  it('writes a deb822 stanza for the distro', () => {
    expect(linux.buildSources('ubuntu2404')).toBe(
      [
        'Types: deb',
        'URIs: https://stable.repo.amd.com/rocm/core/packages/ubuntu2404',
        'Suites: stable',
        'Components: main',
        'Architectures: amd64',
        'Signed-By: /etc/apt/keyrings/amdrocm.gpg',
        ''
      ].join('\n')
    )
  })
})

describe('packageNames', () => {
  it('builds per-gfx names for dev', () => {
    expect(linux.packageNames('10.1.0', ['gfx1200'], ['dev'])).toEqual([
      'amdrocm-core-dev10.1-gfx1200'
    ])
  })

  it('expands components x gfx', () => {
    expect(
      linux.packageNames('10.1.0', ['gfx1200', 'gfx90a'], ['runtime', 'sdk'])
    ).toEqual([
      'amdrocm10.1-gfx1200',
      'amdrocm10.1-gfx90a',
      'amdrocm-core-sdk10.1-gfx1200',
      'amdrocm-core-sdk10.1-gfx90a'
    ])
  })

  it('uses version-only names for all architectures', () => {
    expect(linux.packageNames('10.1.0', [], ['dev'])).toEqual([
      'amdrocm-core-dev10.1'
    ])
  })

  it('adds arch-independent extras once', () => {
    expect(
      linux.packageNames(
        '10.1.0',
        ['gfx1200', 'gfx1201'],
        ['developer-tools', 'opencl']
      )
    ).toEqual(['amdrocm-developer-tools10.1', 'amdrocm-opencl10.1'])
  })
})

describe('parseFingerprints', () => {
  it('reads every fpr record', () => {
    expect(linux.parseFingerprints(GOOD_KEY)).toEqual([
      linux.KEY_FINGERPRINT,
      'C367239A86C9B62AF49C921EFA296B056C5BB456'
    ])
  })
})

describe('installMultiArch', () => {
  const inputs = {
    version: '10.1.0',
    gfx: ['gfx1200'],
    components: ['dev' as const],
    useCache: true,
    logFileSuffix: 'log.txt'
  }

  beforeEach(() => {
    tc.downloadTool.mockResolvedValue('/tmp/key.gpg')
    execMock.getExecOutput.mockResolvedValue({ stdout: GOOD_KEY })
    execMock.exec.mockResolvedValue(0)
    fsMock.existsSync.mockReturnValue(true)
  })

  it('configures apt, installs packages and returns the prefix', async () => {
    const prefix = await linux.installMultiArch(inputs, 'ubuntu2404')
    expect(prefix).toBe('/opt/rocm/core-10.1')
    const calls = execMock.exec.mock.calls.map(([cmd, args]) => [
      cmd,
      ...(args ?? [])
    ])
    expect(calls).toContainEqual([
      'sudo',
      'gpg',
      '--batch',
      '--yes',
      '--dearmor',
      '-o',
      '/etc/apt/keyrings/amdrocm.gpg',
      '/tmp/key.gpg'
    ])
    expect(calls).toContainEqual([
      'sudo',
      'env',
      'DEBIAN_FRONTEND=noninteractive',
      'apt-get',
      'install',
      '-y',
      '--no-install-recommends',
      'amdrocm-core-dev10.1-gfx1200'
    ])
    expect(fsMock.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('amdrocm.sources'),
      expect.stringContaining('ubuntu2404')
    )
  })

  it('refuses a key with an unexpected fingerprint', async () => {
    execMock.getExecOutput.mockResolvedValue({
      stdout: 'fpr:::::::::AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:\n'
    })
    await expect(linux.installMultiArch(inputs, 'ubuntu2404')).rejects.toThrow(
      /does not match the expected fingerprint/
    )
    expect(execMock.exec).not.toHaveBeenCalled()
  })

  it('fails when hipcc is missing after install', async () => {
    fsMock.existsSync.mockReturnValue(false)
    await expect(linux.installMultiArch(inputs, 'ubuntu2404')).rejects.toThrow(
      /bin\/hipcc does not exist/
    )
  })

  it('stops on a failing apt command', async () => {
    execMock.exec.mockRejectedValueOnce(new Error('sudo failed'))
    await expect(linux.installMultiArch(inputs, 'ubuntu2404')).rejects.toThrow(
      /sudo failed/
    )
  })
})
